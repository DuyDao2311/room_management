const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const {
  getNotifications,
  markAsRead,
  markAllAsRead,
} = require("../controllers/notificationController");

// ─── Lấy danh sách thông báo (30 mới nhất) ───────────────────────────────────
// GET /api/notifications
router.get("/", protect, getNotifications);

// ─── Đánh dấu tất cả đã đọc ──────────────────────────────────────────────────
// PATCH /api/notifications/read-all
// Lưu ý: route này PHẢI đặt trước /:id/read để tránh bị match nhầm
router.patch("/read-all", protect, markAllAsRead);

// ─── Đánh dấu 1 thông báo đã đọc ─────────────────────────────────────────────
// PATCH /api/notifications/:id/read
router.patch("/:id/read", protect, markAsRead);

module.exports = router;
