const express = require("express");
const router = express.Router();
const Room = require("../models/Room");
const { protect, adminOnly } = require("../middleware/auth");

// GET /api/rooms — danh sách phòng (public), hỗ trợ lọc
router.get("/", async (req, res) => {
  try {
    const filter = {};
    const { price, district, type, status, search } = req.query;

    // Lọc theo trạng thái (public chỉ thấy available, admin thấy tất cả)
    if (status) {
      filter.status = status;
    }

    // Lọc theo giá
    if (price === "below-3") {
      filter.price = { $lt: 3_000_000 };
    } else if (price === "3-5") {
      filter.price = { $gte: 3_000_000, $lte: 5_000_000 };
    } else if (price === "above-5") {
      filter.price = { $gt: 5_000_000 };
    }

    // Lọc theo quận
    if (district) filter.district = district;

    // Lọc theo loại phòng
    if (type) filter.type = type;

    // Tìm kiếm text
    if (search) {
      filter.$text = { $search: search };
    }

    const rooms = await Room.find(filter).sort({ createdAt: -1 });
    res.json(rooms);
  } catch (err) {
    console.error("Get rooms error:", err);
    res.status(500).json({ message: "Lỗi server." });
  }
});

// GET /api/rooms/:id — chi tiết phòng (public)
router.get("/:id", async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ message: "Không tìm thấy phòng." });
    res.json(room);
  } catch (err) {
    res.status(500).json({ message: "Lỗi server." });
  }
});

// POST /api/rooms — tạo phòng mới (admin only)
router.post("/", protect, adminOnly, async (req, res) => {
  try {
    const { name, address, price, area, type, status, description, amenities, district, images, maintenanceEndDate } = req.body;

    if (!name || !address || !price || !area) {
      return res.status(400).json({ message: "Vui lòng nhập đầy đủ thông tin bắt buộc." });
    }

    // Kiểm tra trùng tên phòng trong cùng địa chỉ (không phân biệt hoa thường)
    const duplicate = await Room.findOne({
      name: { $regex: new RegExp(`^${name.trim()}$`, "i") },
      address: { $regex: new RegExp(`^${address.trim()}$`, "i") },
    });
    if (duplicate) {
      return res.status(409).json({
        message: `Phòng "${name}" đã tồn tại tại địa chỉ "${address}". Vui lòng đặt tên phòng khác.`,
      });
    }

    const room = await Room.create({
      name,
      address,
      price,
      area,
      type: type || "Studio",
      status: status || "available",
      description: description || "",
      amenities: amenities || [],
      district: district || "",
      images: images || [],
      maintenanceEndDate: status === "maintenance" ? maintenanceEndDate : undefined,
      createdBy: req.user._id,
    });

    res.status(201).json(room);
  } catch (err) {
    console.error("Create room error:", err);
    res.status(500).json({ message: "Lỗi server." });
  }
});

// PUT /api/rooms/:id — cập nhật phòng (admin only)
router.put("/:id", protect, adminOnly, async (req, res) => {
  try {
    const room = await Room.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!room) return res.status(404).json({ message: "Không tìm thấy phòng." });
    res.json(room);
  } catch (err) {
    console.error("Update room error:", err);
    res.status(500).json({ message: "Lỗi server." });
  }
});

// DELETE /api/rooms/:id — xóa phòng (admin only)
router.delete("/:id", protect, adminOnly, async (req, res) => {
  try {
    const room = await Room.findByIdAndDelete(req.params.id);
    if (!room) return res.status(404).json({ message: "Không tìm thấy phòng." });
    res.json({ message: "Xóa phòng thành công." });
  } catch (err) {
    res.status(500).json({ message: "Lỗi server." });
  }
});

module.exports = router;
