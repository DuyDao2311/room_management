import { useState, useEffect } from 'react'
import api from '../../api/axios.ts'
import Spinner from '../../components/ui/Spinner.tsx'
import { useAuth } from '../../contexts/AuthContext.tsx'
import { Trash2 } from "lucide-react"

interface User {
  _id: string
  name: string
  email: string
  role: string
  createdAt?: string
}

export default function UserManagement() {
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    try {
      const { data } = await api.get('/admin/users')
      setUsers(data)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Lỗi tải dữ liệu người dùng.')
    } finally {
      setLoading(false)
    }
  }

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      await api.put(`/admin/users/${userId}/role`, { role: newRole })
      setUsers(prev => prev.map(u => u._id === userId ? { ...u, role: newRole } : u))
    } catch (err: any) {
      alert(err.response?.data?.message || 'Không thể cập nhật vai trò, vui lòng thử lại sau.')
    }
  }

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <h1>Quản lý Người dùng</h1>
          <p>Danh sách tài khoản trên hệ thống.</p>
        </div>
        <button className="button button-primary">
          + Thêm người dùng
        </button>
      </div>

      {error && <div className="alert alert-error mb-4">{error}</div>}

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Họ tên</th>
              <th>Email</th>
              <th>Vai trò</th>
              <th>Ngày tạo</th>
              <th>Hành động</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="table-empty">
                  <Spinner />
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={5} className="table-empty">
                  Chưa có dữ liệu người dùng.
                </td>
              </tr>
            ) : (
              users.map(u => (
                <tr key={u._id}>
                  <td className="td-name">{u.name}</td>
                  <td className="td-muted">{u.email}</td>
                  <td>
                    <select
                      className={`form-input status-badge ${u.role === 'admin' ? 'status-active' : 'status-completed'}`}
                      style={{ padding: '4px 8px', fontSize: '0.8rem', outline: 'none', border: '1px solid transparent', cursor: 'pointer' }}
                      value={u.role}
                      onChange={(e) => handleRoleChange(u._id, e.target.value)}
                      disabled={currentUser?._id === u._id}
                      title={currentUser?._id === u._id ? 'Không thể tự đổi quyền của bản thân' : 'Đổi vai trò'}
                    >
                      <option value="tenant">Khách thuê</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                  <td className="td-sm td-muted">
                    {u.createdAt ? new Date(u.createdAt).toLocaleDateString('vi-VN') : '---'}
                  </td>
                  <td className="td-actions">
                    <button className="action-btn delete-btn" title="Xóa" disabled={u.role === 'admin'}><Trash2 size={18} color="#d92d20" /></button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
