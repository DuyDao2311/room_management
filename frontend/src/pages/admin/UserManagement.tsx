import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import api from '../../api/axios.ts'
import Spinner from '../../components/ui/Spinner.tsx'
import { useAuth } from '../../contexts/AuthContext.tsx'
import { Trash2, UserPlus, X, MessageCircle } from "lucide-react"
import Pagination from '../../components/ui/Pagination.tsx'
import ZaloContactModal from '../../components/contact/ZaloContactModal.tsx'

interface User {
  _id: string
  name: string
  email: string
  role: string
  createdAt?: string
  phone?: string
  avatar?: string
}

export default function UserManagement() {
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Add User Modal State
  const [showModal, setShowModal] = useState(false)

  // Zalo Contact Modal State
  const [showContactModal, setShowContactModal] = useState(false)
  const [contactUser, setContactUser] = useState<User | null>(null)
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'tenant' })
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  const [currentPage, setCurrentPage] = useState(1)
  const ITEMS_PER_PAGE = 9
  
  const [searchParams, setSearchParams] = useSearchParams()
  const [highlightId, setHighlightId] = useState<string | null>(null)

  useEffect(() => {
    fetchUsers()
  }, [])

  useEffect(() => {
    const id = searchParams.get('highlight');
    if (id && users.length > 0) {
      const idx = users.findIndex(u => u._id === id);
      if (idx !== -1) {
        setCurrentPage(Math.ceil((idx + 1) / ITEMS_PER_PAGE));
        setHighlightId(id);
        setTimeout(() => setHighlightId(null), 3000);
      }
      searchParams.delete('highlight');
      setSearchParams(searchParams, { replace: true });
    }
  }, [users, searchParams, setSearchParams]);

  const fetchUsers = async () => {
    try {
      const { data } = await api.get('/admin/users')
      setUsers(data)
      setCurrentPage(1)
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

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')
    setSaving(true)
    try {
      const { data } = await api.post('/admin/users', form)
      setUsers(prev => [data, ...prev])
      setShowModal(false)
      setForm({ name: '', email: '', password: '', role: 'tenant' })
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Lỗi khi tạo người dùng.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (userId: string, userName: string) => {
    if (window.confirm(`Bạn có chắc chắn muốn xóa người dùng "${userName}" không?\nHành động này không thể hoàn tác.`)) {
      try {
        await api.delete(`/admin/users/${userId}`)
        setUsers(prev => prev.filter(u => u._id !== userId))
      } catch (err: any) {
        alert(err.response?.data?.message || 'Lỗi khi xóa người dùng.')
      }
    }
  }

  const totalPages = Math.ceil(users.length / ITEMS_PER_PAGE)
  const currentUsers = users.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <h1>Quản lý Người dùng</h1>
          <p>Danh sách tài khoản trên hệ thống.</p>
        </div>
        <button
          className="button button-primary"
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          onClick={() => {
            setForm({ name: '', email: '', password: '', role: 'tenant' })
            setFormError('')
            setShowModal(true)
          }}
        >
          <UserPlus size={18} /> Thêm người dùng
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
              currentUsers.map(u => (
                <tr key={u._id} style={highlightId === u._id ? { backgroundColor: '#fef08a', transition: 'background-color 0.5s ease' } : { transition: 'background-color 0.5s ease' }}>
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
                      <option value="staff">Nhân viên</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                  <td className="td-sm td-muted">
                    {u.createdAt ? new Date(u.createdAt).toLocaleDateString('vi-VN') : '---'}
                  </td>
                  <td className="td-actions">
                    <button
                      className="action-btn"
                      title="Liên hệ Zalo"
                      onClick={() => {
                        setContactUser(u)
                        setShowContactModal(true)
                      }}
                    >
                      <MessageCircle size={18} color="#0068ff" />
                    </button>
                    <button
                      className="action-btn delete-btn"
                      title="Xóa"
                      disabled={u.role === 'admin'}
                      onClick={() => handleDelete(u._id, u.name)}
                    >
                      <Trash2 size={18} color={u.role === 'admin' ? "#ccc" : "#d92d20"} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {!loading && totalPages > 1 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
        />
      )}

      {/* Modal Thêm người dùng */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <UserPlus size={20} /> Thêm tài khoản mới
              </h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreateUser} className="modal-form">
              {formError && (
                <div className="alert alert-error" style={{ marginBottom: '16px' }}>
                  {formError}
                </div>
              )}

              <div className="form-group">
                <label htmlFor="user-name">Họ và tên</label>
                <input
                  id="user-name"
                  className="form-input"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  required
                  placeholder="Nguyễn Văn A"
                />
              </div>

              <div className="form-group">
                <label htmlFor="user-email">Email</label>
                <input
                  id="user-email"
                  type="email"
                  className="form-input"
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  required
                  placeholder="example@gmail.com"
                />
              </div>

              <div className="form-group">
                <label htmlFor="user-password">Mật khẩu</label>
                <input
                  id="user-password"
                  type="password"
                  className="form-input"
                  value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                  required
                  placeholder="••••••••"
                  minLength={6}
                />
              </div>

              <div className="form-group">
                <label htmlFor="user-role">Vai trò</label>
                <select
                  id="user-role"
                  className="form-input"
                  value={form.role}
                  onChange={e => setForm({ ...form, role: e.target.value })}
                >
                  <option value="tenant">Khách thuê</option>
                  <option value="staff">Nhân viên</option>
                  <option value="admin">Admin</option>
                </select>
                {form.role === 'staff' && (
                  <p style={{ fontSize: '0.8rem', color: '#667085', marginTop: '6px' }}>
                    * Sau khi tạo, hãy vào mục <strong>Quản lý nhân viên</strong> để phân khu vực.
                  </p>
                )}
              </div>

              <div className="modal-actions" style={{ marginTop: '24px' }}>
                <button type="button" className="button button-secondary" onClick={() => setShowModal(false)}>Hủy</button>
                <button type="submit" className="button button-primary" disabled={saving}>
                  {saving ? 'Đang tạo...' : 'Tạo tài khoản'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Zalo Contact Modal */}
      {contactUser && (
        <ZaloContactModal
          open={showContactModal}
          onClose={() => setShowContactModal(false)}
          customer={{ 
            fullName: contactUser.name, 
            phone: contactUser.phone || '', 
            avatar: contactUser.avatar 
          }}
        />
      )}
    </div>
  )
}
