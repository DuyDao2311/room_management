import { useState, useEffect } from 'react'
import { bookingService, type Booking } from '../../api/booking.service'
import Spinner from '../../components/ui/Spinner'
import { FiCheck, FiX, FiCheckCircle, FiLogOut } from 'react-icons/fi'
import { MdFormatListBulleted, MdAssignment, MdPayments, MdShowChart } from 'react-icons/md'
import BookingFilters from '../../components/booking/BookingFilters'

export default function BookingManagement() {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [processing, setProcessing] = useState<string | null>(null)
  const [stats, setStats] = useState<any>(null)

  const [filters, setFilters] = useState({
    search: '',
    status: '',
    paymentStatus: ''
  })
  
  const [currentPage, setCurrentPage] = useState(1)
  const ITEMS_PER_PAGE = 10

  const fetchStats = () => {
    bookingService.getStats()
      .then(res => setStats(res.data))
      .catch(err => console.error("Lỗi tải thống kê", err))
  }

  const fetchBookings = () => {
    setLoading(true)
    bookingService.getBookings({ status: filters.status, paymentStatus: filters.paymentStatus })
      .then(res => setBookings(res.data))
      .catch(() => setError('Lỗi tải danh sách Booking.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchStats()
  }, [])

  useEffect(() => {
    fetchBookings()
  }, [filters.status, filters.paymentStatus])

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
      fetchStats()
    } catch (err: any) {
      alert(err.response?.data?.message || 'Có lỗi xảy ra.')
    } finally {
      setProcessing(null)
    }
  }

  const handleFilterChange = (newFilters: any) => {
    setFilters(prev => ({ ...prev, ...newFilters }))
    setCurrentPage(1)
  }

  const filteredBookings = bookings.filter(b => {
    if (!filters.search) return true
    const searchLower = filters.search.toLowerCase()
    return (b.tenant?.name || '').toLowerCase().includes(searchLower) ||
           (b.tenant?.phone || '').includes(searchLower) ||
           (b.room?.name || '').toLowerCase().includes(searchLower)
  })

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

        {stats && (
          <div className="incident-stats-grid">
            <div className="incident-stat-card">
              <div className="incident-stat-stripe stripe-total" />
              <div className="incident-stat-header">
                <MdFormatListBulleted size={16} /> Tổng số Booking
              </div>
              <div className="incident-stat-content">
                <span className="incident-stat-value total">{stats.totalBookings}</span>
              </div>
            </div>
            <div className="incident-stat-card">
              <div className="incident-stat-stripe stripe-progress" />
              <div className="incident-stat-header">
                <MdAssignment size={16} color="#ea580c" /> Hôm nay
              </div>
              <div className="incident-stat-content">
                <span className="incident-stat-value progress">{stats.todayBookings}</span>
              </div>
            </div>
            <div className="incident-stat-card">
              <div className="incident-stat-stripe stripe-cost" />
              <div className="incident-stat-header">
                <MdPayments size={16} color="#0284c7" /> Doanh thu (Tháng)
              </div>
              <div className="incident-stat-content">
                <span className="incident-stat-value cost">{stats.shortTermRevenue?.toLocaleString('vi-VN')}</span>
                <span className="incident-stat-label">VND</span>
              </div>
            </div>
            <div className="incident-stat-card">
              <div className="incident-stat-stripe stripe-completed" />
              <div className="incident-stat-header">
                <MdShowChart size={16} color="#059669" /> Tỷ lệ lấp đầy
              </div>
              <div className="incident-stat-content">
                <span className="incident-stat-value completed">{stats.occupancyRate}</span>
                <span className="incident-stat-label">%</span>
              </div>
            </div>
          </div>
        )}

        {error && <div className="alert alert-error">{error}</div>}

        <div className="admin-table-wrap" style={{ background: 'white', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.03)', overflow: 'hidden', marginBottom: '24px' }}>
          <BookingFilters filters={filters} onFilterChange={handleFilterChange} />

          {loading ? (
            <div style={{ padding: '32px', textAlign: 'center' }}><Spinner /></div>
          ) : (
            <>
              {filteredBookings.length === 0 ? (
                <div style={{ padding: '32px', textAlign: 'center', color: '#667085' }}>Không có dữ liệu.</div>
              ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead style={{ background: '#f9fafb', borderBottom: '1px solid #eaecf0' }}>
                  <tr>
                    <th style={{ padding: '12px', color: '#667085', fontSize: '0.85rem', fontWeight: 600, whiteSpace: 'nowrap' }}>Phòng</th>
                    <th style={{ padding: '12px', color: '#667085', fontSize: '0.85rem', fontWeight: 600, whiteSpace: 'nowrap' }}>Khách hàng</th>
                    <th style={{ padding: '12px', color: '#667085', fontSize: '0.85rem', fontWeight: 600, whiteSpace: 'nowrap' }}>Thời gian</th>
                    <th style={{ padding: '12px', color: '#667085', fontSize: '0.85rem', fontWeight: 600, whiteSpace: 'nowrap' }}>Tổng tiền</th>
                    <th style={{ padding: '12px', color: '#667085', fontSize: '0.85rem', fontWeight: 600, whiteSpace: 'nowrap' }}>Trạng thái</th>
                    <th style={{ padding: '12px', color: '#667085', fontSize: '0.85rem', fontWeight: 600, whiteSpace: 'nowrap' }}>Hành động</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBookings.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE).map(b => (
                    <tr key={b._id} style={{ borderBottom: '1px solid #eaecf0' }}>
                      <td style={{ padding: '12px', whiteSpace: 'nowrap' }}>
                        <div style={{ fontWeight: 700, color: '#101828' }}>{b.room?.name || 'Phòng đã xóa'}</div>
                        <div style={{ fontSize: '0.8rem', color: '#667085' }}>{b.room?.district || ''}</div>
                      </td>
                      <td style={{ padding: '12px', whiteSpace: 'nowrap' }}>
                        <div style={{ fontWeight: 600, color: '#101828' }}>{b.tenant?.name || 'Khách vãng lai'}</div>
                        <div style={{ fontSize: '0.8rem', color: '#667085' }}>{b.tenant?.phone || b.tenant?.email}</div>
                      </td>
                      <td style={{ padding: '12px', whiteSpace: 'nowrap' }}>
                        <div style={{ fontSize: '0.9rem', color: '#101828' }}>
                          <span style={{ fontWeight: 600 }}>{TYPE_MAP[b.bookingType]}</span>
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#667085' }}>
                          {new Date(b.checkInDateTime).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })} - {new Date(b.checkOutDateTime).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}
                        </div>
                      </td>
                      <td style={{ padding: '12px', whiteSpace: 'nowrap' }}>
                        <div style={{ fontWeight: 700, color: '#101828' }}>{b.totalAmount.toLocaleString('vi-VN')} đ</div>
                        <div style={{ fontSize: '0.8rem', fontWeight: 600, color: PAYMENT_MAP[b.paymentStatus]?.color }}>
                          {PAYMENT_MAP[b.paymentStatus]?.label}
                        </div>
                      </td>
                      <td style={{ padding: '12px', whiteSpace: 'nowrap' }}>
                        <span style={{
                          background: STATUS_MAP[b.status]?.bg || '#f0f2f5',
                          color: STATUS_MAP[b.status]?.color || '#667085',
                          padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700
                        }}>
                          {STATUS_MAP[b.status]?.label || b.status}
                        </span>
                      </td>
                      <td style={{ padding: '12px' }}>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'nowrap', alignItems: 'center' }}>
                          {processing === b._id ? (
                            <Spinner />
                          ) : (
                            <>
                              {b.status === 'pending' && (
                                <button onClick={() => handleAction(b._id, 'confirm')} style={{ background: '#deebff', color: '#0052cc', border: 'none', padding: '4px 8px', borderRadius: '4px', fontWeight: 500, fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }} title="Xác nhận">
                                  <FiCheck /> Xác nhận
                                </button>
                              )}
                              {b.status === 'confirmed' && (
                                <button onClick={() => handleAction(b._id, 'checkin')} style={{ background: '#bef2e8', color: '#088373', border: 'none', padding: '4px 8px', borderRadius: '4px', fontWeight: 500, fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }} title="Check-in">
                                  <FiCheckCircle /> Check-in
                                </button>
                              )}
                              {b.status === 'checked_in' && (
                                <button onClick={() => handleAction(b._id, 'checkout')} style={{ background: '#f0f2f5', color: '#667085', border: 'none', padding: '4px 8px', borderRadius: '4px', fontWeight: 500, fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }} title="Check-out">
                                  <FiLogOut /> Check-out
                                </button>
                              )}
                              {['pending', 'confirmed'].includes(b.status) && (
                                <button onClick={() => handleAction(b._id, 'cancel')} style={{ background: 'transparent', color: '#d92d20', border: '1px solid #d92d20', padding: '3px 7px', borderRadius: '4px', fontWeight: 500, fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }} title="Hủy">
                                  <FiX /> Hủy
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              )}
            </>
          )}
        </div>

        {/* Pagination */}
        {filteredBookings.length > ITEMS_PER_PAGE && (
          <div className="pagination-container" style={{ marginTop: '24px' }}>
            <button
              className="pagination-btn"
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
            >
              &lsaquo;
            </button>
            {Array.from({ length: Math.ceil(filteredBookings.length / ITEMS_PER_PAGE) }).map((_, i) => (
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
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, Math.ceil(filteredBookings.length / ITEMS_PER_PAGE)))}
              disabled={currentPage === Math.ceil(filteredBookings.length / ITEMS_PER_PAGE)}
            >
              &rsaquo;
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
