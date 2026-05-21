import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { getAllFeedbacks, toggleFeedbackStatus, deleteFeedback, type Feedback } from '../../api/feedback'
import StarRating from '../../components/ui/StarRating'

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  visible: { label: 'Hiển thị', color: '#065f46', bg: '#d1fae5' },
  hidden:  { label: 'Đã ẩn',   color: '#92400e', bg: '#fef3c7' },
}

export default function FeedbackManagement() {
  const navigate = useNavigate()
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)

  // Filters
  const [filterStatus, setFilterStatus] = useState('')
  const [filterRating, setFilterRating] = useState('')
  const [page, setPage] = useState(1)
  const LIMIT = 15

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, any> = { page, limit: LIMIT }
      if (filterStatus) params.status = filterStatus
      if (filterRating) params.rating = Number(filterRating)
      const data = await getAllFeedbacks(params)
      setFeedbacks(data.feedbacks)
      setTotal(data.total)
      setTotalPages(data.totalPages)
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [page, filterStatus, filterRating])

  useEffect(() => { load() }, [load])

  const handleToggle = async (fb: Feedback) => {
    const next = (fb as any).status === 'visible' ? 'hidden' : 'visible'
    try {
      await toggleFeedbackStatus(fb._id, next)
      load()
    } catch (e: any) {
      alert(e.response?.data?.message || 'Lỗi.')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Xóa đánh giá này? Hành động không thể hoàn tác.')) return
    try {
      await deleteFeedback(id)
      load()
    } catch (e: any) {
      alert(e.response?.data?.message || 'Lỗi khi xóa.')
    }
  }

  const resetFilters = () => {
    setFilterStatus('')
    setFilterRating('')
    setPage(1)
  }

  return (
    <div style={{ padding: '32px 28px', maxWidth: 1100 }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: '1.7rem', fontWeight: 800, color: '#111827', margin: 0 }}>
          ⭐ Quản lý đánh giá
        </h1>
        <p style={{ color: '#6b7280', marginTop: 6, fontSize: 14 }}>
          Xem, ẩn hoặc xóa các đánh giá phòng từ người thuê.
        </p>
      </div>

      {/* Stats bar */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        {[
          { label: 'Tổng đánh giá', value: total, color: '#6366f1' },
          { label: 'Đang hiển thị', value: feedbacks.filter(f => (f as any).status === 'visible').length, color: '#059669' },
          { label: 'Đã ẩn', value: feedbacks.filter(f => (f as any).status === 'hidden').length, color: '#d97706' },
        ].map(s => (
          <div key={s.label} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '14px 20px', minWidth: 140 }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <select
          value={filterStatus}
          onChange={e => { setFilterStatus(e.target.value); setPage(1) }}
          style={{ padding: '8px 12px', border: '1.5px solid #e5e7eb', borderRadius: 8, fontSize: 14, color: '#374151', background: '#fff', cursor: 'pointer' }}
        >
          <option value="">Tất cả trạng thái</option>
          <option value="visible">Đang hiển thị</option>
          <option value="hidden">Đã ẩn</option>
        </select>

        <select
          value={filterRating}
          onChange={e => { setFilterRating(e.target.value); setPage(1) }}
          style={{ padding: '8px 12px', border: '1.5px solid #e5e7eb', borderRadius: 8, fontSize: 14, color: '#374151', background: '#fff', cursor: 'pointer' }}
        >
          <option value="">Tất cả số sao</option>
          {[5, 4, 3, 2, 1].map(n => <option key={n} value={n}>{n} sao</option>)}
        </select>

        {(filterStatus || filterRating) && (
          <button onClick={resetFilters} style={{ padding: '8px 14px', border: '1px solid #e5e7eb', borderRadius: 8, background: '#f9fafb', fontSize: 13, cursor: 'pointer', color: '#374151' }}>
            ✕ Xóa bộ lọc
          </button>
        )}

        <span style={{ marginLeft: 'auto', fontSize: 13, color: '#9ca3af' }}>
          {total} kết quả
        </span>
      </div>

      {/* Table */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
              {['Phòng', 'Người thuê', 'Sao', 'Nhận xét', 'Trạng thái', 'Ngày', 'Thao tác'].map(h => (
                <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 700, color: '#374151', whiteSpace: 'nowrap' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} style={{ padding: 32, textAlign: 'center', color: '#9ca3af' }}>
                  Đang tải...
                </td>
              </tr>
            ) : feedbacks.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: 32, textAlign: 'center', color: '#9ca3af' }}>
                  Không có đánh giá nào.
                </td>
              </tr>
            ) : feedbacks.map((fb, i) => {
              const room = fb.room as any
              const tenant = fb.tenant as any
              const st = STATUS_LABELS[(fb as any).status] || STATUS_LABELS.visible
              return (
                <tr key={fb._id} style={{ borderBottom: '1px solid #f3f4f6', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                  <td style={{ padding: '14px 16px', maxWidth: 160 }}>
                    <div style={{ fontWeight: 600, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{room?.name}</div>
                    <div style={{ fontSize: 12, color: '#9ca3af', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{room?.address}</div>
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ fontWeight: 500, color: '#374151' }}>
                      {fb.isAnonymous ? <em style={{ color: '#9ca3af' }}>Ẩn danh</em> : (tenant?.name || '—')}
                    </div>
                    {/* <div style={{ fontSize: 12, color: '#9ca3af' }}>{tenant?.email}</div> */}
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <StarRating value={fb.rating} size="sm" />
                  </td>
                  <td style={{ padding: '14px 16px', maxWidth: 240 }}>
                    <span style={{ color: fb.comment ? '#374151' : '#9ca3af', fontStyle: fb.comment ? 'normal' : 'italic' }}>
                      {fb.comment || 'Không có nhận xét'}
                    </span>
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 99, fontSize: 12, fontWeight: 600, color: st.color, background: st.bg }}>
                      {st.label}
                    </span>
                  </td>
                  <td style={{ padding: '14px 16px', whiteSpace: 'nowrap', color: '#6b7280', fontSize: 13 }}>
                    {formatDate(fb.createdAt)}
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onClick={() => {
                          const roomId = typeof room === 'object' ? room?._id : room
                          if (roomId) navigate(`/rooms/${roomId}#feedback-${fb._id}`)
                        }}
                        style={{
                          fontSize: 12, padding: '5px 11px', borderRadius: 6, cursor: 'pointer', fontWeight: 600,
                          border: '1px solid #c7d2fe', background: '#eef2ff', color: '#4338ca'
                        }}
                        title="Xem tại trang phòng"
                      >
                        Xem
                      </button>
                      <button
                        onClick={() => handleToggle(fb)}
                        style={{
                          fontSize: 12, padding: '5px 11px', borderRadius: 6, cursor: 'pointer', fontWeight: 600,
                          border: '1px solid #e5e7eb', background: '#f9fafb', color: '#374151'
                        }}
                      >
                        {(fb as any).status === 'hidden' ? 'Hiện' : 'Ẩn'}
                      </button>
                      <button
                        onClick={() => handleDelete(fb._id)}
                        style={{
                          fontSize: 12, padding: '5px 11px', borderRadius: 6, cursor: 'pointer', fontWeight: 600,
                          border: '1px solid #fecaca', background: '#fef2f2', color: '#b91c1c'
                        }}
                      >
                        Xóa
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 20 }}>
          <button
            disabled={page <= 1}
            onClick={() => setPage(p => p - 1)}
            style={{ padding: '7px 14px', border: '1px solid #e5e7eb', borderRadius: 8, background: page <= 1 ? '#f9fafb' : '#fff', cursor: page <= 1 ? 'not-allowed' : 'pointer', fontSize: 13 }}
          >
            ← Trước
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
            <button
              key={p}
              onClick={() => setPage(p)}
              style={{
                padding: '7px 12px', border: '1px solid', borderRadius: 8, fontSize: 13, cursor: 'pointer',
                fontWeight: p === page ? 700 : 400,
                borderColor: p === page ? '#6366f1' : '#e5e7eb',
                background: p === page ? '#6366f1' : '#fff',
                color: p === page ? '#fff' : '#374151'
              }}
            >
              {p}
            </button>
          ))}
          <button
            disabled={page >= totalPages}
            onClick={() => setPage(p => p + 1)}
            style={{ padding: '7px 14px', border: '1px solid #e5e7eb', borderRadius: 8, background: page >= totalPages ? '#f9fafb' : '#fff', cursor: page >= totalPages ? 'not-allowed' : 'pointer', fontSize: 13 }}
          >
            Sau →
          </button>
        </div>
      )}
    </div>
  )
}
