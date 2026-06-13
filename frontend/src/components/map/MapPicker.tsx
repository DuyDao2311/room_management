import { useEffect, useRef, useState, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { MAPBOX_TOKEN, DEFAULT_CENTER, geocodeAddress } from "../../utils/mapbox";
import { RiMapPin2Line } from "react-icons/ri";

mapboxgl.accessToken = MAPBOX_TOKEN;

interface MapPickerProps {
  /** Địa chỉ để auto geocode */
  address: string;
  /** Giá trị hiện tại */
  value: { lat: number; lng: number };
  /** Callback khi location thay đổi */
  onChange: (location: { lat: number; lng: number }) => void;
}

/**
 * MapPicker — Component cho admin tạo/sửa phòng
 * - Auto geocoding theo address (debounce 800ms)
 * - Marker tự cập nhật + draggable
 * - Click map để chỉnh tay
 * - flyTo + zoom khi geocode
 * - useRef để giữ map instance, tránh re-render
 */
export default function MapPicker({ address, value, onChange }: MapPickerProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [geocoding, setGeocoding] = useState(false);
  const [geocodeError, setGeocodeError] = useState<string | null>(null);
  const lastGeocodedAddress = useRef<string>("");

  // Init map chỉ 1 lần
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const initialCenter: [number, number] =
      value.lng !== 0 || value.lat !== 0
        ? [value.lng, value.lat]
        : DEFAULT_CENTER;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: initialCenter,
      zoom: value.lng !== 0 || value.lat !== 0 ? 15 : 12,
    });

    map.addControl(new mapboxgl.NavigationControl(), "top-right");

    // Marker draggable
    const marker = new mapboxgl.Marker({
      color: "#003e68",
      draggable: true,
    })
      .setLngLat(initialCenter)
      .addTo(map);

    // Khi drag marker xong → update state
    marker.on("dragend", () => {
      const lngLat = marker.getLngLat();
      onChange({ lat: lngLat.lat, lng: lngLat.lng });
    });

    // Click map → di chuyển marker + update state
    map.on("click", (e) => {
      const { lng, lat } = e.lngLat;
      marker.setLngLat([lng, lat]);
      onChange({ lat, lng });
    });

    mapRef.current = map;
    markerRef.current = marker;

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync marker khi value thay đổi từ bên ngoài (vd: edit room)
  useEffect(() => {
    if (!markerRef.current || !mapRef.current) return;
    if (value.lng === 0 && value.lat === 0) return;

    const current = markerRef.current.getLngLat();
    if (
      Math.abs(current.lng - value.lng) > 0.00001 ||
      Math.abs(current.lat - value.lat) > 0.00001
    ) {
      markerRef.current.setLngLat([value.lng, value.lat]);
      mapRef.current.flyTo({
        center: [value.lng, value.lat],
        zoom: 15,
        duration: 1200,
      });
    }
  }, [value.lng, value.lat]);

  // Auto geocode khi address thay đổi (debounce 800ms)
  const handleGeocode = useCallback(
    async (addr: string) => {
      if (!addr.trim() || addr.trim() === lastGeocodedAddress.current) return;

      setGeocoding(true);
      setGeocodeError(null);

      const coords = await geocodeAddress(addr);

      if (coords) {
        lastGeocodedAddress.current = addr.trim();
        onChange({ lat: coords.lat, lng: coords.lng });

        // flyTo + update marker
        if (mapRef.current && markerRef.current) {
          markerRef.current.setLngLat([coords.lng, coords.lat]);
          mapRef.current.flyTo({
            center: [coords.lng, coords.lat],
            zoom: 15,
            duration: 1500,
          });
        }
        setGeocodeError(null);
      } else {
        setGeocodeError("Không tìm thấy vị trí. Hãy chỉnh tay trên bản đồ.");
      }

      setGeocoding(false);
    },
    [onChange]
  );

  useEffect(() => {
    if (!address.trim()) return;

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      handleGeocode(address);
    }, 800);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [address, handleGeocode]);

  return (
    <div className="map-picker-container">
      <div className="map-picker-label">
        <span className="map-picker-icon"><RiMapPin2Line size={15} /></span>
        <span>Vị trí trên bản đồ</span>
        {geocoding && (
          <span className="map-picker-loading">
            <span className="map-picker-spinner" /> Đang tìm vị trí...
          </span>
        )}
      </div>

      {geocodeError && (
        <div className="map-picker-error">
          ⚠️ {geocodeError}
        </div>
      )}

      <div
        ref={mapContainerRef}
        className="map-picker-map"
      />

      <div className="map-picker-hint">
        💡 Kéo thả marker hoặc click trên bản đồ để chỉnh vị trí thủ công
      </div>

      <div className="map-picker-coords">
        <div className="map-picker-coord-field">
          <label>Latitude</label>
          <input
            type="text"
            value={value.lat !== 0 ? value.lat.toFixed(6) : "—"}
            readOnly
          />
        </div>
        <div className="map-picker-coord-field">
          <label>Longitude</label>
          <input
            type="text"
            value={value.lng !== 0 ? value.lng.toFixed(6) : "—"}
            readOnly
          />
        </div>
      </div>
    </div>
  );
}
