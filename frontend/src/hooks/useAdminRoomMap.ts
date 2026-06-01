/**
 * useAdminRoomMap — Custom hook quản lý state và logic cho AdminRoomMapPage
 * - Fetch rooms for admin/staff map
 * - Filter management với debounce
 * - Selected room tracking
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { getAdminRoomsForMap } from "../api/adminRoomMap.service";
import type { AdminRoomMapItem, AdminMapFilters } from "../api/adminRoomMap.service";

export interface AdminMapFilterState {
  district: string;
  status: string;
  type: string;
  priceMin: string;
  priceMax: string;
}

interface UseAdminRoomMapReturn {
  rooms: AdminRoomMapItem[];
  loading: boolean;
  error: string;
  filters: AdminMapFilterState;
  updateFilter: (key: keyof AdminMapFilterState, value: string) => void;
  resetFilters: () => void;
  selectedRoomId: string | null;
  setSelectedRoomId: (id: string | null) => void;
}

const DEBOUNCE_MS = 300;

export function useAdminRoomMap(): UseAdminRoomMapReturn {
  const [searchParams, setSearchParams] = useSearchParams();
  const [rooms, setRooms] = useState<AdminRoomMapItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Đọc filters từ URL search params
  const filters: AdminMapFilterState = {
    district: searchParams.get("district") ?? "",
    status: searchParams.get("status") ?? "",
    type: searchParams.get("type") ?? "",
    priceMin: searchParams.get("priceMin") ?? "",
    priceMax: searchParams.get("priceMax") ?? "",
  };

  // Fetch rooms khi filters thay đổi (với debounce)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      setLoading(true);
      setError("");

      const apiFilter: AdminMapFilters = {};
      if (filters.district) apiFilter.district = filters.district;
      if (filters.status) apiFilter.status = filters.status;
      if (filters.type) apiFilter.type = filters.type;
      if (filters.priceMin) apiFilter.priceMin = filters.priceMin;
      if (filters.priceMax) apiFilter.priceMax = filters.priceMax;

      getAdminRoomsForMap(apiFilter)
        .then((data) => setRooms(data))
        .catch(() => setError("Không thể tải danh sách phòng."))
        .finally(() => setLoading(false));
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.district, filters.status, filters.type, filters.priceMin, filters.priceMax]);

  // Cập nhật 1 filter → sync vào URL
  const updateFilter = useCallback(
    (key: keyof AdminMapFilterState, value: string) => {
      const next = new URLSearchParams(searchParams);
      if (value) next.set(key, value);
      else next.delete(key);
      setSearchParams(next);
    },
    [searchParams, setSearchParams]
  );

  // Reset all filters
  const resetFilters = useCallback(() => {
    setSearchParams({});
  }, [setSearchParams]);

  return {
    rooms,
    loading,
    error,
    filters,
    updateFilter,
    resetFilters,
    selectedRoomId,
    setSelectedRoomId,
  };
}
