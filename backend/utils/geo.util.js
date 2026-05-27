/**
 * Geo Utilities — Validation & helpers cho GeoJSON location
 * Dùng cho MapBox integration
 */

/**
 * Kiểm tra tọa độ có hợp lệ không
 * @param {number} lng - Longitude (-180 → 180)
 * @param {number} lat - Latitude (-90 → 90)
 * @returns {boolean}
 */
function isValidCoordinates(lng, lat) {
  if (typeof lng !== "number" || typeof lat !== "number") return false;
  if (isNaN(lng) || isNaN(lat)) return false;
  if (lng < -180 || lng > 180) return false;
  if (lat < -90 || lat > 90) return false;
  return true;
}

/**
 * Convert lng/lat sang GeoJSON Point
 * @param {number} lng
 * @param {number} lat
 * @returns {{ type: "Point", coordinates: [number, number] }}
 */
function toGeoJSON(lng, lat) {
  return {
    type: "Point",
    coordinates: [lng, lat],
  };
}

/**
 * Validate location input từ request body
 * Chấp nhận cả 2 format:
 *   1. { location: { type: "Point", coordinates: [lng, lat] } }
 *   2. { location: { coordinates: [lng, lat] } }
 *
 * @param {object} body - Request body
 * @returns {{ valid: boolean, location?: object, error?: string }}
 */
function validateLocationInput(body) {
  if (!body.location) {
    return { valid: true, location: null }; // Optional field
  }

  const { location } = body;

  // Phải có coordinates
  if (
    !location.coordinates ||
    !Array.isArray(location.coordinates) ||
    location.coordinates.length < 2
  ) {
    return { valid: false, error: "Location phải có coordinates [lng, lat]." };
  }

  const [lng, lat] = location.coordinates;

  if (!isValidCoordinates(lng, lat)) {
    return {
      valid: false,
      error: `Tọa độ không hợp lệ: lng=${lng}, lat=${lat}. Longitude: -180→180, Latitude: -90→90.`,
    };
  }

  return {
    valid: true,
    location: toGeoJSON(lng, lat),
  };
}

/**
 * Kiểm tra room có location hợp lệ (không phải default [0,0])
 * @param {object} room
 * @returns {boolean}
 */
function hasValidLocation(room) {
  if (!room?.location?.coordinates) return false;
  const [lng, lat] = room.location.coordinates;
  return lng !== 0 || lat !== 0;
}

module.exports = {
  isValidCoordinates,
  toGeoJSON,
  validateLocationInput,
  hasValidLocation,
};
