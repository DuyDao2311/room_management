import { Link } from 'react-router-dom'
import { useFavorites } from '../../contexts/FavoritesContext.tsx'
import FavoriteHeartButton from '../../components/ui/FavoriteHeartButton.tsx'
import { RiMapPin2Line } from 'react-icons/ri'

const formatPrice = (price: number) => {
  if (price >= 1000000) return (price / 1000000).toFixed(1).replace('.0', '') + 'tr'
  if (price >= 1000) return (price / 1000).toFixed(0) + 'k'
  return price.toString()
}

const STATUS_MAP = {
  available: { label: 'Còn phòng', cls: 'badge-available' },
  occupied: { label: 'Đã thuê', cls: 'badge-full' },
  maintenance: { label: 'Đang sửa', cls: 'badge-warning' },
}

export default function FavoritesPage() {
  const { favorites, clearFavorites } = useFavorites()

  return (
    <div className="page-shell">
      <div className="room-list-page">
        {/* Hero */}
        <div className="page-hero-mini fav-page-hero">
          <h1>❤️ Phòng Yêu Thích</h1>
          <p>Danh sách các phòng bạn đã lưu để tham khảo sau</p>
        </div>

        {/* Content */}
        {favorites.length === 0 ? (
          <div className="fav-page-empty">
            <div className="fav-page-empty-icon">🤍</div>
            <h3>Chưa có phòng yêu thích nào</h3>
            <p>Hãy khám phá các phòng trọ và nhấn vào biểu tượng ♡ để lưu vào đây.</p>
            <Link to="/rooms" className="button button-primary" style={{ marginTop: '16px', display: 'inline-block' }}>
              Khám phá phòng trọ
            </Link>
          </div>
        ) : (
          <>
            <div className="fav-page-toolbar">
              <span className="fav-page-count">{favorites.length} phòng đã lưu</span>
              <button
                className="fav-clear-btn"
                onClick={() => { if (window.confirm('Xóa tất cả phòng yêu thích?')) clearFavorites() }}
              >
                Xóa tất cả
              </button>
            </div>

            <div className="design-room-grid">
              {favorites.map(room => {
                const imageUrl =
                  room.images && room.images.length > 0
                    ? room.images[0]
                    : 'https://vinhomeoceanpark.net/wp-content/uploads/khong-sang-song-hien-dai-tien-ich-tai-studio-vinhomes-ocean-park.jpg'
                const statusInfo = STATUS_MAP[room.status] ?? STATUS_MAP.available

                return (
                  <article className="design-room-card" key={room._id}>
                    <div
                      className="design-room-image"
                      style={{ backgroundImage: `url("${imageUrl}")` }}
                    >
                      <div className={`design-room-badge ${statusInfo.cls}`}>
                        {statusInfo.label.toUpperCase()}
                      </div>
                      {/* Heart button */}
                      <FavoriteHeartButton room={room} />
                    </div>
                    <div className="design-room-body">
                      <h3 className="design-room-title">{room.name}</h3>
                      <p className="design-room-address">
                        <RiMapPin2Line size={14} /> {room.address}
                      </p>
                      <div className="design-room-footer">
                        <div className="design-room-price">
                          <strong>{formatPrice(room.price)}</strong>
                          <span>/tháng</span>
                        </div>
                        <Link
                          to={`/rooms/${room._id}`}
                          className="design-room-link"
                          id={`fav-page-room-${room._id}`}
                        >
                          Chi tiết
                        </Link>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
