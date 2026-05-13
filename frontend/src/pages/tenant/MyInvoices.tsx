import { useState, useEffect } from 'react'
import api from '../../api/axios.ts'
import Spinner from '../../components/ui/Spinner.tsx'
import Badge from '../../components/ui/Badge.tsx'
import { useAuth } from '../../contexts/AuthContext.tsx'

import { MdOutlineReceipt, MdHouse, MdOutlineWaterDrop, MdDownload } from 'react-icons/md'
import { FiZap, FiInfo } from 'react-icons/fi'

interface Invoice {
  _id: string
  contract?: { room?: { name: string; address: string; type?: string } }
  type: 'deposit' | 'service'
  month?: number
  year?: number
  totalAmount: number
  status: 'unpaid' | 'paid' | 'overdue'
  dueDate?: string
  createdAt: string
  representativeName?: string
  roomName?: string
  rentAmount?: number
  depositAmount?: number
  electricity?: { oldReading: number; newReading: number; usage: number; rate: number; amount: number }
  water?: { oldReading: number; newReading: number; usage: number; rate: number; amount: number }
  extraFees?: Array<{ name: string; amount: number }>
}

const STATUS_MAP = {
  paid: { label: 'Đã thanh toán', variant: 'success' as const },
  unpaid: { label: 'Chờ thanh toán', variant: 'warning' as const },
  overdue: { label: 'Quá hạn', variant: 'danger' as const },
}

