import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import api from '../api/axios.ts'

export interface User {
  _id: string
  name: string
  email: string
  role: 'admin' | 'staff' | 'tenant'
  managedDistricts?: string[]
}

interface AuthContextType {
  user: User | null
  token: string | null
  loading: boolean
  login: (email: string, password: string) => Promise<User>
  register: (name: string, email: string, password: string, role?: 'admin' | 'tenant') => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Khôi phục session từ sessionStorage khi app khởi động
  // (sessionStorage tự xóa khi đóng tab/cửa sổ, không giữ qua lần chạy mới)
  useEffect(() => {
    const savedToken = sessionStorage.getItem('token')
    const savedUser = sessionStorage.getItem('user')
    
    if (savedToken && savedUser) {
      setToken(savedToken)
      setUser(JSON.parse(savedUser)) // Set initial state for fast render
      
      // Fetch fresh data from server to ensure roles/districts are up-to-date
      api.get('/auth/me')
        .then(res => {
          setUser(res.data)
          sessionStorage.setItem('user', JSON.stringify(res.data))
        })
        .catch(() => {
          setToken(null)
          setUser(null)
          sessionStorage.removeItem('token')
          sessionStorage.removeItem('user')
        })
        .finally(() => {
          setLoading(false)
        })
    } else {
      setLoading(false)
    }
  }, [])

  const login = async (email: string, password: string) => {
    const { data } = await api.post('/auth/login', { email, password })
    setToken(data.token)
    setUser(data.user)
    sessionStorage.setItem('token', data.token)
    sessionStorage.setItem('user', JSON.stringify(data.user))
    return data.user as User
  }

  const register = async (name: string, email: string, password: string, role: 'admin' | 'tenant' = 'tenant') => {
    const { data } = await api.post('/auth/register', { name, email, password, role })
    setToken(data.token)
    setUser(data.user)
    sessionStorage.setItem('token', data.token)
    sessionStorage.setItem('user', JSON.stringify(data.user))
  }

  const logout = () => {
    setToken(null)
    setUser(null)
    sessionStorage.removeItem('token')
    sessionStorage.removeItem('user')
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
