import { useState, useEffect } from 'react'
import { bookingService, type Booking } from '../../api/booking.service'
import Spinner from '../../components/ui/Spinner'
import { FiCheck, FiX, FiCheckCircle, FiLogOut } from 'react-icons/fi'

export default function BookingManagement() {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [processing, setProcessing] = useState<string | null>(null)

  const [filterStatus, setFilterStatus] = useState('')
  const [filterPayment, setFilterPayment] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const ITEMS_PER_PAGE = 10

  const fetchBookings = () => {
    setLoading(true)
    bookingService.getBookings({ status: filterStatus, paymentStatus: filterPayment })
      .then(res => setBookings(res.data))
      .catch(() => setError('Lỗi tải danh sách Booking.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchBookings()
  }, [filterStatus, filterPayment])

  const handleAction = async (id: string, action: 'confirm' | 'checkin' | 'checkout' | 'cancel' | 'pay') => {
    setProcessing(id)
    try {
      if (action === 'confirm') await bookingService.confirmBooking(id)
      else if (action === 'checkin') await bookingService.checkInBooking(id)
      else if (action === 'checkout') await bookingService.checkOutBooking(id)
      else if (action === 'cancel') {
        if (!confirm('Bạn có chắc chắn muốn hủy booking này?')) return
        await bookingService.cancelBooking(id)
      } else if (action === 'pay') {
        await bookingService.payBooking(id)
      }
      fetchBookings()
    } catch (err: any) {
      alert(err.response?.data?.message || 'Có lỗi xảy ra.')
    } finally {
      setProcessing(null)
    }
  }

  const STATUS_MAP: Record<string, { label: string, color: string, bg: string }> = {
    pending: { label: 'Chờ xác nhận', color: '#b86b00', bg: '#fddcb0' },
    confirmed: { label: 'Đã xác nhận', color: '#0052cc', bg: '#deebff' },
    checked_in: { label: 'Đã Check-in', color: '#088373', bg: '#bef2e8' },
    checked_out: { label: 'Đã Check-out', color: '#667085', bg: '#f0f2f5' },
    cancelled: { label: 'Đã hủy', color: '#d92d20', bg: '#fee4e2' },
  }

  const PAYMENT_MAP: Record<string, { label: string, color: string }> = {
    pending: { label: 'Chưa thanh toán', color: '#d92d20' },
    paid: { label: 'Đã thanh toán', color: '#088373' },
    refunded: { label: 'Đã hoàn tiền', color: '#667085' },
  }

  const TYPE_MAP: Record<string, string> = {
    hour: 'Theo giờ',
    day: 'Theo ngày',
    week: 'Theo tuần',
    month: 'Theo tháng',
  }

  return (
    <div className="page-shell">
      <div className="admin-page">
        <h1 style={{ color: '#003e68', fontSize: '2rem', fontWeight: 700, margin: '0 0 24px 0', paddingBottom: '16px', borderBottom: '1px solid #eaecf0' }}>
          Quản lý Booking
        </h1>

        <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', background: 'white', padding: '12px 16px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
          <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setCurrentPage(1); }} style={{ padding: '10px 16px', borderRadius: '8px', border: '1px solid #eaecf0', outline: 'none' }}>
            <option value="">Tất cả Trạng thái</option>
            <option value="pending">Chờ xác nhận</option>
            <option value="confirmed">Đã xác nhận</option>
            <option value="checked_in">Đã Check-in</option>
            <option value="checked_out">Đã Check-out</option>
            <option value="cancelled">Đã hủy</option>
          </select>
          <select value={filterPayment} onChange={e => { setFilterPayment(e.target.value); setCurrentPage(1); }} style={{ padding: '10px 16px', borderRadius: '8px', border: '1px solid #eaecf0', outline: 'none' }}>
            <option value="">Tất cả Thanh toán</option>
            <option value="pending">Chưa thanh toán</option>
            <option value="paid">Đã thanh toán</option>
            <option value="refunded">Đã hoàn tiền</option>
          </select>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        {loading ? <Spinner /> : (
          <div style={{ background: 'white', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.03)', overflow: 'hidden' }}>
            {bookings.length === 0 ? (
              <div style={{ padding: '32px', textAlign: 'center', color: '#667085' }}>Không có dữ liệu.</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead style={{ background: '#f9fafb', borderBottom: '1px solid #eaecf0' }}>
                  <tr>
                    <th style={{ padding: '16px 24px', color: '#667085', fontSize: '0.85rem', fontWeight: 600 }}>Phòng</th>
                    <th style={{ padding: '16px 24px', color: '#667085', fontSize: '0.85rem', fontWeight: 600 }}>Khách hàng</th>
                    <th style={{ padding: '16px 24px', color: '#667085', fontSize: '0.85rem', fontWeight: 600 }}>Thời gian</th>
                    <th style={{ padding: '16px 24px', color: '#667085', fontSize: '0.85rem', fontWeight: 600 }}>Tổng tiền</th>
                    <th style={{ padding: '16px 24px', color: '#667085', fontSize: '0.85rem', fontWeight: 600 }}>Trạng thái</th>
                    <th style={{ padding: '16px 24px', color: '#667085', fontSize: '0.85rem', fontWeight: 600 }}>Hành động</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE).map(b => (
                    <tr key={b._id} style={{ borderBottom: '1px solid #eaecf0' }}>
                      <td style={{ padding: '16px 24px' }}>
                        <div style={{ fontWeight: 700, color: '#101828' }}>{b.room?.name || 'Phòng đã xóa'}</div>
                        <div style={{ fontSize: '0.8rem', color: '#667085' }}>{b.room?.district || ''}</div>
                      </td>
                      <td style={{ padding: '16px 24px' }}>
                        <div style={{ fontWeight: 600, color: '#101828' }}>{b.tenant?.name || 'Khách vãng lai'}</div>
                        <div style={{ fontSize: '0.8rem', color: '#667085' }}>{b.tenant?.phone || b.tenant?.email}</div>
                      </td>
                      <td style={{ padding: '16px 24px' }}>
                        <div style={{ fontSize: '0.9rem', color: '#101828' }}>
                          <span style={{ fontWeight: 600 }}>{TYPE_MAP[b.bookingType]}</span>
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#667085' }}>
                          {new Date(b.checkInDateTime).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })} - {new Date(b.checkOutDateTime).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}
                        </div>
                      </td>
                      <td style={{ padding: '16px 24px' }}>
                        <div style={{ fontWeight: 700, color: '#101828' }}>{b.totalAmount.toLocaleString('vi-VN')} đ</div>
                        <div style={{ fontSize: '0.8rem', fontWeight: 600, color: PAYMENT_MAP[b.paymentStatus]?.color }}>
                          {PAYMENT_MAP[b.paymentStatus]?.label}
                        </div>
                      </td>
                      <td style={{ padding: '16px 24px' }}>
                        <span style={{
                          background: STATUS_MAP[b.status]?.bg || '#f0f2f5',
                          color: STATUS_MAP[b.status]?.color || '#667085',
                          padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700
                        }}>
                          {STATUS_MAP[b.status]?.label || b.status}
                        </span>
                      </td>
                      <td style={{ padding: '16px 24px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {processing === b._id ? (
                          <Spinner />
                        ) : (
                          <>
                            {b.status === 'pending' && (
                              <button onClick={() => handleAction(b._id, 'confirm')} style={{ background: '#deebff', color: '#0052cc', border: 'none', padding: '6px 12px', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }} title="Xác nhận">
                                <FiCheck /> Xác nhận
                              </button>
                            )}
                            {b.status === 'confirmed' && (
                              <button onClick={() => handleAction(b._id, 'checkin')} style={{ background: '#bef2e8', color: '#088373', border: 'none', padding: '6px 12px', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }} title="Check-in">
                                <FiCheckCircle /> Check-in
                              </button>
                            )}
                            {b.status === 'checked_in' && (
                              <button onClick={() => handleAction(b._id, 'checkout')} style={{ background: '#f0f2f5', color: '#667085', border: 'none', padding: '6px 12px', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }} title="Check-out">
                                <FiLogOut /> Check-out
                              </button>
                            )}
                            {/* {b.paymentStatus === 'pending' && b.status !== 'cancelled' && (
                              <button onClick={() => handleAction(b._id, 'pay')} style={{ background: '#e6f4ff', color: '#003e68', border: 'none', padding: '6px 12px', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }} title="Xác nhận đã thu tiền">
                                <FiDollarSign /> Thu tiền
                              </button>
                            )} */}
                            {['pending', 'confirmed'].includes(b.status) && (
                              <button onClick={() => handleAction(b._id, 'cancel')} style={{ background: 'transparent', color: '#d92d20', border: '1px solid #d92d20', padding: '5px 11px', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }} title="Hủy">
                                <FiX /> Hủy
                              </button>
                            )}
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Pagination */}
        {bookings.length > ITEMS_PER_PAGE && (
          <div className="pagination-container" style={{ marginTop: '24px' }}>
            <button
              className="pagination-btn"
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
            >
              &lsaquo;
            </button>
            {Array.from({ length: Math.ceil(bookings.length / ITEMS_PER_PAGE) }).map((_, i) => (
              <button
                key={i + 1}
                className={`pagination-btn ${currentPage === i + 1 ? 'active' : ''}`}
                onClick={() => setCurrentPage(i + 1)}
              >
                {i + 1}
              </button>
            ))}
            <button
              className="pagination-btn"
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, Math.ceil(bookings.length / ITEMS_PER_PAGE)))}
              disabled={currentPage === Math.ceil(bookings.length / ITEMS_PER_PAGE)}
            >
              &rsaquo;
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
