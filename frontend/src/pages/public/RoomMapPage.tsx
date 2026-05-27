import { useState, useEffect, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { getRoomsForMap, getNearbyRooms } from "../../api/room.service";
import type { RoomMapItem, NearbyRoom } from "../../api/room.service";
import RoomMap from "../../components/map/RoomMap";
import Spinner from "../../components/ui/Spinner";
import { RiMapPin2Line } from "react-icons/ri";
import { formatDistance } from "../../utils/mapbox";

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  available: { label: "Còn phòng", color: "#088373", bg: "#bef2e8" },
  occupied: { label: "Đã thuê", color: "#dc2626", bg: "#fee2e2" },
  maintenance: { label: "Đang sửa", color: "#d97706", bg: "#fef3c7" },
};

function formatPrice(price: number): string {
  if (price >= 1_000_000) return (price / 1_000_000).toFixed(1).replace(".0", "") + "tr";
  if (price >= 1_000) return (price / 1_000).toFixed(0) + "k";
  return price.toString();
}

export default function RoomMapPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [rooms, setRooms] = useState<RoomMapItem[]>([]);
  const [nearbyRooms, setNearbyRooms] = useState<NearbyRoom[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  const districtFilter = searchParams.get("district") ?? "";
  const typeFilter = searchParams.get("type") ?? "";

  // Fetch rooms for map
  useEffect(() => {
    setLoading(true);
    const filter: Record<string, string> = {};
    if (districtFilter) filter.district = districtFilter;
    if (typeFilter) filter.type = typeFilter;

    getRoomsForMap(filter)
      .then((data) => {
        setRooms(data);
        setNearbyRooms(null); // Reset nearby khi filter thay đổi
      })
      .catch(() => setError("Không thể tải danh sách phòng."))
      .finally(() => setLoading(false));
  }, [districtFilter, typeFilter]);

  const updateFilter = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next);
  };

  // Tìm phòng gần tôi
  const handleNearby = useCallback(() => {
    if (!navigator.geolocation) {
      alert("Trình duyệt không hỗ trợ định vị.");
      return;
    }

    setNearbyLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        setUserLocation({ lat, lng });

        try {
          const result = await getNearbyRooms(lng, lat, 5000, 1, 50);
          setNearbyRooms(result.rooms);
          // Cập nhật rooms cho map
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
  }, []);

  // Quay về xem tất cả
  const handleResetNearby = () => {
    setNearbyRooms(null);
    setUserLocation(null);
    setSearchParams({});
  };

  const displayRooms = nearbyRooms ?? rooms;

  return (
    <div className="room-map-page">
      {/* Top bar */}
      <div className="room-map-topbar">
        <div className="room-map-topbar-left">
          <Link to="/rooms" className="room-map-back-link">← Danh sách</Link>
          <h2 className="room-map-title">Tìm phòng trên bản đồ</h2>
          <span className="room-map-count">
            {displayRooms.length} phòng
          </span>
        </div>

        <div className="room-map-topbar-filters">
          <select
            value={districtFilter}
            onChange={(e) => updateFilter("district", e.target.value)}
            className="room-map-filter-select"
          >
            <option value="">Tất cả khu vực</option>
            <option value="Quận Hà Đông">Quận Hà Đông</option>
            <option value="Quận Nam Từ Liêm">Quận Nam Từ Liêm</option>
            <option value="Quận Long Biên">Quận Long Biên</option>
            <option value="Quận Thanh Xuân">Quận Thanh Xuân</option>
          </select>

          <select
            value={typeFilter}
            onChange={(e) => updateFilter("type", e.target.value)}
            className="room-map-filter-select"
          >
            <option value="">Loại phòng</option>
            <option value="Studio">Studio</option>
            <option value="1 phòng ngủ">1 phòng ngủ</option>
            <option value="Chung cư mini">Chung cư mini</option>
            <option value="Phòng trọ thường">Phòng trọ thường</option>
          </select>

          {nearbyRooms ? (
            <button className="room-map-nearby-btn room-map-nearby-btn--reset" onClick={handleResetNearby}>
              ✕ Bỏ lọc gần tôi
            </button>
          ) : (
            <button
              className="room-map-nearby-btn"
              onClick={handleNearby}
              disabled={nearbyLoading}
            >
              {nearbyLoading ? "⏳ Đang tìm..." : "📍 Tìm phòng gần tôi"}
            </button>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="room-map-body">
        {/* Left: Room list */}
        <div className="room-map-sidebar">
          {loading ? (
            <div style={{ padding: "40px", textAlign: "center" }}>
              <Spinner />
            </div>
          ) : error ? (
            <div className="alert alert-error" style={{ margin: "16px" }}>{error}</div>
          ) : displayRooms.length === 0 ? (
            <div className="room-map-empty">
              <span className="room-map-empty-icon">🏠</span>
              <p>Không tìm thấy phòng nào</p>
              {nearbyRooms && (
                <button className="room-map-nearby-btn" onClick={handleResetNearby}>
                  Xem tất cả phòng
                </button>
              )}
            </div>
          ) : (
            <div className="room-map-list">
              {displayRooms.map((room) => {
                const s = STATUS_MAP[room.status] || STATUS_MAP.available;
                const isNearby = "distance" in room;
                const dist = isNearby ? (room as NearbyRoom).distance : null;

                return (
                  <div
                    key={room._id}
                    className={`room-map-card ${selectedRoomId === room._id ? "room-map-card--selected" : ""}`}
                    onClick={() => setSelectedRoomId(room._id)}
                    onMouseEnter={() => setSelectedRoomId(room._id)}
                  >
                    <div className="room-map-card-header">
                      <div className="room-map-card-name">{room.name}</div>
                      <span
                        className="room-map-card-status"
                        style={{ color: s.color, background: s.bg }}
                      >
                        {s.label}
                      </span>
                    </div>

                    <div className="room-map-card-address">
                      <RiMapPin2Line size={13} /> {room.address}
                    </div>

                    <div className="room-map-card-footer">
                      <div className="room-map-card-price">
                        <strong>{formatPrice(room.price)}</strong>
                        <span>/tháng</span>
                      </div>
                      <div className="room-map-card-meta">
                        {room.area}m² • {room.type}
                      </div>
                    </div>

                    {dist !== null && (
                      <div className="room-map-card-distance">
                        📏 {formatDistance(dist)}
                      </div>
                    )}

                    <Link
                      to={`/rooms/${room._id}`}
                      className="room-map-card-link"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Xem chi tiết →
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Map */}
        <div className="room-map-main">
          <RoomMap
            rooms={displayRooms}
            selectedRoomId={selectedRoomId}
            onMarkerClick={setSelectedRoomId}
            userLocation={userLocation}
          />
        </div>
      </div>
    </div>
  );
}
