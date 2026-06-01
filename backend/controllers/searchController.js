const Room = require("../models/Room");
const User = require("../models/User");
const Contract = require("../models/Contract");
const Invoice = require("../models/Invoice");
const Appointment = require("../models/Appointment");

// ─────────────────────────────────────────────────────────────────────────────
// Global Search — Tìm kiếm trên 5 collections
// ─────────────────────────────────────────────────────────────────────────────
/**
 * GET /api/search?q=keyword
 * Quyền: admin, staff (đã protect + verifyRole ở route)
 * Staff: tự động filter theo managedDistricts (req.districtFilter)
 *
 * Trả về tối đa 5 kết quả mỗi loại:
 * { rooms: [...], tenants: [...], contracts: [...], invoices: [...], appointments: [...] }
 */
const globalSearch = async (req, res) => {
  try {
    const { q } = req.query;

    // Validate: query phải có ít nhất 2 ký tự
    if (!q || q.trim().length < 2) {
      return res.json({
        rooms: [],
        tenants: [],
        contracts: [],
        invoices: [],
        appointments: [],
      });
    }

    // Tạo regex tìm kiếm (case-insensitive)
    const searchRegex = new RegExp(q.trim(), "i");
    const limit = 5;

    // District filter từ middleware injectDistrictFilter
    const districtFilter = req.districtFilter || {};

    // ── 1. Tìm phòng ──────────────────────────────────────────────────────
    const roomFilter = {
      $or: [
        { name: searchRegex },
        { address: searchRegex },
        { district: searchRegex },
      ],
      ...districtFilter,
    };
    const rooms = await Room.find(roomFilter)
      .select("name address district price status images")
      .limit(limit)
      .lean();

    // ── 2. Tìm tenant (khách thuê) ────────────────────────────────────────
    const tenantFilter = {
      role: "tenant",
      isActive: true,
      $or: [
        { name: searchRegex },
        { email: searchRegex },
        { phone: searchRegex },
      ],
    };
    const tenants = await User.find(tenantFilter)
      .select("name email phone avatar")
      .limit(limit)
      .lean();

    // ── 3. Tìm hợp đồng ──────────────────────────────────────────────────
    // Populate room để filter theo district cho staff
    const contractsRaw = await Contract.find({
      $or: [
        { representativeName: searchRegex },
        { status: searchRegex },
      ],
    })
      .populate("room", "name district")
      .populate("tenant", "name email")
      .select("representativeName status startDate endDate room tenant")
      .sort({ createdAt: -1 })
      .limit(limit * 2) // lấy nhiều hơn rồi filter district
      .lean();

    // Filter theo district nếu là staff
    let contracts = contractsRaw;
    if (districtFilter.district) {
      const allowedDistricts = districtFilter.district.$in || [];
      contracts = contractsRaw.filter(
        (c) => c.room && allowedDistricts.includes(c.room.district)
      );
    }
    contracts = contracts.slice(0, limit);

    // ── 4. Tìm hóa đơn ───────────────────────────────────────────────────
    const invoicesRaw = await Invoice.find({
      $or: [
        { roomName: searchRegex },
        { representativeName: searchRegex },
      ],
    })
      .populate({
        path: "contract",
        select: "room",
        populate: { path: "room", select: "district" },
      })
      .select("roomName representativeName totalAmount status type month year")
      .sort({ createdAt: -1 })
      .limit(limit * 2)
      .lean();

    // Filter theo district nếu là staff
    let invoices = invoicesRaw;
    if (districtFilter.district) {
      const allowedDistricts = districtFilter.district.$in || [];
      invoices = invoicesRaw.filter(
        (inv) =>
          inv.contract &&
          inv.contract.room &&
          allowedDistricts.includes(inv.contract.room.district)
      );
    }
    invoices = invoices.slice(0, limit);

    // ── 5. Tìm lịch hẹn ──────────────────────────────────────────────────
    const appointmentFilter = {
      $or: [
        { name: searchRegex },
        { phone: searchRegex },
        { district: searchRegex },
      ],
      ...districtFilter,
    };
    const appointments = await Appointment.find(appointmentFilter)
      .populate("room", "name")
      .select("name phone date time status room district")
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    res.json({
      rooms,
      tenants,
      contracts,
      invoices,
      appointments,
    });
  } catch (err) {
    console.error("Search error:", err);
    res.status(500).json({ message: err.message || "Lỗi tìm kiếm." });
  }
};

module.exports = { globalSearch };
