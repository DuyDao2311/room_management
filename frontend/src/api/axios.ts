import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: { 'Content-Type': 'application/json' },
})

// Tự động đính kèm JWT token vào mỗi request
api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Xử lý 401: tự động logout nếu token hết hạn
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      sessionStorage.removeItem('token')
      sessionStorage.removeItem('user')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  },
)

// Trích `{ status, message }` từ AxiosError. Dùng cho UI hiển thị lỗi
// thân thiện thay vì đoán shape `err.response.data.message` mỗi nơi.
export function getApiErrorMessage(
  err: unknown,
  fallback = 'Có lỗi xảy ra. Vui lòng thử lại.',
): { status?: number; message: string } {
  const e = err as {
    response?: { status?: number; data?: { message?: string } }
  }
  return {
    status: e?.response?.status,
    message: e?.response?.data?.message || fallback,
  }
}

export default api
