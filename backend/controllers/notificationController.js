const Notification = require("../models/Notification");

// ─────────────────────────────────────────────────────────────────────────────
// 1. Lấy 30 thông báo mới nhất của tenant đang đăng nhập
// ─────────────────────────────────────────────────────────────────────────────
/**
 * GET /api/notifications
 * Quyền: đã đăng nhập (tự lấy theo req.user._id)
 */
const getNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({ tenantId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(30)
      .lean();

    res.json(notifications);
  } catch (err) {
    res.status(500).json({ message: err.message || "Lỗi server." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 2. Đánh dấu 1 thông báo đã đọc
// ─────────────────────────────────────────────────────────────────────────────
/**
 * PATCH /api/notifications/:id/read
 * Chỉ update notification thuộc tenant hiện tại
 */
const markAsRead = async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.user._id },
      { isRead: true },
      { returnDocument: "after" }
    );

    if (!notification) {
      return res.status(404).json({ message: "Không tìm thấy thông báo." });
    }

    res.json(notification);
  } catch (err) {
    res.status(500).json({ message: err.message || "Lỗi server." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 3. Đánh dấu tất cả thông báo đã đọc
// ─────────────────────────────────────────────────────────────────────────────
/**
 * PATCH /api/notifications/read-all
 * Set isRead = true cho toàn bộ notification của tenant
 */
const markAllAsRead = async (req, res) => {
  try {
    await Notification.updateMany(
      { tenantId: req.user._id, isRead: false },
      { isRead: true }
    );

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message || "Lỗi server." });
  }
};

module.exports = {
  getNotifications,
  markAsRead,
  markAllAsRead,
};
