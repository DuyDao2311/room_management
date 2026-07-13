const ServiceBooking = require("../models/ServiceBooking");
const Service = require("../models/Service");
const Contract = require("../models/Contract");
const Booking = require("../models/Booking");
const {
  notifyTenantServiceBookingStatusChanged,
  sendSocketNotification,
} = require("../utils/notificationService");

const POPULATE_SERVICE = "name category unit images price";
const POPULATE_TENANT = "name email phone";
const ONE_HOUR_MS = 60 * 60 * 1000;

const CATEGORY_TAGS = {
  cleaning: ["Sạch sẽ", "Đúng giờ", "Chu đáo", "Nhanh gọn"],
  food: ["Ngon miệng", "Đúng giờ", "Trình bày đẹp", "Đáng tiền"],
  laundry: ["Sạch thơm", "Đúng hẹn", "Cẩn thận", "Nhanh chóng"],
  transport: ["Đúng giờ", "Tài xế thân thiện", "Xe sạch sẽ", "Lái xe an toàn"],
  spa: ["Thư giãn", "Chuyên nghiệp", "Nhẹ nhàng", "Đáng tiền"],
  maintenance: ["Xử lý nhanh", "Chuyên nghiệp", "Đúng giờ", "Giải quyết triệt để"],
};

/** Gửi notification cho tenant khi trạng thái booking đổi, rồi emit qua socket. Lỗi bị nuốt (không chặn response). */
const notifyAndEmitStatusChange = async (req, booking, status) => {
  try {
    const notifs = await notifyTenantServiceBookingStatusChanged(booking, status);
    const io = req.app.get("io");
    if (io && notifs && notifs.length > 0) {
      notifs.forEach((n) => sendSocketNotification(io, "new_notification", n));
    }
  } catch (notifErr) {
    console.error(`Notify service booking ${status} error:`, notifErr);
  }
};

/** ValidationError → 400, còn lại → 500. */
const respondWithError = (res, err) => {
  if (err.name === "ValidationError") {
    return res.status(400).json({ message: err.message });
  }
  return res.status(500).json({ message: "Lỗi server." });
};

/** Tính lại avgRating/ratingCount của 1 Service bằng aggregate toàn bộ booking đã rate. */
const recomputeServiceRating = async (serviceId) => {
  const stats = await ServiceBooking.aggregate([
    { $match: { service: serviceId, rating: { $ne: null } } },
    { $group: { _id: "$service", avgRating: { $avg: "$rating" }, ratingCount: { $sum: 1 } } },
  ]);

  const { avgRating = 0, ratingCount = 0 } = stats[0] || {};
  await Service.findByIdAndUpdate(serviceId, {
    avgRating: Math.round(avgRating * 10) / 10,
    ratingCount,
  });
};

const createServiceBooking = async (req, res) => {
  try {
    const { serviceId, scheduledAt, quantity, note } = req.body;

    if (!serviceId || !scheduledAt || !quantity) {
      return res.status(400).json({
        message: "Vui lòng cung cấp đầy đủ: dịch vụ, thời gian hẹn, số lượng.",
      });
    }
    if (new Date(scheduledAt).getTime() - Date.now() < ONE_HOUR_MS) {
      return res.status(400).json({ message: "Thời gian hẹn phải cách hiện tại ít nhất 1 giờ." });
    }
    if (quantity < 1) {
      return res.status(400).json({ message: "Số lượng tối thiểu là 1." });
    }

    const service = await Service.findById(serviceId);
    if (!service || !service.isActive) {
      return res.status(404).json({ message: "Không tìm thấy dịch vụ." });
    }

    const [activeContract, activeBooking] = await Promise.all([
      Contract.findOne({ tenant: req.user._id, status: "active" }),
      Booking.findOne({ tenant: req.user._id, status: "checked_in" }),
    ]);
    if (!activeContract && !activeBooking) {
      return res.status(403).json({ message: "Bạn cần đang thuê phòng để đặt dịch vụ này." });
    }

    const unitPrice = service.price;
    const totalAmount = unitPrice * quantity;

    const booking = await ServiceBooking.create({
      service: serviceId,
      tenant: req.user._id,
      scheduledAt: new Date(scheduledAt),
      quantity,
      unitPrice,
      totalAmount,
      note: note || "",
    });

    await booking.populate([
      { path: "service", select: POPULATE_SERVICE },
      { path: "tenant", select: POPULATE_TENANT },
    ]);
    res.status(201).json(booking);
  } catch (err) {
    console.error("Create service booking error:", err);
    res.status(400).json({ message: err.message || "Không thể tạo booking dịch vụ." });
  }
};

const getServiceBookings = async (req, res) => {
  try {
    const filter = {};
    if (req.user.role === "tenant") filter.tenant = req.user._id;
    if (req.query.status) filter.status = req.query.status;
    if (req.query.paymentStatus) filter.paymentStatus = req.query.paymentStatus;

    const bookings = await ServiceBooking.find(filter)
      .populate("service", POPULATE_SERVICE)
      .populate("tenant", POPULATE_TENANT)
      .sort({ createdAt: -1 });

    res.json(bookings);
  } catch (err) {
    console.error("Get service bookings error:", err);
    res.status(500).json({ message: "Lỗi server." });
  }
};

const getServiceBookingById = async (req, res) => {
  try {
    const booking = await ServiceBooking.findById(req.params.id)
      .populate("service", POPULATE_SERVICE)
      .populate("tenant", POPULATE_TENANT);

    if (!booking) return res.status(404).json({ message: "Không tìm thấy booking." });

    if (req.user.role === "tenant" && booking.tenant._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Bạn không có quyền xem booking này." });
    }

    res.json(booking);
  } catch (err) {
    console.error("Get service booking error:", err);
    res.status(500).json({ message: "Lỗi server." });
  }
};

