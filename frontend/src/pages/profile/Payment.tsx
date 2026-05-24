import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../api/axios.ts'
import { createPayment, redirectToPayment, requestCashPayment } from '../../api/payment.ts'
import { FiClock } from 'react-icons/fi'
import { MdOutlineReceipt, MdCheckCircle } from 'react-icons/md'

// ─── Types ────────────────────────────────────────────────────────────────────
interface Invoice {
  _id: string
  type: 'deposit' | 'service'
  roomName: string
  month?: number
  year?: number
  totalAmount: number
  status: 'unpaid' | 'pending' | 'paid' | 'overdue'
  dueDate?: string
  paidAt?: string
  createdAt: string
  paymentMethod?: string
  extraFees?: { name: string; amount: number }[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (n: number) =>
  (n || 0).toLocaleString('vi-VN') + 'đ'

const fmtDate = (iso?: string) => {
  if (!iso) return '---'
  const d = new Date(iso)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

const invoiceLabel = (inv: Invoice) => {
  if (inv.type === 'deposit') return `Tiền cọc — ${inv.roomName}`
  return `${inv.roomName} - T${inv.month}/${inv.year}`
}

const invoiceIcon = (inv: Invoice) => {
  if (inv.type === 'deposit') return '🏠'
  const label = invoiceLabel(inv).toLowerCase()
  if (label.includes('điện') || label.includes('dien') || label.includes('nước') || label.includes('nuoc')) return '⚡'
  if (label.includes('internet') || label.includes('wifi')) return '📶'
  return '🏠'
}

const txnIcon = (inv: Invoice) => {
  const label = invoiceLabel(inv).toLowerCase()
  if (label.includes('điện') || label.includes('dien') || label.includes('nước') || label.includes('nuoc')) return '⚡'
  if (label.includes('internet') || label.includes('wifi')) return '📶'
  return '🏠'
}

const PAGE_SIZE = 4

export default function Payment() {
  const navigate = useNavigate()

  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [paying, setPaying] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [filterTime, setFilterTime] = useState<'all' | '3m' | '6m' | '1y'>('all')

  // ── Payment modal state ────────────────────────────────────────────────────
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<'momo' | 'vnpay' | 'cash'>('momo')
  const [cashModal, setCashModal] = useState(false)

  // ── Fetch my invoices ──────────────────────────────────────────────────────
  useEffect(() => {
    setLoading(true)
    api.get('/invoices/my')
      .then(res => setInvoices(Array.isArray(res.data) ? res.data : []))
      .catch(() => setInvoices([]))
      .finally(() => setLoading(false))
  }, [])

  // ── Derived stats ──────────────────────────────────────────────────────────
  const unpaid   = invoices.filter(i => i.status === 'unpaid' || i.status === 'pending')
  const overdue  = invoices.filter(i => i.status === 'overdue')
  const paid     = invoices.filter(i => i.status === 'paid')

  const unpaidTotal  = unpaid.reduce((s, i) => s + i.totalAmount, 0)
  const overdueTotal = overdue.reduce((s, i) => s + i.totalAmount, 0)
  const paidTotal    = paid.reduce((s, i) => s + i.totalAmount, 0)

  // Tháng này
  const now = new Date()
  const paidThisMonth = paid
    .filter(i => {
      if (!i.paidAt) return false
      const d = new Date(i.paidAt)
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    })
    .reduce((s, i) => s + i.totalAmount, 0)

  // ── Current invoices (active) ──────────────────────────────────────────────
  const activeInvoices = [...overdue, ...unpaid].slice(0, 4)

  // ── Transaction history (paid) ────────────────────────────────────────────
  const filterByTime = (list: Invoice[]) => {
    if (filterTime === 'all') return list
    const cutoff = new Date()
    if (filterTime === '3m') cutoff.setMonth(cutoff.getMonth() - 3)
    if (filterTime === '6m') cutoff.setMonth(cutoff.getMonth() - 6)
    if (filterTime === '1y') cutoff.setFullYear(cutoff.getFullYear() - 1)
    return list.filter(i => new Date(i.paidAt || i.createdAt) >= cutoff)
  }

  const history      = filterByTime(paid).sort((a, b) => new Date(b.paidAt || b.createdAt).getTime() - new Date(a.paidAt || a.createdAt).getTime())
  const totalPages   = Math.max(1, Math.ceil(history.length / PAGE_SIZE))
  const pagedHistory = history.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  // ── Actions ────────────────────────────────────────────────────────────────
  const handlePay = async (id: string) => {
    if (!paymentMethod) {
      alert('Vui lòng chọn phương thức thanh toán')
      return
    }

    if (paymentMethod === 'cash') {
      setPaying(id)
      try {
        await requestCashPayment(id)
        setInvoices(prev => prev.map(inv => inv._id === id ? { ...inv, status: 'pending', paymentMethod: 'Cash' } : inv))
        setCashModal(true)
      } catch (err: any) {
        alert(err.message || 'Có lỗi xảy ra')
      } finally {
        setPaying(null)
      }
      return
    }

    setPaying(id)
    try {
      const response = await createPayment(id, paymentMethod)

      if (response.metadata.paymentUrl) {
        localStorage.setItem('pendingPaymentInvoiceId', id)
        localStorage.setItem('pendingPaymentMethod', paymentMethod)
        redirectToPayment(response.metadata.paymentUrl)
      } else {
        setInvoices(prev => prev.map(inv => inv._id === id ? { ...inv, status: 'paid' } : inv))
        setSelectedInvoice(null)
      }
    } catch (err: any) {
      alert(err.message || 'Có lỗi xảy ra khi thanh toán. Vui lòng thử lại sau.')
    } finally {
      setPaying(null)
    }
  }

  // ── TRX code from invoice ──────────────────────────────────────────────────
  const trxCode = (inv: Invoice) => {
    const short = inv._id.slice(-7).toUpperCase()
    return `TRX-${short}`
  }

  const invCode = (inv: Invoice) => {
    const short = inv._id.slice(-7).toUpperCase()
    return `#INV-${short}`
  }

  return (
    <div className="pmt-page">
      {/* ── Back ───────────────────────────────────────────────────────────── */}
      <button className="pmt-back-btn" onClick={() => navigate(-1)}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 12H5m7-7-7 7 7 7"/>
        </svg>
        Quay lại
      </button>

      {/* ── Page header ────────────────────────────────────────────────────── */}
      <div className="pmt-header">
        <h1 className="pmt-title">Thanh toán & Công nợ</h1>
        <p className="pmt-subtitle">Quản lý các hóa đơn dịch vụ và lịch sử giao dịch của bạn.</p>
      </div>

      {/* ── Summary cards ──────────────────────────────────────────────────── */}
      <div className="pmt-summary-grid">
        {/* Chưa thanh toán */}
        <div className="pmt-stat-card">
          <span className="pmt-stat-label">HÓA ĐƠN CHƯA THANH TOÁN</span>
          <span className="pmt-stat-value">{fmt(unpaidTotal)}</span>
          <div className="pmt-stat-footer pmt-stat-footer--blue">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18"/></svg>
            {unpaid.length.toString().padStart(2, '0')} Hóa đơn
          </div>
        </div>

        {/* Quá hạn */}
        <div className="pmt-stat-card pmt-stat-card--overdue">
          <span className="pmt-stat-label pmt-stat-label--red">HÓA ĐƠN QUÁ HẠN</span>
          <span className="pmt-stat-value pmt-stat-value--red">{fmt(overdueTotal)}</span>
          <div className="pmt-stat-footer pmt-stat-footer--red">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            {overdue.length.toString().padStart(2, '0')} Hóa đơn trễ hạn
          </div>
        </div>

        {/* Tổng đã thanh toán */}
        <div className="pmt-stat-card">
          <span className="pmt-stat-label">TỔNG ĐÃ THANH TOÁN</span>
          <span className="pmt-stat-value">{fmt(paidThisMonth)}</span>
          <div className="pmt-stat-footer pmt-stat-footer--green">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            Tháng này
          </div>
        </div>
      </div>

      {/* ── Active invoices ────────────────────────────────────────────────── */}
      <div className="pmt-section">
        <div className="pmt-section-header">
          <div className="pmt-section-title-wrap">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0f5cc7" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
            <span className="pmt-section-title">Hóa đơn hiện tại</span>
          </div>
          <button className="pmt-view-all-btn">Xem tất cả</button>
        </div>

        {loading ? (
          <div className="pmt-loading">
            <div className="pmt-spinner" />
          </div>
        ) : activeInvoices.length === 0 ? (
          <div className="pmt-empty-small">
            <span>✅</span>
            <p>Không có hóa đơn nào đang chờ thanh toán.</p>
          </div>
        ) : (
          <div className="pmt-invoice-grid">
            {activeInvoices.map(inv => (
              <div
                key={inv._id}
                className={`pmt-invoice-card ${inv.status === 'overdue' ? 'pmt-invoice-card--overdue' : ''}`}
              >
                <div className="pmt-invoice-card-top">
                  <div className="pmt-invoice-badge-row">
                    <span className={`pmt-badge ${inv.status === 'overdue' ? 'pmt-badge--overdue' : 'pmt-badge--unpaid'}`}>
                      {inv.status === 'overdue' ? 'QUÁ HẠN' : inv.status === 'pending' ? 'CHỜ THU TIỀN' : 'CHƯA THANH TOÁN'}
                    </span>
                    <span className="pmt-invoice-amount">{fmt(inv.totalAmount)}</span>
                  </div>
                  <div className="pmt-invoice-name">{invoiceLabel(inv)}</div>
                  <div className="pmt-invoice-code">{invCode(inv)}</div>
                  {inv.dueDate && (
                    <div className={`pmt-invoice-due ${inv.status === 'overdue' ? 'pmt-invoice-due--red' : ''}`}>
                      Hạn: {fmtDate(inv.dueDate)}
                    </div>
                  )}
                </div>
                <div className="pmt-invoice-card-actions">
                  <button
                    className="pmt-pay-btn"
                    onClick={() => setSelectedInvoice(inv)}
                    disabled={inv.status === 'pending'}
                  >
                    Thanh toán ngay
                  </button>
                  <button
                    className="pmt-view-btn"
                    onClick={() => navigate('/my-invoices')}
                    title="Xem chi tiết"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Transaction history ────────────────────────────────────────────── */}
      <div className="pmt-section">
        <div className="pmt-section-header">
          <div className="pmt-section-title-wrap">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0f5cc7" strokeWidth="2"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
            <span className="pmt-section-title">Lịch sử thanh toán</span>
          </div>
          <div className="pmt-filter-wrap">
            <select
              className="pmt-filter-select"
              value={filterTime}
              onChange={e => { setFilterTime(e.target.value as typeof filterTime); setPage(1) }}
            >
              <option value="all">Tất cả thời gian</option>
              <option value="3m">3 tháng gần đây</option>
              <option value="6m">6 tháng gần đây</option>
              <option value="1y">1 năm gần đây</option>
            </select>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#68718d" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
            <button className="pmt-filter-icon-btn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#68718d" strokeWidth="2"><line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/></svg>
            </button>
          </div>
        </div>

        {loading ? (
          <div className="pmt-loading"><div className="pmt-spinner" /></div>
        ) : (
          <>
            {/* Table */}
            <div className="pmt-table-wrap">
              <table className="pmt-table">
                <thead>
                  <tr>
                    <th>NGÀY GIAO DỊCH</th>
                    <th>NỘI DUNG</th>
                    <th>MÃ GIAO DỊCH</th>
                    <th>SỐ TIỀN</th>
                    <th>TRẠNG THÁI</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {pagedHistory.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="pmt-table-empty">Chưa có giao dịch nào.</td>
                    </tr>
                  ) : pagedHistory.map(inv => (
                    <tr key={inv._id} className="pmt-table-row">
                      <td className="pmt-td-date">{fmtDate(inv.paidAt || inv.createdAt)}</td>
                      <td className="pmt-td-content">
                        <span className="pmt-txn-icon">{txnIcon(inv)}</span>
                        <span className="pmt-txn-name">{invoiceLabel(inv)}</span>
                      </td>
                      <td className="pmt-td-trx">{trxCode(inv)}</td>
                      <td className="pmt-td-amount">{fmt(inv.totalAmount)}</td>
                      <td className="pmt-td-status">
                        <span className="pmt-status-badge pmt-status-badge--done">
                          <span className="pmt-status-dot" />
                          HOÀN THÀNH
                        </span>
                      </td>
                      <td className="pmt-td-action">
                        <button className="pmt-kebab-btn">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="pmt-pagination">
              <span className="pmt-pagination-info">
                Hiện thị {Math.min(pagedHistory.length, PAGE_SIZE)} trên {history.length} giao dịch
              </span>
              <div className="pmt-pagination-btns">
                <button
                  className="pmt-page-btn"
                  disabled={page === 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                  <button
                    key={p}
                    className={`pmt-page-btn ${page === p ? 'pmt-page-btn--active' : ''}`}
                    onClick={() => setPage(p)}
                  >
                    {p}
                  </button>
                ))}
                <button
                  className="pmt-page-btn"
                  disabled={page === totalPages}
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── PAYMENT MODAL ──────────────────────────────────────────────────── */}
      {selectedInvoice && (
        <div
          className="rent-modal-overlay"
          onClick={(e) => { if (e.target === e.currentTarget) setSelectedInvoice(null) }}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <div style={{
            background: '#fff', borderRadius: '16px', padding: '32px',
            maxWidth: '500px', width: '90%', textAlign: 'center',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
            animation: 'slideUp 0.3s ease',
          }}>
            {/* Header */}
            <div style={{ marginBottom: '24px' }}>
              <div style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '4px' }}>
                {selectedInvoice.type === 'deposit' ? 'Tiền cọc' : `Hóa đơn tháng ${selectedInvoice.month}/${selectedInvoice.year}`}
              </div>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: '#111827', display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: '4px' }}>
                {selectedInvoice.totalAmount.toLocaleString('vi-VN')} <span style={{ fontSize: '1rem', fontWeight: 500, color: '#6b7280' }}>đ</span>
              </div>
            </div>

            {/* ── PENDING ── */}
            {selectedInvoice.status === 'pending' && (
              <div style={{ padding: '24px 0' }}>
                <div style={{ width: '64px', height: '64px', background: '#fef3c7', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                  <FiClock size={32} color="#d97706" />
                </div>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#d97706', marginBottom: '8px' }}>
                  Đang chờ thanh toán tiền mặt
                </div>
                <div style={{ fontSize: '0.85rem', color: '#6b7280', lineHeight: 1.6 }}>
                  Vui lòng liên hệ quản lý khu vực để nộp tiền. Hóa đơn sẽ tự động cập nhật khi được xác nhận.
                </div>
                <button
                  onClick={() => setSelectedInvoice(null)}
                  style={{ marginTop: '24px', background: '#e5e7eb', color: '#374151', border: 'none', borderRadius: '8px', padding: '12px 32px', fontWeight: 700, fontSize: '1rem', cursor: 'pointer' }}
                >
                  Đóng
                </button>
              </div>
            )}

            {/* ── PAID ── */}
            {selectedInvoice.status === 'paid' && (
              <div style={{ padding: '24px 0' }}>
                <div style={{ width: '64px', height: '64px', background: '#d1fae5', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                  <MdCheckCircle size={36} color="#10b981" />
                </div>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#10b981', marginBottom: '12px' }}>
                  Thanh toán thành công
                </div>
                {selectedInvoice.paidAt && (
                  <div style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '4px' }}>
                    Ngày thanh toán: <strong>{new Date(selectedInvoice.paidAt).toLocaleDateString('vi-VN')}</strong>
                  </div>
                )}
                <button
                  onClick={() => setSelectedInvoice(null)}
                  style={{ marginTop: '24px', background: '#e5e7eb', color: '#374151', border: 'none', borderRadius: '8px', padding: '12px 32px', fontWeight: 700, fontSize: '1rem', cursor: 'pointer' }}
                >
                  Đóng
                </button>
              </div>
            )}

            {/* ── UNPAID/OVERDUE: Chọn phương thức thanh toán ── */}
            {(selectedInvoice.status === 'unpaid' || selectedInvoice.status === 'overdue') && (
              <>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '16px' }}>
                  PHƯƠNG THỨC THANH TOÁN
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
                  {/* MoMo */}
                  <div
                    onClick={() => setPaymentMethod('momo')}
                    style={{ background: '#f9fafb', border: paymentMethod === 'momo' ? '2px solid #a855f7' : '1px solid #e5e7eb', borderRadius: '8px', padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', transition: 'all 0.2s' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '32px', height: '32px', background: '#fff', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                        <img src="https://upload.wikimedia.org/wikipedia/vi/f/fe/MoMo_Logo.png" alt="MoMo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                      </div>
                      <span style={{ fontWeight: 600, fontSize: '0.95rem', color: '#111827' }}>VÍ MOMO</span>
                    </div>
                    <div style={{ width: '16px', height: '16px', borderRadius: '50%', border: paymentMethod === 'momo' ? '4px solid #fff' : '2px solid #d1d5db', background: paymentMethod === 'momo' ? '#a855f7' : 'transparent', boxShadow: paymentMethod === 'momo' ? '0 0 0 2px #a855f7' : 'none' }} />
                  </div>

                  {/* VNPay */}
                  <div
                    onClick={() => setPaymentMethod('vnpay')}
                    style={{ background: '#f9fafb', border: paymentMethod === 'vnpay' ? '2px solid #2563eb' : '1px solid #e5e7eb', borderRadius: '8px', padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', transition: 'all 0.2s' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '32px', height: '32px', background: '#fff', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                        <img src="https://vnpay.vn/s1/statics.vnpay.vn/2023/6/0oxhzjmxbksr1686814746087.png" alt="VNPay" style={{ width: '80%', height: '80%', objectFit: 'contain' }} />
                      </div>
                      <span style={{ fontWeight: 600, fontSize: '0.95rem', color: '#111827' }}>VNPAY</span>
                    </div>
                    <div style={{ width: '16px', height: '16px', borderRadius: '50%', border: paymentMethod === 'vnpay' ? '4px solid #fff' : '2px solid #d1d5db', background: paymentMethod === 'vnpay' ? '#2563eb' : 'transparent', boxShadow: paymentMethod === 'vnpay' ? '0 0 0 2px #2563eb' : 'none' }} />
                  </div>

                  {/* Tiền mặt */}
                  <div
                    onClick={() => setPaymentMethod('cash')}
                    style={{ background: '#f9fafb', border: paymentMethod === 'cash' ? '2px solid #059669' : '1px solid #e5e7eb', borderRadius: '8px', padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', transition: 'all 0.2s' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '32px', height: '32px', background: '#fff', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', color: '#059669' }}>
                        <MdOutlineReceipt size={20} />
                      </div>
                      <span style={{ fontWeight: 600, fontSize: '0.95rem', color: '#111827' }}>TIỀN MẶT</span>
                    </div>
                    <div style={{ width: '16px', height: '16px', borderRadius: '50%', border: paymentMethod === 'cash' ? '4px solid #fff' : '2px solid #d1d5db', background: paymentMethod === 'cash' ? '#059669' : 'transparent', boxShadow: paymentMethod === 'cash' ? '0 0 0 2px #059669' : 'none' }} />
                  </div>
                </div>

                {paymentMethod === 'cash' && (
                  <div style={{ background: '#fef3c7', border: '1px dashed #f59e0b', borderRadius: '8px', padding: '12px', fontSize: '0.85rem', color: '#92400e', marginBottom: '16px', lineHeight: 1.5 }}>
                    Vui lòng nộp tiền mặt trực tiếp cho nhân viên quản lý khu vực. Hóa đơn sẽ được cập nhật trạng thái sau khi nhân viên xác nhận.
                  </div>
                )}

                <div style={{ display: 'flex', gap: '12px' }}>
                  <button
                    onClick={() => setSelectedInvoice(null)}
                    style={{ flex: 1, background: '#e5e7eb', color: '#374151', border: 'none', borderRadius: '8px', padding: '14px', fontWeight: 700, fontSize: '1rem', cursor: 'pointer' }}
                  >
                    Hủy
                  </button>
                  <button
                    onClick={() => handlePay(selectedInvoice._id)}
                    disabled={paying === selectedInvoice._id}
                    style={{ flex: 1, background: '#003e68', color: '#fff', border: 'none', borderRadius: '8px', padding: '14px', fontWeight: 800, fontSize: '1rem', cursor: paying === selectedInvoice._id ? 'not-allowed' : 'pointer', opacity: paying === selectedInvoice._id ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                  >
                    {paying === selectedInvoice._id ? 'Đang xử lý...' : 'Thanh toán'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── CASH MODAL NOTIFICATION ─────────────────────────────────────────── */}
      {cashModal && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) setCashModal(false) }}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <div style={{
            background: '#fff', borderRadius: '16px', padding: '40px',
            maxWidth: '420px', width: '90%', textAlign: 'center',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
          }}>
            <div style={{
              width: '72px', height: '72px', background: '#e0f2fe',
              borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px',
            }}>
              <FiClock size={36} color="#0369a1" />
            </div>
            <h3 style={{ margin: '0 0 12px', fontSize: '1.3rem', fontWeight: 800, color: '#111827' }}>
              Thông báo
            </h3>
            <p style={{ margin: '0 0 24px', color: '#4b5563', fontSize: '1rem', lineHeight: 1.6 }}>
              Vui lòng liên hệ với quản lý khu vực để thanh toán
            </p>
            <button
              onClick={() => { setCashModal(false); setSelectedInvoice(null) }}
              style={{
                background: '#003e68', color: '#fff', border: 'none',
                borderRadius: '8px', padding: '12px 32px', fontWeight: 700,
                fontSize: '1rem', cursor: 'pointer',
              }}
            >
              Đã hiểu
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
