/**
 * adminRoomMap.service.js — Service layer cho Admin Room Map
 *
 * Cung cấp dữ liệu phòng tối ưu cho bản đồ admin/staff
 * - Admin: toàn bộ phòng
 * - Staff: chỉ phòng thuộc managedDistricts
 */

const Room = require("../models/Room");

/**
 * Lấy danh sách phòng cho Admin Map
 * @param {Object} user - req.user (đã qua protect middleware)
 * @param {Object} [filters] - Bộ lọc tùy chọn { district, status, type, priceMin, priceMax }
 * @returns {Promise<Array>} Danh sách phòng tối ưu (lean)
 */
async function getAdminRoomsMap(user, filters = {}) {
  const query = {};

  // ── Role-based filtering ─────────────────────────────────────────────────
  if (user.role === "staff") {
    if (!user.managedDistricts || user.managedDistricts.length === 0) {
      return []; // Staff chưa được phân khu vực → không thấy phòng nào
    }
    query.district = { $in: user.managedDistricts };
  }
  // Admin: không thêm filter district → thấy tất cả

  // ── Optional filters ─────────────────────────────────────────────────────
  if (filters.district) {
    // Nếu staff đã bị giới hạn district, chỉ cho phép lọc trong phạm vi
    if (user.role === "staff") {
      if (user.managedDistricts.includes(filters.district)) {
        query.district = filters.district;
      }
      // Nếu không thuộc managedDistricts → bỏ qua filter này
    } else {
      query.district = filters.district;
    }
  }

  if (filters.status) {
    query.status = filters.status;
  }

  if (filters.type) {
    query.type = filters.type;
  }

  if (filters.priceMin || filters.priceMax) {
    query.price = {};
    if (filters.priceMin) query.price.$gte = Number(filters.priceMin);
    if (filters.priceMax) query.price.$lte = Number(filters.priceMax);
  }

  // ── Query với select tối ưu + lean ────────────────────────────────────────
  const rooms = await Room.find(query)
    .select("_id name price district status images address type area location createdBy")
    .populate("createdBy", "_id name")
    .lean();

  return rooms;
}

module.exports = { getAdminRoomsMap };
