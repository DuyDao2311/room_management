import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../api/axios.ts'
import Spinner from '../../components/ui/Spinner.tsx'

interface Appointment {
  _id: string
  name: string
  phone: string
  date: string
  time: string
  note: string
  status: string
  room: { _id: string, name: string, address: string, images?: string[] }
  user?: { _id: string, name: string, email: string }
}

const DEFAULT_IMG = 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=800&q=80'

export default function AppointmentManagement() {
  const navigate = useNavigate()
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)

  useEffect(() => {
    fetchAppointments()
  }, [])

  useEffect(() => {
    const handleGlobalClick = () => setOpenMenuId(null)
    window.addEventListener('click', handleGlobalClick)
    return () => window.removeEventListener('click', handleGlobalClick)
  }, [])

  const fetchAppointments = async () => {
    try {
      const { data } = await api.get('/appointments')
      setAppointments(data)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Lỗi tải dữ liệu lịch hẹn.')
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    setOpenMenuId(null)
    try {
      const { data } = await api.put(`/appointments/${id}/status`, { status: newStatus })
      setAppointments(prev => prev.map(a => a._id === id ? data : a))
    } catch (err: any) {
      alert(err.response?.data?.message || 'Không thể cập nhật lịch hẹn.')
    }
  }

  const parseTime = (timeStr: string) => {
    if (!timeStr) return { label: '---', val: '---' }
    const parts = timeStr.split(':')
    const h = parseInt(parts[0], 10)
    const label = h < 12 ? 'Sáng' : h < 18 ? 'Chiều' : 'Tối'
    return { label, val: timeStr }
  }

  const getStatusLineColor = (status: string) => {
    switch (status) {
      case 'confirmed': return '#047857'
      case 'cancelled': return '#dc2626'
      default: return '#ca8a04'
    }
  }

  const getBadge = (status: string) => {
    switch (status) {
      case 'confirmed': return <span className="apt-badge confirmed">Đã xác nhận</span>
      case 'cancelled': return <span className="apt-badge cancelled">Đã hủy</span>
      default: return <span className="apt-badge pending">Chờ duyệt</span>
    }
  }

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <h1>Quản lý Lịch hẹn</h1>
        </div>
      </div>

      {error && <div className="alert alert-error mb-4">{error}</div>}

      <div className="apt-list">
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px' }}><Spinner /></div>
        ) : appointments.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📅</div>
            <h3>Chưa có lịch hẹn nào</h3>
          </div>
        ) : (
          appointments.map(a => {
            const timeObj = parseTime(a.time)
            const thumb = a.room?.images?.[0] || DEFAULT_IMG

            return (
              <div
                className="apt-card"
                key={a._id}
                style={{ cursor: 'pointer' }}
                onClick={() => navigate(`/admin/appointments/${a._id}`)}
              >
                {/* Colored left bar based on status */}
                <div className="apt-status-line" style={{ background: getStatusLineColor(a.status) }}></div>

                {/* Time */}
                <div className="apt-time">
                  <span className="apt-time-label">{timeObj.label}</span>
                  <span className="apt-time-value">{timeObj.val}</span>
                </div>

                {/* Thumb */}
                <img src={thumb} alt={a.room?.name || 'Phòng'} className="apt-thumb" />

                {/* Info */}
                <div className="apt-info">
                  <div className="apt-name">{a.name}</div>
                  <div className="apt-meta">
                    <div className="apt-meta-item">
                      <span title="Số điện thoại">📞</span> {a.phone}
                    </div>
                    <div className="apt-meta-divider"></div>
                    <div className="apt-meta-item" title={a.room?.address}>
                      <span title="Phòng">🚪</span> {a.room?.name || 'Phòng đã xóa'}
                    </div>
                  </div>
                </div>

                {/* Status Badge */}
                {getBadge(a.status)}

                {/* Actions Dropdown */}
                <div className="apt-dropdown">
                  <button
                    className="apt-kebab"
                    onClick={(e) => {
                      e.stopPropagation()
                      setOpenMenuId(openMenuId === a._id ? null : a._id)
                    }}
                  >
                    ⋮
                  </button>
                  {openMenuId === a._id && (
                    <div className="apt-menu open">
                      {a.status !== 'confirmed' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleUpdateStatus(a._id, 'confirmed')
                          }}
                        >
                          ✅ Xác nhận lịch
                        </button>
                      )}
                      {a.status !== 'cancelled' && (
                        <button
                          className="danger"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleUpdateStatus(a._id, 'cancelled')
                          }}
                        >
                          ❌ Hủy lịch
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
