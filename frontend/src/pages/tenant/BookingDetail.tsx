import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { bookingService, type Booking } from '../../api/booking.service'
import Spinner from '../../components/ui/Spinner'
import { FiUser, FiMapPin, FiClock, FiArrowRight, FiWifi } from 'react-icons/fi'
import { MdCheckCircle, MdOutlineLocalLaundryService, MdOutlineCleaningServices } from 'react-icons/md'
import { BsHourglassSplit } from 'react-icons/bs'
import { FaParking } from 'react-icons/fa'

const STATUS_MAP: Record<string, { label: string, color: string, bg: string, icon: any }> = {
  pending: { label: 'Chờ thanh toán', color: '#175cd3', bg: '#eff8ff', icon: BsHourglassSplit },
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

export default function BookingDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [booking, setBooking] = useState<Booking | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!id) return
    bookingService.getBookingById(id)
      .then(res => setBooking(res.data))
      .catch(() => setError('Không tìm thấy thông tin Đặt phòng.'))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <div className="page-shell">
        <div className="container" style={{ padding: '40px 0', display: 'flex', justifyContent: 'center' }}>
          <Spinner />
        </div>
      </div>
    )
  }

  if (error || !booking) {
    return (
      <div className="page-shell">
        <div className="container" style={{ padding: '40px 0' }}>
          <div className="alert alert-error">{error}</div>
        </div>
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
    <div className="page-shell" style={{ backgroundColor: '#f9fafb', minHeight: '100vh' }}>
      <div className="container" style={{ padding: '40px 0' }}>
        
        <button 
          onClick={() => navigate('/my-bookings')} 
          style={{ background: 'none', border: 'none', color: '#6b7280', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginBottom: '24px', fontWeight: 500 }}
        >
          &larr; Quay lại danh sách
        </button>

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
            <div style={{ background: '#f8fafc', padding: '32px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#334155', margin: '0 0 24px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FiUser color="#475569" /> Thông tin Khách thuê
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                <div>
                  <div style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '4px' }}>Họ và tên</div>
                  <div style={{ fontSize: '1rem', fontWeight: 500, color: '#0f172a' }}>{booking.tenant?.name || 'N/A'}</div>
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
            <div style={{ background: '#f8fafc', padding: '32px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#334155', margin: '0 0 24px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FiMapPin color="#475569" /> Thông tin Phòng & Thuê
              </h2>
              <div style={{ display: 'flex', gap: '24px' }}>
                {/* Room Image */}
                <div style={{ width: '200px', height: '140px', borderRadius: '8px', overflow: 'hidden', position: 'relative' }}>
                  <img src={booking.room?.images?.[0]?.url || 'https://via.placeholder.com/400x300?text=Room'} alt="Room" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '12px', background: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent)', color: 'white' }}>
                    <div style={{ fontWeight: 700 }}>{booking.room?.name || 'Phòng'}</div>
                    <div style={{ fontSize: '0.75rem', opacity: 0.9 }}>{booking.room?.building || 'Tòa nhà'}</div>
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

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#e2e8f0', padding: '16px', borderRadius: '8px' }}>
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
            <div style={{ background: '#f8fafc', padding: '32px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#334155', margin: '0 0 24px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FiUser color="#475569" /> Dịch vụ thuê kèm
              </h2>
              
              {(!booking.serviceBookings || booking.serviceBookings.length === 0) ? (
                <div style={{ color: '#64748b', fontStyle: 'italic' }}>Không có dịch vụ đi kèm.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {booking.serviceBookings.map((sb, idx) => (
                    <div key={idx} style={{ background: 'white', padding: '16px 20px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid #f1f5f9' }}>
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

          {/* Right Column - Summary */}
          <div>
            <div style={{ background: 'white', padding: '32px', borderRadius: '12px', border: '1px solid #e2e8f0', position: 'sticky', top: '24px' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#334155', margin: '0 0 24px 0', paddingBottom: '16px', borderBottom: '1px solid #e2e8f0' }}>
                Tóm tắt thanh toán
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
              
              <div style={{ background: '#f8fafc', padding: '24px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                  SỐ TIỀN CẦN THANH TOÁN NGAY
                </div>
                <div style={{ fontSize: '2rem', fontWeight: 800, color: '#047857' }}>
                  {booking.paymentStatus === 'paid' ? '0 đ' : `${booking.totalAmount?.toLocaleString('vi-VN')} đ`}
                </div>
                {booking.paymentStatus === 'paid' && (
                  <div style={{ marginTop: '8px', color: '#047857', fontSize: '0.875rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <MdCheckCircle /> Đã thanh toán
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
