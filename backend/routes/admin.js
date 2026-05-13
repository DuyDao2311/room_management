const express = require("express");
const router = express.Router();
const Room = require("../models/Room");
const Contract = require("../models/Contract");
const Invoice = require("../models/Invoice");
const User = require("../models/User");
const { protect, adminOnly } = require("../middleware/auth");

// GET /api/admin/stats — thống kê tổng quan
router.get("/stats", protect, adminOnly, async (req, res) => {
  try {
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalRooms,
      availableRooms,
      occupiedRooms,
      maintenanceRooms,
      activeContracts,
      totalTenants,
      expiringContracts,
      newTenants,
    ] = await Promise.all([
      Room.countDocuments(),
      Room.countDocuments({ status: "available" }),
      Room.countDocuments({ status: "occupied" }),
      Room.countDocuments({ status: "maintenance" }),
      Contract.countDocuments({ status: "active" }),
      User.countDocuments({ role: "tenant" }),
      Contract.countDocuments({ status: "active", endDate: { $lte: sevenDaysFromNow } }),
      User.countDocuments({ role: "tenant", createdAt: { $gte: startOfMonth } }),
    ]);

    // Doanh thu tháng hiện tại (tổng hóa đơn đã thu)
    const revenueResult = await Invoice.aggregate([
      {
        $match: {
          month: now.getMonth() + 1,
          year: now.getFullYear(),
          status: "paid",
        },
      },
      { $group: { _id: null, total: { $sum: "$totalAmount" } } },
    ]);
    const monthlyRevenue = revenueResult[0]?.total ?? 0;

    // Hóa đơn quá hạn
    const overdueInvoicesResult = await Invoice.aggregate([
      {
        $match: {
          status: "unpaid",
          dueDate: { $lt: now },
        },
      },
      { $group: { _id: null, count: { $sum: 1 }, total: { $sum: "$totalAmount" } } },
    ]);
    const overdueInvoicesCount = overdueInvoicesResult[0]?.count ?? 0;
    const overdueInvoicesAmount = overdueInvoicesResult[0]?.total ?? 0;

    res.json({
      totalRooms,
      availableRooms,
      occupiedRooms,
      maintenanceRooms,
      activeContracts,
      totalTenants,
      monthlyRevenue,
      expiringContracts,
      overdueInvoicesCount,
      overdueInvoicesAmount,
      newTenants
    });
  } catch (err) {
    console.error("Stats error:", err);
    res.status(500).json({ message: "Lỗi server." });
  }
});

// GET /api/admin/tenants — danh sách khách thuê (admin only)
router.get("/tenants", protect, adminOnly, async (req, res) => {
  try {
    const tenants = await User.find({ role: "tenant" }).sort({ createdAt: -1 });
    res.json(tenants);
  } catch (err) {
    res.status(500).json({ message: "Lỗi server." });
  }
});

// GET /api/admin/users — danh sách tất cả tài khoản
router.get("/users", protect, adminOnly, async (req, res) => {
  try {
    const users = await User.find({}).sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: "Lỗi server." });
  }
});

// PUT /api/admin/users/:id/role — cập nhật vai trò người dùng
router.put("/users/:id/role", protect, adminOnly, async (req, res) => {
  try {
    const { role } = req.body;
    if (!["admin", "tenant"].includes(role)) {
      return res.status(400).json({ message: "Vai trò không hợp lệ." });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: "Không tìm thấy người dùng." });
    }

    // Không cho phép tự đổi quyền của khóa hiện tại nếu là admin duy nhất
    // (Tuỳ chọn: Nếu thực sự cần có thể thêm logic kiểm tra)
    user.role = role;
    await user.save();

    res.json(user);
  } catch (err) {
    res.status(500).json({ message: "Lỗi server." });
  }
});

module.exports = router;
