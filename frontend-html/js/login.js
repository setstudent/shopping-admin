document.addEventListener("DOMContentLoaded", () => {

    const API_BASE_URL = "http://localhost:8080";
    const params = new URLSearchParams(window.location.search);
    const role = params.get('role'); // "BUYER" 或 "SELLER" (這是「預期」的角色)

    // (DOM 元素)
    const pageTitle = document.getElementById("page-title");
    const loginForm = document.getElementById("login-form");
    const registerForm = document.getElementById("register-form");
    const showRegisterLink = document.getElementById("show-register-link");
    const showLoginLink = document.getElementById("show-login-link");
    const messageContainer = document.getElementById("message-container");

    const sendCodeBtn = document.getElementById("send-code-btn");
    const regEmailInput = document.getElementById("reg-email");
    const regCodeInput = document.getElementById("reg-code");

    // (初始化頁面)
    if (role === 'BUYER') {
        pageTitle.textContent = "買家 登入 / 註冊";
    } else if (role === 'SELLER') {
        pageTitle.textContent = "賣家 登入 / 註冊";
    } else {
        window.location.href = 'index.html'; // (修正) 導向回角色選擇頁
        return; 
    }

    // (表單切換)
    showRegisterLink.addEventListener("click", (e) => {
        e.preventDefault();
        loginForm.style.display = 'none';
        registerForm.style.display = 'block';
        showMessage('', 'clear');
    });

    showLoginLink.addEventListener("click", (e) => {
        e.preventDefault();
        loginForm.style.display = 'block';
        registerForm.style.display = 'none';
        showMessage('', 'clear');
    });

    // --- (關鍵安全修正：登入邏輯) ---
    loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const email = loginForm.email.value;
        const password = loginForm.password.value;
        const expectedRole = role; 
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ email, password }),
            });

            // (關鍵修正 1) 先判斷 response.ok
            if (response.ok) {
                // (成功 200 OK) 後端回傳「 JSON 」
                const data = await response.json(); 
                const actualRole = data.role;

                // (身分比對)
                if (actualRole !== expectedRole) {
                    let expectedRoleText = (expectedRole === 'BUYER') ? '買家' : '賣家';
                    let actualRoleText = (actualRole === 'BUYER') ? '買家' : '賣家';
                    showMessage(`登入失敗：您的帳號是「${actualRoleText}」，但您正嘗試登入「${expectedRoleText}」頁面。`, 'error');
                    return; 
                }

                // (驗證通過)
                localStorage.setItem('token', data.token);
                localStorage.setItem('role', actualRole); 
                showMessage('登入成功！正在跳轉...', 'success');
                
                setTimeout(() => {
                    if (actualRole === 'BUYER') {
                        window.location.href = 'products.html'; 
                    } else if (actualRole === 'SELLER') {
                        window.location.href = 'seller-dashboard.html'; 
                    }
                }, 1500);
                
            } else {
                // (關鍵修正 2) 失敗 (e.g., 401) -> 後端回傳「純文字」
                const errorMessage = await response.text(); 
                showMessage(errorMessage, 'error'); // (直接顯示 "密碼錯誤" 等)
            }
        } catch (error) {
            // (關鍵修正 3) 網路錯誤 (e.g., 後端關機, CORS 錯誤)
            console.error('登入 API 錯誤:', error);
            showMessage(error.message, 'error'); 
        }
    });

    // (發送驗證碼邏輯)
    sendCodeBtn.addEventListener("click", async () => {
        const email = regEmailInput.value;
        if (!email) {
            showMessage('請先輸入 Email', 'error');
            return;
        }

        // (倒數計時 ... 保持不變)
        sendCodeBtn.disabled = true;
        let countdown = 60;
        sendCodeBtn.textContent = `重新發送 (${countdown})`;
        const interval = setInterval(() => {
            countdown--;
            sendCodeBtn.textContent = `重新發送 (${countdown})`;
            if (countdown <= 0) {
                clearInterval(interval);
                sendCodeBtn.disabled = false;
                sendCodeBtn.textContent = '獲取驗證碼';
            }
        }, 1000);

        const sendCodeUrl = `${API_BASE_URL}/api/auth/send-code`;
        
        try {
            const response = await fetch(sendCodeUrl, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ email: email }) 
            });
            
            if (response.ok) {
                const successMessage = await response.text(); 
                showMessage(successMessage, 'success'); 
                console.log("請檢查您的 Spring Boot 後端主控台 (Console) 來獲取驗證碼。");
            } else {
                let errorMessage = '發送失敗';
                try {
                    const errorData = await response.json();
                    errorMessage = errorData.message || '發送失敗';
                } catch (e_json) {
                    errorMessage = await response.text();
                }
                
                clearInterval(interval);
                sendCodeBtn.disabled = false;
                sendCodeBtn.textContent = '獲取驗證碼';
                showMessage(errorMessage, 'error');
            }
        } catch (error) {
            console.error('發送驗證碼 API 錯誤:', error);
            showMessage(error.message, 'error');
            clearInterval(interval); 
            sendCodeBtn.disabled = false;
            sendCodeBtn.textContent = '獲取驗證碼';
        }
    });

    // (註冊邏輯)
    registerForm.addEventListener("submit", async (e) => {
        e.preventDefault(); 
        
        const formData = {
            email: regEmailInput.value,
            password: registerForm.password.value,
            name: registerForm.name.value,
            phone: registerForm.phone.value,
            address: registerForm.address.value,
            code: regCodeInput.value 
        };
        
        const registerUrl = `${API_BASE_URL}/api/auth/register/${role.toLowerCase()}`;
        
        try {
            const response = await fetch(registerUrl, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(formData),
            });

            const data = await response.json();

            if (response.ok) {
                const actualRole = data.role; 
                localStorage.setItem('token', data.token);
                localStorage.setItem('role', actualRole); 
                showMessage('註冊成功！正在登入並跳轉...', 'success');
                
                setTimeout(() => {
                    if (actualRole === 'BUYER') {
                        window.location.href = 'products.html'; 
                    } else if (actualRole === 'SELLER') {
                        window.location.href = 'seller-dashboard.html'; 
                    }
                }, 1500);
                
            } else {
                showMessage(data.message || '註冊失敗', 'error');
            }
        } catch (error) {
            console.error('註冊 API 錯誤:', error);
            showMessage(error.message, 'error');
        }
    });

    // (輔助功能：顯示訊息)
    function showMessage(message, type = 'error') {
        messageContainer.textContent = message;
        messageContainer.className = `message ${type}`;
        
        if (type === 'clear') {
             messageContainer.style.display = 'none';
        } else {
             messageContainer.style.display = 'block';
        }
    }
});