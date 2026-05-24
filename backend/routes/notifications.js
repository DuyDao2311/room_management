const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
} = require("../controllers/notificationController");

// ─── Lấy số lượng thông báo chưa đọc ─────────────────────────────────────────
// GET /api/notifications/unread-count
router.get("/unread-count", protect, getUnreadCount);

// ─── Lấy danh sách thông báo (30 mới nhất) ───────────────────────────────────
// GET /api/notifications
// Query: ?type=APPOINTMENT&limit=50 (optional)
router.get("/", protect, getNotifications);

// ─── Đánh dấu tất cả đã đọc ──────────────────────────────────────────────────
// PATCH /api/notifications/read-all
// Lưu ý: route này PHẢI đặt trước /:id/read để tránh bị match nhầm
// Query: ?type=APPOINTMENT (optional)
router.patch("/read-all", protect, markAllAsRead);

// ─── Xóa 1 thông báo ─────────────────────────────────────────────────────────
// DELETE /api/notifications/:id
router.delete("/:id", protect, deleteNotification);

// ─── Đánh dấu 1 thông báo đã đọc ─────────────────────────────────────────────
// PATCH /api/notifications/:id/read
router.patch("/:id/read", protect, markAsRead);

module.exports = router;
