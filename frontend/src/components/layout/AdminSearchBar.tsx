import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, X, Home, Users, FileText, Receipt, Calendar } from 'lucide-react'
import api from '../../api/axios'

// ─── Types ────────────────────────────────────────────────────────────────────
interface SearchRoom {
  _id: string
  name: string
  address: string
  district: string
  price: number
  status: string
}
interface SearchTenant {
  _id: string
  name: string
  email: string
  phone?: string
}
interface SearchContract {
  _id: string
  representativeName: string
  status: string
  room?: { name: string }
  tenant?: { name: string }
}
interface SearchInvoice {
  _id: string
  roomName: string
  representativeName: string
  totalAmount: number
  status: string
  type: string
  month?: number
  year?: number
}
interface SearchAppointment {
  _id: string
  name: string
  phone: string
  date: string
  time: string
  status: string
  room?: { name: string }
}
interface SearchResults {
  rooms: SearchRoom[]
  tenants: SearchTenant[]
  contracts: SearchContract[]
  invoices: SearchInvoice[]
  appointments: SearchAppointment[]
}

// ─── Format tiền ──────────────────────────────────────────────────────────────
const fmt = (n: number) =>
  Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')

// ─── Status labels ────────────────────────────────────────────────────────────
const roomStatusLabel: Record<string, string> = {
  available: 'Trống',
  occupied: 'Đã thuê',
  maintenance: 'Bảo trì',
}
const contractStatusLabel: Record<string, string> = {
  pending: 'Chờ duyệt',
  active: 'Đang thuê',
  expired: 'Hết hạn',
  terminated: 'Đã huỷ',
}
const invoiceStatusLabel: Record<string, string> = {
  unpaid: 'Chưa thanh toán',
  pending: 'Chờ xác nhận',
  paid: 'Đã thanh toán',
  overdue: 'Quá hạn',
}
const appointmentStatusLabel: Record<string, string> = {
  pending: 'Chờ xác nhận',
  confirmed: 'Đã xác nhận',
  cancelled: 'Đã hủy',
}

