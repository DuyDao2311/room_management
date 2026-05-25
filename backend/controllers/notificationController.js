const Notification = require("../models/Notification");

// ─────────────────────────────────────────────────────────────────────────────
// 1. Lấy 30 thông báo mới nhất của user đang đăng nhập
// ─────────────────────────────────────────────────────────────────────────────
/**
 * GET /api/notifications
 * Quyền: đã đăng nhập (tự lấy theo req.user._id)
 * Query: ?type=APPOINTMENT&limit=50 (optional)
 */
const getNotifications = async (req, res) => {
  try {
    const { type, limit = 30 } = req.query;
    const filter = { userId: req.user._id };
    
    if (type) {
      filter.type = type;
    }

    const notifications = await Notification.find(filter)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .lean();

    res.json(notifications);
  } catch (err) {
    res.status(500).json({ message: err.message || "Lỗi server." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 2. Lấy số lượng thông báo chưa đọc
// ─────────────────────────────────────────────────────────────────────────────
/**
 * GET /api/notifications/unread-count
 * Quyền: đã đăng nhập
 * Query: ?type=APPOINTMENT (optional - lọc theo loại)
 */
const getUnreadCount = async (req, res) => {
  try {
    const { type } = req.query;
    const filter = { userId: req.user._id, isRead: false };
    
    if (type) {
      filter.type = type;
    }

    const count = await Notification.countDocuments(filter);
    res.json({ count });
  } catch (err) {
    res.status(500).json({ message: err.message || "Lỗi server." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 3. Đánh dấu 1 thông báo đã đọc
// ─────────────────────────────────────────────────────────────────────────────
/**
 * PATCH /api/notifications/:id/read
 * Chỉ update notification thuộc user hiện tại
 */
const markAsRead = async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { isRead: true },
      { returnDocument: "after" }
    );

    if (!notification) {
      // Thử tìm theo tenantId cho tương thích ngược
      const notificationByTenant = await Notification.findOneAndUpdate(
        { _id: req.params.id, tenantId: req.user._id },
        { isRead: true },
        { returnDocument: "after" }
      );
      
      if (!notificationByTenant) {
        return res.status(404).json({ message: "Không tìm thấy thông báo." });
      }
      return res.json(notificationByTenant);
    }

    res.json(notification);
  } catch (err) {
    res.status(500).json({ message: err.message || "Lỗi server." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 4. Đánh dấu tất cả thông báo đã đọc
// ─────────────────────────────────────────────────────────────────────────────
/**
 * PATCH /api/notifications/read-all
 * Set isRead = true cho toàn bộ notification của user
 * Query: ?type=APPOINTMENT (optional - chỉ đánh dấu theo loại)
 */
const markAllAsRead = async (req, res) => {
  try {
    const { type } = req.query;
    const filter = { userId: req.user._id, isRead: false };
    
    if (type) {
      filter.type = type;
    }

    const result = await Notification.updateMany(filter, { isRead: true });
    
    res.json({ 
      success: true, 
      modifiedCount: result.modifiedCount 
    });
  } catch (err) {
    res.status(500).json({ message: err.message || "Lỗi server." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 5. Xóa 1 thông báo
// ─────────────────────────────────────────────────────────────────────────────
/**
 * DELETE /api/notifications/:id
 * Chỉ xóa notification thuộc user hiện tại
 */
const deleteNotification = async (req, res) => {
  try {
    const result = await Notification.deleteOne({
      _id: req.params.id,
      userId: req.user._id
    });

    if (result.deletedCount === 0) {
      // Thử tìm theo tenantId cho tương thích ngược
      const resultByTenant = await Notification.deleteOne({
        _id: req.params.id,
        tenantId: req.user._id
      });
      
      if (resultByTenant.deletedCount === 0) {
        return res.status(404).json({ message: "Không tìm thấy thông báo." });
      }
    }

    res.json({ message: "Đã xóa thông báo." });
  } catch (err) {
    res.status(500).json({ message: err.message || "Lỗi server." });
  }
};

module.exports = {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
};
