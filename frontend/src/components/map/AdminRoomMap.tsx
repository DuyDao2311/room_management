/**
 * AdminRoomMap — MapBox component cho Admin/Staff Room Map
 * Dùng GeoJSON source + layers cho clustering và performance tối ưu
 */

import { useEffect, useRef, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import type { AdminRoomMapItem } from "../../api/adminRoomMap.service";

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN || "";

// ── Status config ────────────────────────────────────────────────────────────
const STATUS_COLORS: Record<string, string> = {
  available: "#088373",
  occupied: "#dc2626",
  maintenance: "#d97706",
};

const STATUS_LABELS: Record<string, string> = {
  available: "Còn phòng",
  occupied: "Đã thuê",
  maintenance: "Đang sửa",
};

// ── Helper format ────────────────────────────────────────────────────────────
function formatPrice(price: number): string {
  if (price >= 1_000_000) return (price / 1_000_000).toFixed(1).replace(".0", "") + "tr";
  if (price >= 1_000) return (price / 1_000).toFixed(0) + "k";
  return price.toString();
}

function formatPriceFull(price: number): string {
  return price.toLocaleString("vi-VN") + " VNĐ";
}

// ── Props ────────────────────────────────────────────────────────────────────
interface AdminRoomMapProps {
  rooms: AdminRoomMapItem[];
  selectedRoomId?: string | null;
  onMarkerClick?: (roomId: string) => void;
  onPopupClose?: () => void;
}

// ── Build GeoJSON ────────────────────────────────────────────────────────────
function buildGeoJSON(rooms: AdminRoomMapItem[]): GeoJSON.FeatureCollection {
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
          thumbnail: room.images?.[0] || "",
          createdByName: room.createdBy?.name || "",
        },
      })),
  };
}

const SOURCE_ID = "admin-rooms-source";
const CLUSTER_LAYER = "admin-clusters";
const CLUSTER_COUNT_LAYER = "admin-cluster-count";
const UNCLUSTERED_LAYER = "admin-unclustered-point";
const UNCLUSTERED_LABEL = "admin-unclustered-label";

