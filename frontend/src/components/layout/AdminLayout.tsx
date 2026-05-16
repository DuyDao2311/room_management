import { Outlet, NavLink, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import {
  FiGrid,        // Tổng quan
  FiHome,        // Phòng
  FiUsers,       // Người thuê
  FiFileText,    // Hợp đồng
  FiFile,        // Hóa đơn
  FiCalendar,
  FiUserCheck    // Quản lý nhân viên
} from "react-icons/fi";

export default function AdminLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  const isAdmin = user?.role === 'admin'
  const isStaff = user?.role === 'staff'

  // ── Sidebar items theo role ─────────────────────────────────────────────
  const navItems = [
    { name: 'Dashboard', path: '/admin', exact: true, icon: <FiGrid />, roles: ['admin', 'staff'] },
    { name: 'Quản lý phòng', path: '/admin/rooms', exact: false, icon: <FiHome />, roles: ['admin', 'staff'] },
    { name: 'Hợp đồng', path: '/admin/contracts', exact: false, icon: <FiFileText />, roles: ['admin', 'staff'] },
    { name: 'Hóa đơn', path: '/admin/invoices', exact: false, icon: <FiFile />, roles: ['admin', 'staff'] },
    { name: 'Lịch hẹn', path: '/admin/appointments', exact: false, icon: <FiCalendar />, roles: ['admin', 'staff'] },
    { name: 'Người dùng', path: '/admin/users', exact: false, icon: <FiUsers />, roles: ['admin'] },
    { name: 'Quản lý nhân viên', path: '/admin/staff', exact: false, icon: <FiUserCheck />, roles: ['admin'] },
  ]

  // Filter items theo role
  const visibleItems = navItems.filter(item => item.roles.includes(user?.role || ''))

  // Role label
  const roleLabel = isAdmin ? 'Quản trị viên' : isStaff ? 'Nhân viên' : 'Người dùng'

  return (
    <div className="admin-layout-container">
      {/* Sidebar */}
      <aside className="admin-sidebar">
        <div className="admin-sidebar-header">
          <div className="brand" style={{ fontSize: '1.2rem', marginBottom: 0 }}>
            <Link to="/" className="brand">
              <strong>Phòng Trọ</strong> DTT
            </Link>
          </div>
        </div>

        <nav className="admin-sidebar-nav">
          {visibleItems.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.exact}
              className={({ isActive }) => `admin-nav-link ${isActive ? 'active' : ''}`}
            >
              <span className="admin-nav-icon">{item.icon}</span>
              {item.name}
            </NavLink>
          ))}
        </nav>

        <div className="admin-sidebar-footer">
          {/* District banner cho staff */}
          {isStaff && user?.managedDistricts && user.managedDistricts.length > 0 && (
            <div style={{
              background: 'rgba(255,255,255,0.08)',
              borderRadius: '8px',
              padding: '10px 12px',
              marginBottom: '12px',
            }}>
              <div style={{ fontSize: '0.65rem', color: '#8b9dc3', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>
                Khu vực quản lý
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                {user.managedDistricts.map(d => (
                  <span key={d} style={{
                    background: 'rgba(8,131,115,0.2)',
                    color: '#5cdbbd',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontSize: '0.7rem',
                    fontWeight: 600,
                  }}>
                    {d}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="admin-user-info">
            <span className="admin-user-avatar">{user?.name?.charAt(0).toUpperCase()}</span>
            <div className="admin-user-details">
              <span className="admin-user-name">{user?.name}</span>
              <span className="admin-user-role">{roleLabel}</span>
            </div>
          </div>
          <button className="admin-logout-btn" onClick={handleLogout}>
            Đăng xuất
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="admin-main-content">
        <Outlet />
      </main>
    </div>
  )
}
