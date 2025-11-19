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

    // (DOM 元素：錢包)
    const walletBalanceText = document.getElementById("wallet-balance");
    const withdrawForm = document.getElementById("withdraw-form");
    const withdrawAmountInput = document.getElementById("withdraw-amount");
    const withdrawBtn = document.getElementById("withdraw-btn");

    // (DOM 元素：銀行帳戶)
    const bankAccountForm = document.getElementById("bank-account-form");
    const bankNameInput = document.getElementById("bank-name");
    const accountNameInput = document.getElementById("account-name");
    const accountNumberInput = document.getElementById("account-number");
    const updateBankBtn = document.getElementById("update-bank-btn");
    
    // --- (A) 導覽列 & 登出 邏輯 ---
    logoutBtn.addEventListener("click", () => {
        localStorage.removeItem('token');
        localStorage.removeItem('role');
        alert('您已成功登出！');
        window.location.href = 'index.html'; 
    });
    
    // --- (B) 獲取個人資料 (填滿導覽列) ---
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

    // --- (C) （新）獲取「錢包餘額」 ---
    async function fetchMyWallet() {
        try {
            const response = await fetch(`${API_BASE_URL}/api/wallet`, {
                method: 'GET',
                headers: {'Authorization': `Bearer ${token}`}
            });
            
            if (response.ok) {
                const wallet = await response.json(); // 這是 WalletResponseVO
                // 更新餘額顯示
                walletBalanceText.textContent = `TWD $${wallet.balance}`;
            } else if (response.status === 401 || response.status === 403) {
                alert('您的登入已過期，請重新登入。');
                logoutBtn.click();
            } else {
                 const errorText = await response.text();
                 showMessage(`載入錢包失敗: ${errorText}`, 'error');
            }
        } catch (error) {
            console.error('獲取錢包 API 錯誤:', error);
            showMessage(error.message, 'error');
        }
    }

    // --- (D) （新）獲取「銀行帳戶」 ---
    async function fetchMyBankAccount() {
        try {
            const response = await fetch(`${API_BASE_URL}/api/seller/account`, {
                method: 'GET',
                headers: {'Authorization': `Bearer ${token}`}
            });
            
            if (response.ok) {
                // 成功找到
                const account = await response.json(); // 這是 BankAccountResponseVO
                // (預先填入表單)
                bankNameInput.value = account.bankName;
                accountNameInput.value = account.accountHolderName;
                accountNumberInput.value = account.accountNumberMasked;
            } else if (response.status === 404) {
                // (根據你的 Controller， 404 代表「尚未設定」)
                bankNameInput.placeholder = "尚未設定銀行";
                accountNameInput.placeholder = "尚未設定戶名";
                accountNumberInput.placeholder = "尚未設定帳號";
            } else if (response.status === 401 || response.status === 403) {
                alert('您的登入已過期，請重新登入。');
                logoutBtn.click();
            } else {
                 const errorText = await response.text();
                 showMessage(`載入銀行帳戶失敗: ${errorText}`, 'error');
            }
        } catch (error) {
            console.error('獲取銀行帳戶 API 錯誤:', error);
            showMessage(error.message, 'error');
        }
    }

    // --- (E) （新）處理「提款」 ---
    withdrawForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const amount = parseFloat(withdrawAmountInput.value);
        if (amount <= 0 || !amount) {
            showMessage('提款金額必須大於 0', 'error');
            return;
        }

        // (安全確認)
        if (!confirm(`您確定要從錢包提款 TWD $${amount} 嗎？`)) {
            return;
        }

        withdrawBtn.disabled = true;
        withdrawBtn.textContent = "處理中...";

        try {
            // (呼叫 WalletController 的 API)
            const response = await fetch(`${API_BASE_URL}/api/wallet/withdraw`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ amount: amount })
            });

            if (response.ok) {
                const updatedWallet = await response.json();
                showMessage('提款申請成功！', 'success');
                // (關鍵！) 立刻刷新餘額
                walletBalanceText.textContent = `TWD $${updatedWallet.balance}`;
                withdrawForm.reset(); // 清空輸入框
            } else {
                // (例如餘額不足，或者賣家未設定銀行帳戶)
                const errorText = await response.text(); 
                showMessage(`提款失敗: ${errorText}`, 'error');
            }
            
        } catch (error) {
            console.error('提款 API 錯誤:', error);
            showMessage(error.message, 'error');
        } finally {
            withdrawBtn.disabled = false;
            withdrawBtn.textContent = "申請提款";
        }
    });

    // --- (F) 處理「更新銀行帳戶」 (★ 核心修正區 ★) ---
    bankAccountForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const accountData = {
            bankName: bankNameInput.value,
            accountHolderName: accountNameInput.value,
            accountNumber: accountNumberInput.value
        };

        updateBankBtn.disabled = true;
        updateBankBtn.textContent = "儲存中...";

        try {
            const response = await fetch(`${API_BASE_URL}/api/seller/account`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(accountData)
            });
            
            if (response.ok) {
                showMessage('收款帳戶已成功儲存/更新！', 'success');
                // (關鍵) 重新載入資訊以顯示遮罩
                await fetchMyBankAccount(); 
                
            } else {
                // (★ 全新的錯誤處理 Stream 邏輯 ★)
                
                // 1. 先把回應 `body` 當成純文字讀取 (這一步永遠不會失敗)
                const errorBodyText = await response.text();
                let errorMessage = errorBodyText; // 預設訊息就是原始文字

                // 2. 然後「嘗試」把這段文字解析成 JSON
                try {
                    const errorData = JSON.parse(errorBodyText);
                    
                    // 3. 如果 解析 成功， 嘗試 讀取 `errors` 陣列
                    if (errorData.errors && errorData.errors.length > 0) {
                        errorMessage = errorData.errors[0].defaultMessage;
                    } else if (errorData.message) {
                        errorMessage = errorData.message;
                    }
                } catch (parseError) {
                    // 解析失敗， 代表它 本來 就是 純文字， 不需要做任何事
                }

                // 4. 顯示最終的 錯誤訊息
                showMessage(`儲存失敗: ${errorMessage}`, 'error');
            }
            
        } catch (error) {
            console.error('更新銀行帳戶 API 錯誤:', error);
            showMessage(error.message, 'error');
        } finally {
            updateBankBtn.disabled = false;
            updateBankBtn.textContent = "儲存收款帳戶";
        }
    });


    // --- (G) 初始化 ---
    function init() {
        fetchMyProfile(); // 載入導覽列姓名
        fetchMyWallet();  // 載入錢包餘額
        fetchMyBankAccount(); // 載入銀行帳戶資訊
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