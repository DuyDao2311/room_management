import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import api from '../../api/axios.ts'
import Spinner from '../../components/ui/Spinner.tsx'
import { FaRegCalendarAlt, FaPhoneAlt } from "react-icons/fa";
import { IoMdTime } from "react-icons/io";
import { MdMessage, MdEmail, MdEditCalendar, MdCancel } from "react-icons/md";
import { RiMapPin2Line } from "react-icons/ri";
import { BsPersonFill } from "react-icons/bs";

import { useAuth } from '../../contexts/AuthContext.tsx'
import ZaloContactModal from '../../components/contact/ZaloContactModal.tsx'

interface AppointmentDetailObj {
  _id: string
  name: string
  phone: string
  email?: string
  date: string
  time: string
  note: string
  status: string
  room: { _id: string, name: string, address: string, price: number, type: string, images?: string[] }
  user?: { _id: string, name: string, email: string, avatar?: string }
}

const DEFAULT_IMG = 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=800&q=80'

export default function AppointmentDetail() {
  const { id } = useParams()
  const { user } = useAuth()
  const [apt, setApt] = useState<AppointmentDetailObj | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showContactModal, setShowContactModal] = useState(false)

  useEffect(() => {
    if (!id) return
    api.get(`/appointments/${id}`)
      .then(res => setApt(res.data))
      .catch(err => setError(err.response?.data?.message || 'Không tìm thấy lịch hẹn'))
      .finally(() => setLoading(false))
  }, [id])

  const handleUpdateStatus = async (newStatus: string) => {
    if (!apt) return
    try {
      const { data } = await api.put(`/appointments/${apt._id}/status`, { status: newStatus })
      setApt(data)
    } catch (err: any) {
      alert('Lỗi cập nhật: ' + (err.response?.data?.message || ''))
    }
  }

  if (loading) return <div className="admin-page"><Spinner /></div>
  if (error || !apt) return <div className="admin-page"><h3>{error || 'Lỗi'}</h3><Link to="/admin/appointments">Quay lại</Link></div>

  const parseTime = (timeStr: string) => {
    if (!timeStr) return { label: '...', val: '...', period: '' }
    const parts = timeStr.split(':')
    const h = parseInt(parts[0], 10)
    const period = h < 12 ? 'Sáng' : h < 18 ? 'Chiều' : 'Tối'
    // calculate an estimated +1 hour window string
    const endTime = `${(h + 1).toString().padStart(2, '0')}:${parts[1]}`
    return { val: timeStr, endVal: endTime, period }
  }

  const timeObj = parseTime(apt.time)
  const d = new Date(apt.date)
  const dayName = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'][d.getDay()]
  const dateStr = d.toLocaleDateString('vi-VN')
  const thumb = apt.room?.images?.[0] || DEFAULT_IMG

  return (
    <div className="admin-page">
      <div className="mb-4">
        <Link to="/admin/appointments" className="text-sm td-muted hover-link">← Quay lại danh sách</Link>
      </div>

      <div className="aptd-header">
        <h1 className="aptd-title">Chi tiết lịch hẹn #{apt._id.slice(-6).toUpperCase()}</h1>
        {apt.status === 'confirmed' && <span className="apt-badge confirmed">Đã xác nhận</span>}
        {apt.status === 'cancelled' && <span className="apt-badge cancelled">Đã hủy</span>}
        {apt.status === 'pending' && <span className="apt-badge pending">Chờ duyệt</span>}
      </div>

      <div className="aptd-layout">
        {/* LEFT COLUMN */}
        <div className="aptd-left">
          {/* Room Info */}
          <div className="aptd-card aptd-room-card">
            <h3 className="aptd-card-title">Thông tin phòng</h3>
            <div className="aptd-room-body">
              <img src={thumb} alt="Room" className="aptd-room-img" />
              <div className="aptd-room-details">
                <div>
                  <h4 className="aptd-room-name">{apt.room?.name || 'Phòng đã bị xóa'}</h4>
                  <p className="aptd-room-type">Loại phòng: {apt.room?.type || 'N/A'}</p>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    // justifyContent: 'center',
                    gap: '8px',
                    marginBottom: '10px'
                  }}>
                    <RiMapPin2Line size={18} /><p className="aptd-room-address" style={{ margin: '0', color: '#475569' }}> {apt.room?.address || 'N/A'}</p>
                  </div>
                </div>
                <div className="aptd-room-price-box">
                  <span className="aptd-price-label">GIÁ THUÊ DỰ KIẾN</span>
                  <div className="aptd-price-val">
                    {apt.room?.price ? apt.room.price.toLocaleString('vi-VN') : 0}
                    <span className="aptd-price-currency">đ</span><span className="aptd-price-unit">/tháng</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Time Info */}
          <div className="aptd-card">
            <h3 className="aptd-card-title">Chi tiết thời gian</h3>
            <div className="aptd-time-body">
              <div className="aptd-time-block">
                <div className="aptd-icon-box"><span className="aptd-icon"><FaRegCalendarAlt size={18} /></span></div>
                <div>
                  <span className="aptd-sub">Ngày hẹn</span>
                  <div className="aptd-huge">{dateStr}</div>
                  <span className="aptd-sub">{dayName}</span>
                </div>
              </div>
              <div className="aptd-time-block">
                <div className="aptd-icon-box bg-green"><span className="aptd-icon"><div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <IoMdTime size={25} />
                </div></span></div>
                <div>
                  <span className="aptd-sub">Khung giờ</span>
                  <div className="aptd-huge">{timeObj.val}</div>
                  <span className="aptd-sub">{timeObj.period}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div className="aptd-right">
          {/* Customer Info */}
          <div className="aptd-card aptd-customer-card">
            <h3 className="aptd-card-title"><div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}>
              <BsPersonFill size={20} /><p> Thông tin khách hàng</p>
            </div></h3>
            <div className="aptd-cus-header">
              <h2 className="aptd-cus-name">{apt.name}</h2>
              <span className="aptd-badge-sm">Khách mới</span>
            </div>

            <div className="aptd-cus-contact">
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}>
                <FaPhoneAlt size={15} /><p> {apt.phone}</p>
              </div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}>
                <MdEmail size={15} /><p> {apt.email || apt.user?.email || '—'}</p>
              </div>
            </div>

            <div className="aptd-divider" />

            <div className="aptd-cus-note">
              <span className="aptd-note-label">GHI CHÚ TỪ KHÁCH</span>
              <p className="aptd-note-text">{apt.note || 'Không có ghi chú.'}</p>
            </div>
          </div>

          {/* Actions */}
          <div className="aptd-actions">
            {apt.status === 'pending' && (
              <button className="aptd-btn-main" onClick={() => handleUpdateStatus('confirmed')}>
                ✅ XÁC NHẬN LỊCH
              </button>
            )}

            {user && ['admin', 'staff'].includes(user.role) && (
              <button className="aptd-btn-secondary" onClick={() => setShowContactModal(true)}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}>
                  <MdMessage size={20} />LIÊN HỆ CHO KHÁCH
                </div>
              </button>
            )}

            <div className="aptd-action-row">
              <button className="aptd-btn-gray" onClick={() => alert('Tính năng đang phát triển')}><div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                // fontWeight: 600,
                // cursor: 'pointer'
              }}>
                <MdEditCalendar size={20} /> Đổi lịch
              </div></button>
              {apt.status !== 'cancelled' ? (
                <button className="aptd-btn-danger" onClick={() => handleUpdateStatus('cancelled')}><div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  // fontWeight: 600,
                  // cursor: 'pointer'
                }}>
                  <MdCancel size={20} /> Hủy lịch
                </div></button>
              ) : (
                <button className="aptd-btn-danger" style={{ opacity: 0.5 }} disabled>Đã hủy</button>
              )}
            </div>
          </div>
        </div>
      </div>

      {apt && (
        <ZaloContactModal
          open={showContactModal}
          onClose={() => setShowContactModal(false)}
          customer={{ fullName: apt.name, phone: apt.phone, avatar: apt.user?.avatar }}
        />
      )}
    </div>
  )
}
