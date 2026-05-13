const express = require("express");
const router = express.Router();
const Appointment = require("../models/Appointment");
const { protect, adminOnly } = require("../middleware/auth");

// POST /api/appointments - Tạo lịch hẹn mới (Public / Khách vãng lai)
router.post("/", async (req, res) => {
  try {
    const { name, phone, date, time, note, room, user } = req.body;
    
    if (!name || !phone || !date || !time || !room) {
      return res.status(400).json({ message: "Vui lòng cung cấp đủ họ tên, SĐT, ngày, thời gian và phòng." });
    }

    const appointment = new Appointment({
      name,
      phone,
      date,
      time,
      note,
      room,
      user: user || null
    });

    await appointment.save();
    res.status(201).json(appointment);
  } catch (err) {
    console.error("Lỗi tạo lịch hẹn:", err);
    res.status(500).json({ message: "Lỗi server." });
  }
});

// GET /api/appointments - Lấy danh sách lịch hẹn (Chỉ Admin)
router.get("/", protect, adminOnly, async (req, res) => {
  try {
    const appointments = await Appointment.find({})
      .populate("room", "name address price type images")
      .populate("user", "name email")
      .sort({ createdAt: -1 });
    res.json(appointments);
  } catch (err) {
    console.error("Lỗi lấy danh sách lịch hẹn:", err);
    res.status(500).json({ message: "Lỗi server." });
  }
});

// GET /api/appointments/:id - Chi tiết 1 lịch hẹn
router.get("/:id", protect, adminOnly, async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id)
      .populate("room", "name address price type images")
      .populate("user", "name email");
    if (!appointment) return res.status(404).json({ message: "Không tìm thấy lịch hẹn" });
    res.json(appointment);
  } catch (err) {
    res.status(500).json({ message: "Lỗi server." });
  }
});

// PUT /api/appointments/:id/status - Cập nhật trạng thái lịch hẹn (Chỉ Admin)
router.put("/:id/status", protect, adminOnly, async (req, res) => {
  try {
    const { status } = req.body;
    if (!["pending", "confirmed", "cancelled"].includes(status)) {
      return res.status(400).json({ message: "Trạng thái không hợp lệ." });
    }

    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) {
      return res.status(404).json({ message: "Không tìm thấy lịch hẹn." });
    }

    appointment.status = status;
    await appointment.save();

    // Lấy lại dữ liệu kèm populate để trả về frontend
    const updatedAppointment = await Appointment.findById(req.params.id)
      .populate("room", "name address images")
      .populate("user", "name email");

    res.json(updatedAppointment);
  } catch (err) {
    console.error("Lỗi cập nhật trạng thái lịch hẹn:", err);
    res.status(500).json({ message: "Lỗi server." });
  }
});

module.exports = router;
