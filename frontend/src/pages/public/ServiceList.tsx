// frontend/src/pages/public/ServiceList.tsx
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import Spinner from '../../components/ui/Spinner.tsx'
import { serviceService, CATEGORY_LABELS, getMinCarOptionPrice, type Service, type ServiceCategory } from '../../api/service.service'

const CATEGORIES: ServiceCategory[] = ['cleaning', 'food', 'laundry', 'transport', 'spa', 'maintenance']

export default function ServiceList() {
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeCategory, setActiveCategory] = useState<ServiceCategory | ''>('')

  useEffect(() => {
    setLoading(true)
    setError('')
    const params: Record<string, string> = {}
    if (activeCategory) params.category = activeCategory
    serviceService.getServices(params)
      .then(res => setServices(res.data))
      .catch(() => setError('Không thể tải danh sách dịch vụ. Vui lòng thử lại.'))
      .finally(() => setLoading(false))
  }, [activeCategory])

  const tabStyle = (isActiveTab: boolean): React.CSSProperties => ({
    padding: '10px 20px', borderRadius: '999px', border: '1px solid #eaecf0',
    background: isActiveTab ? '#0f5cc7' : '#fff',
    color: isActiveTab ? '#fff' : '#475467',
    fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem',
  })

  return (
    <div className="page-shell">
      <div className="room-list-page">
        <div className="page-hero-mini">
          <h1>Dịch vụ</h1>
          <p>Đặt thêm dịch vụ tiện ích cho kỳ nghỉ của bạn</p>
        </div>

        <div style={{ display: 'flex', gap: '10px', marginBottom: '24px', flexWrap: 'wrap' }}>
          <button style={tabStyle(activeCategory === '')} onClick={() => setActiveCategory('')}>Tất cả</button>
          {CATEGORIES.map(cat => (
            <button key={cat} style={tabStyle(activeCategory === cat)} onClick={() => setActiveCategory(cat)}>
              {CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>

        {loading && <Spinner label="Đang tải dịch vụ..." />}
        {error && <div className="alert alert-error">{error}</div>}
        {!loading && !error && services.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">🧺</div>
            <h3>Chưa có dịch vụ nào</h3>
            <p>Thử chọn loại dịch vụ khác.</p>
          </div>
        )}
        {!loading && services.length > 0 && (
          <div className="design-room-grid">
            {services.map(s => {
              const imageUrl = s.images.length > 0 ? s.images[0] : 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=600'
              return (
                <Link to={`/services/${s._id}`} className="design-room-card" key={s._id}>
                  <div className="design-room-image" style={{ backgroundImage: `url("${imageUrl.replace(/"/g, '%22')}")` }}>
                    <div className="design-room-badge badge-available">{CATEGORY_LABELS[s.category].toUpperCase()}</div>
                  </div>
                  <div className="design-room-body">
                    <h3 className="design-room-title">{s.name}</h3>
                    <p className="design-room-address">★ {s.avgRating.toFixed(1)} ({s.ratingCount} đánh giá)</p>
                    <div className="design-room-footer">
                      <div className="design-room-price">
                        {s.category === 'transport' ? (
                          <strong>Từ {getMinCarOptionPrice(s.carOptions).toLocaleString('vi-VN')}đ</strong>
                        ) : (
                          <>
                            <strong>Từ {s.price.toLocaleString('vi-VN')}đ</strong>
                            <span>/{s.unit}</span>
                          </>
                        )}
                      </div>
                      <span className="design-room-link">Chi tiết →</span>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
