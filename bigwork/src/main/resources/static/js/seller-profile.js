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

    const API_BASE_URL = "";
    const token = localStorage.getItem('token'); 

    // (DOM 元素：基本)
    const messageContainer = document.getElementById("message-container");
    const userEmailSpan = document.getElementById("user-email");
    const logoutBtn = document.getElementById("logout-btn");

    // (DOM 元素：表單)
    const profileForm = document.getElementById("profile-form");
    const updateProfileBtn = document.getElementById("update-profile-btn");
    const profileEmailInput = document.getElementById("profile-email");
    const profileNameInput = document.getElementById("profile-name");
    const profilePhoneInput = document.getElementById("profile-phone");
    const profileAddressInput = document.getElementById("profile-address");
    
    // --- (A) 導覽列 & 登出 邏輯 ---
    logoutBtn.addEventListener("click", () => {
        localStorage.removeItem('token');
        localStorage.removeItem('role');
        alert('您已成功登出！');
        window.location.href = 'index.html'; 
    });
    
    // --- (B) 獲取個人資料 (並填入表單) ---
    async function fetchMyProfile() {
        try {
            const response = await fetch(`${API_BASE_URL}/api/profile/me`, {
                method: 'GET',
                headers: {'Authorization': `Bearer ${token}`}
            });
            
            if (response.ok) {
                const user = await response.json(); // 這是 ProfileResponseVO
                
                // ( 1. 填滿導覽列)
                userEmailSpan.textContent = `你好, ${user.name}`;
                
                // ( 2. 關鍵！ 填滿表單)
                profileEmailInput.value = user.email;
                profileNameInput.value = user.name;
                profilePhoneInput.value = user.phone;
                profileAddressInput.value = user.address;
                
            } else if (response.status === 401) { // (根據你的 Controller ，你設定了 401)
                alert('您的登入已過期，請重新登入。');
                logoutBtn.click(); // 強制登出
            } else {
                 const errorText = await response.text();
                 showMessage(`載入資料失敗: ${errorText}`, 'error');
            }
        } catch (error) {
            console.error('獲取個人資料 API 錯誤:', error);
            showMessage(error.message, 'error');
        }
    }

    // --- (C) 更新個人資料 (提交表單) ---
    async function handleUpdateProfile(e) {
        e.preventDefault(); // 防止表單重新整理
        updateProfileBtn.disabled = true;
        updateProfileBtn.textContent = "儲存中...";

        // ( 1. 收集表單資料)
        // (這 100% 符合 ProfileRequestVO 的欄位)
        const profileData = {
            name: profileNameInput.value,
            phone: profilePhoneInput.value,
            address: profileAddressInput.value
        };

        // ( 2. 呼叫 PUT API)
        try {
            const response = await fetch(`${API_BASE_URL}/api/profile/me`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(profileData)
            });

            if (response.ok) {
                const updatedUser = await response.json(); // 這是 ProfileResponseVO
                showMessage('個人資料更新成功！', 'success');
                
                // (關鍵！) 同步更新導覽列上的名字
                userEmailSpan.textContent = `你好, ${updatedUser.name}`;
                
            } else {
                // (根據你的 Controller ， 400 或 401 都會進來)
                const errorText = await response.text(); 
                showMessage(`更新失敗: ${errorText}`, 'error');
            }
            
        } catch (error) {
            console.error('更新個人資料 API 錯誤:', error);
            showMessage(error.message, 'error');
        } finally {
            updateProfileBtn.disabled = false;
            updateProfileBtn.textContent = "儲存更新";
        }
    }

    // --- (D) 初始化 ---
    function init() {
        fetchMyProfile(); // 載入個人資料並填滿表單
        
        // 綁定提交事件
        profileForm.addEventListener('submit', handleUpdateProfile);
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
        }, 3000); // 3 秒後自動清除
    }
    
    init(); // 執行初始化
});