import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { bookingService, type Booking } from '../../api/booking.service'
import Spinner from '../../components/ui/Spinner'
import { FiUser, FiMapPin, FiClock, FiArrowRight, FiWifi, FiCheck, FiX, FiCheckCircle, FiLogOut } from 'react-icons/fi'
import { MdCheckCircle, MdOutlineLocalLaundryService, MdOutlineCleaningServices } from 'react-icons/md'
import { BsHourglassSplit } from 'react-icons/bs'
import { FaParking } from 'react-icons/fa'

const STATUS_MAP: Record<string, { label: string, color: string, bg: string, icon: any }> = {
  pending: { label: 'Chờ thanh toán / xác nhận', color: '#175cd3', bg: '#eff8ff', icon: BsHourglassSplit },
  confirmed: { label: 'Đã xác nhận', color: '#027a48', bg: '#ecfdf3', icon: MdCheckCircle },
  checked_in: { label: 'Đang lưu trú', color: '#b54708', bg: '#fffaeb', icon: FiMapPin },
  checked_out: { label: 'Đã trả phòng', color: '#344054', bg: '#f2f4f7', icon: FiMapPin },
  cancelled: { label: 'Đã hủy', color: '#b42318', bg: '#fef3f2', icon: FiMapPin },
}

const TYPE_MAP: Record<string, string> = {
  hour: 'Theo giờ', day: 'Theo ngày', week: 'Theo tuần', month: 'Theo tháng',
}

const getServiceIcon = (name: string) => {
  const n = name.toLowerCase()
  if (n.includes('wifi') || n.includes('mạng')) return <FiWifi size={20} color="#0284c7" />
  if (n.includes('xe') || n.includes('parking')) return <FaParking size={20} color="#059669" />
  if (n.includes('dọn') || n.includes('cleaning')) return <MdOutlineCleaningServices size={20} color="#d97706" />
  if (n.includes('giặt') || n.includes('laundry')) return <MdOutlineLocalLaundryService size={20} color="#7c3aed" />
  return <FiMapPin size={20} color="#475569" />
}

const getServiceBg = (name: string) => {
  const n = name.toLowerCase()
  if (n.includes('wifi') || n.includes('mạng')) return '#e0f2fe'
  if (n.includes('xe') || n.includes('parking')) return '#d1fae5'
  if (n.includes('dọn') || n.includes('cleaning')) return '#fef3c7'
  if (n.includes('giặt') || n.includes('laundry')) return '#ede9fe'
  return '#f1f5f9'
}

