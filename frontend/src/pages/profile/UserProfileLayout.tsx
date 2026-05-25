import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext.tsx'

const navItems = [
  { to: '/profile', label: 'Thông tin cá nhân', icon: '👤' },
  { to: '/profile/room-info', label: 'Thông tin thuê phòng', icon: '🏠' },
  { to: '/profile/payment', label: 'Thanh toán & Công nợ', icon: '💳' },
  { to: '/profile/security', label: 'Tài khoản & Bảo mật', icon: '🔒' },
]

export default function UserProfileLayout() {
  const { user } = useAuth()
  const location = useLocation()

  const isActive = (to: string) => {
    if (to === '/profile') return location.pathname === '/profile'
    return location.pathname.startsWith(to)
  }

  // Ẩn sidebar cho các trang profile (dùng layout full-width)
  const hideSidebar = location.pathname === '/profile' || location.pathname === '/profile/payment' || location.pathname === '/profile/security'

  if (hideSidebar) {
    return (
      <div className="upl-root">
        <main className="upl-main">
          <Outlet />
        </main>
      </div>
    )
  }

  return (
    <div className="upl-root">
      {/* Sidebar */}
      <aside className="upl-sidebar">
        <nav className="upl-nav">
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/profile'}
              className={() => `upl-nav-item${isActive(item.to) ? ' upl-nav-item--active' : ''}`}
            >
              <span className="upl-nav-icon">{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Main content */}
      <main className="upl-main">
        <Outlet />
      </main>
    </div>
  )
}