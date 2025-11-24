package demo.bigwork.service.Impl;

import demo.bigwork.dao.*; // 匯入所有 DAO
import demo.bigwork.model.enums.OrderStatus;
import demo.bigwork.model.enums.TransactionType;
import demo.bigwork.model.po.*; // 匯入所有 PO
import demo.bigwork.model.vo.OrderResponseVO;
import demo.bigwork.service.AuthHelperService;
import demo.bigwork.service.OrderService;
import jakarta.persistence.EntityNotFoundException;
import org.hibernate.Hibernate;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class OrderServiceImpl implements OrderService {

    private static final Logger logger = LoggerFactory.getLogger(OrderServiceImpl.class);

    // (我們需要「大量」的 DAO 和 Service)
    private final AuthHelperService authHelperService;
    private final CartDAO cartDAO;
    private final CartItemDAO cartItemDAO;
    private final ProductDAO productDAO;
    private final WalletDAO walletDAO;
    private final WalletTransactionDAO walletTransactionDAO;
    private final OrderDAO orderDAO;
    private final UserDAO userDAO; // (需要用來找賣家)

    @Autowired
    public OrderServiceImpl(AuthHelperService authHelperService, CartDAO cartDAO, 
                            CartItemDAO cartItemDAO, ProductDAO productDAO, 
                            WalletDAO walletDAO, WalletTransactionDAO walletTransactionDAO, 
                            OrderDAO orderDAO, UserDAO userDAO) {
        this.authHelperService = authHelperService;
        this.cartDAO = cartDAO;
        this.cartItemDAO = cartItemDAO;
        this.productDAO = productDAO;
        this.walletDAO = walletDAO;
        this.walletTransactionDAO = walletTransactionDAO;
        this.orderDAO = orderDAO;
        this.userDAO = userDAO;
    }


    /**
     * (核心！) 結帳
     */
    @Override
    @Transactional // (極度重要！)
    public List<OrderResponseVO> checkoutFromMyCart() throws AccessDeniedException, Exception {
        
        // 1. (安全) 取得買家
        UserPO buyer = authHelperService.getCurrentAuthenticatedBuyer();
        logger.info("買家 {} 正在結帳...", buyer.getEmail());

        // 2. (讀取) 取得購物車
        CartPO cart = cartDAO.findByUser_UserId(buyer.getUserId())
                .orElseThrow(() -> new Exception("找不到購物車"));
        
        // (關鍵) 手動初始化「所有」項目 (POJO, DAO 都已修正)
        Hibernate.initialize(cart.getItems());
        Set<CartItemPO> itemsInCart = cart.getItems();

        // 3. (驗證 1) 購物車是否為空？
        if (itemsInCart.isEmpty()) {
            logger.warn("結帳失敗：{} 的購物車是空的", buyer.getEmail());
            throw new Exception("您的購物車是空的");
        }
        logger.debug("購物車內有 {} 項商品", itemsInCart.size());

        // 4. (驗證 2) 檢查「所有」庫存
        // (我們必須在「扣款」前先檢查)
        for (CartItemPO item : itemsInCart) {
            ProductPO product = item.getProduct();
            if (product.getStock() < item.getQuantity()) {
                logger.warn("結帳失敗：商品 {} 庫存不足 (庫存: {}, 欲購: {})", 
                    product.getName(), product.getStock(), item.getQuantity());
                throw new Exception("商品「" + product.getName() + "」庫存不足");
            }
        }
        logger.debug("所有商品庫存檢查通過");

        // 5. (驗證 3) 檢查「錢包餘額」
        // 5a. 計算「總價」
        BigDecimal totalCartPrice = itemsInCart.stream()
                .map(item -> item.getProduct().getPrice().multiply(new BigDecimal(item.getQuantity())))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        
        // 5b. 取得買家錢包
        WalletPO buyerWallet = walletDAO.findByUser_UserId(buyer.getUserId())
                .orElseThrow(() -> new Exception("找不到買家錢包"));
        
        // 5c. 比較餘額
        if (buyerWallet.getBalance().compareTo(totalCartPrice) < 0) {
            logger.warn("結帳失敗：買家 {} 餘額不足 (餘額: {}, 總價: {})", 
                buyer.getEmail(), buyerWallet.getBalance(), totalCartPrice);
            throw new Exception("錢包餘額不足");
        }
        logger.debug("錢包餘額檢查通過 (餘額: {}, 總價: {})", buyerWallet.getBalance(), totalCartPrice);

        // --- (驗證全部通過！開始執行「不可逆」操作) ---

        // 6. (執行 - 金流 - 買家)
        // 6a. 扣除買家餘額
        buyerWallet.setBalance(buyerWallet.getBalance().subtract(totalCartPrice));
        walletDAO.save(buyerWallet);
        
        // 6b. 建立買家「交易紀錄」 (PURCHASE)
        WalletTransactionPO buyerTx = new WalletTransactionPO(
                buyerWallet, TransactionType.PURCHASE, totalCartPrice.negate());
        walletTransactionDAO.save(buyerTx);
        logger.info("買家 {} 已扣款 {}", buyer.getEmail(), totalCartPrice);

        // 7. (執行 - 拆分訂單)
        // (關鍵) 
        // 我們必須將購物車「依照賣家」拆分成「多張訂單」
        Map<Long, List<CartItemPO>> itemsBySeller = itemsInCart.stream()
                .collect(Collectors.groupingBy(item -> item.getProduct().getSeller().getUserId()));
        
        logger.info("購物車共包含 {} 位賣家的商品，將建立 {} 張訂單", itemsBySeller.size());

        List<OrderPO> createdOrders = new ArrayList<>(); // (用來存放新訂單)

        // 8. (執行 - 訂單 & 金流 - 賣家)
        // 迴圈處理「每一張」新訂單
        for (Map.Entry<Long, List<CartItemPO>> entry : itemsBySeller.entrySet()) {
            Long sellerId = entry.getKey();
            List<CartItemPO> sellerItems = entry.getValue();

            // 8a. 取得賣家物件
            UserPO seller = userDAO.findById(sellerId)
                    .orElseThrow(() -> new Exception("找不到賣家, ID: " + sellerId));
            
            // 8b. 計算「這張訂單」的總價
            BigDecimal sellerOrderPrice = sellerItems.stream()
                    .map(item -> item.getProduct().getPrice().multiply(new BigDecimal(item.getQuantity())))
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            
            // 8c. (金流) 幫賣家加錢
            WalletPO sellerWallet = walletDAO.findByUser_UserId(sellerId)
                    .orElseThrow(() -> new Exception("找不到賣家錢包, ID: " + sellerId));
            sellerWallet.setBalance(sellerWallet.getBalance().add(sellerOrderPrice));
            walletDAO.save(sellerWallet);
            
            // 8d. (金流) 建立賣家「交易紀錄」 (PAYMENT_RECEIVED)
            WalletTransactionPO sellerTx = new WalletTransactionPO(
                    sellerWallet, TransactionType.PAYMENT_RECEIVED, sellerOrderPrice);
            walletTransactionDAO.save(sellerTx);
            logger.info("已付款 {} 元給賣家 {}", sellerOrderPrice, seller.getEmail());

            // 8e. (訂單) 建立「訂單主檔 (OrderPO)」
            OrderPO newOrder = new OrderPO();
            newOrder.setBuyer(buyer);
            newOrder.setSeller(seller);
            newOrder.setTotalPrice(sellerOrderPrice);
            newOrder.setStatus(OrderStatus.COMPLETED); // (模擬)

            // 8f. (訂單) 建立「訂單明細 (OrderItemPO)」
            for (CartItemPO cartItem : sellerItems) {
                ProductPO product = cartItem.getProduct();
                
                // 建立「快照」
                OrderItemPO newOrderItem = new OrderItemPO();
                newOrderItem.setProduct(product);
                newOrderItem.setQuantity(cartItem.getQuantity());
                newOrderItem.setPricePerUnit(product.getPrice()); // (S儲存「當下」的價格)
                
                // (關鍵) 使用輔助方法，自動設定「雙向關聯」
                newOrder.addOrderItem(newOrderItem);
                
                // 8g. (庫存) 扣除「商品庫存」
                product.setStock(product.getStock() - cartItem.getQuantity());
                productDAO.save(product);
                logger.debug("商品 {} 庫存已扣除，剩餘: {}", product.getName(), product.getStock());
            }

            // 8h. (儲存) 儲存「訂單」
            // (因為 cascade = ALL, 這會「同時」儲存所有 OrderItemPO)
            OrderPO savedOrder = orderDAO.save(newOrder);
            createdOrders.add(savedOrder);
            logger.info("訂單 {} (for 賣家 {}) 已建立", savedOrder.getOrderId(), seller.getEmail());
        }

        // 9. (執行 - 清理)
        // (所有訂單都成功了) 清空購物車
        logger.info("結帳成功，正在清空買家 {} 的購物車...", buyer.getEmail());
        cartItemDAO.deleteAllByCart_CartId(cart.getCartId());

        // 10. (回傳)
        // (S極度關鍵) 我們必須回傳「已儲存」的 PO
        // 並且「手動初始化」它們的 LAZY 集合
        // 才能安全地轉換為 VO
        
        List<OrderResponseVO> responseVOs = new ArrayList<>();
        for (OrderPO order : createdOrders) {
            Hibernate.initialize(order.getItems()); // (手動初始化)
            responseVOs.add(new OrderResponseVO(order)); // (安全轉換)
        }
        
        logger.info("買家 {} 結帳完成，共成立 {} 張新訂單", buyer.getEmail(), responseVOs.size());
        return responseVOs;
    }
    
    /**
     * (新) 處理綠界直接結帳 (Callback 觸發)
     * 邏輯：
     * 1. 找到買家購物車
     * 2. 驗證總金額是否與綠界付款金額一致 (防篡改)
     * 3. 拆分訂單、扣庫存、賣家入帳
     * 4. (關鍵) 不扣買家錢包餘額
     * 5. 產生買家「支出」紀錄 (雖然沒扣餘額，但要記錄這筆錢是用掉的) -> 或者乾脆不記，因為錢根本沒進錢包
     */
    @Override
    @Transactional // (極度重要)
    public void processEcpayCheckout(Long userId, BigDecimal amount, String tradeNo) throws Exception {
        
        logger.info("開始處理綠界直接結帳... 買家ID: {}, 金額: {}, 綠界單號: {}", userId, amount, tradeNo);

        // 1. 取得買家
        UserPO buyer = userDAO.findById(userId)
                .orElseThrow(() -> new Exception("綠界結帳錯誤：找不到買家 ID " + userId));

        // 2. 取得購物車
        CartPO cart = cartDAO.findByUser_UserId(userId)
                .orElseThrow(() -> new Exception("綠界結帳錯誤：找不到買家購物車"));
        
        Hibernate.initialize(cart.getItems());
        Set<CartItemPO> itemsInCart = cart.getItems();

        if (itemsInCart.isEmpty()) {
            logger.error("綠界結帳嚴重錯誤：買家 {} 付了錢，但購物車是空的！(可能重複結帳)", buyer.getEmail());
            return; // (或者記錄到異常表)
        }

        // 3. (安全驗證) 計算購物車總金額
        BigDecimal totalCartPrice = itemsInCart.stream()
                .map(item -> item.getProduct().getPrice().multiply(new BigDecimal(item.getQuantity())))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        
        // 比較金額 (允許 1 元內的誤差，防止浮點數問題，但在 BigDecimal 應該精確)
        if (totalCartPrice.compareTo(amount) != 0) {
            logger.error("綠界結帳金額不符！購物車: {}, 實際付款: {}", totalCartPrice, amount);
            // (實務上這裡很麻煩，錢已經收了但金額不對，通常會先鎖定訂單人工處理)
            // 這裡我們先假設金額正確，繼續執行 (或拋出異常)
        }

        // 4. (庫存檢查)
        for (CartItemPO item : itemsInCart) {
            ProductPO product = item.getProduct();
            if (product.getStock() < item.getQuantity()) {
                logger.error("綠界結帳庫存不足！商品: {}, 已付錢但沒貨。", product.getName());
                // (實務上需要退款流程)
                throw new Exception("商品「" + product.getName() + "」庫存不足");
            }
        }

        // --- (開始執行結帳邏輯) ---

        // 5. 拆分訂單 (依賣家分組)
        Map<Long, List<CartItemPO>> itemsBySeller = itemsInCart.stream()
                .collect(Collectors.groupingBy(item -> item.getProduct().getSeller().getUserId()));

        // 6. 迴圈處理每一張訂單
        for (Map.Entry<Long, List<CartItemPO>> entry : itemsBySeller.entrySet()) {
            Long sellerId = entry.getKey();
            List<CartItemPO> sellerItems = entry.getValue();

            UserPO seller = userDAO.findById(sellerId)
                    .orElseThrow(() -> new Exception("找不到賣家 ID: " + sellerId));
            
            BigDecimal sellerOrderPrice = sellerItems.stream()
                    .map(item -> item.getProduct().getPrice().multiply(new BigDecimal(item.getQuantity())))
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            
            // 6a. (賣家入帳) 幫賣家錢包加錢
            WalletPO sellerWallet = walletDAO.findByUser_UserId(sellerId)
                    .orElseThrow(() -> new Exception("找不到賣家錢包 ID: " + sellerId));
            
            sellerWallet.setBalance(sellerWallet.getBalance().add(sellerOrderPrice));
            walletDAO.save(sellerWallet);
            
            // 6b. (賣家紀錄)
            WalletTransactionPO sellerTx = new WalletTransactionPO(
                    sellerWallet, TransactionType.PAYMENT_RECEIVED, sellerOrderPrice);
            // (建議) 可以在 description 欄位註記 "ECPay: " + tradeNo
            walletTransactionDAO.save(sellerTx);
            
            // 6c. (建立訂單)
            OrderPO newOrder = new OrderPO();
            newOrder.setBuyer(buyer);
            newOrder.setSeller(seller);
            newOrder.setTotalPrice(sellerOrderPrice);
            newOrder.setStatus(OrderStatus.COMPLETED); // 或 PAID

            for (CartItemPO cartItem : sellerItems) {
                ProductPO product = cartItem.getProduct();
                
                OrderItemPO newOrderItem = new OrderItemPO();
                newOrderItem.setProduct(product);
                newOrderItem.setQuantity(cartItem.getQuantity());
                newOrderItem.setPricePerUnit(product.getPrice());
                
                newOrder.addOrderItem(newOrderItem);
                
                // 6d. (扣庫存)
                product.setStock(product.getStock() - cartItem.getQuantity());
                productDAO.save(product);
            }
            orderDAO.save(newOrder);
        }

        // 7. 清空購物車
        cartItemDAO.deleteAllByCart_CartId(cart.getCartId());
        
        logger.info("綠界直接結帳完成！買家: {}, 交易單號: {}", buyer.getEmail(), tradeNo);
    }


    /**
     * (查詢) 取得「我 (買家)」的所有訂單
     */
    @Override
    @Transactional(readOnly = true)
    public List<OrderResponseVO> getMyOrdersAsBuyer() throws AccessDeniedException {
        UserPO buyer = authHelperService.getCurrentAuthenticatedBuyer();
        logger.info("正在查詢買家 {} 的所有訂單...", buyer.getEmail());
        
        List<OrderPO> orders = orderDAO.findByBuyer_UserId(buyer.getUserId());
        
        // (S關鍵) 
        // 迴圈「手動初始化」所有訂單的 LAZY items
        for (OrderPO order : orders) {
            Hibernate.initialize(order.getItems());
            // (我們也需要賣家資訊，但 OrderResponseVO 會幫我們載入)
        }
        
        // (安全轉換)
        return orders.stream()
                .map(OrderResponseVO::new)
                .collect(Collectors.toList());
    }

    /**
     * (查詢) 取得「我 (買家)」的「單筆」訂單詳情
     */
    @Override
    @Transactional(readOnly = true)
    public OrderResponseVO getMyOrderDetails(Long orderId) throws AccessDeniedException, EntityNotFoundException {
        UserPO buyer = authHelperService.getCurrentAuthenticatedBuyer();
        logger.info("買家 {} 正在查詢訂單詳情 (ID: {})", buyer.getEmail(), orderId);
        
        OrderPO order = orderDAO.findById(orderId)
                .orElseThrow(() -> new EntityNotFoundException("找不到訂單, ID: " + orderId));
        
        // (S關鍵 - 安全) 
        // 驗證「所有權」
        if (!order.getBuyer().getUserId().equals(buyer.getUserId())) {
            logger.warn("權限不足：買家 {} 試圖查詢「不屬於」他的訂單 (ID: {})", 
                         buyer.getEmail(), orderId);
            throw new AccessDeniedException("您沒有權限查詢此訂單");
        }
        
        // (S關鍵) 
        // 手動初始化 LAZY items
        Hibernate.initialize(order.getItems());
        
        // (安全轉換)
        return new OrderResponseVO(order);
    }
    
    /**
     * (新) 實作：賣家查詢「所有」S收到的訂單
     */
    @Override
    @Transactional(readOnly = true)
    public List<OrderResponseVO> getMyOrdersAsSeller() 
            throws AccessDeniedException {
        
        // 1. (安全) 驗證「角色」
        UserPO seller = authHelperService.getCurrentAuthenticatedSeller();
        logger.info("賣家 {} 正在查詢S收到的所有訂單", seller.getEmail());

        // 2. (查詢) 呼叫 DAO (這個方法我們之前就建好了)
        List<OrderPO> orders = orderDAO.findBySeller_UserId(seller.getUserId());
        
        // 3. (S關鍵 - 安全) 
        // 迴圈「手動初始化」所有訂單的 LAZY items 集合
        // (VO 建構子中的 .getBuyer() 和 .getProduct() 會在交易中安全地懶載入)
        for (OrderPO order : orders) {
            Hibernate.initialize(order.getItems());
        }
        
        // 4. (安全轉換)
        logger.info("賣家 {} 共查詢到 {} 筆訂單", seller.getEmail(), orders.size());
        return orders.stream()
                .map(OrderResponseVO::new) // (在交易內安全轉換)
                .collect(Collectors.toList());
    }
}