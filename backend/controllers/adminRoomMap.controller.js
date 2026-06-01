/**
 * adminRoomMap.controller.js — Controller cho Admin Room Map API
 */

const { getAdminRoomsMap } = require("../services/adminRoomMap.service");

/**
 * GET /api/admin/rooms/map
 * Trả về danh sách phòng tối ưu cho map (admin/staff)
 */
async function getAdminRoomsMapController(req, res) {
  try {
    const filters = {
      district: req.query.district || "",
      status: req.query.status || "",
      type: req.query.type || "",
      priceMin: req.query.priceMin || "",
      priceMax: req.query.priceMax || "",
    };

    const rooms = await getAdminRoomsMap(req.user, filters);

    res.json(rooms);
  } catch (err) {
    console.error("AdminRoomMap error:", err);
    res.status(500).json({ message: "Lỗi server khi lấy dữ liệu bản đồ." });
  }
}

module.exports = { getAdminRoomsMapController };
