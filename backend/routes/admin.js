const express = require("express");
const router = express.Router();
const Room = require("../models/Room");
const Contract = require("../models/Contract");
const Invoice = require("../models/Invoice");
const User = require("../models/User");
const { protect, adminOnly, verifyRole, injectDistrictFilter } = require("../middleware/auth");
const {
  getStaffList,
  updateUserRole,
  updateManagedDistricts,
  getAvailableDistricts,
} = require("../controllers/staffController");

// ═════════════════════════════════════════════════════════════════════════════
// DASHBOARD STATS
// ═════════════════════════════════════════════════════════════════════════════

// GET /api/admin/stats — thống kê tổng quan (admin + staff)
router.get("/stats", protect, verifyRole("admin", "staff"), injectDistrictFilter, async (req, res) => {
  try {
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // ── Build district-aware filters ────────────────────────────────────────
    const roomFilter = { ...req.districtFilter };
    const isStaff = req.user.role === "staff";

    // Lấy danh sách roomIds thuộc district (dùng cho contract/invoice filter)
    let roomIds = [];
    if (isStaff) {
      const rooms = await Room.find(req.districtFilter).select("_id");
      roomIds = rooms.map((r) => r._id);
    }

    // Contract filter: lọc theo rooms thuộc district
    const contractFilter = isStaff ? { room: { $in: roomIds } } : {};

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
      Room.countDocuments(roomFilter),
      Room.countDocuments({ ...roomFilter, status: "available" }),
      Room.countDocuments({ ...roomFilter, status: "occupied" }),
      Room.countDocuments({ ...roomFilter, status: "maintenance" }),
      Contract.countDocuments({ ...contractFilter, status: "active" }),
      // Tenant count: admin thấy tất cả, staff thấy tenant có hợp đồng trong district
      isStaff
        ? Contract.distinct("tenant", { ...contractFilter, status: "active" }).then((ids) => ids.length)
        : User.countDocuments({ role: "tenant" }),
      Contract.countDocuments({ ...contractFilter, status: "active", endDate: { $lte: sevenDaysFromNow } }),
      isStaff
        ? 0 // Staff không cần xem thông tin khách mới toàn hệ thống
        : User.countDocuments({ role: "tenant", createdAt: { $gte: startOfMonth } }),
    ]);

    // Doanh thu tháng hiện tại (tổng hóa đơn đã thu)
    const revenueMatchFilter = {
      month: now.getMonth() + 1,
      year: now.getFullYear(),
      status: "paid",
    };
    // Staff: chỉ tính invoice thuộc contracts trong district
    if (isStaff) {
      revenueMatchFilter.contract = { $in: roomIds.length > 0 ? await Contract.find({ room: { $in: roomIds } }).distinct("_id") : [] };
    }

    const revenueResult = await Invoice.aggregate([
      { $match: revenueMatchFilter },
      { $group: { _id: null, total: { $sum: "$totalAmount" } } },
    ]);
    const monthlyRevenue = revenueResult[0]?.total ?? 0;

    // Hóa đơn quá hạn
    const overdueMatchFilter = {
      status: "unpaid",
      dueDate: { $lt: now },
    };
    if (isStaff) {
      overdueMatchFilter.contract = revenueMatchFilter.contract;
    }

    const overdueInvoicesResult = await Invoice.aggregate([
      { $match: overdueMatchFilter },
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
      newTenants,
    });
  } catch (err) {
    console.error("Stats error:", err);
    res.status(500).json({ message: "Lỗi server." });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// USER MANAGEMENT (admin only)
// ═════════════════════════════════════════════════════════════════════════════

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

// ═════════════════════════════════════════════════════════════════════════════
// STAFF MANAGEMENT (admin only)
// ═════════════════════════════════════════════════════════════════════════════

// GET /api/admin/staff — danh sách nhân viên
router.get("/staff", protect, adminOnly, getStaffList);

// PUT /api/admin/users/:id/role — đổi role
router.put("/users/:id/role", protect, adminOnly, updateUserRole);

// PUT /api/admin/users/:id/districts — setup khu vực quản lý
router.put("/users/:id/districts", protect, adminOnly, updateManagedDistricts);

// GET /api/admin/districts — danh sách districts có sẵn
router.get("/districts", protect, adminOnly, getAvailableDistricts);

module.exports = router;
