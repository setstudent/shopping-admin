// (安全檢查 - 買家)
(function() {
    const token = localStorage.getItem('token');
    const role = localStorage.getItem('role');
    if (!token || role !== 'BUYER') {
        alert('您沒有權限訪問此頁面，請以「買家」身分登入。');
        window.location.href = 'login.html?role=BUYER';
    }
})(); 

document.addEventListener("DOMContentLoaded", () => {

    const API_BASE_URL = "";
    const token = localStorage.getItem('token'); 
    
    // (DOM 元素 - 不變)
    const messageContainer = document.getElementById("message-container");
    const userEmailSpan = document.getElementById("user-email");
    const logoutBtn = document.getElementById("logout-btn");
    const itemsTableContainer = document.getElementById("order-items-table-container");
    const orderDetailTitle = document.getElementById("order-detail-title");
    const summaryOrderId = document.getElementById("summary-order-id");
    const summaryOrderStatus = document.getElementById("summary-order-status");
    const summaryOrderDate = document.getElementById("summary-order-date");
    const summaryOrderSeller = document.getElementById("summary-order-seller");
    const summaryOrderTotal = document.getElementById("summary-order-total");

    // (Modal DOM 元素 - 不變)
    const ratingModalOverlay = document.getElementById("rating-modal-overlay");
    const ratingModalTitle = document.getElementById("rating-modal-title");
    const closeRatingModalBtn = document.getElementById("close-rating-modal-btn");
    const cancelRatingBtn = document.getElementById("cancel-rating-btn");
    const submitRatingBtn = document.getElementById("submit-rating-btn");
    const ratingStarsInput = document.getElementById("rating-stars-input");
    const ratingCommentInput = document.getElementById("rating-comment-input");
    
    // (★ 修正 ★) 我們需要儲存兩個 ID
    let currentRatingOrderItemId = null; // (用於 POST 新建)
    let currentRatingId = null; // (用於 PUT 更新)

    // --- (A & B：導覽列, 個人資料 - 不變) ---
    logoutBtn.addEventListener("click", () => {
        localStorage.removeItem('token');
        localStorage.removeItem('role');
        alert('您已成功登出！');
        window.location.href = 'index.html'; 
    });
    
    async function fetchMyProfile() {
        try {
            const response = await fetch(`${API_BASE_URL}/api/profile/me`, {
                method: 'GET',
                headers: {'Authorization': `Bearer ${token}`}
            });
            if (response.ok) {
                const user = await response.json(); 
                userEmailSpan.textContent = `你好, ${user.name}`;
            } else {
                userEmailSpan.textContent = "無法載入使用者";
            }
        } catch (error) {
            console.error('獲取個人資料 API 錯誤:', error);
        }
    }

    // --- (C: 獲取訂單詳情 - 不變) ---
    async function fetchOrderDetails(orderId) {
        try {
            const response = await fetch(`${API_BASE_URL}/api/orders/me/${orderId}`, {
                method: 'GET',
                headers: {'Authorization': `Bearer ${token}`}
            });
            
            if (response.ok) {
                const order = await response.json(); // 這是「已更新」的 OrderResponseVO
                renderOrderDetails(order);
            } else {
                const errorText = await response.text();
                showMessage(`載入訂單失敗: ${errorText}`, 'error');
                orderDetailTitle.textContent = "載入訂單失敗";
            }
        } catch (error) {
            console.error('獲取訂單詳情 API 錯誤:', error);
            showMessage('無法連線到伺服器', 'error');
        }
    }

    // --- (D) 繪製訂單詳情 (★ 關鍵修正處 ★) ---
    function renderOrderDetails(order) {
        
        // (1. 填滿摘要卡片 - 不變)
        orderDetailTitle.textContent = `訂單詳情: #${order.orderId}`;
        summaryOrderId.textContent = `#${order.orderId}`;
        summaryOrderStatus.textContent = order.status || '處理中';
        summaryOrderDate.textContent = new Date(order.createdAt).toLocaleString('zh-TW'); 
        summaryOrderSeller.textContent = order.sellerName || 'N/A';
        summaryOrderTotal.textContent = `TWD $${order.totalPrice.toFixed(2)}`;

        // (2. 繪製商品項目表格)
        if (!order.items || order.items.length === 0) {
            itemsTableContainer.innerHTML = '<p>此訂單沒有商品項目。</p>';
            return;
        }

        let tableHtml = `
            <table class="cart-table">
                <thead>
                    <tr>
                        <th>商品圖片</th>
                        <th>商品名稱</th> 
                        <th>單價 (快照)</th>
                        <th>数量</th>
                        <th>小計</th>
                        <th>評價操作</th>
                    </tr>
                </thead>
                <tbody>
        `;

        //(★關鍵修正★)動態產生按鈕
        order.items.forEach(item => {
            const imageUrl = item.productImageUrl 
                             ? `${API_BASE_URL}${item.productImageUrl}` 
                             : 'https://via.placeholder.com/60';

            const subtotal = (item.pricePerUnit * item.quantity).toFixed(2);
            
            let ratingButtonHtml = '';
            
            // (根據 `ratingId`是否存在來決定按鈕文字和儲存的資料)
            if (item.ratingId) {
                // (已評價：顯示「更改評價」，並儲存所有資料)
                ratingButtonHtml = `
                    <button class="write-review-btn" 
                            data-order-item-id="${item.orderItemId}" 
                            data-product-name="${item.productName || '此商品'}"
                            data-rating-id="${item.ratingId}"
                            data-current-stars="${item.currentRatingStars}"
                            data-current-comment="${item.currentRatingComment || ''}">
                        更改評價
                    </button>`;
            } else {
                // (尚未評價：顯示「撰寫評價」)
                ratingButtonHtml = `
                    <button class="write-review-btn" 
                            data-order-item-id="${item.orderItemId}" 
                            data-product-name="${item.productName || '此商品'}"
                            data-rating-id="null"> 撰寫評價
                    </button>`;
            }
            
            tableHtml += `
                <tr data-item-id="${item.orderItemId}">
                    <td class="order-item-image">
                        <img src="${imageUrl}" alt="${item.productName}">
                    </td>
                    <td class="cart-item-name">
                        <a href="product-detail.html?id=${item.productId}">
                            ${item.productName || 'N/A'}
                        </a>
                    </td> 
                    <td>TWD $${item.pricePerUnit.toFixed(2)}</td>
                    <td>${item.quantity}</td>
                    <td>TWD $${subtotal}</td>
                    <td class="rating-action-cell" id="rating-cell-${item.orderItemId}">
                        ${ratingButtonHtml}
                    </td>
                </tr>
            `;
        });

        tableHtml += `</tbody></table>`;
        itemsTableContainer.innerHTML = tableHtml;

        // (不變) 
        bindReviewButtons();
    }

    // --- (E) (不變) 綁定所有「撰寫評價」按鈕的事件 ---
    function bindReviewButtons() {
        document.querySelectorAll('.write-review-btn').forEach(button => {
            button.addEventListener('click', openRatingModal);
        });
    }

    // --- (F) (★ 修正 ★) 開啟評價 Modal (增加預填功能) ---
    function openRatingModal(event) {
        event.preventDefault();
        const button = event.currentTarget;
        
        // 1. 獲取按鈕上儲存的資料
        const orderItemId = button.dataset.orderItemId;
        const productName = button.dataset.productName;
        const ratingId = button.dataset.ratingId; // ("null" 或 數字 ID)
        const currentStars = button.dataset.currentStars; // ("undefined" 或 星數)
        const currentComment = button.dataset.currentComment; // ("undefined" 或 評論)

        // 2. 暫存 ID
        currentRatingOrderItemId = orderItemId;
        currentRatingId = (ratingId === "null") ? null : ratingId;

        // 3. 更新 Modal 標題
        ratingModalTitle.textContent = `評價商品：${productName}`;
        
        // 4. (★ 關鍵 ★) 預填表單
        if (currentRatingId) {
            // (更改評價)
            ratingStarsInput.value = currentStars || "5"; // (預填舊星數)
            ratingCommentInput.value = currentComment || ""; // (預填舊評論)
            submitRatingBtn.textContent = "更新評價"; // 更改按鈕文字
        } else {
            // (撰寫新評價)
            ratingStarsInput.value = "5"; // (預設 5 星)
            ratingCommentInput.value = ""; // (清空)
            submitRatingBtn.textContent = "送出評價";
        }
        
        // 5. 顯示 Modal
        ratingModalOverlay.style.display = 'flex';
    }

    // --- (G) (不變) 關閉評價 Modal ---
    function closeRatingModal() {
        ratingModalOverlay.style.display = 'none';
        currentRatingOrderItemId = null; 
        currentRatingId = null; // (清除)
    }

    // --- (H) (★ 修正 ★) 處理「送出評價」 (支援 POST 和 PUT) ---
    async function handleSubmitRating() {
        
        // 1. 獲取表單資料
        const ratingStars = parseInt(ratingStarsInput.value, 10);
        const comment = ratingCommentInput.value;

        let url;
        let method;
        let requestBody;

        // 2. (★ 關鍵 ★) 判斷是「新建」還是「更新」
        if (currentRatingId) {
            // (情境 A：更新 (PUT))
            url = `${API_BASE_URL}/api/ratings/${currentRatingId}`;
            method = 'PUT';
            // (根據 `RatingController`，`PUT` 需要 `UpdateRatingRequestVO`)
            requestBody = {
                ratingStars: ratingStars,
                comment: comment
            };
        } else {
            // (情境 B：新建 (POST))
            url = `${API_BASE_URL}/api/ratings`;
            method = 'POST';
            // (根據 `RatingController`，`POST` 需要 `CreateRatingRequestVO`)
            requestBody = {
                orderItemId: currentRatingOrderItemId,
                ratingStars: ratingStars,
                comment: comment
            };
        }
        
        submitRatingBtn.disabled = true;
        submitRatingBtn.textContent = "送出中...";

        try {
            // 3. 呼叫 API
            const response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(requestBody)
            });

            // (`POST` 回傳 201，`PUT` 回傳 200)
            if (response.ok || response.status === 201) { 
                const updatedRating = await response.json(); // (兩者都會回傳 `RatingResponseVO`)
                
                showMessage('評價送出成功！', 'success');
                closeRatingModal();
                
                // (★ 關鍵 ★) 更新 UI：將按鈕更新為「更改評價」
                const cell = document.getElementById(`rating-cell-${updatedRating.orderItemId || currentRatingOrderItemId}`);
                if (cell) {
                    cell.innerHTML = `
                        <button class="write-review-btn" 
                                data-order-item-id="${updatedRating.orderItemId || currentRatingOrderItemId}" 
                                data-product-name="${cell.querySelector('button').dataset.productName}"
                                data-rating-id="${updatedRating.ratingId}"
                                data-current-stars="${updatedRating.ratingStars}"
                                data-current-comment="${updatedRating.comment || ''}">
                            更改評價
                        </button>`;
                    // 重新綁定剛剛新的按鈕
                    bindReviewButtons();
                }
                
            } else {
                // 處理 400 (例如 "您已經評價過此商品")
                const errorText = await response.text(); 
                showMessage(`評價失敗: ${errorText}`, 'error');
            }

        } catch (error) {
            console.error('送出評價 API 錯誤:', error);
            showMessage('無法連線到伺服器', 'error');
        } finally {
            submitRatingBtn.disabled = false;
            // 無論如何都重設文字
            submitRatingBtn.textContent = (currentRatingId) ? "更新評價" : "送出評價";
        }
    }


    // --- (I) 初始化 ---
    function init() {
        const params = new URLSearchParams(window.location.search);
        const orderId = params.get('id'); 

        if (!orderId) {
            alert('無效的訂單 ID');
            window.location.href = 'orders.html';
            return;
        }
        
        fetchMyProfile();
        fetchOrderDetails(orderId); // (這會觸發 renderOrderDetails 和 bindReviewButtons)
        
        // (綁定 Modal 關閉事件)
        closeRatingModalBtn.addEventListener('click', closeRatingModal);
        cancelRatingBtn.addEventListener('click', closeRatingModal);
        submitRatingBtn.addEventListener('click', handleSubmitRating);
    }
    
    // (輔助功能：顯示訊息 - 不變)
    function showMessage(message, type = 'error') {
        messageContainer.textContent = message;
        messageContainer.className = `message ${type}`;
        messageContainer.style.display = 'block';
        
        setTimeout(() => {
             messageContainer.style.display = 'none';
             messageContainer.textContent = '';
             messageContainer.className = 'message';
        }, 3000); 
    }
    
    init();
});