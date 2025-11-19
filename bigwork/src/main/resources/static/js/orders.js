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

    // --- (C) (核心) 獲取我的訂單 (GET /api/orders/me) ---
    async function fetchMyOrders() {
        try {
            // (呼叫 OrderController 的 GET API)
            const response = await fetch(`${API_BASE_URL}/api/orders/me`, {
                method: 'GET',
                headers: {'Authorization': `Bearer ${token}`}
            });
            
            if (response.ok) {
                const orders = await response.json(); // 這是一個 List<OrderResponseVO>
                renderOrders(orders);
            } else {
                const errorText = await response.text();
                showMessage(`載入訂單失敗: ${errorText}`, 'error');
                orderListContainer.innerHTML = '<p>無法載入您的訂單。</p>';
            }
        } catch (error) {
            console.error('獲取訂單 API 錯誤:', error);
            showMessage('無法連線到伺服器', 'error');
        }
    }

    // --- (D) 繪製訂單卡片 ---
    function renderOrders(orders) {
        if (!orders || orders.length === 0) {
            orderListContainer.innerHTML = '<p class="info-text">您目前沒有任何訂單。</p>';
            return;
        }

        orderListContainer.innerHTML = ''; // 清空「載入中...」

        orders.forEach(order => {
            const card = document.createElement('div');
            card.className = 'order-card';
            
            // 格式化日期 (例如： 2025-11-11 10:30)
            const orderDate = new Date(order.createdAt).toLocaleString('zh-TW', { 
                year: 'numeric', 
                month: '2-digit', 
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });

            card.innerHTML = `
                <div class="order-card-header">
                    <h3>訂單編號: #${order.orderId}</h3>
                    <span class="order-status">${order.status || '已完成'}</span>
                </div>
                <div class="order-card-body">
                    <span class="order-total">總金額: TWD $${order.totalPrice.toFixed(2)}</span>
                    <span class="order-date">下單時間: ${orderDate}</span>
                </div>
                <div class="order-card-footer">
                    <a href="order-detail.html?id=${order.orderId}" class="button-primary">
                        查看詳情
                    </a>
                </div>
            `;
            
            orderListContainer.appendChild(card);
        });
    }

    // --- (E) 初始化 ---
    function init() {
        fetchMyProfile();
        fetchMyOrders(); // (關鍵) 載入訂單
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