export default function AdminSearchBar() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResults | null>(null)
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const navigate = useNavigate()

  // ── Debounced search ────────────────────────────────────────────────────
  const doSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults(null)
      setOpen(false)
      return
    }
    setLoading(true)
    try {
      const { data } = await api.get(`/search?q=${encodeURIComponent(q.trim())}`)
      setResults(data)
      setOpen(true)
    } catch {
      setResults(null)
    } finally {
      setLoading(false)
    }
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setQuery(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => doSearch(val), 500)
  }

  const handleClear = () => {
    setQuery('')
    setResults(null)
    setOpen(false)
    inputRef.current?.focus()
  }

  // ── Click outside → close ───────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // ── Focus lại thì mở dropdown nếu có kết quả ───────────────────────────
  const handleFocus = () => {
    if (results && query.trim().length >= 2) setOpen(true)
  }

  // ── Kiểm tra có kết quả không ──────────────────────────────────────────
  const hasResults = results && (
    results.rooms.length > 0 ||
    results.tenants.length > 0 ||
    results.contracts.length > 0 ||
    results.invoices.length > 0 ||
    results.appointments.length > 0
  )

  // ── Navigate handlers ──────────────────────────────────────────────────
  const go = (path: string) => {
    setOpen(false)
    setQuery('')
    setResults(null)
    navigate(path)
  }

  return (
    <div className="adm-search-wrapper" ref={wrapperRef}>
      <div className={`adm-search-box ${open ? 'adm-search-box--active' : ''}`}>
        <Search className="adm-search-icon" size={18} />
        <input
          ref={inputRef}
          type="text"
          className="adm-search-input"
          placeholder="Tìm kiếm phòng, khách thuê, hóa đơn..."
          value={query}
          onChange={handleChange}
          onFocus={handleFocus}
          id="admin-search-input"
        />
        {query && (
          <button className="adm-search-clear" onClick={handleClear} aria-label="Xóa">
            <X size={16} />
          </button>
        )}
      </div>

      {/* ── Dropdown kết quả ─────────────────────────────────────────── */}
      {open && (
        <div className="adm-search-dropdown">
          {loading ? (
            // Loading skeleton
            <div className="adm-search-skeleton">
              {[1, 2, 3].map(i => (
                <div key={i} className="adm-search-skeleton-item">
                  <div className="adm-search-skeleton-icon" />
                  <div className="adm-search-skeleton-lines">
                    <div className="adm-search-skeleton-line adm-search-skeleton-line--w60" />
                    <div className="adm-search-skeleton-line adm-search-skeleton-line--w40" />
                  </div>
                </div>
              ))}
            </div>
          ) : !hasResults ? (
            // Empty state
            <div className="adm-search-empty">
              <Search size={32} strokeWidth={1.5} />
              <p>Không tìm thấy kết quả cho "{query}"</p>
            </div>
          ) : (
            // Results
            <div className="adm-search-results">
              {/* Phòng */}
              {results!.rooms.length > 0 && (
                <div className="adm-search-group">
                  <div className="adm-search-group-header">
                    <Home size={14} />
                    <span>Phòng</span>
                  </div>
                  {results!.rooms.map(room => (
                    <button
                      key={room._id}
                      className="adm-search-result-item"
                      onClick={() => go(`/admin/rooms?edit=${room._id}`)}
                    >
                      <div className="adm-search-result-icon adm-search-result-icon--room">
                        <Home size={16} />
                      </div>
                      <div className="adm-search-result-info">
                        <span className="adm-search-result-title">{room.name}</span>
                        <span className="adm-search-result-sub">{room.address} • {room.district}</span>
                      </div>
                      <div className="adm-search-result-meta">
                        <span className={`adm-search-status adm-search-status--${room.status}`}>
                          {roomStatusLabel[room.status] || room.status}
                        </span>
                        <span className="adm-search-price">{fmt(room.price)}đ</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Khách thuê */}
              {results!.tenants.length > 0 && (
                <div className="adm-search-group">
                  <div className="adm-search-group-header">
                    <Users size={14} />
                    <span>Khách thuê</span>
                  </div>
                  {results!.tenants.map(tenant => (
                    <button
                      key={tenant._id}
                      className="adm-search-result-item"
                      onClick={() => go(`/admin/users?highlight=${tenant._id}`)}
                    >
                      <div className="adm-search-result-icon adm-search-result-icon--tenant">
                        <Users size={16} />
                      </div>
                      <div className="adm-search-result-info">
                        <span className="adm-search-result-title">{tenant.name}</span>
                        <span className="adm-search-result-sub">{tenant.email}{tenant.phone ? ` • ${tenant.phone}` : ''}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Hợp đồng */}
              {results!.contracts.length > 0 && (
                <div className="adm-search-group">
                  <div className="adm-search-group-header">
                    <FileText size={14} />
                    <span>Hợp đồng</span>
                  </div>
                  {results!.contracts.map(c => (
                    <button
                      key={c._id}
                      className="adm-search-result-item"
                      onClick={() => go(`/admin/contracts?highlight=${c._id}`)}
                    >
                      <div className="adm-search-result-icon adm-search-result-icon--contract">
                        <FileText size={16} />
                      </div>
                      <div className="adm-search-result-info">
                        <span className="adm-search-result-title">
                          {c.representativeName || c.tenant?.name || 'N/A'}
                        </span>
                        <span className="adm-search-result-sub">
                          {c.room?.name || ''} • {contractStatusLabel[c.status] || c.status}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Hóa đơn */}
              {results!.invoices.length > 0 && (
                <div className="adm-search-group">
                  <div className="adm-search-group-header">
                    <Receipt size={14} />
                    <span>Hóa đơn</span>
                  </div>
                  {results!.invoices.map(inv => (
                    <button
                      key={inv._id}
                      className="adm-search-result-item"
                      onClick={() => go(`/admin/invoices?highlight=${inv._id}`)}
                    >
                      <div className="adm-search-result-icon adm-search-result-icon--invoice">
                        <Receipt size={16} />
                      </div>
                      <div className="adm-search-result-info">
                        <span className="adm-search-result-title">
                          {inv.roomName} — {inv.representativeName}
                        </span>
                        <span className="adm-search-result-sub">
                          {inv.type === 'deposit' ? 'Đặt cọc' : `T${inv.month}/${inv.year}`} • {fmt(inv.totalAmount)}đ
                        </span>
                      </div>
                      <span className={`adm-search-status adm-search-status--${inv.status}`}>
                        {invoiceStatusLabel[inv.status] || inv.status}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {/* Lịch hẹn */}
              {results!.appointments.length > 0 && (
                <div className="adm-search-group">
                  <div className="adm-search-group-header">
                    <Calendar size={14} />
                    <span>Lịch hẹn</span>
                  </div>
                  {results!.appointments.map(apt => (
                    <button
                      key={apt._id}
                      className="adm-search-result-item"
                      onClick={() => go(`/admin/appointments/${apt._id}`)}
                    >
                      <div className="adm-search-result-icon adm-search-result-icon--appointment">
                        <Calendar size={16} />
                      </div>
                      <div className="adm-search-result-info">
                        <span className="adm-search-result-title">{apt.name}</span>
                        <span className="adm-search-result-sub">
                          {apt.room?.name || ''} • {apt.time} • {new Date(apt.date).toLocaleDateString('vi-VN')}
                        </span>
                      </div>
                      <span className={`adm-search-status adm-search-status--${apt.status}`}>
                        {appointmentStatusLabel[apt.status] || apt.status}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
