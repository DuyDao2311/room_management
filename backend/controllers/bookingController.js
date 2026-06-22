const Booking = require("../models/Booking");
const Room = require("../models/Room");

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Calculate duration and price based on bookingType and room prices.
 * Frontend only sends: bookingType, checkInDateTime, checkOutDateTime
 */
function calculateBooking(bookingType, checkIn, checkOut, room) {
  const msIn = new Date(checkIn).getTime();
  const msOut = new Date(checkOut).getTime();

  if (msOut <= msIn) {
    throw new Error("Thời gian trả phòng phải sau thời gian nhận phòng.");
  }

  const diffMs = msOut - msIn;
  let totalHours = 0,
    totalDays = 0,
    totalWeeks = 0,
    totalMonths = 0;
  let unitPrice = 0,
    totalAmount = 0;

  switch (bookingType) {
    case "hour": {
      totalHours = Math.ceil(diffMs / (1000 * 60 * 60));
      if (totalHours < 1) throw new Error("Thời gian thuê tối thiểu 1 giờ.");
      unitPrice = room.hourlyPrice;
      totalAmount = totalHours * unitPrice;
      break;
    }
    case "day": {
      totalDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      if (totalDays < 1) throw new Error("Thời gian thuê tối thiểu 1 ngày.");
      unitPrice = room.dailyPrice;
      totalAmount = totalDays * unitPrice;
      break;
    }
    case "week": {
      totalWeeks = Math.ceil(diffMs / (1000 * 60 * 60 * 24 * 7));
      if (totalWeeks < 1) throw new Error("Thời gian thuê tối thiểu 1 tuần.");
      unitPrice = room.weeklyPrice;
      totalAmount = totalWeeks * unitPrice;
      break;
    }
    case "month": {
      // Calculate month difference
      const checkInDate = new Date(checkIn);
      const checkOutDate = new Date(checkOut);
      totalMonths =
        (checkOutDate.getFullYear() - checkInDate.getFullYear()) * 12 +
        (checkOutDate.getMonth() - checkInDate.getMonth());
      if (checkOutDate.getDate() > checkInDate.getDate()) totalMonths++;
      if (totalMonths < 1) totalMonths = 1;
      unitPrice = room.monthlyPrice;
      totalAmount = totalMonths * unitPrice;
      break;
    }
    default:
      throw new Error("Loại thuê không hợp lệ.");
  }

  if (unitPrice <= 0) {
    throw new Error(
      `Phòng chưa thiết lập giá cho loại thuê "${bookingType}".`
    );
  }

  return { totalHours, totalDays, totalWeeks, totalMonths, unitPrice, totalAmount };
}

/**
 * Check if a room is available for the given time range.
 * Excludes bookings with the given excludeId (for update scenarios).
 */
async function checkAvailability(roomId, checkIn, checkOut, excludeId = null) {
  const filter = {
    room: roomId,
    status: { $in: ["confirmed", "checked_in"] },
    checkInDateTime: { $lt: new Date(checkOut) },
    checkOutDateTime: { $gt: new Date(checkIn) },
  };
  if (excludeId) {
    filter._id = { $ne: excludeId };
  }
  const conflicting = await Booking.findOne(filter);
  return !conflicting;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONTROLLERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/bookings
 * Tenant creates a booking. Backend auto-calculates price.
 * After booking is created, paymentStatus = "pending" (tenant pays immediately on frontend).
 */
const createBooking = async (req, res) => {
  try {
    const { roomId, bookingType, checkInDateTime, checkOutDateTime, note } = req.body;

    if (!roomId || !bookingType || !checkInDateTime || !checkOutDateTime) {
      return res.status(400).json({
        message: "Vui lòng cung cấp đầy đủ: phòng, loại thuê, thời gian nhận/trả phòng.",
      });
    }

    // Validate room exists and is short_term
    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({ message: "Không tìm thấy phòng." });
    }
    if (room.rentalMode !== "short_term") {
      return res.status(400).json({
        message: "Phòng này chỉ hỗ trợ thuê dài hạn. Không thể đặt ngắn hạn.",
      });
    }

    // Check availability
    const available = await checkAvailability(roomId, checkInDateTime, checkOutDateTime);
    if (!available) {
      return res.status(409).json({
        message: "Phòng đã được đặt trong khoảng thời gian này. Vui lòng chọn thời gian khác.",
      });
    }

    // Calculate pricing
    const calc = calculateBooking(bookingType, checkInDateTime, checkOutDateTime, room);

    const booking = await Booking.create({
      room: roomId,
      tenant: req.user._id,
      bookingType,
      checkInDateTime: new Date(checkInDateTime),
      checkOutDateTime: new Date(checkOutDateTime),
      ...calc,
      paymentStatus: "pending",
      status: "pending",
      note: note || "",
    });

    // Cập nhật trạng thái phòng thành "occupied" ngay khi có người book
    await Room.findByIdAndUpdate(roomId, { status: "occupied" });

    const populated = await Booking.findById(booking._id)
      .populate("room", "name address type images hourlyPrice dailyPrice weeklyPrice monthlyPrice")
      .populate("tenant", "name email phone");

    res.status(201).json(populated);
  } catch (err) {
    console.error("Create booking error:", err);
    res.status(400).json({ message: err.message || "Không thể tạo booking." });
  }
};

