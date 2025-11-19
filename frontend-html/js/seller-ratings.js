// (立即執行「安全檢查」)
(function() {
    const token = localStorage.getItem('token');
    const role = localStorage.getItem('role');
    if (!token || role !== 'SELLER') {
        alert('您沒有權限訪問此頁面，請以「賣家」身分登入。');
        window.location.href = 'login.html?role=SELLER';
    }
})(); 

document.addEventListener("DOMContentLoaded", () => {

    const API_BASE_URL = "http://localhost:8080";
    const token = localStorage.getItem('token'); 
    
    // (DOM 元素)
    const messageContainer = document.getElementById("message-container");
    const userEmailSpan = document.getElementById("user-email");
    const logoutBtn = document.getElementById("logout-btn");
    const ratingsListContainer = document.getElementById("ratings-list-container");

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

    // --- (C) (核心) 獲取「我的」商品收到的評價 ---
    async function fetchMyRatings() {
        try {
            // (呼叫 SellerRatingController 的 GET API)
            const response = await fetch(`${API_BASE_URL}/api/seller/ratings/me`, {
                method: 'GET',
                headers: {'Authorization': `Bearer ${token}`}
            });
            
            if (response.ok) {
                const ratings = await response.json(); // List<RatingResponseVO>
                renderRatings(ratings);
            } else {
                const errorText = await response.text();
                showMessage(`載入評價失敗: ${errorText}`, 'error');
                ratingsListContainer.innerHTML = '<p>無法載入您收到的評價。</p>';
            }
        } catch (error) {
            console.error('獲取評價 API 錯誤:', error);
            showMessage('無法連線到伺服器', 'error');
        }
    }

    // --- (D) 繪製評價卡片 (賣家版) ---
    function renderRatings(ratings) {
        if (!ratings || ratings.length === 0) {
            ratingsListContainer.innerHTML = '<p class="info-text">您的商品目前尚未收到任何評價。</p>';
            return;
        }

        ratingsListContainer.innerHTML = ''; // 清空「載入中...」

        // 將評價倒序排列，讓最新的在最上面
        ratings.reverse().forEach(rating => {
            const card = document.createElement('div');
            // (重用 .rating-card 樣式)
            card.className = 'rating-card'; 
            
            // (1. 產生星星)
            const stars = '★'.repeat(rating.ratingStars) + '☆'.repeat(5 - rating.ratingStars);

            // (2. 格式化 createdAt 時間)
            const formattedDate = new Date(rating.createdAt).toLocaleString('zh-TW', {
                year: 'numeric', month: '2-digit', day: '2-digit'
            });

            // (3. 處理商品圖片)
            const imageUrl = rating.productImageUrl 
                             ? `${API_BASE_URL}${rating.productImageUrl}` 
                             : 'https://via.placeholder.com/60';

            // (4. 組合賣家版卡片)
            // 我們在卡片頂部插入了「商品資訊」區塊
            card.innerHTML = `
                <div class="rating-card-product">
                    <img src="${imageUrl}" alt="${rating.productName}" class="rating-card-product-image">
                    <div>
                        <a href="product-detail.html?id=${rating.productId}" 
                           class="rating-card-product-name" 
                           target="_blank"> 
                            ${rating.productName || 'N/A'}
                        </a>
                    </div>
                </div>

                <div class="rating-card-content">
                    <div class="rating-card-header">
                        <span class="rating-card-user">${rating.buyerName || '匿名使用者'}</span>
                        <span class="rating-card-date">${formattedDate}</span>
                    </div>
                    <div class="rating-card-stars">${stars}</div>
                    <p class="rating-card-comment">${rating.comment || '此使用者沒有留下評論。'}</p>
                </div>
            `;
            
            ratingsListContainer.appendChild(card);
        });
    }

    // --- (E) 初始化 ---
    function init() {
        fetchMyProfile();
        fetchMyRatings(); // (關鍵) 載入評價
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