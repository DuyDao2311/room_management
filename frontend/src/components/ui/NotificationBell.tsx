import { useState, useRef, useEffect } from 'react'
import { useNotifications, type Notification } from '../../contexts/NotificationContext.tsx'
import { useNavigate } from 'react-router-dom'

// ─── Helpers ──────────────────────────────────────────────────────────────────
function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Vừa xong'
  if (mins < 60) return `${mins} phút trước`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} giờ trước`
  const days = Math.floor(hours / 24)
  return `${days} ngày trước`
}

export default function NotificationBell() {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications()
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  // Click outside → đóng dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handlePayClick = (n: Notification) => {
    markAsRead(n._id)
    setOpen(false)
    navigate('/my-invoices')
  }

  return (
    <div className="notif-bell-wrapper" ref={wrapperRef}>
      {/* Bell icon */}
      <button
        className="notif-bell-btn"
        onClick={() => setOpen(!open)}
        aria-label="Thông báo"
        id="notification-bell"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="notif-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="notif-dropdown">
          {/* Header */}
          <div className="notif-dropdown-header">
            <span className="notif-dropdown-title">Thông báo</span>
            {unreadCount > 0 && (
              <button className="notif-mark-all-btn" onClick={markAllAsRead}>
                Đánh dấu tất cả đã đọc
              </button>
            )}
          </div>

          {/* List */}
          <div className="notif-dropdown-list">
            {notifications.length === 0 ? (
              <div className="notif-empty">
                <span>🔔</span>
                <p>Chưa có thông báo nào</p>
              </div>
            ) : (
              notifications.map(n => (
                <div
                  key={n._id}
                  className={`notif-item ${!n.isRead ? 'notif-unread' : ''}`} onClick={() => handlePayClick(n)}
                >
                  {/* Chấm tròn xanh cho unread */}
                  {!n.isRead && <span className="notif-dot" />}

                  <div className="notif-item-content">
                    <div className="notif-item-title">{n.title}</div>
                    <div className="notif-item-message">{n.message}</div>
                    <div className="notif-item-time">{timeAgo(n.createdAt)}</div>
                  </div>

                  <div className="notif-item-actions" >
                    {/* {n.type === 'INVOICE' && n.invoiceId && (
                      <button
                        className="notif-action-btn notif-pay-btn"
                        onClick={() => handlePayClick(n)}
                      >
                        Thanh toán
                      </button>
                    )} */}
                    {!n.isRead && (
                      <button
                        className="notif-action-btn notif-read-btn"
                        onClick={() => markAsRead(n._id)}
                      >
                        Đã đọc
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