/**
 * GET /api/bookings
 * Admin/Staff: all bookings (staff filtered by district)
 * Tenant: only their own bookings
 */
const getBookings = async (req, res) => {
  try {
    let filter = {};

    if (req.user.role === "tenant") {
      filter.tenant = req.user._id;
    } else if (req.user.role === "staff") {
      // Staff: only bookings for rooms in their managed districts
      const rooms = await Room.find({
        district: { $in: req.user.managedDistricts || [] },
      }).select("_id");
      filter.room = { $in: rooms.map((r) => r._id) };
    }
    // Admin: no filter (sees all)

    // Optional status filter
    if (req.query.status) {
      filter.status = req.query.status;
    }
    if (req.query.paymentStatus) {
      filter.paymentStatus = req.query.paymentStatus;
    }

    const bookings = await Booking.find(filter)
      .populate("room", "name address type district images hourlyPrice dailyPrice weeklyPrice monthlyPrice")
      .populate("tenant", "name email phone avatar")
      .sort({ createdAt: -1 });

    res.json(bookings);
  } catch (err) {
    console.error("Get bookings error:", err);
    res.status(500).json({ message: "Lỗi server." });
  }
};

/**
 * GET /api/bookings/:id
 */
const getBookingById = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate("room", "name address type district images hourlyPrice dailyPrice weeklyPrice monthlyPrice")
      .populate("tenant", "name email phone avatar");

    if (!booking) {
      return res.status(404).json({ message: "Không tìm thấy booking." });
    }

    // Tenant can only view their own
    if (
      req.user.role === "tenant" &&
      booking.tenant._id.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({ message: "Bạn không có quyền xem booking này." });
    }

    res.json(booking);
  } catch (err) {
    console.error("Get booking error:", err);
    res.status(500).json({ message: "Lỗi server." });
  }
};

/**
 * PUT /api/bookings/:id/confirm
 * Admin/Staff confirms a booking
 */
const confirmBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id).populate("room", "district");
    if (!booking) return res.status(404).json({ message: "Không tìm thấy booking." });

    if (booking.status !== "pending") {
      return res.status(400).json({
        message: `Không thể xác nhận booking ở trạng thái "${booking.status}".`,
      });
    }

    // Re-check availability before confirming
    const available = await checkAvailability(
      booking.room._id,
      booking.checkInDateTime,
      booking.checkOutDateTime,
      booking._id
    );
    if (!available) {
      return res.status(409).json({
        message: "Phòng đã được đặt bởi booking khác trong khoảng thời gian này.",
      });
    }

    booking.status = "confirmed";
    await booking.save();

    const populated = await Booking.findById(booking._id)
      .populate("room", "name address type images")
      .populate("tenant", "name email phone");

    res.json(populated);
  } catch (err) {
    console.error("Confirm booking error:", err);
    res.status(500).json({ message: "Lỗi server." });
  }
};

/**
 * PUT /api/bookings/:id/checkin
 */
const checkInBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: "Không tìm thấy booking." });

    if (booking.status !== "confirmed") {
      return res.status(400).json({
        message: `Không thể check-in. Booking phải ở trạng thái "confirmed". Hiện tại: "${booking.status}".`,
      });
    }

    booking.status = "checked_in";
    await booking.save();

    const populated = await Booking.findById(booking._id)
      .populate("room", "name address type images")
      .populate("tenant", "name email phone");

    res.json(populated);
  } catch (err) {
    console.error("Check-in error:", err);
    res.status(500).json({ message: "Lỗi server." });
  }
};

