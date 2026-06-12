import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import api from '../../api/axios.ts'
import Spinner from '../../components/ui/Spinner.tsx'
import { useAuth } from '../../contexts/AuthContext.tsx'
// import Badge from '../../components/ui/Badge.tsx'
import { Building, TrendingUp, Key, Wrench, Pencil, Trash2, ImageIcon } from "lucide-react"
// import { DoorOpen, Bed, User } from "lucide-react"
import { FiHome, FiTool } from "react-icons/fi";
import { MdBed } from "react-icons/md";
import MapPicker from '../../components/map/MapPicker.tsx'
import RoomImageManager from '../../components/room-images/RoomImageManager.tsx'

interface Room {
  _id: string
  name: string
  address: string
  district?: string
  price: number
  area: number
  type: string
  status: 'available' | 'occupied' | 'maintenance'
  description?: string
  amenities?: string[]
  images?: string[]
  maintenanceEndDate?: string
  location?: {
    type: string
    coordinates: [number, number]
  }
}

interface ContractInfo {
  representativeName?: string
  tenantName?: string
  endDate: string
}

const EMPTY_FORM = {
  name: '', address: '', district: '', price: '', area: '',
  type: 'Studio', status: 'available' as Room['status'],
  description: '', amenities: '', maintenanceEndDate: '',
  locationLat: 0, locationLng: 0
}

const STATUS_MAP = {
  available: { label: 'Còn phòng', variant: 'success' as const },
  occupied: { label: 'Đã thuê', variant: 'danger' as const },
  maintenance: { label: 'Đang sửa', variant: 'warning' as const },
}

