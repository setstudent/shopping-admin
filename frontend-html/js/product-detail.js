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

    const API_BASE_URL = "http://localhost:8080";
    const token = localStorage.getItem('token'); 

    // (全域變數： 儲存商品 ID 和 庫存)
    let currentProductId = null;
    let currentStock = 0;

    // (DOM 元素：基本)
    const messageContainer = document.getElementById("message-container");
    const userEmailSpan = document.getElementById("user-email");
    const logoutBtn = document.getElementById("logout-btn");

    // (DOM 元素：商品詳情)
    const productImage = document.getElementById("product-image");
    const productName = document.getElementById("product-name");
    const productSeller = document.getElementById("product-seller");
    const productDescription = document.getElementById("product-description");
    const productPrice = document.getElementById("product-price");
    const productStock = document.getElementById("product-stock");

    // (DOM 元素：購物車)
    const quantityInput = document.getElementById("quantity-input");
    const addToCartBtn = document.getElementById("add-to-cart-btn");

    // (DOM 元素：評價)
    const ratingsList = document.getElementById("ratings-list");

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

    // --- (C: 獲取商品詳情 - 不變) ---
    async function fetchProductDetails(productId) {
        try {
            const response = await fetch(`${API_BASE_URL}/api/public/products/${productId}`);
            if (response.ok) {
                const product = await response.json();
                renderProductDetails(product);
            } else {
                showMessage(`載入商品失敗： 找不到商品 ID ${productId}`, 'error');
                setTimeout(() => { window.location.href = 'products.html'; }, 3000);
            }
        } catch (error) {
            console.error('獲取商品詳情 API 錯誤:', error);
            showMessage(error.message, 'error');
        }
    }
    
    // --- (D: 獲取商品評價 - 不變) ---
    async function fetchProductRatings(productId) {
        try {
            const response = await fetch(`${API_BASE_URL}/api/public/products/${productId}/ratings`);
            if (response.ok) {
                const ratings = await response.json();
                renderProductRatings(ratings);
            } else {
                ratingsList.innerHTML = '<p>載入評價失敗。</p>';
            }
        } catch (error) {
            console.error('獲取商品評價 API 錯誤:', error);
        }
    }

    // --- (E: 繪製詳情區塊 - 不變) ---
    function renderProductDetails(product) {
        productName.textContent = product.name;
        productSeller.textContent = product.sellerName || '官方賣家';
        productDescription.textContent = product.description || '此商品沒有描述。';
        productPrice.textContent = `TWD $${product.price}`;
        productStock.textContent = `庫存: ${product.stock}`;
        
        productImage.src = product.imageUrl 
                           ? `${API_BASE_URL}${product.imageUrl}` 
                           : 'https://via.placeholder.com/400';
                           
        currentStock = product.stock;
        quantityInput.max = product.stock;
        
        if (product.stock === 0) {
            productStock.textContent = "已售完";
            productStock.style.color = "#dc3545";
            addToCartBtn.disabled = true;
            addToCartBtn.textContent = "已售完";
            quantityInput.disabled = true;
        }
    }
    
    // --- (F) 繪製評價區塊 (★ 關鍵修正處 ★) ---
    function renderProductRatings(ratings) {
        ratingsList.innerHTML = ''; // 清空「載入中...」
        if (ratings.length === 0) {
            ratingsList.innerHTML = '<p>此商品尚未有任何評價。</p>';
            return;
        }
        
        ratings.forEach(rating => {
            const card = document.createElement('div');
            card.className = 'rating-card';
            
            // (1. 輔助函式 - 產生星星)
            // (這就是 `ratingStars`)
            const stars = '★'.repeat(rating.ratingStars) + '☆'.repeat(5 - rating.ratingStars);

            // (2. 輔助函式 - 格式化 `createdAt` 時間)
            let formattedDate = '日期不詳';
            if (rating.createdAt) {
                 formattedDate = new Date(rating.createdAt).toLocaleString('zh-TW', {
                     year: 'numeric',
                     month: '2-digit',
                     day: '2-digit'
                 });
            }
            
            // (3. ★ 修正 ★) 更新 `innerHTML` 結構
            card.innerHTML = `
                <div class="rating-card-header">
                    <span class="rating-card-user">${"<"+rating.buyerName+">" || '匿名使用者'}</span>
                    <span class="rating-card-date">${formattedDate}</span>
                </div>
                <div class="rating-card-stars">${stars}</div>
                <p class="rating-card-comment">${rating.comment || '此使用者沒有留下評論。'}</p>
            `;
            ratingsList.appendChild(card);
        });
    }
    
    // --- (G: 處理加入購物車 - 不變) ---
    async function handleAddToCart() {
        const quantity = parseInt(quantityInput.value, 10);
        
        if (!quantity || quantity <= 0) {
            showMessage('數量必須大於 0', 'error');
            return;
        }
        if (quantity > currentStock) {
            showMessage('數量超過目前庫存！', 'error');
            return;
        }
        
        addToCartBtn.disabled = true;
        addToCartBtn.textContent = "處理中...";
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/cart/items`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ 
                    productId: currentProductId,
                    quantity: quantity
                })
            });
            
            if (response.ok) {
                showMessage('商品已成功加入購物車！', 'success');
            } else {
                const errorText = await response.text();
                // (修正顯示後端傳回的錯誤訊息)
                showMessage(`加入失敗： ${errorText}`, 'error');
            }
            
        } catch (error) {
            console.error('加入購物車 API 錯誤:', error);
            showMessage(error.message, 'error');
        } finally {
            addToCartBtn.disabled = false;
            addToCartBtn.textContent = "🛒 加入購物車";
        }
    }


    // --- (H: 初始化 - 不變) ---
    function init() {
        const params = new URLSearchParams(window.location.search);
        const productId = params.get('id'); 

        if (!productId) {
            alert('無效的商品 ID');
            window.location.href = 'products.html';
            return;
        }
        
        currentProductId = parseInt(productId, 10); 
        
        fetchMyProfile();
        fetchProductDetails(currentProductId);
        fetchProductRatings(currentProductId);
        
        addToCartBtn.addEventListener('click', handleAddToCart);
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
    
    init(); // 執行初始化
});