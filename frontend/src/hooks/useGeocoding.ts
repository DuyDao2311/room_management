import { useState, useEffect, useRef, useCallback } from "react";
import { geocodeAddress } from "../utils/mapbox";

interface UseGeocodingOptions {
  /** Debounce delay in ms (default 800) */
  debounce?: number;
}

interface GeocodingResult {
  lat: number;
  lng: number;
  loading: boolean;
  error: string | null;
}

/**
 * Custom hook cho geocoding — gọi MapBox Geocoding API với debounce
 * @param address - Địa chỉ cần geocode
 * @param options - Debounce delay
 * @returns { lat, lng, loading, error }
 */
export function useGeocoding(
  address: string,
  options: UseGeocodingOptions = {}
): GeocodingResult {
  const { debounce = 800 } = options;
  const [result, setResult] = useState<GeocodingResult>({
    lat: 0,
    lng: 0,
    loading: false,
    error: null,
  });

  // Cache để tránh gọi lại cùng address
  const cacheRef = useRef<Record<string, { lat: number; lng: number }>>({});
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doGeocode = useCallback(
    async (addr: string) => {
      if (!addr.trim()) return;

      // Check cache trước
      const cached = cacheRef.current[addr.trim()];
      if (cached) {
        setResult({ lat: cached.lat, lng: cached.lng, loading: false, error: null });
        return;
      }

      setResult((prev) => ({ ...prev, loading: true, error: null }));

      const coords = await geocodeAddress(addr);

      if (coords) {
        cacheRef.current[addr.trim()] = coords;
        setResult({
          lat: coords.lat,
          lng: coords.lng,
          loading: false,
          error: null,
        });
      } else {
        setResult((prev) => ({
          ...prev,
          loading: false,
          error: "Không tìm thấy vị trí cho địa chỉ này.",
        }));
      }
    },
    []
  );

  useEffect(() => {
    if (!address.trim()) return;

    // Clear previous timer
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    // Debounce
    timerRef.current = setTimeout(() => {
      doGeocode(address);
    }, debounce);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [address, debounce, doGeocode]);

  return result;
}
