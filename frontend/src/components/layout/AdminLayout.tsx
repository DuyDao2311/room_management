import { Outlet, NavLink, useNavigate, Link, useLocation } from 'react-router-dom'
import AdminHeader from './AdminHeader.tsx'
import { useAuth } from '../../contexts/AuthContext'
import { useNotifications } from '../../contexts/NotificationContext.tsx'
import { Building2 } from 'lucide-react'
import {
  FiGrid,        // Tổng quan
  FiHome,        // Phòng
  FiMap,         // Bản đồ phòng
  FiUsers,       // Người thuê
  FiFileText,    // Hợp đồng
  FiFile,        // Hóa đơn
  FiCalendar,
  FiUserCheck,   // Quản lý nhân viên
  FiStar         // Đánh giá
} from "react-icons/fi";
import { MdOutlineLogout } from "react-icons/md";

export default function AdminLayout() {
  const { user, logout } = useAuth()
  const { unreadAppointmentCount, unreadContractCount, unreadFeedbackCount, unreadInvoiceCount, markAllAsRead } = useNotifications()
  const navigate = useNavigate()
  const location = useLocation()

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  // const isAdmin = user?.role === 'admin'
  // const isStaff = user?.role === 'staff'

  // Khi click vào nav item, đánh dấu thông báo theo loại đã đọc
  const handleNavClick = (type?: string) => {
    if (type) {
      markAllAsRead(type)
    }
  }

  // ── Sidebar items theo role ─────────────────────────────────────────────
  const navItems = [
    { name: 'Dashboard', path: '/admin', exact: true, icon: <FiGrid />, roles: ['admin', 'staff'], badge: 0, notifType: undefined },
    { name: 'Quản lý phòng', path: '/admin/rooms', exact: false, icon: <FiHome />, roles: ['admin', 'staff'], badge: 0, notifType: undefined },
    { name: 'Bản đồ phòng', path: '/admin/room-map', exact: false, icon: <FiMap />, roles: ['admin', 'staff'], badge: 0, notifType: undefined },
    { name: 'Hợp đồng', path: '/admin/contracts', exact: false, icon: <FiFileText />, roles: ['admin', 'staff'], badge: unreadContractCount, notifType: 'CONTRACT' },
    { name: 'Hóa đơn', path: '/admin/invoices', exact: false, icon: <FiFile />, roles: ['admin', 'staff'], badge: unreadInvoiceCount, notifType: 'INVOICE' },
    { name: 'Lịch hẹn', path: '/admin/appointments', exact: false, icon: <FiCalendar />, roles: ['admin', 'staff'], badge: unreadAppointmentCount, notifType: 'APPOINTMENT' },
    { name: 'Đánh giá phòng', path: '/admin/feedback', exact: false, icon: <FiStar />, roles: ['admin', 'staff'], badge: unreadFeedbackCount, notifType: 'FEEDBACK' },
    { name: 'Người dùng', path: '/admin/users', exact: false, icon: <FiUsers />, roles: ['admin'], badge: 0, notifType: undefined },
    { name: 'Quản lý nhân viên', path: '/admin/staff', exact: false, icon: <FiUserCheck />, roles: ['admin'], badge: 0, notifType: undefined },
  ]

  // Filter items theo role
  const visibleItems = navItems.filter(item => item.roles.includes(user?.role || ''))

  // Role label
  // const roleLabel = isAdmin ? 'Quản trị viên' : isStaff ? 'Nhân viên' : 'Người dùng'

  return (
    <div className="admin-layout-container">
      {/* Sidebar */}
      <aside className="admin-sidebar">
        <div className="admin-sidebar-header">
          <Link to="/admin" className="adm-header-logo" style={{ textDecoration: 'none', marginLeft: '-8px' }}>
            <Building2 size={22} className="adm-header-logo-icon" />
            <span className="adm-header-logo-text">
              <strong>Phòng Trọ</strong> DTT
            </span>
          </Link>
        </div>

        <nav className="admin-sidebar-nav">
          {visibleItems.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.exact}
              onClick={() => handleNavClick(item.notifType)}
              className={({ isActive }) => `admin-nav-link ${isActive ? 'active' : ''}`}
            >
              <span className="admin-nav-icon">{item.icon}</span>
              {item.name}
              {item.badge > 0 && (
                <span className="admin-nav-badge">{item.badge > 9 ? '9+' : item.badge}</span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="admin-sidebar-footer">

          {/* <div className="admin-profile-header">
              <span className="admin-profile-avatar">
                {user?.avatar ? (
                  <img src={user.avatar} alt="" />
                ) : (
                  user?.name?.charAt(0).toUpperCase()
                )}
              </span>
              <div className="admin-profile-details">
                <span className="admin-profile-name">{user?.name}</span>
                <span className="admin-profile-role">{roleLabel}</span>
              </div>
            </div> */}

          {/* {isStaff && user?.managedDistricts && user.managedDistricts.length > 0 && (
              <div className="admin-profile-districts">
                <div className="admin-profile-districts-title">Khu vực quản lý</div>
                <div className="admin-profile-districts-list">
                  {user.managedDistricts.map(d => (
                    <span key={d} className="admin-profile-district-tag">
                      {d}
                    </span>
                  ))}
                </div>
              </div>
            )} */}
          <button className="admin-profile-logout" onClick={handleLogout}>
            <span className="admin-nav-icon" style={{ display: 'flex', alignItems: 'center' }}>
              <MdOutlineLogout size={20} />
            </span>
            Đăng xuất
          </button>
        </div>
      </aside>
      {/* Right side: Header + Main Content */}
      <div className="admin-right-panel">
        <AdminHeader />
        <main className={`admin-main-content admin-main-wrapper ${location.pathname.includes('/admin/room-map') ? 'admin-main-content--no-padding' : ''}`}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
