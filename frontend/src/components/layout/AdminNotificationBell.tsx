import { useState, useRef, useEffect } from 'react'
import { Bell } from 'lucide-react'
import { useNotifications } from '../../contexts/NotificationContext'
import AdminNotificationDropdown from './AdminNotificationDropdown'

/**
 * AdminNotificationBell — Icon chuông + badge + dropdown thông báo
 * Dành cho Dashboard Admin/Staff
 */
export default function AdminNotificationBell() {
  const { unreadCount } = useNotifications()
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  // Click outside → close dropdown
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div className="adm-notif-wrapper" ref={wrapperRef}>
      <button
        className={`adm-notif-btn ${open ? 'adm-notif-btn--active' : ''}`}
        onClick={() => setOpen(!open)}
        aria-label="Thông báo"
        id="admin-notification-bell"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="adm-notif-badge">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Dropdown */}
      {open && <AdminNotificationDropdown onClose={() => setOpen(false)} />}
    </div>
  )
}
