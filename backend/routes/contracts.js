const express = require("express");
const router = express.Router();
const Contract = require("../models/Contract");
const Room = require("../models/Room");
const Invoice = require("../models/Invoice");
const { protect, adminOnly, verifyRole, injectDistrictFilter } = require("../middleware/auth");
const { signContract, clearSignature } = require("../controllers/contractController");

// ─── Helper: lấy roomIds thuộc district của staff ────────────────────────────
const getDistrictRoomIds = async (user) => {
  if (user.role === "admin") return null; // null = không filter
  const rooms = await Room.find({
    district: { $in: user.managedDistricts || [] },
  }).select("_id");
  return rooms.map((r) => r._id);
};

// GET /api/contracts — tất cả hợp đồng (admin + staff)
router.get("/", protect, verifyRole("admin", "staff"), async (req, res) => {
  try {
    const filter = {};

    // Staff: chỉ thấy contracts thuộc rooms trong district
    if (req.user.role === "staff") {
      const roomIds = await getDistrictRoomIds(req.user);
      filter.room = { $in: roomIds };
    }

    const contracts = await Contract.find(filter)
      .populate("room", "name address price area type district")
      .populate("tenant", "name email phone")
      .sort({ createdAt: -1 });
    res.json(contracts);
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
router.post("/", protect, verifyRole("admin", "staff"), async (req, res) => {
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
        await Invoice.create({
          contract:            contract._id,
          type:                "deposit",
          representativeName:  contract.representativeName,
          representativePhone: contract.representativePhone,
          roomName:            contract.room.name,
          rentAmount:          contract.monthlyRent,
          depositAmount:       contract.depositAmount || contract.monthlyRent,
          dueDate:             contract.startDate,
          notes:               "Hóa đơn đặt cọc tự động khi phê duyệt hợp đồng.",
          createdBy:           req.user._id,
        });
      }
    }

    // ── Khi chấm dứt / hết hạn → trả phòng về available ─────────────────────
    if (req.body.status === "terminated" || req.body.status === "expired") {
      await Room.findByIdAndUpdate(contract.room._id, { status: "available" });
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
