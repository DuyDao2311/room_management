const express = require("express");
const router = express.Router();
const Room = require("../models/Room");
const Contract = require("../models/Contract");
const Invoice = require("../models/Invoice");
const User = require("../models/User");
const Incident = require("../models/Incident");
const Booking = require("../models/Booking");
const ServiceBooking = require("../models/ServiceBooking");
const { protect, adminOnly, verifyRole, injectDistrictFilter } = require("../middleware/auth");
const {
  getStaffList,
  updateUserRole,
  updateManagedDistricts,
  getAvailableDistricts,
  createUser,
  deleteUser,
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

    // ── Cho phép chọn tháng/năm qua query params ────────────────────────
    const qMonth = req.query.month ? parseInt(req.query.month) : null;
    const qYear = req.query.year ? parseInt(req.query.year) : null;
    const targetMonth = qMonth || (now.getMonth() + 1);  // 1-12
    const targetYear = qYear || now.getFullYear();

    const startOfMonth = new Date(targetYear, targetMonth - 1, 1);
    const endOfMonth = new Date(targetYear, targetMonth, 0, 23, 59, 59, 999);

    // Tháng trước (so với tháng được chọn)
    const startOfPrevMonth = new Date(targetYear, targetMonth - 2, 1);
    const endOfPrevMonth = new Date(targetYear, targetMonth - 1, 0, 23, 59, 59, 999);
    const prevMonth = startOfPrevMonth.getMonth() + 1;
    const prevYear = startOfPrevMonth.getFullYear();

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
    // Booking filter: lọc theo rooms thuộc district
    const bookingFilter = isStaff ? { room: { $in: roomIds } } : {};

    const [
      totalRooms,
      availableRooms,
      occupiedRooms,
      maintenanceRooms,
      activeContracts,
      longTermTenants,
      expiringContracts,
      newTenants,
    ] = await Promise.all([
      Room.countDocuments(roomFilter),
      Room.countDocuments({ ...roomFilter, status: "available" }),
      Room.countDocuments({ ...roomFilter, status: "occupied" }),
      Room.countDocuments({ ...roomFilter, status: "maintenance" }),
      Contract.countDocuments({ ...contractFilter, status: "active" }),
      // Tenant dài hạn
      Contract.distinct("tenant", { ...contractFilter, status: "active" }).then((ids) => ids.length),
      Contract.countDocuments({ ...contractFilter, status: "active", endDate: { $lte: sevenDaysFromNow } }),
      isStaff
        ? 0
        : User.countDocuments({ role: "tenant", createdAt: { $gte: startOfMonth } }),
    ]);

    const totalTenants = longTermTenants;

    // ── Doanh thu tháng được chọn (Invoice đã thu) ───────────────────────────
    const revenueMatchFilter = {
      month: targetMonth,
      year: targetYear,
      status: "paid",
    };
    if (isStaff) {
      revenueMatchFilter.contract = { $in: roomIds.length > 0 ? await Contract.find({ room: { $in: roomIds } }).distinct("_id") : [] };
    }

    const revenueResult = await Invoice.aggregate([
      { $match: revenueMatchFilter },
      { $group: { _id: null, total: { $sum: "$totalAmount" } } },
    ]);
    const invoiceRevenue = revenueResult[0]?.total ?? 0;

    // Doanh thu theo phương thức thanh toán (tháng hiện tại)
    const revenueByMethodResult = await Invoice.aggregate([
      { $match: revenueMatchFilter },
      { $group: { _id: "$paymentMethod", total: { $sum: "$totalAmount" }, count: { $sum: 1 } } },
    ]);
    const cashRevenue = revenueByMethodResult.find(r => r._id === "Cash")?.total ?? 0;
    const momoRevenue = revenueByMethodResult.find(r => r._id === "MoMo")?.total ?? 0;
    const vnpayRevenue = revenueByMethodResult.find(r => r._id === "VNPay")?.total ?? 0;

    // ── Chi phí và Doanh thu sự cố tháng hiện tại (Incident theo createdAt) ─
    const incidentFilter = {
      createdAt: { $gte: startOfMonth, $lte: endOfMonth },
    };
    if (isStaff) {
      incidentFilter.room = { $in: roomIds };
    }
    const incidentResult = await Incident.aggregate([
      { $match: incidentFilter },
      { $group: {
          _id: null,
          tenantCost: { $sum: { $cond: [{ $eq: ["$costPayer", "tenant"] }, "$repairCost", 0] } },
          landlordCost: { $sum: { $cond: [{ $eq: ["$costPayer", "landlord"] }, "$repairCost", 0] } }
        }
      },
    ]);
    const incidentTenantCost = incidentResult[0]?.tenantCost ?? 0;
    const monthlyExpenses = incidentResult[0]?.landlordCost ?? 0;
    const incidentRevenue = incidentTenantCost - monthlyExpenses;

    // ── Doanh thu & chi phí tháng trước (để tính % tăng/giảm) ───────────────
    const prevRevenueFilter = {
      month: prevMonth,
      year: prevYear,
      status: "paid",
    };
    if (isStaff) {
      prevRevenueFilter.contract = revenueMatchFilter.contract;
    }
    const prevRevenueResult = await Invoice.aggregate([
      { $match: prevRevenueFilter },
      { $group: { _id: null, total: { $sum: "$totalAmount" } } },
    ]);
    const prevInvoiceRev = prevRevenueResult[0]?.total ?? 0;
    
    const prevBookingRevResult = await Booking.aggregate([
      { $match: { ...bookingFilter, paymentStatus: "paid", createdAt: { $gte: startOfPrevMonth, $lte: endOfPrevMonth } } },
      { $group: { _id: null, total: { $sum: "$totalAmount" } } },
    ]);
    const prevBookingRev = prevBookingRevResult[0]?.total ?? 0;
    
    const prevServiceRevResult = await ServiceBooking.aggregate([
      { $match: { paymentStatus: "paid", createdAt: { $gte: startOfPrevMonth, $lte: endOfPrevMonth } } },
      { $group: { _id: null, total: { $sum: "$totalAmount" } } },
    ]);
    const prevServiceRev = prevServiceRevResult[0]?.total ?? 0;
    
    const prevIncidentFilter = {
      createdAt: { $gte: startOfPrevMonth, $lte: endOfPrevMonth },
    };
    if (isStaff) {
      prevIncidentFilter.room = { $in: roomIds };
    }
    const prevIncidentResult = await Incident.aggregate([
      { $match: prevIncidentFilter },
      { $group: {
          _id: null,
          tenantCost: { $sum: { $cond: [{ $eq: ["$costPayer", "tenant"] }, "$repairCost", 0] } },
          landlordCost: { $sum: { $cond: [{ $eq: ["$costPayer", "landlord"] }, "$repairCost", 0] } }
        }
      },
    ]);
    const prevIncidentTenant = prevIncidentResult[0]?.tenantCost ?? 0;
    const previousMonthExpenses = prevIncidentResult[0]?.landlordCost ?? 0;
    const prevIncidentRev = prevIncidentTenant - previousMonthExpenses;

    const previousMonthRevenue = prevInvoiceRev + prevBookingRev + prevServiceRev + prevIncidentRev;

    // ── Doanh thu theo nguồn (tháng được chọn) ───────────────────────────────
    // 1. Tiền thuê phòng = toàn bộ Invoice.totalAmount (bao gồm tiền thuê + điện nước + phí phụ)
    const rentRevenue = invoiceRevenue;

    // 2. Tiền booking (Booking totalAmount, tháng hiện tại, đã thanh toán)
    const bookingRevenueResult = await Booking.aggregate([
      { $match: { ...bookingFilter, paymentStatus: "paid", createdAt: { $gte: startOfMonth, $lte: endOfMonth } } },
      { $group: { _id: null, total: { $sum: "$totalAmount" } } },
    ]);
    const bookingRevenue = bookingRevenueResult[0]?.total ?? 0;

    // 3. Tiền dịch vụ (ServiceBooking totalAmount, tháng hiện tại, đã thanh toán)
    const serviceRevenueResult = await ServiceBooking.aggregate([
      { $match: { paymentStatus: "paid", createdAt: { $gte: startOfMonth, $lte: endOfMonth } } },
      { $group: { _id: null, total: { $sum: "$totalAmount" } } },
    ]);
    const serviceRevenue = serviceRevenueResult[0]?.total ?? 0;

    // ── Tổng doanh thu = Invoice + Booking + ServiceBooking + Incident ─────────────────
    const monthlyRevenue = invoiceRevenue + bookingRevenue + serviceRevenue + incidentRevenue;

    // ── Dữ liệu biểu đồ 6 tháng kết thúc tại tháng được chọn ──────────────
    const chartData = [];
    for (let i = 5; i >= 0; i--) {
      // Lùi i tháng từ tháng được chọn
      const d = new Date(targetYear, targetMonth - 1 - i, 1);
      const m = d.getMonth() + 1;
      const y = d.getFullYear();

      const mStart = new Date(y, m - 1, 1);
      const mEnd = new Date(y, m, 0, 23, 59, 59, 999);

      const chartRevFilter = { month: m, year: y, status: "paid" };
      if (isStaff) chartRevFilter.contract = revenueMatchFilter.contract;

      const chartIncidentFilter = {
        createdAt: { $gte: mStart, $lte: mEnd },
      };
      if (isStaff) chartIncidentFilter.room = { $in: roomIds };

      const [rev, bookingRevResult, serviceRevResult, incidentResult] = await Promise.all([
        Invoice.aggregate([{ $match: chartRevFilter }, { $group: { _id: null, total: { $sum: "$totalAmount" } } }]),
        Booking.aggregate([
          { $match: { ...bookingFilter, paymentStatus: "paid", createdAt: { $gte: mStart, $lte: mEnd } } },
          { $group: { _id: null, total: { $sum: "$totalAmount" } } }
        ]),
        ServiceBooking.aggregate([
          { $match: { paymentStatus: "paid", createdAt: { $gte: mStart, $lte: mEnd } } },
          { $group: { _id: null, total: { $sum: "$totalAmount" } } }
        ]),
        Incident.aggregate([
          { $match: chartIncidentFilter },
          { $group: { 
              _id: null, 
              tenantCost: { $sum: { $cond: [{ $eq: ["$costPayer", "tenant"] }, "$repairCost", 0] } },
              landlordCost: { $sum: { $cond: [{ $eq: ["$costPayer", "landlord"] }, "$repairCost", 0] } }
            } 
          }
        ]),
      ]);

      const invoiceRev = rev[0]?.total ?? 0;
      const bookingRev = bookingRevResult[0]?.total ?? 0;
      const serviceRev = serviceRevResult[0]?.total ?? 0;
      const incidentTenant = incidentResult[0]?.tenantCost ?? 0;
      const incidentLandlord = incidentResult[0]?.landlordCost ?? 0;
      const incidentRev = incidentTenant - incidentLandlord;

      chartData.push({
        month: `T${m}`,
        revenue: invoiceRev + bookingRev + serviceRev + incidentRev,
        expenses: incidentLandlord,
      });
    }

    // Hóa đơn chờ thu tiền mặt (pending)
    const pendingMatchFilter = { status: "pending" };
    if (isStaff) {
      pendingMatchFilter.contract = revenueMatchFilter.contract;
    }
    const pendingResult = await Invoice.aggregate([
      { $match: pendingMatchFilter },
      { $group: { _id: null, count: { $sum: 1 }, total: { $sum: "$totalAmount" } } },
    ]);
    const pendingInvoicesCount = pendingResult[0]?.count ?? 0;
    const pendingInvoicesAmount = pendingResult[0]?.total ?? 0;

    // Hóa đơn quá hạn (Không tính các hoá đơn của hợp đồng đã chấm dứt)
    const validContractQuery = { status: { $ne: "terminated" } };
    if (isStaff) {
      validContractQuery.room = { $in: roomIds };
    }
    const validContractIds = await Contract.find(validContractQuery).distinct("_id");

    const overdueMatchFilter = {
      status: "unpaid",
      dueDate: { $lt: now },
      contract: { $in: validContractIds },
    };

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
      selectedMonth: targetMonth,
      selectedYear: targetYear,
      cashRevenue,
      momoRevenue,
      vnpayRevenue,
      pendingInvoicesCount,
      pendingInvoicesAmount,
      expiringContracts,
      overdueInvoicesCount,
      overdueInvoicesAmount,
      newTenants,
      // ── Dữ liệu mới cho Dashboard redesign ─────────────────────
      monthlyExpenses,
      previousMonthRevenue,
      previousMonthExpenses,
      revenueBySource: {
        rent: rentRevenue,
        booking: bookingRevenue,
        service: serviceRevenue,
        incident: incidentRevenue,
      },
      chartData,
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

// POST /api/admin/users — tạo tài khoản mới
router.post("/users", protect, adminOnly, createUser);

// DELETE /api/admin/users/:id — xóa tài khoản
router.delete("/users/:id", protect, adminOnly, deleteUser);

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
