package demo.bigwork.service;

import demo.bigwork.model.vo.OrderResponseVO;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.security.access.AccessDeniedException;

import java.math.BigDecimal;
import java.util.List;

public interface OrderService {

	/**
	 * (核心業務) 結帳！ 從「我」的購物車建立一筆或多筆訂單
	 *
	 * @return 此次結帳所產生的「所有」新訂單
	 * @throws AccessDeniedException (如果不是 BUYER)
	 * @throws Exception             (e.g., 庫存不足, 餘額不足, 購物車為空)
	 */
	List<OrderResponseVO> checkoutFromMyCart() throws AccessDeniedException, Exception;

	/**
	 * (查詢) 取得「我 (買家)」的所有訂單
	 *
	 * @return
	 * @throws AccessDeniedException (如果不是 BUYER)
	 */
	List<OrderResponseVO> getMyOrdersAsBuyer() throws AccessDeniedException;

	/**
	 * (查詢) 取得「我 (買家)」的「單筆」訂單詳情 (Service 內部必須驗證所有權)
	 *
	 * @param orderId
	 * @return
	 * @throws AccessDeniedException   (如果不是 BUYER 或「不擁有」此訂單)
	 * @throws EntityNotFoundException (如果訂單不存在)
	 */
	OrderResponseVO getMyOrderDetails(Long orderId) throws AccessDeniedException, EntityNotFoundException;

	List<OrderResponseVO> getMyOrdersAsSeller() throws AccessDeniedException;

	/**
	 * (新) 處理綠界直接結帳 (Callback 觸發)
	 * 邏輯：
	 * 1. 找到買家購物車
	 * 2. 驗證總金額是否與綠界付款金額一致 (防篡改)
	 * 3. 拆分訂單、扣庫存、賣家入帳
	 * 4. (關鍵) 不扣買家錢包餘額
	 * 5. 產生買家「支出」紀錄 (雖然沒扣餘額，但要記錄這筆錢是用掉的) -> 或者乾脆不記，因為錢根本沒進錢包
	 */
	void processEcpayCheckout(Long userId, BigDecimal amount, String tradeNo) throws Exception;

}