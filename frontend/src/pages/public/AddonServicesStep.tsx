import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import Spinner from '../../components/ui/Spinner.tsx'
import { serviceService, type Service } from '../../api/service.service'
import { bookingService } from '../../api/booking.service'

// ── Icon mapping for service categories ──
const SERVICE_CATEGORY_ICONS: Record<string, string> = {
  cleaning: '🧹',
  food: '🍽️',
  laundry: '👔',
  transport: '🏍️',
  spa: '💆',
  maintenance: '🔧',
}

const SERVICE_CATEGORY_DESCS: Record<string, string> = {
  cleaning: 'Làm sạch chuyên sâu, thay ga giường và hút bụi.',
  food: 'Phục vụ bữa ăn tận phòng, đa dạng thực đơn.',
  laundry: 'Giặt, sấy và gấp gọn. Nhận trong 24h.',
  transport: 'Xe tay ga đời mới, bao gồm 2 mũ bảo hiểm.',
  spa: 'Dịch vụ spa thư giãn tại phòng.',
  maintenance: 'Sửa chữa nhỏ, xử lý nhanh chóng.',
}

// ── Types ──
interface SelectedAddon {
  service: Service
  quantity: number
}

interface AddonServicesStepProps {
  room: {
    _id: string
    name: string
    type: string
  }
  checkIn: string
  checkOut: string
  guests: number
  bookingType: string
  /** Total room cost (from parent calcEstimatedPrice) */
  roomTotal: number
  /** Number of time units (e.g. 5 đêm) */
  quantity: number
  /** Unit label (e.g. "đêm", "giờ") */
  unitLabel: string
  /** Called when booking succeeds */
  onSuccess: () => void
  /** Called on error (message is passed) */
  onError: (msg: string) => void
  /** Called to go back to the booking form */
  onBack: () => void
}

