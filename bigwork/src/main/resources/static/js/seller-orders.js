// (安全檢查 - 賣家)
(function() {
    const token = localStorage.getItem('token');
    const role = localStorage.getItem('role');
    if (!token || role !== 'SELLER') {
        alert('您沒有權限訪問此頁面，請以「賣家」身分登入。');
        window.location.href = 'login.html?role=SELLER';
    }
})(); 

document.addEventListener("DOMContentLoaded", () => {

    const API_BASE_URL = "";
    const token = localStorage.getItem('token'); 
    
    // (DOM 元素)
    const messageContainer = document.getElementById("message-container");
    const userEmailSpan = document.getElementById("user-email");
    const logoutBtn = document.getElementById("logout-btn");
    const orderListContainer = document.getElementById("order-list-container");

    // --- (A) 導覽列 & 登出 邏輯 (不變) ---
    logoutBtn.addEventListener("click", () => {
        localStorage.removeItem('token');
        localStorage.removeItem('role');
        alert('您已成功登出！');
        window.location.href = 'index.html'; 
    });
    
    // --- (B) 獲取個人資料 (不變) ---
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

    // --- (C) (核心) 獲取「我的」收到的訂單 ---
    async function fetchMySellerOrders() {
        try {
            // (呼叫 SellerOrderController 的 GET API)
            const response = await fetch(`${API_BASE_URL}/api/seller/orders/me`, {
                method: 'GET',
                headers: {'Authorization': `Bearer ${token}`}
            });
            
            if (response.ok) {
                const orders = await response.json(); // List<OrderResponseVO>
                renderSellerOrders(orders);
            } else {
                const errorText = await response.text();
                showMessage(`載入訂單失敗: ${errorText}`, 'error');
                orderListContainer.innerHTML = '<p>無法載入您收到的訂單。</p>';
            }
        } catch (error) {
            console.error('獲取訂單 API 錯誤:', error);
            showMessage('無法連線到伺服器', 'error');
        }
    }

    // --- (D) 繪製訂單卡片 (賣家版) ---
    function renderSellerOrders(orders) {
        if (!orders || orders.length === 0) {
            orderListContainer.innerHTML = '<p class="info-text">您目前尚未收到任何訂單。</p>';
            return;
        }

        orderListContainer.innerHTML = ''; // 清空「載入中...」

        // 將訂單倒序排列，讓最新的在最上面
        orders.reverse().forEach(order => {
            const card = document.createElement('div');
            card.className = 'seller-order-card';
            
            // (1. 格式化 createdAt 時間)
            const formattedDate = new Date(order.createdAt).toLocaleString('zh-TW', {
                year: 'numeric', month: '2-digit', day: '2-digit',
                hour: '2-digit', minute: '2-digit'
            });

            // (2. ★ 關鍵 ★) 動態產生「商品項目」 的 HTML 字串
            // (我們 `order.items` ，它是 `OrderItemResponseVO` )
            let itemsHtml = '';
            order.items.forEach(item => {
                const itemSubtotal = (item.pricePerUnit * item.quantity).toFixed(2);
                itemsHtml += `
                    <div class="order-item-row">
                        <div class="order-item-details">
                            <span class="item-name">${item.productName || 'N/A'}</span>
                            <span class="item-qty">(x ${item.quantity})</span>
                        </div>
                        <div class="order-item-price">
                            TWD $${itemSubtotal}
                        </div>
                    </div>
                `;
            });

            // (3. 組合完整卡片)
            card.innerHTML = `
                <div class="seller-order-header">
                    <h3>訂單編號: #${order.orderId}</h3>
                    <span class="buyer-name">買家: ${"<"+order.buyerName+">" || 'N/A'}</span>
                </div>

                <div class="seller-order-body">
                    ${itemsHtml}
                </div>

                <div class="seller-order-footer">
                    <span class="order-total">訂單總金額: TWD $${order.totalPrice.toFixed(2)}</span>
                    <span class="order-date">下單時間: ${formattedDate}</span>
                </div>
            `;
            
            orderListContainer.appendChild(card);
        });
    }

    // --- (E) 初始化 ---
    function init() {
        fetchMyProfile();
        fetchMySellerOrders(); // (關鍵) 載入訂單
    }
    
    // (輔助功能：顯示訊息)
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