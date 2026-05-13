import { Outlet, NavLink, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import {
  FiGrid,        // Tổng quan
  FiHome,        // Phòng
  FiUsers,       // Người thuê
  FiFileText,    // Hợp đồng
  FiFile,        // Hóa đơn
  FiCalendar
} from "react-icons/fi";

export default function AdminLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  const navItems = [
    { name: 'Dashboard', path: '/admin', exact: true, icon: <FiGrid /> },
    { name: 'Quản lý phòng', path: '/admin/rooms', exact: false, icon: <FiHome /> },
    { name: 'Hợp đồng', path: '/admin/contracts', exact: false, icon: <FiFileText /> },
    { name: 'Hóa đơn', path: '/admin/invoices', exact: false, icon: <FiFile /> },
    { name: 'Lịch hẹn', path: '/admin/appointments', exact: false, icon: <FiCalendar /> },
    { name: 'Người dùng', path: '/admin/users', exact: false, icon: <FiUsers /> },
  ]

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
          {navItems.map(item => (
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
          <div className="admin-user-info">
            <span className="admin-user-avatar">{user?.name?.charAt(0).toUpperCase()}</span>
            <div className="admin-user-details">
              <span className="admin-user-name">{user?.name}</span>
              <span className="admin-user-role">Quản trị viên</span>
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
