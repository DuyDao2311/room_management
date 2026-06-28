import { useState, useEffect } from 'react'
import { bookingService, type Booking } from '../../api/booking.service'
import { createPayment, redirectToPayment } from '../../api/payment'
import Spinner from '../../components/ui/Spinner'
import { FiInfo, FiMapPin } from 'react-icons/fi'
import { MdOutlineReceipt, MdCheckCircle } from 'react-icons/md'
import { BsHourglassSplit } from 'react-icons/bs'
// import { QRCodeSVG } from 'qrcode.react'

export default function MyBookings() {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [processing, setProcessing] = useState<string | null>(null)

  const [paymentBooking, setPaymentBooking] = useState<Booking | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<'momo' | 'vnpay' | 'cash'>('momo')
  const [cashModal, setCashModal] = useState(false)

  const fetchBookings = () => {
    setLoading(true)
    bookingService.getBookings()
      .then(res => setBookings(res.data))
      .catch(() => setError('Lỗi tải danh sách Booking.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchBookings()
  }, [])

  // Lock body scroll when modal is open
  useEffect(() => {
    if (paymentBooking || cashModal) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'auto'
    }
    return () => {
      document.body.style.overflow = 'auto'
    }
  }, [paymentBooking, cashModal])

  const handlePay = (booking: Booking) => {
    setPaymentMethod('momo')
    setPaymentBooking(booking)
  }

  const confirmPayment = async () => {
    if (!paymentBooking) return

    if (paymentMethod === 'cash') {
      setProcessing(paymentBooking._id)
      try {
        await bookingService.payBooking(paymentBooking._id)
        setPaymentBooking(null)
        setCashModal(true)
        fetchBookings()
      } catch (err: any) {
        alert(err.response?.data?.message || 'Lỗi thanh toán.')
      } finally {
        setProcessing(null)
      }
      return
    }

    // Momo / VNPay — real payment flow
    setProcessing(paymentBooking._id)
    try {
      const response = await createPayment({
        bookingId: paymentBooking._id,
        paymentMethod: paymentMethod as 'momo' | 'vnpay'
      })

      if (response.metadata.paymentUrl) {
        localStorage.setItem('pendingPaymentBookingId', paymentBooking._id)
        localStorage.setItem('pendingPaymentMethod', paymentMethod)
        redirectToPayment(response.metadata.paymentUrl)
      }
    } catch (err: any) {
      alert(err.message || err.response?.data?.message || 'Lỗi thanh toán.')
      setProcessing(null)
    }
  }

  const TYPE_MAP: Record<string, string> = {
    hour: 'Theo giờ', day: 'Theo ngày', week: 'Theo tuần', month: 'Theo tháng',
  }

  const STATUS_MAP: Record<string, { label: string, color: string, bg: string, icon: any }> = {
    pending: { label: 'Chờ thanh toán', color: '#175cd3', bg: '#eff8ff', icon: BsHourglassSplit },
    confirmed: { label: 'Đã xác nhận', color: '#027a48', bg: '#ecfdf3', icon: MdCheckCircle },
    checked_in: { label: 'Đang lưu trú', color: '#b54708', bg: '#fffaeb', icon: FiInfo },
    checked_out: { label: 'Đã trả phòng', color: '#344054', bg: '#f2f4f7', icon: FiInfo },
    cancelled: { label: 'Đã hủy', color: '#b42318', bg: '#fef3f2', icon: FiInfo },
  }

  const formatDateTime = (dateString: string) => {
    const d = new Date(dateString)
    const time = d.toLocaleTimeString('vi-VN', { hour12: false })
    const date = d.toLocaleDateString('vi-VN')
    return `${time} ${date}`
  }

  return (
    <div className="page-shell">
      <div className="container" style={{ padding: '40px 0' }}>
        <h1 style={{ color: '#003e68', fontSize: '2rem', fontWeight: 800, margin: '0 0 32px 0' }}>
          Lịch sử Đặt phòng <span style={{ color: '#667085', fontWeight: 400 }}>(Ngắn hạn)</span>
        </h1>

        {error && <div className="alert alert-error">{error}</div>}

        {loading ? <Spinner /> : (
          <div style={{ display: 'grid', gap: '20px' }}>
            {bookings.length === 0 ? (
              <div style={{ background: 'white', padding: '40px', borderRadius: '16px', textAlign: 'center', color: '#667085', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                Bạn chưa có lượt đặt phòng nào.
              </div>
            ) : (
              bookings.map(b => {
                const statusInfo = STATUS_MAP[b.status] || STATUS_MAP.pending;
                const isPaid = b.paymentStatus === 'paid';

                return (
                  <div key={b._id} style={{
                    background: 'white',
                    padding: '32px',
                    borderRadius: '12px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '24px',
                    borderLeft: isPaid ? '4px solid #005249' : 'none'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#101828', margin: '0 0 8px 0' }}>{b.room?.name || 'Phòng đã xóa'}</h2>
                        <div style={{ color: '#667085', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <FiMapPin /> {b.room?.district || ''}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{
                          background: statusInfo.bg,
                          color: statusInfo.color,
                          padding: '6px 12px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700,
                          display: 'inline-flex', alignItems: 'center', gap: '6px', textTransform: 'uppercase'
                        }}>
                          {statusInfo.icon && <statusInfo.icon size={14} />}
                          {statusInfo.label}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr 1.5fr', gap: '24px' }}>
                      <div>
                        <p style={{ margin: '0 0 8px 0', fontSize: '0.85rem', color: '#667085', fontWeight: 500 }}>Loại thuê</p>
                        <div style={{ fontSize: '1rem', fontWeight: 600, color: '#101828' }}>{TYPE_MAP[b.bookingType]}</div>
                      </div>
                      <div>
                        <p style={{ margin: '0 0 8px 0', fontSize: '0.85rem', color: '#667085', fontWeight: 500 }}>Nhận phòng</p>
                        <div style={{ fontSize: '1rem', fontWeight: 500, color: '#101828' }}>
                          {formatDateTime(b.checkInDateTime)}
                        </div>
                      </div>
                      <div>
                        <p style={{ margin: '0 0 8px 0', fontSize: '0.85rem', color: '#667085', fontWeight: 500 }}>Trả phòng</p>
                        <div style={{ fontSize: '1rem', fontWeight: 500, color: '#101828' }}>
                          {formatDateTime(b.checkOutDateTime)}
                        </div>
                      </div>
                    </div>

                    <div style={{ background: '#f8f9fa', padding: '16px 24px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <p style={{ margin: '0 0 8px 0', fontSize: '0.85rem', color: '#667085', fontWeight: 500 }}>Tổng thanh toán</p>
                        <div style={{ fontSize: '1.4rem', fontWeight: 700, color: isPaid ? '#d92d20' : '#101828', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {b.totalAmount.toLocaleString('vi-VN')} đ
                        </div>
                      </div>
                      <div>
                        {isPaid ? (
                          <div style={{ color: '#005249', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', fontSize: '1rem' }}>
                            <MdOutlineReceipt size={22} /> Đã thanh toán
                          </div>
                        ) : b.paymentStatus === 'refunded' ? (
                          <div style={{ color: '#667085', fontWeight: 700 }}>Đã hoàn tiền</div>
                        ) : b.status === 'cancelled' ? (
                          <div style={{ color: '#d92d20', fontWeight: 700 }}>Đã hủy</div>
                        ) : (
                          <button
                            onClick={() => handlePay(b)}
                            style={{
                              background: '#103859', color: 'white', border: 'none', padding: '12px 24px',
                              borderRadius: '4px', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem', textTransform: 'uppercase'
                            }}
                          >
                            Thanh toán ngay
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* Payment Modal — matching MyInvoices style                        */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {paymentBooking && (
          <div
            className="rent-modal-overlay"
            style={{ alignItems: 'center', padding: '20px', overflow: 'hidden' }}
            onClick={(e) => { if (e.target === e.currentTarget) setPaymentBooking(null) }}
          >
            <div
              className="rent-modal"
              style={{
                maxWidth: '860px', width: '100%', borderRadius: '12px', padding: 0,
                overflow: 'hidden', background: '#f3f4f6', display: 'flex', flexDirection: 'column',
                maxHeight: 'calc(100vh - 40px)',
              }}
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div style={{ background: '#fff', padding: '24px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e5e7eb', flexShrink: 0 }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '1.5rem', color: '#111827', fontWeight: 800 }}>
                    Thanh toán Booking
                  </h2>
                  <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: '0.9rem' }}>
                    Chọn phương thức thanh toán cho lượt đặt phòng này.
                  </p>
                </div>
                <button
                  onClick={() => setPaymentBooking(null)}
                  style={{ background: 'none', border: '1px solid #d1d5db', borderRadius: '6px', padding: '6px 14px', cursor: 'pointer', fontWeight: 600, color: '#374151', fontSize: '1rem' }}
                >
                  ✕
                </button>
              </div>

              {/* Body */}
              <div style={{ padding: '32px', display: 'flex', gap: '32px', alignItems: 'flex-start', overflowY: 'auto', flex: 1 }}>

                {/* Left Column — Booking details */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '24px' }}>

                  {/* Booking Info Card */}
                  <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#4b5563', fontWeight: 700, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '16px' }}>
                      <MdOutlineReceipt size={18} /> THÔNG TIN BOOKING
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', fontSize: '0.9rem' }}>
                      <span style={{ color: '#6b7280' }}>Phòng</span>
                      <span style={{ fontWeight: 600, color: '#111827' }}>{paymentBooking.room?.name || 'N/A'}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', fontSize: '0.9rem' }}>
                      <span style={{ color: '#6b7280' }}>Loại thuê</span>
                      <span style={{ fontWeight: 600, color: '#111827' }}>{TYPE_MAP[paymentBooking.bookingType]}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', fontSize: '0.9rem' }}>
                      <span style={{ color: '#6b7280' }}>Nhận phòng</span>
                      <span style={{ fontWeight: 600, color: '#111827' }}>{new Date(paymentBooking.checkInDateTime).toLocaleString('vi-VN')}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', fontSize: '0.9rem' }}>
                      <span style={{ color: '#6b7280' }}>Trả phòng</span>
                      <span style={{ fontWeight: 600, color: '#111827' }}>{new Date(paymentBooking.checkOutDateTime).toLocaleString('vi-VN')}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                      <span style={{ color: '#6b7280' }}>Đơn giá</span>
                      <span style={{ fontWeight: 600, color: '#111827' }}>{paymentBooking.unitPrice?.toLocaleString('vi-VN')} đ / {paymentBooking.bookingType === 'hour' ? 'giờ' : paymentBooking.bookingType === 'day' ? 'ngày' : paymentBooking.bookingType === 'week' ? 'tuần' : 'tháng'}</span>
                    </div>
                  </div>

                  {/* QR Code for Momo/VNPay
                  {paymentMethod !== 'cash' && (
                    <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', textAlign: 'center' }}>
                      <div style={{ fontSize: '0.9rem', color: '#6b7280', marginBottom: '16px' }}>
                        Quét mã QR để thanh toán qua {paymentMethod === 'momo' ? 'Ví Momo' : 'VNPay'}
                      </div>
                      <div style={{ background: '#fff', padding: '16px', display: 'inline-block', borderRadius: '12px', border: '1px solid #eaecf0' }}>
                        <QRCodeSVG value={`${paymentMethod.toUpperCase()}:PAY:${paymentBooking._id}:${paymentBooking.totalAmount}`} size={180} />
                      </div>
                    </div>
                  )} */}
                </div>

                {/* Right Column — Payment Card (dark blue) */}
                <div style={{ width: '340px', background: '#003e68', borderRadius: '16px', padding: '32px', color: '#fff', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)', flexShrink: 0 }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#93c5fd', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>
                    TỔNG TIỀN THANH TOÁN
                  </div>
                  <div style={{ fontSize: '2.5rem', fontWeight: 800, marginBottom: '24px', display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                    {paymentBooking.totalAmount.toLocaleString('vi-VN')} <span style={{ fontSize: '1.2rem', fontWeight: 500, color: '#93c5fd' }}>đ</span>
                  </div>

                  {/* Payment Method Selection */}
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#93c5fd', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '16px' }}>
                    PHƯƠNG THỨC THANH TOÁN
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '32px' }}>
                    {/* Momo */}
                    <div
                      onClick={() => setPaymentMethod('momo')}
                      style={{ background: 'rgba(255,255,255,0.1)', border: paymentMethod === 'momo' ? '1px solid #60a5fa' : '1px solid transparent', borderRadius: '8px', padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', transition: 'all 0.2s' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '32px', height: '32px', background: '#fff', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                          <img src="https://upload.wikimedia.org/wikipedia/vi/f/fe/MoMo_Logo.png" alt="MoMo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                        </div>
                        <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>VÍ MOMO</span>
                      </div>
                      <div style={{ width: '16px', height: '16px', borderRadius: '50%', border: paymentMethod === 'momo' ? '4px solid #fff' : '2px solid rgba(255,255,255,0.3)', background: paymentMethod === 'momo' ? '#60a5fa' : 'transparent' }} />
                    </div>

                    {/* VNPay */}
                    <div
                      onClick={() => setPaymentMethod('vnpay')}
                      style={{ background: 'rgba(255,255,255,0.1)', border: paymentMethod === 'vnpay' ? '1px solid #60a5fa' : '1px solid transparent', borderRadius: '8px', padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', transition: 'all 0.2s' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '32px', height: '32px', background: '#fff', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                          <img src="https://vnpay.vn/s1/statics.vnpay.vn/2023/6/0oxhzjmxbksr1686814746087.png" alt="VNPay" style={{ width: '80%', height: '80%', objectFit: 'contain' }} />
                        </div>
                        <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>VNPAY</span>
                      </div>
                      <div style={{ width: '16px', height: '16px', borderRadius: '50%', border: paymentMethod === 'vnpay' ? '4px solid #fff' : '2px solid rgba(255,255,255,0.3)', background: paymentMethod === 'vnpay' ? '#60a5fa' : 'transparent' }} />
                    </div>

                    {/* Cash */}
                    <div
                      onClick={() => setPaymentMethod('cash')}
                      style={{ background: 'rgba(255,255,255,0.1)', border: paymentMethod === 'cash' ? '1px solid #60a5fa' : '1px solid transparent', borderRadius: '8px', padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', transition: 'all 0.2s' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '32px', height: '32px', background: '#fff', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', color: '#10b981' }}>
                          <MdOutlineReceipt size={20} />
                        </div>
                        <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>TIỀN MẶT</span>
                      </div>
                      <div style={{ width: '16px', height: '16px', borderRadius: '50%', border: paymentMethod === 'cash' ? '4px solid #fff' : '2px solid rgba(255,255,255,0.3)', background: paymentMethod === 'cash' ? '#60a5fa' : 'transparent' }} />
                    </div>
                  </div>

                  {paymentMethod === 'cash' && (
                    <div style={{ background: 'rgba(255,255,255,0.1)', border: '1px dashed #60a5fa', borderRadius: '8px', padding: '12px', fontSize: '0.85rem', color: '#dbeafe', marginBottom: '16px', lineHeight: 1.5 }}>
                      Vui lòng nộp tiền mặt trực tiếp cho nhân viên quản lý khu vực. Booking sẽ được cập nhật trạng thái sau khi nhân viên xác nhận.
                    </div>
                  )}

                  <button
                    onClick={confirmPayment}
                    disabled={processing === paymentBooking._id}
                    style={{
                      width: '100%', background: '#fff', color: '#003e68', border: 'none',
                      borderRadius: '8px', padding: '16px', fontWeight: 800, fontSize: '1rem',
                      cursor: processing === paymentBooking._id ? 'not-allowed' : 'pointer',
                      marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      gap: '8px', transition: 'all 0.2s',
                      opacity: processing === paymentBooking._id ? 0.7 : 1,
                    }}
                  >
                    {processing === paymentBooking._id ? <Spinner size="sm" /> : <MdOutlineReceipt size={20} />}
                    {processing === paymentBooking._id ? 'Đang xử lý...' : 'Thanh toán'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── MODAL: Thông báo thanh toán tiền mặt ── */}
        {cashModal && (
          <div
            onClick={(e) => { if (e.target === e.currentTarget) setCashModal(false) }}
            style={{
              position: 'fixed', inset: 0, zIndex: 9999,
              background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              animation: 'fadeIn 0.3s ease',
            }}
          >
            <div style={{
              background: '#fff', borderRadius: '16px', padding: '40px',
              maxWidth: '420px', width: '90%', textAlign: 'center',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
              animation: 'slideUp 0.3s ease',
            }}>
              <div style={{
                width: '72px', height: '72px', background: '#e0f2fe',
                borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 20px',
              }}>
                <FiInfo size={36} color="#0369a1" />
              </div>
              <h3 style={{ margin: '0 0 12px', fontSize: '1.3rem', fontWeight: 800, color: '#111827' }}>
                Thông báo
              </h3>
              <p style={{ margin: '0 0 24px', color: '#4b5563', fontSize: '1rem', lineHeight: 1.6 }}>
                Vui lòng liên hệ với quản lý khu vực để thanh toán tiền mặt. Booking sẽ tự động cập nhật khi được xác nhận.
              </p>
              <button
                onClick={() => setCashModal(false)}
                style={{
                  background: '#003e68', color: '#fff', border: 'none',
                  borderRadius: '8px', padding: '12px 32px', fontWeight: 700,
                  fontSize: '1rem', cursor: 'pointer', transition: 'all 0.2s',
                }}
              >
                Đã hiểu
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
