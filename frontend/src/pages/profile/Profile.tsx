import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext.tsx'
import api from '../../api/axios.ts'

interface FormData {
  name: string
  phone: string
  dob: string
  gender: string
  occupation: string
  address: string
  idCard: string
  idCardDate: string
}

export default function Profile() {
  const { user, refreshUser } = useAuth()
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [editing, setEditing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)

  const [form, setForm] = useState<FormData>({
    name: '',
    phone: '',
    dob: '',
    gender: '',
    occupation: '',
    address: '',
    idCard: '',
    idCardDate: '',
  })

  useEffect(() => {
    if (user) {
      setForm({
        name: user.name || '',
        phone: user.phone || '',
        dob: user.dob
          ? (typeof user.dob === 'string' && user.dob.includes('/')
            ? user.dob.split('/').reverse().join('-')
            : user.dob)
          : '',
        gender: user.gender || '',
        occupation: user.occupation || '',
        address: user.address || '',
        idCard: user.idCard || '',
        idCardDate: user.idCardDate
          ? (typeof user.idCardDate === 'string' && user.idCardDate.includes('/')
            ? user.idCardDate.split('/').reverse().join('-')
            : user.idCardDate)
          : '',
      })
    }
  }, [user])

  const handleChange = (field: keyof FormData, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { setError('Ảnh không được vượt quá 5MB.'); return }
    if (!file.type.startsWith('image/')) { setError('Vui lòng chọn file ảnh hợp lệ.'); return }

    setUploadingAvatar(true)
    setError('')
    try {
      const base64 = await fileToBase64(file)
      setAvatarPreview(base64)
      const { data } = await api.put('/auth/profile', { avatar: base64 })
      sessionStorage.setItem('user', JSON.stringify(data.user))
      await refreshUser()
      setMessage('Cập nhật ảnh đại diện thành công!')
      setTimeout(() => setMessage(''), 3000)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Tải ảnh thất bại.')
      setAvatarPreview(null)
    } finally { setUploadingAvatar(false) }
  }

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })

  const handleSave = async () => {
    setLoading(true)
    setMessage('')
    setError('')
    try {
      const { data } = await api.put('/auth/profile', form)
      sessionStorage.setItem('user', JSON.stringify(data.user))
      await refreshUser()
      setMessage('Cập nhật thông tin thành công!')
      setEditing(false)
      setTimeout(() => setMessage(''), 3000)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Cập nhật thất bại.')
    } finally { setLoading(false) }
  }

  const handleCancel = () => {
    if (user) {
      setForm({
        name: user.name || '',
        phone: user.phone || '',
        dob: user.dob
          ? (typeof user.dob === 'string' && user.dob.includes('/')
            ? user.dob.split('/').reverse().join('-')
            : user.dob)
          : '',
        gender: user.gender || '',
        occupation: user.occupation || '',
        address: user.address || '',
        idCard: user.idCard || '',
        idCardDate: user.idCardDate
          ? (typeof user.idCardDate === 'string' && user.idCardDate.includes('/')
            ? user.idCardDate.split('/').reverse().join('-')
            : user.idCardDate)
          : '',
      })
    }
    setEditing(false)
    setError('')
  }

  const initials = user?.name?.charAt(0).toUpperCase() || '?'
  const avatarSrc = avatarPreview || user?.avatar || null

  const formatDisplayDate = (val: string) => {
    if (!val) return '---'
    if (val.includes('-')) {
      const [y, m, d] = val.split('-')
      return `${d}/${m}/${y}`
    }
    return val
  }

  return (
    <div className="sp-page">
      {/* Back button */}
      <button className="sp-back-btn" onClick={() => navigate(-1)}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5m7-7-7 7 7 7" /></svg>
        Quay lại
      </button>

      {/* Header */}
      <div className="sp-header">
        <h1 className="sp-header-title">Thông tin cá nhân</h1>
        <p className="sp-header-sub">Xem và cập nhật thông tin tài khoản của bạn để đảm bảo trải nghiệm tốt nhất.</p>
      </div>

      {/* Alerts */}
      {message && <div className="sp-alert sp-alert--success"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6 9 17l-5-5" /></svg> {message}</div>}
      {error && <div className="sp-alert sp-alert--error"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M15 9l-6 6M9 9l6 6" /></svg> {error}</div>}

      {/* Primary Profile Card */}
      <div className="sp-hero-card">
        <div className="sp-hero-bg-decor" />
        <div className="sp-hero-avatar" onClick={() => fileInputRef.current?.click()}>
          {avatarSrc ? (
            <img src={avatarSrc} alt="Avatar" className="sp-hero-avatar-img" />
          ) : (
            <div className="sp-hero-avatar-letter">{initials}</div>
          )}
          <div className="sp-hero-avatar-overlay">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg>
          </div>
          {uploadingAvatar && <div className="sp-hero-avatar-spinner" />}
        </div>
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarChange} style={{ display: 'none' }} />
        <div className="sp-hero-info">
          <div className="sp-hero-name-row">
            <h2 className="sp-hero-name">{editing ? form.name : (user?.name || 'Người dùng')}</h2>
            {user?.isEmailVerified ? (
              <svg className="sp-hero-verified" width="20" height="20" viewBox="0 0 24 24" fill="#16a34a">
                <title>Email đã xác thực</title>
                <path d="M12 1 3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z" />
              </svg>
            ) : (
              <svg className="sp-hero-verified" width="20" height="20" viewBox="0 0 24 24" fill="#d97706">
                <title>Email chưa xác thực</title>
                <path d="M12 1 3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z" />
                <text x="12" y="15" textAnchor="middle" fill="#fff" fontSize="14" fontWeight="bold">!</text>
              </svg>
            )}
          </div>
          <p className="sp-hero-role">{user?.email || '---'}</p>
          <div className="sp-hero-actions">
            {!editing ? (
              <button className="sp-btn sp-btn--primary" onClick={() => setEditing(true)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /></svg>
                Chỉnh sửa hồ sơ
              </button>
            ) : (
              <div className="sp-hero-edit-actions">
                <button className="sp-btn sp-btn--ghost" onClick={handleCancel} disabled={loading}>Hủy</button>
                <button className="sp-btn sp-btn--primary" onClick={handleSave} disabled={loading}>
                  {loading ? 'Đang lưu...' : 'Lưu thay đổi'}
                </button>
              </div>
            )}
            <div className={`sp-hero-verified-badge ${user?.isEmailVerified ? '' : 'sp-hero-verified-badge--unverified'}`}>
              {user?.isEmailVerified ? (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="#16a34a"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" /></svg>
                  <span>Email đã xác thực</span>
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="#d97706">
                    <path d="M12 1 3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z" />
                    <text x="12" y="15" textAnchor="middle" fill="#fff" fontSize="13" fontWeight="bold">!</text>
                  </svg>
                  <span>Email chưa xác thực</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Grid 2 columns */}
      <div className="sp-grid">
        {/* General Information */}
        <div className="sp-card">
          <div className="sp-card-header">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2"><circle cx="12" cy="8" r="4" /><path d="M20 21a8 8 0 1 0-16 0" /></svg>
            <h3>Thông tin chung</h3>
          </div>
          <div className="sp-card-body">
            <div className="sp-field">
              <span className="sp-field-label">Họ và tên</span>
              {editing ? (
                <input type="text" value={form.name} onChange={e => handleChange('name', e.target.value)} className="sp-input" placeholder="Nhập họ và tên" />
              ) : (
                <span className="sp-field-value">{form.name || '---'}</span>
              )}
            </div>
            <div className="sp-field-divider" />
            <div className="sp-field">
              <span className="sp-field-label">Ngày sinh</span>
              {editing ? (
                <input type="date" value={form.dob} onChange={e => handleChange('dob', e.target.value)} className="sp-input" />
              ) : (
                <span className="sp-field-value">{formatDisplayDate(form.dob)}</span>
              )}
            </div>
            <div className="sp-field-divider" />
            <div className="sp-field">
              <span className="sp-field-label">Giới tính</span>
              {editing ? (
                <select value={form.gender} onChange={e => handleChange('gender', e.target.value)} className="sp-input">
                  <option value="">-- Chọn --</option>
                  <option value="Nam">Nam</option>
                  <option value="Nữ">Nữ</option>
                  <option value="Khác">Khác</option>
                </select>
              ) : (
                <span className="sp-field-value">{form.gender || '---'}</span>
              )}
            </div>
            <div className="sp-field-divider" />
            <div className="sp-field">
              <span className="sp-field-label">Nghề nghiệp</span>
              {editing ? (
                <input type="text" value={form.occupation} onChange={e => handleChange('occupation', e.target.value)} className="sp-input" placeholder="Nhập nghề nghiệp" />
              ) : (
                <span className="sp-field-value">{form.occupation || '---'}</span>
              )}
            </div>
          </div>
        </div>

        {/* Contact Information */}
        <div className="sp-card">
          <div className="sp-card-header">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
            <h3>Thông tin liên lạc</h3>
          </div>
          <div className="sp-card-body">
            <div className="sp-field">
              <span className="sp-field-label">Email</span>
              <span className="sp-field-value">{user?.email || '---'}</span>
            </div>
            <div className="sp-field-divider" />
            <div className="sp-field">
              <span className="sp-field-label">Số điện thoại</span>
              {editing ? (
                <input type="text" value={form.phone} onChange={e => handleChange('phone', e.target.value)} className="sp-input" placeholder="Nhập số điện thoại" />
              ) : (
                <span className="sp-field-value">{form.phone || '---'}</span>
              )}
            </div>
            <div className="sp-field-divider" />
            <div className="sp-field">
              <span className="sp-field-label">Địa chỉ thường trú</span>
              {editing ? (
                <input type="text" value={form.address} onChange={e => handleChange('address', e.target.value)} className="sp-input" placeholder="Nhập địa chỉ thường trú" />
              ) : (
                <span className="sp-field-value sp-field-value--long">{form.address || '---'}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Identity Information - Full Width */}
      <div className="sp-card">
        <div className="sp-card-header">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="2" /><path d="M12 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM16 17a4 4 0 0 0-8 0" /></svg>
          <h3>Định danh cá nhân</h3>
        </div>
        <div className="sp-card-body">
          <div className="sp-id-grid">
            <div className="sp-field">
              <span className="sp-field-label">Số CCCD/CMND</span>
              {editing ? (
                <input type="text" value={form.idCard} onChange={e => handleChange('idCard', e.target.value)} className="sp-input" placeholder="Nhập số CCCD/CMND" />
              ) : (
                <span className="sp-field-value">{form.idCard || '---'}</span>
              )}
            </div>
            <div className="sp-field">
              <span className="sp-field-label">Ngày cấp</span>
              {editing ? (
                <input type="date" value={form.idCardDate} onChange={e => handleChange('idCardDate', e.target.value)} className="sp-input" />
              ) : (
                <span className="sp-field-value">{formatDisplayDate(form.idCardDate)}</span>
              )}
            </div>
          </div>
          <div className="sp-notice">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="#2563eb"><path d="M12 1 3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10c.83 0 1.5.67 1.5 1.5S12.83 14 12 14s-1.5-.67-1.5-1.5S11.17 11 12 11zm0-5c.83 0 1.5.67 1.5 1.5v2c0 .83-.67 1.5-1.5 1.5s-1.5-.67-1.5-1.5v-2c0-.83.67-1.5 1.5-1.5z" /></svg>
            <p>Thông tin định danh này được sử dụng để xác thực các yêu cầu hỗ trợ quan trọng và bảo mật tài khoản. Vui lòng cập nhật nếu có thay đổi.</p>
          </div>
        </div>
      </div>
    </div>
  )
}