/**
 * PUT /api/bookings/:id/checkout
 */
const checkOutBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: "Không tìm thấy booking." });

    if (booking.status !== "checked_in") {
      return res.status(400).json({
        message: `Không thể check-out. Booking phải ở trạng thái "checked_in". Hiện tại: "${booking.status}".`,
      });
    }

    booking.status = "checked_out";
    await booking.save();

    // Trả lại phòng thành available khi checkout
    await Room.findByIdAndUpdate(booking.room, { status: "available" });

    const populated = await Booking.findById(booking._id)
      .populate("room", "name address type images")
      .populate("tenant", "name email phone");

    res.json(populated);
  } catch (err) {
    console.error("Check-out error:", err);
    res.status(500).json({ message: "Lỗi server." });
  }
};

/**
 * PUT /api/bookings/:id/cancel
 */
const cancelBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: "Không tìm thấy booking." });

    if (["checked_out", "cancelled"].includes(booking.status)) {
      return res.status(400).json({
        message: `Không thể hủy booking ở trạng thái "${booking.status}".`,
      });
    }

    booking.status = "cancelled";
    // If paid, mark as refunded
    if (booking.paymentStatus === "paid") {
      booking.paymentStatus = "refunded";
    }
    await booking.save();

    // Trả lại phòng thành available khi hủy
    await Room.findByIdAndUpdate(booking.room, { status: "available" });

    const populated = await Booking.findById(booking._id)
      .populate("room", "name address type images")
      .populate("tenant", "name email phone");

    res.json(populated);
  } catch (err) {
    console.error("Cancel booking error:", err);
    res.status(500).json({ message: "Lỗi server." });
  }
};

/**
 * PUT /api/bookings/:id/pay
 * Mark booking as paid (called after payment gateway success)
 */
const payBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: "Không tìm thấy booking." });

    if (booking.paymentStatus === "paid") {
      return res.status(400).json({ message: "Booking đã được thanh toán." });
    }
    if (booking.status === "cancelled") {
      return res.status(400).json({ message: "Không thể thanh toán booking đã bị hủy." });
    }

    booking.paymentStatus = "paid";
    // Auto-confirm when paid
    if (booking.status === "pending") {
      booking.status = "confirmed";
    }
    await booking.save();

    const populated = await Booking.findById(booking._id)
      .populate("room", "name address type images")
      .populate("tenant", "name email phone");

    res.json(populated);
  } catch (err) {
    console.error("Pay booking error:", err);
    res.status(500).json({ message: "Lỗi server." });
  }
};

/**
 * DELETE /api/bookings/:id
 * Admin only — hard delete
 */
const deleteBooking = async (req, res) => {
  try {
    const booking = await Booking.findByIdAndDelete(req.params.id);
    if (!booking) return res.status(404).json({ message: "Không tìm thấy booking." });
    res.json({ message: "Đã xóa booking thành công." });
  } catch (err) {
    console.error("Delete booking error:", err);
    res.status(500).json({ message: "Lỗi server." });
  }
};

/**
 * GET /api/rooms/:id/availability
 * Check if a room is available for a given time range
 */
const getRoomAvailability = async (req, res) => {
  try {
    const { checkInDateTime, checkOutDateTime } = req.query;
    if (!checkInDateTime || !checkOutDateTime) {
      return res.status(400).json({
        message: "Vui lòng cung cấp checkInDateTime và checkOutDateTime.",
      });
    }

    const available = await checkAvailability(
      req.params.id,
      checkInDateTime,
      checkOutDateTime
    );

    if (available) {
      res.json({ available: true });
    } else {
      res.json({
        available: false,
        message: "Phòng đã được đặt trong khoảng thời gian này.",
      });
    }
  } catch (err) {
    console.error("Availability check error:", err);
    res.status(500).json({ message: "Lỗi server." });
  }
};

/**
 * GET /api/rooms/:id/calendar
 * Returns bookings for a room in a date range (for calendar display)
 */
