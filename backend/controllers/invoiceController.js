const Invoice      = require("../models/Invoice");
const Contract     = require("../models/Contract");
const Room         = require("../models/Room");
const Payment      = require("../models/Payment");
const { checkUserDistrictPermission } = require("../middleware/auth");
const { notifyTenantInvoiceSent, notifyTenantInvoicePaid, notifyInvoicePaid, sendSocketNotification } = require("../utils/notificationService");

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Lấy hợp đồng đã populate room & kiểm tra quyền truy cập.
 * - Admin: thấy tất cả
 * - Staff: chỉ thấy hợp đồng thuộc district được phân công
 * - Tenant: chỉ thấy hợp đồng của mình
 */
const getContractOrFail = async (contractId, user) => {
  const contract = await Contract.findById(contractId)
    .populate("room", "name address price district");

  if (!contract) {
    const err = new Error("Không tìm thấy hợp đồng.");
    err.status = 404;
    throw err;
  }

  // Admin: bypass
  if (user.role === "admin") return contract;

  // Staff: kiểm tra district
  if (user.role === "staff") {
    const roomDistrict = contract.room?.district || "";
    if (!user.managedDistricts || !user.managedDistricts.includes(roomDistrict)) {
      const err = new Error("Bạn không có quyền truy cập hợp đồng thuộc khu vực này.");
      err.status = 403;
      throw err;
    }
    return contract;
  }

  // Tenant: chỉ thấy hợp đồng của mình
  if (contract.tenant.toString() !== user._id.toString()) {
    const err = new Error("Không có quyền truy cập hợp đồng này.");
    err.status = 403;
    throw err;
  }

  return contract;
};

// ─────────────────────────────────────────────────────────────────────────────
// 1. Tạo hóa đơn DEPOSIT (gọi khi tạo contract thành công)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * POST /api/invoices/deposit
 * Body: { contractId, dueDate?, notes? }
 * Quyền: admin
 */
