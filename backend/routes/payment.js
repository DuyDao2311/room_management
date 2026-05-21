/**
 * ═══════════════════════════════════════════════════════════════════════════
 * PAYMENT ROUTES - Hệ thống thanh toán
 * ═══════════════════════════════════════════════════════════════════════════
 */

const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { protect, adminOnly, verifyRole } = require('../middleware/auth');

/**
 * Public Routes
 */

// Callback từ Momo (không cần auth)
router.get('/momo-callback', paymentController.momoCallback.bind(paymentController));

// Callback từ VNPay (không cần auth)
router.get('/vnpay-callback', paymentController.vnpayCallback.bind(paymentController));

/**
 * Protected Routes - Cần đăng nhập
 */

// Tạo thanh toán mới
// Body: { invoiceId, typePayment: 'cod' | 'momo' | 'vnpay' }
router.post('/create', protect, paymentController.createPayment.bind(paymentController));

// Lấy chi tiết hóa đơn
router.get('/:invoiceId', protect, paymentController.getPaymentById.bind(paymentController));

/**
 * Admin Routes - Chỉ admin/staff
 */

// Lấy danh sách thanh toán
// Query params: status, paymentMethod
router.get(
    '/',
    protect,
    verifyRole('admin', 'staff'),
    paymentController.getPayments.bind(paymentController)
);

// Cập nhật trạng thái thanh toán
// Body: { status: 'unpaid' | 'paid' | 'overdue' }
router.patch(
    '/:invoiceId/status',
    protect,
    verifyRole('admin', 'staff'),
    paymentController.updatePaymentStatus.bind(paymentController)
);

// Lấy thống kê thanh toán
router.get(
    '/stats/overview',
    protect,
    adminOnly,
    paymentController.getPaymentStats.bind(paymentController)
);

module.exports = router;