export default function RoomManagement() {
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const isStaff = user?.role === 'staff'
  const [rooms, setRooms] = useState<Room[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Room | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [contractMap, setContractMap] = useState<Record<string, ContractInfo>>({})

  // Image manager modal state
  const [showImageManager, setShowImageManager] = useState(false)
  const [imageManagerRoom, setImageManagerRoom] = useState<Room | null>(null)
  const [imageManagerImages, setImageManagerImages] = useState<any[]>([])

  // Filters
  const [filterDistrict, setFilterDistrict] = useState(
    isStaff && user?.managedDistricts && user.managedDistricts.length > 0
      ? user.managedDistricts[0]
      : ''
  )
  const [filterType, setFilterType] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const ITEMS_PER_PAGE = 9

  const fetchRooms = () => {
    setLoading(true)
    // Staff: dùng endpoint my-district (đã filter sẵn theo district)
    const endpoint = isStaff ? '/rooms/my-district' : '/rooms'
    api.get(endpoint)
      .then(r => setRooms(r.data))
      .catch(() => setError('Lỗi tải danh sách phòng.'))
      .finally(() => setLoading(false))
  }

  const fetchContracts = () => {
    api.get('/contracts?limit=1000')
      .then(res => {
        const map: Record<string, ContractInfo> = {}
        res.data.data.forEach((c: { room?: { _id: string }; representativeName?: string; tenant?: { name: string }; endDate: string; status: string }) => {
          if (c.room?._id && (c.status === 'active' || c.status === 'pending')) {
            map[c.room._id] = {
              representativeName: c.representativeName,
              tenantName: c.tenant?.name,
              endDate: c.endDate,
            }
          }
        })
        setContractMap(map)
      })
      .catch(() => { })
  }

  useEffect(() => { fetchRooms(); fetchContracts() }, [])

  // Auto-open edit modal if ?edit=id exists
  useEffect(() => {
    const editId = searchParams.get('edit');
    if (editId && rooms.length > 0) {
      const r = rooms.find((room) => room._id === editId);
      if (r) {
        // Cần dùng openEdit bên dưới, nhưng vì openEdit dùng state setEditing/setForm 
        // Nên ta đưa logic vào đây hoặc gọi openEdit. Gọi trực tiếp setState luôn cho chắc.
        setEditing(r);
        setFormError('');
        setForm({
          name: r.name, address: r.address, district: r.district || '',
          price: String(r.price), area: String(r.area), type: r.type, status: r.status,
          description: r.description || '',
          amenities: r.amenities ? r.amenities.join(', ') : '',
          maintenanceEndDate: r.maintenanceEndDate ? new Date(r.maintenanceEndDate).toISOString().split('T')[0] : '',
          locationLat: r.location?.coordinates?.[1] || 0,
          locationLng: r.location?.coordinates?.[0] || 0
        });
        setShowModal(true);
      }
      // Xoá tham số edit để tránh mở lại khi reload trang
      searchParams.delete('edit');
      setSearchParams(searchParams, { replace: true });
    }
  }, [rooms, searchParams, setSearchParams]);

  const openCreate = () => {
    setEditing(null);
    setForm({
      ...EMPTY_FORM,
      district: isStaff && user?.managedDistricts && user.managedDistricts.length > 0 ? user.managedDistricts[0] : ''
    });
    setFormError('');
    setShowModal(true)
  }
  const openEdit = (r: Room) => {
    setEditing(r)
    setFormError('')
    setForm({
      name: r.name, address: r.address, district: r.district || '',
      price: String(r.price), area: String(r.area), type: r.type, status: r.status,
      description: r.description || '',
      amenities: r.amenities ? r.amenities.join(', ') : '',
      maintenanceEndDate: r.maintenanceEndDate ? new Date(r.maintenanceEndDate).toISOString().split('T')[0] : '',
      locationLat: r.location?.coordinates?.[1] || 0,
      locationLng: r.location?.coordinates?.[0] || 0
    })
    setShowModal(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')
    setSaving(true)
    const payload: Record<string, unknown> = {
      ...form,
      price: Number(form.price),
      area: Number(form.area),
      amenities: form.amenities.split(',').map(s => s.trim()).filter(Boolean),
    }

    // Thêm location GeoJSON nếu có tọa độ hợp lệ
    if (form.locationLat !== 0 || form.locationLng !== 0) {
      payload.location = {
        type: 'Point',
        coordinates: [form.locationLng, form.locationLat]
      }
    }
    // Xóa locationLat/locationLng khỏi payload (chỉ là state nội bộ)
    delete payload.locationLat
    delete payload.locationLng
    try {
      if (editing) {
        await api.put(`/rooms/${editing._id}`, payload)
      } else {
        await api.post('/rooms', payload)
      }
      setShowModal(false)
      fetchRooms()
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        ?? 'Lưu thất bại. Vui lòng thử lại.'
      setFormError(msg)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa phòng này?')) return
    try {
      await api.delete(`/rooms/${id}`)
      fetchRooms()
    } catch {
      alert('Xóa thất bại.')
    }
  }

  const totalRooms = rooms.length;
  const occupiedRooms = rooms.filter(r => r.status === 'occupied').length;
  const availableRooms = rooms.filter(r => r.status === 'available').length;
  const maintenanceRooms = rooms.filter(r => r.status === 'maintenance').length;
  const occupancyRate = totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0;

  const filteredRooms = rooms.filter(r => {
    if (filterDistrict && r.district !== filterDistrict) return false;
    if (filterType && r.type !== filterType) return false;
    if (filterStatus && r.status !== filterStatus) return false;
    return true;
  });

  return (
    <div className="page-shell">
      <div className="admin-page">
        <h1 style={{ color: '#003e68', fontSize: '2rem', fontWeight: 700, margin: '0 0 24px 0', paddingBottom: '16px', borderBottom: '1px solid #eaecf0' }}>
          Danh sách phòng
        </h1>

        {/* Stats Row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
          <div style={{ background: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.03)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <p style={{ margin: 0, fontSize: '0.85rem', color: '#667085', fontWeight: 600 }}>Tổng số phòng</p>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
              <span style={{ fontSize: '2.2rem', fontWeight: 800, color: '#003e68', lineHeight: 1 }}>{totalRooms}</span>
              <Building size={28} color="#aab4c5" />
            </div>
          </div>

          <div style={{ background: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.03)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <p style={{ margin: 0, fontSize: '0.85rem', color: '#667085', fontWeight: 600 }}>Phòng đang thuê</p>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
              <span style={{ fontSize: '2.2rem', fontWeight: 800, color: '#003e68', lineHeight: 1 }}>{occupiedRooms}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ fontSize: '0.8rem', color: '#088373', fontWeight: 700 }}>↑{occupancyRate}%</span>
                <TrendingUp size={24} color="#aab4c5" style={{ marginLeft: '8px' }} />
              </div>
            </div>
          </div>

          <div style={{ background: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.03)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <p style={{ margin: 0, fontSize: '0.85rem', color: '#667085', fontWeight: 600 }}>Phòng trống</p>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
              <span style={{ fontSize: '2.2rem', fontWeight: 800, color: '#088373', lineHeight: 1 }}>{availableRooms}</span>
              <Key size={28} color="#30d2b2ff" />
            </div>
          </div>

          <div style={{ background: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.03)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <p style={{ margin: 0, fontSize: '0.85rem', color: '#667085', fontWeight: 600 }}>Phòng đang sửa</p>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
              <span style={{ fontSize: '2.2rem', fontWeight: 800, color: '#f79009', lineHeight: 1 }}>{maintenanceRooms}</span>
              <Wrench size={28} color="#edb061ff" />
            </div>
          </div>
        </div>

        {/* Toolbar Row */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', alignItems: 'center', background: 'white', padding: '12px 16px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
          <select value={filterDistrict} onChange={e => { setFilterDistrict(e.target.value); setCurrentPage(1); }} style={{ padding: '10px 16px', borderRadius: '8px', border: '1px solid #eaecf0', background: '#f9fafb', color: '#475467', outline: 'none' }}>
            <option value="">Tất cả Khu vực</option>
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

          <select value={filterType} onChange={e => { setFilterType(e.target.value); setCurrentPage(1); }} style={{ padding: '10px 16px', borderRadius: '8px', border: '1px solid #eaecf0', background: '#f9fafb', color: '#475467', outline: 'none' }}>
            <option value="">Loại phòng</option>
            <option value="Studio">Studio</option>
            <option value="1 phòng ngủ">1 phòng ngủ</option>
            <option value="Chung cư mini">Chung cư mini</option>
            <option value="Phòng trọ thường">Phòng trọ thường</option>
          </select>

          <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setCurrentPage(1); }} style={{ padding: '10px 16px', borderRadius: '8px', border: '1px solid #eaecf0', background: '#f9fafb', color: '#475467', outline: 'none' }}>
            <option value="">Trạng thái</option>
            <option value="available">Còn phòng</option>
            <option value="occupied">Đã thuê</option>
            <option value="maintenance">Đang sửa</option>
          </select>

          <div style={{ marginLeft: 'auto' }}>
            <button className="button button-primary" onClick={openCreate} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '1rem' }}>+</span> THÊM PHÒNG
            </button>
          </div>
        </div>

        {error && <div className="alert alert-error">{error}</div>}
        {loading ? <Spinner /> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {filteredRooms.length === 0 ? (
              <div style={{ padding: '32px', textAlign: 'center', color: '#667085', background: 'white', borderRadius: '12px' }}>Chưa có phòng nào.</div>
            ) : filteredRooms.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE).map(r => {
              let statusColor, statusBg, iconCode: React.ReactNode, iconBg;
              if (r.status === 'available') {
                statusColor = '#088373'; statusBg = '#bef2e8'; iconCode = <FiHome />; iconBg = '#f0f2f5';
              } else if (r.status === 'occupied') {
                statusColor = '#003e68'; statusBg = '#d1e4ff'; iconCode = <MdBed />; iconBg = '#d1e4ff';
              } else {
                statusColor = '#b86b00'; statusBg = '#fddcb0'; iconCode = <FiTool />; iconBg = '#fddcb0';
              }

              return (
                <div key={r._id} style={{
                  display: 'flex', alignItems: 'center', background: 'white',
                  padding: '16px 24px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                  borderLeft: `4px solid ${r.status === 'occupied' ? '#003e68' : 'transparent'}`
                }}>
                  {/* Icon Area */}
                  <div style={{ width: '60px', height: '60px', borderRadius: '12px', background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.8rem', marginRight: '24px', flexShrink: 0 }}>
                    {iconCode}
                  </div>

                  {/* Info Area */}
                  <div style={{ flex: '1', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                        <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#101828' }}>{r.name}</span>
                      </div>
                      <span style={{ background: statusBg, color: statusColor, padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>
                        {STATUS_MAP[r.status].label}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.85rem', color: '#667085', marginTop: '4px' }}>
                      {r.district || 'Không có tòa'} • {r.type}
                    </div>
                  </div>

                  {/* Price Area */}
                  <div style={{ width: '150px', display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '0.75rem', color: '#667085', fontWeight: 600, textTransform: 'uppercase' }}>Giá thuê</span>
                    <span style={{ fontSize: '1rem', fontWeight: 800, color: '#101828', marginTop: '2px' }}>{r.price.toLocaleString('vi-VN')} đ</span>
                  </div>

                  {/* Tenant Area */}
                  <div style={{ width: '200px', display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '0.75rem', color: '#667085', fontWeight: 600, textTransform: 'uppercase' }}>Khách hiện tại</span>
                    <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#475467', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {r.status === 'occupied'
                        ? <><span style={{ background: '#eaecf0', color: '#667085', padding: '2px 6px', borderRadius: '50%', fontSize: '0.7rem' }}>NT</span> {contractMap[r._id]?.representativeName || contractMap[r._id]?.tenantName || 'Khách thuê'}</>
                        : (r.status === 'maintenance' ? 'Bảo trì' : 'Trống')}
                    </span>
                  </div>

                  {/* Date Area */}
                  <div style={{ width: '150px', display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '0.75rem', color: '#667085', fontWeight: 600, textTransform: 'uppercase' }}>
                      {r.status === 'maintenance' ? 'Dự kiến xong' : 'Hết hạn HĐ'}
                    </span>
                    <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#101828', marginTop: '2px' }}>
                      {r.status === 'occupied'
                        ? (contractMap[r._id]?.endDate ? new Date(contractMap[r._id].endDate).toLocaleDateString('vi-VN') : '-')
                        : (r.status === 'maintenance' ? (r.maintenanceEndDate ? new Date(r.maintenanceEndDate).toLocaleDateString('vi-VN') : 'Chưa rõ') : '-')}
                    </span>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: '16px', marginLeft: '24px' }}>
                    <button onClick={() => openEdit(r)} title="Sửa">
                      <Pencil size={18} />
                    </button>
                    <button
                      onClick={() => {
                        setImageManagerRoom(r)
                        setImageManagerImages(r.images || [])
                        setShowImageManager(true)
                      }}
                      title="Quản lý ảnh"
                      style={{ color: '#088373' }}
                    >
                      <ImageIcon size={18} />
                    </button>
                    {!isStaff && (
                      <button onClick={() => handleDelete(r._id)} title="Xóa">
                        <Trash2 size={18} color="#d92d20" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Pagination */}
            {filteredRooms.length > ITEMS_PER_PAGE && (
              <div className="pagination-container">
                <button
                  className="pagination-btn"
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  title="Trang trước"
                >
                  &lsaquo;
                </button>

                {Array.from({ length: Math.ceil(filteredRooms.length / ITEMS_PER_PAGE) }).map((_, i) => (
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
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, Math.ceil(filteredRooms.length / ITEMS_PER_PAGE)))}
                  disabled={currentPage === Math.ceil(filteredRooms.length / ITEMS_PER_PAGE)}
                  title="Trang sau"
                >
                  &rsaquo;
                </button>
              </div>
            )}
          </div>
        )}

        {/* Modal */}
        {showModal && (
          <div className="modal-overlay" onClick={() => setShowModal(false)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h2>{editing ? 'Chỉnh sửa phòng' : 'Thêm phòng mới'}</h2>
                <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
              </div>
              <form onSubmit={handleSave} className="modal-form" id="room-form">
                {formError && (
                  <div className="alert alert-error" style={{ marginBottom: '16px' }}>
                    {formError}
                  </div>
                )}
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="f-name">Tên phòng</label>
                    <input id="f-name" className="form-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required placeholder="VD: Studio 101" />
                  </div>
                  <div className="form-group">
                    <label htmlFor="f-type">Loại phòng</label>
                    <select id="f-type" className="form-input" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                      <option>Studio</option>
                      <option>1 phòng ngủ</option>
                      <option>Chung cư mini</option>
                      <option>Phòng trọ thường</option>
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label htmlFor="f-address">Địa chỉ</label>
                  <input id="f-address" className="form-input" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} required placeholder="128 Đề Thám, Q.1, TP.HCM" />
                </div>
                {/* MapPicker — auto geocode khi nhập địa chỉ */}
                <MapPicker
                  address={form.address}
                  value={{ lat: form.locationLat, lng: form.locationLng }}
                  onChange={(loc) => setForm({ ...form, locationLat: loc.lat, locationLng: loc.lng })}
                />
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="f-price">Giá thuê (VNĐ/tháng)</label>
                    <input id="f-price" type="number" className="form-input" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} required min={0} placeholder="5500000" />
                  </div>
                  <div className="form-group">
                    <label htmlFor="f-area">Diện tích (m²)</label>
                    <input id="f-area" type="number" className="form-input" value={form.area} onChange={e => setForm({ ...form, area: e.target.value })} required min={0} placeholder="40" />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="f-district">Quận/Huyện</label>
                    <select id="f-district" className="form-input" value={form.district} onChange={e => setForm({ ...form, district: e.target.value })}>
                      <option value="">Chọn quận/huyện</option>
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
                  </div>
                  <div className="form-group">
                    <label htmlFor="f-status">Trạng thái</label>
                    <select id="f-status" className="form-input" value={form.status} onChange={e => setForm({ ...form, status: e.target.value as Room['status'] })}>
                      <option value="available">Còn phòng</option>
                      <option value="occupied">Đã thuê</option>
                      <option value="maintenance">Đang sửa chữa</option>
                    </select>
                  </div>
                </div>
                {form.status === 'maintenance' && (
                  <div className="form-group">
                    <label htmlFor="f-maintenance-end">Thời gian dự kiến xong (Tùy chọn)</label>
                    <input id="f-maintenance-end" type="date" className="form-input" value={form.maintenanceEndDate || ''} onChange={e => setForm({ ...form, maintenanceEndDate: e.target.value })} />
                  </div>
                )}
                <div className="form-group">
                  <label htmlFor="f-amenities">Tiện ích (phân cách bằng dấu phẩy)</label>
                  <input id="f-amenities" className="form-input" value={form.amenities} onChange={e => setForm({ ...form, amenities: e.target.value })} placeholder="VD: Wifi, Điều hòa, Bếp riêng" />
                </div>

                <div className="form-group">
                  <label htmlFor="f-desc">Mô tả chi tiết</label>
                  <textarea id="f-desc" className="form-input" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} placeholder="Mô tả về phòng, giờ giấc tự do..." />
                </div>
                <div className="modal-actions">
                  <button type="button" className="button button-secondary" onClick={() => setShowModal(false)}>Hủy</button>
                  <button type="submit" className="button button-primary" id="save-room-btn" disabled={saving}>
                    {saving ? 'Đang lưu...' : (editing ? 'Cập nhật' : 'Thêm phòng')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Image Manager Modal */}
        {showImageManager && imageManagerRoom && (
          <div className="modal-overlay" onClick={() => setShowImageManager(false)}>
            <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '900px' }}>
              <div className="modal-header">
                <h2>Quản lý ảnh — {imageManagerRoom.name}</h2>
                <button className="modal-close" onClick={() => { setShowImageManager(false); fetchRooms(); }}>✕</button>
              </div>
              <div style={{ padding: '0 24px 24px' }}>
                <RoomImageManager
                  roomId={imageManagerRoom._id}
                  images={imageManagerImages}
                  onImagesChange={setImageManagerImages}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
