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

const STATUS_LABELS: Record<string, string> = {
  available: "Còn phòng",
  occupied: "Đã thuê",
  maintenance: "Đang sửa",
};

function formatPrice(price: number): string {
  if (price >= 1_000_000) return (price / 1_000_000).toFixed(1).replace(".0", "") + "tr";
  if (price >= 1_000) return (price / 1_000).toFixed(0) + "k";
  return price.toString();
}

function formatPriceFull(price: number): string {
  return price.toLocaleString("vi-VN") + " đ/tháng";
}

/**
 * Chuyển rooms thành GeoJSON FeatureCollection cho MapBox clustering
 */
function roomsToGeoJSON(rooms: RoomMapItem[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: rooms
      .filter(
        (r) =>
          r.location?.coordinates &&
          !(r.location.coordinates[0] === 0 && r.location.coordinates[1] === 0)
      )
      .map((room) => ({
        type: "Feature" as const,
        geometry: {
          type: "Point" as const,
          coordinates: room.location.coordinates,
        },
        properties: {
          id: room._id,
          name: room.name,
          price: room.price,
          priceLabel: formatPrice(room.price),
          priceFull: formatPriceFull(room.price),
          status: room.status,
          statusLabel: STATUS_LABELS[room.status] || room.status,
          statusColor: STATUS_COLORS[room.status] || "#667085",
          address: room.address,
          type: room.type,
          area: room.area,
          district: room.district,
          thumbnail:
            (room as RoomMapItem & { images?: string[] }).images?.[0] || "",
        },
      })),
  };
}

const SOURCE_ID = "rooms-source";
const CLUSTER_LAYER = "clusters";
const CLUSTER_COUNT_LAYER = "cluster-count";
const UNCLUSTERED_LAYER = "unclustered-point";
const UNCLUSTERED_LABEL = "unclustered-label";

/**
 * RoomMap — Component hiển thị nhiều markers trên map với clustering
 * Dùng GeoJSON source + layers cho performance tốt nhất
 */
