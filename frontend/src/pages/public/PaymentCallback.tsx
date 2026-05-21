import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate, useParams, useLocation } from 'react-router-dom'
import { MdCheckCircle, MdErrorOutline, MdOutlineReceipt } from 'react-icons/md'
import Spinner from '../../components/ui/Spinner.tsx'

interface PaymentStatus {
  status: 'loading' | 'success' | 'failed' | 'pending'
  message: string
  invoiceId?: string
  orderInfo?: string
}

export default function PaymentCallback() {
  const [searchParams] = useSearchParams()
  const { invoiceId: routeInvoiceId } = useParams<{ invoiceId?: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>({
    status: 'loading',
    message: 'Đang kiểm tra kết quả thanh toán...',
  })

  useEffect(() => {
    const checkPaymentStatus = async () => {
      try {
        // Lấy query parameters từ callback (khác nhau tùy vào gateway)
        const resultCode = searchParams.get('resultCode') // Momo
        const vnp_ResponseCode = searchParams.get('vnp_ResponseCode') // VNPay
        const reason = searchParams.get('reason') // Custom fail reason

        const invoiceId = localStorage.getItem('pendingPaymentInvoiceId')
        const paymentMethod = localStorage.getItem('pendingPaymentMethod')

        // Xác định kết quả thanh toán
        let isSuccess = false
        let failReason = ''

        if (resultCode !== null) {
          // Callback từ Momo
          isSuccess = resultCode === '0'
          failReason = reason || (resultCode !== '0' ? 'Thanh toán Momo thất bại' : '')
        } else if (vnp_ResponseCode !== null) {
          // Callback từ VNPay
          isSuccess = vnp_ResponseCode === '00'
          failReason = reason || (vnp_ResponseCode !== '00' ? 'Thanh toán VNPay thất bại' : '')
        } else {
          // Không có callback parameters - check localStorage for custom reason
          const customReason = searchParams.get('reason')
          if (customReason) {
            isSuccess = false
            failReason = decodeURIComponent(customReason)
          }
        }

        const resolvedInvoiceId = routeInvoiceId || invoiceId
        const isSuccessRoute = location.pathname.includes('/payment/success') && !!routeInvoiceId

        if ((isSuccess && resolvedInvoiceId) || isSuccessRoute) {
          setPaymentStatus({
            status: 'success',
            message: isSuccessRoute
              ? 'Thanh toán thành công!'
              : `Thanh toán thành công qua ${paymentMethod?.toUpperCase() || 'cổng thanh toán'}!`,
            invoiceId: resolvedInvoiceId || routeInvoiceId || undefined,
          })

          // Xóa localStorage
          localStorage.removeItem('pendingPaymentInvoiceId')
          localStorage.removeItem('pendingPaymentMethod')

          // Redirect sau 3 giây
          setTimeout(() => {
            navigate('/my-invoices')
          }, 3000)
        } else {
          setPaymentStatus({
            status: 'failed',
            message: failReason || 'Thanh toán thất bại. Vui lòng thử lại.',
            invoiceId: resolvedInvoiceId || undefined,
          })

          // Xóa localStorage
          localStorage.removeItem('pendingPaymentInvoiceId')
          localStorage.removeItem('pendingPaymentMethod')
        }
      } catch (error) {
        console.error('Payment callback error:', error)
        setPaymentStatus({
          status: 'failed',
          message: 'Có lỗi xảy ra khi kiểm tra kết quả thanh toán.',
        })
      }
    }

    checkPaymentStatus()
  }, [searchParams, routeInvoiceId, location.pathname, navigate])

  return (
    <div className="page-shell">
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          background: '#f3f4f6',
        }}
      >
        <div
          style={{
            background: '#fff',
            borderRadius: '16px',
            padding: '48px',
            textAlign: 'center',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
            maxWidth: '500px',
            width: '100%',
          }}
        >
          {paymentStatus.status === 'loading' && (
            <>
              <Spinner size="lg" />
              <p style={{ marginTop: '24px', fontSize: '1.1rem', color: '#6b7280', fontWeight: 500 }}>
                {paymentStatus.message}
              </p>
            </>
          )}

          {paymentStatus.status === 'success' && (
            <>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '88px',
                  height: '88px',
                  background: '#ecfdf5',
                  borderRadius: '50%',
                  margin: '0 auto 24px',
                }}
              >
                <MdCheckCircle size={56} color="#10b981" />
              </div>
              <h1 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#111827', margin: '0 0 8px' }}>
                Thanh toán thành công!
              </h1>
              <p style={{ color: '#6b7280', fontSize: '1rem', marginBottom: '24px' }}>
                {paymentStatus.message}
              </p>

              <div
                style={{
                  background: '#f3f4f6',
                  borderRadius: '8px',
                  padding: '16px',
                  marginBottom: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                }}
              >
                <MdOutlineReceipt size={24} color="#6b7280" />
                <div style={{ textAlign: 'left' }}>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: '#6b7280' }}>Mã hóa đơn</p>
                  <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#111827' }}>
                    {paymentStatus.invoiceId}
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  onClick={() => navigate('/my-invoices')}
                  style={{
                    flex: 1,
                    background: '#003e68',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '12px 24px',
                    fontWeight: 700,
                    fontSize: '1rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#002d4d')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = '#003e68')}
                >
                  Xem hóa đơn của tôi
                </button>
                <button
                  onClick={() => navigate('/')}
                  style={{
                    flex: 1,
                    background: '#e5e7eb',
                    color: '#374151',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '12px 24px',
                    fontWeight: 700,
                    fontSize: '1rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#d1d5db')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = '#e5e7eb')}
                >
                  Trang chủ
                </button>
              </div>

              <p
                style={{
                  marginTop: '24px',
                  fontSize: '0.85rem',
                  color: '#9ca3af',
                }}
              >
                Bạn sẽ được chuyển hướng về trang hóa đơn của tôi trong 3 giây...
              </p>
            </>
          )}

          {paymentStatus.status === 'failed' && (
            <>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '88px',
                  height: '88px',
                  background: '#fee2e2',
                  borderRadius: '50%',
                  margin: '0 auto 24px',
                }}
              >
                <MdErrorOutline size={56} color="#ef4444" />
              </div>
              <h1 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#111827', margin: '0 0 8px' }}>
                Thanh toán thất bại
              </h1>
              <p style={{ color: '#6b7280', fontSize: '1rem', marginBottom: '32px' }}>
                {paymentStatus.message}
              </p>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  onClick={() => navigate(`/my-invoices`)}
                  style={{
                    flex: 1,
                    background: '#003e68',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '12px 24px',
                    fontWeight: 700,
                    fontSize: '1rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#002d4d')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = '#003e68')}
                >
                  Quay lại
                </button>
                <button
                  onClick={() => navigate('/')}
                  style={{
                    flex: 1,
                    background: '#e5e7eb',
                    color: '#374151',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '12px 24px',
                    fontWeight: 700,
                    fontSize: '1rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#d1d5db')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = '#e5e7eb')}
                >
                  Trang chủ
                </button>
              </div>

              <p style={{ marginTop: '24px', fontSize: '0.85rem', color: '#9ca3af' }}>
                Vui lòng thử lại hoặc liên hệ với bộ phận hỗ trợ nếu lỗi tiếp tục xảy ra.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
