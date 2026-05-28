/**
 * adminRoomMap.service.ts — API calls cho Admin Room Map
 */
import api from "./axios";

export interface AdminRoomMapItem {
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
  createdBy?: {
    _id: string;
    name: string;
  };
}

export interface AdminMapFilters {
  district?: string;
  status?: string;
  type?: string;
  priceMin?: string;
  priceMax?: string;
}

/**
 * Lấy danh sách phòng cho Admin Map (có authentication)
 */
export async function getAdminRoomsForMap(
  filters?: AdminMapFilters
): Promise<AdminRoomMapItem[]> {
  const params = new URLSearchParams();
  if (filters) {
    Object.entries(filters).forEach(([key, val]) => {
      if (val) params.set(key, val);
    });
  }
  const queryString = params.toString();
  const url = `/admin/rooms/map${queryString ? `?${queryString}` : ""}`;
  const { data } = await api.get<AdminRoomMapItem[]>(url);
  return data;
}
