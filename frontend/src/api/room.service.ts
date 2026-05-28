/**
 * Room Map API Service — Frontend API calls cho map features
 */
import api from "./axios";

export interface RoomMapItem {
  _id: string;
  name: string;
  price: number;
  status: "available" | "occupied" | "maintenance";
  location: {
    type: string;
    coordinates: [number, number]; // [lng, lat]
  };
  address: string;
  type: string;
  area: number;
  district: string;
  images?: string[];
}

export interface NearbyRoom extends RoomMapItem {
  distance: number; // meters
  amenities: string[];
  images: string[];
}

export interface NearbyResult {
  rooms: NearbyRoom[];
  total: number;
  page: number;
  totalPages: number;
}

export interface RoomLocationInfo {
  roomId: string;
  roomName: string;
  address?: string;
  latitude: number | null;
  longitude: number | null;
  googleMapsUrl: string | null;
  hasLocation: boolean;
}

/**
 * Lấy danh sách phòng tối ưu cho map markers
 */
export async function getRoomsForMap(
  filter?: Record<string, string>
): Promise<RoomMapItem[]> {
  const res = await api.get("/rooms/map", { params: filter });
  return res.data.data;
}

/**
 * Tìm phòng gần vị trí cho trước
 */
export async function getNearbyRooms(
  lng: number,
  lat: number,
  radius = 5000,
  page = 1,
  limit = 20
): Promise<NearbyResult> {
  const res = await api.get("/rooms/nearby", {
    params: { lng, lat, radius, page, limit },
  });
  return res.data.data;
}

/**
 * Lấy thông tin location của 1 phòng
 */
export async function getRoomLocation(
  roomId: string
): Promise<RoomLocationInfo> {
  const res = await api.get(`/rooms/${roomId}/location`);
  return res.data.data;
}
