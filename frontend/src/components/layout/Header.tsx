import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext.tsx'
import NotificationBell from '../ui/NotificationBell.tsx'
import FavoritesDropdown from '../ui/FavoritesDropdown.tsx'
import logo1 from '../../image/logo1.png'

export default function Header() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Click outside → close dropdown
  useEffect(() => {
    if (!menuOpen) return
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [menuOpen])

  // Close drawer when route changes
  useEffect(() => {
    setDrawerOpen(false)
  }, [location.pathname])

  // Lock body scroll when drawer is open
  useEffect(() => {
    if (drawerOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [drawerOpen])

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  // isActive: `/rooms/map` phải exact match, `/rooms` cũng exact match
  const isActive = (path: string) => {
    if (path === '/rooms') {
      // Chỉ active khi đúng /rooms, không active khi /rooms/map
      return location.pathname === '/rooms' ? 'nav-link active' : 'nav-link'
    }
    return location.pathname === path ? 'nav-link active' : 'nav-link'
  }

  const isMobileActive = (path: string) => {
    if (path === '/rooms') {
      return location.pathname === '/rooms' ? 'mobile-nav-link active' : 'mobile-nav-link'
    }
    return location.pathname === path ? 'mobile-nav-link active' : 'mobile-nav-link'
  }

  return (
    <header className="site-header">
      <div className="header-left">
        <Link to="/" className="brand" style={{ textDecoration: 'none', marginLeft: '-8px', display: 'flex', alignItems: 'center' }}>
          <img src={logo1} alt="Logo" style={{ width: 50, height: 50, objectFit: 'contain', marginRight: 6 }} />
          <span className="adm-header-logo-text">
            <strong style={{ fontSize: 20 }}>Căn Hộ F4</strong>
          </span>
        </Link>
      </div>

      {/* Desktop nav */}
      <nav className="main-nav">
        {(user?.role !== 'admin' && user?.role !== 'staff') ? (
          <>
            <Link to="/" className={isActive('/')}>Trang chủ</Link>
            <Link to="/rooms" className={isActive('/rooms')}>Tìm phòng</Link>
            <Link to="/rooms/map" className={isActive('/rooms/map')}>Bản đồ phòng</Link>
          </>
        ) : (
          <Link to="/admin" className={isActive('/admin')}>
            {user?.role === 'admin' ? 'Dashboard Admin' : 'Dashboard Staff'}
          </Link>
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
        {user && <NotificationBell />}
        {user ? (
          <div className="user-menu" ref={menuRef}>
            <button
              className="user-toggle"
              onClick={() => setMenuOpen(!menuOpen)}
              id="user-menu-toggle"
            >
              <span className="user-avatar">
                {user.avatar ? (
                  <img src={user.avatar} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                ) : (
                  user.name.charAt(0).toUpperCase()
                )}
              </span>
              <span className="user-name">{user.name}</span>
              <span className="chevron">{menuOpen ? '▲' : '▼'}</span>
            </button>
            {menuOpen && (
              <div className="user-dropdown">
                <div className="dropdown-info">
                  <span className="dropdown-name">{user.name}</span>
                  <span className="dropdown-role">{
                    user.role === 'admin' ? 'Quản trị viên' :
                      user.role === 'staff' ? 'Nhân viên' :
                        'Khách thuê'
                  }</span>
                </div>
                <hr className="dropdown-divider" />
                <button className="dropdown-item" onClick={() => { setMenuOpen(false); navigate('/profile') }}>
                  <span className="dropdown-item-icon">👤</span>
                  Thông tin cá nhân
                </button>
                <button className="dropdown-item" onClick={() => { setMenuOpen(false); navigate('/profile/payment') }}>
                  <span className="dropdown-item-icon">💳</span>
                  Thanh toán & Công nợ
                </button>
                <button className="dropdown-item" onClick={() => { setMenuOpen(false); navigate('/profile/security') }}>
                  <span className="dropdown-item-icon">🔒</span>
                  Tài khoản & Bảo mật
                </button>
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

        {/* Hamburger button — mobile only */}
        <button
          className="hamburger-btn"
          onClick={() => setDrawerOpen(true)}
          aria-label="Mở menu"
          id="hamburger-btn"
        >
          <span className="hamburger-line" />
          <span className="hamburger-line" />
          <span className="hamburger-line" />
        </button>
      </div>

      {/* Mobile drawer overlay */}
      {drawerOpen && (
        <div className="mobile-drawer-overlay" onClick={() => setDrawerOpen(false)}>
          <nav
            className="mobile-drawer"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer header */}
            <div className="mobile-drawer-header">
              <Link to="/" className="brand" onClick={() => setDrawerOpen(false)}>
                <strong>Phòng Trọ</strong> DTT
              </Link>
              <button
                className="mobile-drawer-close"
                onClick={() => setDrawerOpen(false)}
                aria-label="Đóng menu"
              >
                ✕
              </button>
            </div>

            {/* User info in drawer */}
            {user && (
              <div className="mobile-drawer-user">
                <span className="user-avatar">
                  {user.avatar ? (
                    <img src={user.avatar} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                  ) : (
                    user.name.charAt(0).toUpperCase()
                  )}
                </span>
                <div className="mobile-drawer-user-info">
                  <span className="mobile-drawer-user-name">{user.name}</span>
                  <span className="mobile-drawer-user-role">{
                    user.role === 'admin' ? 'Quản trị viên' :
                      user.role === 'staff' ? 'Nhân viên' :
                        'Khách thuê'
                  }</span>
                </div>
              </div>
            )}

            <div className="mobile-drawer-divider" />

            {/* Nav links */}
            <div className="mobile-drawer-links">
              {(user?.role !== 'admin' && user?.role !== 'staff') ? (
                <>
                  <Link to="/" className={isMobileActive('/')} onClick={() => setDrawerOpen(false)}>
                    <span className="mobile-nav-icon">🏠</span> Trang chủ
                  </Link>
                  <Link to="/rooms" className={isMobileActive('/rooms')} onClick={() => setDrawerOpen(false)}>
                    <span className="mobile-nav-icon">🔍</span> Tìm phòng
                  </Link>
                  <Link to="/rooms/map" className={isMobileActive('/rooms/map')} onClick={() => setDrawerOpen(false)}>
                    <span className="mobile-nav-icon">🗺️</span> Bản đồ phòng
                  </Link>
                </>
              ) : (
                <Link to="/admin" className={isMobileActive('/admin')} onClick={() => setDrawerOpen(false)}>
                  <span className="mobile-nav-icon">📊</span> {user?.role === 'admin' ? 'Dashboard Admin' : 'Dashboard Staff'}
                </Link>
              )}

              {user?.role === 'tenant' && (
                <>
                  <Link to="/my-room" className={isMobileActive('/my-room')} onClick={() => setDrawerOpen(false)}>
                    <span className="mobile-nav-icon">🏡</span> Phòng của tôi
                  </Link>
                  <Link to="/my-invoices" className={isMobileActive('/my-invoices')} onClick={() => setDrawerOpen(false)}>
                    <span className="mobile-nav-icon">📄</span> Hóa đơn của tôi
                  </Link>
                </>
              )}
            </div>

            <div className="mobile-drawer-divider" />

            {/* Profile links for logged in users */}
            {user && (
              <div className="mobile-drawer-links">
                <Link to="/profile" className={isMobileActive('/profile')} onClick={() => setDrawerOpen(false)}>
                  <span className="mobile-nav-icon">👤</span> Thông tin cá nhân
                </Link>
                <Link to="/profile/payment" className={isMobileActive('/profile/payment')} onClick={() => setDrawerOpen(false)}>
                  <span className="mobile-nav-icon">💳</span> Thanh toán & Công nợ
                </Link>
                <Link to="/profile/security" className={isMobileActive('/profile/security')} onClick={() => setDrawerOpen(false)}>
                  <span className="mobile-nav-icon">🔒</span> Tài khoản & Bảo mật
                </Link>
              </div>
            )}

            {/* Bottom actions */}
            <div className="mobile-drawer-bottom">
              {user ? (
                <button className="mobile-drawer-logout" onClick={() => { setDrawerOpen(false); handleLogout() }}>
                  Đăng xuất
                </button>
              ) : (
                <div className="mobile-drawer-auth">
                  <Link to="/login" className="button button-outline btn-full" onClick={() => setDrawerOpen(false)}>
                    Đăng nhập
                  </Link>
                  <Link to="/register" className="button button-primary btn-full" onClick={() => setDrawerOpen(false)}>
                    Đăng ký
                  </Link>
                </div>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  )
}
