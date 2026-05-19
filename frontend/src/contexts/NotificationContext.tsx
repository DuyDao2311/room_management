import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { io, type Socket } from 'socket.io-client'
import api from '../api/axios.ts'
import { useAuth } from './AuthContext.tsx'

// ─── Types ────────────────────────────────────────────────────────────────────
export interface Notification {
  _id: string
  tenantId: string
  type: 'INVOICE' | 'REMINDER' | 'SYSTEM'
  title: string
  message: string
  invoiceId?: string
  isRead: boolean
  createdAt: string
  updatedAt: string
}

interface NotificationContextType {
  notifications: Notification[]
  unreadCount: number
  markAsRead: (id: string) => Promise<void>
  markAllAsRead: () => Promise<void>
  socket: Socket | null
}

const NotificationContext = createContext<NotificationContextType | null>(null)

// ─── Provider ─────────────────────────────────────────────────────────────────
export function NotificationProvider({ children }: { children: ReactNode }) {
  const { user, token } = useAuth()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [socket, setSocket] = useState<Socket | null>(null)

  // Tính unreadCount từ danh sách notifications
  const unreadCount = notifications.filter(n => !n.isRead).length

  // ─── Fetch thông báo cũ khi mount ──────────────────────────────────────────
  useEffect(() => {
    if (!user || !token) {
      setNotifications([])
      return
    }

    api.get('/notifications')
      .then(r => setNotifications(r.data))
      .catch(() => { /* silent */ })
  }, [user, token])

  // ─── Kết nối Socket.io ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!user || !token) return

    const socket = io(window.location.origin.replace(/:\d+$/, ':5000'), {
      auth: { token: sessionStorage.getItem('token') },
      transports: ['websocket', 'polling'],
    })

    socket.on('connect', () => {
      console.log('🔌 Socket.io connected')
    })

    socket.on('new_notification', (notification: Notification) => {
      setNotifications(prev => [notification, ...prev])
    })

    socket.on('connect_error', (err) => {
      console.error('Socket connect_error:', err.message)
      if (err.message.includes('Unauthorized')) {
        sessionStorage.removeItem('token')
        sessionStorage.removeItem('user')
        window.location.href = '/login'
      }
    })

    // Admin/Staff: nhận thông báo khi tenant yêu cầu thanh toán tiền mặt
    socket.on('cash_payment_requested', (data: { invoiceId: string; roomName: string; totalAmount: number; representativeName: string }) => {
      const fakeNotification: Notification = {
        _id: `cash_${data.invoiceId}_${Date.now()}`,
        tenantId: '',
        type: 'INVOICE',
        title: 'Có hóa đơn mới đang chờ thu tiền mặt',
        message: `Phòng ${data.roomName} — ${data.representativeName} — ${data.totalAmount?.toLocaleString('vi-VN')}đ`,
        invoiceId: data.invoiceId,
        isRead: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      setNotifications(prev => [fakeNotification, ...prev])
    })

    setSocket(socket)

    return () => {
      socket.disconnect()
      setSocket(null)
    }
  }, [user, token])

  // ─── Đánh dấu 1 thông báo đã đọc ──────────────────────────────────────────
  const markAsRead = useCallback(async (id: string) => {
    try {
      await api.patch(`/notifications/${id}/read`)
      setNotifications(prev =>
        prev.map(n => n._id === id ? { ...n, isRead: true } : n)
      )
    } catch { /* silent */ }
  }, [])

  // ─── Đánh dấu tất cả đã đọc ───────────────────────────────────────────────
  const markAllAsRead = useCallback(async () => {
    try {
      await api.patch('/notifications/read-all')
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })))
    } catch { /* silent */ }
  }, [])

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, markAsRead, markAllAsRead, socket }}>
      {children}
    </NotificationContext.Provider>
  )
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useNotifications() {
  const ctx = useContext(NotificationContext)
  if (!ctx) throw new Error('useNotifications must be used within NotificationProvider')
  return ctx
}
