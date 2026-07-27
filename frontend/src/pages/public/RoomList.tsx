import { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import api from "../../api/axios.ts";
import Spinner from "../../components/ui/Spinner.tsx";
import FavoriteHeartButton from "../../components/ui/FavoriteHeartButton.tsx";
// import { MdOutlineMeetingRoom, MdLocationOn, MdAttachMoney, MdOutlineGavel } from 'react-icons/md';
import pageHeroImage from '../../image/Gemini_Generated_Image_1v3maq1v3maq1v3m.png';
import { RiMapPin2Line } from "react-icons/ri";
interface Room {
  _id: string;
  name: string;
  address: string;
  price: number;
  area: number;
  type: string;
  status: "available" | "occupied" | "maintenance";
  images: any[];
  amenities: string[];
  rentalMode: string;
  hourlyPrice: number;
  // Promotion pricing fields (gắn bởi backend)
  isPromotion?: boolean;
  originalPrice?: number;
  discountedPrice?: number;
  discountAmount?: number;
  discountPercent?: number;
  promotionName?: string;
  promotionEndDate?: string;
  remainingPromotionDays?: number;
  // Short-term promotion pricing
  originalHourlyPrice?: number;
  discountedHourlyPrice?: number;
}

const STATUS_MAP = {
  available: { label: "Còn phòng", variant: "success" as const },
  occupied: { label: "Đã thuê", variant: "danger" as const },
  maintenance: { label: "Đang sửa", variant: "warning" as const },
};

const formatPrice = (price: number) => {
  if (price >= 1000000)
    return (price / 1000000).toFixed(1).replace(".0", "") + "tr";
  if (price >= 1000) return (price / 1000).toFixed(0) + "k";
  return price.toString();
};

export default function RoomList() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchParams, setSearchParams] = useSearchParams();

  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 9;

  const priceFilter = searchParams.get("price") ?? "";
  const districtFilter = searchParams.get("district") ?? "";
  const typeFilter = searchParams.get("type") ?? "";
  const rentalModeFilter = searchParams.get("rentalMode") ?? "";

  useEffect(() => {
    setLoading(true);
    setError("");
    const params: Record<string, string> = {};
    if (priceFilter) params.price = priceFilter;
    if (districtFilter) params.district = districtFilter;
    if (typeFilter) params.type = typeFilter;
    if (rentalModeFilter) params.rentalMode = rentalModeFilter;

    api
      .get("/rooms", { params })
      .then((res) => {
        const sortedRooms = res.data.sort((a: Room, b: Room) => {
          const statusOrder = { available: 1, maintenance: 2, occupied: 3 };
          return (statusOrder[a.status] || 4) - (statusOrder[b.status] || 4);
        });
        setRooms(sortedRooms);
        setCurrentPage(1); // Reset về trang 1 khi lọc thay đổi
      })
      .catch(() => setError("Không thể tải danh sách phòng. Vui lòng thử lại."))
      .finally(() => setLoading(false));
  }, [priceFilter, districtFilter, typeFilter, rentalModeFilter]);

  const updateFilter = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next);
  };

  return (
    <div className="page-shell">
      <div className="room-list-page">
        <div style={{ marginBottom: '36px', borderRadius: '12px', overflow: 'hidden' }}>
          <img
            src={pageHeroImage}
            alt="Tìm căn hộ"
            style={{ width: '100%', display: 'block', maxHeight: '350px', objectFit: 'cover' }}
          />
        </div>

        {/* Filters */}
        <div className="filter-bar">
          <div className="filter-group">
            <label htmlFor="filter-district">Khu vực</label>
            <select
              id="filter-district"
              value={districtFilter}
              onChange={(e) => updateFilter("district", e.target.value)}
              className="filter-select"
            >
              <option value="">Tất cả quận</option>
              <option value="Quận Hà Đông">Quận Hà Đông</option>
              <option value="Quận Nam Từ Liêm">Quận Nam Từ Liêm</option>
              <option value="Quận Long Biên">Quận Long Biên</option>
              <option value="Quận Thanh Xuân">Quận Thanh Xuân</option>
            </select>
          </div>
          <div className="filter-group">
            <label htmlFor="filter-price">Giá thuê</label>
            <select
              id="filter-price"
              value={priceFilter}
              onChange={(e) => updateFilter("price", e.target.value)}
              className="filter-select"
            >
              <option value="">Tất cả mức giá</option>
              <option value="below-3">Dưới 3tr</option>
              <option value="3-5">3tr - 5tr</option>
              <option value="above-5">Trên 5tr</option>
            </select>
          </div>
          <div className="filter-group">
            <label htmlFor="filter-type">Loại phòng</label>
            <select
              id="filter-type"
              value={typeFilter}
              onChange={(e) => updateFilter("type", e.target.value)}
              className="filter-select"
            >
              <option value="">Tất cả loại phòng</option>
              <option value="Studio">Studio</option>
              <option value="1 phòng ngủ">1 phòng ngủ</option>
              <option value="Chung cư mini">Chung cư mini</option>
              <option value="Phòng trọ thường">Phòng trọ thường</option>
            </select>
          </div>
          <div className="filter-group">
            <label htmlFor="filter-rentalMode">Hình thức thuê</label>
            <select
              id="filter-rentalMode"
              value={rentalModeFilter}
              onChange={(e) => updateFilter("rentalMode", e.target.value)}
              className="filter-select"
            >
              <option value="">Tất cả hình thức</option>
              <option value="short_term">Thuê ngắn hạn</option>
              <option value="long_term">Thuê dài hạn</option>
            </select>
          </div>
        </div>

        {/* Content */}
        {loading && <Spinner label="Đang tải phòng..." />}
        {error && <div className="alert alert-error">{error}</div>}
        {!loading && !error && rooms.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">🏠</div>
            <h3>Không tìm thấy phòng trọ</h3>
            <p>Thử thay đổi bộ lọc hoặc xem tất cả phòng.</p>
            <button
              className="button button-primary"
              onClick={() => setSearchParams({})}
            >
              Xóa bộ lọc
            </button>
          </div>
        )}
        {!loading && rooms.length > 0 && (
          <>
            <div className="design-room-grid">
              {rooms
                .slice(
                  (currentPage - 1) * ITEMS_PER_PAGE,
                  currentPage * ITEMS_PER_PAGE,
                )
                .map((room) => {
                  const amenitiesToDisplay =
                    room.amenities && room.amenities.length > 0
                      ? room.amenities
                      : ["Wifi", "Điều hòa", "Chỗ để xe"];

                  const imageUrl =
                    room.images && room.images.length > 0
                      ? room.images[0]?.url || room.images[0]
                      : "https://vinhomeoceanpark.net/wp-content/uploads/khong-sang-song-hien-dai-tien-ich-tai-studio-vinhomes-ocean-park.jpg";
                  const bgStyle = { backgroundImage: `url("${imageUrl}")` };

                  // Giá hiển thị: ưu tiên giá khuyến mãi nếu có
                  const displayPrice = room.isPromotion ? room.discountedPrice! : room.price;
                  const hasPromotion = room.isPromotion && room.discountPercent && room.discountPercent > 0;

                  return (
                    <Link
                      to={`/rooms/${room._id}`}
                      className="design-room-card"
                      key={room._id}
                    >
                      <div
                        className="design-room-image"
                        style={bgStyle}
                      >
                        <div
                          className={`design-room-badge ${room.status === "available"
                            ? "badge-available"
                            : "badge-full"
                            }`}
                        >
                          {room.status === "available"
                            ? "CÒN PHÒNG"
                            : STATUS_MAP[room.status].label.toUpperCase()}
                        </div>
                        {/* Badge khuyến mãi */}
                        {hasPromotion && (
                          <div
                            style={{
                              position: 'absolute',
                              top: '12px',
                              right: '23px',
                              background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                              color: 'white',
                              padding: '4px 10px',
                              borderRadius: '6px',
                              fontSize: '0.75rem',
                              fontWeight: 800,
                              boxShadow: '0 2px 8px rgba(220,38,38,0.4)',
                              zIndex: 2,
                              letterSpacing: '0.02em',
                            }}
                          >
                            GIẢM {room.discountPercent}%
                          </div>
                        )}
                        <FavoriteHeartButton room={room} />
                      </div>
                      <div className="design-room-body">
                        <h3 className="design-room-title">{room.name}</h3>
                        <p className="design-room-address">
                          <RiMapPin2Line size={15} /> {room.address}
                        </p>
                        <div className="design-room-amenities">
                          {amenitiesToDisplay
                            .slice(0, 3)
                            .map((a: string, i: number) => (
                              <span key={i}>{a}</span>
                            ))}
                        </div>
                        <div className="design-room-footer">
                          <div className="design-room-price">
                            {room.rentalMode === "short_term" ? (
                              hasPromotion ? (
                                <>
                                  <span
                                    style={{
                                      textDecoration: 'line-through',
                                      color: '#9ca3af',
                                      fontSize: '0.8rem',
                                      fontWeight: 400,
                                      marginRight: '6px',
                                    }}
                                  >
                                    {formatPrice(room.originalHourlyPrice || room.hourlyPrice)}
                                  </span>
                                  <strong style={{ color: '#dc2626' }}>
                                    {formatPrice(room.discountedHourlyPrice || room.hourlyPrice)}
                                  </strong>
                                  <span>/giờ</span>
                                </>
                              ) : (
                                <>
                                  <strong>{formatPrice(room.hourlyPrice)}</strong>
                                  <span>/giờ</span>
                                </>
                              )
                            ) : hasPromotion ? (
                              <>
                                <span
                                  style={{
                                    textDecoration: 'line-through',
                                    color: '#9ca3af',
                                    fontSize: '0.8rem',
                                    fontWeight: 400,
                                    marginRight: '6px',
                                  }}
                                >
                                  {formatPrice(room.originalPrice || room.price)}
                                </span>
                                <strong style={{ color: '#dc2626' }}>
                                  {formatPrice(displayPrice)}
                                </strong>
                                <span>/tháng</span>
                              </>
                            ) : (
                              <>
                                <strong>{formatPrice(room.price)}</strong>
                                <span>/tháng</span>
                              </>
                            )}
                          </div>
                          <span
                            className="design-room-link"
                            id={`room-link-${room._id}`}
                          >
                            Chi tiết →
                          </span>
                        </div>
                      </div>
                    </Link>
                  );
                })}
            </div>

            {/* Pagination Controls */}
            {rooms.length > ITEMS_PER_PAGE && (
              <div className="pagination-container">
                <button
                  className="pagination-btn"
                  onClick={() =>
                    setCurrentPage((prev) => Math.max(prev - 1, 1))
                  }
                  disabled={currentPage === 1}
                  title="Trang trước"
                >
                  &lsaquo;
                </button>

                {Array.from({
                  length: Math.ceil(rooms.length / ITEMS_PER_PAGE),
                }).map((_, i) => (
                  <button
                    key={i + 1}
                    className={`pagination-btn ${currentPage === i + 1 ? "active" : ""}`}
                    onClick={() => setCurrentPage(i + 1)}
                  >
                    {i + 1}
                  </button>
                ))}

                <button
                  className="pagination-btn"
                  onClick={() =>
                    setCurrentPage((prev) =>
                      Math.min(
                        prev + 1,
                        Math.ceil(rooms.length / ITEMS_PER_PAGE),
                      ),
                    )
                  }
                  disabled={
                    currentPage === Math.ceil(rooms.length / ITEMS_PER_PAGE)
                  }
                  title="Trang sau"
                >
                  &rsaquo;
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Image Preview Modal */}
    </div>
  );
}
