import { useState, useEffect } from 'react'
import { serviceService, CATEGORY_LABELS, type Service, type ServiceCategory, type ServiceUnit } from '../../api/service.service'
import Spinner from '../../components/ui/Spinner'
import { Pencil, EyeOff, Eye, Trash2 } from 'lucide-react'

const EMPTY_FORM = {
  name: '', category: 'cleaning' as ServiceCategory, description: '',
  price: '', unit: 'lần' as ServiceUnit, images: '', isActive: true,
}

export default function ServiceManagement() {
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Service | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [filterCategory, setFilterCategory] = useState('')

  const fetchServices = () => {
    setLoading(true)
    serviceService.getServices()
      .then(res => setServices(res.data))
      .catch(() => setError('Lỗi tải danh sách dịch vụ.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchServices() }, [])

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setFormError('')
    setShowModal(true)
  }

  const openEdit = (s: Service) => {
    setEditing(s)
    setFormError('')
    setForm({
      name: s.name, category: s.category, description: s.description,
      price: String(s.price), unit: s.unit, images: s.images.join(', '), isActive: s.isActive,
    })
    setShowModal(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')
    setSaving(true)
    const payload = {
      name: form.name,
      category: form.category,
      description: form.description,
      price: Number(form.price),
      unit: form.unit,
      images: form.images.split(',').map(s => s.trim()).filter(Boolean),
      isActive: form.isActive,
    }
    try {
      if (editing) {
        await serviceService.updateService(editing._id, payload)
      } else {
        await serviceService.createService(payload)
      }
      setShowModal(false)
      fetchServices()
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Lưu thất bại. Vui lòng thử lại.')
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (s: Service) => {
    try {
      await serviceService.updateService(s._id, { isActive: !s.isActive })
      fetchServices()
    } catch {
      alert('Cập nhật thất bại.')
    }
  }

  const handleDelete = async (s: Service) => {
    if (!window.confirm('Xóa vĩnh viễn dịch vụ này? Không thể hoàn tác.')) return
    try {
      await serviceService.deleteService(s._id)
      fetchServices()
    } catch (err: any) {
      alert(err.response?.data?.message || 'Xóa thất bại.')
    }
  }

  const filteredServices = services.filter(s => !filterCategory || s.category === filterCategory)

  return (
    <div className="page-shell">
      <div className="admin-page">
        <h1 style={{ color: '#003e68', fontSize: '2rem', fontWeight: 700, margin: '0 0 24px 0', paddingBottom: '16px', borderBottom: '1px solid #eaecf0' }}>
          Quản lý Dịch vụ
        </h1>

        <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', alignItems: 'center', background: 'white', padding: '12px 16px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
          <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} style={{ padding: '10px 16px', borderRadius: '8px', border: '1px solid #eaecf0', background: '#f9fafb', color: '#475467', outline: 'none' }}>
            <option value="">Tất cả loại dịch vụ</option>
            {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
          <div style={{ marginLeft: 'auto' }}>
            <button className="button button-primary" onClick={openCreate} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '1rem' }}>+</span> THÊM DỊCH VỤ
            </button>
          </div>
        </div>

        {error && <div className="alert alert-error">{error}</div>}
        {loading ? <Spinner /> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {filteredServices.length === 0 ? (
              <div style={{ padding: '32px', textAlign: 'center', color: '#667085', background: 'white', borderRadius: '12px' }}>Chưa có dịch vụ nào.</div>
            ) : filteredServices.map(s => (
              <div key={s._id} style={{
                display: 'flex', alignItems: 'center', background: 'white',
                padding: '16px 24px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                opacity: s.isActive ? 1 : 0.6,
              }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#101828' }}>{s.name}</span>
                    <span style={{ background: '#d1e4ff', color: '#003e68', padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700 }}>
                      {CATEGORY_LABELS[s.category]}
                    </span>
                    {!s.isActive && (
                      <span style={{ background: '#fee4e2', color: '#d92d20', padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700 }}>
                        TẠM NGỪNG
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#667085', marginTop: '4px' }}>
                    ★ {s.avgRating.toFixed(1)} ({s.ratingCount} đánh giá)
                  </div>
                </div>

                <div style={{ width: '160px', display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '0.75rem', color: '#667085', fontWeight: 600, textTransform: 'uppercase' }}>Giá</span>
                  <span style={{ fontSize: '1rem', fontWeight: 800, color: '#101828', marginTop: '2px' }}>{s.price.toLocaleString('vi-VN')} đ/{s.unit}</span>
                </div>

                <div style={{ display: 'flex', gap: '16px', marginLeft: '24px' }}>
                  <button onClick={() => openEdit(s)} title="Sửa" aria-label="Sửa dịch vụ">
                    <Pencil size={18} />
                  </button>
                  <button
                    onClick={() => handleDelete(s)}
                    disabled={!!s.bookingCount && s.bookingCount > 0}
                    title={s.bookingCount ? `Không thể xóa: đã có ${s.bookingCount} lượt đặt` : 'Xóa dịch vụ'}
                    aria-label="Xóa dịch vụ"
                    style={{ opacity: s.bookingCount ? 0.4 : 1, cursor: s.bookingCount ? 'not-allowed' : 'pointer' }}
                  >
                    <Trash2 size={18} color="#d92d20" />
                  </button>
                  <button onClick={() => toggleActive(s)} title={s.isActive ? 'Tạm ngừng' : 'Kích hoạt lại'} aria-label={s.isActive ? 'Tạm ngừng dịch vụ' : 'Kích hoạt lại dịch vụ'}>
                    {s.isActive ? <EyeOff size={18} color="#d92d20" /> : <Eye size={18} color="#088373" />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {showModal && (
          <div className="modal-overlay" onClick={() => setShowModal(false)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h2>{editing ? 'Chỉnh sửa dịch vụ' : 'Thêm dịch vụ mới'}</h2>
                <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
              </div>
              <form onSubmit={handleSave} className="modal-form">
                {formError && <div className="alert alert-error" style={{ marginBottom: '16px' }}>{formError}</div>}
                <div className="form-group">
                  <label htmlFor="s-name">Tên dịch vụ</label>
                  <input id="s-name" className="form-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required placeholder="VD: Dọn phòng theo giờ" />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="s-category">Loại dịch vụ</label>
                    <select id="s-category" className="form-input" value={form.category} onChange={e => setForm({ ...form, category: e.target.value as ServiceCategory })}>
                      {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                        <option key={key} value={key}>{label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label htmlFor="s-unit">Đơn vị tính</label>
                    <select id="s-unit" className="form-input" value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value as ServiceUnit })}>
                      <option value="lần">Lần</option>
                      <option value="buổi">Buổi</option>
                      <option value="khách">Khách</option>
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label htmlFor="s-price">Giá (VNĐ)</label>
                  <input id="s-price" type="number" className="form-input" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} required min={0} placeholder="100000" />
                </div>
                <div className="form-group">
                  <label htmlFor="s-images">Ảnh (URL, phân cách bằng dấu phẩy)</label>
                  <input id="s-images" className="form-input" value={form.images} onChange={e => setForm({ ...form, images: e.target.value })} placeholder="https://..., https://..." />
                </div>
                <div className="form-group">
                  <label htmlFor="s-desc">Mô tả</label>
                  <textarea id="s-desc" className="form-input" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} placeholder="Mô tả chi tiết dịch vụ..." />
                </div>
                {editing && (
                  <div className="form-group">
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input type="checkbox" checked={form.isActive} onChange={e => setForm({ ...form, isActive: e.target.checked })} />
                      Đang hoạt động (bỏ chọn để tạm ngừng, không xóa dữ liệu)
                    </label>
                  </div>
                )}
                <div className="modal-actions">
                  <button type="button" className="button button-secondary" onClick={() => setShowModal(false)}>Hủy</button>
                  <button type="submit" className="button button-primary" disabled={saving}>
                    {saving ? 'Đang lưu...' : (editing ? 'Cập nhật' : 'Thêm dịch vụ')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
