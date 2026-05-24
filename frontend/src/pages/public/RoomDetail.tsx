import { useState, useEffect, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import api from '../../api/axios.ts'
import Spinner from '../../components/ui/Spinner.tsx'
import { useAuth } from '../../contexts/AuthContext.tsx'
import { RiMapPin2Line } from "react-icons/ri";
import FavoriteHeartButton from '../../components/ui/FavoriteHeartButton.tsx'
import { LiaRulerHorizontalSolid } from "react-icons/lia";
import { MdOutlineBedroomParent, MdSecurity, MdOutlinePerson, MdOutlinePhone, MdOutlineMoreTime } from "react-icons/md";
import { FaWifi } from "react-icons/fa";
import { LuCalendarDays } from "react-icons/lu";
import { MdOutlinePeopleAlt, MdDeleteOutline, MdCheckCircleOutline, MdOutlineBusiness, MdOutlineGavel, MdOutlineMeetingRoom, MdPictureAsPdf } from "react-icons/md";
import SignaturePad from '../../components/ui/SignaturePad.tsx'
import FeedbackList from '../../components/ui/FeedbackList.tsx'
import FeedbackForm from '../../components/ui/FeedbackForm.tsx'
import { checkEligibility, getMyFeedback, type Feedback } from '../../api/feedback.ts'

interface Room {
  _id: string
  name: string
  address: string
  price: number
  area: number
  type: string
  status: 'available' | 'occupied' | 'maintenance'
  description: string
  amenities: string[]
  images: string[]
  viewCount: number
}

const STATUS_MAP = {
  available: { label: 'Còn trống', color: '#088373', bg: '#bef2e8' },
  occupied: { label: 'Đã thuê', color: '#dc2626', bg: '#fee2e2' },
  maintenance: { label: 'Đang sửa', color: '#d97706', bg: '#fef3c7' },
}

const AMENITY_ICONS: Record<string, React.ReactNode> = {
  'Wifi': <FaWifi size={20} />, 'WiFi': <FaWifi size={20} />, 'Wifi tốc độ cao': <FaWifi size={20} />,
  'Điều hòa': '❄️',
  'Máy giặt': '🫧', 'Máy giặt chung': '🫧',
  'Ban công': '🌿', 'Ban công riêng': '🌿',
  'Bảo vệ': <MdSecurity size={20} />, 'Bảo vệ 24/7': <MdSecurity size={20} />, 'An ninh 24/7': <MdSecurity size={20} />,
  'Thang máy': '🛗',
  'Bếp': '🍳', 'Bếp riêng': '🍳',
  'Hầm để xe': '🏍️', 'Bãi xe': '🅿️',
  'Tủ lạnh': '🧊',
}

const DEFAULT_IMG = 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=800&q=80'

interface CoResident {
  name: string
  phone: string
  dob: string
  idCard: string
}

const MAX_CO_RESIDENTS = 3

export default function RoomDetail() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const [room, setRoom] = useState<Room | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const [activeImg, setActiveImg] = useState(0)

  // Chỉ gọi API view 1 lần khi mount — dùng useRef tránh double-call trong StrictMode
  const hasTrackedView = useRef(false)

  // Feedback state
  const [feedbackRefresh, setFeedbackRefresh] = useState(0)
  const [myFeedback, setMyFeedback] = useState<Feedback | null>(null)
  const [isEligible, setIsEligible] = useState(false)
  const [showFeedbackForm, setShowFeedbackForm] = useState(false)



  // Booking form state
  const [bookName, setBookName] = useState('')
  const [bookPhone, setBookPhone] = useState('')
  const [bookDate, setBookDate] = useState('')
  const [bookTime, setBookTime] = useState('')
  const [bookNote, setBookNote] = useState('')
  const [bookSent, setBookSent] = useState(false)

  const [bookLoading, setBookLoading] = useState(false)
  const [bookError, setBookError] = useState('')

  // Rental registration modal state
  const [showRentModal, setShowRentModal] = useState(false)
  const [rentSent, setRentSent] = useState(false)
  const [rentLoading, setRentLoading] = useState(false)
  const [rentError, setRentError] = useState('')

  // Main tenant (người đứng tên hợp đồng)
  const [mainName, setMainName] = useState(user?.name || '')
  const [mainPhone, setMainPhone] = useState('')
  const [mainDob, setMainDob] = useState('')
  const [mainIdCard, setMainIdCard] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  // Co-residents
  const [coResidents, setCoResidents] = useState<CoResident[]>([])

  // Chữ ký điện tử của Bên B (tenant ký ngay khi gửi đăng ký)
  const [sigB, setSigB] = useState('')

  const addCoResident = () => {
    if (coResidents.length < MAX_CO_RESIDENTS) {
      setCoResidents(prev => [...prev, { name: '', phone: '', dob: '', idCard: '' }])
    }
  }

  const removeCoResident = (idx: number) => {
    setCoResidents(prev => prev.filter((_, i) => i !== idx))
  }

  const updateCoResident = (idx: number, field: keyof CoResident, value: string) => {
    setCoResidents(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r))
  }

  const handleOpenRentModal = () => {
    setMainName(user?.name || '')
    setMainPhone((user as any)?.phone || '')
    setMainDob('')
    setMainIdCard('')
    setStartDate('')
    setEndDate('')
    setCoResidents([])
    setSigB('')          // reset chữ ký khi mở modal mới
    setRentError('')
    setRentSent(false)
    setShowRentModal(true)
  }

  const handleRentSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setRentLoading(true)
    setRentError('')
    try {
      await api.post('/contracts', {
        room: room?._id,
        tenant: user?._id,
        startDate: startDate,
        endDate: endDate,
        monthlyRent: room?.price,
        representativeName: mainName,
        representativePhone: mainPhone,
        representativeIdCard: mainIdCard,
        representativeDob: mainDob,
        coResidents: coResidents,
        signatureB: sigB || undefined,          // Chữ ký tenant (nếu đã ký)
        isSignedByTenant: sigB ? true : false,  // đánh dấu đã ký
      })
      setRentSent(true)
    } catch (err: any) {
      setRentError(err.response?.data?.message || 'Có lỗi xảy ra. Vui lòng thử lại.')
    } finally {
      setRentLoading(false)
    }
  }

  useEffect(() => {
    if (!id) return
    api.get(`/rooms/${id}`)
      .then(res => setRoom(res.data))
      .catch(() => setError('Không tìm thấy phòng trọ này.'))
      .finally(() => setLoading(false))
  }, [id])

  // Tăng lượt xem — chỉ gọi 1 lần khi component mount, bỏ qua lỗi (fire-and-forget)
  useEffect(() => {
    if (!id || hasTrackedView.current) return
    hasTrackedView.current = true
    api.patch(`/rooms/${id}/view`).catch(() => {})
  }, [id])

  // Kiểm tra eligibility và lấy feedback của tenant hiện tại
  useEffect(() => {
    if (!id || !user || user.role !== 'tenant') return
    checkEligibility(id).then(r => setIsEligible(r.eligible)).catch(() => {})
    getMyFeedback(id).then(f => setMyFeedback(f)).catch(() => {})
  }, [id, user])



  if (loading) return <div className="page-shell"><Spinner /></div>
  if (error || !room) return (
    <div className="page-shell">
      <div className="empty-state">
        <div className="empty-icon">😕</div>
        <h3>{error || 'Không tìm thấy phòng'}</h3>
        <Link to="/rooms" className="button button-primary">← Quay lại danh sách</Link>
      </div>
    </div>
  )

  const s = STATUS_MAP[room.status]
  const imgs = room.images?.length > 0 ? room.images : [DEFAULT_IMG]
  const mainImg = imgs[activeImg] ?? imgs[0]

  const handleBook = async (e: React.FormEvent) => {
    e.preventDefault()
    setBookLoading(true)
    setBookError('')

    try {
      await api.post('/appointments', {
        name: bookName,
        phone: bookPhone,
        date: bookDate,
        time: bookTime,
        note: bookNote,
        room: room._id,
        user: user?._id || null
      })
      setBookSent(true)
      // Tự động clear form sau 5 giây để người dùng có thể gửi yêu cầu khác
      setTimeout(() => {
        setBookSent(false)
        setBookNote('')
      }, 5000)
    } catch (err: any) {
      setBookError(err.response?.data?.message || 'Có lỗi xảy ra khi gửi yêu cầu.')
    } finally {
      setBookLoading(false)
    }
  }

  return (
    <div className="rd-page">
      {/* ── Back link ── */}
      <div className="rd-back-wrap">
        <Link to="/rooms" className="back-link" style={{ color: '#003e68' }}>← Quay lại danh sách phòng</Link>
      </div>

      {/* ── Gallery ── */}
      <div className="rd-gallery">
        {/* Main image */}
        <div
          className="rd-gallery-main"
          style={{ backgroundImage: `url("${mainImg}")` }}
          onClick={() => setPreviewImage(mainImg)}
          title="Click để phóng to"
        >
          <button className="rd-view-all-btn" onClick={e => { e.stopPropagation(); setPreviewImage(mainImg) }}>
            🖼️ Xem tất cả {imgs.length} ảnh
          </button>
          {/* Heart button — same style as /rooms cards */}
          <FavoriteHeartButton room={room} />
        </div>

        {/* Thumbnails */}
        {imgs.length > 1 && (
          <div className="rd-thumbs">
            {imgs.slice(0, 4).map((img, i) => (
              <div
                key={i}
                className={`rd-thumb${activeImg === i ? ' active' : ''}`}
                style={{ backgroundImage: `url("${img}")` }}
                onClick={() => setActiveImg(i)}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Main body: Info + Booking ── */}
      <div className="rd-body">
        {/* LEFT: Info column */}
        <div className="rd-info-col">

          {/* Status + views + price bar */}
          <div className="rd-meta-bar">
            <div className="rd-meta-left">
              <span className="rd-status-badge" style={{ color: s.color, background: s.bg }}>
                {s.label}
              </span>
              <span className="rd-views">👁 {room.viewCount ?? 0} lượt xem</span>

            </div>
            <div className="rd-price">
              <span className="rd-price-num">{(room.price / 1_000_000).toLocaleString('vi-VN', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}tr</span>
              <span className="rd-price-unit">/tháng</span>
            </div>
          </div>

          {/* Name + address */}
          <h1 className="rd-name">{room.name}</h1>
          <p className="rd-address"><RiMapPin2Line size={15} /> {room.address}</p>

          {/* Stats row */}
          <div className="rd-stats">
            <div className="rd-stat">
              <span className="rd-stat-icon"><LiaRulerHorizontalSolid size={25} /></span>
              <div>
                <span className="rd-stat-label">DIỆN TÍCH</span>
                <span className="rd-stat-val">{room.area} m²</span>
              </div>
            </div>
            <div className="rd-stat">
              <span className="rd-stat-icon"><MdOutlineBedroomParent size={25} /></span>
              <div>
                <span className="rd-stat-label">LOẠI PHÒNG</span>
                <span className="rd-stat-val">{room.type}</span>
              </div>
            </div>
            {/* <div className="rd-stat">
              <span className="rd-stat-icon">👤</span>
              <div>
                <span className="rd-stat-label">TỐI ĐA</span>
                <span className="rd-stat-val">2 người</span>
              </div>
            </div> */}
          </div>

          {/* Amenities */}
          {room.amenities?.length > 0 && (
            <div className="rd-section">
              <h3 className="rd-section-title">Tiện ích</h3>
              <div className="rd-amenity-grid">
                {room.amenities.map(a => (
                  <div className="rd-amenity-item" key={a}>
                    <span className="rd-amenity-icon">{AMENITY_ICONS[a] ?? '✅'}</span>
                    <span>{a}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Description */}
          {room.description && (
            <div className="rd-section">
              <h3 className="rd-section-title">Mô tả chi tiết</h3>
              <p className="rd-desc">{room.description}</p>
            </div>
          )}
        </div>

        {/* RIGHT: Booking form */}
        <div className="rd-book-col">
          <div className="rd-book-card">
            <h3 className="rd-book-title">Lên lịch xem phòng</h3>
            <p className="rd-book-subtitle">Để lại thông tin, chúng tôi sẽ liên hệ xác nhận trong vòng 30 phút.</p>

            {bookSent ? (
              <div className="rd-book-success">
                ✅ Đã nhận yêu cầu! Chúng tôi sẽ liên hệ bạn sớm nhất.
              </div>
            ) : (
              <form className="rd-book-form" onSubmit={handleBook}>
                {bookError && <div className="alert alert-error" style={{ marginBottom: '10px' }}>{bookError}</div>}

                <div className="rd-field">
                  <label>Họ và tên</label>
                  <div className="rd-input-wrap">
                    <span className="rd-input-icon" style={{ paddingTop: "8px" }}><MdOutlinePerson size={20} color="#647885ff" /></span>
                    <input
                      type="text"
                      placeholder="Nhập họ và tên"
                      value={bookName}
                      onChange={e => setBookName(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="rd-field">
                  <label>Số điện thoại</label>
                  <div className="rd-input-wrap">
                    <span className="rd-input-icon" style={{ paddingTop: "8px" }}><MdOutlinePhone size={20} color="#647885ff" /></span>
                    <input
                      type="tel"
                      placeholder="Nhập số điện thoại"
                      value={bookPhone}
                      onChange={e => setBookPhone(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="rd-field">
                  <label>Ngày muốn xem</label>
                  <div className="rd-input-wrap">
                    <span className="rd-input-icon" style={{ paddingTop: "8px" }}><LuCalendarDays size={20} color="#647885ff" /></span>
                    <input
                      type="date"
                      value={bookDate}
                      onChange={e => setBookDate(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="rd-field">
                  <label>Thời gian muốn xem</label>
                  <div className="rd-input-wrap">
                    <span className="rd-input-icon" style={{ paddingTop: "8px" }}><MdOutlineMoreTime size={20} color="#647885ff" /></span>
                    <input
                      type="time"
                      value={bookTime}
                      onChange={e => setBookTime(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="rd-field">
                  <label>Ghi chú (Tùy chọn)</label>
                  <textarea
                    placeholder="Vì dụ: Tôi muốn xem vào buổi chiều..."
                    value={bookNote}
                    onChange={e => setBookNote(e.target.value)}
                    rows={3}
                  />
                </div>

                {!user && (
                  <p className="rd-book-login-note">
                    <Link to="/login">Đăng nhập</Link> để đặt lịch nhanh hơn.
                  </p>
                )}

                <button
                  type="submit"
                  className="rd-book-btn"
                  disabled={room.status !== 'available' || bookLoading}
                >
                  {bookLoading ? 'ĐANG GỬI...' : 'ĐẶT LỊCH XEM NGAY'}
                </button>
              </form>
            )}

            {/* Hotline */}
            <div className="rd-hotline">
              <div>
                <span className="rd-hotline-label">HOTLINE HỖ TRỢ</span>
                <span className="rd-hotline-num">0869 188 512</span>
              </div>
              {/* <button className="rd-chat-btn">💬</button> */}
            </div>
          </div>

          {/* Rent button area */}
          {room.status === 'available' && (
            <div className="rd-actions">
              {user ? (
                <>
                  <button className="button button-primary" id="contact-btn" style={{ flex: 1 }}>
                    📞 Liên hệ thuê phòng
                  </button>
                  <button
                    className="button button-primary"
                    id="rent-btn"
                    style={{ flex: 1, background: '#088373' }}
                    onClick={handleOpenRentModal}
                  >
                    🔑 Thuê phòng
                  </button>
                </>
              ) : (
                <Link to="/login" className="button button-primary" id="login-to-contact" style={{ flex: 1, textAlign: 'center' }}>
                  Đăng nhập để thuê phòng
                </Link>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Image Preview Modal ── */}
      {previewImage && (
        <div
          onClick={() => setPreviewImage(null)}
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.88)', display: 'flex', alignItems: 'center',
            justifyContent: 'center', zIndex: 9999, cursor: 'zoom-out'
          }}
        >
          <img
            src={previewImage}
            alt="Room Preview"
            style={{ maxWidth: '90%', maxHeight: '90%', borderRadius: '8px', objectFit: 'contain', boxShadow: '0 10px 40px rgba(0,0,0,0.3)' }}
          />
          <button
            style={{ position: 'absolute', top: '24px', right: '32px', background: 'none', border: 'none', color: 'white', fontSize: '2.5rem', cursor: 'pointer' }}
            onClick={() => setPreviewImage(null)}
          >
            &times;
          </button>
        </div>
      )}

      {/* ── Rental Registration Modal ── */}
      {showRentModal && (
        <div className="rent-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowRentModal(false) }}>
          <div className="rent-modal" style={{ maxWidth: '850px', borderRadius: '0' }}>
            {rentSent ? (
              <div className="rent-modal-success">
                <MdCheckCircleOutline size={56} color="#16a34a" />
                <h3>Gửi hợp đồng thành công!</h3>
                <p>Chúng tôi đã nhận được thông tin của bạn. Admin sẽ xét duyệt và liên hệ sớm nhất.</p>
                <button className="rent-modal-close-btn" onClick={() => setShowRentModal(false)}>Đóng</button>
              </div>
            ) : (
              <form onSubmit={handleRentSubmit}>
                <div className="contract-modal-header">
                  <div className="contract-nation">CỘNG HOÀ XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
                  <div className="contract-motto">Độc lập - Tự do - Hạnh phúc</div>
                  <h2 className="contract-title">HỢP ĐỒNG THUÊ PHÒNG</h2>
                </div>

                <div className="rent-modal-body" style={{ padding: '0 40px' }}>
                  {/* Bên A */}
                  <div className="contract-section">
                    <div className="contract-section-header">
                      <div className="contract-section-icon"><MdOutlineBusiness size={22} /></div>
                      <div className="contract-section-title">BÊN A (Bên cho thuê nhà)</div>
                    </div>
                    <div className="contract-grid">
                      <div className="contract-field">
                        <label>Tên cá nhân/tổ chức</label>
                        <input className="contract-input" type="text" value="Phòng Trọ DTT" readOnly />
                      </div>
                      <div className="contract-field">
                        <label>Số điện thoại</label>
                        <input className="contract-input" type="text" value="0869 188 512" readOnly />
                      </div>
                      <div className="contract-field">
                        <label>Email</label>
                        <input className="contract-input" type="text" value="duykmhd2311@gmail.com" readOnly />
                      </div>
                      <div className="contract-field">
                        <label>Địa chỉ</label>
                        <input className="contract-input" type="text" value="Vạn Phúc, Hà Đông, Hà Nội" readOnly />
                      </div>
                    </div>
                  </div>

                  {/* Bên B */}
                  <div className="contract-section">
                    <div className="contract-section-header">
                      <div className="contract-section-icon"><MdOutlinePerson size={22} color="#0f5cc7" /></div>
                      <div className="contract-section-title">BÊN B (Bên thuê nhà)</div>
                    </div>

                    <div style={{ marginBottom: '24px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                        <div style={{ background: '#e0f2fe', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0284c7' }}>
                          <MdOutlinePerson size={20} />
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#111827' }}>Người đứng tên hợp đồng</div>
                          <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>Thông tin đại diện chính</div>
                        </div>
                      </div>
                      <div className="contract-grid">
                        <div className="contract-field">
                          <label>Họ và tên</label>
                          <input className="contract-input" type="text" placeholder="Nguyễn Văn A" value={mainName} onChange={e => setMainName(e.target.value)} required />
                        </div>
                        <div className="contract-field">
                          <label>Số điện thoại</label>
                          <input className="contract-input" type="tel" placeholder="0987 654 321" value={mainPhone} onChange={e => setMainPhone(e.target.value)} pattern="[0-9]{10}" maxLength={10} required />
                        </div>
                        <div className="contract-field">
                          <label>Ngày sinh</label>
                          <input className="contract-input" type="date" value={mainDob} onChange={e => setMainDob(e.target.value)} required />
                        </div>
                        <div className="contract-field">
                          <label>Số CCCD/CMND</label>
                          <input className="contract-input" type="text" placeholder="012345678912" value={mainIdCard} onChange={e => setMainIdCard(e.target.value)} pattern="[0-9]{12}" maxLength={12} required />
                        </div>
                      </div>
                    </div>

                    <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '24px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{ background: '#ffedd5', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#d97706' }}>
                            <MdOutlinePeopleAlt size={20} />
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#111827' }}>Thành viên cùng ở</div>
                            <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>Tối đa {MAX_CO_RESIDENTS} người (Hiện tại {coResidents.length}/{MAX_CO_RESIDENTS})</div>
                          </div>
                        </div>
                        {coResidents.length < MAX_CO_RESIDENTS && (
                          <button type="button" onClick={addCoResident} style={{ background: 'none', border: 'none', color: '#003e68', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            + Thêm người ở
                          </button>
                        )}
                      </div>

                      {coResidents.map((r, idx) => (
                        <div key={idx} style={{ background: '#fff', border: '1px solid #d1d5db', borderRadius: '8px', padding: '16px', marginBottom: '16px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#374151' }}>Thành viên {idx + 1}</span>
                            <button type="button" onClick={() => removeCoResident(idx)} style={{ background: 'none', border: 'none', color: '#111827', cursor: 'pointer' }}>
                              <MdDeleteOutline size={18} />
                            </button>
                          </div>
                          <div className="contract-grid">
                            <div className="contract-field">
                              <label>Họ và tên</label>
                              <input className="contract-input" type="text" placeholder="Trần Thị B" value={r.name} onChange={e => updateCoResident(idx, 'name', e.target.value)} />
                            </div>
                            <div className="contract-field">
                              <label>Số điện thoại</label>
                              <input className="contract-input" type="tel" placeholder="0987654321" value={r.phone} onChange={e => updateCoResident(idx, 'phone', e.target.value)} pattern="[0-9]{10}" maxLength={10} />
                            </div>
                            <div className="contract-field">
                              <label>Ngày sinh</label>
                              <input className="contract-input" type="date" value={r.dob} onChange={e => updateCoResident(idx, 'dob', e.target.value)} />
                            </div>
                            <div className="contract-field">
                              <label>Số CCCD/CMND</label>
                              <input className="contract-input" type="text" placeholder="002095678901" value={r.idCard} onChange={e => updateCoResident(idx, 'idCard', e.target.value)} pattern="[0-9]{12}" maxLength={12} />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Thông tin phòng */}
                  <div className="contract-section">
                    <div className="contract-section-header">
                      <div className="contract-section-icon"><MdOutlineMeetingRoom size={22} color="#088373" /></div>
                      <div className="contract-section-title" style={{ color: '#088373' }}>Thông tin phòng</div>
                    </div>
                    <div style={{ background: '#fff', borderRadius: '8px', padding: '20px', border: '1px solid #d1d5db' }}>
                      <div style={{ marginBottom: '20px' }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', marginBottom: '4px' }}>Tên phòng</div>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                          <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#111827' }}>{room.name}</div>
                          <div style={{ fontSize: '0.9rem', color: '#4b5563', fontWeight: 500 }}>- {room.address}</div>
                        </div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                        <div>
                          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', marginBottom: '4px' }}>Giá thuê / tháng</div>
                          <div style={{ fontSize: '1rem', fontWeight: 700, color: '#111827' }}>{room.price.toLocaleString('vi-VN')} đ</div>
                        </div>
                        <div>
                          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', marginBottom: '4px' }}>Diện tích</div>
                          <div style={{ fontSize: '1rem', fontWeight: 700, color: '#111827' }}>{room.area} m²</div>
                        </div>
                        <div>
                          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', marginBottom: '4px' }}>Loại phòng</div>
                          <div style={{ fontSize: '1rem', fontWeight: 700, color: '#111827' }}>{room.type}</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Thời hạn hợp đồng */}
                  <div className="contract-section">
                    <div className="contract-section-header">
                      <div className="contract-section-icon"><LuCalendarDays size={22} color="#088373" /></div>
                      <div className="contract-section-title" style={{ color: '#088373' }}>Thời hạn hợp đồng</div>
                    </div>
                    <div style={{ background: '#fff', borderRadius: '8px', padding: '20px', border: '1px solid #d1d5db', display: 'flex', gap: '20px' }}>
                      <div className="contract-field" style={{ flex: 1 }}>
                        <label>Ngày bắt đầu</label>
                        <input className="contract-input" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} required />
                      </div>
                      <div className="contract-field" style={{ flex: 1 }}>
                        <label>Ngày kết thúc</label>
                        <input className="contract-input" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} required />
                      </div>
                    </div>
                  </div>

                  {/* Điều khoản */}
                  <div className="contract-section">
                    <div className="contract-section-header">
                      <div className="contract-section-icon"><MdOutlineGavel size={22} color="#111827" /></div>
                      <div className="contract-section-title">Điều Khoản Hợp Đồng</div>
                    </div>
                    <div className="contract-text-box">
                      <p style={{ margin: '0 0 12px' }}><strong>1. Mục đích thuê:</strong> Bên B thuê phòng để ở, không sử dụng vào mục đích kinh doanh, sản xuất hay các mục đích trái pháp luật.</p>
                      <p style={{ margin: '0 0 12px' }}><strong>2. Thời hạn thuê:</strong> Hợp đồng có giá trị trong vòng 12 tháng kể từ ngày ký. Sau khi hết hạn, nếu hai bên có nhu cầu tiếp tục, sẽ tiến hành gia hạn hợp đồng mới.</p>
                      <p style={{ margin: '0 0 8px' }}><strong>3. Giá thuê và phương thức thanh toán:</strong></p>
                      <ul style={{ margin: '0 0 12px', paddingLeft: '20px' }}>
                        <li>Giá thuê phòng: 5.500.000 VNĐ/tháng.</li>
                        <li>Tiền điện: 3.500 VNĐ/Kwh.</li>
                        <li>Tiền nước: 100.000 VNĐ/người/tháng.</li>
                        <li>Thanh toán từ ngày 1 đến ngày 5 hàng tháng.</li>
                      </ul>
                      <p style={{ margin: '0 0 8px' }}><strong>4. Trách nhiệm của Bên A:</strong> Đảm bảo phòng ốc bàn giao đúng tình trạng thỏa thuận. Hỗ trợ sửa chữa các hư hỏng kết cấu do hao mòn tự nhiên.</p>
                      <p style={{ margin: '0 0 8px' }}><strong>5. Trách nhiệm của Bên B:</strong> Giữ gìn vệ sinh chung, tuân thủ nội quy khu trọ. Không tự ý sửa chữa, thay đổi kết cấu phòng khi chưa có sự đồng ý của Bên A.</p>
                    </div>

                    {/* ── Khu vực chữ ký điện tử ── */}
                    <div className="contract-signatures-section">
                      <div className="contract-signatures-title">CHỮ KÝ CÁC BÊN</div>

                      <div className="contract-signatures">
                        {/* Bên A – Chủ trọ ký sau (hiển thị thông báo chờ) */}
                        <div className="sig-pad-wrapper" style={{ '--sig-accent': '#0f5cc7' } as React.CSSProperties}>
                          <div className="sig-pad-header">
                            <div className="sig-pad-label">BÊN CHO THUÊ (Bên A)</div>
                            <div className="sig-pad-sublabel">(Ký, ghi rõ họ tên)</div>
                          </div>
                          <div style={{
                            minHeight: '140px', display: 'flex', flexDirection: 'column',
                            alignItems: 'center', justifyContent: 'center', gap: '8px',
                            background: '#f8fafc', borderRadius: '10px',
                            border: '1.5px dashed #cbd5e1', color: '#94a3b8',
                            fontSize: '0.82rem', textAlign: 'center', padding: '16px'
                          }}>
                            <span style={{ fontSize: '1.5rem' }}>🔐</span>
                            <span>Chủ trọ sẽ ký sau khi phê duyệt</span>
                          </div>
                        </div>

                        {/* Bên B – Tenant ký ngay */}
                        <SignaturePad
                          label="BÊN THUÊ (Bên B)"
                          subLabel="(Ký, ghi rõ họ tên)"
                          savedSignature={sigB}
                          accentColor="#088373"
                          onSave={(b64) => setSigB(b64)}
                          onClear={() => setSigB('')}
                        />
                      </div>

                      {/* Gợi ý */}
                      <p style={{ fontSize: '0.75rem', color: '#9ca3af', textAlign: 'center', marginTop: '12px', marginBottom: 0 }}>
                        ℹ️ Chữ ký điện tử sẽ được lưu kèm hợp đồng — Bên A (chủ trọ) sẽ ký sau khi phê duyệt.
                      </p>
                    </div>
                  </div>

                  {rentError && <div className="alert alert-error" style={{ marginBottom: '20px' }}>{rentError}</div>}
                </div>

                <div className="contract-footer">
                  <button type="button" className="btn-cancel" onClick={() => setShowRentModal(false)}>HUỶ</button>
                  <button type="button" className="btn-pdf" >
                    <MdPictureAsPdf size={18} /> TẢI XUỐNG BẢN PDF
                  </button>
                  <button type="submit" className="btn-confirm" disabled={rentLoading}>
                    <MdCheckCircleOutline size={18} />
                    {rentLoading ? 'ĐANG GỬI...' : 'XÁC NHẬN'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ── Feedback & Đánh giá ── */}
      {room && (
        <section className="rd-feedback-section">
          {/* Section header */}
          <div className="rd-feedback-header">
            <div>
              <h2 className="rd-feedback-title">⭐ Đánh giá & Nhận xét</h2>
              <p className="rd-feedback-subtitle">
                Nhận xét từ người đã và đang thuê phòng này
              </p>
            </div>
          </div>

          {/* FeedbackList full width: summary trái | cards phải */}
          <FeedbackList
            roomId={room._id}
            currentUserId={user?._id}
            ownFeedbackId={myFeedback?._id}
            onRefreshTrigger={feedbackRefresh}
            summaryLayout="side"
            onEditSuccess={(fb) => {
              setMyFeedback(fb)
              setFeedbackRefresh(v => v + 1)
            }}
          />

          {/* Action row bên dưới — chỉ hiện khi cần */}
          {user?.role === 'tenant' ? (
            isEligible && !myFeedback ? (
              /* Tenant đủ điều kiện, chưa đánh giá → hiển thị button hoặc form */
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
                    existingFeedback={null}
                    onSuccess={() => {
                      setFeedbackRefresh(v => v + 1)
                      getMyFeedback(room._id).then(f => setMyFeedback(f)).catch(() => {})
                      setShowFeedbackForm(false)
                    }}
                    onCancel={() => setShowFeedbackForm(false)}
                  />
                </div>
              ) : (
                <button
                  onClick={() => setShowFeedbackForm(true)}
                  className="rd-write-review-button"
                >
                  ✍️ Viết đánh giá phòng này
                </button>
              )
            ) : !isEligible ? (
              /* Không đủ điều kiện */
              <div className="rd-review-locked rd-review-locked--row">
                <div className="rd-review-locked-icon">🔒</div>
                <div>
                  <div className="rd-review-locked-title">Chưa thể đánh giá</div>
                  <p className="rd-review-locked-desc">
                    Bạn cần đang thuê hoặc đã thuê phòng này trong vòng 7 ngày gần đây.
                  </p>
                </div>
              </div>
            ) : null /* Đã đánh giá — dùng ⋮ để sửa */
          ) : !user ? (
            /* Chưa đăng nhập */
            <div className="rd-review-locked rd-review-locked--row">
              <div className="rd-review-locked-icon">👤</div>
              <div>
                <div className="rd-review-locked-title">Đăng nhập để đánh giá</div>
                <p className="rd-review-locked-desc">
                  Đăng nhập với tài khoản người thuê để gửi đánh giá.
                </p>
              </div>
              <Link to="/login" className="rd-review-login-btn">Đăng nhập</Link>
            </div>
          ) : (
            /* Admin / Staff */
            <div className="rd-review-locked rd-review-locked--row">
              <div className="rd-review-locked-icon">👁️</div>
              <div>
                <div className="rd-review-locked-title">Chế độ xem quản trị</div>
                <p className="rd-review-locked-desc">
                  Truy cập <Link to="/admin/feedback" style={{ color: '#6366f1', fontWeight: 600 }}>Quản lý đánh giá</Link> để kiểm duyệt.
                </p>
              </div>
            </div>
          )}

        </section>
      )}
    </div>
  )
}

