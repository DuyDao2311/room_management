import { useState } from 'react'
import api from '../../api/axios.ts'

interface Contract {
  _id: string
  room: { _id: string; name: string; address: string; price: number; area: number; type: string }
  tenant: { _id: string; name: string; email: string }
  endDate: string
  monthlyRent: number
  depositAmount?: number
  extensionRequestedMonths?: number
}

interface Props {
  contract: Contract
  onClose: () => void
  onSuccess: () => void
}

export default function ExtendContractModal({ contract, onClose, onSuccess }: Props) {
  // Tính ngày bắt đầu mới = ngày kết thúc cũ + 1 ngày
  const oldEnd = new Date(contract.endDate)
  const newStart = new Date(oldEnd)
  newStart.setDate(newStart.getDate() + 1)

  // Tính ngày kết thúc mới dựa trên số tháng tenant yêu cầu
  const defaultMonths = contract.extensionRequestedMonths || 6
  const defaultEnd = new Date(newStart)
  defaultEnd.setMonth(defaultEnd.getMonth() + defaultMonths)

  const formatDateISO = (d: Date) => d.toISOString().split('T')[0]

  const [endDate, setEndDate] = useState(formatDateISO(defaultEnd))
  const [monthlyRent, setMonthlyRent] = useState(String(contract.monthlyRent))
  const [depositAmount, setDepositAmount] = useState(contract.depositAmount?.toString() || '0')
  const [notes, setNotes] = useState(`Gia hạn từ hợp đồng ${contract._id}`)
  const [loading, setLoading] = useState(false)
  const [isDateFocused, setIsDateFocused] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!endDate || !monthlyRent) {
      setError('Vui lòng nhập đầy đủ thông tin.')
      return
    }

    try {
      setLoading(true)
      setError('')
      await api.post(`/contracts/${contract._id}/extend`, {
        endDate,
        monthlyRent: parseFloat(monthlyRent),
        depositAmount: parseFloat(depositAmount) || 0,
        notes,
      })
      alert('Đã tạo hợp đồng gia hạn thành công! Đã gửi thông báo cho khách thuê.')
      onSuccess()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setError(msg || 'Không thể tạo hợp đồng gia hạn.')
    } finally {
      setLoading(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px 16px',
    borderRadius: '8px',
    border: '1px solid #d1d5db',
    fontSize: '0.9rem',
    fontFamily: 'inherit',
    outline: 'none',
    transition: 'border-color 0.2s',
  }

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '0.8rem',
    fontWeight: 700,
    color: '#374151',
    marginBottom: '6px',
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
  }

  return (
    <div
      className="rent-modal-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="rent-modal"
        style={{ maxWidth: '600px', borderRadius: '16px', overflow: 'hidden' }}
      >
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
          padding: '28px 32px',
          color: '#fff',
        }}>
          <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 800 }}>
            Gia hạn hợp đồng
          </h2>
          <p style={{ margin: '8px 0 0', fontSize: '0.85rem', opacity: 0.9 }}>
            Phòng {contract.room?.name} — {contract.tenant?.name}
          </p>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} style={{ padding: '28px 32px' }}>
          {error && (
            <div style={{
              background: '#fef2f2', color: '#991b1b', padding: '12px 16px',
              borderRadius: '8px', marginBottom: '20px', fontSize: '0.85rem', fontWeight: 600
            }}>
              ⚠️ {error}
            </div>
          )}

          {/* Thông tin read-only */}
          <div style={{
            background: '#f9fafb', borderRadius: '12px', padding: '20px',
            marginBottom: '24px', border: '1px solid #e5e7eb'
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <div style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: 600, marginBottom: '4px' }}>PHÒNG</div>
                <div style={{ fontWeight: 700, color: '#111827' }}>{contract.room?.name}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: 600, marginBottom: '4px' }}>KHÁCH THUÊ</div>
                <div style={{ fontWeight: 700, color: '#111827' }}>{contract.tenant?.name}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: 600, marginBottom: '4px' }}>NGÀY KẾT THÚC CŨ</div>
                <div style={{ fontWeight: 700, color: '#111827' }}>{new Date(contract.endDate).toLocaleDateString('vi-VN')}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: 600, marginBottom: '4px' }}>NGÀY BẮT ĐẦU MỚI</div>
                <div style={{ fontWeight: 700, color: '#059669' }}>{newStart.toLocaleDateString('vi-VN')}</div>
              </div>
            </div>
            {contract.extensionRequestedMonths && (
              <div style={{ marginTop: '12px', padding: '8px 12px', background: '#ecfdf5', borderRadius: '8px', fontSize: '0.85rem', color: '#065f46', fontWeight: 600 }}>
                📋 Khách thuê yêu cầu gia hạn {contract.extensionRequestedMonths} tháng
              </div>
            )}
          </div>

          {/* Form fields */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
            <div>
              <label style={labelStyle}>Ngày kết thúc mới</label>
              <input
                type={isDateFocused || endDate ? 'date' : 'text'}
                value={!isDateFocused && endDate ? endDate.split('-').reverse().join('/') : endDate}
                onFocus={() => setIsDateFocused(true)}
                onBlur={() => setIsDateFocused(false)}
                onChange={(e) => {
                  const val = e.target.value;
                  // Nếu input là text (khi chưa support date), có thể user gõ dd/mm/yyyy
                  if (val.includes('/')) {
                    const parts = val.split('/');
                    if (parts.length === 3) setEndDate(`${parts[2]}-${parts[1]}-${parts[0]}`);
                  } else {
                    setEndDate(val);
                  }
                }}
                style={inputStyle}
                placeholder="dd/mm/yyyy"
                required
              />
            </div>
            <div>
              <label style={labelStyle}>Giá thuê / tháng (VNĐ)</label>
              <input
                type="number"
                value={monthlyRent}
                onChange={(e) => setMonthlyRent(e.target.value)}
                style={inputStyle}
                min="0"
                required
              />
            </div>
            <div>
              <label style={labelStyle}>Tiền cọc (VNĐ)</label>
              <input
                type="number"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                style={inputStyle}
                min="0"
              />
            </div>
            <div>
              <label style={labelStyle}>Ghi chú</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                style={inputStyle}
                placeholder="Ghi chú thêm..."
              />
            </div>
          </div>

          {/* Buttons */}
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', paddingTop: '12px', borderTop: '1px solid #e5e7eb' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '12px 24px', borderRadius: '8px', border: '1px solid #d1d5db',
                background: '#fff', color: '#374151', fontWeight: 700, fontSize: '0.9rem',
                cursor: 'pointer', transition: 'all 0.2s'
              }}
            >
              Huỷ
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '12px 28px', borderRadius: '8px', border: 'none',
                background: loading ? '#9ca3af' : '#059669', color: '#fff',
                fontWeight: 700, fontSize: '0.9rem', cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s'
              }}
            >
              {loading ? '⏳ Đang tạo...' : '📨 Gửi cho Khách thuê'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
