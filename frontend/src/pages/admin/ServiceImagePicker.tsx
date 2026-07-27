import { useState } from 'react'
import { serviceService } from '../../api/service.service'

interface Props {
  onDone: (urls: string[]) => void
  onClose: () => void
}

export default function ServiceImagePicker({ onDone, onClose }: Props) {
  const [selected, setSelected] = useState<string[]>([])
  const [uploadFiles, setUploadFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')

  const handleUpload = async () => {
    if (uploadFiles.length === 0) return
    setUploading(true)
    setUploadError('')
    try {
      const res = await serviceService.uploadServiceImages(uploadFiles)
      setSelected(prev => [...prev, ...res.data.urls])
      setUploadFiles([])
    } catch (err: any) {
      setUploadError(err.response?.data?.message || 'Tải ảnh lên thất bại.')
    } finally {
      setUploading(false)
    }
  }

  const removeSelected = (url: string) => {
    setSelected(prev => prev.filter(u => u !== url))
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Chọn ảnh dịch vụ</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-form">
          <div className="form-group">
            <label>Tải ảnh lên</label>
            <div className="image-picker-upload-row">
              <input
                className="form-input"
                type="file"
                accept="image/*"
                multiple
                onChange={e => setUploadFiles(e.target.files ? Array.from(e.target.files) : [])}
              />
              <button
                type="button"
                className="button button-primary"
                onClick={handleUpload}
                disabled={uploading || uploadFiles.length === 0}
              >
                {uploading ? 'Đang tải...' : 'Tải lên'}
              </button>
            </div>
            {uploadError && <div className="alert alert-error">{uploadError}</div>}
          </div>

          <div className="form-group">
            <label>Ảnh đã chọn ({selected.length})</label>
            <div className="image-picker-preview-grid">
              {selected.map(url => (
                <div key={url} className="image-picker-preview-item">
                  <img src={url} alt="" />
                  <button type="button" onClick={() => removeSelected(url)} aria-label={`Xóa ảnh ${url}`}>✕</button>
                </div>
              ))}
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" className="button button-secondary" onClick={onClose}>Hủy</button>
            <button type="button" className="button button-primary" onClick={() => onDone(selected)} disabled={selected.length === 0}>Xong</button>
          </div>
        </div>
      </div>
    </div>
  )
}
