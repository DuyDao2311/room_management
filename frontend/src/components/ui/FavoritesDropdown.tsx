import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useFavorites } from '../../contexts/FavoritesContext.tsx'
import { useAuth } from '../../contexts/AuthContext.tsx'

const formatPrice = (price: number) => {
  if (price >= 1000000) return (price / 1000000).toFixed(1).replace('.0', '') + 'tr'
  if (price >= 1000) return (price / 1000).toFixed(0) + 'k'
  return price.toString()
}

const PREVIEW_COUNT = 4

export default function FavoritesDropdown() {
  const { user } = useAuth()
  const { favorites, removeFavorite } = useFavorites()
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  // Đóng dropdown khi click ngoài
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Chỉ hiện cho tenant, ẩn với admin/staff và khi chưa đăng nhập
  if (!user || user.role !== 'tenant') return null

  const count = favorites.length
  const preview = favorites.slice(0, PREVIEW_COUNT)
  const hasMore = count > PREVIEW_COUNT

  return (
    <div className="fav-wrapper" ref={wrapperRef}>
      {/* Nút trái tim trên header */}
      <button
        className={`fav-header-btn ${count > 0 ? 'fav-header-btn--active' : ''}`}
        onClick={() => setOpen(!open)}
        aria-label="Danh sách yêu thích"
        id="favorites-header-btn"
        title="Phòng yêu thích"
      >
        <svg
          viewBox="0 0 24 24"
          fill={count > 0 ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="fav-header-icon"
        >
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        </svg>
        {count > 0 && (
          <span className="fav-header-badge">{count > 9 ? '9+' : count}</span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="fav-dropdown">
          {/* Header dropdown */}
          <div className="fav-dropdown-header">
            <div className="fav-dropdown-title-row">
              <span className="fav-dropdown-title">❤️ Phòng yêu thích</span>
              <span className="fav-dropdown-count">{count} phòng</span>
            </div>
          </div>

          {/* Danh sách phòng */}
          <div className="fav-dropdown-list">
            {count === 0 ? (
              <div className="fav-dropdown-empty">
                <div className="fav-empty-icon">🤍</div>
                <p className="fav-empty-title">Chưa có phòng yêu thích</p>
                <p className="fav-empty-hint">Nhấn vào ♡ trên thẻ phòng để lưu</p>
              </div>
            ) : (
              preview.map(room => {
                const imgUrl =
                  room.images && room.images.length > 0
                    ? room.images[0]
                    : 'https://vinhomeoceanpark.net/wp-content/uploads/khong-sang-song-hien-dai-tien-ich-tai-studio-vinhomes-ocean-park.jpg'

                const statusColors: Record<string, string> = {
                  available: '#10b981',
                  occupied: '#ef4444',
                  maintenance: '#f59e0b',
                }
                const statusLabels: Record<string, string> = {
                  available: 'Còn phòng',
                  occupied: 'Đã thuê',
                  maintenance: 'Đang sửa',
                }

                return (
                  <div className="fav-item" key={room._id}>
                    <Link
                      to={`/rooms/${room._id}`}
                      className="fav-item-link"
                      onClick={() => setOpen(false)}
                    >
                      <div
                        className="fav-item-img"
                        style={{ backgroundImage: `url("${imgUrl}")` }}
                      />
                      <div className="fav-item-info">
                        <div className="fav-item-name">{room.name}</div>
                        <div className="fav-item-address">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="11" height="11">
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                            <circle cx="12" cy="10" r="3"/>
                          </svg>
                          {room.address}
                        </div>
                        <div className="fav-item-bottom">
                          <span className="fav-item-price">{formatPrice(room.price)}/tháng</span>
                          <span
                            className="fav-item-status"
                            style={{ color: statusColors[room.status] }}
                          >
                            {statusLabels[room.status]}
                          </span>
                        </div>
                      </div>
                    </Link>
                    <button
                      className="fav-item-remove"
                      onClick={(e) => { e.stopPropagation(); removeFavorite(room._id) }}
                      title="Xóa khỏi yêu thích"
                      aria-label="Xóa"
                    >
                      ×
                    </button>
                  </div>
                )
              })
            )}
          </div>

          {/* Footer — Xem thêm */}
          {hasMore && (
            <div className="fav-dropdown-footer">
              <Link
                to="/favorites"
                className="fav-view-all-btn"
                onClick={() => setOpen(false)}
              >
                Xem tất cả {count} phòng yêu thích →
              </Link>
            </div>
          )}

          {count > 0 && !hasMore && (
            <div className="fav-dropdown-footer">
              <Link
                to="/favorites"
                className="fav-view-all-btn"
                onClick={() => setOpen(false)}
              >
                Quản lý danh sách yêu thích →
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
