import { useState, useEffect, useCallback } from 'react'
import api from '../../api/axios'
import Spinner from '../../components/ui/Spinner'
import {
  getPromotions,
  createPromotion,
  updatePromotion,
  deletePromotion,
  changePromotionStatus,
  type Promotion,
  type PromotionPayload,
} from '../../api/promotion.service'
import { Percent, Tag, Pencil, Eye, Trash2, ToggleLeft, ToggleRight, Plus, Search, X, SlidersHorizontal } from 'lucide-react'

// ── Helpers ────────────────────────────────────────────────────────────────
const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  upcoming: { label: 'Sắp diễn ra', color: '#3538cd', bg: '#eef4ff' },
  active: { label: 'Đang chạy', color: '#088373', bg: '#bef2e8' },
  expired: { label: 'Đã kết thúc', color: '#b42318', bg: '#fee4e2' },
  disabled: { label: 'Đã tắt', color: '#667085', bg: '#f2f4f7' },
}

const formatDate = (d: string) =>
  new Date(d).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })

const formatPrice = (price: number) => price.toLocaleString('vi-VN') + 'đ'

// ── Custom Component ───────────────────────────────────────────────────────
const CustomDateInput = ({ id, value, onChange, readOnly = false, required = false, className = "", style = {}, placeholder = "dd/mm/yyyy" }: any) => {
  const displayValue = value ? value.split('-').reverse().join('/') : placeholder;
  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '100%' }}>
      <input
        id={id}
        type="date"
        value={value}
        onChange={onChange}
        readOnly={readOnly}
        required={required}
        className={className}
        style={{ ...style, color: 'transparent', width: '100%' }}
      />
      <span style={{
        position: 'absolute',
        left: '12px',
        pointerEvents: 'none',
        color: value ? 'inherit' : '#9ca3af',
        fontSize: 'inherit',
        fontFamily: 'inherit'
      }}>
        {displayValue}
      </span>
    </div>
  )
}

// ── Room type for selection ────────────────────────────────────────────────
interface RoomOption {
  _id: string
  name: string
  price: number
  address: string
  status: string
  district?: string
  type?: string
  rentalMode?: string
}

// ── Empty form state ──────────────────────────────────────────────────────
const EMPTY_FORM: PromotionPayload = {
  name: '',
  description: '',
  discountType: 'percent',
  discountValue: 0,
  maxDiscount: null,
  roomIds: [],
  startDate: '',
  endDate: '',
}

