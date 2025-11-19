document.addEventListener("DOMContentLoaded", () => {

    const API_BASE_URL = "";

    // ( DOM 元素)
    const messageContainer = document.getElementById("message-container");
    const requestTokenForm = document.getElementById("request-token-form");
    const resetPasswordForm = document.getElementById("reset-password-form");
    
    const requestEmailInput = document.getElementById("request-email");
    const tokenInput = document.getElementById("reset-token"); // (現在是隱藏欄位)
    const newPasswordInput = document.getElementById("new-password");

    // --- (關鍵修正！) (A) 「頁面載入時」 的 分流邏輯 ---
    
    const params = new URLSearchParams(window.location.search);
    const tokenFromUrl = params.get('token'); // 嘗試讀取 URL 中的 "token"

    if (tokenFromUrl) {
        // --- 情境 1：使用者 「帶著 Token」 來到這個頁面 ---
        
        // 1. 隱藏「請求」表單
        requestTokenForm.style.display = 'none';
        
        // 2. 顯示「重設」表單
        resetPasswordForm.style.display = 'block';
        
        // 3. （最關鍵） 將 URL 中的 Token 值， 自動填入「隱藏」 的 tokenInput 欄位
        tokenInput.value = tokenFromUrl;
        
    } else {
        // --- 情境 2：使用者 「沒帶 Token」 來到這個頁面 ---
        
        // 1. 顯示「請求」表單
        requestTokenForm.style.display = 'block';
        
        // 2. 隱藏「重設」表單
        resetPasswordForm.style.display = 'none';
    }


    // --- (B)  AJAX 1：請求 Token  (當情境 2 觸發時) ---
    requestTokenForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const email = requestEmailInput.value;

        try {
            const response = await fetch(`${API_BASE_URL}/api/auth/forgot-password`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ email: email })
            });
            
            const message = await response.text(); 
            
            if (response.ok) {
                // (成功)
                showMessage(message + " 請檢查您的後端主控台並點擊連結。",'success');
                requestTokenForm.reset(); // 清空 Email 輸入框
            } else {
                showMessage(message || '請求失敗', 'error');
            }
            
        } catch (error) {
            console.error('忘記密碼 API 錯誤:', error);
            showMessage(error.message, 'error');
        }
    });


    // --- (C)  AJAX 2：重設密碼  (當情境 1 觸發時) ---
    resetPasswordForm.addEventListener("submit", async (e) => {
        e.preventDefault(); 
        
        const token = tokenInput.value; // (從隱藏欄位取得)
        const newPassword = newPasswordInput.value;

        // (前端驗證)
        if (!token || !newPassword) {
            showMessage('錯誤：Token 或新密碼為空','error');
            return;
        }
        const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;
        if (!passwordRegex.test(newPassword)) {
            showMessage('密碼格式錯誤：長度至少 8 碼，且必須同時包含英文和數字', 'error');
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/api/auth/reset-password`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ 
                    token: token, 
                    newPassword: newPassword 
                }),
            });

            const message = await response.text();
            
            if (response.ok) {
                showMessage(message, 'success'); 
                resetPasswordForm.style.display = 'none'; // 隱藏表單
                
                setTimeout(() => {
                    window.location.href = 'login.html';
                }, 2000);
            } else {
                showMessage(message, 'error');
            }

        } catch (error) {
            console.error('重設密碼 API 錯誤:', error);
            showMessage(error.message, 'error');
        }
    });

    // (輔助功能：顯示訊息)
    function showMessage(message, type = 'error') {
        messageContainer.textContent = message;
        messageContainer.className = `message ${type}`;
        messageContainer.style.display = 'block'; 
        
        // (我把時間拉長，因為 "請檢查郵件" 這個訊息需要被看久一點)
        setTimeout(() => {
             messageContainer.style.display = 'none';
             messageContainer.textContent = '';
             messageContainer.className = 'message';
        }, 5000);
    }
    
});