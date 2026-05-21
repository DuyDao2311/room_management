const express = require("express");
const router = express.Router();
const Favorite = require("../models/Favorite");
const Room = require("../models/Room");
const { protect } = require("../middleware/auth");

// Tất cả các route đều yêu cầu đăng nhập
router.use(protect);

// GET /api/favorites — Lấy danh sách phòng yêu thích của user hiện tại
router.get("/", async (req, res) => {
  try {
    const favorites = await Favorite.find({ user: req.user._id })
      .populate("room")
      .sort({ createdAt: -1 });
    
    // Chỉ trả về danh sách room, không trả về document Favorite
    const rooms = favorites
      .filter(f => f.room) // Lọc bỏ những room đã bị xóa
      .map(f => f.room);
    
    res.json(rooms);
  } catch (err) {
    console.error("Get favorites error:", err);
    res.status(500).json({ message: "Lỗi server." });
  }
});

// POST /api/favorites/:roomId — Thêm phòng vào danh sách yêu thích
router.post("/:roomId", async (req, res) => {
  try {
    const { roomId } = req.params;

    // Kiểm tra room có tồn tại không
    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({ message: "Không tìm thấy phòng." });
    }

    // Kiểm tra xem đã favorite chưa
    const existing = await Favorite.findOne({
      user: req.user._id,
      room: roomId,
    });
    if (existing) {
      return res.status(400).json({ message: "Phòng đã có trong danh sách yêu thích." });
    }

    // Tạo favorite mới
    const favorite = await Favorite.create({
      user: req.user._id,
      room: roomId,
    });

    res.status(201).json({ message: "Đã thêm phòng vào danh sách yêu thích." });
  } catch (err) {
    console.error("Add favorite error:", err);
    res.status(500).json({ message: "Lỗi server." });
  }
});

// DELETE /api/favorites/:roomId — Xóa phòng khỏi danh sách yêu thích
router.delete("/:roomId", async (req, res) => {
  try {
    const { roomId } = req.params;

    const result = await Favorite.deleteOne({
      user: req.user._id,
      room: roomId,
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({ message: "Phòng không có在 danh sách yêu thích." });
    }

    res.json({ message: "Đã xóa phòng khỏi danh sách yêu thích." });
  } catch (err) {
    console.error("Remove favorite error:", err);
    res.status(500).json({ message: "Lỗi server." });
  }
});

// GET /api/favorites/check/:roomId — Kiểm tra xem room có trong favorites không
router.get("/check/:roomId", async (req, res) => {
  try {
    const { roomId } = req.params;

    const favorite = await Favorite.findOne({
      user: req.user._id,
      room: roomId,
    });

    res.json({ isFavorite: !!favorite });
  } catch (err) {
    console.error("Check favorite error:", err);
    res.status(500).json({ message: "Lỗi server." });
  }
});

module.exports = router;