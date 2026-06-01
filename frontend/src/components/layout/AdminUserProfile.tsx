import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { ChevronDown } from 'lucide-react'
import AdminUserDropdown from './AdminUserDropdown'

/**
 * AdminUserProfile — Avatar + Tên + Role/District + ChevronDown
 * Click mở AdminUserDropdown
 */
export default function AdminUserProfile() {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  // Click outside → close
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  if (!user) return null

  const isAdmin = user.role === 'admin'
  const isStaff = user.role === 'staff'

  // Role subtitle
  const roleSubtitle = isAdmin
    ? 'Quản trị hệ thống'
    : isStaff && user.managedDistricts && user.managedDistricts.length > 0
      ? `${user.managedDistricts.join(', ')}`
      : 'Nhân viên'

  return (
    <div className="adm-user-wrapper" ref={wrapperRef}>
      <button
        className={`adm-user-toggle ${open ? 'adm-user-toggle--active' : ''}`}
        onClick={() => setOpen(!open)}
        id="admin-user-toggle"
      >
        {/* Avatar */}
        <span className="adm-user-avatar">
          {user.avatar ? (
            <img src={user.avatar} alt="" />
          ) : (
            user.name.charAt(0).toUpperCase()
          )}
        </span>

        {/* Info */}
        <div className="adm-user-info">
          <span className="adm-user-name">{user.name}</span>
          <span className="adm-user-role">{roleSubtitle}</span>
        </div>

        {/* Chevron */}
        <ChevronDown
          size={16}
          className={`adm-user-chevron ${open ? 'adm-user-chevron--open' : ''}`}
        />
      </button>

      {/* Dropdown */}
      {open && <AdminUserDropdown onClose={() => setOpen(false)} />}
    </div>
  )
}
