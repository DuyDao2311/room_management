import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext.tsx'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) { setError('Vui lòng nhập đầy đủ thông tin.'); return }
    setError('')
    setLoading(true)
    try {
      const loggedInUser = await login(email, password)
      if (loggedInUser.role === 'admin') {
        navigate('/admin')
      } else {
        navigate('/')
      }
    } catch {
      setError('Email hoặc mật khẩu không đúng. Vui lòng thử lại.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card design-auth-card">
        <div className="auth-header design-auth-header">
          <Link to="/" className="brand auth-brand serif-title">Phòng Trọ DTT</Link>
          <h1>Đăng nhập hệ thống</h1>
          <p>Mừng bạn trở lại với hệ sinh thái quản lý phòng trọ hiện đại.</p>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit} className="auth-form design-form" id="login-form">
          <div className="form-group">
            <label htmlFor="login-email">EMAIL</label>
            <input
              id="login-email"
              type="email"
              className="form-input gray-input"
              placeholder="example@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>
          <div className="form-group">
            <label htmlFor="login-password">MẬT KHẨU</label>
            <input
              id="login-password"
              type="password"
              className="form-input gray-input"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          <button
            type="submit"
            className="button button-primary btn-full design-btn"
            id="login-submit"
            disabled={loading}
          >
            {loading ? 'ĐANG XỬ LÝ...' : 'ĐĂNG NHẬP →'}
          </button>
        </form>

        <p className="auth-footer-text">
          Chưa có tài khoản? <Link to="/register" className="auth-link">Đăng ký ngay</Link>
        </p>
      </div>
      <div className="auth-visual" />
    </div>
  )
}
