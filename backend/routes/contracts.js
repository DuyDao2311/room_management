const express = require("express");
const router = express.Router();
const Contract = require("../models/Contract");
const Room = require("../models/Room");
const Invoice = require("../models/Invoice");
const User = require("../models/User");
const { protect, adminOnly, verifyRole, injectDistrictFilter } = require("../middleware/auth");
const { signContract, clearSignature } = require("../controllers/contractController");
const {
  notifyNewContract,
  notifyTenantContractApproved,
  notifyTenantContractEnded,
  sendSocketNotification,
} = require("../utils/notificationService");

// ─── Helper: lấy roomIds thuộc district của staff ────────────────────────────
const getDistrictRoomIds = async (user) => {
  if (user.role === "admin") return null; // null = không filter
  const rooms = await Room.find({
    district: { $in: user.managedDistricts || [] },
  }).select("_id");
  return rooms.map((r) => r._id);
};

// GET /api/contracts/stats — Lấy thống kê hợp đồng
router.get("/stats", protect, verifyRole("admin", "staff"), async (req, res) => {
  try {
    const filter = {};
    if (req.user.role === "staff") {
      const roomIds = await getDistrictRoomIds(req.user);
      filter.room = { $in: roomIds };
    }

    const now = new Date();
    const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    
    // 30 ngày tới
    const next30Days = new Date(now);
    next30Days.setDate(next30Days.getDate() + 30);

    const [
      totalContracts,
      totalUpToLastMonth,
      newThisMonth,
      newLastMonth,
      expiringSoon,
      terminated
    ] = await Promise.all([
      Contract.countDocuments(filter),
      Contract.countDocuments({ ...filter, startDate: { $lte: endOfLastMonth } }),
      Contract.countDocuments({ ...filter, startDate: { $gte: startOfThisMonth } }),
      Contract.countDocuments({ ...filter, startDate: { $gte: startOfLastMonth, $lte: endOfLastMonth } }),
      Contract.countDocuments({ ...filter, status: "active", endDate: { $gte: now, $lte: next30Days } }),
      Contract.countDocuments({ ...filter, status: "terminated" })
    ]);

    let growthPercent = 0;
    if (totalUpToLastMonth > 0) {
      growthPercent = ((totalContracts - totalUpToLastMonth) / totalUpToLastMonth) * 100;
    } else if (totalUpToLastMonth === 0 && totalContracts > 0) {
      growthPercent = 100;
    }
    
    const newPercentOfTotal = totalContracts > 0 ? (newThisMonth / totalContracts) * 100 : 0;

    res.json({
      totalContracts,
      growthPercent: parseFloat(growthPercent.toFixed(1)),
      newThisMonth,
      newPercentOfTotal: parseFloat(newPercentOfTotal.toFixed(1)),
      expiringSoon,
      terminated
    });
  } catch (error) {
    console.error("Lỗi lấy thống kê hợp đồng:", error);
    res.status(500).json({ message: "Lỗi server khi lấy thống kê hợp đồng." });
  }
});

