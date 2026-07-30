import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { serviceBookingService, type ServiceBooking } from '../../api/serviceBooking.service'
import { CATEGORY_LABELS, CATEGORY_TAGS } from '../../api/service.service'
import { createPayment, redirectToPayment } from '../../api/payment'
import Spinner from '../../components/ui/Spinner'
import StarRating from '../../components/ui/StarRating'
import { MdOutlineReceipt } from 'react-icons/md'

const STATUS_MAP: Record<string, { label: string, color: string, bg: string }> = {
  pending: { label: 'Chờ xác nhận', color: '#175cd3', bg: '#eff8ff' },
  confirmed: { label: 'Đã xác nhận', color: '#027a48', bg: '#ecfdf3' },
  completed: { label: 'Đã hoàn thành', color: '#344054', bg: '#f2f4f7' },
  cancelled: { label: 'Đã hủy', color: '#b42318', bg: '#fef3f2' },
}

const ONE_HOUR_MS = 60 * 60 * 1000

export default function MyServiceBookings() {
  const [bookings, setBookings] = useState<ServiceBooking[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [processing, setProcessing] = useState<string | null>(null)

  const [rateModal, setRateModal] = useState<ServiceBooking | null>(null)
  const [ratingValue, setRatingValue] = useState(5)
  const [reviewValue, setReviewValue] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [rateError, setRateError] = useState('')
  const [searchParams, setSearchParams] = useSearchParams()
  const [highlightedId, setHighlightedId] = useState<string | null>(null)

  const [paymentBooking, setPaymentBooking] = useState<ServiceBooking | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<'momo' | 'vnpay' | 'cash'>('momo')
  const [cashModal, setCashModal] = useState(false)

  const fetchBookings = () => {
    setLoading(true)
    serviceBookingService.getBookings()
      .then(res => setBookings(res.data))
      .catch(() => setError('Lỗi tải danh sách booking dịch vụ.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchBookings() }, [])

  // Cuộn tới + highlight booking được click từ notification (param ?highlight=id)
  useEffect(() => {
    const id = searchParams.get('highlight')
    if (!id || loading) return
    if (bookings.some(b => b._id === id)) {
      setHighlightedId(id)
      document.getElementById(`service-booking-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      setTimeout(() => setHighlightedId(null), 2500)
    }
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      next.delete('highlight')
      return next
    }, { replace: true })
  }, [bookings, loading, searchParams, setSearchParams])

  useEffect(() => {
    if (paymentBooking || cashModal || rateModal) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'auto'
    }
    return () => { document.body.style.overflow = 'auto' }
  }, [paymentBooking, cashModal, rateModal])

  const canCancel = (b: ServiceBooking) =>
    b.status === 'pending' && new Date(b.scheduledAt).getTime() - Date.now() >= ONE_HOUR_MS

  const handleCancel = async (b: ServiceBooking) => {
    if (!confirm('Bạn có chắc chắn muốn hủy booking dịch vụ này?')) return
    setProcessing(b._id)
    try {
      await serviceBookingService.cancelBooking(b._id)
      fetchBookings()
    } catch (err: any) {
      alert(err.response?.data?.message || 'Hủy thất bại.')
    } finally {
      setProcessing(null)
    }
  }

  const handlePay = (booking: ServiceBooking) => {
    setPaymentMethod('momo')
    setPaymentBooking(booking)
  }

  const confirmPayment = async () => {
    if (!paymentBooking) return

    if (paymentMethod === 'cash') {
      setPaymentBooking(null)
      setCashModal(true)
      return
    }

    setProcessing(paymentBooking._id)
    try {
      const response = await createPayment({
        serviceBookingId: paymentBooking._id,
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

  const openRateModal = (b: ServiceBooking) => {
    setRatingValue(5)
    setReviewValue('')
    setSelectedTags([])
    setRateError('')
    setRateModal(b)
  }

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])
  }

  const submitRating = async () => {
    if (!rateModal) return
    setRateError('')
    setProcessing(rateModal._id)
    try {
      await serviceBookingService.rateBooking(rateModal._id, { rating: ratingValue, review: reviewValue, tags: selectedTags })
      setRateModal(null)
      fetchBookings()
    } catch (err: any) {
      setRateError(err.response?.data?.message || 'Chấm sao thất bại.')
    } finally {
      setProcessing(null)
    }
  }

  return (
    <div className="page-shell">
      <div className="container" style={{ padding: '40px 0' }}>
        <h1 style={{ color: '#003e68', fontSize: '2rem', fontWeight: 800, margin: '0 0 32px 0' }}>
          Dịch vụ của tôi
        </h1>

        {error && <div className="alert alert-error">{error}</div>}

        {loading ? <Spinner /> : (
          <div style={{ display: 'grid', gap: '20px' }}>
            {bookings.length === 0 ? (
              <div style={{ background: 'white', padding: '40px', borderRadius: '16px', textAlign: 'center', color: '#667085', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                Bạn chưa đặt dịch vụ nào.
              </div>
            ) : (
              bookings.map(b => {
                const statusInfo = STATUS_MAP[b.status] || STATUS_MAP.pending
                return (
                  <div
                    key={b._id}
                    id={`service-booking-${b._id}`}
                    style={{
                      background: highlightedId === b._id ? '#fff7e6' : 'white',
                      padding: '32px',
                      borderRadius: '12px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '20px',
                      transition: 'background 0.3s ease',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#101828', margin: '0 0 8px 0' }}>{b.service?.name || 'Dịch vụ đã tạm ngừng'}</h2>
                        <div style={{ color: '#667085', fontSize: '0.9rem' }}>{b.service ? CATEGORY_LABELS[b.service.category] : ''}</div>
                      </div>
                      <span style={{ background: statusInfo.bg, color: statusInfo.color, padding: '6px 12px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>
                        {statusInfo.label}
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '24px' }}>
                      <div>
                        <p style={{ margin: '0 0 8px 0', fontSize: '0.85rem', color: '#667085', fontWeight: 500 }}>Thời gian hẹn</p>
                        <div style={{ fontSize: '1rem', fontWeight: 600, color: '#101828' }}>
                          {new Date(b.scheduledAt).toLocaleString('vi-VN')}
                        </div>
                      </div>
                      <div>
                        <p style={{ margin: '0 0 8px 0', fontSize: '0.85rem', color: '#667085', fontWeight: 500 }}>{b.selectedVariant ? 'Lựa chọn' : 'Số lượng'}</p>
                        <div style={{ fontSize: '1rem', fontWeight: 600, color: '#101828' }}>
                          {b.selectedVariant ? `${b.selectedVariant} • SL: ${b.matchQuantity ?? b.quantity}` : `${b.quantity} ${b.service?.unit || ''}`}
                        </div>
                      </div>
                      <div>
                        <p style={{ margin: '0 0 8px 0', fontSize: '0.85rem', color: '#667085', fontWeight: 500 }}>Thanh toán</p>
                        <div style={{ fontSize: '1rem', fontWeight: 600, color: b.paymentStatus === 'paid' ? '#088373' : '#d92d20' }}>
                          {b.paymentStatus === 'paid' ? 'Đã thanh toán' : 'Chưa thanh toán'}
                        </div>
                      </div>
                    </div>

                    <div style={{ background: '#f8f9fa', padding: '16px 24px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <p style={{ margin: '0 0 8px 0', fontSize: '0.85rem', color: '#667085', fontWeight: 500 }}>Tổng tiền</p>
                        <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#101828' }}>{b.totalAmount.toLocaleString('vi-VN')} đ</div>
                      </div>
                      <div style={{ display: 'flex', gap: '12px' }}>
                        {canCancel(b) && (
                          <button
                            onClick={() => handleCancel(b)}
                            disabled={processing === b._id}
                            className="button button-secondary"
                          >
                            {processing === b._id ? 'Đang xử lý...' : 'Hủy booking'}
                          </button>
                        )}
                        {b.status === 'confirmed' && b.paymentStatus === 'unpaid' && (
                          <button
                            onClick={() => handlePay(b)}
                            className="button button-primary"
                          >
                            Thanh toán
                          </button>
                        )}
                        {b.paymentStatus === 'paid' && b.status !== 'completed' && (
                          <div style={{ color: '#005249', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', fontSize: '1rem' }}>
                            <MdOutlineReceipt size={22} /> Đã thanh toán
                          </div>
                        )}
                        {b.status === 'completed' && !b.rating && (
                          <button onClick={() => openRateModal(b)} className="button button-primary">
                            Đánh Giá
                          </button>
                        )}
                        {b.status === 'completed' && b.rating && (
                          <div style={{ fontWeight: 700, color: '#f79009' }}>★ {b.rating}/5 — Đã chấm sao</div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}

        {rateModal && (
          <div className="modal-overlay" onClick={() => setRateModal(null)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h2>Đánh giá dịch vụ</h2>
                <button className="modal-close" onClick={() => setRateModal(null)}>✕</button>
              </div>
              <div className="modal-form" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {rateError && <div className="alert alert-error">{rateError}</div>}

                <div className="form-group" style={{ display: 'flex', justifyContent: 'center' }}>
                  <StarRating value={ratingValue} onChange={setRatingValue} size="lg" />
                </div>

                {rateModal.service && (
                  <div className="form-group">
                    <label style={{ fontWeight: 700, marginBottom: '10px', display: 'block' }}>Nhận xét nhanh</label>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {(CATEGORY_TAGS[rateModal.service.category] || []).map(tag => {
                        const active = selectedTags.includes(tag)
                        return (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => toggleTag(tag)}
                            style={{
                              padding: '8px 16px',
                              borderRadius: '999px',
                              border: active ? '1px solid #0f5cc7' : '1px solid #eaecf0',
                              background: active ? '#0f5cc7' : '#fff',
                              color: active ? '#fff' : '#344054',
                              fontSize: '0.85rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                              transition: 'all 150ms ease',
                            }}
                          >
                            {tag}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                <div className="form-group">
                  <label htmlFor="review-text" style={{ fontWeight: 700, marginBottom: '10px', display: 'block' }}>Nhận xét riêng (tùy chọn)</label>
                  <textarea id="review-text" className="form-input" value={reviewValue} onChange={e => setReviewValue(e.target.value)} rows={3} placeholder="Chia sẻ trải nghiệm của bạn..." maxLength={1000} />
                </div>

                <div className="modal-actions">
                  <button type="button" className="button button-secondary" onClick={() => setRateModal(null)}>Hủy</button>
                  <button type="button" className="button button-primary" onClick={submitRating} disabled={processing === rateModal._id}>
                    {processing === rateModal._id ? 'Đang gửi...' : 'Gửi đánh giá'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Payment Modal */}
        {paymentBooking && (
          <div
            className="rent-modal-overlay"
            style={{ alignItems: 'center', padding: '20px', overflow: 'hidden', position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center' }}
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
                    Thanh toán Dịch Vụ
                  </h2>
                  <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: '0.9rem' }}>
                    Chọn phương thức thanh toán cho dịch vụ này.
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
                  <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#4b5563', fontWeight: 700, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '16px' }}>
                      <MdOutlineReceipt size={18} /> THÔNG TIN DỊCH VỤ
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', fontSize: '0.9rem' }}>
                      <span style={{ color: '#6b7280' }}>Tên dịch vụ</span>
                      <span style={{ fontWeight: 600, color: '#111827' }}>{paymentBooking.service?.name}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', fontSize: '0.9rem' }}>
                      <span style={{ color: '#6b7280' }}>Loại</span>
                      <span style={{ fontWeight: 600, color: '#111827' }}>{paymentBooking.service?.category ? CATEGORY_LABELS[paymentBooking.service.category] : 'N/A'}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', fontSize: '0.9rem' }}>
                      <span style={{ color: '#6b7280' }}>Số lượng</span>
                      <span style={{ fontWeight: 600, color: '#111827' }}>{paymentBooking.quantity} {paymentBooking.service?.unit}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', fontSize: '0.9rem' }}>
                      <span style={{ color: '#6b7280' }}>Thời gian hẹn</span>
                      <span style={{ fontWeight: 600, color: '#111827' }}>{new Date(paymentBooking.scheduledAt).toLocaleString('vi-VN')}</span>
                    </div>
                  </div>
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
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
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

        {/* Modal Tiền mặt thành công (chỉ hiện thông báo) */}
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
                <MdOutlineReceipt size={36} color="#0369a1" />
              </div>
              <h3 style={{ margin: '0 0 12px', fontSize: '1.3rem', fontWeight: 800, color: '#111827' }}>
                Yêu cầu đã được gửi
              </h3>
              <p style={{ margin: '0 0 24px', color: '#4b5563', fontSize: '1rem', lineHeight: 1.6 }}>
                Vui lòng liên hệ với Ban quản lý tòa nhà để tiến hành nộp tiền mặt. Booking dịch vụ của bạn sẽ được chuyển trạng thái ngay sau đó.
              </p>
              <button
                className="button button-primary"
                style={{ width: '100%', padding: '12px', fontSize: '1rem' }}
                onClick={() => setCashModal(false)}
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
