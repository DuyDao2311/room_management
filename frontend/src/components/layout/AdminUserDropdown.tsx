import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { User, Lock, MapPin, LogOut } from 'lucide-react'

interface Props {
  onClose: () => void
}

/**
 * AdminUserDropdown — Menu dropdown cho user profile
 * Items: Hồ sơ, Đổi mật khẩu, Khu vực quản lý (Staff), Đăng xuất
 */
export default function AdminUserDropdown({ onClose }: Props) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  if (!user) return null

  const isStaff = user.role === 'staff'

  const handleNavigate = (path: string) => {
    onClose()
    navigate(path)
  }

  const handleLogout = () => {
    onClose()
    logout()
    navigate('/')
  }

  return (
    <div className="adm-user-dropdown">
      {/* User info header */}
      <div className="adm-user-dropdown-header">
        <span className="adm-user-dropdown-avatar">
          {user.avatar ? (
            <img src={user.avatar} alt="" />
          ) : (
            user.name.charAt(0).toUpperCase()
          )}
        </span>
        <div className="adm-user-dropdown-info">
          <span className="adm-user-dropdown-name">{user.name}</span>
          <span className="adm-user-dropdown-email">{user.email}</span>
        </div>
      </div>

      <div className="adm-user-dropdown-divider" />

      {/* Menu items */}
      <div className="adm-user-dropdown-menu">
        <button
          className="adm-user-dropdown-item"
          onClick={() => handleNavigate('/profile')}
        >
          <User size={18} />
          <span>Hồ sơ cá nhân</span>
        </button>

        <button
          className="adm-user-dropdown-item"
          onClick={() => handleNavigate('/profile/security')}
        >
          <Lock size={18} />
          <span>Đổi mật khẩu</span>
        </button>

        {/* Khu vực quản lý — chỉ hiện cho Staff */}
        {isStaff && user.managedDistricts && user.managedDistricts.length > 0 && (
          <>
            <div className="adm-user-dropdown-divider" />
            <div className="adm-user-dropdown-districts">
              <div className="adm-user-dropdown-districts-label">
                <MapPin size={14} />
                <span>Khu vực quản lý</span>
              </div>
              <div className="adm-user-dropdown-districts-list">
                {user.managedDistricts.map((d) => (
                  <span key={d} className="adm-user-dropdown-district-tag">
                    {d}
                  </span>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      <div className="adm-user-dropdown-divider" />

      {/* Logout */}
      <button className="adm-user-dropdown-item adm-user-dropdown-logout" onClick={handleLogout}>
        <LogOut size={18} />
        <span>Đăng xuất</span>
      </button>
    </div>
  )
}
