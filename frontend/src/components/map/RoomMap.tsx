import { useEffect, useRef, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { MAPBOX_TOKEN, DEFAULT_CENTER, DEFAULT_ZOOM } from "../../utils/mapbox";
import type { RoomMapItem } from "../../api/room.service";

mapboxgl.accessToken = MAPBOX_TOKEN;

interface RoomMapProps {
  /** Danh sách phòng cần render markers */
  rooms: RoomMapItem[];
  /** Room ID đang được chọn/hover (optional) */
  selectedRoomId?: string | null;
  /** Callback khi click marker */
  onMarkerClick?: (roomId: string) => void;
  /** Vị trí user (optional - hiển thị marker xanh dương) */
  userLocation?: { lat: number; lng: number } | null;
  /** CSS height */
  height?: string;
}

const STATUS_COLORS: Record<string, string> = {
  available: "#088373",
  occupied: "#d92d20",
  maintenance: "#d97706",
};

function formatPrice(price: number): string {
  if (price >= 1_000_000) return (price / 1_000_000).toFixed(1).replace(".0", "") + "tr";
  if (price >= 1_000) return (price / 1_000).toFixed(0) + "k";
  return price.toString();
}

const STATUS_LABELS: Record<string, string> = {
  available: "Còn phòng",
  occupied: "Đã thuê",
  maintenance: "Đang sửa",
};

/**
 * RoomMap — Component hiển thị nhiều markers trên map
 * Dùng cho trang tìm phòng trên bản đồ (Airbnb-style)
 */
export default function RoomMap({
  rooms,
  selectedRoomId,
  onMarkerClick,
  userLocation,
  height = "100%",
}: RoomMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const userMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const popupsRef = useRef<mapboxgl.Popup[]>([]);

  // Cleanup markers
  const clearMarkers = useCallback(() => {
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
    popupsRef.current.forEach((p) => p.remove());
    popupsRef.current = [];
  }, []);

  // Init map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
    });

    map.addControl(new mapboxgl.NavigationControl(), "top-right");
    mapRef.current = map;

    return () => {
      clearMarkers();
      map.remove();
      mapRef.current = null;
    };
  }, [clearMarkers]);

  // Render markers khi rooms thay đổi
  useEffect(() => {
    if (!mapRef.current) return;
    clearMarkers();

    const bounds = new mapboxgl.LngLatBounds();
    let hasValidBounds = false;

    rooms.forEach((room) => {
      if (!room.location?.coordinates) return;
      const [lng, lat] = room.location.coordinates;
      if (lng === 0 && lat === 0) return;

      const statusColor = STATUS_COLORS[room.status] || "#667085";
      const statusLabel = STATUS_LABELS[room.status] || room.status;

      // Custom marker element
      const el = document.createElement("div");
      el.className = "room-map-marker";
      el.style.cssText = `
        background: ${statusColor};
        color: white;
        padding: 4px 10px;
        border-radius: 20px;
        font-size: 0.75rem;
        font-weight: 700;
        cursor: pointer;
        box-shadow: 0 2px 8px rgba(0,0,0,0.25);
        white-space: nowrap;
        transition: transform 0.15s;
        border: 2px solid white;
      `;
      el.textContent = `${formatPrice(room.price)}`;
      el.addEventListener("mouseenter", () => {
        el.style.transform = "scale(1.15)";
        el.style.zIndex = "10";
      });
      el.addEventListener("mouseleave", () => {
        el.style.transform = "scale(1)";
        el.style.zIndex = "1";
      });

      // Popup
      const popup = new mapboxgl.Popup({
        offset: 25,
        closeButton: true,
        maxWidth: "280px",
      }).setHTML(`
        <div style="padding:8px 4px">
          <div style="font-weight:800;font-size:0.95rem;color:#101828;margin-bottom:4px">${room.name}</div>
          <div style="font-size:0.8rem;color:#667085;margin-bottom:6px">📍 ${room.address}</div>
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
            <span style="font-weight:700;color:#003e68">${room.price.toLocaleString("vi-VN")} đ/tháng</span>
            <span style="font-size:0.7rem;padding:2px 6px;border-radius:4px;background:${statusColor}20;color:${statusColor};font-weight:700">${statusLabel}</span>
          </div>
          <a href="/rooms/${room._id}" style="display:block;margin-top:8px;text-align:center;background:#003e68;color:white;padding:6px 12px;border-radius:6px;text-decoration:none;font-size:0.8rem;font-weight:600">Xem chi tiết →</a>
        </div>
      `);

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([lng, lat])
        .setPopup(popup)
        .addTo(mapRef.current!);

      el.addEventListener("click", () => {
        onMarkerClick?.(room._id);
      });

      markersRef.current.push(marker);
      popupsRef.current.push(popup);

      bounds.extend([lng, lat]);
      hasValidBounds = true;
    });

    // Fit bounds nếu có markers
    if (hasValidBounds && mapRef.current) {
      mapRef.current.fitBounds(bounds, {
        padding: { top: 50, bottom: 50, left: 50, right: 50 },
        maxZoom: 15,
        duration: 1000,
      });
    }
  }, [rooms, clearMarkers, onMarkerClick]);

  // Highlight selected room
  useEffect(() => {
    if (!mapRef.current || !selectedRoomId) return;

    const selectedRoom = rooms.find((r) => r._id === selectedRoomId);
    if (!selectedRoom?.location?.coordinates) return;

    const [lng, lat] = selectedRoom.location.coordinates;
    if (lng === 0 && lat === 0) return;

    mapRef.current.flyTo({
      center: [lng, lat],
      zoom: 16,
      duration: 1200,
    });

    // Open popup for selected room
    const idx = rooms.findIndex((r) => r._id === selectedRoomId);
    if (idx >= 0 && markersRef.current[idx]) {
      markersRef.current[idx].togglePopup();
    }
  }, [selectedRoomId, rooms]);

  // User location marker
  useEffect(() => {
    if (!mapRef.current) return;

    if (userMarkerRef.current) {
      userMarkerRef.current.remove();
      userMarkerRef.current = null;
    }

    if (userLocation) {
      const el = document.createElement("div");
      el.style.cssText = `
        width: 16px;
        height: 16px;
        background: #3b82f6;
        border: 3px solid white;
        border-radius: 50%;
        box-shadow: 0 0 0 4px rgba(59,130,246,0.3), 0 2px 8px rgba(0,0,0,0.2);
      `;

      userMarkerRef.current = new mapboxgl.Marker({ element: el })
        .setLngLat([userLocation.lng, userLocation.lat])
        .setPopup(
          new mapboxgl.Popup({ offset: 15 }).setHTML(
            '<div style="padding:4px 8px;font-weight:600;color:#3b82f6">📍 Vị trí của bạn</div>'
          )
        )
        .addTo(mapRef.current);
    }
  }, [userLocation]);

  return (
    <div
      ref={mapContainerRef}
      className="room-map-container"
      style={{ height, width: "100%" }}
    />
  );
}