const createDepositInvoice = async (req, res) => {
  try {
    const { contractId, dueDate, notes } = req.body;

    if (!contractId) {
      return res.status(400).json({ message: "contractId là bắt buộc." });
    }

    const contract = await getContractOrFail(contractId, req.user);

    // Ngăn tạo hóa đơn deposit 2 lần
    const existing = await Invoice.findOne({ contract: contractId, type: "deposit" });
    if (existing) {
      return res.status(409).json({ message: "Hóa đơn đặt cọc đã tồn tại cho hợp đồng này." });
    }

    const invoice = await Invoice.create({
      contract:            contractId,
      type:                "deposit",

      // --- Snapshot ---
      representativeName:  contract.representativeName,
      representativePhone: contract.representativePhone,
      roomName:            contract.room.name,
      rentAmount:          contract.monthlyRent,

      depositAmount:       contract.depositAmount || contract.monthlyRent, // mặc định 1 tháng
      dueDate:             dueDate || contract.startDate,
      notes:               notes || "",
      createdBy:           req.user._id,
    });

    res.status(201).json(invoice);
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message || "Lỗi server." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 2. Tạo hóa đơn SERVICE hàng tháng (Thủ công)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * POST /api/invoices/service
 * Body: {
 *   contractId,
 *   month, year,
 *   electricity: { oldReading, newReading, rate },
 *   water:       { oldReading, newReading, rate },
 *   extraFees:   [{ name, amount }],
 *   notes?
 * }
 * Quyền: admin, staff
 */
const { createManualInvoiceService } = require("../services/invoice.service");

const createServiceInvoice = async (req, res) => {
  try {
    const invoice = await createManualInvoiceService(req.body, req.user);
    res.status(201).json(invoice);
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message || "Lỗi server." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 3. Lấy danh sách hóa đơn theo contract
// ─────────────────────────────────────────────────────────────────────────────
/**
 * GET /api/invoices?contractId=xxx&type=service&status=unpaid
 * Quyền: đã đăng nhập (admin thấy tất cả, tenant chỉ thấy của mình)
 */
const getInvoices = async (req, res) => {
  try {
    const { contractId, type, status } = req.query;

    if (!contractId) {
      return res.status(400).json({ message: "contractId là bắt buộc." });
    }

    // Kiểm tra quyền qua contract
    await getContractOrFail(contractId, req.user);

    const filter = { contract: contractId };
    if (type)   filter.type   = type;
    if (status) filter.status = status;

    const invoices = await Invoice.find(filter)
      .populate({
        path: "incidentId",
        populate: { path: "assignedStaff", select: "name role" }
      })
      .populate("confirmedBy", "name role")
      .sort({ createdAt: -1 })
      .lean(); // lean để tăng tốc độ đọc

    res.json(invoices);
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message || "Lỗi server." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 4. Lấy chi tiết 1 hóa đơn
// ─────────────────────────────────────────────────────────────────────────────
/**
 * GET /api/invoices/:id
 */
const getInvoiceById = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id)
      .populate({
        path: "incidentId",
        populate: { path: "assignedStaff", select: "name role" }
      })
      .populate("confirmedBy", "name role")
      .lean();
    if (!invoice) return res.status(404).json({ message: "Không tìm thấy hóa đơn." });

    // Kiểm tra quyền qua contract cha
    await getContractOrFail(invoice.contract, req.user);

    res.json(invoice);
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message || "Lỗi server." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 4b. Lấy hóa đơn của tenant (dành cho người thuê)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * GET /api/invoices/my
 * Quyền: tenant
 */
const getMyInvoices = async (req, res) => {
  try {
    const invoices = await Invoice.find({ 
      tenantId: req.user._id, 
      sentAt: { $ne: null } 
    })
    .populate({
      path: 'contract',
      populate: { path: 'room', select: 'name address' }
    })
    .populate({
      path: "incidentId",
      populate: { path: "assignedStaff", select: "name role" }
    })
    .populate("confirmedBy", "name role")
    .sort({ createdAt: -1 })
    .lean();

    res.json(invoices);
  } catch (err) {
    res.status(500).json({ message: err.message || "Lỗi server." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 4c. Thanh toán hóa đơn (dành cho người thuê)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * POST /api/invoices/:id/pay
 * Quyền: tenant
 */
const payInvoice = async (req, res) => {
  try {
    if (req.user.role !== "tenant") {
      return res.status(403).json({ message: "Chỉ người thuê mới có quyền thanh toán." });
    }

    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) return res.status(404).json({ message: "Không tìm thấy hóa đơn." });

    if (invoice.tenantId?.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Bạn không có quyền thanh toán hóa đơn này." });
    }

    if (invoice.status === "paid") {
      return res.status(400).json({ message: "Hóa đơn này đã được thanh toán." });
    }

    invoice.status = "paid";
    await invoice.save(); // pre-save hook will set paidAt

    res.json(invoice);
  } catch (err) {
    res.status(500).json({ message: err.message || "Lỗi server." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 5. Cập nhật trạng thái hóa đơn (admin only)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * PATCH /api/invoices/:id/status
 * Body: { status: "paid" | "unpaid" | "overdue" }
 */
const updateInvoiceStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!["unpaid", "pending", "paid", "overdue"].includes(status)) {
      return res.status(400).json({ message: "Trạng thái không hợp lệ." });
    }

    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) return res.status(404).json({ message: "Không tìm thấy hóa đơn." });

    invoice.status = status;
    await invoice.save(); // kích hoạt pre("save") → tự set paidAt

    res.json(invoice);
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message || "Lỗi server." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 6. Lấy TẤT CẢ hóa đơn (admin + staff – server-side filtering & pagination)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * GET /api/invoices/all?page=1&limit=9&search=&type=&paymentMethod=&status=&fromDate=&toDate=&sortBy=createdAt&sortOrder=desc
 * Quyền: admin, staff
 */
const getAllInvoices = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 9,
      search = "",
      type = "",
      paymentMethod = "",
      status = "",
      fromDate = "",
      toDate = "",
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.max(1, Math.min(100, parseInt(limit)));

    const filter = {};

    // Staff: chỉ lấy invoices thuộc contracts trong district
    if (req.user.role === "staff") {
      const rooms = await Room.find({
        district: { $in: req.user.managedDistricts || [] },
      }).select("_id");
      const roomIds = rooms.map((r) => r._id);
      const contractIds = await Contract.find({ room: { $in: roomIds } }).distinct("_id");
      filter.contract = { $in: contractIds };
    }

    // Filter theo type
    if (type) filter.type = type;

    // Filter theo paymentMethod
    if (paymentMethod) filter.paymentMethod = paymentMethod;

    // Filter theo status
    if (status) filter.status = status;

    // Filter theo ngày xuất (createdAt)
    if (fromDate || toDate) {
      filter.createdAt = {};
      if (fromDate) filter.createdAt.$gte = new Date(fromDate);
      if (toDate) {
        const endOfDay = new Date(toDate);
        endOfDay.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = endOfDay;
      }
    }

    // Search: tìm theo representativeName, representativePhone, roomName, _id
    if (search.trim()) {
      const searchRegex = new RegExp(search.trim(), "i");
      const orConditions = [
        { representativeName: searchRegex },
        { representativePhone: searchRegex },
        { roomName: searchRegex },
      ];

      // Thử tìm theo _id (mã hóa đơn)
      if (search.trim().length >= 3) {
        orConditions.push({
          $expr: {
            $regexMatch: {
              input: { $toString: "$_id" },
              regex: search.trim(),
              options: "i"
            }
          }
        });
      }

      // Nếu đã có filter khác, wrap bằng $and
      if (Object.keys(filter).length > 0) {
        const existingFilter = { ...filter };
        // Clear filter
        Object.keys(filter).forEach((k) => delete filter[k]);
        filter.$and = [existingFilter, { $or: orConditions }];
      } else {
        filter.$or = orConditions;
      }
    }

    // Sort
    const allowedSortFields = ["createdAt", "totalAmount", "dueDate"];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : "createdAt";
    const sortDir = sortOrder === "asc" ? 1 : -1;

    // Query với pagination
    const total = await Invoice.countDocuments(filter);
    const totalPages = Math.ceil(total / limitNum);

    const invoices = await Invoice.find(filter)
      .sort({ [sortField]: sortDir })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .populate({
        path: "incidentId",
        populate: { path: "assignedStaff", select: "name role" }
      })
      .populate("confirmedBy", "name role")
      .lean();

    res.json({
      data: invoices,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message || "Lỗi server." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 6b. Thống kê hóa đơn (dashboard)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * GET /api/invoices/stats
 * Quyền: admin, staff
 */
const getInvoiceStats = async (req, res) => {
  try {
    const filter = {};

    // Staff: chỉ tính invoices thuộc contracts trong district
    if (req.user.role === "staff") {
      const rooms = await Room.find({
        district: { $in: req.user.managedDistricts || [] },
      }).select("_id");
      const roomIds = rooms.map((r) => r._id);
      const contractIds = await Contract.find({ room: { $in: roomIds } }).distinct("_id");
      filter.contract = { $in: contractIds };
    }

    const [totalInvoices, paid, unpaid, pending, overdue, revenueAgg] =
      await Promise.all([
        Invoice.countDocuments(filter),
        Invoice.countDocuments({ ...filter, status: "paid" }),
        Invoice.countDocuments({ ...filter, status: "unpaid" }),
        Invoice.countDocuments({ ...filter, status: "pending" }),
        Invoice.countDocuments({ ...filter, status: "overdue" }),
        Invoice.aggregate([
          { $match: filter },
          { $group: { _id: null, total: { $sum: "$totalAmount" } } },
        ]),
      ]);

    const expectedRevenue = revenueAgg.length > 0 ? revenueAgg[0].total : 0;

    res.json({
      totalInvoices,
      paid,
      unpaid,
      pending,
      overdue,
      expectedRevenue,
    });
  } catch (err) {
    console.error("Lỗi lấy thống kê hóa đơn:", err);
    res.status(500).json({ message: "Lỗi server khi lấy thống kê hóa đơn." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 7. Gửi hoá đơn cho tenant (admin only) + tạo notification realtime
// ─────────────────────────────────────────────────────────────────────────────
/**
 * POST /api/invoices/:id/send
 * Quyền: admin
 */
const sendInvoice = async (req, res) => {
  try {
    // 1. Kiểm tra quyền (admin + staff)
    if (req.user.role !== "admin" && req.user.role !== "staff") {
      return res.status(403).json({ message: "Bạn không có quyền gửi hoá đơn." });
    }

    // 2. Tìm invoice
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) {
      return res.status(404).json({ message: "Không tìm thấy hoá đơn." });
    }

    // 3. Nếu đã gửi rồi thì trả về success (idempotent)
    if (invoice.sentAt) {
      return res.json({ success: true, alreadySent: true });
    }

    // 4. Populate contract để lấy tenantId từ DB (KHÔNG từ request body)
    const contract = await Contract.findById(invoice.contract);
    if (!contract) {
      return res.status(404).json({ message: "Không tìm thấy hợp đồng liên kết." });
    }

    const tenantId = contract.tenant;

    // 5. Cập nhật invoice: đánh dấu đã gửi + lưu tenantId snapshot
    invoice.sentAt   = new Date();
    invoice.tenantId = tenantId;
    await invoice.save();

    // 6. Gửi notification (in-app + email) cho tenant qua dispatcher
    try {
      const tenantNotifs = await notifyTenantInvoiceSent(invoice);
      const io = req.app.get("io");
      if (io && tenantNotifs && tenantNotifs.length > 0) {
        tenantNotifs.forEach((n) => sendSocketNotification(io, "new_notification", n));
      }
    } catch (notifyErr) {
      console.error("notifyTenantInvoiceSent error:", notifyErr.message);
    }

    res.json({ success: true });
  } catch (err) {
    console.error("sendInvoice error:", err);
    res.status(err.status || 500).json({ 
      message: err.message || "Lỗi server." 
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 8. Cập nhật hoá đơn (admin only) - CHỈ KHI CHƯA GỬI
// ─────────────────────────────────────────────────────────────────────────────
/**
 * PUT /api/invoices/:id
 * Quyền: admin
 */
const updateInvoice = async (req, res) => {
  try {
    if (req.user.role !== "admin" && req.user.role !== "staff") {
      return res.status(403).json({ message: "Bạn không có quyền cập nhật hoá đơn." });
    }

    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) return res.status(404).json({ message: "Không tìm thấy hoá đơn." });

    if (invoice.sentAt) {
      return res.status(400).json({ message: "Không thể sửa hoá đơn đã được gửi đi." });
    }

    if (invoice.type === "service") {
      const { month, year, electricity, water, extraFees, dueDate, notes } = req.body;
      if (month) invoice.month = month;
      if (year) invoice.year = year;
      if (electricity) invoice.electricity = electricity;
      if (water) invoice.water = water;
      if (extraFees) invoice.extraFees = extraFees;
      if (dueDate !== undefined) invoice.dueDate = dueDate;
      if (notes !== undefined) invoice.notes = notes;
    } else {
      const { dueDate, notes } = req.body;
      if (dueDate !== undefined) invoice.dueDate = dueDate;
      if (notes !== undefined) invoice.notes = notes;
    }

    await invoice.save();
    res.json(invoice);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: `Hóa đơn tháng này đã tồn tại.` });
    }
    res.status(err.status || 500).json({ message: err.message || "Lỗi server." });
  }
};

// ───────────────────────────────────────────────────────────────────────────────
// 9. Tenant yêu cầu thanh toán tiền mặt
// ───────────────────────────────────────────────────────────────────────────────
/**
 * PUT /api/invoices/:id/request-cash-payment
 * Quyền: tenant
 */
const requestCashPayment = async (req, res) => {
  try {
    // 1. Kiểm tra role tenant
    if (req.user.role !== "tenant") {
      return res.status(403).json({ message: "Chỉ người thuê mới có quyền yêu cầu thanh toán tiền mặt." });
    }

    // 2. Tìm invoice
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) {
      return res.status(404).json({ message: "Không tìm thấy hóa đơn." });
    }

    // 3. Kiểm tra invoice thuộc tenant này
    if (invoice.tenantId?.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Bạn không có quyền thao tác hóa đơn này." });
    }

    // 4. Kiểm tra trạng thái hợp lệ
    if (invoice.status === "paid") {
      return res.status(400).json({ message: "Hóa đơn này đã được thanh toán." });
    }
    if (invoice.status === "pending") {
      return res.status(400).json({ message: "Hóa đơn này đang chờ thu tiền mặt." });
    }

    // 5. Cập nhật trạng thái
    invoice.status = "pending";
    invoice.paymentMethod = "Cash";
    await invoice.save();

    // 6. Emit Socket.IO cho admin/staff
    const io = req.app.get("io");
    if (io) {
      const contract = await Contract.findById(invoice.contract).populate("room", "name district");
      const eventData = {
        invoiceId: invoice._id,
        roomName: invoice.roomName,
        representativeName: invoice.representativeName,
        totalAmount: invoice.totalAmount,
        district: contract?.room?.district || "",
      };

      // Gửi cho admin
      io.to("admin_room").emit("cash_payment_requested", eventData);

      // Gửi cho staff quản lý district của phòng này
      if (contract?.room?.district) {
        io.to(`district_${contract.room.district}`).emit("cash_payment_requested", eventData);
      }
    }

    // 7. Trả response
    res.json({
      success: true,
      message: "Vui lòng liên hệ với quản lý khu vực để thanh toán",
      invoice,
    });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message || "Lỗi server." });
  }
};

// ───────────────────────────────────────────────────────────────────────────────
// 10. Staff/Admin xác nhận thu tiền mặt
// ───────────────────────────────────────────────────────────────────────────────
/**
 * PUT /api/invoices/:id/collect-cash
 * Quyền: admin, staff
 */
const collectCash = async (req, res) => {
  try {
    // 1. Tìm invoice và populate room để kiểm tra district
    const invoice = await Invoice.findById(req.params.id).populate({
      path: "contract",
      populate: { path: "room", select: "district name" },
    });

    if (!invoice) {
      return res.status(404).json({ message: "Không tìm thấy hóa đơn." });
    }

    // 2. Kiểm tra trạng thái phải là pending
    if (invoice.status !== "pending") {
      return res.status(400).json({ message: "Hóa đơn không ở trạng thái chờ thu tiền mặt." });
    }

    // 3. Staff: kiểm tra district permission
    const district = invoice.contract?.room?.district;
    if (req.user.role === "staff") {
      if (!district || !checkUserDistrictPermission(req.user, district)) {
        return res.status(403).json({ message: "Khu vực của hóa đơn này không thuộc thẩm quyền quản lý của bạn." });
      }
    }

    // 4. Cập nhật hóa đơn
    invoice.status = "paid";
    invoice.paidAt = new Date();
    invoice.confirmedBy = req.user._id;
    await invoice.save();

    // 5. Tạo Payment record lưu vết
    await Payment.create({
      invoice: invoice._id,
      contract: invoice.contract?._id || invoice.contract,
      tenant: invoice.tenantId,
      paymentMethod: "cash",
      amount: invoice.totalAmount,
      status: "success",
      paidAt: new Date(),
      cash: {
        receivedBy: req.user._id,
        note: req.body.note || "Thu tiền mặt trực tiếp",
      },
    });

    // 6. Tạo Notification + gửi email cho tenant (qua dispatcher → có cả in-app lẫn email)
    const notifs = await notifyTenantInvoicePaid(invoice);

    // 7. Emit Socket.IO cho tenant
    const io = req.app.get("io");
    if (io && invoice.tenantId) {
      io.to(`tenant_${invoice.tenantId.toString()}`).emit("invoice_paid", {
        invoiceId: invoice._id,
        status: "paid",
        paymentMethod: "Cash",
        paidAt: invoice.paidAt,
        message: "Hóa đơn của bạn đã được xác nhận thanh toán",
      });

      if (notifs.length > 0) {
        io.to(`tenant_${invoice.tenantId.toString()}`).emit("new_notification", notifs[0]);
      }
    }

    // 8. Báo cho staff khu vực + admin biết hoá đơn đã thanh toán (tránh đòi tiền trùng)
    const staffNotifs = await notifyInvoicePaid(invoice);
    if (io && staffNotifs.length > 0) {
      staffNotifs.forEach((n) => sendSocketNotification(io, "new_notification", n));
    }

    res.json({
      success: true,
      message: "Xác nhận thu tiền mặt thành công",
      invoice,
    });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message || "Lỗi server." });
  }
};

module.exports = {
  createDepositInvoice,
  createServiceInvoice,
  getInvoices,
  getInvoiceById,
  getMyInvoices,
  payInvoice,
  updateInvoiceStatus,
  getAllInvoices,
  getInvoiceStats,
  sendInvoice,
  updateInvoice,
  requestCashPayment,
  collectCash,
};