export default function AddonServicesStep({
  room,
  checkIn,
  checkOut,
  guests,
  bookingType,
  roomTotal,
  quantity,
  unitLabel,
  onSuccess,
  onError,
  onBack,
}: AddonServicesStepProps) {
  // ── State ──
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedAddons, setSelectedAddons] = useState<Record<string, SelectedAddon>>({})
  const [submitting, setSubmitting] = useState(false)

  // ── Fetch services on mount ──
  useEffect(() => {
    setLoading(true)
    serviceService
      .getServices()
      .then(res => setServices(res.data.filter((s: Service) => s.isActive && !s.usesVariants)))
      .catch(() => setServices([]))
      .finally(() => setLoading(false))
  }, [])

  // ── Toggle addon on/off ──
  const toggleAddon = (service: Service) => {
    setSelectedAddons(prev => {
      const copy = { ...prev }
      if (copy[service._id]) {
        delete copy[service._id]
      } else {
        copy[service._id] = { service, quantity: 1 }
      }
      return copy
    })
  }

  // ── Update quantity ──
  const updateAddonQty = (serviceId: string, delta: number) => {
    setSelectedAddons(prev => {
      const item = prev[serviceId]
      if (!item) return prev
      const newQty = Math.max(1, item.quantity + delta)
      return { ...prev, [serviceId]: { ...item, quantity: newQty } }
    })
  }

  // ── Totals ──
  const totalAddonCost = Object.values(selectedAddons).reduce(
    (sum, item) => sum + item.service.price * item.quantity,
    0
  )
  const grandTotal = roomTotal + totalAddonCost

  // ── Format dates ──
  const fmtDate = (iso: string) => {
    if (!iso) return ''
    const d = new Date(iso)
    return `${d.getDate()}/${d.getMonth() + 1}`
  }

  // ── Submit booking + addon service bookings ──
  const handleFinalBooking = async () => {
    setSubmitting(true)
    try {
      // Create room booking with addon services included in a single API call
      const addonList = Object.values(selectedAddons).map(addon => ({
        serviceId: addon.service._id,
        quantity: addon.quantity,
        scheduledAt: checkIn,
        note: `Đặt kèm phòng ${room.name}`,
      }))

      await bookingService.createBooking({
        roomId: room._id,
        checkInDateTime: checkIn,
        checkOutDateTime: checkOut,
        guests,
        ...(bookingType && { bookingType }),
        services: addonList
      })

      onSuccess()
    } catch (err: any) {
      onError(err.response?.data?.message || 'Có lỗi xảy ra, không thể đặt phòng.')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Render ──
  return (
    <div className="addon-services-overlay">
      <div className="addon-services-container">
        {/* ── Left: Service cards ── */}
        <div className="addon-left-col">
          <div className="addon-header">
            <div className="addon-header-row">
              <h2>Dịch vụ bổ sung</h2>
              <Link to="/services" className="addon-price-link">
                Tham khảo bảng giá
              </Link>
            </div>
            <p className="addon-header-subtitle">
              Cá nhân hóa trải nghiệm lưu trú của bạn.
            </p>
          </div>

          {loading ? (
            <Spinner label="Đang tải dịch vụ..." />
          ) : services.length === 0 ? (
            <div className="addon-empty">
              <div className="addon-empty-icon">🧺</div>
              <p>Chưa có dịch vụ bổ sung nào.</p>
            </div>
          ) : (
            services.map(svc => {
              const isSelected = !!selectedAddons[svc._id]
              return (
                <div key={svc._id}>
                  <div
                    className={`addon-service-card ${isSelected ? 'active' : ''}`}
                    onClick={() => toggleAddon(svc)}
                  >
                    <div className={`addon-service-icon ${svc.category}`}>
                      {SERVICE_CATEGORY_ICONS[svc.category] || '📦'}
                    </div>
                    <div className="addon-service-info">
                      <div className="addon-service-name">{svc.name}</div>
                      <p className="addon-service-desc">
                        {svc.description || SERVICE_CATEGORY_DESCS[svc.category] || ''}
                      </p>
                    </div>
                    <div className="addon-service-right">
                      <div className="addon-service-price">
                        <span className="addon-service-price-num">
                          {svc.price.toLocaleString('vi-VN')}đ
                        </span>
                        <span className="addon-service-price-unit"> /{svc.unit}</span>
                      </div>
                      <label className="addon-toggle" onClick={e => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleAddon(svc)}
                        />
                        <span className="addon-toggle-slider" />
                      </label>
                    </div>
                  </div>
                  {isSelected && (
                    <div className="addon-quantity-row" style={{ marginLeft: 68, marginBottom: 4 }}>
                      <label>Số lượng ({svc.unit}):</label>
                      <button
                        type="button"
                        className="addon-qty-btn"
                        disabled={selectedAddons[svc._id].quantity <= 1}
                        onClick={() => updateAddonQty(svc._id, -1)}
                      >
                        −
                      </button>
                      <span className="addon-qty-val">{selectedAddons[svc._id].quantity}</span>
                      <button
                        type="button"
                        className="addon-qty-btn"
                        onClick={() => updateAddonQty(svc._id, 1)}
                      >
                        +
                      </button>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>

        {/* ── Right: Booking summary ── */}
        <div className="addon-summary-card">
          <div className="addon-summary-title">Tóm tắt đặt phòng</div>

          <div className="addon-summary-room-row">
            <p className="addon-summary-room-name">
              {room.name} - {room.type}
            </p>
            <div className="addon-summary-room-dates">
              <div>
                {fmtDate(checkIn)} – {fmtDate(checkOut)}
              </div>
              <div style={{ fontSize: '0.78rem', color: '#9ca3af' }}>
                {quantity} {unitLabel}
              </div>
            </div>
          </div>
          <div className="addon-summary-guests">👤 {guests} người</div>

          <div className="addon-summary-line">
            <span>
              Giá thuê cơ bản ({quantity} {unitLabel})
            </span>
            <span className="addon-summary-line-val">
              {roomTotal.toLocaleString('vi-VN')}đ
            </span>
          </div>

          {/* Selected services */}
          {Object.keys(selectedAddons).length > 0 && (
            <>
              <div className="addon-summary-services-title">Dịch vụ đã chọn</div>
              {Object.values(selectedAddons).map(item => (
                <div key={item.service._id} className="addon-summary-service-item">
                  <span>
                    {item.service.name} ({item.quantity} {item.service.unit})
                  </span>
                  <span>
                    {(item.service.price * item.quantity).toLocaleString('vi-VN')}đ
                  </span>
                </div>
              ))}
            </>
          )}

          <div className="addon-summary-divider" />

          <div className="addon-summary-total">
            <span className="addon-summary-total-label">Tổng thanh toán</span>
            <div>
              <span className="addon-summary-total-val">
                {grandTotal.toLocaleString('vi-VN')}
              </span>
              <span className="addon-summary-total-currency">đ</span>
            </div>
          </div>

          <button
            className="addon-cta-btn"
            onClick={handleFinalBooking}
            disabled={submitting}
          >
            {submitting ? 'ĐANG XỬ LÝ...' : 'TIẾN HÀNH ĐẶT PHÒNG →'}
          </button>
          <button
            className="addon-back-btn"
            onClick={onBack}
            disabled={submitting}
          >
            Quay lại
          </button>
        </div>
      </div>
    </div>
  )
}
