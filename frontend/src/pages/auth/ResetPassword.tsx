import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import api, { getApiErrorMessage } from '../../api/axios.ts'
import { MIN_PASSWORD_LENGTH } from '../../constants/auth.ts'

export default function ResetPassword() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Mật khẩu phải có ít nhất ${MIN_PASSWORD_LENGTH} ký tự.`)
      return
    }
    if (password !== confirmPassword) {
      setError('Mật khẩu xác nhận không khớp.')
      return
    }
    if (!token) {
      setError('Link không hợp lệ.')
      return
    }

    setLoading(true)
    try {
      await api.post('/auth/reset-password', { token, newPassword: password })
      navigate('/login', {
        state: { message: 'Đổi mật khẩu thành công, vui lòng đăng nhập.' },
      })
    } catch (err) {
      setError(getApiErrorMessage(err).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card design-auth-card">
        <div className="auth-header design-auth-header">
          <Link to="/" className="brand auth-brand serif-title">Phòng Trọ DTT</Link>
          <h1>Đặt lại mật khẩu</h1>
          <p>Nhập mật khẩu mới cho tài khoản của bạn.</p>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit} className="auth-form design-form">
          <div className="form-group">
            <label htmlFor="reset-password">MẬT KHẨU MỚI</label>
            <input
              id="reset-password"
              type="password"
              className="form-input gray-input"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="new-password"
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="reset-confirm">XÁC NHẬN MẬT KHẨU</label>
            <input
              id="reset-confirm"
              type="password"
              className="form-input gray-input"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              required
            />
          </div>
          <button
            type="submit"
            className="button button-primary btn-full design-btn"
            disabled={loading}
          >
            {loading ? 'ĐANG XỬ LÝ...' : 'ĐỔI MẬT KHẨU →'}
          </button>
        </form>

        <p className="auth-footer-text">
          <Link to="/login" className="auth-link">← Quay lại đăng nhập</Link>
        </p>
      </div>
      <div className="auth-visual" />
    </div>
  )
}
