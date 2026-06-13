/**
 * AdminRoomMapPage — Trang bản đồ phòng cho Admin/Staff
 * Layout: Filter topbar + Fullscreen Map (không footer, không scroll)
 */

import { useAdminRoomMap } from "../../hooks/useAdminRoomMap";
import { useAuth } from "../../contexts/AuthContext";
import AdminRoomMap from "../../components/map/AdminRoomMap";
import Spinner from "../../components/ui/Spinner";

const STATUS_OPTIONS = [
  { value: "", label: "Tất cả trạng thái" },
  { value: "available", label: "Còn phòng" },
  { value: "occupied", label: "Đã thuê" },
  { value: "maintenance", label: "Đang sửa" },
];

const TYPE_OPTIONS = [
  { value: "", label: "Tất cả loại" },
  { value: "Studio", label: "Studio" },
  { value: "1 phòng ngủ", label: "1 phòng ngủ" },
  { value: "Chung cư mini", label: "Chung cư mini" },
  { value: "Phòng trọ thường", label: "Phòng trọ thường" },
];

const PRICE_OPTIONS = [
  { value: "", label: "Tất cả mức giá" },
  { value: "0-3000000", label: "Dưới 3 triệu" },
  { value: "3000000-5000000", label: "3 – 5 triệu" },
  { value: "5000000-", label: "Trên 5 triệu" },
];

export default function AdminRoomMapPage() {
  const { user } = useAuth();
  const {
    rooms,
    loading,
    error,
    filters,
    updateFilter,
    resetFilters,
    selectedRoomId,
    setSelectedRoomId,
  } = useAdminRoomMap();

  // Lấy danh sách district cho admin (tất cả), staff (chỉ managedDistricts)
  const districtOptions =
    user?.role === "staff" && user.managedDistricts
      ? user.managedDistricts
      : ["Quận Hà Đông", "Quận Nam Từ Liêm", "Quận Long Biên", "Quận Thanh Xuân"];

  // Xử lý price filter compound (min-max)
  const handlePriceChange = (value: string) => {
    if (!value) {
      updateFilter("priceMin", "");
      updateFilter("priceMax", "");
      return;
    }
    const [min, max] = value.split("-");
    updateFilter("priceMin", min || "");
    updateFilter("priceMax", max || "");
  };

  // Reconstruct price value from priceMin/priceMax
  const currentPriceValue = filters.priceMin || filters.priceMax
    ? `${filters.priceMin}-${filters.priceMax}`
    : "";

  // Đếm filter đang active
  const activeFilterCount = [
    filters.district,
    filters.status,
    filters.type,
    filters.priceMin || filters.priceMax,
  ].filter(Boolean).length;

  // Đếm theo status
  const availableCount = rooms.filter((r) => r.status === "available").length;
  const occupiedCount = rooms.filter((r) => r.status === "occupied").length;
  const maintenanceCount = rooms.filter((r) => r.status === "maintenance").length;

  return (
    <div className="admin-map-page">
      {/* ── Top bar ────────────────────────────────────────────────────────── */}
      <div className="admin-map-topbar">
        <div className="admin-map-topbar-left">
          <h2 className="admin-map-title">🗺️ Bản đồ phòng</h2>
          <div className="admin-map-stats">
            <span className="admin-map-stat admin-map-stat--total">{rooms.length} phòng</span>
            <span className="admin-map-stat admin-map-stat--available">🟢 {availableCount}</span>
            <span className="admin-map-stat admin-map-stat--occupied">🔴 {occupiedCount}</span>
            <span className="admin-map-stat admin-map-stat--maintenance">🟡 {maintenanceCount}</span>
          </div>
        </div>

        <div className="admin-map-topbar-filters">
          {/* District */}
          <select
            value={filters.district}
            onChange={(e) => updateFilter("district", e.target.value)}
            className="admin-map-filter-select"
          >
            <option value="">Tất cả khu vực</option>
            {districtOptions.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>

          {/* Status */}
          <select
            value={filters.status}
            onChange={(e) => updateFilter("status", e.target.value)}
            className="admin-map-filter-select"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>

          {/* Type */}
          <select
            value={filters.type}
            onChange={(e) => updateFilter("type", e.target.value)}
            className="admin-map-filter-select"
          >
            {TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>

          {/* Price */}
          <select
            value={currentPriceValue}
            onChange={(e) => handlePriceChange(e.target.value)}
            className="admin-map-filter-select"
          >
            {PRICE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>

          {/* Reset */}
          {activeFilterCount > 0 && (
            <button className="admin-map-reset-btn" onClick={resetFilters}>
              ✕ Xoá lọc ({activeFilterCount})
            </button>
          )}
        </div>
      </div>

      {/* ── Map body ──────────────────────────────────────────────────────── */}
      <div className="admin-map-body">
        {loading && (
          <div className="admin-map-loading-overlay">
            <Spinner />
          </div>
        )}

        {error && (
          <div className="admin-map-error-overlay">
            <div className="alert alert-error">{error}</div>
          </div>
        )}

        <AdminRoomMap
          rooms={rooms}
          selectedRoomId={selectedRoomId}
          onMarkerClick={setSelectedRoomId}
          onPopupClose={() => setSelectedRoomId(null)}
        />
      </div>
    </div>
  );
}
