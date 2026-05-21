import { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import api from '../../api/axios.ts'
import Spinner from '../../components/ui/Spinner.tsx'
import FavoriteHeartButton from '../../components/ui/FavoriteHeartButton.tsx'
import { RiMapPin2Line } from "react-icons/ri";
interface Room {
  _id: string
  name: string
  address: string
  price: number
  area: number
  type: string
  status: 'available' | 'occupied' | 'maintenance'
  images: string[]
  amenities: string[]
}

const STATUS_MAP = {
  available: { label: 'Còn phòng', variant: 'success' as const },
  occupied: { label: 'Đã thuê', variant: 'danger' as const },
  maintenance: { label: 'Đang sửa', variant: 'warning' as const },
}

const formatPrice = (price: number) => {
  if (price >= 1000000) return (price / 1000000).toFixed(1).replace('.0', '') + 'tr'
  if (price >= 1000) return (price / 1000).toFixed(0) + 'k'
  return price.toString()
}

export default function RoomList() {
  const [rooms, setRooms] = useState<Room[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchParams, setSearchParams] = useSearchParams()
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const ITEMS_PER_PAGE = 9

  const priceFilter = searchParams.get('price') ?? ''
  const districtFilter = searchParams.get('district') ?? ''
  const typeFilter = searchParams.get('type') ?? ''

  useEffect(() => {
    setLoading(true)
    setError('')
    const params: Record<string, string> = {}
    if (priceFilter) params.price = priceFilter
    if (districtFilter) params.district = districtFilter
    if (typeFilter) params.type = typeFilter

    api.get('/rooms', { params })
      .then(res => {
        setRooms(res.data)
        setCurrentPage(1) // Reset về trang 1 khi lọc thay đổi
      })
      .catch(() => setError('Không thể tải danh sách phòng. Vui lòng thử lại.'))
      .finally(() => setLoading(false))
  }, [priceFilter, districtFilter, typeFilter])

  const updateFilter = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams)
    if (value) next.set(key, value)
    else next.delete(key)
    setSearchParams(next)
  }

  return (
    <div className="page-shell">
      <div className="room-list-page">
        <div className="page-hero-mini">
          <h1>Tìm phòng trọ</h1>
          <p>Khám phá hàng trăm phòng trọ chất lượng tại TP.Hà Nội</p>
        </div>

        {/* Filters */}
        <div className="filter-bar">
          <div className="filter-group">
            <label htmlFor="filter-district">Khu vực</label>
            <select id="filter-district" value={districtFilter} onChange={e => updateFilter('district', e.target.value)} className="filter-select">
              <option value="">Tất cả quận</option>
              <option value="Quận Hà Đông">Quận Hà Đông</option>
              <option value="Quận Nam Từ Liêm">Quận Nam Từ Liêm</option>
              <option value="Quận Long Biên">Quận Long Biên</option>
              <option value="Quận Thanh Xuân">Quận Thanh Xuân</option>
            </select>
          </div>
          <div className="filter-group">
            <label htmlFor="filter-price">Giá thuê</label>
            <select id="filter-price" value={priceFilter} onChange={e => updateFilter('price', e.target.value)} className="filter-select">
              <option value="">Tất cả mức giá</option>
              <option value="below-3">Dưới 3tr</option>
              <option value="3-5">3tr - 5tr</option>
              <option value="above-5">Trên 5tr</option>
            </select>
          </div>
          <div className="filter-group">
            <label htmlFor="filter-type">Loại phòng</label>
            <select id="filter-type" value={typeFilter} onChange={e => updateFilter('type', e.target.value)} className="filter-select">
              <option value="">Tất cả loại phòng</option>
              <option value="Studio">Studio</option>
              <option value="1 phòng ngủ">1 phòng ngủ</option>
              <option value="Chung cư mini">Chung cư mini</option>
              <option value="Phòng trọ thường">Phòng trọ thường</option>
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
            <button className="button button-primary" onClick={() => setSearchParams({})}>Xóa bộ lọc</button>
          </div>
        )}
        {!loading && rooms.length > 0 && (
          <>
            <div className="design-room-grid">
              {rooms.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE).map(room => {
                const amenitiesToDisplay = (room.amenities && room.amenities.length > 0)
                  ? room.amenities
                  : ['Wifi', 'Điều hòa', 'Chỗ để xe'];

                const imageUrl = room.images && room.images.length > 0
                  ? room.images[0]
                  : 'https://vinhomeoceanpark.net/wp-content/uploads/khong-sang-song-hien-dai-tien-ich-tai-studio-vinhomes-ocean-park.jpg';
                const bgStyle = { backgroundImage: `url("${imageUrl}")` };

                return (
                  <Link to={`/rooms/${room._id}`} className="design-room-card" key={room._id}>
                    <div
                      className="design-room-image"
                      style={{ ...bgStyle, cursor: 'pointer' }}
                      onClick={(e) => {
                        e.preventDefault(); // chặn Link navigate, chỉ preview ảnh
                        setPreviewImage(imageUrl);
                      }}
                      title="Click để xem ảnh lớn"
                    >
                      <div className={`design-room-badge ${room.status === 'available' ? 'badge-available' : 'badge-full'}`}>
                        {room.status === 'available' ? 'CÒN PHÒNG' : STATUS_MAP[room.status].label.toUpperCase()}
                      </div>
                      <FavoriteHeartButton room={room} />
                    </div>
                    <div className="design-room-body">
                      <h3 className="design-room-title">{room.name}</h3>
                      <p className="design-room-address"><RiMapPin2Line size={15} /> {room.address}</p>
                      <div className="design-room-amenities">
                        {amenitiesToDisplay.slice(0, 3).map((a: string, i: number) => <span key={i}>{a}</span>)}
                      </div>
                      <div className="design-room-footer">
                        <div className="design-room-price">
                          <strong>{formatPrice(room.price)}</strong><span>/tháng</span>
                        </div>
                        <span className="design-room-link" id={`room-link-${room._id}`}>
                          Chi tiết →
                        </span>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>

            {/* Pagination Controls */}
            {rooms.length > ITEMS_PER_PAGE && (
              <div className="pagination-container">
                <button
                  className="pagination-btn"
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  title="Trang trước"
                >
                  &lsaquo;
                </button>

                {Array.from({ length: Math.ceil(rooms.length / ITEMS_PER_PAGE) }).map((_, i) => (
                  <button
                    key={i + 1}
                    className={`pagination-btn ${currentPage === i + 1 ? 'active' : ''}`}
                    onClick={() => setCurrentPage(i + 1)}
                  >
                    {i + 1}
                  </button>
                ))}

                <button
                  className="pagination-btn"
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, Math.ceil(rooms.length / ITEMS_PER_PAGE)))}
                  disabled={currentPage === Math.ceil(rooms.length / ITEMS_PER_PAGE)}
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
      {previewImage && (
        <div
          className="image-preview-modal"
          onClick={() => setPreviewImage(null)}
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center',
            justifyContent: 'center', zIndex: 9999, cursor: 'zoom-out'
          }}
        >
          <img
            src={previewImage}
            alt="Room Preview"
            style={{ maxWidth: '90%', maxHeight: '90%', borderRadius: '8px', objectFit: 'contain', boxShadow: '0 10px 40px rgba(0,0,0,0.3)' }}
          />
          <button
            style={{ position: 'absolute', top: '24px', right: '32px', background: 'none', border: 'none', color: 'white', fontSize: '2.5rem', cursor: 'pointer' }}
            onClick={() => setPreviewImage(null)}
          >
            &times;
          </button>
        </div>
      )}
    </div>
  )
}
