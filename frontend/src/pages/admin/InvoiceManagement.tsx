import { useState, useEffect } from 'react'
import api from '../../api/axios.ts'
import Spinner from '../../components/ui/Spinner.tsx'
import Badge from '../../components/ui/Badge.tsx'
import { FiInfo, FiZap, FiTrash2, FiPlus, FiCheck } from 'react-icons/fi'
import { MdOutlineWaterDrop, MdReceiptLong, MdHouse } from 'react-icons/md'
import SendInvoiceButton from '../../components/ui/SendInvoiceButton.tsx'
import { collectCashPayment } from '../../api/payment.ts'

// ─── Interfaces ───────────────────────────────────────────────────────────────
interface Invoice {
  _id: string
  contract: string
  type: 'deposit' | 'service'
  representativeName: string
  roomName: string
  rentAmount: number
  totalAmount: number
  month?: number
  year?: number
  status: 'unpaid' | 'pending' | 'paid' | 'overdue'
  dueDate?: string
  sentAt?: string
  createdAt: string
  paymentMethod?: string
  electricity?: { oldReading: number, newReading: number, rate: number, usage: number, total: number }
  water?: { oldReading: number, newReading: number, rate: number, usage: number, total: number }
  extraFees?: { name: string, amount: number }[]
  notes?: string
}

interface ContractOption {
  _id: string
  representativeName?: string
  tenant?: { name: string }
  room?: { name: string; price: number }
  monthlyRent: number
  status: string
}

interface ExtraFee {
  id: number
  name: string
  amount: string
}

// ─── Maps ─────────────────────────────────────────────────────────────────────
const STATUS_MAP: Record<string, { label: string; variant: 'success' | 'warning' | 'danger' | 'info' | 'neutral' }> = {
  paid: { label: 'Đã thanh toán', variant: 'success' },
  unpaid: { label: 'Chưa thanh toán', variant: 'warning' },
  pending: { label: 'Chờ thu tiền', variant: 'info' },
  overdue: { label: 'Quá hạn', variant: 'danger' },
}

const TYPE_MAP = {
  deposit: { label: 'Đặt cọc', color: '#7c3aed', bg: '#ede9fe' },
  service: { label: 'Dịch vụ/tháng', color: '#0369a1', bg: '#e0f2fe' },
}

// ─── Default Form State ───────────────────────────────────────────────────────
const getDefaultForm = () => ({
  type: 'service',
  contractId: '',
  month: new Date().getMonth() + 1,
  year: new Date().getFullYear(),
  elecOld: '', elecNew: '', elecRate: '3500',
  waterOld: '', waterNew: '', waterRate: '25000',
  extraFees: [] as ExtraFee[],
  dueDate: '',
  notes: '',
})

