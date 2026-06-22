import { useState } from 'react'
import { MdClose, MdAdd, MdLink } from 'react-icons/md'

interface AddImageModalProps {
  roomId: string
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export default function AddImageModal({ roomId, isOpen, onClose, onSuccess }: AddImageModalProps) {
  const [urlText, setUrlText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ added: number; invalidUrls: string[]; duplicateUrls: string[] } | null>(null)

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setResult(null)

    const urls = urlText
      .split('\n')
      .map((u) => u.trim())
      .filter(Boolean)

    if (urls.length === 0) {
      setError('Vui lòng nhập ít nhất 1 URL.')
      return
    }

    setLoading(true)
    try {
      const { default: api } = await import('../../api/axios')
      const res = await api.post(`/rooms/${roomId}/images/bulk`, { urls })
      setResult(res.data.data)
      setUrlText('')
      onSuccess()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Lỗi khi thêm ảnh.')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setUrlText('')
    setError('')
    setResult(null)
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
        <div className="modal-header">
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <MdAdd size={22} /> Thêm ảnh phòng
          </h2>
          <button className="modal-close" onClick={handleClose}>
            <MdClose size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          {error && (
            <div className="alert alert-error" style={{ marginBottom: '12px' }}>
              {error}
            </div>
          )}

          {result && (
            <div className="alert" style={{ marginBottom: '12px', background: '#dcfce7', color: '#166534', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '12px' }}>
              <strong>✅ Đã thêm {result.added} ảnh thành công!</strong>
              {result.invalidUrls.length > 0 && (
                <div style={{ marginTop: '8px', fontSize: '0.85rem', color: '#dc2626' }}>
                  ⚠️ URL không hợp lệ: {result.invalidUrls.join(', ')}
                </div>
              )}
              {result.duplicateUrls.length > 0 && (
                <div style={{ marginTop: '4px', fontSize: '0.85rem', color: '#d97706' }}>
                  ⚠️ URL trùng lặp: {result.duplicateUrls.join(', ')}
                </div>
              )}
            </div>
          )}

          <div className="form-group">
            <label htmlFor="image-urls" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <MdLink size={18} /> Nhập URL ảnh (mỗi URL 1 dòng)
            </label>
            <textarea
              id="image-urls"
              className="form-input"
              value={urlText}
              onChange={(e) => setUrlText(e.target.value)}
              rows={8}
              placeholder={`https://images.unsplash.com/photo-1.jpg\nhttps://images.unsplash.com/photo-2.jpg\nhttps://images.unsplash.com/photo-3.jpg`}
              style={{ fontFamily: 'monospace', fontSize: '0.85rem', resize: 'vertical' }}
            />
            <p style={{ margin: '6px 0 0', fontSize: '0.8rem', color: '#6b7280' }}>
              Hỗ trợ nhiều URL cùng lúc. Mỗi dòng là 1 URL ảnh.
            </p>
          </div>

          <div className="modal-actions">
            <button type="button" className="button button-secondary" onClick={handleClose}>
              Đóng
            </button>
            <button type="submit" className="button button-primary" disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {loading ? 'Đang thêm...' : (
                <>
                  <MdAdd size={18} /> Thêm ảnh
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
