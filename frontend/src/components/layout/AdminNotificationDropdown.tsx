import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useNotifications, type Notification } from '../../contexts/NotificationContext'
import { useAuth } from '../../contexts/AuthContext'
import {
  Calendar,
  FileText,
  CreditCard,
  Clock,
  Star,
  Bell,
  CheckCheck,
  Trash2,
  Wrench,
} from 'lucide-react'

// ─── Helpers ──────────────────────────────────────────────────────────────────
function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Vừa xong'
  if (mins < 60) return `${mins} phút trước`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} giờ trước`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days} ngày trước`
  return new Date(dateStr).toLocaleDateString('vi-VN')
}

// ─── Notification type config ─────────────────────────────────────────────────
const notifConfig: Record<string, { icon: React.ReactNode; color: string; bg: string }> = {
  APPOINTMENT: {
    icon: <Calendar size={18} />,
    color: '#3b82f6',
    bg: 'rgba(59, 130, 246, 0.1)',
  },
  CONTRACT: {
    icon: <FileText size={18} />,
    color: '#8b5cf6',
    bg: 'rgba(139, 92, 246, 0.1)',
  },
  INVOICE: {
    icon: <CreditCard size={18} />,
    color: '#10b981',
    bg: 'rgba(16, 185, 129, 0.1)',
  },
  FEEDBACK: {
    icon: <Star size={18} />,
    color: '#f59e0b',
    bg: 'rgba(245, 158, 11, 0.1)',
  },
  REMINDER: {
    icon: <Clock size={18} />,
    color: '#f97316',
    bg: 'rgba(249, 115, 22, 0.1)',
  },
  SYSTEM: {
    icon: <Bell size={18} />,
    color: '#6b7280',
    bg: 'rgba(107, 114, 128, 0.1)',
  },
  INCIDENT: {
    icon: <Wrench size={18} />,
    color: '#ef4444',
    bg: 'rgba(239, 68, 68, 0.1)',
  },
}

interface Props {
  onClose: () => void
}

/**
 * AdminNotificationDropdown — Dropdown thông báo cho Dashboard
 * Width 380px, max-height 500px, scrollable
 */
export default function AdminNotificationDropdown({ onClose }: Props) {
  const {
    notifications,
    unreadCount,
    unreadAppointmentCount,
    unreadContractCount,
    unreadFeedbackCount,
    unreadInvoiceCount,
    unreadIncidentCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  } = useNotifications()
  const { user } = useAuth()
  const navigate = useNavigate()

  // ── Filter state ────────────────────────────────────────────────────────
  const isStaff = user?.role === 'staff' || user?.role === 'admin'
  const filterTabs = [
    { key: 'all', label: 'Tất cả', count: unreadCount },
    { key: 'APPOINTMENT', label: 'Lịch hẹn', count: unreadAppointmentCount },
    { key: 'CONTRACT', label: 'Hợp đồng', count: unreadContractCount },
    { key: 'INVOICE', label: 'Hóa đơn', count: unreadInvoiceCount },
    { key: 'FEEDBACK', label: 'Đánh giá', count: unreadFeedbackCount },
    { key: 'INCIDENT', label: 'Sự cố', count: unreadIncidentCount || 0 },
  ]

  const [filter, setFilter] = useState('all')

  const filteredNotifications =
    filter === 'all'
      ? notifications
      : notifications.filter((n) => n.type === filter)

  // ── Navigate khi click notification ─────────────────────────────────────
  const handleClick = (n: Notification) => {
    markAsRead(n._id)
    onClose()
    switch (n.type) {
      case 'APPOINTMENT':
        if (n.appointmentId) {
          navigate(`/admin/appointments/${n.appointmentId}`)
        } else {
          navigate('/admin/appointments')
        }
        break
      case 'CONTRACT':
        if (n.contractId) {
          navigate(`/admin/contracts?highlight=${n.contractId}`)
        } else {
          navigate('/admin/contracts')
        }
        break
      case 'INVOICE':
        if (n.invoiceId) {
          navigate(`/admin/invoices?highlight=${n.invoiceId}`)
        } else {
          navigate('/admin/invoices')
        }
        break
      case 'FEEDBACK':
        navigate('/admin/feedback')
        break
      case 'INCIDENT':
        if (n.incidentId) {
          navigate(`/admin/incidents?highlight=${n.incidentId}`)
        } else {
          navigate('/admin/incidents')
        }
        break
      default:
        navigate('/admin')
    }
  }

  const handleMarkAllRead = () => {
    markAllAsRead(filter === 'all' ? undefined : filter)
  }

  return (
    <div className="adm-notif-dropdown">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="adm-notif-dropdown-header">
        <div className="adm-notif-dropdown-title">
          <Bell size={18} />
          <span>Thông báo</span>
          {unreadCount > 0 && (
            <span className="adm-notif-dropdown-count">{unreadCount} chưa đọc</span>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            className="adm-notif-mark-all"
            onClick={handleMarkAllRead}
            title="Đánh dấu tất cả đã đọc"
          >
            <CheckCheck size={16} />
            <span>Đọc tất cả</span>
          </button>
        )}
      </div>

      {/* ── Filter tabs ─────────────────────────────────────────────────── */}
      {isStaff && (
        <div className="adm-notif-tabs">
          {filterTabs.map((tab) => (
            <button
              key={tab.key}
              className={`adm-notif-tab ${filter === tab.key ? 'adm-notif-tab--active' : ''}`}
              onClick={() => setFilter(tab.key)}
            >
              {tab.label}
              {tab.count > 0 && (
                <span className="adm-notif-tab-badge">{tab.count}</span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* ── Notification list ───────────────────────────────────────────── */}
      <div className="adm-notif-list">
        {filteredNotifications.length === 0 ? (
          <div className="adm-notif-empty">
            <Bell size={36} strokeWidth={1.2} />
            <p>Chưa có thông báo nào</p>
          </div>
        ) : (
          filteredNotifications.map((n) => {
            const config = notifConfig[n.type] || notifConfig.SYSTEM
            return (
              <div
                key={n._id}
                className={`adm-notif-item ${!n.isRead ? 'adm-notif-item--unread' : ''}`}
                onClick={() => handleClick(n)}
              >
                {/* Icon */}
                <div
                  className="adm-notif-item-icon"
                  style={{ color: config.color, backgroundColor: config.bg }}
                >
                  {config.icon}
                </div>

                {/* Content */}
                <div className="adm-notif-item-content">
                  <div className="adm-notif-item-title">{n.title}</div>
                  <div className="adm-notif-item-message">{n.message}</div>
                  <div className="adm-notif-item-time">{timeAgo(n.createdAt)}</div>
                </div>

                {/* Actions */}
                <div className="adm-notif-item-actions">
                  {!n.isRead && (
                    <span className="adm-notif-dot" title="Chưa đọc" />
                  )}
                  <button
                    className="adm-notif-item-delete"
                    onClick={(e) => {
                      e.stopPropagation()
                      deleteNotification(n._id)
                    }}
                    title="Xóa"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
