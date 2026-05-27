/**
 * Room Service — Business logic cho Map-related APIs
 * Tách logic ra khỏi route handlers để dễ test và mở rộng
 */

const Room = require("../models/Room");
const { hasValidLocation } = require("../utils/geo.util");

/**
 * Lấy danh sách phòng tối ưu cho map marker rendering
 * Chỉ trả về fields cần thiết: _id, name, price, status, location, address, type
 * @param {object} filter - MongoDB filter (optional)
 * @returns {Promise<Array>}
 */
async function getRoomsForMap(filter = {}) {
  // Chỉ lấy phòng có location hợp lệ (không phải [0,0])
  const mapFilter = {
    ...filter,
    "location.coordinates": { $ne: [0, 0] },
  };

  const rooms = await Room.find(mapFilter)
    .select("_id name price status location address type area district")
    .sort({ createdAt: -1 })
    .lean();

  return rooms;
}

/**
 * Tìm phòng gần vị trí cho trước
 * @param {number} lng - Longitude
 * @param {number} lat - Latitude
 * @param {number} radius - Bán kính tìm kiếm (meters), mặc định 5000m
 * @param {number} page - Trang hiện tại
 * @param {number} limit - Số lượng mỗi trang
 * @param {object} extraFilter - Filter thêm (status, type, price...)
 * @returns {Promise<{ rooms: Array, total: number, page: number, totalPages: number }>}
 */
async function getNearbyRooms(
  lng,
  lat,
  radius = 5000,
  page = 1,
  limit = 20,
  extraFilter = {}
) {
  const geoFilter = {
    location: {
      $near: {
        $geometry: {
          type: "Point",
          coordinates: [lng, lat],
        },
        $maxDistance: radius,
      },
    },
    // Chỉ lấy phòng available hoặc occupied (không lấy maintenance)
    status: { $in: ["available", "occupied"] },
    ...extraFilter,
  };

  const countFilter = {
    status: { $in: ["available", "occupied"] },
    ...extraFilter,
    location: {
      $geoWithin: {
        $centerSphere: [[lng, lat], radius / 6378100] // chia bán kính trái đất để ra radian
      }
    }
  };

  const total = await Room.countDocuments(countFilter);
  const totalPages = Math.ceil(total / limit);
  const skip = (page - 1) * limit;

  const rooms = await Room.find(geoFilter)
    .select("_id name price status location address type area district amenities images")
    .skip(skip)
    .limit(limit)
    .lean();

  // Tính khoảng cách từ vị trí user tới từng phòng
  const roomsWithDistance = rooms.map((room) => {
    const [roomLng, roomLat] = room.location.coordinates;
    const distance = calculateDistance(lat, lng, roomLat, roomLng);
    return { ...room, distance: Math.round(distance) }; // meters
  });

  return {
    rooms: roomsWithDistance,
    total,
    page,
    totalPages,
  };
}

/**
 * Lấy thông tin location của 1 phòng
 * @param {string} roomId
 * @returns {Promise<object|null>}
 */
async function getRoomLocation(roomId) {
  const room = await Room.findById(roomId)
    .select("_id name location address")
    .lean();

  if (!room) return null;

  if (!hasValidLocation(room)) {
    return {
      roomId: room._id,
      roomName: room.name,
      latitude: null,
      longitude: null,
      googleMapsUrl: null,
      hasLocation: false,
    };
  }

  const [lng, lat] = room.location.coordinates;

  return {
    roomId: room._id,
    roomName: room.name,
    address: room.address,
    latitude: lat,
    longitude: lng,
    googleMapsUrl: `https://www.google.com/maps?q=${lat},${lng}`,
    hasLocation: true,
  };
}

/**
 * Tính khoảng cách giữa 2 điểm (Haversine formula)
 * @returns {number} Khoảng cách tính bằng meters
 */
function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000; // Earth radius in meters
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg) {
  return (deg * Math.PI) / 180;
}

module.exports = {
  getRoomsForMap,
  getNearbyRooms,
  getRoomLocation,
};
