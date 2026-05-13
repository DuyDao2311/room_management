import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../../api/axios.ts'
import consultImg from '../../image/z7729713217703_c59b94e924d550ee4e1ea6ef86b3baba.jpg'
import news1Img from '../../image/tin tức 1.png'
import news2Img from '../../image/tin tức 2.png'
import { RiMapPin2Line } from "react-icons/ri";
import { FaMoneyBills } from "react-icons/fa6";
import { BiBuildingHouse } from "react-icons/bi";
import { IoIosSearch } from "react-icons/io";
import { PiBuildingApartmentFill } from "react-icons/pi";
import { MdSecurity, MdOutlineBedroomParent } from "react-icons/md";
const PRICE_OPTIONS = [
  { value: '', label: 'Giá thuê' },
  { value: 'below-3', label: 'Dưới 3tr' },
  { value: '3-5', label: '3tr - 5tr' },
  { value: 'above-5', label: 'Trên 5tr' },
]

const formatPrice = (price: number) => {
  if (price >= 1000000) return (price / 1000000).toFixed(1).replace('.0', '') + 'tr'
  if (price >= 1000) return (price / 1000).toFixed(0) + 'k'
  return price.toString()
}

const STATUS_MAP = {
  available: { label: 'CÒN PHÒNG', variant: 'success' },
  occupied: { label: 'ĐÃ THUÊ', variant: 'danger' },
  maintenance: { label: 'ĐANG SỬA', variant: 'warning' },
}

const NEWS = [
  {
    id: '1', tag: 'CẨM NANG',
    title: '10 Cách trang trí phòng trọ nhỏ hẹp trở nên lung linh',
    desc: 'Làm thế nào để tối ưu diện tích nhưng vẫn đảm bảo tính thẩm mỹ cho căn phòng trọ cũ...',
    date: '15 Tháng 5, 2024', readTime: '5 phút đọc', img: news1Img, tagClass: 'tag-brown',
    url: 'https://gosaigon.vn/10-cach-decor-trang-tri-phong-tro-nho-dep/'
  },
  {
    id: '2', tag: 'KINH NGHIỆM',
    title: 'Lưu ý quan trọng khi ký hợp đồng thuê phòng trọ',
    desc: 'Đừng bỏ qua những điều khoản này nếu bạn không muốn gặp rắc rối về sau khi thuê...',
    date: '12 Tháng 5, 2024', readTime: '8 phút đọc', img: news2Img, tagClass: 'tag-teal',
    url: 'https://luatcongtam.com.vn/ky-hop-dong-thue-tro-5-dieu-sinh-vien-can-luu-y-de-tranh-rui-ro-phap-ly/'
  },
]