export default function InvoiceManagement() {
  const [view, setView] = useState<'list' | 'create' | 'edit'>('list')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isSent, setIsSent] = useState(false)
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [contracts, setContracts] = useState<ContractOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [formError, setFormError] = useState('')

  const [form, setForm] = useState(getDefaultForm())

  // ─── Fetch ──────────────────────────────────────────────────────────────────
  const fetchInvoices = () => {
    setLoading(true)
    api.get('/invoices/all')
      .then(r => setInvoices(r.data))
      .catch(() => setError('Không thể tải danh sách hóa đơn.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchInvoices()
    api.get('/contracts')
      .then(r => setContracts(r.data.filter((c: ContractOption) => c.status === 'active')))
      .catch(() => { })
  }, [])

  const handleCashPayment = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!window.confirm('Xác nhận đã thu tiền mặt cho hóa đơn này?')) return

    setConfirmingId(id)
    try {
      await collectCashPayment(id, 'Thu tiền mặt trực tiếp')
      setInvoices(prev => prev.map(inv => inv._id === id ? { ...inv, status: 'paid' } : inv))
      alert('Đã xác nhận thu tiền mặt thành công.')
    } catch (err: any) {
      alert(err.message || 'Lỗi: Không thể xác nhận thanh toán.')
    } finally {
      setConfirmingId(null)
    }
  }

  const selectedContract = contracts.find(c => c._id === form.contractId)

  // ─── Dynamic calculations ───────────────────────────────────────────────────
  const rentCost = selectedContract?.monthlyRent || 0

  const eUsage = Math.max(0, Number(form.elecNew) - Number(form.elecOld))
  const eCost = eUsage * Number(form.elecRate || 0)

  const wUsage = Math.max(0, Number(form.waterNew) - Number(form.waterOld))
  const wCost = wUsage * Number(form.waterRate || 0)

  const extraCost = form.extraFees.reduce((sum, f) => sum + Number(f.amount || 0), 0)

  const totalCost = rentCost + eCost + wCost + extraCost

  // ─── Handlers ───────────────────────────────────────────────────────────────
  const sf = (field: string, val: any) => setForm(prev => ({ ...prev, [field]: val }))

  const handleAddFee = () => {
    setForm(prev => ({
      ...prev,
      extraFees: [...prev.extraFees, { id: Date.now(), name: '', amount: '' }]
    }))
  }

  const handleUpdateFee = (id: number, field: 'name' | 'amount', val: string) => {
    setForm(prev => ({
      ...prev,
      extraFees: prev.extraFees.map(f => f.id === id ? { ...f, [field]: val } : f)
    }))
  }

  const handleRemoveFee = (id: number) => {
    setForm(prev => ({
      ...prev,
      extraFees: prev.extraFees.filter(f => f.id !== id)
    }))
  }

  const handleRowClick = (inv: Invoice) => {
    setEditingId(inv._id)
    setIsSent(!!inv.sentAt)
    setForm({
      type: inv.type,
      contractId: inv.contract,
      month: inv.month || new Date().getMonth() + 1,
      year: inv.year || new Date().getFullYear(),
      elecOld: inv.electricity?.oldReading?.toString() || '',
      elecNew: inv.electricity?.newReading?.toString() || '',
      elecRate: inv.electricity?.rate?.toString() || '3500',
      waterOld: inv.water?.oldReading?.toString() || '',
      waterNew: inv.water?.newReading?.toString() || '',
      waterRate: inv.water?.rate?.toString() || '25000',
      extraFees: (inv.extraFees || []).map((f, i) => ({ id: i, name: f.name, amount: f.amount.toString() })),
      dueDate: inv.dueDate ? new Date(inv.dueDate).toISOString().split('T')[0] : '',
      notes: inv.notes || '',
    })
    setFormError('')
    setView('edit')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')
    if (!form.contractId) { setFormError('Vui lòng chọn hợp đồng.'); return }
    if (form.type === 'service') {
      if (!form.elecOld || !form.elecNew) { setFormError('Vui lòng nhập đầy đủ chỉ số điện.'); return }
      if (!form.waterOld || !form.waterNew) { setFormError('Vui lòng nhập đầy đủ chỉ số nước.'); return }
    }

    setSaving(true)
    try {
      if (view === 'edit' && editingId) {
        if (form.type === 'deposit') {
          await api.put(`/invoices/${editingId}`, {
            dueDate: form.dueDate || undefined,
            notes: form.notes,
          })
        } else if (form.type === 'service') {
          const extraFees = form.extraFees.filter(f => f.name && f.amount).map(f => ({ name: f.name, amount: Number(f.amount) }))
          await api.put(`/invoices/${editingId}`, {
            month: form.month,
            year: form.year,
            electricity: { oldReading: Number(form.elecOld), newReading: Number(form.elecNew), rate: Number(form.elecRate) },
            water: { oldReading: Number(form.waterOld), newReading: Number(form.waterNew), rate: Number(form.waterRate) },
            extraFees,
            dueDate: form.dueDate || undefined,
            notes: form.notes,
          })
        }
      } else {
        if (form.type === 'deposit') {
          await api.post('/invoices/deposit', {
            contractId: form.contractId,
            dueDate: form.dueDate || undefined,
            notes: form.notes,
          })
        } else if (form.type === 'service') {
          const extraFees = form.extraFees.filter(f => f.name && f.amount).map(f => ({ name: f.name, amount: Number(f.amount) }))
          await api.post('/invoices/service', {
            contractId: form.contractId,
            month: form.month,
            year: form.year,
            electricity: { oldReading: Number(form.elecOld), newReading: Number(form.elecNew), rate: Number(form.elecRate) },
            water: { oldReading: Number(form.waterOld), newReading: Number(form.waterNew), rate: Number(form.waterRate) },
            extraFees,
            dueDate: form.dueDate || undefined,
            notes: form.notes,
          })
        }
      }

      setForm(getDefaultForm())
      setEditingId(null)
      setView('list')
      fetchInvoices()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        ?? 'Tạo hóa đơn thất bại.'
      setFormError(msg)
    } finally {
      setSaving(false)
    }
  }

  // ─── View: Danh sách ────────────────────────────────────────────────────────
  if (view === 'list') {
    return (
      <div className="page-shell">
        <div className="admin-page">
          <div className="admin-page-header">
            <div>
              <h1>Quản lý hóa đơn</h1>
              <p>Theo dõi hóa đơn đặt cọc và dịch vụ hàng tháng</p>
            </div>
            <button
              onClick={() => { setForm(getDefaultForm()); setFormError(''); setView('create') }}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                background: '#003e68', color: '#fff',
                padding: '10px 20px', borderRadius: '8px',
                border: 'none', fontWeight: 700, fontSize: '0.9rem',
                cursor: 'pointer', whiteSpace: 'nowrap',
              }}
            >
              <FiPlus /> Tạo hóa đơn mới
            </button>
          </div>

          {error && <div className="alert alert-error">{error}</div>}

          {loading ? <Spinner /> : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Mã hóa đơn</th>
                    <th>Khách thuê / Phòng</th>
                    <th>Loại HĐ</th>
                    <th>Số tiền</th>
                    <th>Ngày xuất</th>
                    <th>Hạn thanh toán</th>
                    <th>Trạng thái</th>
                    <th>Hành động</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.length === 0 ? (
                    <tr><td colSpan={8} className="table-empty">Chưa có hóa đơn nào.</td></tr>
                  ) : invoices.map(inv => (
                    <tr key={inv._id} onClick={() => handleRowClick(inv)} style={{ cursor: 'pointer' }} className="hover:bg-gray-50">
                      <td>
                        <span style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: '#6b7280' }}>
                          #{inv._id.slice(-8).toUpperCase()}
                        </span>
                        {inv.month && inv.year &&
                          <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>T{inv.month}/{inv.year}</div>
                        }
                      </td>
                      <td>
                        <div className="td-stack">
                          <span style={{ fontWeight: 700, color: '#101828' }}>{inv.representativeName || '—'}</span>
                          <span className="td-muted td-sm">{inv.roomName || '—'}</span>
                        </div>
                      </td>
                      <td>
                        <span style={{
                          background: TYPE_MAP[inv.type]?.bg,
                          color: TYPE_MAP[inv.type]?.color,
                          padding: '3px 10px', borderRadius: '999px',
                          fontSize: '0.78rem', fontWeight: 700,
                        }}>
                          {TYPE_MAP[inv.type]?.label || inv.type}
                        </span>
                      </td>
                      <td className="td-price">{inv.totalAmount?.toLocaleString('vi-VN')}đ</td>
                      <td>{new Date(inv.createdAt).toLocaleDateString('vi-VN')}</td>
                      <td>
                        {inv.dueDate
                          ? <span style={{ color: inv.status === 'overdue' ? '#dc2626' : '#374151' }}>
                            {new Date(inv.dueDate).toLocaleDateString('vi-VN')}
                          </span>
                          : '—'
                        }
                      </td>
                      <td><Badge label={STATUS_MAP[inv.status]?.label || inv.status} variant={STATUS_MAP[inv.status]?.variant || 'neutral'} /></td>
                      <td className="td-actions" onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                          {!inv.sentAt && (
                            <SendInvoiceButton invoiceId={inv._id} onSent={fetchInvoices} />
                          )}
                          {inv.sentAt && (
                            <span style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 600 }}>Đã gửi ✓</span>
                          )}
                          {inv.status === 'pending' && (
                            <button 
                              className="action-btn" 
                              style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#088373', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600, cursor: confirmingId === inv._id ? 'not-allowed' : 'pointer', opacity: confirmingId === inv._id ? 0.7 : 1 }}
                              onClick={(e) => handleCashPayment(inv._id, e)}
                              disabled={confirmingId === inv._id}
                            >
                              {confirmingId === inv._id ? <Spinner size="sm" /> : <FiCheck />}
                              Thu tiền
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ─── View: Tạo / Sửa hóa đơn ───────────────────────────────────────────────
  return (
    <div className="invoice-create-container">
      <div className="invoice-header">
        <div>
          <h1 className="invoice-title">{view === 'edit' ? 'Chi tiết hóa đơn' : 'Tạo hóa đơn'}</h1>
          <p className="invoice-subtitle">{view === 'edit' && isSent ? 'Hóa đơn đã gửi, không thể chỉnh sửa.' : 'Hóa đơn dịch vụ hàng tháng hoặc tiền cọc.'}</p>
        </div>
        <button
          type="button"
          onClick={() => setView('list')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: '#e5e7eb',
            color: '#003e68',
            border: 'none',
            padding: '8px 16px',
            borderRadius: '4px',
            fontWeight: 600,
            fontSize: '0.9rem',
            cursor: 'pointer'
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
          Quay lại danh sách
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        <fieldset disabled={isSent} style={{ border: 'none', padding: 0, margin: 0 }}>
          {formError && <div className="alert alert-error" style={{ marginBottom: 24 }}>{formError}</div>}

          {/* SECTION: THÔNG TIN CƠ BẢN */}
          <div className="invoice-section">
            <div className="invoice-section-title"><FiInfo size={20} /> Thông tin cơ bản</div>

            <div style={{ display: 'flex', gap: '24px' }}>
              <div className="invoice-input-group" style={{ flex: 1 }}>
                <label className="invoice-input-label">Loại hóa đơn</label>
                <select className="form-input" style={{ width: '100%' }} value={form.type} onChange={e => sf('type', e.target.value)} disabled={view === 'edit'}>
                  <option value="service">Hóa đơn dịch vụ (Hàng tháng)</option>
                  <option value="deposit">Tiền cọc</option>
                </select>
              </div>
              <div className="invoice-input-group" style={{ flex: 2 }}>
                <label className="invoice-input-label">Chọn hợp đồng</label>
                <select className="form-input" style={{ width: '100%' }} value={form.contractId} onChange={e => sf('contractId', e.target.value)} required disabled={view === 'edit'}>
                  <option value="">— Tìm kiếm & chọn hợp đồng —</option>
                  {contracts.map(c => (
                    <option key={c._id} value={c._id}>HĐ: {c.representativeName || c.tenant?.name} - {c.room?.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {selectedContract && (
              <div className="invoice-info-box">
                <div className="invoice-info-col" style={{ flex: 1 }}>
                  <span className="invoice-info-label">Người đại diện</span>
                  <span className="invoice-info-val">{selectedContract.representativeName || selectedContract.tenant?.name || '—'}</span>
                </div>
                <div className="invoice-info-col" style={{ flex: 1 }}>
                  <span className="invoice-info-label">Phòng</span>
                  <span className="invoice-info-val">{selectedContract.room?.name || '—'}</span>
                </div>
                <div className="invoice-info-col" style={{ flex: 1 }}>
                  <span className="invoice-info-label">Giá thuê/tháng</span>
                  <span className="invoice-info-val" style={{ color: '#0f5cc7' }}>{selectedContract.monthlyRent?.toLocaleString('vi-VN')} đ</span>
                </div>
              </div>
            )}
          </div>

          {/* SECTION: CHI TIẾT — đổi theo loại HĐ */}
          {form.type === 'deposit' ? (
            <div className="invoice-section">
              <div className="invoice-section-title"><MdReceiptLong size={20} /> Chi tiết tiền cọc</div>

              <div style={{ background: '#f9fafb', borderRadius: 8, padding: '18px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, border: '1px solid #e5e7eb' }}>
                <span style={{ color: '#374151', fontWeight: 500 }}>Tiền phòng tháng đầu tiên</span>
                <span style={{ fontWeight: 700, color: '#111827', fontSize: '1.05rem' }}>{rentCost.toLocaleString('vi-VN')} đ</span>
              </div>
              <div style={{ background: '#f9fafb', borderRadius: 8, padding: '18px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, border: '1px solid #e5e7eb' }}>
                <span style={{ color: '#374151', fontWeight: 500 }}>Tiền cọc (1 tháng tiền phòng)</span>
                <span style={{ fontWeight: 700, color: '#111827', fontSize: '1.05rem' }}>{rentCost.toLocaleString('vi-VN')} đ</span>
              </div>

              <div className="form-group" style={{ maxWidth: 280 }}>
                <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#374151', marginBottom: 8, display: 'block' }}>Hạn thanh toán</label>
                <input className="form-input" type="date" value={form.dueDate} onChange={e => sf('dueDate', e.target.value)} />
              </div>

              <div className="invoice-summary" style={{ marginTop: 24 }}>
                <div>
                  <div className="invoice-total-label">Tổng tiền</div>
                  <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: 4 }}>Bao gồm tiền phòng và tiền cọc</div>
                </div>
                <div className="invoice-total-val">{(rentCost * 2).toLocaleString('vi-VN')} đ</div>
              </div>
            </div>
          ) : (
            <div className="invoice-section">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div className="invoice-section-title" style={{ margin: 0 }}><FiZap size={20} /> Chi tiết dịch vụ</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '0.85rem', color: '#6b7280', fontWeight: 600 }}>Kỳ thanh toán:</span>
                  <select className="form-input" style={{ padding: '6px 12px', width: '110px' }} value={form.month} onChange={e => sf('month', Number(e.target.value))}>
                    {Array.from({ length: 12 }).map((_, i) => <option key={i + 1} value={i + 1}>Tháng {i + 1}</option>)}
                  </select>
                  <input className="form-input" type="number" style={{ padding: '6px 12px', width: '80px', textAlign: 'center' }} value={form.year} onChange={e => sf('year', Number(e.target.value))} />
                </div>
              </div>

              {/* Tiền phòng */}
              <div className="invoice-row row-rent">
                <div className="invoice-icon-box"><MdHouse /></div>
                <div style={{ flex: 1 }}>
                  <div className="invoice-row-title">Tiền thuê phòng</div>
                  <div className="invoice-row-desc">Cố định theo hợp đồng</div>
                </div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#111827' }}>{rentCost.toLocaleString('vi-VN')} đ</div>
              </div>

              {/* Điện */}
              <div className="invoice-row row-elec">
                <div className="invoice-icon-box" style={{ color: '#f59e0b' }}><FiZap /></div>
                <div style={{ width: '180px' }}>
                  <div className="invoice-row-title">Điện</div>
                  <div className="invoice-row-desc">
                    <input className="invoice-input" style={{ width: '60px', padding: '2px 4px', fontSize: '0.8rem', textAlign: 'left', border: 'none', background: 'transparent', borderBottom: '1px dashed #ccc', borderRadius: 0 }} value={form.elecRate} onChange={e => sf('elecRate', e.target.value)} /> đ / kWh
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flex: 1 }}>
                  <div className="invoice-input-group"><label className="invoice-input-label">Chỉ số cũ</label><input className="invoice-input" type="number" min={0} value={form.elecOld} onChange={e => sf('elecOld', e.target.value)} required /></div>
                  <span style={{ color: '#9ca3af', marginTop: '20px' }}>-</span>
                  <div className="invoice-input-group"><label className="invoice-input-label">Chỉ số mới</label><input className="invoice-input" type="number" min={0} value={form.elecNew} onChange={e => sf('elecNew', e.target.value)} required /></div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', width: '120px' }}><span className="invoice-input-label">Sử dụng</span><span style={{ fontSize: '1rem', fontWeight: 600, color: '#111827' }}>{eUsage} kWh</span></div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', width: '150px' }}><span className="invoice-input-label">Thành tiền</span><span style={{ fontSize: '1.1rem', fontWeight: 700, color: '#111827' }}>{eCost.toLocaleString('vi-VN')} đ</span></div>
              </div>

              {/* Nước */}
              <div className="invoice-row row-water">
                <div className="invoice-icon-box" style={{ color: '#3b82f6' }}><MdOutlineWaterDrop /></div>
                <div style={{ width: '180px' }}>
                  <div className="invoice-row-title">Nước</div>
                  <div className="invoice-row-desc">
                    <input className="invoice-input" style={{ width: '60px', padding: '2px 4px', fontSize: '0.8rem', textAlign: 'left', border: 'none', background: 'transparent', borderBottom: '1px dashed #ccc', borderRadius: 0 }} value={form.waterRate} onChange={e => sf('waterRate', e.target.value)} /> đ / khối
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flex: 1 }}>
                  <div className="invoice-input-group"><label className="invoice-input-label">Chỉ số cũ</label><input className="invoice-input" type="number" min={0} value={form.waterOld} onChange={e => sf('waterOld', e.target.value)} required /></div>
                  <span style={{ color: '#9ca3af', marginTop: '20px' }}>-</span>
                  <div className="invoice-input-group"><label className="invoice-input-label">Chỉ số mới</label><input className="invoice-input" type="number" min={0} value={form.waterNew} onChange={e => sf('waterNew', e.target.value)} required /></div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', width: '120px' }}><span className="invoice-input-label">Sử dụng</span><span style={{ fontSize: '1rem', fontWeight: 600, color: '#111827' }}>{wUsage} khối</span></div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', width: '150px' }}><span className="invoice-input-label">Thành tiền</span><span style={{ fontSize: '1.1rem', fontWeight: 700, color: '#111827' }}>{wCost.toLocaleString('vi-VN')} đ</span></div>
              </div>

              {/* Phí khác */}
              <div className="invoice-row row-other" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
                  <div className="invoice-icon-box" style={{ height: 36, width: 36, fontSize: '1rem' }}><MdReceiptLong /></div>
                  <div className="invoice-row-title" style={{ flex: 1 }}>Phí khác</div>
                </div>
                {form.extraFees.map(fee => (
                  <div key={fee.id} style={{ display: 'flex', gap: '12px', marginBottom: '12px', alignItems: 'center' }}>
                    <input className="invoice-input text-left" placeholder="Tên phí (vd: Phí quản lý)" value={fee.name} onChange={e => handleUpdateFee(fee.id, 'name', e.target.value)} required />
                    <input className="invoice-input" type="number" min={0} placeholder="Số tiền" value={fee.amount} onChange={e => handleUpdateFee(fee.id, 'amount', e.target.value)} required />
                    <span style={{ color: '#6b7280', fontSize: '0.9rem' }}>đ</span>
                    <button type="button" onClick={() => handleRemoveFee(fee.id)} style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', padding: '4px' }}><FiTrash2 size={18} /></button>
                  </div>
                ))}
                <button type="button" className="invoice-add-btn" onClick={handleAddFee}>+ Thêm phí</button>
              </div>

              {/* Hạn thanh toán */}
              <div className="form-group" style={{ maxWidth: 280, marginTop: 16, marginBottom: 16 }}>
                <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#374151', marginBottom: 8, display: 'block' }}>Hạn thanh toán</label>
                <input className="form-input" type="date" value={form.dueDate} onChange={e => sf('dueDate', e.target.value)} />
              </div>

              {/* Tổng kết dịch vụ */}
              <div className="invoice-summary" style={{ marginTop: 8 }}>
                <div className="invoice-summary-lines">
                  <div className="invoice-summary-line"><span>Tiền thuê phòng:</span><strong>{rentCost.toLocaleString('vi-VN')} đ</strong></div>
                  <div className="invoice-summary-line"><span>Điện &amp; Nước:</span><strong>{(eCost + wCost).toLocaleString('vi-VN')} đ</strong></div>
                  <div className="invoice-summary-line"><span>Phí khác:</span><strong>{extraCost.toLocaleString('vi-VN')} đ</strong></div>
                </div>
                <div className="invoice-total-box">
                  <div className="invoice-total-label">Tổng tiền</div>
                  <div className="invoice-total-val">{totalCost.toLocaleString('vi-VN')} đ</div>
                </div>
              </div>
            </div>
          )}

        </fieldset>

        <div className="invoice-actions">
          <button type="button" className="btn btn-ghost" onClick={() => setView('list')} disabled={saving}>Quay lại</button>
          {!isSent && (
            <button type="submit" className="btn-confirm" disabled={saving}>
              {saving ? 'Đang lưu...' : view === 'edit' ? 'Cập nhật hoá đơn' : 'Tạo hoá đơn'}
            </button>
          )}
        </div>
      </form>
    </div>
  )
}
