import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { MAPBOX_TOKEN, getDirectionsUrl } from "../../utils/mapbox";
import { RiMapPin2Line } from "react-icons/ri";

mapboxgl.accessToken = MAPBOX_TOKEN;

interface MapViewProps {
  /** Latitude */
  lat: number;
  /** Longitude */
  lng: number;
  /** Địa chỉ đầy đủ */
  address: string;
  /** Tên phòng */
  roomName?: string;
}

/**
 * MapView — Component read-only hiển thị vị trí phòng trên RoomDetail
 * - Marker không draggable
 * - Zoom tới vị trí phòng
 * - Hiển thị address + button "Xem đường đi"
 */
export default function MapView({ lat, lng, address, roomName }: MapViewProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    if (lat === 0 && lng === 0) return;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [lng, lat],
      zoom: 15,
      interactive: true,
    });

    map.addControl(new mapboxgl.NavigationControl(), "top-right");

    // Marker cố định (không draggable)
    new mapboxgl.Marker({ color: "#003e68" })
      .setLngLat([lng, lat])
      .setPopup(
        new mapboxgl.Popup({ offset: 25 }).setHTML(
          `<div style="padding:4px 8px">
            <strong style="color:#003e68">${roomName || "Phòng"}</strong>
            <div style="font-size:0.8rem;color:#667085;margin-top:2px">${address}</div>
          </div>`
        )
      )
      .addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [lat, lng, address, roomName]);

  if (lat === 0 && lng === 0) return null;

  return (
    <div className="rd-location-section">
      <h3 className="rd-section-title"><RiMapPin2Line size={15} /> Vị trí căn hộ</h3>

      <div className="map-view-card">
        <div
          ref={mapContainerRef}
          className="map-view-map"
        />

        <div className="map-view-info">
          <div className="map-view-address">
            <span className="map-view-address-icon"><RiMapPin2Line size={15} /></span>
            <span>{address}</span>
          </div>

          <a
            href={getDirectionsUrl(lat, lng)}
            target="_blank"
            rel="noopener noreferrer"
            className="map-view-directions-btn"
          >
            🧭 Xem đường đi
          </a>
        </div>
      </div>
    </div>
  );
}