export default function RoomMap({
  rooms,
  selectedRoomId,
  onMarkerClick,
  userLocation,
  // height = "100%",
}: RoomMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const userMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const popupRef = useRef<mapboxgl.Popup | null>(null);
  const mapLoadedRef = useRef(false);

  // Cleanup popup
  const clearPopup = useCallback(() => {
    if (popupRef.current) {
      popupRef.current.remove();
      popupRef.current = null;
    }
  }, []);

  // Cleanup source + layers
  const clearSourceAndLayers = useCallback((map: mapboxgl.Map) => {
    clearPopup();
    const layers = [UNCLUSTERED_LABEL, UNCLUSTERED_LAYER, CLUSTER_COUNT_LAYER, CLUSTER_LAYER];
    layers.forEach((id) => {
      if (map.getLayer(id)) map.removeLayer(id);
    });
    if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
  }, [clearPopup]);

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

    map.on("load", () => {
      mapLoadedRef.current = true;
    });

    mapRef.current = map;

    return () => {
      mapLoadedRef.current = false;
      clearPopup();
      if (userMarkerRef.current) {
        userMarkerRef.current.remove();
        userMarkerRef.current = null;
      }
      map.remove();
      mapRef.current = null;
    };
  }, [clearPopup]);

  // ── Add/update GeoJSON source + cluster layers ──────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const applyData = () => {
      const geojson = roomsToGeoJSON(rooms);

      // Nếu source đã tồn tại → chỉ update data
      const existingSource = map.getSource(SOURCE_ID) as mapboxgl.GeoJSONSource | undefined;
      if (existingSource) {
        existingSource.setData(geojson);
      } else {
        // Tạo source mới + layers
        map.addSource(SOURCE_ID, {
          type: "geojson",
          data: geojson,
          cluster: true,
          clusterMaxZoom: 14,
          clusterRadius: 50,
        });

        // ── Cluster circles ──
        map.addLayer({
          id: CLUSTER_LAYER,
          type: "circle",
          source: SOURCE_ID,
          filter: ["has", "point_count"],
          paint: {
            "circle-color": [
              "step",
              ["get", "point_count"],
              "#088373",   // < 10: teal
              10,
              "#0f5cc7",   // 10-30: blue
              30,
              "#003e68",   // 30+: dark blue
            ],
            "circle-radius": [
              "step",
              ["get", "point_count"],
              20,    // < 10: radius 20
              10,
              25,    // 10-30: radius 25
              30,
              32,    // 30+: radius 32
            ],
            "circle-stroke-width": 3,
            "circle-stroke-color": "#ffffff",
            "circle-opacity": 0.9,
          },
        });

        // ── Cluster count text ──
        map.addLayer({
          id: CLUSTER_COUNT_LAYER,
          type: "symbol",
          source: SOURCE_ID,
          filter: ["has", "point_count"],
          layout: {
            "text-field": ["get", "point_count_abbreviated"],
            "text-font": ["DIN Offc Pro Medium", "Arial Unicode MS Bold"],
            "text-size": 13,
          },
          paint: {
            "text-color": "#ffffff",
          },
        });

        // ── Unclustered points (individual rooms) ──
        map.addLayer({
          id: UNCLUSTERED_LAYER,
          type: "circle",
          source: SOURCE_ID,
          filter: ["!", ["has", "point_count"]],
          paint: {
            "circle-color": ["get", "statusColor"],
            "circle-radius": 8,
            "circle-stroke-width": 2.5,
            "circle-stroke-color": "#ffffff",
          },
        });

        // ── Price labels on unclustered points ──
        map.addLayer({
          id: UNCLUSTERED_LABEL,
          type: "symbol",
          source: SOURCE_ID,
          filter: ["!", ["has", "point_count"]],
          layout: {
            "text-field": ["get", "priceLabel"],
            "text-font": ["DIN Offc Pro Bold", "Arial Unicode MS Bold"],
            "text-size": 11,
            "text-offset": [0, -1.8],
            "text-anchor": "bottom",
          },
          paint: {
            "text-color": ["get", "statusColor"],
            "text-halo-color": "#ffffff",
            "text-halo-width": 1.5,
          },
        });
      }

      // Fit bounds
      const coords = rooms
        .filter((r) => r.location?.coordinates && !(r.location.coordinates[0] === 0 && r.location.coordinates[1] === 0))
        .map((r) => r.location.coordinates as [number, number]);

      if (coords.length > 0) {
        const bounds = new mapboxgl.LngLatBounds();
        coords.forEach((c) => bounds.extend(c));
        map.fitBounds(bounds, {
          padding: { top: 50, bottom: 50, left: 50, right: 50 },
          maxZoom: 15,
          duration: 1000,
        });
      }
    };

    if (mapLoadedRef.current) {
      applyData();
    } else {
      map.on("load", applyData);
    }

    return () => {
      // Không remove source ở đây vì sẽ được update
    };
  }, [rooms, clearSourceAndLayers]);

  // ── Click handlers cho cluster + unclustered ──────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Click cluster → zoom in
    const handleClusterClick = (e: mapboxgl.MapMouseEvent & { features?: mapboxgl.GeoJSONFeature[] }) => {
      const features = map.queryRenderedFeatures(e.point, { layers: [CLUSTER_LAYER] });
      if (!features.length) return;

      const clusterId = features[0].properties?.cluster_id;
      const source = map.getSource(SOURCE_ID) as mapboxgl.GeoJSONSource;
      source.getClusterExpansionZoom(clusterId, (err: unknown, zoom: number | null | undefined) => {
        if (err || zoom == null) return;
        const geometry = features[0].geometry as GeoJSON.Point;
        map.easeTo({
          center: geometry.coordinates as [number, number],
          zoom: zoom,
        });
      });
    };

    // Click unclustered point → show popup
    const handlePointClick = (e: mapboxgl.MapMouseEvent & { features?: mapboxgl.GeoJSONFeature[] }) => {
      const features = map.queryRenderedFeatures(e.point, { layers: [UNCLUSTERED_LAYER] });
      if (!features.length) return;

      const props = features[0].properties!;
      const geometry = features[0].geometry as GeoJSON.Point;
      const coords = geometry.coordinates as [number, number];

      // Notify parent
      onMarkerClick?.(props.id);

      // FlyTo
      map.flyTo({ center: coords, zoom: 16, duration: 1200 });

      // Show popup
      clearPopup();

      const thumbnailHtml = props.thumbnail
        ? `<img src="${props.thumbnail}" class="map-popup-thumb" alt="${props.name}" />`
        : `<div class="map-popup-thumb-placeholder">🏠</div>`;

      popupRef.current = new mapboxgl.Popup({
        offset: 15,
        closeButton: true,
        maxWidth: "300px",
        className: "room-map-popup-wrap",
      })
        .setLngLat(coords)
        .setHTML(`
          <div class="map-popup">
            ${thumbnailHtml}
            <div class="map-popup-body">
              <div class="map-popup-name">${props.name}</div>
              <div class="map-popup-address"><RiMapPin2Line size={15} />${props.address}</div>
              <div class="map-popup-row">
                <span class="map-popup-price">${props.priceFull}</span>
                <span class="map-popup-status" style="color:${props.statusColor};background:${props.statusColor}20">${props.statusLabel}</span>
              </div>
              <div class="map-popup-meta">${props.area}m² • ${props.type} • ${props.district}</div>
              <a href="/rooms/${props.id}" class="map-popup-link">Xem chi tiết →</a>
            </div>
          </div>
        `)
        .addTo(map);
    };

    // Hover cursors
    const handleMouseEnterCluster = () => { map.getCanvas().style.cursor = "pointer"; };
    const handleMouseLeaveCluster = () => { map.getCanvas().style.cursor = ""; };
    const handleMouseEnterPoint = () => { map.getCanvas().style.cursor = "pointer"; };
    const handleMouseLeavePoint = () => { map.getCanvas().style.cursor = ""; };

    const setupListeners = () => {
      map.on("click", CLUSTER_LAYER, handleClusterClick);
      map.on("click", UNCLUSTERED_LAYER, handlePointClick);
      map.on("mouseenter", CLUSTER_LAYER, handleMouseEnterCluster);
      map.on("mouseleave", CLUSTER_LAYER, handleMouseLeaveCluster);
      map.on("mouseenter", UNCLUSTERED_LAYER, handleMouseEnterPoint);
      map.on("mouseleave", UNCLUSTERED_LAYER, handleMouseLeavePoint);
    };

    if (mapLoadedRef.current) {
      setupListeners();
    } else {
      map.on("load", setupListeners);
    }

    return () => {
      map.off("click", CLUSTER_LAYER, handleClusterClick);
      map.off("click", UNCLUSTERED_LAYER, handlePointClick);
      map.off("mouseenter", CLUSTER_LAYER, handleMouseEnterCluster);
      map.off("mouseleave", CLUSTER_LAYER, handleMouseLeaveCluster);
      map.off("mouseenter", UNCLUSTERED_LAYER, handleMouseEnterPoint);
      map.off("mouseleave", UNCLUSTERED_LAYER, handleMouseLeavePoint);
    };
  }, [onMarkerClick, clearPopup]);

  // ── Highlight selected room: flyTo + open popup ──────────────
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

    // Show popup for selected room
    clearPopup();
    const props = {
      ...selectedRoom,
      statusLabel: STATUS_LABELS[selectedRoom.status] || selectedRoom.status,
      statusColor: STATUS_COLORS[selectedRoom.status] || "#667085",
      priceFull: formatPriceFull(selectedRoom.price),
    };
    const thumbnail = (selectedRoom as RoomMapItem & { images?: string[] }).images?.[0] || "";
    const thumbnailHtml = thumbnail
      ? `<img src="${thumbnail}" class="map-popup-thumb" alt="${props.name}" />`
      : `<div class="map-popup-thumb-placeholder">🏠</div>`;

    popupRef.current = new mapboxgl.Popup({
      offset: 15,
      closeButton: true,
      maxWidth: "300px",
      className: "room-map-popup-wrap",
    })
      .setLngLat([lng, lat])
      .setHTML(`
        <div class="map-popup">
          ${thumbnailHtml}
          <div class="map-popup-body">
            <div class="map-popup-name">${props.name}</div>
            <div class="map-popup-address">📍 ${props.address}</div>
            <div class="map-popup-row">
              <span class="map-popup-price">${props.priceFull}</span>
              <span class="map-popup-status" style="color:${props.statusColor};background:${props.statusColor}20">${props.statusLabel}</span>
            </div>
            <div class="map-popup-meta">${props.area}m² • ${props.type} • ${props.district}</div>
            <a href="/rooms/${props._id}" class="map-popup-link">Xem chi tiết →</a>
          </div>
        </div>
      `)
      .addTo(mapRef.current);
  }, [selectedRoomId, rooms, clearPopup]);

  // ── User location marker ──────────────────────────────────
  useEffect(() => {
    if (!mapRef.current) return;

    if (userMarkerRef.current) {
      userMarkerRef.current.remove();
      userMarkerRef.current = null;
    }

    if (userLocation) {
      const el = document.createElement("div");
      el.className = "user-location-marker";
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
            '<div style="padding:4px 8px;font-weight:600;color:#3b82f6">Vị trí của bạn</div>'
          )
        )
        .addTo(mapRef.current);

      mapRef.current.flyTo({
        center: [userLocation.lng, userLocation.lat],
        zoom: 14,
        essential: true,
      });
    }
  }, [userLocation]);

  return (
    <div
      ref={mapContainerRef}
      className="room-map-container"
      style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
    />
  );
}
