const express = require("express");
const router = express.Router();
const Appointment = require("../models/Appointment");
const Room = require("../models/Room");
const { protect, adminOnly, verifyRole, injectDistrictFilter } = require("../middleware/auth");
const {
  notifyNewAppointment,
  notifyTenantAppointmentConfirmed,
  notifyTenantAppointmentCancelled,
  sendSocketNotification,
} = require("../utils/notificationService");

// POST /api/appointments - Tạo lịch hẹn mới (Public / Khách vãng lai)
router.post("/", async (req, res) => {
  try {
    const { name, phone, email, date, time, note, room, user } = req.body;

    if (!name || !phone || !date || !time || !room) {
      return res.status(400).json({ message: "Vui lòng cung cấp đủ họ tên, SĐT, ngày, thời gian và phòng." });
    }

    // Tự động lấy district from room để lưu vào appointment
    let district = "";
    const roomDoc = await Room.findById(room).select("district");
    if (roomDoc) {
      district = roomDoc.district || "";
    }

    const appointment = new Appointment({
      name,
      phone,
      email: email || "",
      date,
      time,
      note,
      room,
      user: user || null,
      district,
    });

    await appointment.save();

    // Gửi thông báo đến staff/admin
    const notifications = await notifyNewAppointment(appointment);
    
    // Gửi qua Socket.io
    const io = req.app.get("io");
    if (io && notifications.length > 0) {
      notifications.forEach((notification) => {
        sendSocketNotification(io, "new_notification", notification);
      });
    }

    res.status(201).json(appointment);
  } catch (err) {
    console.error("Lỗi tạo lịch hẹn:", err);
    res.status(500).json({ message: "Lỗi server." });
  }
});

// GET /api/appointments - Lấy danh sách lịch hẹn (Admin + Staff)
router.get("/", protect, verifyRole("admin", "staff"), injectDistrictFilter, async (req, res) => {
  try {
    // Staff: filter theo district (đã được inject vào req.districtFilter)
    const filter = { ...req.districtFilter };

    const appointments = await Appointment.find(filter)
      .populate("room", "name address price type images district")
      .populate("user", "name email")
      .sort({ createdAt: -1 });
    res.json(appointments);
  } catch (err) {
    console.error("Lỗi lấy danh sách lịch hẹn:", err);
    res.status(500).json({ message: "Lỗi server." });
  }
});

// GET /api/appointments/:id - Chi tiết 1 lịch hẹn (Admin + Staff)
router.get("/:id", protect, verifyRole("admin", "staff"), async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id)
      .populate("room", "name address price type images district")
      .populate("user", "name email");
    if (!appointment) return res.status(404).json({ message: "Không tìm thấy lịch hẹn" });

    // Staff: kiểm tra lịch hẹn thuộc district
    if (req.user.role === "staff") {
      const district = appointment.district || "";
      if (!req.user.managedDistricts || !req.user.managedDistricts.includes(district)) {
        return res.status(403).json({ message: "Bạn không có quyền xem lịch hẹn thuộc khu vực này." });
      }
    }

    res.json(appointment);
  } catch (err) {
    res.status(500).json({ message: "Lỗi server." });
  }
});

// PUT /api/appointments/:id/status - Cập nhật trạng thái lịch hẹn (Admin + Staff)
router.put("/:id/status", protect, verifyRole("admin", "staff"), async (req, res) => {
  try {
    const { status } = req.body;
    if (!["pending", "confirmed", "cancelled"].includes(status)) {
      return res.status(400).json({ message: "Trạng thái không hợp lệ." });
    }

    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) {
      return res.status(404).json({ message: "Không tìm thấy lịch hẹn." });
    }

    // Staff: kiểm tra lịch hẹn thuộc district
    if (req.user.role === "staff") {
      const district = appointment.district || "";
      if (!req.user.managedDistricts || !req.user.managedDistricts.includes(district)) {
        return res.status(403).json({ message: "Bạn không có quyền cập nhật lịch hẹn thuộc khu vực này." });
      }
    }

    const prevStatus = appointment.status;
    appointment.status = status;
    await appointment.save();

    // Gửi notification cho khách dựa trên chuyển trạng thái (in-app nếu có user, chỉ email nếu guest).
    // - pending/cancelled → confirmed: email xác nhận (kèm flag isReconfirm nếu trước đó từng bị hủy)
    // - confirmed → cancelled: email hủy
    const io = req.app.get("io");
    const emitNotifs = (notifs) => {
      if (io && notifs && notifs.length > 0) {
        notifs.forEach((n) => sendSocketNotification(io, "new_notification", n));
      }
    };

    if (status === "confirmed" && prevStatus !== "confirmed") {
      try {
        const isReconfirm = prevStatus === "cancelled";
        const tenantNotifs = await notifyTenantAppointmentConfirmed(appointment, { isReconfirm });
        emitNotifs(tenantNotifs);
      } catch (notifyErr) {
        console.error("notifyTenantAppointmentConfirmed error:", notifyErr.message);
      }
    } else if (status === "cancelled" && prevStatus === "confirmed") {
      try {
        const tenantNotifs = await notifyTenantAppointmentCancelled(appointment);
        emitNotifs(tenantNotifs);
      } catch (notifyErr) {
        console.error("notifyTenantAppointmentCancelled error:", notifyErr.message);
      }
    }

    // Lấy lại dữ liệu kèm populate để trả về frontend
    const updatedAppointment = await Appointment.findById(req.params.id)
      .populate("room", "name address images district")
      .populate("user", "name email");

    res.json(updatedAppointment);
  } catch (err) {
    console.error("Lỗi cập nhật trạng thái lịch hẹn:", err);
    res.status(500).json({ message: "Lỗi server." });
  }
});

module.exports = router;