const confirmServiceBooking = async (req, res) => {
  try {
    const booking = await ServiceBooking.findById(req.params.id).populate([
      { path: "service", select: POPULATE_SERVICE },
      { path: "tenant", select: POPULATE_TENANT },
    ]);
    if (!booking) return res.status(404).json({ message: "Không tìm thấy booking." });

    if (booking.status !== "pending") {
      return res.status(400).json({
        message: `Không thể xác nhận booking ở trạng thái "${booking.status}".`,
      });
    }

    booking.status = "confirmed";
    await booking.save();

    notifyAndEmitStatusChange(req, booking, "confirmed");

    res.json(booking);
  } catch (err) {
    console.error("Confirm service booking error:", err);
    return respondWithError(res, err);
  }
};

const completeServiceBooking = async (req, res) => {
  try {
    const booking = await ServiceBooking.findById(req.params.id).populate([
      { path: "service", select: POPULATE_SERVICE },
      { path: "tenant", select: POPULATE_TENANT },
    ]);
    if (!booking) return res.status(404).json({ message: "Không tìm thấy booking." });

    if (booking.status !== "confirmed") {
      return res.status(400).json({
        message: `Không thể hoàn thành booking. Booking phải ở trạng thái "confirmed". Hiện tại: "${booking.status}".`,
      });
    }

    booking.status = "completed";
    await booking.save();

    notifyAndEmitStatusChange(req, booking, "completed");

    res.json(booking);
  } catch (err) {
    console.error("Complete service booking error:", err);
    return respondWithError(res, err);
  }
};

const cancelServiceBooking = async (req, res) => {
  try {
    const booking = await ServiceBooking.findById(req.params.id).populate([
      { path: "service", select: POPULATE_SERVICE },
      { path: "tenant", select: POPULATE_TENANT },
    ]);
    if (!booking) return res.status(404).json({ message: "Không tìm thấy booking." });

    if (req.user.role === "tenant" && booking.tenant._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Bạn không có quyền hủy booking này." });
    }

    if (["completed", "cancelled"].includes(booking.status)) {
      return res.status(400).json({
        message: `Không thể hủy booking ở trạng thái "${booking.status}".`,
      });
    }

    if (req.user.role === "tenant") {
      if (booking.status !== "pending") {
        return res.status(400).json({
          message: "Chỉ có thể tự hủy khi booking đang chờ xác nhận. Vui lòng liên hệ admin/staff.",
        });
      }
      const msUntilScheduled = new Date(booking.scheduledAt).getTime() - Date.now();
      if (msUntilScheduled < ONE_HOUR_MS) {
        return res.status(400).json({
          message: "Đã quá hạn tự hủy (cần hủy trước giờ hẹn tối thiểu 1 giờ). Vui lòng liên hệ admin/staff.",
        });
      }
    }

    booking.status = "cancelled";
    await booking.save();

    notifyAndEmitStatusChange(req, booking, "cancelled");

    res.json(booking);
  } catch (err) {
    console.error("Cancel service booking error:", err);
    return respondWithError(res, err);
  }
};

const payServiceBooking = async (req, res) => {
  try {
    const booking = await ServiceBooking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: "Không tìm thấy booking." });

    if (booking.paymentStatus === "paid") {
      return res.status(400).json({ message: "Booking đã được thanh toán." });
    }
    if (booking.status === "cancelled") {
      return res.status(400).json({ message: "Không thể thanh toán booking đã bị hủy." });
    }

    booking.paymentStatus = "paid";
    await booking.save();

    await booking.populate([
      { path: "service", select: POPULATE_SERVICE },
      { path: "tenant", select: POPULATE_TENANT },
    ]);
    res.json(booking);
  } catch (err) {
    console.error("Pay service booking error:", err);
    return respondWithError(res, err);
  }
};

const rateServiceBooking = async (req, res) => {
  try {
    const { rating, review, tags } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ message: "Số sao phải từ 1 đến 5." });
    }

    const booking = await ServiceBooking.findById(req.params.id).populate("service", POPULATE_SERVICE);
    if (!booking) return res.status(404).json({ message: "Không tìm thấy booking." });

    if (booking.tenant.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Bạn không có quyền chấm sao booking này." });
    }
    if (booking.status !== "completed") {
      return res.status(400).json({ message: "Chỉ có thể chấm sao sau khi dịch vụ đã hoàn thành." });
    }
    if (booking.rating != null) {
      return res.status(400).json({ message: "Booking này đã được chấm sao." });
    }

    booking.rating = rating;
    booking.review = review || "";

    const allowedTags = CATEGORY_TAGS[booking.service?.category] || [];
    booking.tags = Array.isArray(tags) ? tags.filter((t) => allowedTags.includes(t)) : [];

    await booking.save();

    await recomputeServiceRating(booking.service._id);

    await booking.populate("tenant", POPULATE_TENANT);
    res.json(booking);
  } catch (err) {
    console.error("Rate service booking error:", err);
    return respondWithError(res, err);
  }
};

const deleteServiceBooking = async (req, res) => {
  try {
    const booking = await ServiceBooking.findByIdAndDelete(req.params.id);
    if (!booking) return res.status(404).json({ message: "Không tìm thấy booking." });

    if (booking.rating != null) {
      await recomputeServiceRating(booking.service);
    }

    res.json({ message: "Đã xóa booking thành công." });
  } catch (err) {
    console.error("Delete service booking error:", err);
    return respondWithError(res, err);
  }
};

module.exports = {
  createServiceBooking,
  getServiceBookings,
  getServiceBookingById,
  confirmServiceBooking,
  completeServiceBooking,
  cancelServiceBooking,
  payServiceBooking,
  rateServiceBooking,
  deleteServiceBooking,
};