export default function MyInvoices() {
  const { user } = useAuth()
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [payingId, setPayingId] = useState<string | null>(null)
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<'momo' | 'vnpay'>('momo')

  useEffect(() => {
    api.get('/invoices/my')
      .then(r => setInvoices(r.data))
      .catch(() => setError('Không thể tải hóa đơn của bạn.'))
      .finally(() => setLoading(false))
  }, [])

  const handlePay = async (id: string) => {
    setPayingId(id)
    try {
      await api.post(`/invoices/${id}/pay`)
      setInvoices(prev => prev.map(inv => inv._id === id ? { ...inv, status: 'paid' } : inv))
      if (selectedInvoice && selectedInvoice._id === id) {
        setSelectedInvoice(prev => prev ? { ...prev, status: 'paid' } : null)
        setTimeout(() => {
          setSelectedInvoice(null)
        }, 1500)
      }
    } catch (err) {
      alert('Có lỗi xảy ra khi thanh toán. Vui lòng thử lại sau.')
    } finally {
      setPayingId(null)
    }
  }

  const unpaidTotal = invoices
    .filter(i => i.status === 'unpaid' || i.status === 'overdue')
    .reduce((s, i) => s + i.totalAmount, 0)

  // Generate ID based on month/year or fallback to creation date
  const generateInvoiceCode = (inv: Invoice) => {
    if (inv.type === 'service' && inv.month && inv.year) {
      return `#INV-${inv.year.toString().slice(-2)}${inv.month.toString().padStart(2, '0')}-${inv._id.slice(-2).toUpperCase()}`
    } else {
      const d = new Date(inv.createdAt)
      const prefix = inv.type === 'deposit' ? '#DEP-' : '#INV-'
      return `${prefix}${d.getFullYear().toString().slice(-2)}${(d.getMonth() + 1).toString().padStart(2, '0')}-${inv._id.slice(-2).toUpperCase()}`
    }
  }

  return (
    <div className="page-shell">
      <div className="tenant-page">
        <div className="admin-page-header">
          <div>
            <h1>Hóa đơn của tôi</h1>
            <p>Xin chào, <strong>{user?.name}</strong> 👋</p>
          </div>
          {unpaidTotal > 0 && (
            <div className="unpaid-summary" style={{ background: '#fffbeb', color: '#b45309', padding: '12px 20px', borderRadius: '8px', border: '1px solid #fef3c7', display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span style={{ fontWeight: 600 }}>Cần thanh toán:</span>
              <strong style={{ fontSize: '1.2rem' }}>{unpaidTotal.toLocaleString('vi-VN')}đ</strong>
            </div>
          )}
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        {loading ? <Spinner /> : (
          <div className="admin-table-wrap" style={{ marginTop: '24px' }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>MÃ HĐ</th>
                  <th>KỲ</th>
                  <th>LOẠI</th>
                  <th>SỐ TIỀN (VNĐ)</th>
                  <th>HẠN CHÓT</th>
                  <th>TRẠNG THÁI</th>
                  <th style={{ textAlign: 'center' }}>THAO TÁC</th>
                </tr>
              </thead>
              <tbody>
                {invoices.length === 0 ? (
                  <tr><td colSpan={7} className="table-empty">Chưa có hóa đơn nào.</td></tr>
                ) : invoices.map(inv => (
                  <tr key={inv._id}>
                    <td style={{ fontWeight: 600, color: '#4b5563' }}>
                      {generateInvoiceCode(inv)}
                    </td>
                    <td>
                      {inv.type === 'service' && inv.month && inv.year
                        ? `Tháng ${inv.month.toString().padStart(2, '0')}, ${inv.year}`
                        : `Tháng ${(new Date(inv.createdAt).getMonth() + 1).toString().padStart(2, '0')}, ${new Date(inv.createdAt).getFullYear()}`}
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#4b5563' }}>
                        {/* {inv.type === 'service' ? <MdHouse size={18} /> : <FiKey size={16} />} */}
                        {inv.type === 'service' ? 'Dịch vụ' : 'Tiền cọc'}
                      </div>
                    </td>
                    <td style={{ fontWeight: 600, color: '#111827' }}>
                      {inv.totalAmount.toLocaleString('vi-VN')}
                    </td>
                    <td>
                      {inv.dueDate ? new Date(inv.dueDate).toLocaleDateString('vi-VN') : '—'}
                    </td>
                    <td>
                      <Badge label={STATUS_MAP[inv.status]?.label || inv.status} variant={STATUS_MAP[inv.status]?.variant || 'neutral'} />
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        onClick={() => setSelectedInvoice(inv)}
                        style={{
                          background: (inv.status === 'unpaid' || inv.status === 'overdue') ? '#003e68' : 'transparent',
                          color: (inv.status === 'unpaid' || inv.status === 'overdue') ? '#fff' : '#4b5563',
                          border: 'none',
                          padding: (inv.status === 'unpaid' || inv.status === 'overdue') ? '6px 16px' : '0',
                          borderRadius: '4px',
                          fontWeight: 700,
                          fontSize: '0.8rem',
                          cursor: 'pointer'
                        }}>
                        {(inv.status === 'unpaid' || inv.status === 'overdue') ? 'THANH TOÁN' : 'CHI TIẾT'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {/* MODAL CHI TIẾT HÓA ĐƠN */}
        {selectedInvoice && (
          <div className="rent-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setSelectedInvoice(null) }}>
            <div className="rent-modal" style={{ maxWidth: '1000px', borderRadius: '12px', padding: 0, overflow: 'hidden', background: '#f3f4f6' }}>
              
              {/* Header */}
              <div style={{ background: '#fff', padding: '24px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e5e7eb' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '4px' }}>
                    <h2 style={{ margin: 0, fontSize: '1.5rem', color: '#111827', fontWeight: 800 }}>
                      Chi tiết hóa đơn {selectedInvoice.type === 'service' && selectedInvoice.month ? `tháng ${selectedInvoice.month.toString().padStart(2, '0')}/${selectedInvoice.year}` : '(Tiền cọc)'}
                    </h2>
                    <Badge label={STATUS_MAP[selectedInvoice.status]?.label} variant={STATUS_MAP[selectedInvoice.status]?.variant} />
                  </div>
                  <p style={{ margin: 0, color: '#6b7280', fontSize: '0.9rem' }}>Quản lý và xem lại các khoản phí hàng tháng cho phòng này.</p>
                </div>
                <button style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', background: '#fff', border: '1px solid #d1d5db', borderRadius: '6px', fontWeight: 600, color: '#374151', cursor: 'pointer' }} onClick={() => alert('Tính năng tải PDF đang được phát triển')}>
                  <MdDownload size={18} /> Tải hóa đơn PDF
                </button>
              </div>

              {/* Body */}
              <div style={{ padding: '32px', display: 'flex', gap: '32px', alignItems: 'flex-start', maxHeight: '80vh', overflowY: 'auto' }}>
                
                {/* Left Column */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  
                  {/* Info Row */}
                  <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', display: 'flex', gap: '32px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                    {/* Invoice Info */}
                    <div style={{ flex: 1, position: 'relative' }}>
                      <div style={{ position: 'absolute', left: '-24px', top: 0, bottom: 0, width: '4px', background: '#088373', borderRadius: '0 4px 4px 0' }} />
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#4b5563', fontWeight: 700, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '16px' }}>
                        <MdOutlineReceipt size={18} /> THÔNG TIN HÓA ĐƠN
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', fontSize: '0.9rem' }}>
                        <span style={{ color: '#6b7280' }}>Mã hóa đơn</span>
                        <span style={{ fontWeight: 600, color: '#111827' }}>{generateInvoiceCode(selectedInvoice)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', fontSize: '0.9rem' }}>
                        <span style={{ color: '#6b7280' }}>Kỳ thanh toán</span>
                        <span style={{ fontWeight: 600, color: '#111827' }}>
                          {selectedInvoice.type === 'service' ? `01/${selectedInvoice.month?.toString().padStart(2, '0')}/${selectedInvoice.year} - 30/${selectedInvoice.month?.toString().padStart(2, '0')}/${selectedInvoice.year}` : 'Tháng đầu'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                        <span style={{ color: '#6b7280' }}>Hạn thanh toán</span>
                        <span style={{ fontWeight: 700, color: '#dc2626', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {selectedInvoice.dueDate ? new Date(selectedInvoice.dueDate).toLocaleDateString('vi-VN') : '—'}
                        </span>
                      </div>
                    </div>
                    
                    {/* Divider */}
                    <div style={{ width: '1px', background: '#e5e7eb' }} />
                    
                    {/* Tenant Info */}
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#4b5563', fontWeight: 700, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '16px' }}>
                        <FiInfo size={18} /> THÔNG TIN KHÁCH THUÊ
                      </div>
                      <div style={{ background: '#f3f4f6', borderRadius: '8px', padding: '16px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div style={{ width: '48px', height: '48px', background: '#bfdbfe', color: '#1d4ed8', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '1.2rem', flexShrink: 0 }}>
                          {(selectedInvoice.representativeName?.charAt(0) || user?.name?.charAt(0) || 'NV').toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, color: '#111827', marginBottom: '4px' }}>{selectedInvoice.representativeName || user?.name || 'Nguyễn Văn An'}</div>
                          <div style={{ color: '#6b7280', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <MdHouse size={16} /> Phòng {selectedInvoice.roomName || selectedInvoice.contract?.room?.name} - {selectedInvoice.contract?.room?.type || 'Phòng trọ'}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Services Details */}
                  <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#111827', fontWeight: 800, fontSize: '1.2rem', marginBottom: '24px' }}>
                      <MdOutlineReceipt size={24} /> Chi tiết dịch vụ
                    </div>

                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                          <th style={{ textAlign: 'left', paddingBottom: '12px', color: '#6b7280', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>HẠNG MỤC</th>
                          <th style={{ textAlign: 'left', paddingBottom: '12px', color: '#6b7280', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>CHI TIẾT SỬ DỤNG</th>
                          <th style={{ textAlign: 'right', paddingBottom: '12px', color: '#6b7280', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>THÀNH TIỀN</th>
                        </tr>
                      </thead>
                      <tbody>
                        {/* Rent */}
                        <tr style={{ borderBottom: '1px dashed #e5e7eb' }}>
                          <td style={{ padding: '20px 0' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                              <div style={{ width: '40px', height: '40px', background: '#f3f4f6', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280' }}>
                                <MdHouse size={20} />
                              </div>
                              <span style={{ fontWeight: 600, color: '#374151' }}>Tiền phòng</span>
                            </div>
                          </td>
                          <td style={{ color: '#6b7280', fontSize: '0.9rem' }}>Cố định hàng tháng</td>
                          <td style={{ textAlign: 'right', fontWeight: 800, color: '#111827', fontSize: '1.05rem' }}>{(selectedInvoice.rentAmount || 0).toLocaleString('vi-VN')} đ</td>
                        </tr>

                        {/* Electricity */}
                        {selectedInvoice.electricity && (
                          <tr style={{ borderBottom: '1px dashed #e5e7eb' }}>
                            <td style={{ padding: '20px 0' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                <div style={{ width: '40px', height: '40px', background: '#fef3c7', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#d97706' }}>
                                  <FiZap size={20} />
                                </div>
                                <span style={{ fontWeight: 600, color: '#374151' }}>Tiền điện</span>
                              </div>
                            </td>
                            <td>
                              <div style={{ display: 'flex', gap: '12px', marginBottom: '6px' }}>
                                <div style={{ background: '#f3f4f6', padding: '2px 8px', borderRadius: '4px', fontSize: '0.8rem', color: '#4b5563' }}>Cũ: <strong>{selectedInvoice.electricity.oldReading}</strong></div>
                                <div style={{ background: '#f3f4f6', padding: '2px 8px', borderRadius: '4px', fontSize: '0.8rem', color: '#4b5563' }}>Mới: <strong>{selectedInvoice.electricity.newReading}</strong></div>
                              </div>
                              <div style={{ color: '#6b7280', fontSize: '0.85rem' }}>Sử dụng: {selectedInvoice.electricity.usage} kWh × {(selectedInvoice.electricity.rate || 0).toLocaleString('vi-VN')} đ</div>
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 800, color: '#111827', fontSize: '1.05rem' }}>{(selectedInvoice.electricity.amount || 0).toLocaleString('vi-VN')} đ</td>
                          </tr>
                        )}

                        {/* Water */}
                        {selectedInvoice.water && (
                          <tr style={{ borderBottom: '1px dashed #e5e7eb' }}>
                            <td style={{ padding: '20px 0' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                <div style={{ width: '40px', height: '40px', background: '#e0f2fe', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0284c7' }}>
                                  <MdOutlineWaterDrop size={20} />
                                </div>
                                <span style={{ fontWeight: 600, color: '#374151' }}>Tiền nước</span>
                              </div>
                            </td>
                            <td>
                              <div style={{ display: 'flex', gap: '12px', marginBottom: '6px' }}>
                                <div style={{ background: '#f3f4f6', padding: '2px 8px', borderRadius: '4px', fontSize: '0.8rem', color: '#4b5563' }}>Cũ: <strong>{selectedInvoice.water.oldReading}</strong></div>
                                <div style={{ background: '#f3f4f6', padding: '2px 8px', borderRadius: '4px', fontSize: '0.8rem', color: '#4b5563' }}>Mới: <strong>{selectedInvoice.water.newReading}</strong></div>
                              </div>
                              <div style={{ color: '#6b7280', fontSize: '0.85rem' }}>Sử dụng: {selectedInvoice.water.usage} m³ × {(selectedInvoice.water.rate || 0).toLocaleString('vi-VN')} đ</div>
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 800, color: '#111827', fontSize: '1.05rem' }}>{(selectedInvoice.water.amount || 0).toLocaleString('vi-VN')} đ</td>
                          </tr>
                        )}

                        {/* Extra Fees */}
                        {selectedInvoice.extraFees?.map((fee, idx) => (
                          <tr key={idx} style={{ borderBottom: idx === (selectedInvoice.extraFees?.length || 0) - 1 ? 'none' : '1px dashed #e5e7eb' }}>
                            <td style={{ padding: '20px 0' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                <div style={{ width: '40px', height: '40px', background: '#f3f4f6', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280' }}>
                                  <FiInfo size={20} />
                                </div>
                                <span style={{ fontWeight: 600, color: '#374151' }}>{fee.name}</span>
                              </div>
                            </td>
                            <td style={{ color: '#6b7280', fontSize: '0.9rem' }}>Phí khác</td>
                            <td style={{ textAlign: 'right', fontWeight: 800, color: '#111827', fontSize: '1.05rem' }}>{(fee.amount || 0).toLocaleString('vi-VN')} đ</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                </div>

                {/* Right Column (Payment Card) */}
                <div style={{ width: '340px', background: '#003e68', borderRadius: '16px', padding: '32px', color: '#fff', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)', flexShrink: 0 }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#93c5fd', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>
                    TỔNG TIỀN THANH TOÁN
                  </div>
                  <div style={{ fontSize: '2.5rem', fontWeight: 800, marginBottom: '24px', display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                    {selectedInvoice.totalAmount.toLocaleString('vi-VN')} <span style={{ fontSize: '1.2rem', fontWeight: 500, color: '#93c5fd' }}>đ</span>
                  </div>

                  <div style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px', padding: '16px', display: 'flex', gap: '12px', marginBottom: '32px' }}>
                    <FiInfo size={20} color="#93c5fd" style={{ flexShrink: 0, marginTop: '2px' }} />
                    <span style={{ fontSize: '0.9rem', color: '#dbeafe', lineHeight: 1.5 }}>
                      Vui lòng thanh toán trước<br/>
                      <strong>{selectedInvoice.dueDate ? new Date(selectedInvoice.dueDate).toLocaleDateString('vi-VN') : '—'}</strong>
                    </span>
                  </div>

                  {selectedInvoice.status !== 'paid' && (
                    <>
                      <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#93c5fd', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '16px' }}>
                        PHƯƠNG THỨC THANH TOÁN
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '32px' }}>
                        <div 
                          onClick={() => setPaymentMethod('momo')}
                          style={{ background: 'rgba(255,255,255,0.1)', border: paymentMethod === 'momo' ? '1px solid #60a5fa' : '1px solid transparent', borderRadius: '8px', padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', transition: 'all 0.2s' }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ width: '32px', height: '32px', background: '#fff', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                              <img src="https://upload.wikimedia.org/wikipedia/vi/f/fe/MoMo_Logo.png" alt="MoMo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                            </div>
                            <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>VÍ MOMO</span>
                          </div>
                          <div style={{ width: '16px', height: '16px', borderRadius: '50%', border: paymentMethod === 'momo' ? '4px solid #fff' : '2px solid rgba(255,255,255,0.3)', background: paymentMethod === 'momo' ? '#60a5fa' : 'transparent' }} />
                        </div>

                        <div 
                          onClick={() => setPaymentMethod('vnpay')}
                          style={{ background: 'rgba(255,255,255,0.1)', border: paymentMethod === 'vnpay' ? '1px solid #60a5fa' : '1px solid transparent', borderRadius: '8px', padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', transition: 'all 0.2s' }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ width: '32px', height: '32px', background: '#fff', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                              <img src="https://vnpay.vn/s1/statics.vnpay.vn/2023/6/0oxhzjmxbksr1686814746087.png" alt="VNPay" style={{ width: '80%', height: '80%', objectFit: 'contain' }} />
                            </div>
                            <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>VNPAY</span>
                          </div>
                          <div style={{ width: '16px', height: '16px', borderRadius: '50%', border: paymentMethod === 'vnpay' ? '4px solid #fff' : '2px solid rgba(255,255,255,0.3)', background: paymentMethod === 'vnpay' ? '#60a5fa' : 'transparent' }} />
                        </div>
                      </div>

                      <button 
                        onClick={() => handlePay(selectedInvoice._id)}
                        disabled={payingId === selectedInvoice._id}
                        style={{ width: '100%', background: '#fff', color: '#003e68', border: 'none', borderRadius: '8px', padding: '16px', fontWeight: 800, fontSize: '1rem', cursor: payingId === selectedInvoice._id ? 'not-allowed' : 'pointer', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'all 0.2s', opacity: payingId === selectedInvoice._id ? 0.7 : 1 }}
                      >
                        {payingId === selectedInvoice._id ? <Spinner size="sm" /> : <MdOutlineReceipt size={20} />}
                        {payingId === selectedInvoice._id ? 'Đang xử lý...' : 'Thanh toán'}
                      </button>
                    </>
                  )}

                  <button 
                    onClick={() => setSelectedInvoice(null)}
                    style={{ width: '100%', background: 'transparent', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px', padding: '16px', fontWeight: 700, fontSize: '1rem', cursor: 'pointer', transition: 'all 0.2s' }}
                  >
                    X Huỷ
                  </button>

                </div>

              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