export default function PromotionManagement() {
  // ── State ──────────────────────────────────────────────────────────────
  const [promotions, setPromotions] = useState<Promotion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Pagination & filters
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [searchText, setSearchText] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const ITEMS_PER_PAGE = 10

  // Modal
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Promotion | null>(null)
  const [form, setForm] = useState<PromotionPayload>({ ...EMPTY_FORM })
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  // Rooms for multi-select
  const [allRooms, setAllRooms] = useState<RoomOption[]>([])
  const [roomSearch, setRoomSearch] = useState('')
  const [loadingRooms, setLoadingRooms] = useState(false)
  const [filterDistrict, setFilterDistrict2] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterRentalMode, setFilterRentalMode] = useState('')

  // Confirm delete
  const [deleteTarget, setDeleteTarget] = useState<Promotion | null>(null)

  // ── Fetch promotions ─────────────────────────────────────────────────
  const fetchPromotions = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await getPromotions({
        page: currentPage,
        limit: ITEMS_PER_PAGE,
        search: searchText || undefined,
        status: filterStatus || undefined,
      })
      setPromotions(res.data)
      setTotalPages(res.totalPages)
      setTotal(res.total)
    } catch {
      setError('Không thể tải danh sách khuyến mãi.')
    } finally {
      setLoading(false)
    }
  }, [currentPage, searchText, filterStatus])

  useEffect(() => {
    fetchPromotions()

    // Tải trước danh sách phòng để map tên phòng áp dụng trong bảng
    const loadRooms = async () => {
      try {
        const res = await api.get('/rooms')
        setAllRooms(res.data)
      } catch (err) {
        // ignore
      }
    }
    loadRooms()
  }, [fetchPromotions])

  // ── Fetch rooms for select ──────────────────────────────────────────
  const fetchRooms = async () => {
    if (allRooms.length > 0) return
    setLoadingRooms(true)
    try {
      const res = await api.get('/rooms')
      setAllRooms(res.data)
    } catch {
      // ignore
    } finally {
      setLoadingRooms(false)
    }
  }

  // ── Modal open ──────────────────────────────────────────────────────
  const openCreate = () => {
    setEditing(null)
    setForm({ ...EMPTY_FORM })
    setFormError('')
    setShowModal(true)
    fetchRooms()
  }

  const openEdit = (p: Promotion) => {
    setEditing(p)
    setFormError('')
    setForm({
      name: p.name,
      description: p.description || '',
      discountType: p.discountType,
      discountValue: p.discountValue,
      maxDiscount: p.maxDiscount,
      roomIds: Array.isArray(p.roomIds)
        ? p.roomIds.map((r: any) => (typeof r === 'string' ? r : r._id))
        : [],
      startDate: new Date(p.startDate).toISOString().split('T')[0],
      endDate: new Date(p.endDate).toISOString().split('T')[0],
    })
    setShowModal(true)
    fetchRooms()
  }

  // ── Save ────────────────────────────────────────────────────────────
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')

    // Client-side validation
    if (!form.name.trim()) return setFormError('Tên chương trình không được để trống.')
    if (form.discountValue <= 0) return setFormError('Giá trị giảm phải lớn hơn 0.')
    if (form.discountType === 'percent' && form.discountValue > 100)
      return setFormError('Giảm giá theo % không được vượt quá 100%.')
    if (!form.startDate || !form.endDate) return setFormError('Vui lòng chọn ngày bắt đầu và kết thúc.')
    if (new Date(form.startDate) >= new Date(form.endDate))
      return setFormError('Ngày bắt đầu phải trước ngày kết thúc.')
    if (form.roomIds.length === 0) return setFormError('Phải chọn ít nhất 1 phòng áp dụng.')

    setSaving(true)
    try {
      if (editing) {
        await updatePromotion(editing._id, form)
      } else {
        await createPromotion(form)
      }
      setShowModal(false)
      fetchPromotions()
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Lưu thất bại. Vui lòng thử lại.')
    } finally {
      setSaving(false)
    }
  }

  // ── Toggle status ──────────────────────────────────────────────────
  const handleToggleStatus = async (p: Promotion) => {
    const newStatus = p.status === 'disabled' ? 'active' : 'disabled'
    try {
      await changePromotionStatus(p._id, newStatus)
      fetchPromotions()
    } catch (err: any) {
      alert(err.response?.data?.message || 'Đổi trạng thái thất bại.')
    }
  }

  // ── Delete ─────────────────────────────────────────────────────────
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return
    try {
      await deletePromotion(deleteTarget._id)
      setDeleteTarget(null)
      fetchPromotions()
    } catch {
      alert('Xóa thất bại.')
    }
  }

  // ── Room multi-select helpers ─────────────────────────────────────
  const toggleRoom = (roomId: string) => {
    setForm((prev) => ({
      ...prev,
      roomIds: prev.roomIds.includes(roomId)
        ? prev.roomIds.filter((r) => r !== roomId)
        : [...prev.roomIds, roomId],
    }))
  }

  // Lấy danh sách quận và loại phòng (unique)
  const uniqueDistricts = [...new Set(allRooms.filter(r => r.district).map(r => r.district!))].sort()
  const uniqueTypes = [...new Set(allRooms.filter(r => r.type).map(r => r.type!))].sort()

  const filteredRooms = allRooms.filter(
    (r) =>
      r.status === 'available' &&
      (roomSearch === '' || r.name.toLowerCase().includes(roomSearch.toLowerCase()) ||
        r.address.toLowerCase().includes(roomSearch.toLowerCase())) &&
      (filterDistrict === '' || r.district === filterDistrict) &&
      (filterType === '' || r.type === filterType) &&
      (filterRentalMode === '' || r.rentalMode === filterRentalMode)
  )

  const selectAllFiltered = () => {
    const filteredIds = filteredRooms.map(r => r._id)
    const newIds = [...new Set([...form.roomIds, ...filteredIds])]
    setForm(prev => ({ ...prev, roomIds: newIds }))
  }

  const deselectAllFiltered = () => {
    const filteredIds = new Set(filteredRooms.map(r => r._id))
    setForm(prev => ({ ...prev, roomIds: prev.roomIds.filter(id => !filteredIds.has(id)) }))
  }

  const isAllFilteredSelected = filteredRooms.length > 0 && filteredRooms.every(r => form.roomIds.includes(r._id))

  // ── Render ─────────────────────────────────────────────────────────
  return (
    <div className="page-shell">
      <div className="admin-page">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "24px",
          }}
        >
          <h1
            style={{
              color: '#003e68',
              fontSize: '2rem',
              fontWeight: 700,
              margin: 0,
              paddingBottom: '16px',
              borderBottom: '1px solid #eaecf0',
              flex: 1,
            }}
          >
            Chương trình khuyến mãi
          </h1>
          <button
            onClick={openCreate}
            className="button button-primary"
            style={{ display: "flex", alignItems: "center", gap: "8px" }}
          >
            <Plus size={16} /> Thêm khuyến mãi
          </button>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
          {(['upcoming', 'active', 'expired', 'disabled'] as const).map((s) => {
            const count = promotions.filter((p) => p.status === s).length
            const info = STATUS_MAP[s]
            return (
              <div
                key={s}
                style={{
                  background: 'white',
                  padding: '24px',
                  borderRadius: '12px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  cursor: 'pointer',
                  border: filterStatus === s ? `2px solid ${info.color}` : '2px solid transparent',
                }}
                onClick={() => {
                  setFilterStatus((prev) => (prev === s ? '' : s))
                  setCurrentPage(1)
                }}
              >
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#667085', fontWeight: 600 }}>
                  {info.label}
                </p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                  <span style={{ fontSize: '2.2rem', fontWeight: 800, color: info.color, lineHeight: 1 }}>
                    {count}
                  </span>
                  {s === 'active' ? (
                    <Percent size={28} color={info.color} />
                  ) : (
                    <Tag size={28} color={info.color} />
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Content */}
        {error && <div className="alert alert-error">{error}</div>}

        <div className="admin-table-wrap" style={{ background: 'white', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.03)', overflow: 'hidden' }}>
          {/* Toolbar */}
          <div
            style={{
              padding: '20px 24px',
              display: 'flex',
              gap: '12px',
              alignItems: 'center',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ position: 'relative', flex: '1 1 220px', minWidth: '180px' }}>
              <Search
                size={16}
                style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }}
              />
              <input
                type="text"
                placeholder="Tìm kiếm theo tên..."
                value={searchText}
                onChange={(e) => {
                  setSearchText(e.target.value)
                  setCurrentPage(1)
                }}
                style={{
                  width: '100%',
                  padding: '10px 16px 10px 36px',
                  borderRadius: '6px',
                  border: 'none',
                  background: '#f1f5f9',
                  color: '#475467',
                  outline: 'none',
                  fontSize: '0.9rem',
                }}
              />
            </div>

            <select
              value={filterStatus}
              onChange={(e) => {
                setFilterStatus(e.target.value)
                setCurrentPage(1)
              }}
              style={{
                padding: '10px 16px',
                borderRadius: '6px',
                border: 'none',
                background: '#f1f5f9',
                color: '#475467',
                outline: 'none',
                fontSize: '0.9rem',
              }}
            >
              <option value="">Tất cả trạng thái</option>
              <option value="upcoming">Sắp diễn ra</option>
              <option value="active">Đang chạy</option>
              <option value="expired">Đã kết thúc</option>
              <option value="disabled">Đã tắt</option>
            </select>

            <button
              onClick={() => {
                setSearchText('');
                setFilterStatus('');
                setCurrentPage(1);
              }}
              title="Xóa bộ lọc"
              style={{
                padding: '10px 14px', borderRadius: '6px', border: 'none',
                background: (searchText || filterStatus) ? '#fee2e2' : '#f1f5f9',
                color: (searchText || filterStatus) ? '#dc2626' : '#475467',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.2s'
              }}
            >
              <SlidersHorizontal size={18} />
            </button>
          </div>

          {loading ? (
            <div style={{ padding: '32px', textAlign: 'center' }}><Spinner /></div>
          ) : promotions.length === 0 ? (
            <div
              style={{
                padding: '48px',
                textAlign: 'center',
                color: '#667085',
              }}
            >
              <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🏷️</div>
              <h3 style={{ color: '#101828', marginBottom: '8px' }}>Chưa có khuyến mãi nào</h3>
              <p>Tạo chương trình khuyến mãi để thu hút khách thuê.</p>
              <button className="button button-primary" onClick={openCreate} style={{ marginTop: '16px' }}>
                <Plus size={16} /> Tạo khuyến mãi đầu tiên
              </button>
            </div>
          ) : (
            <>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ background: '#f9fafb', borderBottom: '1px solid #eaecf0', borderTop: '1px solid #eaecf0' }}>
                  <tr>
                    {['Tên chương trình', 'Giá trị', 'Phòng áp dụng', 'Thời gian', 'Trạng thái', 'Thao tác'].map(
                      (h) => (
                        <th
                          key={h}
                          style={{
                            padding: '12px 16px',
                            textAlign: 'left',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            color: '#667085',
                            textTransform: 'uppercase',
                          }}
                        >
                          {h}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody>
                  {promotions.map((p) => {
                    const statusInfo = STATUS_MAP[p.status] || STATUS_MAP.disabled
                    const roomCount = Array.isArray(p.roomIds) ? p.roomIds.length : 0

                    // Lấy tên các phòng áp dụng (Đã lọc trùng lặp)
                    const rawAppliedRoomIds = Array.isArray(p.roomIds)
                      ? p.roomIds.map((item: any) => typeof item === 'string' ? item : item._id)
                      : [];
                    const appliedRoomIds = [...new Set(rawAppliedRoomIds)];

                    const appliedRoomNames = appliedRoomIds
                      .map(id => allRooms.find(room => room._id === id))
                      .filter(Boolean) as RoomOption[];

                    // Kiểm tra gom nhóm (Tất cả phòng, theo quận, loại...)
                    // Thay vì dùng availableRooms (sẽ bị thay đổi khi có người thuê, làm sai logic khi kết thúc),
                    // ta dựa vào tính đồng nhất của các phòng đã chọn để suy ra nhóm.
                    let isAllRooms = false;
                    let matchedDistrict = '';
                    let matchedType = '';
                    let matchedRentalMode = '';

                    if (appliedRoomIds.length > 0) {
                      const districts = Array.from(new Set(appliedRoomNames.map(r => r.district).filter(Boolean))) as string[];
                      const types = Array.from(new Set(appliedRoomNames.map(r => r.type).filter(Boolean))) as string[];
                      const modes = Array.from(new Set(appliedRoomNames.map(r => r.rentalMode).filter(Boolean))) as string[];

                      const totalRooms = allRooms.length;
                      const appliedCount = appliedRoomIds.length;

                      // Chỉ gom nhóm thành "Tất cả phòng" nếu số lượng áp dụng chiếm >= 80% hệ thống
                      if (appliedCount >= totalRooms * 0.8) {
                        isAllRooms = true;
                      }
                      // Chỉ gom nhóm theo Quận nếu tất cả phòng chọn thuộc 1 quận VÀ chiếm >= 80% phòng của quận đó
                      else if (districts.length === 1) {
                        const districtTotal = allRooms.filter(r => r.district === districts[0]).length;
                        if (appliedCount >= districtTotal * 0.8 && appliedCount > 1) {
                          matchedDistrict = districts[0];
                        }
                      }
                      // Tương tự cho Loại phòng
                      else if (types.length === 1) {
                        const typeTotal = allRooms.filter(r => r.type === types[0]).length;
                        if (appliedCount >= typeTotal * 0.8 && appliedCount > 1) {
                          matchedType = types[0];
                        }
                      }
                      // Tương tự cho Hình thức thuê
                      else if (modes.length === 1) {
                        const modeTotal = allRooms.filter(r => r.rentalMode === modes[0]).length;
                        if (appliedCount >= modeTotal * 0.8 && appliedCount > 1) {
                          matchedRentalMode = modes[0];
                        }
                      }
                    }

                    return (
                      <tr
                        key={p._id}
                        style={{
                          borderBottom: '1px solid #f2f4f7',
                          transition: 'background 0.15s',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = '#f9fafb')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        <td style={{ padding: '14px 16px', fontWeight: 600, color: '#101828' }}>
                          {p.name}
                        </td>
                        <td style={{ padding: '14px 16px', fontWeight: 700, color: '#b42318' }}>
                          {p.discountType === 'percent'
                            ? `giảm ${p.discountValue}%`
                            : formatPrice(p.discountValue)}
                          {p.discountType === 'percent' && p.maxDiscount && (
                            <span style={{ display: 'block', fontSize: '0.75rem', color: '#667085', fontWeight: 400 }}>
                              Tối đa {formatPrice(p.maxDiscount)}
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '14px 16px', color: '#475467' }}>
                          {roomCount === 0 ? (
                            <span style={{ color: '#9ca3af', fontStyle: 'italic', fontSize: '0.85rem' }}>Không có</span>
                          ) : isAllRooms ? (
                            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475467' }}>
                              Tất cả phòng
                            </span>
                          ) : matchedDistrict ? (
                            <span
                              style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475467' }}
                              title={appliedRoomNames.map(r => r.name).join(', ')}
                            >
                              Tất cả phòng {matchedDistrict}
                            </span>
                          ) : matchedType ? (
                            <span
                              style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475467' }}
                              title={appliedRoomNames.map(r => r.name).join(', ')}
                            >
                              Tất cả phòng {matchedType}
                            </span>
                          ) : matchedRentalMode ? (
                            <span
                              style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475467' }}
                              title={appliedRoomNames.map(r => r.name).join(', ')}
                            >
                              Tất cả phòng {matchedRentalMode === 'short_term' ? 'thuê ngắn hạn' : 'thuê dài hạn'}
                            </span>
                          ) : (
                            <span style={{ fontSize: '0.85rem', color: '#475467' }} title={appliedRoomNames.map(r => r.name).join(', ')}>
                              {appliedRoomNames.length > 5
                                ? `${appliedRoomNames.slice(0, 5).map(r => r.name).join(', ')} và ${appliedRoomNames.length - 5} phòng khác`
                                : appliedRoomNames.map(r => r.name).join(', ')}
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '14px 16px', fontSize: '0.85rem', color: '#475467' }}>
                          {formatDate(p.startDate)} → {formatDate(p.endDate)}
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <span
                            style={{
                              background: statusInfo.bg,
                              color: statusInfo.color,
                              padding: '4px 10px',
                              borderRadius: '4px',
                              fontSize: '0.8rem',
                              fontWeight: 700,
                            }}
                          >
                            {statusInfo.label}
                          </span>
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ display: 'flex', gap: '10px' }}>
                            <button
                              onClick={() => openEdit(p)}
                              title={p.status === 'expired' || p.status === 'active' ? "Xem chi tiết" : "Sửa"}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
                            >
                              {p.status === 'expired' || p.status === 'active' ? (
                                <Eye size={16} color="#475467" />
                              ) : (
                                <Pencil size={16} color="#475467" />
                              )}
                            </button>

                            {/* Chỉ hiển thị nút Bật/Tắt nếu KHÔNG PHẢI đang chạy và KHÔNG PHẢI đã kết thúc */}
                            {p.status !== 'expired' && p.status !== 'active' && (
                              <button
                                onClick={() => handleToggleStatus(p)}
                                title={p.status === 'disabled' ? 'Bật lại' : 'Tắt'}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
                              >
                                {p.status === 'disabled' ? (
                                  <ToggleLeft size={16} color="#667085" />
                                ) : (
                                  <ToggleRight size={16} color="#088373" />
                                )}
                              </button>
                            )}

                            <button
                              onClick={() => setDeleteTarget(p)}
                              title="Xóa"
                              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
                            >
                              <Trash2 size={16} color="#d92d20" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="pagination-container" style={{ marginTop: '20px' }}>
                  <button
                    className="pagination-btn"
                    onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                  >
                    ‹
                  </button>
                  {Array.from({ length: totalPages }).map((_, i) => (
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
                    onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                  >
                    ›
                  </button>
                  <span style={{ marginLeft: '12px', fontSize: '0.85rem', color: '#667085' }}>
                    Tổng: {total} khuyến mãi
                  </span>
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Create/Edit Modal ──────────────────────────────────────── */}
        {showModal && (
          <div className="modal-overlay" onClick={() => setShowModal(false)}>
            <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '700px' }}>
              <div className="modal-header">
                <h2>{editing ? (editing.status === 'expired' || editing.status === 'active' ? 'Chi tiết khuyến mãi' : 'Chỉnh sửa khuyến mãi') : 'Thêm khuyến mãi mới'}</h2>
                <button className="modal-close" onClick={() => setShowModal(false)}>
                  ✕
                </button>
              </div>
              <form onSubmit={handleSave} className="modal-form">
                {formError && (
                  <div className="alert alert-error" style={{ marginBottom: '16px' }}>
                    {formError}
                  </div>
                )}

                <fieldset disabled={editing ? (editing.status === 'expired' || editing.status === 'active') : false} style={{ border: 'none', padding: 0, margin: 0 }}>
                  <div className="form-group">
                    <label htmlFor="promo-name">Tên chương trình *</label>
                    <input
                      id="promo-name"
                      className="form-input"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      required
                      placeholder="VD: Summer Sale 2026"
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="promo-desc">Mô tả</label>
                    <textarea
                      id="promo-desc"
                      className="form-input"
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                      rows={2}
                      placeholder="Mô tả ngắn về chương trình..."
                    />
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="promo-discount-type">Loại giảm giá *</label>
                      <select
                        id="promo-discount-type"
                        className="form-input"
                        value={form.discountType}
                        onChange={(e) =>
                          setForm({ ...form, discountType: e.target.value as 'percent' | 'fixed', maxDiscount: null })
                        }
                      >
                        <option value="percent">Phần trăm (%)</option>
                        <option value="fixed">Số tiền cố định (VNĐ)</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label htmlFor="promo-discount-value">
                        Giá trị giảm * {form.discountType === 'percent' ? '(%)' : '(VNĐ)'}
                      </label>
                      <input
                        id="promo-discount-value"
                        type="number"
                        className="form-input"
                        value={form.discountValue || ''}
                        onChange={(e) => setForm({ ...form, discountValue: Number(e.target.value) })}
                        required
                        min={0}
                        max={form.discountType === 'percent' ? 100 : undefined}
                        placeholder={form.discountType === 'percent' ? '20' : '300000'}
                      />
                    </div>
                  </div>

                  {form.discountType === 'percent' && (
                    <div className="form-group">
                      <label htmlFor="promo-max-discount">Giảm tối đa (VNĐ) — Tùy chọn</label>
                      <input
                        id="promo-max-discount"
                        type="number"
                        className="form-input"
                        value={form.maxDiscount || ''}
                        onChange={(e) =>
                          setForm({ ...form, maxDiscount: e.target.value ? Number(e.target.value) : null })
                        }
                        min={0}
                        placeholder="VD: 500000 (bỏ trống = không giới hạn)"
                      />
                    </div>
                  )}

                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="promo-start">Ngày bắt đầu *</label>
                      <CustomDateInput
                        id="promo-start"
                        className="form-input"
                        value={form.startDate}
                        onChange={(e: any) => setForm({ ...form, startDate: e.target.value })}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="promo-end">Ngày kết thúc *</label>
                      <CustomDateInput
                        id="promo-end"
                        className="form-input"
                        value={form.endDate}
                        onChange={(e: any) => setForm({ ...form, endDate: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  {/* Room multi-select */}
                  <div className="form-group">
                    <label>Phòng áp dụng * ({form.roomIds.length} đã chọn)</label>
                    <div
                      style={{
                        border: '1px solid #eaecf0',
                        borderRadius: '8px',
                        overflow: 'hidden',
                      }}
                    >
                      {/* Filters bar */}
                      <div style={{ padding: '10px 12px', borderBottom: '1px solid #eaecf0', background: '#f9fafb', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {/* Search */}
                        <div style={{ position: 'relative' }}>
                          <Search
                            size={14}
                            style={{
                              position: 'absolute',
                              left: '8px',
                              top: '50%',
                              transform: 'translateY(-50%)',
                              color: '#667085',
                            }}
                          />
                          <input
                            type="text"
                            placeholder="Tìm phòng theo tên hoặc địa chỉ..."
                            value={roomSearch}
                            onChange={(e) => setRoomSearch(e.target.value)}
                            style={{
                              width: '100%',
                              padding: '6px 8px 6px 28px',
                              border: '1px solid #d0d5dd',
                              borderRadius: '6px',
                              fontSize: '0.85rem',
                              outline: 'none',
                            }}
                          />
                        </div>

                        {/* District + Type filters */}
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          <select
                            value={filterDistrict}
                            onChange={(e) => setFilterDistrict2(e.target.value)}
                            style={{
                              padding: '5px 8px',
                              border: '1px solid #d0d5dd',
                              borderRadius: '6px',
                              fontSize: '0.82rem',
                              outline: 'none',
                              background: filterDistrict ? '#eef4ff' : 'white',
                              color: filterDistrict ? '#3538cd' : '#475467',
                              fontWeight: filterDistrict ? 600 : 400,
                              flex: '1 1 0',
                              minWidth: '120px',
                            }}
                          >
                            <option value="">Tất cả quận</option>
                            {uniqueDistricts.map(d => (
                              <option key={d} value={d}>{d}</option>
                            ))}
                          </select>

                          <select
                            value={filterType}
                            onChange={(e) => setFilterType(e.target.value)}
                            style={{
                              padding: '5px 8px',
                              border: '1px solid #d0d5dd',
                              borderRadius: '6px',
                              fontSize: '0.82rem',
                              outline: 'none',
                              background: filterType ? '#eef4ff' : 'white',
                              color: filterType ? '#3538cd' : '#475467',
                              fontWeight: filterType ? 600 : 400,
                              flex: '1 1 0',
                              minWidth: '120px',
                            }}
                          >
                            <option value="">Tất cả loại phòng</option>
                            {uniqueTypes.map(t => (
                              <option key={t} value={t}>{t}</option>
                            ))}
                          </select>

                          <select
                            value={filterRentalMode}
                            onChange={(e) => setFilterRentalMode(e.target.value)}
                            style={{
                              padding: '5px 8px',
                              border: '1px solid #d0d5dd',
                              borderRadius: '6px',
                              fontSize: '0.82rem',
                              outline: 'none',
                              background: filterRentalMode ? '#eef4ff' : 'white',
                              color: filterRentalMode ? '#3538cd' : '#475467',
                              fontWeight: filterRentalMode ? 600 : 400,
                              flex: '1 1 0',
                              minWidth: '120px',
                            }}
                          >
                            <option value="">Tất cả hình thức thuê</option>
                            <option value="short_term">Thuê ngắn hạn</option>
                            <option value="long_term">Thuê dài hạn</option>
                          </select>
                        </div>

                        {/* Select all / Deselect all bar */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.8rem', color: '#667085' }}>
                            {filteredRooms.length} phòng phù hợp
                          </span>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                              type="button"
                              onClick={selectAllFiltered}
                              style={{
                                padding: '3px 10px',
                                border: '1px solid #d0d5dd',
                                borderRadius: '6px',
                                fontSize: '0.78rem',
                                fontWeight: 600,
                                background: isAllFilteredSelected ? '#eef4ff' : 'white',
                                color: '#3538cd',
                                cursor: 'pointer',
                                transition: 'all 0.15s',
                              }}
                            >
                              ✓ Chọn tất cả
                            </button>
                            <button
                              type="button"
                              onClick={deselectAllFiltered}
                              style={{
                                padding: '3px 10px',
                                border: '1px solid #d0d5dd',
                                borderRadius: '6px',
                                fontSize: '0.78rem',
                                fontWeight: 600,
                                background: 'white',
                                color: '#b42318',
                                cursor: 'pointer',
                                transition: 'all 0.15s',
                              }}
                            >
                              ✕ Bỏ chọn tất cả
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Room list */}
                      <div style={{ maxHeight: '240px', overflowY: 'auto' }}>
                        {loadingRooms ? (
                          <div style={{ padding: '16px', textAlign: 'center', color: '#667085' }}>
                            Đang tải...
                          </div>
                        ) : filteredRooms.length === 0 ? (
                          <div style={{ padding: '16px', textAlign: 'center', color: '#667085' }}>
                            Không tìm thấy phòng nào phù hợp
                          </div>
                        ) : (
                          filteredRooms.map((r) => (
                            <label
                              key={r._id}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                padding: '8px 12px',
                                cursor: 'pointer',
                                borderBottom: '1px solid #f2f4f7',
                                background: form.roomIds.includes(r._id) ? '#eef4ff' : 'transparent',
                                transition: 'background 0.15s',
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={form.roomIds.includes(r._id)}
                                onChange={() => toggleRoom(r._id)}
                                style={{ accentColor: '#003e68' }}
                              />
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#101828' }}>
                                  {r.name}
                                  {r.type && (
                                    <span style={{
                                      marginLeft: '6px',
                                      fontSize: '0.7rem',
                                      fontWeight: 500,
                                      background: '#f1f5f9',
                                      color: '#64748b',
                                      padding: '1px 5px',
                                      borderRadius: '4px',
                                    }}>
                                      {r.type}
                                    </span>
                                  )}
                                </div>
                                <div style={{ fontSize: '0.75rem', color: '#667085' }}>
                                  {r.address}{r.district ? ` • ${r.district}` : ''} • {formatPrice(r.price)}/tháng
                                </div>
                              </div>
                            </label>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Selected rooms chips */}
                    {form.roomIds.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                        {form.roomIds.map((rid) => {
                          const room = allRooms.find((r) => r._id === rid)
                          return (
                            <span
                              key={rid}
                              style={{
                                background: '#eef4ff',
                                color: '#3538cd',
                                padding: '4px 8px',
                                borderRadius: '6px',
                                fontSize: '0.8rem',
                                fontWeight: 600,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                              }}
                            >
                              {room?.name || rid}
                              <X
                                size={12}
                                style={{ cursor: 'pointer' }}
                                onClick={() => toggleRoom(rid)}
                              />
                            </span>
                          )
                        })}
                        {form.roomIds.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setForm(prev => ({ ...prev, roomIds: [] }))}
                            style={{
                              background: '#fee2e2',
                              color: '#b42318',
                              padding: '4px 8px',
                              borderRadius: '6px',
                              fontSize: '0.8rem',
                              fontWeight: 600,
                              border: 'none',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            Xóa hết
                            <X size={12} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </fieldset>

                <div className="modal-actions">
                  <button type="button" className="button button-secondary" onClick={() => setShowModal(false)}>
                    {editing && (editing.status === 'expired' || editing.status === 'active') ? 'Đóng' : 'Hủy'}
                  </button>
                  {!(editing && (editing.status === 'expired' || editing.status === 'active')) && (
                    <button type="submit" className="button button-primary" disabled={saving}>
                      {saving ? 'Đang lưu...' : editing ? 'Cập nhật' : 'Tạo mới'}
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── Confirm Delete Modal ───────────────────────────────────── */}
        {deleteTarget && (
          <div className="modal-overlay" onClick={() => setDeleteTarget(null)}>
            <div
              className="modal"
              onClick={(e) => e.stopPropagation()}
              style={{ maxWidth: '420px', textAlign: 'center' }}
            >
              <div style={{ padding: '32px 24px' }}>
                <div style={{ fontSize: '3rem', marginBottom: '16px' }}>⚠️</div>
                <h3 style={{ color: '#101828', marginBottom: '8px' }}>Xác nhận xóa</h3>
                <p style={{ color: '#667085', marginBottom: '24px' }}>
                  Bạn có chắc chắn muốn xóa chương trình "<strong>{deleteTarget.name}</strong>"?
                  <br />
                  Hành động này không thể hoàn tác.
                </p>
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                  <button className="button button-secondary" onClick={() => setDeleteTarget(null)}>
                    Hủy
                  </button>
                  <button
                    className="button"
                    style={{ background: '#d92d20', color: 'white', border: 'none' }}
                    onClick={handleConfirmDelete}
                  >
                    Xóa
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