// GET /api/contracts — tất cả hợp đồng (admin + staff)
// Hỗ trợ: ?page=1&limit=9&search=&district=&status=&fromDate=&toDate=
router.get("/", protect, verifyRole("admin", "staff"), async (req, res) => {
  try {
    const {
      page = 1,
      limit = 9,
      search = "",
      district = "",
      status = "",
      fromDate = "",
      toDate = "",
    } = req.query;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.max(1, Math.min(100, parseInt(limit)));

    // ── 1. Xây dựng danh sách roomIds hợp lệ (kết hợp district filter + role) ──

    // 1a. Room filter theo district
    const roomQuery = {};
    if (district) {
      // Staff: validate district thuộc managedDistricts
      if (req.user.role === "staff") {
        if (
          !req.user.managedDistricts ||
          !req.user.managedDistricts.includes(district)
        ) {
          return res.status(403).json({
            message: "Bạn không có quyền xem hợp đồng thuộc khu vực này.",
          });
        }
        roomQuery.district = district;
      } else {
        // Admin: cho phép mọi district
        roomQuery.district = district;
      }
    } else if (req.user.role === "staff") {
      // Staff không truyền district → filter theo tất cả managed districts
      roomQuery.district = { $in: req.user.managedDistricts || [] };
    }

    // 1b. Search: tìm room theo name
    let searchRoomIds = null;
    let searchTenantIds = null;

    if (search.trim()) {
      const searchRegex = new RegExp(search.trim(), "i");

      // Tìm rooms match theo name
      const matchedRooms = await Room.find({
        ...roomQuery,
        name: searchRegex,
      }).select("_id");
      searchRoomIds = matchedRooms.map((r) => r._id);

      // Tìm tenants match theo name, email, phone
      const matchedUsers = await User.find({
        $or: [
          { name: searchRegex },
          { email: searchRegex },
          { phone: searchRegex },
        ],
      }).select("_id");
      searchTenantIds = matchedUsers.map((u) => u._id);
    }

    // ── 2. Xây dựng contract filter ──────────────────────────────────────────

    const filter = {};

    // 2a. Room filter (district-based)
    if (Object.keys(roomQuery).length > 0 && !search.trim()) {
      // Có district filter nhưng không search → lấy roomIds theo district
      const districtRooms = await Room.find(roomQuery).select("_id");
      filter.room = { $in: districtRooms.map((r) => r._id) };
    } else if (!search.trim() && req.user.role === "staff") {
      // Staff không filter cụ thể → dùng managed districts
      const roomIds = await getDistrictRoomIds(req.user);
      filter.room = { $in: roomIds };
    }

    // 2b. Search: kết hợp room name + tenant name/email/phone + representativeName
    if (search.trim()) {
      const searchRegex = new RegExp(search.trim(), "i");
      const orConditions = [];

      if (searchRoomIds && searchRoomIds.length > 0) {
        orConditions.push({ room: { $in: searchRoomIds } });
      }
      if (searchTenantIds && searchTenantIds.length > 0) {
        orConditions.push({ tenant: { $in: searchTenantIds } });
      }
      // Tìm theo representativeName trực tiếp trên Contract
      orConditions.push({ representativeName: searchRegex });
      // Tìm theo representativePhone
      orConditions.push({ representativePhone: searchRegex });

      if (orConditions.length > 0) {
        filter.$or = orConditions;
      }

      // Vẫn phải enforce district cho staff khi search
      if (req.user.role === "staff" && !district) {
        const staffRoomIds = await getDistrictRoomIds(req.user);
        filter.room = filter.room
          ? { $in: filter.room.$in.filter((id) => staffRoomIds.some((sid) => sid.equals(id))) }
          : { $in: staffRoomIds };
        // Khi có $or, cần wrap lại bằng $and để kết hợp room filter
        if (filter.$or) {
          const orPart = filter.$or;
          delete filter.$or;
          filter.$and = [
            { room: { $in: staffRoomIds } },
            { $or: orPart },
          ];
        }
      } else if (district) {
        // Có district cụ thể → lấy rooms theo district đó
        const districtRooms = await Room.find(roomQuery).select("_id");
        const districtRoomIds = districtRooms.map((r) => r._id);
        if (filter.$or) {
          const orPart = filter.$or;
          delete filter.$or;
          filter.$and = [
            { room: { $in: districtRoomIds } },
            { $or: orPart },
          ];
        }
      }
    }

    // 2c. Status filter
    if (status) {
      filter.status = status;
    }

    // 2d. Date range filter (endDate)
    if (fromDate || toDate) {
      filter.endDate = {};
      if (fromDate) {
        filter.endDate.$gte = new Date(fromDate);
      }
      if (toDate) {
        // Đặt toDate cuối ngày để bao gồm cả ngày đó
        const endOfDay = new Date(toDate);
        endOfDay.setHours(23, 59, 59, 999);
        filter.endDate.$lte = endOfDay;
      }
    }

    // ── 3. Query với pagination ──────────────────────────────────────────────

    const total = await Contract.countDocuments(filter);
    const totalPages = Math.ceil(total / limitNum);

    const contracts = await Contract.find(filter)
      .populate("room", "name address price area type district")
      .populate("tenant", "name email phone")
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum);

    // ── 4. Response ─────────────────────────────────────────────────────────

    res.json({
      data: contracts,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages,
      },
    });
  } catch (err) {
    console.error("Get contracts error:", err);
    res.status(500).json({ message: "Lỗi server." });
  }
});

// GET /api/contracts/my — hợp đồng của tenant hiện tại
router.get("/my", protect, async (req, res) => {
  try {
    const contracts = await Contract.find({ tenant: req.user._id })
      .populate("room", "name address price area type images amenities floor")
      .sort({ createdAt: -1 });
    res.json(contracts);
  } catch (err) {
    res.status(500).json({ message: "Lỗi server." });
  }
});

