import { useFavorites, type FavoriteRoom } from '../../contexts/FavoritesContext.tsx'
import { useAuth } from '../../contexts/AuthContext.tsx'

interface Props {
  room: FavoriteRoom
}

export default function FavoriteHeartButton({ room }: Props) {
  const { user } = useAuth()
  const { toggleFavorite, isFavorite } = useFavorites()

  // Chỉ hiện cho tenant, ẩn với admin/staff và khi chưa đăng nhập
  if (!user || user.role !== 'tenant') return null

  const liked = isFavorite(room._id)

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    toggleFavorite(room)
  }

  return (
    <button
      className={`fav-heart-btn ${liked ? 'fav-heart-active' : ''}`}
      onClick={handleClick}
      aria-label={liked ? 'Bỏ yêu thích' : 'Thêm vào yêu thích'}
      title={liked ? 'Bỏ yêu thích' : 'Thêm vào yêu thích'}
      id={`fav-heart-${room._id}`}
    >
      <svg
        viewBox="0 0 24 24"
        fill={liked ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="fav-heart-icon"
      >
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
    </button>
  )
}
