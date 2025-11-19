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

    // (DOM 元素)
    const messageContainer = document.getElementById("message-container");
    const userEmailSpan = document.getElementById("user-email");
    const logoutBtn = document.getElementById("logout-btn");
    
    // (抓取新的下拉選單)
    const categoryFilterSelect = document.getElementById("category-filter"); 
    
    const productGrid = document.getElementById("product-grid");
    const productListTitle = document.getElementById("product-list-title"); 

    // ( A, B 節 ... 導覽列 和 Profile 邏輯保持不變)
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

    // --- (C) （不變） 獲取「篩選後」 的商品 ---
    // ( 這個 函數 已經是「正確的」， 它 會 呼叫 /products 或 /products/category/{id} )
    async function fetchAllProducts(categoryId, categoryName = "所有商品") {
        let url;
        if (categoryId) {
            url = `${API_BASE_URL}/api/public/products/category/${categoryId}`;
        } else {
            url = `${API_BASE_URL}/api/public/products`;
        }
        
        productListTitle.textContent = categoryName;
        productGrid.innerHTML = '<p>載入商品中...</p>'; // (新增 載入 提示)
        
        try {
            const response = await fetch(url, { method: 'GET' });
            if (response.ok) {
                const products = await response.json();
                renderProducts(products); 
            } else {
                 const errorText = await response.text();
                 showMessage(`載入商品失敗: ${errorText}`, 'error');
                 productGrid.innerHTML = '<p>載入商品失敗。</p>';
            }
        } catch (error) {
            console.error('獲取公開商品 API 錯誤:', error);
            showMessage(error.message, 'error');
        }
    }

    // --- (D) 繪製商品卡片 (不變) ---
    function renderProducts(products) {
        productGrid.innerHTML = ''; 
        if (products.length === 0) {
            productGrid.innerHTML = '<p>這個分類下 目前沒有商品。</p>';
            return;
        }
        products.forEach(product => {
            const card = document.createElement('div');
            card.className = 'product-card';
            const imageUrl = product.imageUrl 
                             ? `${API_BASE_URL}${product.imageUrl}` 
                             : 'https://via.placeholder.com/220';
            card.innerHTML = `
                <img src="${imageUrl}" alt="${product.name}">
                <div class="product-card-body">
                    <h5>${product.name}</h5>
                    <span class="product-card-price">TWD $${product.price}</span>
                </div>
            `;
            card.addEventListener('click', () => {
                window.location.href = `product-detail.html?id=${product.productId}`;
            });
            productGrid.appendChild(card);
        });
    }

    // --- (E) （關鍵修正） 獲取 並 「 繪製 下拉選單 」 ---
    async function fetchCategories() {
        try {
            const response = await fetch(`${API_BASE_URL}/api/public/categories`);
            if (response.ok) {
                const categoryTree = await response.json();
                
                // ( 修改 ： 不再 呼叫 renderCategorySidebar ，改為 呼叫 renderCategorySelect )
                renderCategorySelect(categoryTree);
            } else {
                categoryFilterSelect.innerHTML = '<option value="null">無法載入分類</option>';
            }
        } catch (error) {
            console.error('載入分類 API 錯誤:', error);
        }
    }
    
    // --- (F) （關鍵修正） 繪製「 下拉選單 」 的 HTML ---
    function renderCategorySelect(categoryTree) {
        categoryFilterSelect.innerHTML = ''; // 清空「載入中...」
        
        // 1. 手動加入「所有商品」 這個 （預設） 選項
        const allOption = document.createElement('option');
        allOption.value = "null"; //  我們 用 "null" 字串 來 代表 `null`
        allOption.textContent = "所有商品";
        categoryFilterSelect.appendChild(allOption);

        // 2. 呼叫「遞迴」函數 來 繪製 樹狀結構
        addCategoriesToSelect(categoryTree, 0);
    }
    
    /**
     * (修正)  這個 遞迴函數 現在是 針對 <select> 元素
     */
    function addCategoriesToSelect(categories, level) {
        const prefix = "— ".repeat(level); 
        categories.forEach(category => {
            const option = document.createElement('option');
            option.value = category.categoryId; //  值 是 ID
            option.textContent = prefix + category.name; //  文字 是 「前綴 + 名稱」
            categoryFilterSelect.appendChild(option);
            
            if (category.children && category.children.length > 0) {
                addCategoriesToSelect(category.children, level + 1);
            }
        });
    }

    // --- (G) （關鍵修正） 綁定「 下拉選單 」 `change` 事件 ---
    categoryFilterSelect.addEventListener('change', (e) => {
        // 1.  從 `e.target.value` 中 抓取 資料
        const selectedValue = e.target.value;
        
        const categoryId = (selectedValue === 'null') 
                           ? null 
                           : parseInt(selectedValue, 10);
                           
        //  抓取 <option> 中 的 「 文字 」 來 當 標題
        const categoryName = e.target.options[e.target.selectedIndex].text;

        // 2. （核心！） 呼叫 API 來 「重新載入」 商品
        fetchAllProducts(categoryId, categoryName);
    });

    // --- (H) 初始化 ---
    function init() {
        fetchMyProfile();     
        fetchCategories();    
        fetchAllProducts(null); // (預設載入 null，即「所有商品」)
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