// GET /api/contracts/:id — chi tiết hợp đồng
router.get("/:id", protect, async (req, res) => {
  try {
    const contract = await Contract.findById(req.params.id)
      .populate("room", "name address price district")
      .populate("tenant", "name email phone");

    if (!contract) return res.status(404).json({ message: "Không tìm thấy hợp đồng." });

    // Tenant chỉ xem được hợp đồng của mình
    if (
      req.user.role === "tenant" &&
      contract.tenant._id.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({ message: "Không có quyền truy cập." });
    }

    // Staff chỉ xem được hợp đồng thuộc district
    if (req.user.role === "staff") {
      const roomDistrict = contract.room?.district || "";
      if (!req.user.managedDistricts || !req.user.managedDistricts.includes(roomDistrict)) {
        return res.status(403).json({ message: "Bạn không có quyền xem hợp đồng này." });
      }
    }

    res.json(contract);
  } catch (err) {
    res.status(500).json({ message: "Lỗi server." });
  }
});

// POST /api/contracts — tạo hợp đồng mới (admin + staff)
router.post("/", protect, verifyRole("admin", "staff", "tenant"), async (req, res) => {
  try {
    const {
      room: roomId, tenant, startDate, endDate, monthlyRent,
      depositAmount, notes,
      representativeName, representativePhone, representativeIdCard, representativeDob,
      coResidents,
      // ── Chữ ký Bên B (tenant ký ngay khi đăng ký) ──────────────
      signatureB, isSignedByTenant,
    } = req.body;

    if (!roomId || !tenant || !startDate || !endDate || !monthlyRent) {
      return res.status(400).json({ message: "Vui lòng nhập đầy đủ thông tin bắt buộc." });
    }

    // Validate định dạng base64 nếu có chữ ký Bên B
    if (signatureB && !signatureB.startsWith("data:image/png;base64,")) {
      return res.status(400).json({ message: "signatureB không đúng định dạng base64 PNG." });
    }

    // Kiểm tra phòng còn trống không
    const room = await Room.findById(roomId);
    if (!room) return res.status(404).json({ message: "Không tìm thấy phòng." });
    if (room.status !== "available") {
      return res.status(400).json({ message: "Phòng này hiện không còn trống." });
    }

    // Staff: kiểm tra phòng thuộc district
    if (req.user.role === "staff") {
      if (!req.user.managedDistricts || !req.user.managedDistricts.includes(room.district)) {
        return res.status(403).json({ message: "Bạn không có quyền tạo hợp đồng cho phòng này." });
      }
    }

    // Tạo hợp đồng — status mặc định "pending", admin sẽ phê duyệt sau
    const contract = await Contract.create({
      room: roomId,
      tenant,
      startDate,
      endDate,
      monthlyRent,
      depositAmount: depositAmount || 0,
      notes: notes || "",
      representativeName: representativeName || "",
      representativePhone: representativePhone || "",
      representativeIdCard: representativeIdCard || "",
      representativeDob: representativeDob || "",
      coResidents: coResidents || [],
      createdBy: req.user._id,
      // ── Lưu chữ ký Bên B nếu tenant đã ký ──────────────────────────────
      signatureB: signatureB || "",
      isSignedByTenant: isSignedByTenant === true || !!signatureB,
    });

    // Cập nhật trạng thái phòng → occupied
    await Room.findByIdAndUpdate(roomId, { status: "occupied" });

    // Gửi thông báo đến staff/admin về hợp đồng mới
    const notifications = await notifyNewContract(contract);
    
    // Gửi qua Socket.io
    const io = req.app.get("io");
    if (io && notifications.length > 0) {
      notifications.forEach((notification) => {
        sendSocketNotification(io, "new_notification", notification);
      });
    }

    const populated = await contract.populate([
      { path: "room", select: "name address" },
      { path: "tenant", select: "name email" },
    ]);

    res.status(201).json(populated);
  } catch (err) {
    console.error("Create contract error:", err);
    res.status(500).json({ message: err.message || "Lỗi server." });
  }
});

