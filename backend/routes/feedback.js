const express = require("express");
const router = express.Router();
const { protect, verifyRole } = require("../middleware/auth");
const {
  getFeedbacksByRoom,
  createFeedback,
  updateFeedback,
  deleteFeedback,
  getAllFeedbacks,
  toggleFeedbackStatus,
  getMyFeedback,
  checkEligibilityRoute,
  replyToFeedback,
} = require("../controllers/feedbackController");

// ── Public ────────────────────────────────────────────────────────────────────
// GET /api/feedback/room/:roomId — Danh sách feedback visible của 1 phòng
router.get("/room/:roomId", getFeedbacksByRoom);

// ── Tenant ────────────────────────────────────────────────────────────────────
// GET /api/feedback/my/:roomId    — Lấy feedback của tenant hiện tại cho phòng đó
router.get("/my/:roomId", protect, verifyRole("tenant"), getMyFeedback);

// GET /api/feedback/eligible/:roomId — Kiểm tra tenant có đủ điều kiện đánh giá
router.get("/eligible/:roomId", protect, verifyRole("tenant"), checkEligibilityRoute);

// POST /api/feedback              — Tạo feedback mới
router.post("/", protect, verifyRole("tenant"), createFeedback);

// PUT /api/feedback/:id           — Sửa feedback của mình
router.put("/:id", protect, verifyRole("tenant"), updateFeedback);

// ── Tenant | Admin | Staff ────────────────────────────────────────────────────
// DELETE /api/feedback/:id        — Xóa (tenant xóa của mình, admin/staff xóa bất kỳ)
router.delete("/:id", protect, deleteFeedback);

// ── Admin | Staff ─────────────────────────────────────────────────────────────
// GET  /api/feedback              — Tất cả feedback (có filter, phân trang)
router.get("/", protect, verifyRole("admin", "staff"), getAllFeedbacks);

// PATCH /api/feedback/:id/status  — Ẩn / Hiện feedback
router.patch("/:id/status", protect, verifyRole("admin", "staff"), toggleFeedbackStatus);

// PUT /api/feedback/:id/reply     — Phản hồi đánh giá (admin/staff)
router.put("/:id/reply", protect, verifyRole("admin", "staff"), replyToFeedback);

module.exports = router;
