const express = require("express");
const router = express.Router();
const Room = require("../models/Room");
const { protect, adminOnly, verifyRole, injectDistrictFilter, checkDistrictPermission } = require("../middleware/auth");
const { validateLocationInput, isValidCoordinates } = require("../utils/geo.util");
const { getRoomsForMap, getNearbyRooms, getRoomLocation } = require("../services/room.service");

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

// GET /api/rooms/my-district — staff lấy rooms thuộc district của mình
router.get("/my-district", protect, verifyRole("admin", "staff"), injectDistrictFilter, async (req, res) => {
  try {
    const filter = { ...req.districtFilter };

    // Hỗ trợ filter thêm từ query params
    const { price, type, status, search } = req.query;
    if (status) filter.status = status;
    if (type) filter.type = type;
    if (price === "below-3") {
      filter.price = { $lt: 3_000_000 };
    } else if (price === "3-5") {
      filter.price = { $gte: 3_000_000, $lte: 5_000_000 };
    } else if (price === "above-5") {
      filter.price = { $gt: 5_000_000 };
    }
    if (search) {
      filter.$text = { $search: search };
    }

    const rooms = await Room.find(filter).sort({ createdAt: -1 });
    res.json(rooms);
  } catch (err) {
    console.error("Get my-district rooms error:", err);
    res.status(500).json({ message: "Lỗi server." });
  }
});

// ─── MAP APIs (phải đặt TRƯỚC /:id để tránh Express path conflict) ────────

// GET /api/rooms/map — danh sách phòng tối ưu cho map markers (public)
router.get("/map", async (req, res) => {
  try {
    const filter = {};
    const { district, type, status } = req.query;
    if (district) filter.district = district;
    if (type) filter.type = type;
    if (status) filter.status = status;

    const rooms = await getRoomsForMap(filter);
    res.json({ success: true, data: rooms });
  } catch (err) {
    console.error("Get rooms for map error:", err);
    res.status(500).json({ success: false, message: "Lỗi server." });
  }
});

// GET /api/rooms/nearby — tìm phòng gần vị trí (public)
router.get("/nearby", async (req, res) => {
  try {
    const lng = parseFloat(req.query.lng);
    const lat = parseFloat(req.query.lat);
    const radius = parseInt(req.query.radius) || 5000;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    if (!isValidCoordinates(lng, lat)) {
      return res.status(400).json({
        success: false,
        message: "Tọa độ không hợp lệ. Cần cung cấp lng và lat.",
      });
    }

    const extraFilter = {};
    if (req.query.district) extraFilter.district = req.query.district;
    if (req.query.type) extraFilter.type = req.query.type;

    const result = await getNearbyRooms(lng, lat, radius, page, limit, extraFilter);
    res.json({ success: true, data: result });
  } catch (err) {
    console.error("Get nearby rooms error:", err);
    res.status(500).json({ success: false, message: "Lỗi server." });
  }
});

// PATCH /api/rooms/:id/view — tăng lượt xem (public, fire-and-forget)
router.patch("/:id/view", async (req, res) => {
  try {
    await Room.findByIdAndUpdate(req.params.id, { $inc: { viewCount: 1 } });
    res.json({ success: true });
  } catch {
    // Không trả lỗi về client — lượt xem không critical
    res.json({ success: false });
  }
});

// GET /api/rooms/:id/location — lấy thông tin vị trí (public)
router.get("/:id/location", async (req, res) => {
  try {
    const data = await getRoomLocation(req.params.id);
    if (!data) {
      return res.status(404).json({ success: false, message: "Không tìm thấy phòng." });
    }
    res.json({ success: true, data });
  } catch (err) {
    console.error("Get room location error:", err);
    res.status(500).json({ success: false, message: "Lỗi server." });
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

// POST /api/rooms — tạo phòng mới (admin + staff)
// Staff chỉ được tạo phòng trong district được phân công
router.post("/", protect, verifyRole("admin", "staff"), async (req, res) => {
  try {
    const { name, address, price, area, type, status, description, amenities, district, images, maintenanceEndDate, location } = req.body;

    // Validate location nếu có
    const locResult = validateLocationInput(req.body);
    if (!locResult.valid) {
      return res.status(400).json({ success: false, message: locResult.error });
    }

    if (!name || !address || !price || !area) {
      return res.status(400).json({ message: "Vui lòng nhập đầy đủ thông tin bắt buộc." });
    }

    // Staff: tự động gán district và kiểm tra quyền
    let finalDistrict = district || "";
    if (req.user.role === "staff") {
      if (!req.user.managedDistricts || req.user.managedDistricts.length === 0) {
        return res.status(403).json({ message: "Bạn chưa được phân công khu vực quản lý." });
      }

      if (finalDistrict) {
        // Staff chỉ định district → kiểm tra có trong managedDistricts
        if (!req.user.managedDistricts.includes(finalDistrict)) {
          return res.status(403).json({ message: "Bạn không có quyền tạo phòng trong khu vực này." });
        }
      } else {
        // Staff không chỉ định → tự động gán district đầu tiên
        finalDistrict = req.user.managedDistricts[0];
      }
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

    const roomData = {
      name,
      address,
      price,
      area,
      type: type || "Studio",
      status: status || "available",
      description: description || "",
      amenities: amenities || [],
      district: finalDistrict,
      images: images || [],
      maintenanceEndDate: status === "maintenance" ? maintenanceEndDate : undefined,
      createdBy: req.user._id,
    };

    // Thêm location nếu có và hợp lệ
    if (locResult.location) {
      roomData.location = locResult.location;
    }

    const room = await Room.create(roomData);

    res.status(201).json(room);
  } catch (err) {
    console.error("Create room error:", err);
    res.status(500).json({ message: "Lỗi server." });
  }
});

// PUT /api/rooms/:id — cập nhật phòng (admin + staff trong district)
router.put("/:id", protect, verifyRole("admin", "staff"), async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ message: "Không tìm thấy phòng." });

    // Staff: kiểm tra phòng thuộc district được phân công
    if (req.user.role === "staff") {
      if (!req.user.managedDistricts || !req.user.managedDistricts.includes(room.district)) {
        return res.status(403).json({ message: "Bạn không có quyền chỉnh sửa phòng trong khu vực này." });
      }
      // Staff không được đổi district của phòng sang khu vực khác
      if (req.body.district && !req.user.managedDistricts.includes(req.body.district)) {
        return res.status(403).json({ message: "Bạn không có quyền chuyển phòng sang khu vực khác." });
      }
    }

    // Validate location nếu có
    const locResult = validateLocationInput(req.body);
    if (!locResult.valid) {
      return res.status(400).json({ success: false, message: locResult.error });
    }

    const updatedRoom = await Room.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    res.json(updatedRoom);
  } catch (err) {
    console.error("Update room error:", err);
    res.status(500).json({ message: "Lỗi server." });
  }
});

// DELETE /api/rooms/:id — xóa phòng (admin only - staff không được xóa)
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