// PUT /api/contracts/:id — cập nhật hợp đồng (admin + staff trong district)
router.put("/:id", protect, verifyRole("admin", "staff"), async (req, res) => {
  try {
    // Lấy contract trước khi update để kiểm tra trạng thái cũ
    const prevContract = await Contract.findById(req.params.id).populate("room", "district");
    if (!prevContract) return res.status(404).json({ message: "Không tìm thấy hợp đồng." });

    // Staff: kiểm tra hợp đồng thuộc district
    if (req.user.role === "staff") {
      const roomDistrict = prevContract.room?.district || "";
      if (!req.user.managedDistricts || !req.user.managedDistricts.includes(roomDistrict)) {
        return res.status(403).json({ message: "Bạn không có quyền cập nhật hợp đồng này." });
      }
    }

    const contract = await Contract.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    })
      .populate("room", "name address price district")
      .populate("tenant", "name email");

    // ── Khi admin/staff PHÊ DUYỆT hợp đồng (pending → active) ──────────────────────
    if (prevContract.status === "pending" && req.body.status === "active") {
      // Cập nhật trạng thái phòng → occupied
      await Room.findByIdAndUpdate(contract.room._id, { status: "occupied" });

      // Tự động tạo hóa đơn deposit nếu chưa có
      const hasDeposit = await Invoice.findOne({ contract: contract._id, type: "deposit" });
      if (!hasDeposit) {
        // Hạn thanh toán = ngày phê duyệt + 1 ngày
        const depositDueDate = new Date();
        depositDueDate.setDate(depositDueDate.getDate() + 1);

        await Invoice.create({
          contract:            contract._id,
          type:                "deposit",
          representativeName:  contract.representativeName,
          representativePhone: contract.representativePhone,
          roomName:            contract.room.name,
          rentAmount:          contract.monthlyRent,
          depositAmount:       contract.depositAmount || contract.monthlyRent,
          dueDate:             depositDueDate,
          notes:               "Hóa đơn đặt cọc tự động khi phê duyệt hợp đồng.",
          createdBy:           req.user._id,
        });
      }

      // Gửi notification (email + in-app) cho tenant về việc hợp đồng được duyệt.
      try {
        const tenantNotifs = await notifyTenantContractApproved(contract);
        const io = req.app.get("io");
        if (io && tenantNotifs.length > 0) {
          tenantNotifs.forEach((n) => sendSocketNotification(io, "new_notification", n));
        }
      } catch (notifyErr) {
        // KHÔNG để lỗi notify chặn response — log và tiếp tục.
        console.error("notifyTenantContractApproved error:", notifyErr.message);
      }
    }

    // ── Khi chấm dứt / hết hạn → trả phòng về available + email tenant ─────
    if (req.body.status === "terminated" || req.body.status === "expired") {
      await Room.findByIdAndUpdate(contract.room._id, { status: "available" });

      try {
        const tenantNotifs = await notifyTenantContractEnded(contract, { reason: req.body.status });
        const io = req.app.get("io");
        if (io && tenantNotifs.length > 0) {
          tenantNotifs.forEach((n) => sendSocketNotification(io, "new_notification", n));
        }
      } catch (notifyErr) {
        console.error("notifyTenantContractEnded error:", notifyErr.message);
      }
    }

    res.json(contract);
  } catch (err) {
    console.error("Update contract error:", err);
    res.status(500).json({ message: err.message || "Lỗi server." });
  }
});

// DELETE /api/contracts/:id — xóa hợp đồng (admin only - staff không được xóa)
router.delete("/:id", protect, adminOnly, async (req, res) => {
  try {
    const contract = await Contract.findById(req.params.id);
    if (!contract) return res.status(404).json({ message: "Không tìm thấy hợp đồng." });

    // Trả lại phòng nếu phòng đang occupied bởi hợp đồng này
    // (thực ra khi chấm dứt đã trả rồi, nhưng để đề phòng)
    if (contract.status === "active" || contract.status === "pending") {
      await Room.findByIdAndUpdate(contract.room, { status: "available" });
    }

    // Xóa tất cả hóa đơn liên quan (tuỳ chọn, nhưng nên làm nếu có tham chiếu ràng buộc)
    await Invoice.deleteMany({ contract: contract._id });

    await Contract.findByIdAndDelete(req.params.id);
    res.json({ message: "Đã xóa hợp đồng thành công." });
  } catch (err) {
    console.error("Delete contract error:", err);
    res.status(500).json({ message: "Lỗi server khi xóa hợp đồng." });
  }
});

// ─────────────────────────────────────────────────────────────
// Chữ ký điện tử
// ─────────────────────────────────────────────────────────────

/**
 * POST /api/contracts/:id/sign
 * Lưu chữ ký của một hoặc cả hai bên
 * Body: { signatureA?: string, signatureB?: string }  (base64 PNG)
 */
router.post("/:id/sign", protect, signContract);

/**
 * DELETE /api/contracts/:id/sign
 * Xóa chữ ký để cho phép ký lại
 * Body: { side: "A" | "B" }
 */
router.delete("/:id/sign", protect, clearSignature);

module.exports = router;
