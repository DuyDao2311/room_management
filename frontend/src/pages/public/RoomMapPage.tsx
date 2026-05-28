import { Link } from "react-router-dom";
import { useMapRooms } from "../../hooks/useMapRooms";
import RoomMap from "../../components/map/RoomMap";
import Spinner from "../../components/ui/Spinner";

export default function RoomMapPage() {
  const {
    displayRooms,
    loading,
    nearbyLoading,
    error,
    filters,
    updateFilter,
    selectedRoomId,
    setSelectedRoomId,
    userLocation,
    isNearbyMode,
    handleNearby,
    handleResetNearby,
  } = useMapRooms();

  return (
    <div className="room-map-page">
      {/* Top bar */}
      <div className="room-map-topbar">
        <div className="room-map-topbar-left">
          <Link to="/rooms" className="room-map-back-link">← Danh sách</Link>
        </div>

        <div className="room-map-topbar-filters">
          {/* District filter */}
          <select
            value={filters.district}
            onChange={(e) => updateFilter("district", e.target.value)}
            className="room-map-filter-select"
          >
            <option value="">Tất cả khu vực</option>
            <option value="Quận Hà Đông">Quận Hà Đông</option>
            <option value="Quận Nam Từ Liêm">Quận Nam Từ Liêm</option>
            <option value="Quận Long Biên">Quận Long Biên</option>
            <option value="Quận Thanh Xuân">Quận Thanh Xuân</option>
          </select>

          {/* Type filter */}
          <select
            value={filters.type}
            onChange={(e) => updateFilter("type", e.target.value)}
            className="room-map-filter-select"
          >
            <option value="">Loại phòng</option>
            <option value="Studio">Studio</option>
            <option value="1 phòng ngủ">1 phòng ngủ</option>
            <option value="Chung cư mini">Chung cư mini</option>
            <option value="Phòng trọ thường">Phòng trọ thường</option>
          </select>

          {/* Price filter */}
          <select
            value={filters.price}
            onChange={(e) => updateFilter("price", e.target.value)}
            className="room-map-filter-select"
          >
            <option value="">Giá</option>
            <option value="below-3">Dưới 3 triệu</option>
            <option value="3-5">3 - 5 triệu</option>
            <option value="above-5">Trên 5 triệu</option>
          </select>

          {/* Nearby button */}
          {isNearbyMode ? (
            <button className="room-map-nearby-btn room-map-nearby-btn--reset" onClick={handleResetNearby}>
              ✕ Bỏ lọc gần tôi
            </button>
          ) : (
            <button
              className="room-map-nearby-btn"
              onClick={handleNearby}
              disabled={nearbyLoading}
            >
              {nearbyLoading ? "⏳ Đang tìm..." : "Tìm gần tôi"}
            </button>
          )}
        </div>
      </div>

      {/* Main content - Map Only */}
      <div className="room-map-body" style={{ position: "relative", flex: 1, display: "flex", width: "100%", height: "100%" }}>
        {loading && (
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(255,255,255,0.7)", zIndex: 10 }}>
            <Spinner />
          </div>
        )}

        {error && (
          <div style={{ position: "absolute", top: 20, left: "50%", transform: "translateX(-50%)", zIndex: 10 }}>
            <div className="alert alert-error">{error}</div>
          </div>
        )}

        <div className="room-map-main" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}>
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
