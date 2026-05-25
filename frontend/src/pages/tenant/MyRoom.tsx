import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../../api/axios.ts'
import Spinner from '../../components/ui/Spinner.tsx'
import { MdOutlineLocationOn, MdInfoOutline, MdHistory, MdOutlineConstruction, MdOutlineCheckCircleOutline, MdStarRate } from 'react-icons/md'
import { FaBed, FaWifi } from 'react-icons/fa'
import { CgSmartHomeRefrigerator } from 'react-icons/cg'
import { BiCloset } from 'react-icons/bi'
import { TbAirConditioning } from 'react-icons/tb'
import FeedbackList from '../../components/ui/FeedbackList.tsx'
import FeedbackForm from '../../components/ui/FeedbackForm.tsx'
import { getMyFeedback, checkEligibility, type Feedback } from '../../api/feedback.ts'
import { useAuth } from '../../contexts/AuthContext.tsx'

interface Room {
  _id: string
  name: string
  address: string
  price: number
  area: number
  type: string
  floor?: number
  images: string[]
  amenities: string[]
}

interface Contract {
  _id: string
  room: Room
  startDate: string
  endDate: string
  monthlyRent: number
  status: 'pending' | 'active' | 'expired' | 'terminated'
}

interface Invoice {
  _id: string
  // contract có thể là object (sau populate) hoặc string (chưa populate)
  contract?: { _id: string; room?: { _id: string; name: string; address: string } } | string
  type: 'deposit' | 'service'
  month?: number
  year?: number
  totalAmount: number
  status: 'unpaid' | 'paid' | 'overdue' | 'pending'
  dueDate?: string
  createdAt: string
  paidAt?: string
}

