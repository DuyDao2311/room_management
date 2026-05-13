import { Link } from 'react-router-dom'
import { IoMdGlobe } from "react-icons/io";
import { MdOutlineEmail, MdOutlinePhone } from "react-icons/md";

export default function Footer() {
  return (
    <footer className="design-footer">
      <div className="design-footer-inner">

        {/* Cột 1: Thương hiệu */}
        <div className="footer-brand-col">
          <Link to="/" className="footer-brand-name">Phòng Trọ DTT</Link>
          <p className="footer-brand-desc">
            Đơn vị quản lý và cho thuê phòng trọ hàng đầu với phong cách kiến trúc hiện đại và dịch vụ tận tâm.
          </p>
          <div className="footer-socials">
            <a href="https://facebook.com" target="_blank" rel="noreferrer" className="social-icon" title="Facebook">
              <IoMdGlobe size={17} color='#003e68' />
            </a>
            <a href="mailto:duykmhd2311@gmail.com" className="social-icon" title="Email">
              <MdOutlineEmail size={17} color='#003e68' />
            </a>
            <a href="tel:0869188512" className="social-icon" title="Hotline">
              <MdOutlinePhone size={17} color='#003e68' />
            </a>
          </div>
        </div>

        {/* Cột 2: Về chúng tôi */}
        <div className="footer-links-col">
          <h4 className="footer-col-title">VỀ CHÚNG TÔI</h4>
          <ul>
            <li><a href="#">Câu chuyện thương hiệu</a></li>
            <li><a href="#">Đội ngũ quản lý</a></li>
            <li><Link to="/rooms">Cơ hội nghề nghiệp</Link></li>
            <li><a href="#">Hợp tác kinh doanh</a></li>
          </ul>
        </div>

        {/* Cột 3: Hỗ trợ khách hàng */}
        <div className="footer-links-col">
          <h4 className="footer-col-title">HỖ TRỢ KHÁCH HÀNG</h4>
          <ul>
            <li><a href="#">Chính sách bảo mật</a></li>
            <li><a href="#">Điều khoản sử dụng</a></li>
            <li><a href="#">Liên hệ quảng cáo</a></li>
            <li><a href="#">Hỗ trợ kỹ thuật</a></li>
          </ul>
        </div>

        {/* Cột 4: Văn phòng */}
        <div className="footer-contact-col">
          <h4 className="footer-col-title">VĂN PHÒNG CHÍNH</h4>
          <p>Tòa nhà DTT Center, Vạn Phúc, Quận Hà Đông, TP. Hà Nội</p>
          <p className="footer-contact-info">Hotline: <strong>0869 188 512</strong></p>
          <p className="footer-contact-info">Email: <strong>duykmhd2311@gmail.com</strong></p>
        </div>

      </div>

      <div className="footer-bottom">
        <p>© 2026 Phòng Trọ DTT. Bảo lưu mọi quyền.</p>
      </div>
    </footer>
  )
}
