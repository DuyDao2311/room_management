import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext.tsx'
import type { Session } from '../../api/security.ts'
import {
  changePassword,
  sendVerificationEmail,
  getSessions,
  logoutSession,
} from '../../api/security.ts'
import { getApiErrorMessage } from '../../api/axios.ts'

export default function Security() {
  const navigate = useNavigate()
  const { user, refreshUser } = useAuth()

  // ── Password state ──
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [changingPassword, setChangingPassword] = useState(false)
  const [passwordMessage, setPasswordMessage] = useState('')
  const [passwordError, setPasswordError] = useState('')

  // ── Sessions state ──
  const [sessions, setSessions] = useState<Session[]>([])
  const [loadingSessions, setLoadingSessions] = useState(true)
  const [loggingOutId, setLoggingOutId] = useState<string | null>(null)

  // ── Email verification state ──
  const [sendingVerification, setSendingVerification] = useState(false)
  const [verificationMessage, setVerificationMessage] = useState('')
  const [verificationError, setVerificationError] = useState('')

  const [searchParams] = useSearchParams()

  // ── Handle verified=true redirect ──
  useEffect(() => {
    const verified = searchParams.get('verified')
    if (verified === 'true') {
      setVerificationMessage('✅ Email của bạn đã được xác minh thành công!')
      // Cập nhật user real-time
      refreshUser()
      // Xoá query param khỏi URL
      window.history.replaceState({}, '', '/profile/security')
    }
  }, [searchParams])

  // ── Load sessions ──
  useEffect(() => {
    loadSessions()
  }, [])

  const loadSessions = async () => {
    setLoadingSessions(true)
    try {
      const data = await getSessions()
      setSessions(data)
    } catch {
      // silent
    } finally {
      setLoadingSessions(false)
    }
  }

  // ── Change password handler ──
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordMessage('')
    setPasswordError('')

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError('Vui lòng nhập đầy đủ thông tin.')
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Mật khẩu xác nhận không khớp.')
      return
    }

    setChangingPassword(true)
    try {
      const result = await changePassword({
        currentPassword,
        newPassword,
        confirmPassword,
      })
      setPasswordMessage(result.message)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err: any) {
      const { message } = getApiErrorMessage(err)
      setPasswordError(message)
    } finally {
      setChangingPassword(false)
    }
  }

  // ── Send verification email ──
  const handleSendVerification = async () => {
    setVerificationMessage('')
    setVerificationError('')
    setSendingVerification(true)
    try {
      const result = await sendVerificationEmail()
      setVerificationMessage(result.message)
    } catch (err: any) {
      const { message } = getApiErrorMessage(err)
      setVerificationError(message)
    } finally {
      setSendingVerification(false)
    }
  }

  // ── Logout session ──
  const handleLogoutSession = async (sessionId: string) => {
    setLoggingOutId(sessionId)
    try {
      const result = await logoutSession(sessionId)
      setSessions(prev => prev.filter(s => s.id !== sessionId))
      alert(result.message)
    } catch (err: any) {
      const { message } = getApiErrorMessage(err)
      alert(message)
    } finally {
      setLoggingOutId(null)
    }
  }

  const currentEmail = user?.email || '---'

  return (
    <div className="sc-page">
      {/* Back button */}
      <button className="sc-back-btn" onClick={() => navigate(-1)}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 12H5m7-7-7 7 7 7"/>
        </svg>
        Quay lại
      </button>

      {/* Header */}
      <div className="sc-header">
        <h1 className="sc-header-title">Tài khoản & Bảo mật</h1>
        <p className="sc-header-sub">Quản lý thông tin đăng nhập và các thiết lập bảo mật cho tài khoản của bạn.</p>
      </div>

      {/* 2-column layout */}
      <div className="sc-grid">
        {/* Left column — Main Settings */}
        <div className="sc-main">
          {/* Change Password Section */}
          <div className="sc-card">
            <div className="sc-card-header">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              <h3>Đổi mật khẩu</h3>
            </div>
            <div className="sc-card-body">
              <p className="sc-card-desc">Nên sử dụng mật khẩu mạnh bao gồm chữ cái, số và ký tự đặc biệt.</p>

              {passwordMessage && (
                <div style={{
                  background: '#dcfce7', color: '#16a34a', padding: '12px 16px',
                  borderRadius: '8px', fontSize: '14px', fontWeight: 600, marginBottom: '16px',
                  border: '1px solid #bbf7d0',
                }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 8, verticalAlign: 'middle' }}>
                    <path d="M20 6 9 17l-5-5"/>
                  </svg>
                  {passwordMessage}
                </div>
              )}

              {passwordError && (
                <div style={{
                  background: '#fee2e2', color: '#dc2626', padding: '12px 16px',
                  borderRadius: '8px', fontSize: '14px', fontWeight: 500, marginBottom: '16px',
                  border: '1px solid #fecaca',
                }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 8, verticalAlign: 'middle' }}>
                    <circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/>
                  </svg>
                  {passwordError}
                </div>
              )}

              <form onSubmit={handleSubmit}>
                <div className="sc-form-group">
                  <label className="sc-label">Mật khẩu hiện tại</label>
                  <div className="sc-password-wrap">
                    <input
                      type={showCurrent ? 'text' : 'password'}
                      className="sc-input"
                      placeholder="••••••••"
                      value={currentPassword}
                      onChange={e => setCurrentPassword(e.target.value)}
                    />
                    <button type="button" className="sc-eye-btn" onClick={() => setShowCurrent(!showCurrent)}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        {showCurrent ? (
                          <>
                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                            <line x1="1" y1="1" x2="23" y2="23"/>
                          </>
                        ) : (
                          <>
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                            <circle cx="12" cy="12" r="3"/>
                          </>
                        )}
                      </svg>
                    </button>
                  </div>
                </div>

                <div className="sc-form-row">
                  <div className="sc-form-group">
                    <label className="sc-label">Mật khẩu mới</label>
                    <div className="sc-password-wrap">
                      <input
                        type={showNew ? 'text' : 'password'}
                        className="sc-input"
                        placeholder="••••••••"
                        value={newPassword}
                        onChange={e => setNewPassword(e.target.value)}
                      />
                      <button type="button" className="sc-eye-btn" onClick={() => setShowNew(!showNew)}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          {showNew ? (
                            <>
                              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                              <line x1="1" y1="1" x2="23" y2="23"/>
                            </>
                          ) : (
                            <>
                              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                              <circle cx="12" cy="12" r="3"/>
                            </>
                          )}
                        </svg>
                      </button>
                    </div>
                  </div>
                  <div className="sc-form-group">
                    <label className="sc-label">Xác nhận mật khẩu mới</label>
                    <div className="sc-password-wrap">
                      <input
                        type={showConfirm ? 'text' : 'password'}
                        className="sc-input"
                        placeholder="••••••••"
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
                      />
                      <button type="button" className="sc-eye-btn" onClick={() => setShowConfirm(!showConfirm)}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          {showConfirm ? (
                            <>
                              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                              <line x1="1" y1="1" x2="23" y2="23"/>
                            </>
                          ) : (
                            <>
                              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                              <circle cx="12" cy="12" r="3"/>
                            </>
                          )}
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>

                <div className="sc-form-actions">
                  <button type="submit" className="sc-btn sc-btn--primary" disabled={changingPassword}>
                    {changingPassword ? 'Đang xử lý...' : 'Cập nhật mật khẩu'}
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Login Sessions Section */}
          <div className="sc-card">
            <div className="sc-card-header">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="4" y="2" width="16" height="20" rx="2" ry="2"/>
                <line x1="12" y1="18" x2="12.01" y2="18"/>
              </svg>
              <h3>Thiết bị đang đăng nhập</h3>
            </div>
            <div className="sc-card-body">
              <p className="sc-card-desc">Các phiên đăng nhập đang hoạt động của bạn.</p>

              {loadingSessions ? (
                <div style={{ textAlign: 'center', padding: '24px', color: '#9ca3af' }}>
                  <div className="pmt-spinner" style={{ margin: '0 auto 12px' }} />
                  <span style={{ fontSize: '14px' }}>Đang tải...</span>
                </div>
              ) : (
                <div className="sc-session-list">
                  {sessions.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '24px', color: '#9ca3af', fontSize: '14px' }}>
                      Không có thiết bị nào đang đăng nhập.
                    </div>
                  ) : sessions.map(session => (
                    <div key={session.id} className="sc-session-item">
                      <div className={`sc-session-icon ${session.isCurrent ? '' : 'sc-session-icon--muted'}`}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          {session.device?.toLowerCase().includes('iphone') || session.device?.toLowerCase().includes('mobile') ? (
                            <rect x="5" y="2" width="14" height="20" rx="2" ry="2"/>
                          ) : (
                            <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
                          )}
                        </svg>
                      </div>
                      <div className="sc-session-info">
                        <span className="sc-session-name">{session.device} • {session.browser}</span>
                        <span className="sc-session-location">{session.location} • {session.lastActive}</span>
                      </div>
                      {session.isCurrent ? (
                        <span className="sc-session-badge">Hiện tại</span>
                      ) : (
                        <button
                          className="sc-session-logout"
                          onClick={() => handleLogoutSession(session.id)}
                          disabled={loggingOutId === session.id}
                        >
                          {loggingOutId === session.id ? 'Đang xử lý...' : 'Đăng xuất'}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right column — Sidebar */}
        <aside className="sc-sidebar">
          {/* Email Verification */}
          <div className="sc-card">
            <div className="sc-card-header">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                <polyline points="22,6 12,13 2,6"/>
              </svg>
              <h3>Xác minh Email</h3>
            </div>
            <div className="sc-card-body">
              <div className="sc-verify-row">
                <span className="sc-verify-label">Trạng thái</span>
                <span className={`sc-verify-status ${user?.isEmailVerified ? 'sc-verify-status--verified' : 'sc-verify-status--pending'}`}>
                  {user?.isEmailVerified ? 'ĐÃ XÁC MINH' : 'CHƯA XÁC MINH'}
                </span>
              </div>
              <div className="sc-email-box">
                <span className="sc-email-label">Địa chỉ hiện tại</span>
                <span className="sc-email-value">{currentEmail}</span>
              </div>

              {verificationMessage && (
                <div style={{
                  background: '#dcfce7', color: '#16a34a', padding: '10px 14px',
                  borderRadius: '8px', fontSize: '13px', fontWeight: 600, marginBottom: '12px',
                  border: '1px solid #bbf7d0',
                }}>
                  {verificationMessage}
                </div>
              )}

              {verificationError && (
                <div style={{
                  background: '#fee2e2', color: '#dc2626', padding: '10px 14px',
                  borderRadius: '8px', fontSize: '13px', fontWeight: 500, marginBottom: '12px',
                  border: '1px solid #fecaca',
                }}>
                  {verificationError}
                </div>
              )}

              <button
                className="sc-btn sc-btn--primary sc-btn--full"
                onClick={handleSendVerification}
                disabled={sendingVerification}
              >
                {sendingVerification ? 'Đang gửi...' : 'Gửi mã xác minh'}
              </button>
            </div>
          </div>

          {/* Security Tips */}
          <div className="sc-tips-card">
            <div className="sc-tips-header">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
              </svg>
              <span>Mẹo bảo mật</span>
            </div>
            <ul className="sc-tips-list">
              <li>Không bao giờ chia sẻ mật khẩu của bạn với bất kỳ ai, kể cả nhân viên hỗ trợ.</li>
              <li>Hãy đăng xuất khỏi tài khoản trên các thiết bị công cộng sau khi sử dụng.</li>
              <li>Thay đổi mật khẩu theo chu kỳ.</li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  )
}