export default function AdminRoomMap({
  rooms,
  selectedRoomId,
  onMarkerClick,
  onPopupClose,
}: AdminRoomMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const popupRef = useRef<mapboxgl.Popup | null>(null);
  const mapLoadedRef = useRef(false);

  // Cleanup popup
  const clearPopup = useCallback(() => {
    if (popupRef.current) {
      popupRef.current.remove();
      popupRef.current = null;
    }
  }, []);

  // ── Init map ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [105.8342, 21.0278],
      zoom: 11,
    });

    map.addControl(new mapboxgl.NavigationControl(), "top-right");
    map.addControl(new mapboxgl.FullscreenControl(), "top-right");

    map.on("load", () => {
      mapLoadedRef.current = true;

      // Add source
      map.addSource(SOURCE_ID, {
        type: "geojson",
        data: buildGeoJSON([]),
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
            "#51bbd6",
            10, "#f1f075",
            30, "#f28cb1",
          ],
          "circle-radius": [
            "step",
            ["get", "point_count"],
            18,
            10, 24,
            30, 32,
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

      // ── Unclustered points ──
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

      // ── Price labels ──
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
          "text-color": "#1a1a2e",
          "text-halo-color": "#ffffff",
          "text-halo-width": 1.5,
        },
      });

      // ── Cluster click → zoom in ──
      map.on("click", CLUSTER_LAYER, (e) => {
        const features = map.queryRenderedFeatures(e.point, { layers: [CLUSTER_LAYER] });
        if (!features.length) return;
        const clusterId = features[0].properties?.cluster_id;
        const source = map.getSource(SOURCE_ID) as mapboxgl.GeoJSONSource;
        source.getClusterExpansionZoom(clusterId, (err, zoom) => {
          if (err) return;
          const geometry = features[0].geometry;
          if (geometry.type === "Point") {
            map.easeTo({
              center: geometry.coordinates as [number, number],
              zoom: zoom ?? 13,
            });
          }
        });
      });

      // ── Room hover → popup ──
      map.on("mouseenter", UNCLUSTERED_LAYER, (e) => {
        const features = map.queryRenderedFeatures(e.point, { layers: [UNCLUSTERED_LAYER] });
        if (!features.length) return;
        const props = features[0].properties as Record<string, string>;
        // Chỉ trigger hover nếu marker khác với popup đang mở, 
        // hoặc popup đã bị đóng.
        onMarkerClick?.(props.id);
      });

      // ── Cursor style ──
      map.on("mouseenter", CLUSTER_LAYER, () => (map.getCanvas().style.cursor = "pointer"));
      map.on("mouseleave", CLUSTER_LAYER, () => (map.getCanvas().style.cursor = ""));
      map.on("mouseenter", UNCLUSTERED_LAYER, () => (map.getCanvas().style.cursor = "pointer"));
      map.on("mouseleave", UNCLUSTERED_LAYER, () => (map.getCanvas().style.cursor = ""));
    });

    mapRef.current = map;

    return () => {
      mapLoadedRef.current = false;
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Update data when rooms change ─────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || !mapLoadedRef.current) return;
    const source = mapRef.current.getSource(SOURCE_ID) as mapboxgl.GeoJSONSource | undefined;
    if (source) {
      source.setData(buildGeoJSON(rooms));
    }
  }, [rooms]);

  // ── Popup on selectedRoomId ───────────────────────────────────────────────
  useEffect(() => {
    clearPopup();
    if (!selectedRoomId || !mapRef.current || !mapLoadedRef.current) return;

    const room = rooms.find((r) => r._id === selectedRoomId);
    if (!room || !room.location?.coordinates) return;

    const coords = room.location.coordinates;
    if (coords[0] === 0 && coords[1] === 0) return;

    const statusColor = STATUS_COLORS[room.status] || "#667085";
    const statusLabel = STATUS_LABELS[room.status] || room.status;
    const thumbnailHtml = room.images?.[0]
      ? `<img src="${room.images[0]}" class="admin-map-popup-thumb" alt="${room.name}" />`
      : `<div class="admin-map-popup-thumb admin-map-popup-thumb--empty">🏠</div>`;

    popupRef.current = new mapboxgl.Popup({
      offset: 15,
      maxWidth: "300px",
      closeButton: true,
    })
      .setLngLat(coords as [number, number])
      .setHTML(
        `<div class="admin-map-popup">
          ${thumbnailHtml}
          <div class="admin-map-popup-body">
            <div class="admin-map-popup-name">${room.name}</div>
            <div class="admin-map-popup-price">${formatPriceFull(room.price)}/tháng</div>
            <div class="admin-map-popup-address">${room.address}</div>
            <div class="admin-map-popup-meta">${room.area}m² • ${room.type} • ${room.district}</div>
            <span class="admin-map-popup-status" style="background:${statusColor}15;color:${statusColor};border:1px solid ${statusColor}30">
              ${statusLabel}
            </span>
            <div class="admin-map-popup-actions">
              <a href="/rooms/${room._id}" target="_blank" class="admin-map-popup-btn">Xem chi tiết</a>
              <a href="/admin/rooms?edit=${room._id}" class="admin-map-popup-btn admin-map-popup-btn--edit">Chỉnh sửa</a>
            </div>
          </div>
        </div>`
      )
      .addTo(mapRef.current);

    // Bắt sự kiện khi người dùng tự tắt popup (bấm dấu x)
    popupRef.current.on('close', () => {
      onPopupClose?.();
    });

    mapRef.current.flyTo({
      center: coords as [number, number],
      zoom: Math.max(mapRef.current.getZoom(), 14),
      essential: true,
    });
  }, [selectedRoomId, rooms, clearPopup]);

  return (
    <div
      ref={mapContainerRef}
      className="admin-map-container"
      style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
    />
  );
}
