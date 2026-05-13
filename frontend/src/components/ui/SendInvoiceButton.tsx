import { useState } from 'react'
import api from '../../api/axios.ts'

interface Props {
  invoiceId: string
  disabled?: boolean
}

export default function SendInvoiceButton({ invoiceId, disabled }: Props) {
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

  const handleSend = async () => {
    if (status !== 'idle') return
    setStatus('sending')

    try {
      await api.post(`/invoices/${invoiceId}/send`)
      setStatus('sent')
    } catch {
      setStatus('error')
      // Cho phép thử lại sau 2 giây
      setTimeout(() => setStatus('idle'), 2000)
    }
  }

  const label = {
    idle: 'Gửi hoá đơn',
    sending: 'Đang gửi...',
    sent: 'Đã gửi ✓',
    error: 'Lỗi gửi ✗',
  }[status]

  return (
    <button
      className={`send-invoice-btn send-invoice-${status}`}
      onClick={handleSend}
      disabled={disabled || status === 'sending' || status === 'sent'}
    >
      {status === 'sending' && <span className="send-invoice-spinner" />}
      {label}
    </button>
  )
}
