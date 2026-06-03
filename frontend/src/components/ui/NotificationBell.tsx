import { useState, useRef, useEffect } from 'react'
import { useNotifications, type Notification } from '../../contexts/NotificationContext.tsx'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext.tsx'

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

// Icon cho từng loại thông báo
function getNotificationIcon(type: Notification['type']): string {
  switch (type) {
    case 'APPOINTMENT': return '📅'
    case 'CONTRACT': return '📄'
    case 'FEEDBACK': return '⭐'
    case 'INVOICE': return '💰'
    case 'REMINDER': return '⏰'
    case 'SYSTEM': return '🔔'
    default: return '🔔'
  }
}

// Màu badge cho từng loại thông báo
function getNotificationColor(type: Notification['type']): string {
  switch (type) {
    case 'APPOINTMENT': return '#3b82f6'
    case 'CONTRACT': return '#8b5cf6'
    case 'FEEDBACK': return '#f59e0b'
    case 'INVOICE': return '#10b981'
    case 'REMINDER': return '#f97316'
    case 'SYSTEM': return '#6b7280'
    default: return '#6b7280'
  }
}

export default function NotificationBell() {
  const { 
    notifications, 
    unreadCount, 
    unreadAppointmentCount,
    unreadContractCount,
    unreadFeedbackCount,
    markAsRead, 
    markAllAsRead,
    deleteNotification 
  } = useNotifications()
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState<'all' | 'APPOINTMENT' | 'CONTRACT' | 'FEEDBACK'>('all')
  const wrapperRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const isStaff = user?.role === 'staff' || user?.role === 'admin'

  // Lọc thông báo theo filter
  const filteredNotifications = filter === 'all' 
    ? notifications 
    : notifications.filter(n => n.type === filter)

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

  const handleNotificationClick = (n: Notification) => {
    markAsRead(n._id)
    setOpen(false)
    
    // Điều hướng theo loại thông báo
    switch (n.type) {
      case 'APPOINTMENT':
        if (isStaff) {
          navigate(n.appointmentId ? `/admin/appointments/${n.appointmentId}` : '/admin/appointments')
        } else {
          navigate('/appointments')
        }
        break
      case 'CONTRACT':
        if (isStaff) {
          // Nếu có contractId, điều hướng đến trang hợp đồng với param để mở chi tiết
          navigate(n.contractId ? `/admin/contracts?highlight=${n.contractId}` : '/admin/contracts')
        } else {
          // Tenant: điều hướng về MyRoom với section tương ứng tiêu đề thông báo
          if (n.title?.includes('được tạo') || n.title?.includes('vui lòng ký')) {
            navigate('/my-room?section=contract')
          } else if (n.title?.includes('gia hạn')) {
            navigate('/my-room?section=extension')
          } else if (n.title?.includes('hết hạn') || n.title?.includes('sắp hết hạn')) {
            navigate('/my-room?section=contract')
          } else if (n.title?.includes('phê duyệt') || n.title?.includes('được duyệt')) {
            navigate('/my-room?section=contract')
          } else if (n.title?.includes('chấm dứt') || n.title?.includes('đã kết thúc')) {
            navigate('/my-room?section=contract')
          } else {
            navigate('/my-room')
          }
        }
        break
      case 'FEEDBACK':
        navigate(isStaff ? '/admin/feedback' : '/feedback')
        break
      case 'INVOICE':
        if (isStaff) {
          navigate(n.invoiceId ? `/admin/invoices?highlight=${n.invoiceId}` : '/admin/invoices')
        } else {
          navigate(n.invoiceId ? `/my-invoices?highlight=${n.invoiceId}` : '/my-invoices')
        }
        break
      default:
        navigate('/notifications')
    }
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
              <button className="notif-mark-all-btn" onClick={() => markAllAsRead(filter === 'all' ? undefined : filter)}>
                Đánh dấu đã đọc
              </button>
            )}
          </div>

          {/* Filter tabs - chỉ hiển thị cho staff/admin */}
          {isStaff && (
            <div className="notif-filter-tabs">
              <button
                className={`notif-filter-tab ${filter === 'all' ? 'active' : ''}`}
                onClick={() => setFilter('all')}
              >
                Tất cả
              </button>
              <button
                className={`notif-filter-tab ${filter === 'APPOINTMENT' ? 'active' : ''}`}
                onClick={() => setFilter('APPOINTMENT')}
              >
                Lịch hẹn
                {unreadAppointmentCount > 0 && (
                  <span className="notif-filter-badge">{unreadAppointmentCount}</span>
                )}
              </button>
              <button
                className={`notif-filter-tab ${filter === 'CONTRACT' ? 'active' : ''}`}
                onClick={() => setFilter('CONTRACT')}
              >
                Hợp đồng
                {unreadContractCount > 0 && (
                  <span className="notif-filter-badge">{unreadContractCount}</span>
                )}
              </button>
              <button
                className={`notif-filter-tab ${filter === 'FEEDBACK' ? 'active' : ''}`}
                onClick={() => setFilter('FEEDBACK')}
              >
                Đánh giá
                {unreadFeedbackCount > 0 && (
                  <span className="notif-filter-badge">{unreadFeedbackCount}</span>
                )}
              </button>
            </div>
          )}

          {/* List */}
          <div className="notif-dropdown-list">
            {filteredNotifications.length === 0 ? (
              <div className="notif-empty">
                <span>🔔</span>
                <p>Chưa có thông báo nào</p>
              </div>
            ) : (
              filteredNotifications.map(n => (
                <div
                  key={n._id}
                  className={`notif-item ${!n.isRead ? 'notif-unread' : ''}`}
                  onClick={() => handleNotificationClick(n)}
                >
                  {/* Icon loại thông báo */}
                  <span 
                    className="notif-type-icon" 
                    style={{ backgroundColor: getNotificationColor(n.type) }}
                  >
                    {getNotificationIcon(n.type)}
                  </span>

                  {/* Chấm tròn xanh cho unread */}
                  {!n.isRead && <span className="notif-dot" />}

                  <div className="notif-item-content">
                    <div className="notif-item-title">{n.title}</div>
                    <div className="notif-item-message">{n.message}</div>
                    <div className="notif-item-time">{timeAgo(n.createdAt)}</div>
                  </div>

                  <div className="notif-item-actions">
                    {!n.isRead && (
                      <button
                        className="notif-action-btn notif-read-btn"
                        onClick={(e) => {
                          e.stopPropagation()
                          markAsRead(n._id)
                        }}
                      >
                        Đã đọc
                      </button>
                    )}
                    <button
                      className="notif-action-btn notif-delete-btn"
                      onClick={(e) => {
                        e.stopPropagation()
                        deleteNotification(n._id)
                      }}
                      title="Xóa"
                    >
                      ✕
                    </button>
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
