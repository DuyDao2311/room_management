import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { serviceBookingService, type ServiceBooking } from '../../api/serviceBooking.service'
import { CATEGORY_LABELS, CATEGORY_TAGS } from '../../api/service.service'
import Spinner from '../../components/ui/Spinner'
import StarRating from '../../components/ui/StarRating'

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
                        <p style={{ margin: '0 0 8px 0', fontSize: '0.85rem', color: '#667085', fontWeight: 500 }}>Số lượng</p>
                        <div style={{ fontSize: '1rem', fontWeight: 600, color: '#101828' }}>{b.quantity} {b.service?.unit || ''}</div>
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
      </div>
    </div>
  )
}
