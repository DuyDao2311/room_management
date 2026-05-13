import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext.tsx'

export default function Register() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [agree, setAgree] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name || !email || !password || !confirm) { setError('Vui lòng nhập đầy đủ thông tin.'); return }
    if (!agree) { setError('Vui lòng đồng ý với các Điều khoản & Điều kiện.'); return }
    if (password !== confirm) { setError('Mật khẩu xác nhận không khớp.'); return }
    if (password.length < 6) { setError('Mật khẩu phải có ít nhất 6 ký tự.'); return }
    setError('')
    setLoading(true)
    try {
      await register(name, email, password)
      navigate('/')
    } catch {
      setError('Email đã được sử dụng hoặc có lỗi xảy ra. Vui lòng thử lại.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card design-auth-card">
        <div className="auth-header design-auth-header">
          <Link to="/" className="brand auth-brand serif-title">Phòng Trọ DTT</Link>
          <h1>Đăng ký tài khoản</h1>
          <p>Gia nhập hệ sinh thái quản lý tài sản kiến trúc hiện đại ngay hôm nay.</p>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit} className="auth-form design-form" id="register-form">
          <div className="form-group">
            <label htmlFor="reg-name">HỌ VÀ TÊN</label>
            <input id="reg-name" type="text" className="form-input gray-input" placeholder="Nguyễn Văn A" value={name} onChange={e => setName(e.target.value)} />
          </div>

          <div className="form-group">
            <label htmlFor="reg-email">EMAIL</label>
            <input id="reg-email" type="email" className="form-input gray-input" placeholder="name@company.com" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="reg-password">MẬT KHẨU</label>
              <input id="reg-password" type="password" className="form-input gray-input" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" />
            </div>
            <div className="form-group">
              <label htmlFor="reg-confirm">XÁC NHẬN</label>
              <input id="reg-confirm" type="password" className="form-input gray-input" placeholder="••••••••" value={confirm} onChange={e => setConfirm(e.target.value)} autoComplete="new-password" />
            </div>
          </div>

          <div className="form-checkbox">
            <input type="checkbox" id="reg-agree" checked={agree} onChange={e => setAgree(e.target.checked)} />
            <label htmlFor="reg-agree">
              Tôi đồng ý với <strong className="green-text">Điều khoản & Điều kiện</strong> và chính sách bảo mật của hệ thống.
            </label>
          </div>

          <button type="submit" className="button button-primary btn-full design-btn" id="register-submit" disabled={loading}>
            {loading ? 'ĐANG TẠO...' : 'TẠO TÀI KHOẢN →'}
          </button>
        </form>

        <p className="auth-footer-text">
          Đã có tài khoản? <Link to="/login" className="auth-link">Đăng nhập</Link>
        </p>
      </div>
      <div className="auth-visual" />
    </div>
  )
}
