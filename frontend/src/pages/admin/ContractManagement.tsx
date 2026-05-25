import { useState, useEffect, useRef, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import api from '../../api/axios.ts'
import Spinner from '../../components/ui/Spinner.tsx'
import Badge from '../../components/ui/Badge.tsx'
import SignaturePad from '../../components/ui/SignaturePad.tsx'
import { MdOutlineBusiness, MdOutlinePerson, MdOutlinePeopleAlt, MdOutlineMeetingRoom, MdOutlineGavel, MdPictureAsPdf, MdCheckCircleOutline } from "react-icons/md";
import { LuCalendarDays } from "react-icons/lu";
import { FiSearch, FiSliders } from "react-icons/fi"
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'
import ContractPDF from '../../components/pdf/ContractPDF'
import { Trash2 } from "lucide-react"
import Pagination from '../../components/ui/Pagination.tsx'
import { useAuth } from '../../contexts/AuthContext.tsx'

interface Contract {
  _id: string
  room: { _id: string; name: string; address: string; price: number; area: number; type: string }
  tenant: { _id: string; name: string; email: string }
  startDate: string
  endDate: string
  monthlyRent: number
  status: 'pending' | 'active' | 'expired' | 'terminated'
  representativeName?: string
  representativePhone?: string
  representativeIdCard?: string
  representativeDob?: string
  coResidents?: Array<{ name: string; phone: string; idCard: string; dob: string }>
  // Chữ ký điện tử
  signatureA?: string       // Chữ ký Bên A (base64 PNG)
  signatureB?: string       // Chữ ký Bên B (base64 PNG)
  signedAt?: string         // Thời điểm cả hai đã ký
  isSignedByOwner?: boolean // Bên A đã ký chưa
  isSignedByTenant?: boolean // Bên B đã ký chưa
}

interface ContractStats {
  totalContracts: number;
  growthPercent: number;
  newThisMonth: number;
  newPercentOfTotal: number;
  expiringSoon: number;
  terminated: number;
}

const STATUS_MAP = {
  pending: { label: 'Chờ duyệt', variant: 'warning' as const },
  active: { label: 'Đang hiệu lực', variant: 'success' as const },
  expired: { label: 'Đã hết hạn', variant: 'neutral' as const },
  terminated: { label: 'Đã chấm dứt', variant: 'danger' as const },
}

const formatDDMMYYYY = (dateString: string) => {
  if (!dateString) return '—';
  const d = new Date(dateString);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

export default function ContractManagement() {
  const { user } = useAuth()
  const isStaff = user?.role === 'staff'
  const [searchParams, setSearchParams] = useSearchParams()

  const [contracts, setContracts] = useState<Contract[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null)
  const [stats, setStats] = useState<ContractStats | null>(null)
  const pdfRef = useRef<HTMLDivElement>(null)

  // State lưu chữ ký tạm thời (chưa gửi lên server)
  const [sigState, setSigState] = useState<{ signatureA: string; signatureB: string }>({
    signatureA: '',
    signatureB: '',
  })
  const [signSaving, setSignSaving] = useState(false)
  const [signMsg, setSignMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // ─── Filter state (đồng bộ URL) ────────────────────────────────────────────
  const currentPage = parseInt(searchParams.get('page') || '1')
  const filterSearch = searchParams.get('search') || ''
  const filterDistrict = searchParams.get('district') || ''
  const filterStatus = searchParams.get('status') || ''
  const filterFromDate = searchParams.get('fromDate') || ''
  const filterToDate = searchParams.get('toDate') || ''

  // Debounce search input (local state cho input, sync lên URL sau 500ms)
  const [searchInput, setSearchInput] = useState(filterSearch)
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Pagination từ server
  const [totalPages, setTotalPages] = useState(1)
  const ITEMS_PER_PAGE = 9

  // ─── Hàm cập nhật URL params ───────────────────────────────────────────────
  const updateParams = useCallback((updates: Record<string, string>) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      Object.entries(updates).forEach(([k, v]) => {
        if (v) next.set(k, v)
        else next.delete(k)
      })
      return next
    })
  }, [setSearchParams])

  // ─── Fetch contracts từ server (server-side filtering & pagination) ─────────
  const fetchContracts = useCallback(() => {
    setLoading(true)
    setError('')

    const params = new URLSearchParams()
    params.set('page', String(currentPage))
    params.set('limit', String(ITEMS_PER_PAGE))
    if (filterSearch) params.set('search', filterSearch)
    if (filterDistrict) params.set('district', filterDistrict)
    if (filterStatus) params.set('status', filterStatus)
    if (filterFromDate) params.set('fromDate', filterFromDate)
    if (filterToDate) params.set('toDate', filterToDate)

    api.get(`/contracts?${params.toString()}`)
      .then(r => {
        setContracts(r.data.data)
        setTotalPages(r.data.pagination?.totalPages || 1)
      })
      .catch(() => setError('Không thể tải danh sách hợp đồng.'))
      .finally(() => setLoading(false))
  }, [currentPage, filterSearch, filterDistrict, filterStatus, filterFromDate, filterToDate])

  const fetchStats = useCallback(async () => {
    try {
      const res = await api.get('/contracts/stats')
      setStats(res.data)
    } catch (err) {
      console.error('Không thể lấy thống kê:', err)
    }
  }, [])

  // Gọi fetchContracts khi filter thay đổi
  useEffect(() => {
    fetchContracts()
  }, [fetchContracts])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  // Debounce search input → sync lên URL
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(() => {
      if (searchInput !== filterSearch) {
        updateParams({ search: searchInput, page: '1' })
      }
    }, 500)
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current) }
  }, [searchInput])

  // Sync khi URL search thay đổi từ bên ngoài (ví dụ: back/forward)
  useEffect(() => {
    setSearchInput(filterSearch)
  }, [filterSearch])

  // ─── Filter handlers ───────────────────────────────────────────────────────
  const handleDistrictChange = (val: string) => updateParams({ district: val, page: '1' })
  const handleStatusChange = (val: string) => updateParams({ status: val, page: '1' })
  const handleFromDateChange = (val: string) => updateParams({ fromDate: val, page: '1' })
  const handleToDateChange = (val: string) => updateParams({ toDate: val, page: '1' })
  const handlePageChange = (p: number) => updateParams({ page: String(p) })

  const handleResetFilter = () => {
    setSearchInput('')
    setSearchParams({})
  }

  /** Khi mở modal, đồng bộ chữ ký đã lưu trên server vào local state */
  const openContract = (c: Contract) => {
    setSelectedContract(c)
    setSigState({
      signatureA: c.signatureA || '',
      signatureB: c.signatureB || '',
    })
    setSignMsg(null)
  }

  /**
   * Gửi chữ ký lên API POST /api/contracts/:id/sign
   * Chỉ gửi khi ít nhất một bên đã ký
   */
  const handleSaveSignatures = async () => {
    if (!selectedContract) return
    if (!sigState.signatureA && !sigState.signatureB) {
      setSignMsg({ type: 'error', text: 'Vui lòng ký ít nhất một bên trước khi lưu.' })
      return
    }
    try {
      setSignSaving(true)
      setSignMsg(null)
      const { data } = await api.post(`/contracts/${selectedContract._id}/sign`, {
        signatureA: sigState.signatureA || undefined,
        signatureB: sigState.signatureB || undefined,
      })
      // Cập nhật contract trong danh sách
      setContracts(prev => prev.map(c => c._id === data._id ? data : c))
      setSelectedContract(data)
      setSigState({ signatureA: data.signatureA || '', signatureB: data.signatureB || '' })
      setSignMsg({ type: 'success', text: 'Lưu chữ ký thành công!' })
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setSignMsg({ type: 'error', text: msg || 'Không thể lưu chữ ký.' })
    } finally {
      setSignSaving(false)
    }
  }

  const handleTerminate = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('Bạn có chắc muốn chấm dứt hợp đồng này?')) return
    try {
      await api.put(`/contracts/${id}`, { status: 'terminated' })
      fetchContracts() // Reload từ server
      fetchStats() // Reload thống kê
    } catch {
      alert('Không thể cập nhật hợp đồng.')
    }
  }

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('Bạn có chắc muốn xoá hợp đồng này vĩnh viễn? Hành động này sẽ xoá luôn các hoá đơn liên quan và không thể hoàn tác.')) return
    try {
      await api.delete(`/contracts/${id}`)
      if (selectedContract?._id === id) setSelectedContract(null)
      fetchContracts() // Reload từ server
      fetchStats() // Reload thống kê
    } catch {
      alert('Không thể xoá hợp đồng.')
    }
  }

  const handleApprove = async () => {
    if (!selectedContract) return
    try {
      await api.put(`/contracts/${selectedContract._id}`, { status: 'active' })
      setSelectedContract({ ...selectedContract, status: 'active' })
      fetchContracts() // Reload từ server
      fetchStats() // Reload thống kê
    } catch {
      alert('Không thể phê duyệt hợp đồng.')
    }
  }

  const handleExportPDF = async () => {
    if (!pdfRef.current) return

    try {
      await new Promise(r => setTimeout(r, 500))

      const sigElements = document.querySelectorAll('.contract-signatures-section')
      sigElements.forEach(el => (el as HTMLElement).style.display = 'none')

      const canvas = await html2canvas(pdfRef.current, {
        scale: 3,
        useCORS: true,
        allowTaint: true,
        scrollY: -window.scrollY,
        windowWidth: document.body.scrollWidth,
        windowHeight: document.body.scrollHeight
      })
      sigElements.forEach(el => (el as HTMLElement).style.display = 'block')

      const imgData = canvas.toDataURL('image/png')

      const pdf = new jsPDF('p', 'mm', 'a4')

      const imgWidth = 210
      const pageHeight = 295
      const imgHeight = (canvas.height * imgWidth) / canvas.width

      let y = 0
      while (y < imgHeight) {
        pdf.addImage(
          imgData,
          'PNG',
          0,
          y === 0 ? 0 : -y,
          imgWidth,
          imgHeight)

        y += pageHeight

        if (y < imgHeight) pdf.addPage()
      }

      pdf.save(`hop-dong-${selectedContract?._id}.pdf`)
    } catch (error) {
      console.error('PDF error FULL:', error)
      alert('Không thể xuất PDF')
    }
  }

  // ─── Kiểm tra có filter nào đang active không ──────────────────────────────
  const hasActiveFilter = !!(filterSearch || filterDistrict || filterStatus || filterFromDate || filterToDate)

  return (
    <div className="page-shell">
      <div className="admin-page">
        <h1 style={{ color: '#003e68', fontSize: '1.5rem', fontWeight: 700, margin: '0 0 24px 0', paddingBottom: '16px', borderBottom: '1px solid #eaecf0' }}>
          Quản lý hợp đồng
        </h1>

        {/* Thống kê */}
        {stats && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
            <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.03)', position: 'relative', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ position: 'absolute', right: '16px', top: '24px', bottom: '24px', width: '36px', borderRadius: '8px', background: '#ecfdf5' }} />
              <div style={{ fontSize: '0.85rem', color: '#6b7280', fontWeight: 600, zIndex: 1 }}>Tổng số hợp đồng</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', zIndex: 1 }}>
                <span style={{ fontSize: '2.2rem', fontWeight: 800, color: '#003e68', lineHeight: 1 }}>{stats.totalContracts}</span>
                {stats.growthPercent > 0 && <span style={{ fontSize: '0.85rem', color: '#059669', fontWeight: 600 }}>~+{stats.growthPercent}%</span>}
                {stats.growthPercent < 0 && <span style={{ fontSize: '0.85rem', color: '#dc2626', fontWeight: 600 }}>~{stats.growthPercent}%</span>}
                {stats.growthPercent === 0 && <span style={{ fontSize: '0.85rem', color: '#6b7280', fontWeight: 600 }}>~0%</span>}
              </div>
            </div>

            <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.03)', position: 'relative', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ position: 'absolute', right: '16px', top: '24px', bottom: '24px', width: '36px', borderRadius: '8px', background: '#eff6ff' }} />
              <div style={{ fontSize: '0.85rem', color: '#6b7280', fontWeight: 600, zIndex: 1 }}>Hợp đồng mới tháng này</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', zIndex: 1 }}>
                <span style={{ fontSize: '2.2rem', fontWeight: 800, color: '#003e68', lineHeight: 1 }}>{stats.newThisMonth}</span>
                <span style={{ fontSize: '0.85rem', color: '#6b7280', fontWeight: 500 }}>{stats.newPercentOfTotal}% / tổng</span>
              </div>
            </div>

            <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.03)', position: 'relative', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ position: 'absolute', right: '16px', top: '24px', bottom: '24px', width: '36px', borderRadius: '8px', background: '#fff7ed' }} />
              <div style={{ fontSize: '0.85rem', color: '#6b7280', fontWeight: 600, zIndex: 1 }}>Sắp hết hạn (30 ngày)</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', zIndex: 1 }}>
                <span style={{ fontSize: '2.2rem', fontWeight: 800, color: '#92400e', lineHeight: 1 }}>{stats.expiringSoon < 10 && stats.expiringSoon > 0 ? `0${stats.expiringSoon}` : stats.expiringSoon}</span>
                <span style={{ fontSize: '0.85rem', color: '#6b7280', fontWeight: 500 }}>Cần xử lý</span>
              </div>
            </div>

            <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.03)', position: 'relative', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ position: 'absolute', right: '16px', top: '24px', bottom: '24px', width: '36px', borderRadius: '8px', background: '#f1f5f9' }} />
              <div style={{ fontSize: '0.85rem', color: '#6b7280', fontWeight: 600, zIndex: 1 }}>Đã chấm dứt</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', zIndex: 1 }}>
                <span style={{ fontSize: '2.2rem', fontWeight: 800, color: '#1f2937', lineHeight: 1 }}>{stats.terminated < 10 && stats.terminated > 0 ? `0${stats.terminated}` : stats.terminated}</span>
                <span style={{ fontSize: '0.85rem', color: '#6b7280', fontWeight: 500 }}>Lũy kế</span>
              </div>
            </div>
          </div>
        )}

        {error && <div className="alert alert-error">{error}</div>}

        <div className="admin-table-wrap" style={{ background: '#fff' }}>
          {/* ─── Filter Toolbar ─────────────────────────────────────────────── */}
          <div style={{ padding: '20px 24px', display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Search */}
            <div style={{ position: 'relative', flex: '1 1 220px', minWidth: '180px' }}>
              <FiSearch size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
              <input
                type="text"
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                placeholder="Tìm phòng / khách thuê..."
                style={{ width: '100%', padding: '10px 16px 10px 36px', borderRadius: '6px', border: 'none', background: '#f1f5f9', color: '#475467', outline: 'none', fontSize: '0.9rem' }}
              />
            </div>

            {/* District */}
            <select
              value={filterDistrict}
              onChange={e => handleDistrictChange(e.target.value)}
              style={{ padding: '10px 16px', borderRadius: '6px', border: 'none', background: '#f1f5f9', color: '#475467', outline: 'none', fontSize: '0.9rem' }}
            >
              <option value="">Khu vực</option>
              {isStaff && user?.managedDistricts && user.managedDistricts.length > 0 ? (
                user.managedDistricts.map(d => <option key={d} value={d}>{d}</option>)
              ) : (
                <>
                  <option value="Quận Hà Đông">Quận Hà Đông</option>
                  <option value="Quận Nam Từ Liêm">Quận Nam Từ Liêm</option>
                  <option value="Quận Long Biên">Quận Long Biên</option>
                  <option value="Quận Thanh Xuân">Quận Thanh Xuân</option>
                </>
              )}
            </select>

            {/* Date range */}
            <div style={{ display: 'flex', alignItems: 'center', background: '#f1f5f9', borderRadius: '6px', padding: '0 12px' }}>
              <span style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: 600, marginRight: '8px', textTransform: 'uppercase' }}>Từ</span>
              <input
                type="date"
                value={filterFromDate}
                onChange={e => handleFromDateChange(e.target.value)}
                style={{ padding: '10px 0', border: 'none', background: 'transparent', color: '#475467', outline: 'none', fontSize: '0.9rem', width: '120px' }}
              />
              <span style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: 600, margin: '0 8px 0 16px', textTransform: 'uppercase' }}>Đến</span>
              <input
                type="date"
                value={filterToDate}
                onChange={e => handleToDateChange(e.target.value)}
                style={{ padding: '10px 0', border: 'none', background: 'transparent', color: '#475467', outline: 'none', fontSize: '0.9rem', width: '120px' }}
              />
            </div>

            {/* Status */}
            <select
              value={filterStatus}
              onChange={e => handleStatusChange(e.target.value)}
              style={{ padding: '10px 16px', borderRadius: '6px', border: 'none', background: '#f1f5f9', color: '#475467', outline: 'none', fontSize: '0.9rem' }}
            >
              <option value="">Trạng thái</option>
              <option value="active">Đang hiệu lực</option>
              <option value="expired">Đã hết hạn</option>
              <option value="terminated">Đã chấm dứt</option>
              <option value="pending">Chờ duyệt</option>
            </select>

            {/* Reset */}
            <button
              onClick={handleResetFilter}
              title="Xóa bộ lọc"
              style={{
                padding: '10px 14px', borderRadius: '6px', border: 'none',
                background: hasActiveFilter ? '#fee2e2' : '#f1f5f9',
                color: hasActiveFilter ? '#dc2626' : '#475467',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.2s'
              }}
            >
              <FiSliders size={18} />
            </button>
          </div>

          {loading ? (
            <Spinner />
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Phòng</th>
                  <th>Khách thuê</th>
                  <th>Ngày bắt đầu</th>
                  <th>Ngày kết thúc</th>
                  <th>Tiền thuê/tháng</th>
                  <th>Trạng thái</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {contracts.length === 0 ? (
                  <tr><td colSpan={7} className="table-empty">Chưa có hợp đồng nào.</td></tr>
                ) : contracts.map(c => (
                  <tr key={c._id} onClick={() => openContract(c)} style={{ cursor: 'pointer' }} title="Click để xem chi tiết">
                    <td className="td-name">{c.room?.name ?? '—'}</td>
                    <td>
                      <div className="td-stack">
                        <span>{c.representativeName || c.tenant?.name || '—'}</span>
                        {/* <span className="td-muted td-sm">{c.tenant?.email ?? ''}</span> */}
                      </div>
                    </td>
                    <td>{formatDDMMYYYY(c.startDate)}</td>
                    <td>{formatDDMMYYYY(c.endDate)}</td>
                    <td className="td-price">{c.monthlyRent.toLocaleString('vi-VN')}đ</td>
                    <td><Badge label={STATUS_MAP[c.status]?.label || c.status} variant={STATUS_MAP[c.status]?.variant || 'neutral'} /></td>
                    <td className="td-actions">
                      {c.status === 'active' && (
                        <button className="action-btn delete-btn" onClick={(e) => handleTerminate(c._id, e)} id={`terminate-${c._id}`}>
                          Chấm dứt
                        </button>
                      )}
                      {(c.status === 'terminated' || c.status === 'expired') && (
                        <button className="action-btn delete-btn" onClick={(e) => handleDelete(c._id, e)} id={`delete-${c._id}`} style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <Trash2 size={18} color="#d92d20" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        
        {!loading && totalPages > 1 && (
          <Pagination 
            currentPage={currentPage} 
            totalPages={totalPages} 
            onPageChange={handlePageChange} 
          />
        )}

        {/* Modal Chi tiết hợp đồng */}
        {selectedContract && (
          <div className="rent-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setSelectedContract(null) }}>
            <div className="rent-modal" style={{ maxWidth: '850px', borderRadius: '0', maxHeight: '95vh', overflowY: 'auto' }}>
              <div ref={pdfRef} id="pdf-content">

                <div className="contract-modal-header">
                  <div className="contract-nation">CỘNG HOÀ XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
                  <div className="contract-motto">Độc lập - Tự do - Hạnh phúc</div>
                  <h2 className="contract-title">HỢP ĐỒNG THUÊ PHÒNG</h2>
                </div>

                <div className="rent-modal-body" style={{ padding: '0 40px' }}>
                  {/* Bên A */}
                  <div className="contract-section">
                    <div className="contract-section-header">
                      <div className="contract-section-icon"><MdOutlineBusiness size={22} /></div>
                      <div className="contract-section-title">BÊN A (Bên cho thuê nhà)</div>
                    </div>
                    <div className="contract-grid">
                      <div className="contract-field">
                        <label>Tên cá nhân/tổ chức</label>
                        <input className="contract-input" type="text" value="Phòng Trọ DTT" readOnly />
                      </div>
                      <div className="contract-field">
                        <label>Số điện thoại</label>
                        <input className="contract-input" type="text" value="0869 188 512" readOnly />
                      </div>
                      <div className="contract-field">
                        <label>Email</label>
                        <input className="contract-input" type="text" value="duykmhd2311@gmail.com" readOnly />
                      </div>
                      <div className="contract-field">
                        <label>Địa chỉ</label>
                        <input className="contract-input" type="text" value="Vạn Phúc, Hà Đông, Hà Nội" readOnly />
                      </div>
                    </div>
                  </div>

                  {/* Bên B */}
                  <div className="contract-section">
                    <div className="contract-section-header">
                      <div className="contract-section-icon"><MdOutlinePerson size={22} color="#0f5cc7" /></div>
                      <div className="contract-section-title">BÊN B (Bên thuê nhà)</div>
                    </div>

                    <div style={{ marginBottom: '24px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                        <div style={{ background: '#e0f2fe', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0284c7' }}>
                          <MdOutlinePerson size={20} />
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#111827' }}>Người đứng tên hợp đồng</div>
                          <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>Thông tin đại diện chính</div>
                        </div>
                      </div>
                      <div className="contract-grid">
                        <div className="contract-field">
                          <label>Họ và tên</label>
                          <input className="contract-input" type="text" value={selectedContract.representativeName || ''} readOnly />
                        </div>
                        <div className="contract-field">
                          <label>Số điện thoại</label>
                          <input className="contract-input" type="tel" value={selectedContract.representativePhone || ''} readOnly />
                        </div>
                        <div className="contract-field">
                          <label>Ngày sinh</label>
                          <input className="contract-input" type="date" value={selectedContract.representativeDob || ''} readOnly />
                        </div>
                        <div className="contract-field">
                          <label>Số CCCD/CMND</label>
                          <input className="contract-input" type="text" value={selectedContract.representativeIdCard || ''} readOnly />
                        </div>
                      </div>
                    </div>

                    {(selectedContract.coResidents || []).length > 0 && (
                      <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '24px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                          <div style={{ background: '#ffedd5', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#d97706' }}>
                            <MdOutlinePeopleAlt size={20} />
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#111827' }}>Thành viên cùng ở</div>
                            <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>Hiện tại {(selectedContract.coResidents || []).length} người</div>
                          </div>
                        </div>

                        {(selectedContract.coResidents || []).map((r, idx) => (
                          <div key={idx} style={{ background: '#fff', border: '1px solid #d1d5db', borderRadius: '8px', padding: '16px', marginBottom: '16px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#374151' }}>Thành viên {idx + 1}</span>
                            </div>
                            <div className="contract-grid">
                              <div className="contract-field">
                                <label>Họ và tên</label>
                                <input className="contract-input" type="text" value={r.name || ''} readOnly />
                              </div>
                              <div className="contract-field">
                                <label>Số điện thoại</label>
                                <input className="contract-input" type="tel" value={r.phone || ''} readOnly />
                              </div>
                              <div className="contract-field">
                                <label>Ngày sinh</label>
                                <input className="contract-input" type="date" value={r.dob || ''} readOnly />
                              </div>
                              <div className="contract-field">
                                <label>Số CCCD/CMND</label>
                                <input className="contract-input" type="text" value={r.idCard || ''} readOnly />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Thông tin phòng */}
                  <div className="contract-section">
                    <div className="contract-section-header">
                      <div className="contract-section-icon"><MdOutlineMeetingRoom size={22} color="#088373" /></div>
                      <div className="contract-section-title" style={{ color: '#088373' }}>Thông tin phòng</div>
                    </div>
                    <div style={{ background: '#fff', borderRadius: '8px', padding: '20px', border: '1px solid #d1d5db' }}>
                      <div style={{ marginBottom: '20px' }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', marginBottom: '4px' }}>Tên phòng</div>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                          <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#111827' }}>{selectedContract.room?.name}</div>
                          <div style={{ fontSize: '0.9rem', color: '#4b5563', fontWeight: 500 }}>- {selectedContract.room?.address}</div>
                        </div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                        <div>
                          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', marginBottom: '4px' }}>Giá thuê / tháng</div>
                          <div style={{ fontSize: '1rem', fontWeight: 700, color: '#111827' }}>{selectedContract.monthlyRent?.toLocaleString('vi-VN')} đ</div>
                        </div>
                        <div>
                          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', marginBottom: '4px' }}>Diện tích</div>
                          <div style={{ fontSize: '1rem', fontWeight: 700, color: '#111827' }}>{selectedContract.room?.area || 0} m²</div>
                        </div>
                        <div>
                          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', marginBottom: '4px' }}>Loại phòng</div>
                          <div style={{ fontSize: '1rem', fontWeight: 700, color: '#111827' }}>{selectedContract.room?.type || 'Phòng trọ'}</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Thời hạn hợp đồng */}
                  <div className="contract-section">
                    <div className="contract-section-header">
                      <div className="contract-section-icon"><LuCalendarDays size={22} color="#088373" /></div>
                      <div className="contract-section-title" style={{ color: '#088373' }}>Thời hạn hợp đồng</div>
                    </div>
                    <div style={{ background: '#fff', borderRadius: '8px', padding: '20px', border: '1px solid #d1d5db', display: 'flex', gap: '20px' }}>
                      <div className="contract-field" style={{ flex: 1 }}>
                        <label>Ngày bắt đầu</label>
                        <input className="contract-input" type="date" value={selectedContract.startDate ? new Date(selectedContract.startDate).toISOString().split('T')[0] : ''} readOnly />
                      </div>
                      <div className="contract-field" style={{ flex: 1 }}>
                        <label>Ngày kết thúc</label>
                        <input className="contract-input" type="date" value={selectedContract.endDate ? new Date(selectedContract.endDate).toISOString().split('T')[0] : ''} readOnly />
                      </div>
                    </div>
                  </div>

                  {/* Điều khoản */}
                  <div className="contract-section">
                    <div className="contract-section-header">
                      <div className="contract-section-icon"><MdOutlineGavel size={22} color="#111827" /></div>
                      <div className="contract-section-title">Điều Khoản Hợp Đồng</div>
                    </div>
                    <div className="contract-text-box">
                      <p style={{ margin: '0 0 12px' }}><strong>1. Mục đích thuê:</strong> Bên B thuê phòng để ở, không sử dụng vào mục đích kinh doanh, sản xuất hay các mục đích trái pháp luật.</p>
                      <p style={{ margin: '0 0 12px' }}><strong>2. Thời hạn thuê:</strong> Hợp đồng có giá trị trong vòng 12 tháng kể từ ngày ký. Sau khi hết hạn, nếu hai bên có nhu cầu tiếp tục, sẽ tiến hành gia hạn hợp đồng mới.</p>
                      <p style={{ margin: '0 0 8px' }}><strong>3. Giá thuê và phương thức thanh toán:</strong></p>
                      <ul style={{ margin: '0 0 12px', paddingLeft: '20px' }}>
                        <li>Giá thuê phòng: {selectedContract.monthlyRent?.toLocaleString('vi-VN')} VNĐ/tháng.</li>
                        <li>Tiền điện: 3.500 VNĐ/Kwh.</li>
                        <li>Tiền nước: 100.000 VNĐ/người/tháng.</li>
                        <li>Thanh toán từ ngày 1 đến ngày 5 hàng tháng.</li>
                      </ul>
                      <p style={{ margin: '0 0 8px' }}><strong>4. Trách nhiệm của Bên A:</strong> Đảm bảo phòng ốc bàn giao đúng tình trạng thỏa thuận. Hỗ trợ sửa chữa các hư hỏng kết cấu do hao mòn tự nhiên.</p>
                      <p style={{ margin: '0 0 8px' }}><strong>5. Trách nhiệm của Bên B:</strong> Giữ gìn vệ sinh chung, tuân thủ nội quy khu trọ. Không tự ý sửa chữa, thay đổi kết cấu phòng khi chưa có sự đồng ý của Bên A.</p>
                    </div>

                    {/* ── Khu vực chữ ký điện tử ── */}
                    <div className="contract-signatures-section">
                      <div className="contract-signatures-title">CHỮ KÝ CÁC BÊN</div>

                      {/* Thông báo lưu chữ ký */}
                      {signMsg && (
                        <div className={`sig-message sig-message--${signMsg.type}`}>
                          {signMsg.type === 'success' ? '✅' : '⚠️'} {signMsg.text}
                        </div>
                      )}

                      <div className="contract-signatures">
                        {/* Bên A – Bên cho thuê */}
                        <SignaturePad
                          label="BÊN CHO THUÊ (Bên A)"
                          subLabel="(Ký, ghi rõ họ tên)"
                          savedSignature={sigState.signatureA}
                          accentColor="#0f5cc7"
                          onSave={(b64) => {
                            console.log('SAVE A:', b64)
                            setSigState(prev => ({
                              ...prev,
                              signatureA: b64
                            }))
                          }}
                          onClear={() => setSigState(prev => ({ ...prev, signatureA: '' }))}
                        />

                        {/* Bên B – Bên thuê */}
                        <SignaturePad
                          label="BÊN THUÊ (Bên B)"
                          subLabel="(Ký, ghi rõ họ tên)"
                          savedSignature={sigState.signatureB}
                          accentColor="#088373"
                          onSave={(b64) => setSigState(prev => ({ ...prev, signatureB: b64 }))}
                          onClear={() => setSigState(prev => ({ ...prev, signatureB: '' }))}
                        />
                      </div>

                      {/* Nút lưu chữ ký lên server */}
                      <div className="sig-save-row">
                        <button
                          type="button"
                          className="sig-save-btn"
                          onClick={handleSaveSignatures}
                          disabled={signSaving || (!sigState.signatureA && !sigState.signatureB)}
                        >
                          {signSaving ? '⏳ Đang lưu...' : '💾 Xác nhận lưu chữ ký'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="contract-footer">
                  <button type="button" className="btn-cancel" onClick={() => setSelectedContract(null)}>HUỶ</button>
                  <button type="button" className="btn-pdf" onClick={handleExportPDF}>
                    <MdPictureAsPdf size={18} /> TẢI XUỐNG BẢN PDF
                  </button>
                  {selectedContract.status === 'pending' && (
                    <button type="button" className="btn-confirm" onClick={handleApprove}>
                      <MdCheckCircleOutline size={18} /> PHÊ DUYỆT
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      <div style={{ position: 'absolute', left: '-9999px', top: 0 }}>
        {selectedContract && (
          <div ref={pdfRef}>
            <ContractPDF contract={selectedContract} />
          </div>
        )}
      </div>
    </div>
  )
}