export default function MyRoom() {
  const { user } = useAuth()
  const [contracts, setContracts] = useState<Contract[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Feedback state
  const [myFeedback, setMyFeedback] = useState<Feedback | null>(null)
  const [isEligible, setIsEligible] = useState(false)
  const [showFeedbackForm, setShowFeedbackForm] = useState(false)
  const [feedbackRefresh, setFeedbackRefresh] = useState(0)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [resContracts, resInvoices] = await Promise.all([
          api.get('/contracts/my'),
          api.get('/invoices/my')
        ])
        const activeContracts = resContracts.data.filter((c: Contract) => c.status === 'active' || c.status === 'pending')
        setContracts(activeContracts)
        setInvoices(resInvoices.data)

        // Load feedback sau khi biết roomId
        if (activeContracts.length > 0) {
          const roomId = activeContracts[0].room._id
          const [eligible, fb] = await Promise.allSettled([
            checkEligibility(roomId),
            getMyFeedback(roomId)
          ])
          if (eligible.status === 'fulfilled') setIsEligible(eligible.value.eligible)
          if (fb.status === 'fulfilled') setMyFeedback(fb.value)
        }
      } catch (err) {
        setError('Không thể tải dữ liệu phòng.')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  if (loading) return <div className="page-shell"><Spinner /></div>
  if (error) return <div className="page-shell"><div className="alert alert-error">{error}</div></div>

  if (contracts.length === 0) {
    return (
      <div className="page-shell">
        <div style={{ padding: '40px', textAlign: 'center' }}>
          <h2>Bạn chưa có phòng nào</h2>
          <p style={{ color: '#6b7280', marginBottom: '20px' }}>Hiện tại bạn chưa có hợp đồng thuê phòng nào đang có hiệu lực.</p>
          <Link to="/rooms" className="button button-primary">Tìm phòng ngay</Link>
        </div>
      </div>
    )
  }

  // Để đơn giản, giả sử tenant chỉ có 1 phòng (nếu nhiều thì lấy phòng đầu tiên hoặc có thể map ra nhiều tab)
  const contract = contracts[0]
  const room = contract.room

  // Lấy hóa đơn thuộc đúng contract (so sánh string để tránh ObjectId so sánh sai)
  const contractId = contract._id.toString()
  const roomInvoices = invoices
    .filter(inv => {
      const invContractId = typeof inv.contract === 'object' && inv.contract !== null
        ? inv.contract._id
        : inv.contract
      return invContractId?.toString() === contractId
    })
    .slice(0, 3)

  // Hàm render icon tiện ích
  const renderAmenityIcon = (amenity: string) => {
    const lower = amenity.toLowerCase()
    if (lower.includes('điều hòa') || lower.includes('máy lạnh')) return <TbAirConditioning size={24} color="#3b82f6" />
    if (lower.includes('tủ lạnh')) return <CgSmartHomeRefrigerator size={24} color="#64748b" />
    if (lower.includes('giường')) return <FaBed size={24} color="#d97706" />
    if (lower.includes('tủ quần áo') || lower.includes('tủ đồ')) return <BiCloset size={24} color="#8b5cf6" />
    if (lower.includes('wifi') || lower.includes('internet')) return <FaWifi size={24} color="#10b981" />
    return <MdOutlineCheckCircleOutline size={24} color="#10b981" /> // Default
  }

  return (
    <div className="page-shell">
      <div style={{ maxWidth: '1200px', margin: '0 auto', paddingBottom: '60px' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 800, color: '#111827', marginBottom: '24px' }}>Phòng của tôi</h1>

        {/* Hero Section */}
        <div style={{ position: 'relative', borderRadius: '16px', overflow: 'hidden', height: '320px', marginBottom: '32px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
          <img
            src={room.images && room.images.length > 0 ? room.images[0] : 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267'}
            alt={room.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0) 100%)' }} />
          <div style={{ position: 'absolute', bottom: '32px', left: '32px', right: '32px', color: '#fff' }}>
            <div style={{ display: 'inline-block', background: '#059669', color: '#fff', padding: '4px 12px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.05em', marginBottom: '12px', textTransform: 'uppercase' }}>
              <MdOutlineCheckCircleOutline style={{ verticalAlign: 'text-bottom', marginRight: '4px' }} />
              Đang cư trú
            </div>
            <h2 style={{ fontSize: '2.5rem', fontWeight: 800, margin: '0 0 8px 0', textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>
              {room.name} - {room.type}
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1rem', opacity: 0.9 }}>
              <MdOutlineLocationOn size={20} />
              {room.address}
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2.5fr', gap: '32px' }}>

          {/* Left Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

            {/* Thông tin cơ bản */}
            <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#111827', fontWeight: 700, fontSize: '1.1rem', marginBottom: '20px' }}>
                <MdInfoOutline size={20} color="#6b7280" /> Thông tin cơ bản
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#6b7280', fontSize: '0.9rem' }}>Diện tích</span>
                  <span style={{ fontWeight: 600, color: '#111827' }}>{room.area}m²</span>
                </div>
                <div style={{ width: '100%', height: '1px', background: '#f3f4f6' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#6b7280', fontSize: '0.9rem' }}>Giá</span>
                  <span style={{ fontWeight: 600, color: '#111827' }}>{room.price.toLocaleString('vi-VN')}đ</span>
                </div>
                <div style={{ width: '100%', height: '1px', background: '#f3f4f6' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#6b7280', fontSize: '0.9rem' }}>Ngày nhận phòng</span>
                  <span style={{ fontWeight: 600, color: '#111827' }}>{new Date(contract.startDate).toLocaleDateString('vi-VN')}</span>
                </div>
                <div style={{ width: '100%', height: '1px', background: '#f3f4f6' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#6b7280', fontSize: '0.9rem' }}>Loại phòng</span>
                  <span style={{ fontWeight: 600, color: '#111827' }}>{room.type}</span>
                </div>
              </div>
            </div>

            {/* Lịch sử hóa đơn */}
            <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#111827', fontWeight: 700, fontSize: '1.1rem', marginBottom: '20px' }}>
                <MdHistory size={20} color="#6b7280" /> Lịch sử hóa đơn
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {roomInvoices.length === 0 ? (
                  <div style={{ color: '#6b7280', fontSize: '0.9rem', textAlign: 'center' }}>Chưa có hóa đơn nào</div>
                ) : roomInvoices.map((inv, idx) => (
                  <div key={inv._id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontWeight: 700, color: '#111827', marginBottom: '4px' }}>
                          {inv.type === 'service' && inv.month ? `Tháng ${inv.month.toString().padStart(2, '0')}/${inv.year}` : 'Hóa đơn cọc'}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                          {inv.status === 'paid' && inv.paidAt
                            ? `Đã thu: ${new Date(inv.paidAt).toLocaleDateString('vi-VN')}`
                            : inv.dueDate
                              ? `Hạn thanh toán: ${new Date(inv.dueDate).toLocaleDateString('vi-VN')}`
                              : ''}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 700, color: '#111827', marginBottom: '6px' }}>{inv.totalAmount.toLocaleString('vi-VN')}đ</div>
                        <div style={{
                          display: 'inline-block', padding: '4px 8px', borderRadius: '12px', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase',
                          background: inv.status === 'paid' ? '#d1fae5' : '#fee2e2',
                          color: inv.status === 'paid' ? '#065f46' : '#991b1b'
                        }}>
                          {inv.status === 'paid' ? 'ĐÃ THANH TOÁN' : 'CHƯA THANH TOÁN'}
                        </div>
                      </div>
                    </div>
                    {idx < roomInvoices.length - 1 && <div style={{ width: '100%', height: '1px', background: '#f3f4f6', marginTop: '20px' }} />}
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* Right Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

            {/* Nội thất & Tiện ích */}
            <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '32px' }}>
              <div style={{ color: '#111827', fontWeight: 700, fontSize: '1.2rem', marginBottom: '24px' }}>
                Nội thất & Tiện ích
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '16px' }}>
                {room.amenities && room.amenities.length > 0 ? room.amenities.map((am, idx) => (
                  <div key={idx} style={{ background: '#f9fafb', border: '1px solid #f3f4f6', borderRadius: '8px', padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '12px' }}>
                    {renderAmenityIcon(am)}
                    <span style={{ fontSize: '0.9rem', fontWeight: 500, color: '#374151' }}>{am}</span>
                  </div>
                )) : (
                  <div style={{ color: '#6b7280', fontSize: '0.9rem' }}>Phòng chưa cập nhật tiện ích</div>
                )}
              </div>
            </div>

            {/* Hợp đồng & Hỗ trợ kỹ thuật */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>

              {/* Hợp đồng thuê */}
              <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
                    <div style={{ color: '#111827', fontWeight: 700, fontSize: '1.2rem' }}>Hợp đồng<br />thuê</div>
                    <div style={{ background: '#d1fae5', color: '#065f46', padding: '4px 12px', borderRadius: '20px', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.05em' }}>ĐANG HIỆU LỰC</div>
                  </div>
                  <div style={{ marginBottom: '20px' }}>
                    <div style={{ fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em', marginBottom: '4px' }}>THỜI HẠN HỢP ĐỒNG</div>
                    <div style={{ fontWeight: 600, color: '#111827' }}>
                      {new Date(contract.startDate).toLocaleDateString('vi-VN')} - {new Date(contract.endDate).toLocaleDateString('vi-VN')}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em', marginBottom: '4px' }}>KỲ THANH TOÁN</div>
                    <div style={{ fontWeight: 600, color: '#111827' }}>Mùng 5 hàng tháng</div>
                  </div>
                </div>
                <button style={{ width: '100%', marginTop: '32px', background: '#fff', border: '1px solid #003e68', color: '#003e68', padding: '12px', borderRadius: '6px', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', transition: 'all 0.2s' }}>
                  XEM CHI TIẾT HỢP ĐỒNG
                </button>
              </div>

              {/* Hỗ trợ kỹ thuật */}
              <div style={{ background: '#fafaf9', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '32px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', justifyContent: 'center' }}>
                <div style={{ width: '48px', height: '48px', background: '#fee2e2', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444', marginBottom: '16px' }}>
                  <MdOutlineConstruction size={24} />
                </div>
                <div style={{ color: '#111827', fontWeight: 700, fontSize: '1.1rem', marginBottom: '8px' }}>Cần hỗ trợ kỹ thuật?</div>
                <div style={{ color: '#6b7280', fontSize: '0.85rem', lineHeight: 1.5, marginBottom: '24px' }}>
                  Báo cáo các sự cố về điện, nước, hoặc thiết bị trong phòng để được xử lý nhanh chóng.
                </div>
                <button style={{ width: '100%', background: '#fff', border: '1px solid #fca5a5', color: '#ef4444', padding: '12px', borderRadius: '6px', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'all 0.2s' }}>
                  <MdOutlineConstruction size={18} /> BÁO CÁO SỰ CỐ
                </button>
              </div>

            </div>

            {/* ── Đánh giá phòng ── */}
            <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '32px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#111827', fontWeight: 700, fontSize: '1.2rem', marginBottom: '24px' }}>
                <MdStarRate size={22} color="#f59e0b" /> Đánh giá phòng
              </div>

              <FeedbackList
                roomId={room._id}
                currentUserId={user?._id}
                ownFeedbackId={myFeedback?._id}
                onRefreshTrigger={feedbackRefresh}
                hideSummary={true}
                onEditSuccess={(fb) => setMyFeedback(fb)}
              />

              {/* Form viết / sửa đánh giá */}
              <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid #f3f4f6' }}>
                {isEligible ? (
                  showFeedbackForm ? (
                    <div className="rd-write-review-card">
                      <div className="rd-write-review-header">
                        <span className="rd-write-review-icon">📝</span>
                        <div>
                          <div className="rd-write-review-title">Chia sẻ trải nghiệm</div>
                          <div className="rd-write-review-sub">
                            Đánh giá của bạn giúp những người thuê khác có quyết định tốt hơn
                          </div>
                        </div>
                      </div>
                      <FeedbackForm
                        roomId={room._id}
                        existingFeedback={myFeedback}
                        onSuccess={() => {
                          getMyFeedback(room._id).then(f => setMyFeedback(f)).catch(() => {})
                          setFeedbackRefresh(v => v + 1)
                          setShowFeedbackForm(false)
                        }}
                        onCancel={() => setShowFeedbackForm(false)}
                      />
                    </div>
                  ) : (
                    !myFeedback && (
                      <button
                        onClick={() => setShowFeedbackForm(true)}
                        style={{
                          width: '100%', padding: '12px', background: '#f9fafb',
                          border: '1.5px dashed #d1d5db', borderRadius: '8px',
                          color: '#6b7280', fontWeight: 600, fontSize: '0.9rem',
                          cursor: 'pointer', display: 'flex', alignItems: 'center',
                          justifyContent: 'center', gap: '8px', transition: 'all 0.2s'
                        }}
                        onMouseOver={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#088373'; (e.currentTarget as HTMLButtonElement).style.color = '#088373' }}
                        onMouseOut={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#d1d5db'; (e.currentTarget as HTMLButtonElement).style.color = '#6b7280' }}
                      >
                        ✍️ Viết đánh giá phòng này
                      </button>
                    )
                  )
                ) : (
                  <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: 14, padding: '8px 0' }}>
                    🔒 Bạn cần có hợp đồng active để đánh giá phòng này.
                  </div>
                )}
              </div>
            </div>

          </div>{/* end right column */}

        </div>{/* end grid */}
      </div>
    </div>
  )
}

