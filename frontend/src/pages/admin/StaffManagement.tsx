import { useState, useEffect } from 'react'
import api from '../../api/axios.ts'
import Spinner from '../../components/ui/Spinner.tsx'
import { FiUserCheck, FiMapPin, FiUserPlus, FiShield, FiSearch } from 'react-icons/fi'

interface StaffUser {
  _id: string
  name: string
  email: string
  phone?: string
  role: string
  managedDistricts: string[]
  isActive: boolean
  createdAt: string
}

interface TenantUser {
  _id: string
  name: string
  email: string
  role: string
}

export default function StaffManagement() {
  const [staffList, setStaffList] = useState<StaffUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // District modal
  const [showDistrictModal, setShowDistrictModal] = useState(false)
  const [selectedStaff, setSelectedStaff] = useState<StaffUser | null>(null)
  const [districts, setDistricts] = useState<string[]>([])
  const [selectedDistricts, setSelectedDistricts] = useState<string[]>([])
  const [savingDistricts, setSavingDistricts] = useState(false)

  // Add staff modal
  const [showAddModal, setShowAddModal] = useState(false)
  const [tenants, setTenants] = useState<TenantUser[]>([])
  const [tenantsLoading, setTenantsLoading] = useState(false)
  const [searchTenant, setSearchTenant] = useState('')

  // ─── Fetch Data ────────────────────────────────────────────────────────
  const fetchStaff = async () => {
    try {
      setLoading(true)
      const { data } = await api.get('/admin/staff')
      setStaffList(data)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Lỗi tải danh sách nhân viên.')
    } finally {
      setLoading(false)
    }
  }

  const fetchDistricts = async () => {
    try {
      const { data } = await api.get('/admin/districts')
      setDistricts(data)
    } catch {
      // Silent fail — districts sẽ rỗng
    }
  }

  const fetchTenants = async () => {
    try {
      setTenantsLoading(true)
      const { data } = await api.get('/admin/tenants')
      setTenants(data)
    } catch {
      // Silent fail
    } finally {
      setTenantsLoading(false)
    }
  }

  useEffect(() => {
    fetchStaff()
    fetchDistricts()
  }, [])

  // ─── Handlers ──────────────────────────────────────────────────────────

  // Mở modal setup districts
  const openDistrictModal = (staff: StaffUser) => {
    setSelectedStaff(staff)
    setSelectedDistricts([...staff.managedDistricts])
    setShowDistrictModal(true)
  }

  // Toggle district checkbox
  const toggleDistrict = (district: string) => {
    setSelectedDistricts(prev =>
      prev.includes(district)
        ? prev.filter(d => d !== district)
        : [...prev, district]
    )
  }

  // Lưu districts
  const saveDistricts = async () => {
    if (!selectedStaff) return
    setSavingDistricts(true)
    try {
      const { data } = await api.put(`/admin/users/${selectedStaff._id}/districts`, {
        managedDistricts: selectedDistricts,
      })
      setStaffList(prev =>
        prev.map(s => s._id === selectedStaff._id ? { ...s, managedDistricts: data.managedDistricts } : s)
      )
      setShowDistrictModal(false)
    } catch (err: any) {
      alert(err.response?.data?.message || 'Không thể cập nhật khu vực.')
    } finally {
      setSavingDistricts(false)
    }
  }

  // Thêm nhân viên (tenant → staff)
  const promoteToStaff = async (userId: string) => {
    try {
      await api.put(`/admin/users/${userId}/role`, { role: 'staff' })
      setShowAddModal(false)
      setSearchTenant('')
      fetchStaff()
    } catch (err: any) {
      alert(err.response?.data?.message || 'Không thể chuyển vai trò.')
    }
  }

  // Thu hồi quyền staff (staff → tenant)
  const revokeStaff = async (userId: string, userName: string) => {
    if (!confirm(`Bạn có chắc chắn muốn thu hồi quyền nhân viên của "${userName}"?\nKhu vực quản lý sẽ bị xóa.`)) return
    try {
      await api.put(`/admin/users/${userId}/role`, { role: 'tenant' })
      fetchStaff()
    } catch (err: any) {
      alert(err.response?.data?.message || 'Không thể thu hồi quyền.')
    }
  }

  // Mở modal thêm nhân viên
  const openAddModal = () => {
    setShowAddModal(true)
    setSearchTenant('')
    fetchTenants()
  }

  // Filter tenants theo search
  const filteredTenants = tenants.filter(t =>
    t.name.toLowerCase().includes(searchTenant.toLowerCase()) ||
    t.email.toLowerCase().includes(searchTenant.toLowerCase())
  )

  // ─── Render ────────────────────────────────────────────────────────────
  return (
    <div className="page-shell">
      <div className="admin-page">
        {/* Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
          paddingBottom: '20px', borderBottom: '1px solid #eaecf0', marginBottom: '24px'
        }}>
          <div>
            <h1 style={{ color: '#003e68', fontSize: '1.5rem', fontWeight: 800, margin: '0 0 6px 0', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <FiUserCheck size={26} /> Quản lý nhân viên
            </h1>
            <p style={{ color: '#667085', margin: 0, fontSize: '0.9rem' }}>
              Phân công khu vực quản lý cho nhân viên.
            </p>
          </div>
          <button onClick={openAddModal} className="button button-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <FiUserPlus size={18} /> Thêm nhân viên
          </button>
        </div>

        {error && <div className="alert alert-error" style={{ marginBottom: '16px' }}>{error}</div>}

        {/* Stats Row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
          <div style={{
            background: 'white', padding: '20px 24px', borderRadius: '12px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.03)', borderLeft: '4px solid #003e68',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center'
          }}>
            <div>
              <p style={{ margin: 0, fontSize: '0.75rem', color: '#667085', fontWeight: 700, textTransform: 'uppercase' }}>Tổng nhân viên</p>
              <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#003e68' }}>{staffList.length}</span>
            </div>
            <FiUserCheck size={26} color="#003e68" />
          </div>
          <div style={{
            background: 'white', padding: '20px 24px', borderRadius: '12px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.03)', borderLeft: '4px solid #088373',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center'
          }}>
            <div>
              <p style={{ margin: 0, fontSize: '0.75rem', color: '#667085', fontWeight: 700, textTransform: 'uppercase' }}>Đã phân khu vực</p>
              <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#088373' }}>
                {staffList.filter(s => s.managedDistricts.length > 0).length}
              </span>
            </div>
            <FiMapPin size={26} color="#088373" />
          </div>
          <div style={{
            background: 'white', padding: '20px 24px', borderRadius: '12px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.03)', borderLeft: '4px solid #f79009',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center'
          }}>
            <div>
              <p style={{ margin: 0, fontSize: '0.75rem', color: '#667085', fontWeight: 700, textTransform: 'uppercase' }}>Chưa phân khu vực</p>
              <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#f79009' }}>
                {staffList.filter(s => s.managedDistricts.length === 0).length}
              </span>
            </div>
            <FiShield size={26} color="#f79009" />
          </div>
        </div>

        {/* Staff List */}
        {loading ? <Spinner /> : staffList.length === 0 ? (
          <div style={{
            padding: '48px', textAlign: 'center', color: '#667085',
            background: 'white', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
          }}>
            <FiUserCheck size={48} color="#d0d5dd" style={{ marginBottom: '12px' }} />
            <p style={{ margin: 0, fontWeight: 600 }}>Chưa có nhân viên nào.</p>
            <p style={{ margin: '6px 0 0', fontSize: '0.85rem' }}>Nhấn "Thêm nhân viên" để bắt đầu phân công.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {staffList.map(staff => (
              <div key={staff._id} style={{
                display: 'flex', alignItems: 'center', background: 'white',
                padding: '20px 24px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                transition: 'box-shadow 0.2s',
              }}>
                {/* Avatar */}
                <div style={{
                  width: '48px', height: '48px', borderRadius: '50%',
                  background: 'linear-gradient(135deg, #003e68, #0066a4)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'white', fontWeight: 800, fontSize: '1.1rem',
                  marginRight: '16px', flexShrink: 0,
                }}>
                  {staff.name.charAt(0).toUpperCase()}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontWeight: 700, color: '#101828', fontSize: '1rem' }}>{staff.name}</span>
                    <span style={{
                      background: '#e6f4ff', color: '#003e68', padding: '2px 10px',
                      borderRadius: '12px', fontSize: '0.7rem', fontWeight: 700,
                    }}>
                      STAFF
                    </span>
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#667085', marginTop: '2px' }}>
                    {staff.email}{staff.phone ? ` • ${staff.phone}` : ''}
                  </div>
                </div>

                {/* Districts */}
                <div style={{ width: '300px', display: 'flex', flexWrap: 'wrap', gap: '4px', justifyContent: 'flex-end' }}>
                  {staff.managedDistricts.length === 0 ? (
                    <span style={{
                      color: '#f79009', fontSize: '0.8rem', fontWeight: 600,
                      fontStyle: 'italic',
                    }}>
                      Chưa phân khu vực
                    </span>
                  ) : (
                    staff.managedDistricts.map(d => (
                      <span key={d} style={{
                        background: '#ecfdf3', color: '#088373', padding: '4px 10px',
                        borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600,
                      }}>
                        📍 {d}
                      </span>
                    ))
                  )}
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: '8px', marginLeft: '20px', flexShrink: 0 }}>
                  <button
                    onClick={() => openDistrictModal(staff)}
                    title="Phân khu vực"
                    style={{
                      background: '#e6f4ff', color: '#003e68', border: 'none',
                      padding: '8px 14px', borderRadius: '8px', cursor: 'pointer',
                      fontWeight: 700, fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px',
                      transition: 'background 0.2s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#cce5ff')}
                    onMouseLeave={e => (e.currentTarget.style.background = '#e6f4ff')}
                  >
                    <FiMapPin size={14} /> Phân khu vực
                  </button>
                  <button
                    onClick={() => revokeStaff(staff._id, staff.name)}
                    title="Thu hồi quyền"
                    style={{
                      background: '#fff1f0', color: '#d92d20', border: 'none',
                      padding: '8px 14px', borderRadius: '8px', cursor: 'pointer',
                      fontWeight: 700, fontSize: '0.8rem',
                      transition: 'background 0.2s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#ffe0de')}
                    onMouseLeave={e => (e.currentTarget.style.background = '#fff1f0')}
                  >
                    Thu hồi
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* Modal: Setup Districts                                             */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {showDistrictModal && selectedStaff && (
          <div className="modal-overlay" onClick={() => setShowDistrictModal(false)}>
            <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
              <div className="modal-header">
                <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FiMapPin /> Phân khu vực — {selectedStaff.name}
                </h2>
                <button className="modal-close" onClick={() => setShowDistrictModal(false)}>✕</button>
              </div>

              <div style={{ padding: '24px' }}>
                <p style={{ color: '#667085', fontSize: '0.85rem', margin: '0 0 20px' }}>
                  Chọn các khu vực mà nhân viên này được phép quản lý:
                </p>

                {districts.length === 0 ? (
                  <div style={{ textAlign: 'center', color: '#667085', padding: '20px' }}>
                    Chưa có khu vực nào trong hệ thống.<br />
                    Hãy tạo phòng với thông tin quận/huyện trước.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {districts.map(d => {
                      const checked = selectedDistricts.includes(d)
                      return (
                        <label
                          key={d}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '12px',
                            padding: '12px 16px', borderRadius: '10px', cursor: 'pointer',
                            border: checked ? '2px solid #003e68' : '2px solid #eaecf0',
                            background: checked ? '#f0f7ff' : '#fafafa',
                            transition: 'all 0.2s ease',
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleDistrict(d)}
                            style={{
                              width: '18px', height: '18px', accentColor: '#003e68',
                              cursor: 'pointer',
                            }}
                          />
                          <span style={{
                            fontWeight: checked ? 700 : 500,
                            color: checked ? '#003e68' : '#475467',
                            fontSize: '0.95rem',
                          }}>
                            📍 {d}
                          </span>
                        </label>
                      )
                    })}
                  </div>
                )}

                {/* Selected count */}
                <div style={{
                  marginTop: '16px', padding: '10px 14px', borderRadius: '8px',
                  background: '#f0f2f5', fontSize: '0.8rem', color: '#475467', fontWeight: 600,
                }}>
                  Đã chọn: {selectedDistricts.length} / {districts.length} khu vực
                </div>
              </div>

              <div className="modal-actions" style={{ padding: '16px 24px', borderTop: '1px solid #eaecf0' }}>
                <button className="button button-secondary" onClick={() => setShowDistrictModal(false)}>Hủy</button>
                <button className="button button-primary" onClick={saveDistricts} disabled={savingDistricts}>
                  {savingDistricts ? 'Đang lưu...' : 'Lưu khu vực'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* Modal: Thêm nhân viên (chọn từ danh sách tenant)                   */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {showAddModal && (
          <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
            <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '520px' }}>
              <div className="modal-header">
                <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FiUserPlus /> Thêm nhân viên mới
                </h2>
                <button className="modal-close" onClick={() => setShowAddModal(false)}>✕</button>
              </div>

              <div style={{ padding: '24px' }}>
                <p style={{ color: '#667085', fontSize: '0.85rem', margin: '0 0 16px' }}>
                  Chọn tài khoản người thuê để chuyển thành nhân viên:
                </p>

                {/* Search */}
                <div style={{ position: 'relative', marginBottom: '16px' }}>
                  <FiSearch style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#98a2b3' }} size={18} />
                  <input
                    type="text"
                    placeholder="Tìm theo tên hoặc email..."
                    value={searchTenant}
                    onChange={e => setSearchTenant(e.target.value)}
                    className="form-input"
                    style={{ paddingLeft: '38px' }}
                  />
                </div>

                {/* List */}
                <div style={{ maxHeight: '360px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {tenantsLoading ? <Spinner /> : filteredTenants.length === 0 ? (
                    <div style={{ textAlign: 'center', color: '#667085', padding: '20px', fontSize: '0.85rem' }}>
                      {searchTenant ? 'Không tìm thấy kết quả.' : 'Không còn người thuê nào để thêm.'}
                    </div>
                  ) : (
                    filteredTenants.map(t => (
                      <div key={t._id} style={{
                        display: 'flex', alignItems: 'center', padding: '12px 14px',
                        borderRadius: '10px', border: '1px solid #eaecf0',
                        transition: 'border-color 0.2s, background 0.2s',
                      }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = '#003e68'; e.currentTarget.style.background = '#f9fbff' }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = '#eaecf0'; e.currentTarget.style.background = 'white' }}
                      >
                        <div style={{
                          width: '36px', height: '36px', borderRadius: '50%',
                          background: '#e6f4ff', color: '#003e68',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontWeight: 800, fontSize: '0.85rem', marginRight: '12px',
                        }}>
                          {t.name.charAt(0).toUpperCase()}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, color: '#101828', fontSize: '0.9rem' }}>{t.name}</div>
                          <div style={{ fontSize: '0.8rem', color: '#667085' }}>{t.email}</div>
                        </div>
                        <button
                          onClick={() => promoteToStaff(t._id)}
                          style={{
                            background: '#003e68', color: 'white', border: 'none',
                            padding: '6px 14px', borderRadius: '6px', cursor: 'pointer',
                            fontWeight: 700, fontSize: '0.8rem', flexShrink: 0,
                            transition: 'background 0.2s',
                          }}
                          onMouseEnter={e => (e.currentTarget.style.background = '#002d4d')}
                          onMouseLeave={e => (e.currentTarget.style.background = '#003e68')}
                        >
                          Thêm
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="modal-actions" style={{ padding: '16px 24px', borderTop: '1px solid #eaecf0' }}>
                <button className="button button-secondary" onClick={() => setShowAddModal(false)}>Đóng</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