export default function AdminBookingDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [booking, setBooking] = useState<Booking | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [processing, setProcessing] = useState(false)

  useEffect(() => {
    if (!id) return
    fetchBooking()
  }, [id])

  const fetchBooking = () => {
    setLoading(true)
    bookingService.getBookingById(id!)
      .then(res => setBooking(res.data))
      .catch(() => setError('Không tìm thấy thông tin Đặt phòng.'))
      .finally(() => setLoading(false))
  }

  const handleAction = async (action: 'confirm' | 'checkin' | 'checkout' | 'cancel' | 'pay') => {
    setProcessing(true)
    try {
      if (action === 'confirm') await bookingService.confirmBooking(id!)
      else if (action === 'checkin') await bookingService.checkInBooking(id!)
      else if (action === 'checkout') await bookingService.checkOutBooking(id!)
      else if (action === 'cancel') {
        if (!window.confirm('Bạn có chắc chắn muốn hủy booking này?')) return
        await bookingService.cancelBooking(id!)
      } else if (action === 'pay') {
        if (!window.confirm('Xác nhận đã nhận tiền mặt cho booking này?')) return
        await bookingService.payBooking(id!)
      }

      // Refresh booking details
      const res = await bookingService.getBookingById(id!)
      setBooking(res.data)
    } catch (err: any) {
      alert(err.response?.data?.message || 'Có lỗi xảy ra.')
    } finally {
      setProcessing(false)
    }
  }

  if (loading && !booking) {
    return (
      <div className="admin-page" style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
        <Spinner />
      </div>
    )
  }

  if (error || !booking) {
    return (
      <div className="admin-page" style={{ padding: '40px 0' }}>
        <div className="alert alert-error">{error}</div>
      </div>
    )
  }

  const statusInfo = STATUS_MAP[booking.status] || STATUS_MAP.pending

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: true })
  }
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('vi-VN')
  }

  return (
    <div className="admin-page">
      <div style={{ marginBottom: '24px' }}>
        <button
          onClick={() => navigate('/admin/bookings')}
          style={{ background: 'none', border: 'none', color: '#6b7280', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 500, fontSize: '1rem', padding: 0 }}
        >
          &larr; Quay lại danh sách Booking
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px', alignItems: 'start' }}>

        {/* Left Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

          {/* Header Section */}
          <div style={{ background: 'white', padding: '32px', borderRadius: '12px', borderLeft: '4px solid #047857', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                  MÃ ĐẶT PHÒNG
                </div>
                <h1 style={{ fontSize: '2rem', fontWeight: 800, color: '#0369a1', margin: '0 0 16px 0' }}>
                  {booking._id.substring(0, 8).toUpperCase()}
                </h1>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#6b7280', fontSize: '0.9rem' }}>
                  <FiClock /> Tạo lúc {formatTime(booking.createdAt)}, {formatDate(booking.createdAt)}
                </div>
              </div>
              <div>
                <span style={{
                  background: statusInfo.bg,
                  color: statusInfo.color,
                  padding: '8px 16px', borderRadius: '6px', fontSize: '0.875rem', fontWeight: 600,
                  display: 'inline-flex', alignItems: 'center', gap: '8px'
                }}>
                  {statusInfo.icon && <statusInfo.icon size={16} />}
                  {statusInfo.label}
                </span>
              </div>
            </div>
          </div>

          {/* Tenant Info */}
          <div style={{ background: 'white', padding: '32px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#334155', margin: '0 0 24px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FiUser color="#475569" /> Thông tin Khách thuê
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
              <div>
                <div style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '4px' }}>Họ và tên</div>
                <div style={{ fontSize: '1rem', fontWeight: 500, color: '#0f172a' }}>{booking.tenant?.name || 'Khách vãng lai'}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '4px' }}>Số Điện Thoại</div>
                <div style={{ fontSize: '1rem', fontWeight: 500, color: '#0f172a' }}>{booking.tenant?.phone || 'N/A'}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '4px' }}>Email</div>
                <div style={{ fontSize: '1rem', fontWeight: 500, color: '#0f172a' }}>{booking.tenant?.email || 'N/A'}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '4px' }}>CMND/CCCD</div>
                <div style={{ fontSize: '1rem', fontWeight: 500, color: '#0f172a' }}>{booking.tenant?.idCard || 'N/A'}</div>
              </div>
            </div>
          </div>

          {/* Room & Booking Info */}
          <div style={{ background: 'white', padding: '32px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#334155', margin: '0 0 24px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FiMapPin color="#475569" /> Thông tin Phòng & Thuê
            </h2>
            <div style={{ display: 'flex', gap: '24px' }}>
              {/* Room Image */}
              <div style={{ width: '200px', height: '140px', borderRadius: '8px', overflow: 'hidden', position: 'relative' }}>
                <img src={booking.room?.images?.[0]?.url || 'https://via.placeholder.com/400x300?text=Room'} alt="Room" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '12px', background: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent)', color: 'white' }}>
                  <div style={{ fontWeight: 700 }}>{booking.room?.name || 'Phòng'}</div>
                  <div style={{ fontSize: '0.75rem', opacity: 0.9 }}>{booking.room?.district || 'Khu vực'}</div>
                </div>
              </div>

              {/* Details */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '4px' }}>Loại Thuê</div>
                    <div style={{ fontSize: '1rem', fontWeight: 600, color: '#0f172a' }}>{TYPE_MAP[booking.bookingType] || booking.bookingType}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '4px' }}>Giá phòng / {TYPE_MAP[booking.bookingType] === 'Theo giờ' ? 'Giờ' : TYPE_MAP[booking.bookingType] === 'Theo ngày' ? 'Ngày' : 'Tháng'}</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0369a1' }}>{booking.unitPrice?.toLocaleString('vi-VN')} đ</div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: '#475569', marginBottom: '4px' }}>Nhận phòng</div>
                    <div style={{ fontSize: '1rem', fontWeight: 600, color: '#0f172a' }}>{formatDate(booking.checkInDateTime)}</div>
                  </div>
                  <FiArrowRight color="#94a3b8" size={20} />
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.75rem', color: '#475569', marginBottom: '4px' }}>Trả phòng (dự kiến)</div>
                    <div style={{ fontSize: '1rem', fontWeight: 600, color: '#0f172a' }}>{formatDate(booking.checkOutDateTime)}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Services */}
          <div style={{ background: 'white', padding: '32px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#334155', margin: '0 0 24px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FiUser color="#475569" /> Dịch vụ thuê kèm
            </h2>

            {(!booking.serviceBookings || booking.serviceBookings.length === 0) ? (
              <div style={{ color: '#64748b', fontStyle: 'italic' }}>Không có dịch vụ đi kèm.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {booking.serviceBookings.map((sb, idx) => (
                  <div key={idx} style={{ background: '#f8fafc', padding: '16px 20px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <div style={{ width: '48px', height: '48px', borderRadius: '8px', background: getServiceBg(sb.service?.name || ''), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {getServiceIcon(sb.service?.name || '')}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '1rem' }}>{sb.service?.name || 'Dịch vụ'}</div>
                        <div style={{ color: '#64748b', fontSize: '0.875rem' }}>Số lượng: {sb.quantity}</div>
                      </div>
                    </div>
                    <div style={{ fontWeight: 600, color: '#0f172a' }}>
                      {(sb.totalAmount || 0).toLocaleString('vi-VN')} đ
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* Right Column - Summary & Actions */}
        <div>
          <div style={{ background: 'white', padding: '32px', borderRadius: '12px', border: '1px solid #e2e8f0', position: 'sticky', top: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#334155', margin: '0 0 24px 0', paddingBottom: '16px', borderBottom: '1px solid #e2e8f0' }}>
              Thanh toán & Trạng thái
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569', fontSize: '0.9rem' }}>
                <span>Tiền thuê phòng</span>
                <span style={{ fontWeight: 600, color: '#0f172a' }}>{booking.roomTotal?.toLocaleString('vi-VN') || 0} đ</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569', fontSize: '0.9rem' }}>
                <span>Tổng dịch vụ</span>
                <span style={{ fontWeight: 600, color: '#0f172a' }}>{booking.serviceTotal?.toLocaleString('vi-VN') || 0} đ</span>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 0', borderTop: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0', marginBottom: '24px' }}>
              <span style={{ fontWeight: 600, color: '#334155' }}>Tổng cộng</span>
              <span style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0369a1' }}>{booking.totalAmount?.toLocaleString('vi-VN') || 0} đ</span>
            </div>

            <div style={{ background: booking.paymentStatus === 'paid' ? '#ecfdf5' : '#fff1f2', padding: '24px', borderRadius: '8px', border: `1px solid ${booking.paymentStatus === 'paid' ? '#d1fae5' : '#ffe4e6'}` }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                TRẠNG THÁI THANH TOÁN
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: booking.paymentStatus === 'paid' ? '#047857' : '#e11d48' }}>
                {booking.paymentStatus === 'paid' ? 'Đã thanh toán' : 'Chưa thanh toán'}
              </div>

              {booking.paymentStatus !== 'paid' && booking.status !== 'cancelled' && (
                <button
                  onClick={() => handleAction('pay')}
                  disabled={processing}
                  style={{ width: '100%', marginTop: '16px', background: '#e11d48', color: 'white', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: 600, cursor: processing ? 'not-allowed' : 'pointer' }}
                >
                  {processing ? <Spinner size="sm" /> : 'Xác nhận Đã thu tiền (Tiền mặt)'}
                </button>
              )}
            </div>

            {/* Admin Actions */}
            <div style={{ marginTop: '32px' }}>
              <h4 style={{ margin: '0 0 16px 0', color: '#475569', fontSize: '1rem', fontWeight: 600 }}>Cập nhật trạng thái Booking</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {booking.status === 'pending' && (
                  <button onClick={() => handleAction('confirm')} disabled={processing} style={{ width: '100%', background: '#0284c7', color: 'white', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: 600, cursor: processing ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                    <FiCheck size={18} /> Xác nhận Booking
                  </button>
                )}
                {booking.status === 'confirmed' && (
                  <button onClick={() => handleAction('checkin')} disabled={processing} style={{ width: '100%', background: '#059669', color: 'white', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: 600, cursor: processing ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                    <FiCheckCircle size={18} /> Check-in
                  </button>
                )}
                {booking.status === 'checked_in' && (
                  <button onClick={() => handleAction('checkout')} disabled={processing} style={{ width: '100%', background: '#475569', color: 'white', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: 600, cursor: processing ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                    <FiLogOut size={18} /> Check-out Khách
                  </button>
                )}
                {['pending', 'confirmed'].includes(booking.status) && (
                  <button onClick={() => handleAction('cancel')} disabled={processing} style={{ width: '100%', background: 'transparent', color: '#dc2626', border: '1px solid #f87171', padding: '12px', borderRadius: '8px', fontWeight: 600, cursor: processing ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                    <FiX size={18} /> Hủy Booking
                  </button>
                )}

                {!['pending', 'confirmed', 'checked_in'].includes(booking.status) && (
                  <div style={{ color: '#64748b', fontSize: '0.875rem', textAlign: 'center', fontStyle: 'italic', padding: '8px 0' }}>
                    Không có hành động khả dụng.
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  )
}
