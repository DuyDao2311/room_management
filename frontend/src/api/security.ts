import api from './axios.ts'

export interface ChangePasswordData {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}

export interface ApiResult {
  success: boolean
  message: string
}

/**
 * Đổi mật khẩu
 */
export async function changePassword(data: ChangePasswordData): Promise<ApiResult> {
  const res = await api.put('/auth/change-password', data)
  return { success: true, message: res.data.message }
}

/**
 * Gửi mã xác minh email
 */
export async function sendVerificationEmail(): Promise<ApiResult> {
  const res = await api.post('/auth/send-verification')
  return { success: true, message: res.data.message }
}

/**
 * Lấy danh sách các thiết bị đang đăng nhập (sessions)
 */
export interface Session {
  id: string
  device: string
  browser: string
  location: string
  lastActive: string
  isCurrent: boolean
}

export async function getSessions(): Promise<Session[]> {
  const res = await api.get('/auth/sessions')
  return res.data.sessions || []
}

/**
 * Đăng xuất một thiết bị khỏi tài khoản
 */
export async function logoutSession(sessionId: string): Promise<ApiResult> {
  const res = await api.delete(`/auth/sessions/${sessionId}`)
  return { success: true, message: res.data.message }
}