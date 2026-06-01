/**
 * MapBox Utilities — Token, Geocoding, URL helpers
 */

export const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || "";

// Center mặc định: Hà Nội
export const DEFAULT_CENTER: [number, number] = [105.8342, 21.0278];
export const DEFAULT_ZOOM = 12;

/**
 * Gọi MapBox Geocoding API để lấy tọa độ từ địa chỉ
 * @param address - Địa chỉ cần geocode
 * @returns { lng, lat } hoặc null nếu không tìm thấy
 */
export async function geocodeAddress(
  address: string
): Promise<{ lng: number; lat: number } | null> {
  if (!address.trim() || !MAPBOX_TOKEN) return null;

  try {
    const encodedAddress = encodeURIComponent(address.trim());
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedAddress}.json?access_token=${MAPBOX_TOKEN}&country=VN&language=vi&limit=1`;

    const res = await fetch(url);
    if (!res.ok) return null;

    const data = await res.json();

    if (data.features && data.features.length > 0) {
      const [lng, lat] = data.features[0].center;
      return { lng, lat };
    }

    return null;
  } catch (err) {
    console.error("Geocoding error:", err);
    return null;
  }
}

/**
 * Tạo Google Maps directions URL
 */
export function getDirectionsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

/**
 * Tạo Google Maps URL cho vị trí
 */
export function getGoogleMapsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

/**
 * Format khoảng cách (meters) thành chuỗi đọc được
 */
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${meters}m`;
  }
  return `${(meters / 1000).toFixed(1)}km`;
}
