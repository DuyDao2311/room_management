import { useState, useEffect } from 'react'
import { serviceService, type PixabayImageResult } from '../../api/service.service'

interface Props {
  onDone: (urls: string[]) => void
  onClose: () => void
  serviceName?: string
  serviceDescription?: string
}

export default function ServiceImagePicker({ onDone, onClose, serviceName, serviceDescription }: Props) {
  const [tab, setTab] = useState<'search' | 'upload'>('search')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<PixabayImageResult[]>([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [importingId, setImportingId] = useState<number | null>(null)
  const [selected, setSelected] = useState<string[]>([])
  const [uploadFiles, setUploadFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')

  const runSearch = async (q: string) => {
    setSearching(true)
    setSearchError('')
    try {
      const res = await serviceService.searchServiceImages(q)
      setResults(res.data)
    } catch (err: any) {
      setSearchError(err.response?.data?.message || 'Không tìm được ảnh, thử lại sau.')
    } finally {
      setSearching(false)
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    runSearch(query)
  }

  useEffect(() => {
    if (serviceName) {
      setQuery(serviceName)
      runSearch(serviceName)
    }
    // eslint-disable-next-line
  }, [])

  const handlePick = async (result: PixabayImageResult) => {
    setImportingId(result.id)
    setSearchError('')
    try {
      const res = await serviceService.importServiceImage(result.imageUrl)
      setSelected(prev => [...prev, res.data.url])
    } catch {
      setSearchError('Không thể chọn ảnh này, thử lại.')
    } finally {
      setImportingId(null)
    }
  }

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

        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <button type="button" className={tab === 'search' ? 'button button-primary' : 'button button-secondary'} onClick={() => setTab('search')}>Tìm ảnh mẫu</button>
          <button type="button" className={tab === 'upload' ? 'button button-primary' : 'button button-secondary'} onClick={() => setTab('upload')}>Tải ảnh lên</button>
        </div>

        {tab === 'search' && (
          <div>
            <form onSubmit={handleSearch} style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <input className="form-input" value={query} onChange={e => setQuery(e.target.value)} placeholder="VD: giường ngủ khách sạn" />
              <button type="submit" className="button button-primary" disabled={searching || !query.trim()}>Tìm</button>
            </form>
            {searchError && <div className="alert alert-error">{searchError}</div>}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              {results.map(r => (
                <button
                  type="button"
                  key={r.id}
                  onClick={() => handlePick(r)}
                  disabled={importingId === r.id}
                  aria-label={`Chọn ảnh ${r.id}`}
                  style={{ padding: 0, border: 'none', cursor: 'pointer', position: 'relative', background: 'none' }}
                >
                  <img src={r.thumbnailUrl} alt="" style={{ width: '100%', display: 'block' }} />
                  {importingId === r.id && (
                    <span style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.7)' }}>...</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {tab === 'upload' && (
          <div>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={e => setUploadFiles(e.target.files ? Array.from(e.target.files) : [])}
            />
            <button type="button" className="button button-primary" onClick={handleUpload} disabled={uploading || uploadFiles.length === 0} style={{ marginLeft: 8 }}>
              Tải lên
            </button>
            {uploadError && <div className="alert alert-error">{uploadError}</div>}
          </div>
        )}

        <div style={{ marginTop: 16 }}>
          <span style={{ fontWeight: 700 }}>Ảnh đã chọn ({selected.length})</span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
            {selected.map(url => (
              <div key={url} style={{ position: 'relative' }}>
                <img src={url} alt="" style={{ width: 64, height: 64, objectFit: 'cover' }} />
                <button type="button" onClick={() => removeSelected(url)} aria-label={`Xóa ảnh ${url}`} style={{ position: 'absolute', top: -6, right: -6 }}>✕</button>
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
  )
}
