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

    // (全域變數：用來儲存目前的商品資料)
    let myProducts = []; 
    // (全域變數：用來儲存分類資料)
    let allCategories = []; 
    let currentEditingProductId = null; // 目前正在編輯的 ID

    // (DOM 元素：基本)
    const messageContainer = document.getElementById("message-container");
    const userEmailSpan = document.getElementById("user-email");
    const logoutBtn = document.getElementById("logout-btn");
    
    // (DOM 元素：新增表單)
    const addProductForm = document.getElementById("add-product-form");
    const addProductBtn = document.getElementById("add-product-btn");
    const productNameInput = document.getElementById("product-name");
    const productDescInput = document.getElementById("product-desc");
    const productPriceInput = document.getElementById("product-price");
    const productStockInput = document.getElementById("product-stock");
    const productImageInput = document.getElementById("product-image");
    const productCategorySelect = document.getElementById("product-category");

    // (DOM 元素：商品列表)
    const productListContainer = document.getElementById("product-list-container");

    // (關鍵新增！) (DOM 元素：更新 Modal)
    const updateModalOverlay = document.getElementById("update-modal-overlay");
    const modalCloseBtn = document.getElementById("modal-close-btn");
    const updateModalTitle = document.getElementById("update-modal-title");
    
    const updateProductForm = document.getElementById("update-product-form");
    const updateProductIdInput = document.getElementById("update-product-id");
    const updateProductNameInput = document.getElementById("update-product-name");
    const updateProductDescInput = document.getElementById("update-product-desc");
    const updateProductPriceInput = document.getElementById("update-product-price");
    const updateProductStockInput = document.getElementById("update-product-stock");
    const updateProductCategorySelect = document.getElementById("update-product-category");
    const updateProductImageInput = document.getElementById("update-product-image");

    const deleteProductBtn = document.getElementById("delete-product-btn");
    const updateProductBtn = document.getElementById("update-product-btn");


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

    // --- (C) 獲取商品 (修改：儲存到全域變數) ---
    async function fetchMyProducts() {
        try {
            const response = await fetch(`${API_BASE_URL}/api/products`, { 
                method: 'GET',
                headers: {'Authorization': `Bearer ${token}`}
            });
            if (response.ok) {
                myProducts = await response.json(); // (關鍵！) 儲存資料
                renderProducts(myProducts); 
            } else if (response.status === 403) {
                alert('您的登入已過期，請重新登入。');
                logoutBtn.click(); 
            } else {
                const errorText = await response.text();
                showMessage(`載入商品失敗: ${errorText}`, 'error');
            }
        } catch (error) {
            console.error('載入商品 API 錯誤:', error);
            showMessage(error.message, 'error');
        }
    }
    
    // --- (D) 獲取分類 (修改：儲存並呼叫兩次繪製) ---
    async function fetchCategories() {
        try {
            const response = await fetch(`${API_BASE_URL}/api/public/categories`);
            if (response.ok) {
                allCategories = await response.json(); // (關鍵！) 儲存資料
                
                // (關鍵！) 同時繪製「新增表單」和「更新表單」的選單
                renderCategoriesSelect(productCategorySelect, allCategories);
                renderCategoriesSelect(updateProductCategorySelect, allCategories);
                
            } else {
                const errorText = await response.text();
                showMessage(`載入分類失敗: ${errorText}`, 'error');
                productCategorySelect.innerHTML = '<option value="">無法載入分類</option>';
                updateProductCategorySelect.innerHTML = '<option value="">無法載入分類</option>';
            }
        } catch (error) {
            console.error('載入分類 API 錯誤:', error);
            showMessage(error.message, 'error');
        }
    }
    
    
    // --- (E) 繪製「巢狀」分類選單 (修改為可重用的函數) ---
    function renderCategoriesSelect(selectElement, categoryTree) {
        selectElement.innerHTML = ''; // 清空
        
        const defaultOption = document.createElement('option');
        defaultOption.value = ""; 
        defaultOption.textContent = "-- 請選擇一個分類 --";
        selectElement.appendChild(defaultOption);
        
        // (呼叫遞迴輔助函數)
        addCategoriesToSelect(selectElement, categoryTree, 0);
    }
    
    function addCategoriesToSelect(selectElement, categories, level) {
        const prefix = "— ".repeat(level); 
        categories.forEach(category => {
            const option = document.createElement('option');
            option.value = category.categoryId;
            option.textContent = prefix + category.name; 
            selectElement.appendChild(option);
            
            if (category.children && category.children.length > 0) {
                addCategoriesToSelect(selectElement, category.children, level + 1);
            }
        });
    }


    // --- (F) 繪製商品卡片 (保持不變) ---
    // (注意：您這裡有一個小 bug，我幫您修正了)
    function renderProducts(products) {
        productListContainer.innerHTML = ''; 
        if (products.length === 0) {
            productListContainer.innerHTML = '<p>您尚未上架任何商品。</p>';
            return;
        }
        products.forEach(product => {
            const card = document.createElement('div');
            card.className = 'product-card';
            
            // (*** 已修正 bug ***) 
            // (舊) card.dataset.productId = product.categoryId; 
            // (新)
            card.dataset.productId = product.productId; 
            
            const imageUrl = product.imageUrl 
                             ? `${API_BASE_URL}${product.imageUrl}` 
                             : 'https://via.placeholder.com/300x180';
            
            card.innerHTML = `
                <img src="${imageUrl}" alt="${product.name}">
                <div class="product-card-body">
                    <h5>${product.name}</h5>
                    <p>${product.description || '沒有描述'}</p>
                    <div class="product-card-details">
                        <span class="product-card-price">TWD $${product.price}</span>
                        <span class="product-card-stock">庫存: ${product.stock}</span>
                    </div>
                </div>
            `;
            
            card.addEventListener('click', () => openUpdateModal(product.productId));
            productListContainer.appendChild(card);
        });
    }

    // --- (G) 上架新商品 (保持不變，已是正確的) ---
    addProductForm.addEventListener("submit", async (e) => {
        e.preventDefault(); 
        addProductBtn.disabled = true; 
        addProductBtn.textContent = "上架中...";

        const productData = {
            name: productNameInput.value,
            description: productDescInput.value,
            price: parseFloat(productPriceInput.value),
            stock: parseInt(productStockInput.value, 10),
            categoryId: parseInt(productCategorySelect.value, 10) 
        };
        const imageFile = productImageInput.files[0];

        if (!imageFile || !productData.categoryId) {
            showMessage('請確保「圖片」和「分類」均已選擇', 'error');
            addProductBtn.disabled = false;
            addProductBtn.textContent = "確認上架";
            return;
        }

        let createdProduct; 

        try {
            // (步驟 1：送 JSON)
            const responseStep1 = await fetch(`${API_BASE_URL}/api/products`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`},
                body: JSON.stringify(productData)
            });
            if (!responseStep1.ok) {
                const errorText = await responseStep1.text();
                throw new Error(`商品資料建立失敗: ${errorText}`);
            }
            createdProduct = await responseStep1.json(); 
            showMessage('商品資料建立成功... 正在上傳圖片...', 'success');

            // (步驟 2：送檔案)
            const formData = new FormData();
            formData.append('file', imageFile);
            const responseStep2 = await fetch(`${API_BASE_URL}/api/products/${createdProduct.productId}/image`, {
                method: 'POST',
                headers: {'Authorization': `Bearer ${token}`},
                body: formData
            });
            if (!responseStep2.ok) {
                const errorText = await responseStep2.text();
                throw new Error(`圖片上傳失敗: ${errorText}`);
            }
            
            showMessage(`商品「${createdProduct.name}」及圖片均上架成功！`, 'success');
            addProductForm.reset(); 
            fetchMyProducts(); 
            productCategorySelect.value = "";
        } catch (error) {
            console.error('上架流程失敗:', error);
            showMessage(error.message, 'error');
            if (createdProduct) {
                showMessage(`商品「${createdProduct.name}」已建立，但圖片上傳失敗。 錯誤： ${error.message}`, 'error');
                fetchMyProducts(); 
            }
        } finally {
            addProductBtn.disabled = false;
            addProductBtn.textContent = "確認上架";
        }
    });

    
    // --- (*** 關鍵修正 2 ***) (H) Modal 相關 邏輯 ---
    
    /**
     * （新）開啟「更新」 Modal 
     */
    function openUpdateModal(productId) {
        currentEditingProductId = productId;
        
        const product = myProducts.find(p => p.productId === productId);
        
        if (!product) {
            showMessage('找不到商品資料', 'error');
            return;
        }

        // (將商品資料「預填」到 Modal 的表單中 ... 保持不變)
        updateModalTitle.textContent = `編輯商品：${product.name}`;
        updateProductIdInput.value = product.productId; 
        updateProductNameInput.value = product.name;
        updateProductDescInput.value = product.description;
        updateProductPriceInput.value = product.price;
        updateProductStockInput.value = product.stock;
        updateProductCategorySelect.value = product.categoryId; 
        updateProductImageInput.value = null;

        // (*** 關鍵修正 ***)
        // 顯示 Modal (只需要控制最外層的 Overlay)
        if (updateModalOverlay) updateModalOverlay.style.display = 'flex'; // (用 'flex' 顯示並置中)
    }

    /**
     * （新）關閉「更新」 Modal 
     */
    function closeUpdateModal() {
        // (*** 關鍵修正 ***)
        if (updateModalOverlay) updateModalOverlay.style.display = 'none'; // (只需要控制最外層)

        currentEditingProductId = null; // 清除目前編輯的 ID
        showMessage('', 'clear'); // (清除 Modal 中的錯誤訊息)
    }

    /**
     * （新）處理「更新」按鈕
     */
    async function handleUpdateProduct(e) {
        // (*** 關鍵修正 ***)
        // (我們現在監聽的是 form 的 'submit' 事件，所以需要 e.preventDefault())
        e.preventDefault(); 

        if (!currentEditingProductId) return;

        updateProductBtn.disabled = true;
        updateProductBtn.textContent = "更新中...";

        // ( 1. 準備 JSON 資料) (保持不變)
        const productData = {
            name: updateProductNameInput.value,
            description: updateProductDescInput.value,
            price: parseFloat(updateProductPriceInput.value),
            stock: parseInt(updateProductStockInput.value, 10),
            categoryId: parseInt(updateProductCategorySelect.value, 10)
        };

        // ( 2. 準備「新」圖片檔案（如果有的話）)
        const newImageFile = updateProductImageInput.files[0];

        try {
            // --- (步驟 1：呼叫 PUT /api/products/{id} (更新文字資訊)) ---
            const responseStep1 = await fetch(`${API_BASE_URL}/api/products/${currentEditingProductId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(productData)
            });

            if (!responseStep1.ok) {
                const errorText = await responseStep1.text();
                throw new Error(`商品資訊更新失敗: ${errorText}`);
            }

            // --- (步驟 2：檢查是否需要更新圖片) ---
            if (newImageFile) {
                showMessage('資訊更新成功... 正在更新圖片...', 'success');
                
                const formData = new FormData();
                formData.append('file', newImageFile);

                const responseStep2 = await fetch(`${API_BASE_URL}/api/products/${currentEditingProductId}/image`, {
                    method: 'POST',
                    headers: {'Authorization': `Bearer ${token}`},
                    body: formData
                });

                if (!responseStep2.ok) {
                    throw new Error('圖片更新失敗');
                }
            }

            // --- (全部成功) ---
            showMessage('商品已成功更新！', 'success');
            closeUpdateModal();
            fetchMyProducts(); // 重新載入列表

        } catch (error) {
            console.error('更新流程失敗:', error);
            showMessage(error.message, 'error');
        } finally {
            updateProductBtn.disabled = false;
            updateProductBtn.textContent = "確認更新";
        }
    }

    /**
     * （新）處理「刪除」按鈕
     */
    async function handleDeleteProduct() {
        if (!currentEditingProductId) return;
        
        // (安全確認)
        const product = myProducts.find(p => p.productId === currentEditingProductId);
        if (!confirm(`您確定要刪除「${product.name}」嗎？ 此操作無法復原！`)) {
            return;
        }

        deleteProductBtn.disabled = true;
        deleteProductBtn.textContent = "刪除中...";

        try {
            const response = await fetch(`${API_BASE_URL}/api/products/${currentEditingProductId}`, {
                method: 'DELETE',
                headers: {'Authorization': `Bearer ${token}`}
            });

            if (response.ok) { // ( 204 No Content 也是 ok)
                showMessage('商品刪除成功！', 'success');
                closeUpdateModal();
                fetchMyProducts(); // 重新載入列表
            } else {
                const errorText = await response.text();
                throw new Error(errorText || '刪除失敗');
            }
        } catch (error) {
            console.error('刪除商品 API 錯誤:', error);
            showMessage(error.message, 'error');
        } finally {
            deleteProductBtn.disabled = false;
            deleteProductBtn.textContent = "刪除商品";
        }
    }


    // --- (*** 關鍵修正 3 ***) (I) 初始化 和 綁定 Modal 事件 ---
    function init() {
        fetchMyProfile(); 
        fetchMyProducts(); 
        fetchCategories();
        
        // (綁定 Modal 的關閉事件)
        if(modalCloseBtn) modalCloseBtn.addEventListener('click', closeUpdateModal);
        if(updateModalOverlay) {
            updateModalOverlay.addEventListener('click', (e) => {
                // (重要) 確保點擊的是遮罩背景 (#update-modal-overlay)
                // 而不是內容框 (.modal-content)
                if (e.target === updateModalOverlay) {
                    closeUpdateModal();
                }
            });
        }

        // (綁定 Modal 的操作事件)
        
        // (*** 關鍵修正 ***)
        // (新) 您的 HTML 中按鈕的 type="submit" 且 form="update-product-form"
        // 我們應該監聽 "form" 的 "submit" 事件
        if (updateProductForm) {
            updateProductForm.addEventListener('submit', handleUpdateProduct);
        }
        
        if (deleteProductBtn) deleteProductBtn.addEventListener('click', handleDeleteProduct);
    }

    // (輔助功能：顯示訊息)
    function showMessage(message, type = 'error') {
        messageContainer.textContent = message;
        messageContainer.className = `message ${type}`;
        
        if (type === 'clear') {
            messageContainer.style.display = 'none';
        } else {
            messageContainer.style.display = 'block';
        }
        
        // (清除計時器 ... 保持不變)
        setTimeout(() => {
             if (messageContainer.textContent === message) {
                 messageContainer.style.display = 'none';
                 messageContainer.textContent = '';
                 messageContainer.className = 'message';
             }
        }, 5000);
    }
    
    init(); // 執行初始化
});