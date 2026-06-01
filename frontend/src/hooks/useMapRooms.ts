/**
 * useMapRooms — Custom hook quản lý state và logic cho RoomsMapPage
 * - Fetch rooms for map
 * - Nearby rooms search
 * - Filter management với debounce
 * - User geolocation
 * - Selected room tracking
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { getRoomsForMap, getNearbyRooms } from "../api/room.service";
import type { RoomMapItem, NearbyRoom } from "../api/room.service";
import { useAuth } from "../contexts/AuthContext";
import { geocodeAddress } from "../utils/mapbox";

export interface MapFilters {
  district: string;
  type: string;
  price: string;
  status: string;
}

interface UseMapRoomsReturn {
  /** Rooms hiện tại (nearby hoặc tất cả) */
  displayRooms: RoomMapItem[];
  /** Loading states */
  loading: boolean;
  nearbyLoading: boolean;
  /** Error message */
  error: string;
  /** Filters hiện tại */
  filters: MapFilters;
  /** Cập nhật 1 filter */
  updateFilter: (key: keyof MapFilters, value: string) => void;
  /** Room ID đang selected */
  selectedRoomId: string | null;
  setSelectedRoomId: (id: string | null) => void;
  /** User location (nếu đã dùng geolocation) */
  userLocation: { lat: number; lng: number } | null;
  /** Đang ở chế độ nearby? */
  isNearbyMode: boolean;
  /** Tìm phòng gần tôi */
  handleNearby: () => void;
  /** Quay về xem tất cả */
  handleResetNearby: () => void;
}

const DEBOUNCE_MS = 300;

export function useMapRooms(): UseMapRoomsReturn {
  const [searchParams, setSearchParams] = useSearchParams();
  const [rooms, setRooms] = useState<RoomMapItem[]>([]);
  const [nearbyRooms, setNearbyRooms] = useState<NearbyRoom[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const { user } = useAuth();

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Đọc filters từ URL search params
  const filters: MapFilters = {
    district: searchParams.get("district") ?? "",
    type: searchParams.get("type") ?? "",
    price: searchParams.get("price") ?? "",
    status: searchParams.get("status") ?? "",
  };

  // Fetch rooms khi filters thay đổi (với debounce)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      setLoading(true);
      setError("");

      const apiFilter: Record<string, string> = {};
      if (filters.district) apiFilter.district = filters.district;
      if (filters.type) apiFilter.type = filters.type;
      if (filters.price) apiFilter.price = filters.price;
      if (filters.status) apiFilter.status = filters.status;

      getRoomsForMap(apiFilter)
        .then((data) => {
          setRooms(data);
          setNearbyRooms(null); // Reset nearby khi filter thay đổi
        })
        .catch(() => setError("Không thể tải danh sách phòng."))
        .finally(() => setLoading(false));
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.district, filters.type, filters.price, filters.status]);

  // Cập nhật 1 filter → sync vào URL
  const updateFilter = useCallback(
    (key: keyof MapFilters, value: string) => {
      const next = new URLSearchParams(searchParams);
      if (value) next.set(key, value);
      else next.delete(key);
      setSearchParams(next);
    },
    [searchParams, setSearchParams]
  );

  // Tìm phòng gần tôi
  const handleNearby = useCallback(async () => {
    setNearbyLoading(true);

    // Ưu tiên dùng địa chỉ trong hồ sơ của user
    if (user?.address) {
      const coords = await geocodeAddress(user.address);
      if (coords) {
        setUserLocation({ lat: coords.lat, lng: coords.lng });
        try {
          const result = await getNearbyRooms(coords.lng, coords.lat, 5000, 1, 50);
          setNearbyRooms(result.rooms);
          setRooms(result.rooms);
        } catch {
          alert("Lỗi khi tìm phòng gần địa chỉ của bạn.");
        } finally {
          setNearbyLoading(false);
        }
        return;
      } else {
        alert("Không thể xác định tọa độ từ địa chỉ của bạn. Đang chuyển sang định vị trình duyệt...");
      }
    }

    if (!navigator.geolocation) {
      alert("Trình duyệt không hỗ trợ định vị.");
      setNearbyLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        setUserLocation({ lat, lng });

        try {
          const result = await getNearbyRooms(lng, lat, 5000, 1, 50);
          setNearbyRooms(result.rooms);
          setRooms(result.rooms);
        } catch {
          alert("Lỗi khi tìm phòng gần bạn.");
        } finally {
          setNearbyLoading(false);
        }
      },
      (err) => {
        setNearbyLoading(false);
        if (err.code === err.PERMISSION_DENIED) {
          alert("Bạn cần cho phép truy cập vị trí để sử dụng tính năng này.");
        } else {
          alert("Không thể xác định vị trí của bạn.");
        }
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [user]);

  // Quay về xem tất cả
  const handleResetNearby = useCallback(() => {
    setNearbyRooms(null);
    setUserLocation(null);
    setSearchParams({});
  }, [setSearchParams]);

  const displayRooms = nearbyRooms ?? rooms;

  return {
    displayRooms,
    loading,
    nearbyLoading,
    error,
    filters,
    updateFilter,
    selectedRoomId,
    setSelectedRoomId,
    userLocation,
    isNearbyMode: nearbyRooms !== null,
    handleNearby,
    handleResetNearby,
  };
}
