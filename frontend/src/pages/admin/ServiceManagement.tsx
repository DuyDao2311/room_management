import { useState, useEffect } from 'react'
import { serviceService, CATEGORY_LABELS, getMinVariantPrice, UNIT_PRESETS, type Service, type ServiceCategory, type ServiceUnit } from '../../api/service.service'
import Spinner from '../../components/ui/Spinner'
import { Pencil, EyeOff, Eye, Trash2 } from 'lucide-react'
import ServiceImagePicker from './ServiceImagePicker'

type ServiceVariantForm = { label: string; capacity: string; price: string; description: string }

const EMPTY_FORM = {
  name: '', category: 'cleaning' as ServiceCategory, description: '',
  price: '', unit: 'lần' as ServiceUnit, images: '', isActive: false,
  usesVariants: false, requiresCapacityMatch: false, capacityFieldLabel: '',
  variants: [] as ServiceVariantForm[],
}

const ICON_BUTTON_STYLE = {
  width: 32, height: 32, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  borderRadius: 6, background: 'transparent',
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
  const [showImagePicker, setShowImagePicker] = useState(false)

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
      usesVariants: s.usesVariants, requiresCapacityMatch: s.requiresCapacityMatch, capacityFieldLabel: s.capacityFieldLabel,
      variants: s.variants.map(v => ({ label: v.label, capacity: v.capacity != null ? String(v.capacity) : '', price: String(v.price), description: v.description ?? '' })),
    })
    setShowModal(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')
    if (form.usesVariants) {
      if (form.variants.length === 0) {
        setFormError('Vui lòng thêm ít nhất 1 lựa chọn.')
        return
      }
      const incomplete = form.variants.some(v =>
        !v.label.trim() || !v.price || (form.requiresCapacityMatch && !v.capacity)
      )
      if (incomplete) {
        setFormError(`Vui lòng điền đầy đủ tên, giá${form.requiresCapacityMatch ? ', sức chứa' : ''} cho từng lựa chọn.`)
        return
      }
      if (form.requiresCapacityMatch && !form.capacityFieldLabel.trim()) {
        setFormError('Vui lòng đặt tên nhãn cho trường số lượng.')
        return
      }
    }
    setSaving(true)
    const payload = form.usesVariants
      ? {
          name: form.name,
          category: form.category,
          description: form.description,
          images: form.images.split(',').map(s => s.trim()).filter(Boolean),
          isActive: form.isActive,
          usesVariants: true,
          requiresCapacityMatch: form.requiresCapacityMatch,
          capacityFieldLabel: form.requiresCapacityMatch ? form.capacityFieldLabel.trim() : '',
          variants: form.variants.map(v => ({
            label: v.label.trim(),
            price: Number(v.price),
            ...(form.requiresCapacityMatch ? { capacity: Number(v.capacity) } : {}),
            ...(v.description.trim() ? { description: v.description.trim() } : {}),
          })),
        }
      : {
          name: form.name,
          category: form.category,
          description: form.description,
          price: Number(form.price),
          unit: form.unit,
          images: form.images.split(',').map(s => s.trim()).filter(Boolean),
          isActive: form.isActive,
          usesVariants: false,
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
  const isPresetUnit = UNIT_PRESETS.includes(form.unit)

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
            ) : filteredServices.map(s => {
              const contentOpacity = s.isActive ? 1 : 0.6
              return (
              <div key={s._id} style={{
                display: 'flex', alignItems: 'center', background: 'white',
                padding: '16px 24px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
              }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', opacity: contentOpacity }}>
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

                <div style={{ width: '160px', display: 'flex', flexDirection: 'column', opacity: contentOpacity }}>
                  <span style={{ fontSize: '0.75rem', color: '#667085', fontWeight: 600, textTransform: 'uppercase' }}>Giá</span>
                  <span style={{ fontSize: '1rem', fontWeight: 800, color: '#101828', marginTop: '2px' }}>
                    {s.usesVariants
                      ? `Từ ${getMinVariantPrice(s.variants).toLocaleString('vi-VN')}đ`
                      : `${s.price.toLocaleString('vi-VN')} đ/${s.unit}`}
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '16px', marginLeft: '24px' }}>
                  <button onClick={() => openEdit(s)} title="Sửa" aria-label="Sửa dịch vụ" style={ICON_BUTTON_STYLE}>
                    <Pencil size={18} />
                  </button>
                  <button
                    onClick={() => handleDelete(s)}
                    disabled={!!s.bookingCount || s.isActive}
                    title={
                      s.bookingCount
                        ? `Không thể xóa: đã có ${s.bookingCount} lượt đặt`
                        : s.isActive
                        ? 'Không thể xóa: hãy tạm dừng dịch vụ trước'
                        : 'Xóa dịch vụ'
                    }
                    aria-label="Xóa dịch vụ"
                    style={{ ...ICON_BUTTON_STYLE, opacity: (s.bookingCount || s.isActive) ? 0.4 : 1, cursor: (s.bookingCount || s.isActive) ? 'not-allowed' : 'pointer' }}
                  >
                    <Trash2 size={18} color="#d92d20" />
                  </button>
                  <button onClick={() => toggleActive(s)} title={s.isActive ? 'Tạm ngừng' : 'Kích hoạt lại'} aria-label={s.isActive ? 'Tạm ngừng dịch vụ' : 'Kích hoạt lại dịch vụ'} style={ICON_BUTTON_STYLE}>
                    {s.isActive ? <EyeOff size={18} color="#d92d20" /> : <Eye size={18} color="#088373" />}
                  </button>
                </div>
              </div>
              )
            })}
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
                  {!form.usesVariants && (
                    <div className="form-group">
                      <label htmlFor="s-unit">Đơn vị tính</label>
                      <select
                        id="s-unit"
                        className="form-input"
                        value={isPresetUnit ? form.unit : '__custom__'}
                        onChange={e => {
                          const val = e.target.value
                          setForm({ ...form, unit: val === '__custom__' ? '' : val })
                        }}
                      >
                        {UNIT_PRESETS.map(u => (
                          <option key={u} value={u}>{u.charAt(0).toUpperCase() + u.slice(1)}</option>
                        ))}
                        <option value="__custom__">Khác (tự nhập)...</option>
                      </select>
                      {!isPresetUnit && (
                        <input
                          className="form-input"
                          style={{ marginTop: '8px' }}
                          value={form.unit}
                          onChange={e => setForm({ ...form, unit: e.target.value })}
                          placeholder="VD: kg, phần, công"
                          required
                        />
                      )}
                    </div>
                  )}
                </div>

                <div className="form-group">
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="checkbox" checked={form.usesVariants}
                      onChange={e => {
                        const checked = e.target.checked
                        setForm({
                          ...form,
                          usesVariants: checked,
                          variants: checked && form.variants.length === 0 ? [{ label: '', capacity: '', price: '', description: '' }] : form.variants,
                        })
                      }}
                    />
                    Dịch vụ này có nhiều lựa chọn giá
                  </label>
                </div>

                {form.usesVariants && (
                  <div className="form-group">
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input
                        type="checkbox" checked={form.requiresCapacityMatch}
                        onChange={e => setForm({ ...form, requiresCapacityMatch: e.target.checked })}
                      />
                      Yêu cầu khớp số lượng (khóa chọn tự động theo sức chứa)
                    </label>
                  </div>
                )}

                {form.usesVariants && form.requiresCapacityMatch && (
                  <div className="form-group">
                    <label htmlFor="s-capacity-label">Nhãn số lượng hiển thị cho khách</label>
                    <input
                      id="s-capacity-label" className="form-input" value={form.capacityFieldLabel}
                      onChange={e => setForm({ ...form, capacityFieldLabel: e.target.value })}
                      placeholder="VD: Số hành khách" required
                    />
                  </div>
                )}

                {form.usesVariants ? (
                  <div className="form-group">
                    <label>Các lựa chọn</label>
                    {form.variants.map((v, i) => (
                      <div key={i} className="form-row" style={{ marginBottom: '8px', alignItems: 'center' }}>
                        <input
                          className="form-input" placeholder="Tên lựa chọn (VD: 4 chỗ)" value={v.label}
                          onChange={e => setForm({ ...form, variants: form.variants.map((o: ServiceVariantForm, idx: number) => idx === i ? { ...o, label: e.target.value } : o) })}
                          required
                        />
                        {form.requiresCapacityMatch && (
                          <input
                            type="number" className="form-input" placeholder="Sức chứa" min={1} value={v.capacity}
                            onChange={e => setForm({ ...form, variants: form.variants.map((o: ServiceVariantForm, idx: number) => idx === i ? { ...o, capacity: e.target.value } : o) })}
                            required
                          />
                        )}
                        <input
                          type="number" className="form-input" placeholder="Giá (VNĐ)" min={0} value={v.price}
                          onChange={e => setForm({ ...form, variants: form.variants.map((o: ServiceVariantForm, idx: number) => idx === i ? { ...o, price: e.target.value } : o) })}
                          required
                        />
                        <input
                          className="form-input" placeholder="Mô tả lựa chọn (VD: chỉ dọn qua, không thay ga)" value={v.description}
                          onChange={e => setForm({ ...form, variants: form.variants.map((o: ServiceVariantForm, idx: number) => idx === i ? { ...o, description: e.target.value } : o) })}
                        />
                        <button
                          type="button" className="button button-secondary" aria-label="Xóa lựa chọn"
                          disabled={form.variants.length <= 1}
                          onClick={() => setForm({ ...form, variants: form.variants.filter((_, idx) => idx !== i) })}
                        >✕</button>
                      </div>
                    ))}
                    <button
                      type="button" className="button button-secondary"
                      onClick={() => setForm({ ...form, variants: [...form.variants, { label: '', capacity: '', price: '', description: '' }] })}
                    >+ Thêm lựa chọn</button>
                  </div>
                ) : (
                  <div className="form-group">
                    <label htmlFor="s-price">Giá (VNĐ)</label>
                    <input id="s-price" type="number" className="form-input" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} required min={0} placeholder="100000" />
                  </div>
                )}
                <div className="form-group">
                  <label htmlFor="s-images">Ảnh (URL, phân cách bằng dấu phẩy)</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input id="s-images" className="form-input" value={form.images} onChange={e => setForm({ ...form, images: e.target.value })} placeholder="https://..., https://..." />
                    <button type="button" className="button button-secondary" onClick={() => setShowImagePicker(true)}>Chọn ảnh</button>
                  </div>
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

        {showImagePicker && (
          <ServiceImagePicker
            serviceName={form.name}
            onDone={urls => {
              setForm(f => ({ ...f, images: [f.images, ...urls].filter(Boolean).join(', ') }))
              setShowImagePicker(false)
            }}
            onClose={() => setShowImagePicker(false)}
          />
        )}
      </div>
    </div>
  )
}
