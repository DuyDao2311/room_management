import { useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../../api/axios.ts'

type ResultState =
  | { kind: 'idle' }
  | { kind: 'success' }
  | { kind: 'not_found'; email: string }
  | { kind: 'error'; message: string }

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ResultState>({ kind: 'idle' })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) return
    setLoading(true)
    try {
      await api.post('/auth/forgot-password', { email })
      setResult({ kind: 'success' })
    } catch (err: unknown) {
      const errObj = err as {
        response?: { status?: number; data?: { message?: string } }
      }
      const status = errObj?.response?.status
      const msg = errObj?.response?.data?.message

      if (status === 404) {
        setResult({ kind: 'not_found', email })
      } else if (status === 429) {
        setResult({
          kind: 'error',
          message: msg || 'Bạn đã thử quá nhiều lần. Vui lòng đợi.',
        })
      } else {
        setResult({
          kind: 'error',
          message: msg || 'Có lỗi xảy ra. Vui lòng thử lại.',
        })
      }
    } finally {
      setLoading(false)
    }
  }

  const isSubmitted = result.kind !== 'idle'

  let title = 'Quên mật khẩu'
  let subtitle = 'Nhập email đã đăng ký để nhận link đặt lại mật khẩu.'
  if (result.kind === 'success') {
    title = 'Kiểm tra email của bạn'
    subtitle = 'Hãy kiểm tra email để đặt lại mật khẩu. Link có hiệu lực 15 phút.'
  } else if (result.kind === 'not_found') {
    title = 'Email chưa đăng ký'
    subtitle = `Email ${result.email} chưa được đăng ký trong hệ thống.`
  } else if (result.kind === 'error') {
    title = 'Có lỗi xảy ra'
    subtitle = result.message
  }

  return (
    <div className="auth-page">
      <div className="auth-card design-auth-card">
        <div className="auth-header design-auth-header">
          <Link to="/" className="brand auth-brand serif-title">Phòng Trọ DTT</Link>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>

        {!isSubmitted && (
          <form onSubmit={handleSubmit} className="auth-form design-form">
            <div className="form-group">
              <label htmlFor="forgot-email">EMAIL</label>
              <input
                id="forgot-email"
                type="email"
                className="form-input gray-input"
                placeholder="example@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoComplete="email"
                autoFocus
                required
              />
            </div>
            <button
              type="submit"
              className="button button-primary btn-full design-btn"
              disabled={loading}
            >
              {loading ? 'ĐANG XỬ LÝ...' : 'GỬI LINK RESET →'}
            </button>
          </form>
        )}

        {(result.kind === 'not_found' || result.kind === 'error') && (
          <button
            type="button"
            className="button button-primary btn-full design-btn"
            onClick={() => setResult({ kind: 'idle' })}
          >
            THỬ LẠI
          </button>
        )}

        <p className="auth-footer-text">
          <Link to="/login" className="auth-link">← Quay lại đăng nhập</Link>
        </p>
      </div>
      <div className="auth-visual" />
    </div>
  )
}