const getRoomCalendar = async (req, res) => {
  try {
    const { start, end } = req.query;

    const filter = {
      room: req.params.id,
      status: { $in: ["confirmed", "checked_in", "checked_out"] },
    };

    if (start) filter.checkInDateTime = { $gte: new Date(start) };
    if (end) {
      filter.checkOutDateTime = filter.checkOutDateTime || {};
      filter.checkOutDateTime = { $lte: new Date(end) };
    }

    // For calendar: also include bookings that span across the range
    if (start && end) {
      delete filter.checkInDateTime;
      delete filter.checkOutDateTime;
      filter.$or = [
        {
          checkInDateTime: { $gte: new Date(start), $lte: new Date(end) },
        },
        {
          checkOutDateTime: { $gte: new Date(start), $lte: new Date(end) },
        },
        {
          checkInDateTime: { $lte: new Date(start) },
          checkOutDateTime: { $gte: new Date(end) },
        },
      ];
    }

    const bookings = await Booking.find(filter)
      .populate("tenant", "name email phone")
      .sort({ checkInDateTime: 1 });

    res.json(bookings);
  } catch (err) {
    console.error("Room calendar error:", err);
    res.status(500).json({ message: "Lỗi server." });
  }
};

/**
 * GET /api/bookings/stats
 * Dashboard statistics for short-term bookings
 */
const getBookingStats = async (req, res) => {
  try {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);
    const startOfWeek = new Date(startOfDay);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay() + 1); // Monday
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Staff: filter by district rooms
    let roomFilter = {};
    if (req.user.role === "staff") {
      const rooms = await Room.find({
        district: { $in: req.user.managedDistricts || [] },
      }).select("_id");
      roomFilter = { room: { $in: rooms.map((r) => r._id) } };
    }

    const [
      totalBookings,
      todayBookings,
      weekBookings,
      monthBookings,
      revenueResult,
      topRoomsResult,
      shortTermRoomCount,
      occupiedShortTermNow,
    ] = await Promise.all([
      Booking.countDocuments({ ...roomFilter }),
      Booking.countDocuments({
        ...roomFilter,
        createdAt: { $gte: startOfDay, $lt: endOfDay },
      }),
      Booking.countDocuments({
        ...roomFilter,
        createdAt: { $gte: startOfWeek },
      }),
      Booking.countDocuments({
        ...roomFilter,
        createdAt: { $gte: startOfMonth },
      }),
      // Revenue from paid bookings this month
      Booking.aggregate([
        {
          $match: {
            ...roomFilter,
            paymentStatus: "paid",
            createdAt: { $gte: startOfMonth },
          },
        },
        { $group: { _id: null, total: { $sum: "$totalAmount" } } },
      ]),
      // Top rooms by booking count
      Booking.aggregate([
        {
          $match: {
            ...roomFilter,
            status: { $nin: ["cancelled"] },
          },
        },
        { $group: { _id: "$room", count: { $sum: 1 }, revenue: { $sum: "$totalAmount" } } },
        { $sort: { count: -1 } },
        { $limit: 5 },
        {
          $lookup: {
            from: "rooms",
            localField: "_id",
            foreignField: "_id",
            as: "roomInfo",
          },
        },
        { $unwind: "$roomInfo" },
        {
          $project: {
            roomName: "$roomInfo.name",
            roomType: "$roomInfo.type",
            count: 1,
            revenue: 1,
          },
        },
      ]),
      // Total short-term rooms
      Room.countDocuments({ ...( req.user.role === "staff" ? { district: { $in: req.user.managedDistricts || [] } } : {}), rentalMode: "short_term" }),
      // Currently occupied (checked_in) short-term bookings
      Booking.countDocuments({
        ...roomFilter,
        status: "checked_in",
      }),
    ]);

    const shortTermRevenue = revenueResult[0]?.total ?? 0;
    const occupancyRate =
      shortTermRoomCount > 0
        ? Math.round((occupiedShortTermNow / shortTermRoomCount) * 100)
        : 0;

    res.json({
      totalBookings,
      todayBookings,
      weekBookings,
      monthBookings,
      shortTermRevenue,
      occupancyRate,
      topRooms: topRoomsResult,
    });
  } catch (err) {
    console.error("Booking stats error:", err);
    res.status(500).json({ message: "Lỗi server." });
  }
};

module.exports = {
  createBooking,
  getBookings,
  getBookingById,
  confirmBooking,
  checkInBooking,
  checkOutBooking,
  cancelBooking,
  payBooking,
  deleteBooking,
  getRoomAvailability,
  getRoomCalendar,
  getBookingStats,
};
