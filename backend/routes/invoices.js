const express = require("express");
const router = express.Router();
const { protect, adminOnly, verifyRole } = require("../middleware/auth");
const {
  createDepositInvoice,
  createServiceInvoice,
  getInvoices,
  getInvoiceById,
  updateInvoiceStatus,
  getAllInvoices,
  sendInvoice,
  updateInvoice,
  getMyInvoices,
  payInvoice,
} = require("../controllers/invoiceController");

// ─── Xem tất cả hóa đơn (admin + staff) ──────────────────────────────────────
// GET /api/invoices/all?status=unpaid&type=service
// Staff: tự filter theo district trong controller
router.get("/all", protect, verifyRole("admin", "staff"), getAllInvoices);

// ─── Lấy danh sách hóa đơn theo contract ─────────────────────────────────────
// GET /api/invoices?contractId=xxx&type=service&status=unpaid
router.get("/", protect, getInvoices);

// ─── Lấy hóa đơn của tôi (tenant) ────────────────────────────────────────────
// GET /api/invoices/my
router.get("/my", protect, getMyInvoices);

// ─── Lấy chi tiết hóa đơn ────────────────────────────────────────────────────
// GET /api/invoices/:id
router.get("/:id", protect, getInvoiceById);

// ─── Tạo hóa đơn deposit ─────────────────────────────────────────────────────
// POST /api/invoices/deposit
// Body: { contractId, dueDate?, notes? }
router.post("/deposit", protect, verifyRole("admin", "staff"), createDepositInvoice);

// ─── Tạo hóa đơn service ─────────────────────────────────────────────────────
// POST /api/invoices/service
// Body: { contractId, month, year, electricity, water, extraFees?, dueDate?, notes? }
router.post("/service", protect, verifyRole("admin", "staff"), createServiceInvoice);

// ─── Gửi hoá đơn cho tenant (realtime notification) ────────────────────────
// POST /api/invoices/:id/send
router.post("/:id/send", protect, sendInvoice);

// ─── Cập nhật trạng thái hóa đơn ─────────────────────────────────────────────
// PATCH /api/invoices/:id/status
// Body: { status: "paid" | "unpaid" | "overdue" }
router.patch("/:id/status", protect, verifyRole("admin", "staff"), updateInvoiceStatus);

// ─── Thanh toán hóa đơn (dành cho người thuê) ───────────────────────────────
// POST /api/invoices/:id/pay
router.post("/:id/pay", protect, payInvoice);

// ─── Cập nhật thông tin hoá đơn (khi chưa gửi) ──────────────────────────────
// PUT /api/invoices/:id
router.put("/:id", protect, verifyRole("admin", "staff"), updateInvoice);

module.exports = router;
