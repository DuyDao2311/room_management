import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import api from '../../api/axios.ts'

export default function VerifyEmail() {
  const { token } = useParams<{ token: string }>()

  useEffect(() => {
    if (!token) {
      window.location.href = '/profile/security?verified=false'
      return
    }

    const verify = async () => {
      try {
        const res = await api.get(`/auth/verify-email/${token}`)
        // Backend trả về token + user → lưu vào sessionStorage
        if (res.data?.token) {
          sessionStorage.setItem('token', res.data.token)
          sessionStorage.setItem('user', JSON.stringify(res.data.user))
        }
      } catch {
        // API lỗi (token đã bị xoá), thử kiểm tra xem email đã verified chưa
        const savedToken = sessionStorage.getItem('token')
        if (savedToken) {
          try {
            const meRes = await api.get('/auth/me')
            if (meRes.data?.isEmailVerified) {
              // Email đã verified → redirect bình thường
            }
          } catch {
            // silent
          }
        }
      }
      // redirect đến profile/security với query param
      window.location.href = '/profile/security?verified=true'
    }

    verify()
  }, [token])

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 24,
      padding: 40,
      background: '#f4f7fa',
      fontFamily: "'Inter', system-ui, sans-serif",
    }}>
      <div style={{
        background: '#fff',
        borderRadius: 16,
        padding: 48,
        maxWidth: 460,
        width: '100%',
        textAlign: 'center',
        boxShadow: '0 8px 32px rgba(0,0,0,0.06)',
      }}>
        <div style={{
          width: 48, height: 48,
          border: '4px solid #e2e8f0',
          borderTopColor: '#0f5cc7',
          borderRadius: '50%',
          animation: 'spin 0.7s linear infinite',
          margin: '0 auto 24px',
        }} />
        <h2 style={{ margin: '0 0 8px', fontSize: 20, color: '#1a2332' }}>Đang xác minh...</h2>
        <p style={{ margin: 0, fontSize: 14, color: '#5a5f62' }}>Vui lòng đợi trong giây lát.</p>
      </div>
    </div>
  )
}