import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext.tsx'
import NotificationBell from '../ui/NotificationBell.tsx'
import FavoritesDropdown from '../ui/FavoritesDropdown.tsx'

export default function Header() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  const isActive = (path: string) =>
    location.pathname === path ? 'nav-link active' : 'nav-link'

  return (
    <header className="site-header">
      <div className="header-left">
        <Link to="/" className="brand">
          <strong>Phòng Trọ</strong> DTT
        </Link>
      </div>

      <nav className="main-nav">
        {user?.role !== 'admin' ? (
          <>
            <Link to="/" className={isActive('/')}>Trang chủ</Link>
            <Link to="/rooms" className={isActive('/rooms')}>Tìm phòng</Link>
          </>
        ) : (
          <Link to="/admin" className={isActive('/admin')}>Dashboard Admin</Link>
        )}

        {user?.role === 'tenant' && (
          <>
            <Link to="/my-room" className={isActive('/my-room')}>Phòng của tôi</Link>
            <Link to="/my-invoices" className={isActive('/my-invoices')}>Hóa đơn của tôi</Link>
          </>
        )}
      </nav>

      <div className="header-right">
        <FavoritesDropdown />
        {user?.role === 'tenant' && <NotificationBell />}
        {user ? (
          <div className="user-menu">
            <button
              className="user-toggle"
              onClick={() => setMenuOpen(!menuOpen)}
              id="user-menu-toggle"
            >
              <span className="user-avatar">{user.name.charAt(0).toUpperCase()}</span>
              <span className="user-name">{user.name}</span>
              <span className="chevron">{menuOpen ? '▲' : '▼'}</span>
            </button>
            {menuOpen && (
              <div className="user-dropdown">
                <div className="dropdown-info">
                  <span className="dropdown-name">{user.name}</span>
                  <span className="dropdown-role">{user.role === 'admin' ? 'Quản trị viên' : 'Khách thuê'}</span>
                </div>
                <hr className="dropdown-divider" />
                <button className="dropdown-item logout-btn" onClick={handleLogout} id="logout-btn">
                  Đăng xuất
                </button>
              </div>
            )}
          </div>
        ) : (
          <>
            <Link to="/login" className="button button-outline">Đăng nhập</Link>
            <Link to="/register" className="button button-primary" id="register-btn">Đăng ký</Link>
          </>
        )}
      </div>
    </header>
  )
}