export default function Home() {
  const navigate = useNavigate()
  const [district, setDistrict] = useState('')
  const [price, setPrice] = useState('')
  const [type, setType] = useState('')
  const [featuredRooms, setFeaturedRooms] = useState<any[]>([])

  useEffect(() => {
    api.get('/rooms')
      .then(res => {
        const availableRooms = res.data.filter((r: any) => r.status === 'available')
        setFeaturedRooms(availableRooms.slice(0, 3))
      })
      .catch(console.error)
  }, [])

  const handleDistrictChange = (e: React.ChangeEvent<HTMLSelectElement>) => setDistrict(e.target.value)
  const handlePriceChange = (e: React.ChangeEvent<HTMLSelectElement>) => setPrice(e.target.value)
  const handleTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => setType(e.target.value)

  const handleSearch = () => {
    const params = new URLSearchParams()
    if (district) params.set('district', district)
    if (price) params.set('price', price)
    if (type) params.set('type', type)
    navigate(`/rooms?${params.toString()}`)
  }

  return (
    <>
      {/* Hero */}
      <section className="hero-section">
        <div className="hero-overlay" />
        <div className="hero-content">
          <h1>Tìm Kiếm Không Gian Sống Lý Tưởng Tại Phòng Trọ DTT</h1>
          <p>Trải nghiệm dịch vụ quản lý và cho thuê phòng trọ chuyên nghiệp, mang đến sự an tâm và tiện nghi tuyệt đối cho cuộc sống hiện đại của bạn.</p>
          <div className="hero-search">
            <div className="search-field">
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}>
                <span className="field-icon" style={{ marginTop: '4px' }}><RiMapPin2Line size={20} color='#031924ff' /></span>
                <select className="search-input" value={district} onChange={handleDistrictChange} id="search-district">
                  <option value="">Khu vực (Quận, Huyện)</option>
                  <option value="Quận Hà Đông">Quận Hà Đông</option>
                  <option value="Quận Nam Từ Liêm">Quận Nam Từ Liêm</option>
                  <option value="Quận Long Biên">Quận Long Biên</option>
                  <option value="Quận Thanh Xuân">Quận Thanh Xuân</option>
                </select>
              </div>
            </div>

            <div className="search-divider" />
            <div className="search-field">
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px'
              }}>
                <span className="field-icon" style={{ marginTop: '6px' }}><FaMoneyBills size={20} /></span>
                <select className="search-input" value={price} onChange={handlePriceChange} id="search-price">
                  {PRICE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>

            <div className="search-divider" />

            <div className="search-field">
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px'
              }}>
                <span className="field-icon" style={{ marginTop: '6px' }}><BiBuildingHouse size={20} /></span>
                <select className="search-input" value={type} onChange={handleTypeChange} id="search-type">
                  <option value="">Loại phòng</option>
                  <option value="Studio">Studio</option>
                  <option value="1 phòng ngủ">1 phòng ngủ</option>
                  <option value="Chung cư mini">Chung cư mini</option>
                  <option value="Phòng trọ thường">Phòng trọ thường</option>
                </select>
              </div>

            </div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}>
              <button className="search-btn" onClick={handleSearch} id="search-btn">
                <span style={{ fontSize: '1.1rem', marginTop: '5px' }}><IoIosSearch size={20} /></span> TÌM KIẾM
              </button>
            </div>
          </div>
        </div>
      </section>

      <div className="page-shell">
        <main>
          {/* Value props */}
          <section className="core-values-section">
            <div className="core-values-header">
              <span className="core-subtitle">GIÁ TRỊ CỐT LÕI</span>
              <h2 className="core-title">Tại sao nên chọn Phòng Trọ DTT?</h2>
            </div>
            <div className="value-grid design-value-grid">
              <article className="value-card design-value-card">
                <div className="icon-wrapper icon-bg-blue">
                  <span className="value-icon-new"><PiBuildingApartmentFill size={25} /></span>
                </div>
                <h3>Vị trí đắc địa</h3>
                <p>Hệ thống phòng trọ trải dài tại các khu vực trung tâm, gần trường đại học, khu công nghiệp và tiện ích công cộng.</p>
              </article>
              <article className="value-card design-value-card">
                <div className="icon-wrapper icon-bg-gray">
                  <span className="value-icon-new txt-white"><MdSecurity size={25} /></span>
                </div>
                <h3>An ninh tuyệt đối</h3>
                <p>Hệ thống camera giám sát 24/7, khóa vân tay hiện đại và đội ngũ quản lý chuyên nghiệp đảm bảo an toàn tối đa.</p>
              </article>
              <article className="value-card design-value-card">
                <div className="icon-wrapper icon-bg-orange">
                  <span className="value-icon-new txt-brown"><MdOutlineBedroomParent size={25} /></span>
                </div>
                <h3>Tiện nghi hiện đại</h3>
                <p>Phòng ốc được thiết kế tối ưu, trang bị đầy đủ nội thất từ điều hòa, nóng lạnh đến kệ bếp, tủ quần áo cao cấp.</p>
              </article>
            </div>
          </section>

          {/* Featured rooms */}
          <section className="featured-rooms-section">
            <div className="featured-rooms-header">
              <div className="featured-rooms-titles">
                <span className="core-subtitle">GỢI Ý TỐT NHẤT</span>
                <h2 className="core-title">Phòng Tiêu Biểu</h2>
              </div>
              <Link to="/rooms" className="featured-rooms-link">Xem tất cả phòng trọ &rarr;</Link>
            </div>
            <div className="design-room-grid">
              {featuredRooms.map(room => {
                const amenitiesToDisplay = (room.amenities && room.amenities.length > 0)
                  ? room.amenities
                  : ['Wifi', 'Điều hòa', 'Chỗ để xe'];

                const bgStyle = room.images && room.images.length > 0
                  ? { backgroundImage: `url("${room.images[0]}")` }
                  : { backgroundImage: 'url("https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=800&q=80")' };

                return (
                  <article className="design-room-card" key={room._id}>
                    <div className="design-room-image" style={bgStyle}>
                      <div className={`design-room-badge ${room.status === 'available' ? 'badge-available' : 'badge-full'}`}>
                        {room.status === 'available' ? 'CÒN PHÒNG' : STATUS_MAP[room.status as keyof typeof STATUS_MAP].label}
                      </div>
                    </div>
                    <div className="design-room-body">
                      <h3 className="design-room-title">{room.name}</h3>
                      <p className="design-room-address"><RiMapPin2Line size={15} /> {room.address}</p>
                      <div className="design-room-amenities">
                        {amenitiesToDisplay.slice(0, 3).map((a: string, i: number) => <span key={i}>{a}</span>)}
                      </div>
                      <div className="design-room-footer">
                        <div className="design-room-price">
                          <strong>{formatPrice(room.price)}</strong><span>/tháng</span>
                        </div>
                        <Link to={`/rooms/${room._id}`} className="design-room-link">Chi tiết</Link>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          </section>

          {/* Process */}
          <section className="design-process-section">
            <div className="core-values-header">
              <span className="core-subtitle">QUY TRÌNH</span>
              <h2 className="core-title">Thuê Phòng Dễ Dàng</h2>
            </div>

            <div className="design-process-grid">
              <div className="process-line" />
              {[
                { n: '01', title: 'Tìm kiếm', desc: 'Lựa chọn phòng trọ ưng ý qua website với hình ảnh và thông tin minh bạch.' },
                { n: '02', title: 'Xem phòng', desc: 'Liên hệ hẹn lịch xem phòng thực tế để kiểm tra tiện nghi và không gian sống.' },
                { n: '03', title: 'Ký hợp đồng', desc: 'Thực hiện ký kết hợp đồng điện tử hoặc trực tiếp nhanh chóng, bảo mật.' },
              ].map(step => (
                <div className="design-process-step" key={step.n}>
                  <div className="design-step-number">{step.n}</div>
                  <h3 className="design-step-title">{step.title}</h3>
                  <p className="design-step-desc">{step.desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* News */}
          <section className="design-news-section">
            <div className="design-news-header">
              <h2 className="design-news-title">Tin tức &amp; Cẩm nang</h2>
              <Link to="/news" className="design-news-btn">Tất cả bài viết</Link>
            </div>
            <div className="design-news-grid">
              {NEWS.map(n => (
                <a
                  href={n.url}
                  key={n.id}
                  target="_blank"
                  rel="noreferrer"
                  className="design-news-card-link"
                >
                  <article className="design-news-card">
                    <div
                      className={`design-news-thumb ${n.img.startsWith('news-') ? n.img : ''}`}
                      style={n.img.startsWith('news-') ? {} : { backgroundImage: `url("${n.img}")` }}
                    />
                    <div className="design-news-content">
                      <span className={`design-news-tag ${n.tagClass}`}>{n.tag}</span>
                      <h3>{n.title}</h3>
                      <p>{n.desc}</p>
                      <div className="design-news-meta">
                        <span>{n.date}</span> <span className="meta-dot">&bull;</span> <span>{n.readTime}</span>
                      </div>
                    </div>
                  </article>
                </a>
              ))}
            </div>
          </section>

          {/* CTA */}
          <section className="design-cta-section">
            <div className="design-cta-card">
              <h2>Bắt đầu hành trình tìm kiếm tổ ấm mới của bạn ngay hôm nay</h2>
              <p>Chúng tôi luôn sẵn sàng hỗ trợ bạn tìm kiếm không gian sống phù hợp nhất với phong cách và ngân sách của bạn.</p>
              <div className="design-cta-actions">
                <Link to="https://www.facebook.com/duy.ao.397869/" className="design-btn-primary" target="_blank" rel="noreferrer">LIÊN HỆ NGAY</Link>
                <a href={consultImg} target="_blank" rel="noreferrer" className="design-btn-outline">NHẬN TƯ VẤN MIỄN PHÍ</a>
              </div>
            </div>
          </section>
        </main>
      </div>
    </>
  )
}
