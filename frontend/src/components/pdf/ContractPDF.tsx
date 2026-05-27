import "./ContractPDF.css"

interface Contract {
    _id: string
    room: { name: string; address: string; area: number; type: string }
    monthlyRent: number
    startDate: string
    endDate: string
    representativeName?: string
    representativePhone?: string
    representativeIdCard?: string
    representativeDob?: string
    coResidents?: Array<{ name: string; phone: string; idCard: string; dob: string }>
    signatureA?: string
    signatureB?: string
}

interface Props {
    contract: Contract
}

export default function ContractPDF({ contract }: Props) {

    const formatDate = (d?: string) =>
        d ? new Date(d).toLocaleDateString("vi-VN") : ""

    const start = contract.startDate ? new Date(contract.startDate) : new Date()
    const startDay = start.getDate().toString().padStart(2, '0')
    const startMonth = (start.getMonth() + 1).toString().padStart(2, '0')
    const startYear = start.getFullYear()

    return (
        <div id="pdf-content" className='pdf-body'>

            {/* Header */}
            <div className="pdf-header">
                <div className="pdf-nation">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
                <div className="pdf-motto">Độc lập - Tự do - Hạnh phúc</div>
                <h2 className="pdf-title">HỢP ĐỒNG THUÊ PHÒNG</h2>
            </div>

            <div className="pdf-intro">
                Hôm nay, ngày {startDay} tháng {startMonth} năm {startYear}, tại {contract.room?.address || "........................."}, chúng tôi gồm có:
            </div>

            {/* BÊN A */}
            <div className="pdf-section">
                <h3>BÊN A (BÊN CHO THUÊ NHÀ)</h3>
                <Field label="Ông/Bà/Tổ chức" value="Phòng Trọ DTT" />
                <Field label="Số điện thoại" value="0869 188 512" />
                <Field label="Email" value="duykmhd2311@gmail.com" />
                <Field label="Địa chỉ" value="Hà Đông, Hà Nội" />
            </div>

            {/* BÊN B */}
            <div className="pdf-section">
                <h3>BÊN B (BÊN THUÊ NHÀ)</h3>
                <Field label="Ông/Bà" value={contract.representativeName} />
                <Field label="Ngày sinh" value={formatDate(contract.representativeDob)} />
                <Field label="CCCD/CMND" value={contract.representativeIdCard} />
                <Field label="Số điện thoại" value={contract.representativePhone} />
            </div>

            {/* Thành viên */}
            {(contract.coResidents || []).length > 0 && (
                <div className="pdf-section">
                    <h3>THÀNH VIÊN CÙNG Ở</h3>
                    {(contract.coResidents || []).map((r, i) => (
                        <div key={i} className="pdf-member">
                            <div style={{fontWeight: 'bold', fontStyle: 'italic', marginBottom: '4px'}}>Thành viên {i + 1}:</div>
                            <Field label="Họ và tên" value={r.name} />
                            <Field label="Ngày sinh" value={formatDate(r.dob)} />
                            <Field label="CCCD/CMND" value={r.idCard} />
                            <Field label="Số điện thoại" value={r.phone} />
                        </div>
                    ))}
                </div>
            )}

            <div className="pdf-intro" style={{marginTop: '20px'}}>
                Sau khi bàn bạc, hai bên thống nhất ký kết Hợp đồng thuê phòng với các điều khoản sau đây:
            </div>

            {/* Điều 1: Phòng */}
            <div className="pdf-section">
                <h3>ĐIỀU 1: THÔNG TIN PHÒNG VÀ GIÁ THUÊ</h3>
                <Field label="Tên phòng" value={contract.room?.name} />
                <Field label="Địa chỉ" value={contract.room?.address} />
                <Field label="Diện tích" value={`${contract.room?.area} m²`} />
                <Field label="Giá thuê phòng" value={`${contract.monthlyRent?.toLocaleString('vi-VN')} VNĐ/tháng`} />
            </div>

            {/* Điều 2: Thời gian */}
            <div className="pdf-section">
                <h3>ĐIỀU 2: THỜI HẠN HỢP ĐỒNG</h3>
                <Field label="Ngày bắt đầu" value={formatDate(contract.startDate)} />
                <Field label="Ngày kết thúc" value={formatDate(contract.endDate)} />
            </div>

            {/* Ép xuống trang mới cho phần Điều khoản chi tiết (tránh lỗi cắt ảnh hoặc dính chữ nhỏ) */}
            <div className="html2pdf__page-break"></div>

            {/* Điều 3: Điều khoản */}
            <div className="pdf-section" style={{marginTop: '40px'}}>
                <h3>ĐIỀU 3: QUYỀN VÀ TRÁCH NHIỆM CỦA CÁC BÊN</h3>
                <div className="pdf-terms">
                    <div className="no-break">
                        <p><b>1. Mục đích thuê:</b> Bên B thuê phòng để ở, không sử dụng vào mục đích kinh doanh, sản xuất hay các mục đích trái pháp luật.</p>
                    </div>

                    <div className="no-break">
                        <p><b>2. Thời hạn thuê:</b> Hợp đồng có giá trị theo thời hạn đã nêu ở Điều 2. Sau khi hết hạn, nếu hai bên có nhu cầu tiếp tục, sẽ tiến hành gia hạn hợp đồng mới.</p>
                    </div>

                    <div className="no-break">
                        <p><b>3. Giá thuê và phương thức thanh toán:</b></p>
                        <ul>
                            <li>Giá thuê phòng: {contract.monthlyRent?.toLocaleString('vi-VN')} VNĐ/tháng.</li>
                            <li>Tiền điện: 3.500 VNĐ/Kwh.</li>
                            <li>Tiền nước: 100.000 VNĐ/người/tháng.</li>
                            <li>Thanh toán từ ngày 1 đến ngày 5 hàng tháng.</li>
                        </ul>
                    </div>

                    <div className="no-break">
                        <p><b>4. Trách nhiệm Bên A:</b> Đảm bảo phòng ốc bàn giao đúng tình trạng thỏa thuận. Hỗ trợ sửa chữa các hư hỏng kết cấu do hao mòn tự nhiên.</p>
                    </div>

                    <div className="no-break">
                        <p><b>5. Trách nhiệm Bên B:</b> Giữ gìn vệ sinh chung, tuân thủ nội quy khu trọ. Không tự ý sửa chữa, thay đổi kết cấu phòng khi chưa có sự đồng ý của Bên A.</p>
                    </div>
                </div>
            </div>

            <div className="pdf-intro no-break" style={{marginTop: '20px', fontStyle: 'italic'}}>
                Hợp đồng được lập thành 02 bản có giá trị pháp lý như nhau, mỗi bên giữ 01 bản để thực hiện. Hai bên đã đọc kỹ, hiểu rõ nội dung và hoàn toàn nhất trí ký tên dưới đây.
            </div>

            {/* Chữ ký */}
            <div className="pdf-signature no-break">
                <div className="pdf-sign">
                    <b>ĐẠI DIỆN BÊN A</b>
                    <i>(Ký và ghi rõ họ tên)</i>
                    {contract.signatureA && <img src={contract.signatureA} alt="Chữ ký Bên A" />}
                </div>

                <div className="pdf-sign">
                    <b>ĐẠI DIỆN BÊN B</b>
                    <i>(Ký và ghi rõ họ tên)</i>
                    {contract.signatureB && <img src={contract.signatureB} alt="Chữ ký Bên B" />}
                </div>
            </div>

        </div>
    )
}

/* Component Field Inline */
function Field({ label, value }: { label: string; value?: string }) {
    return (
        <div className="pdf-row">
            <span className="pdf-label">- {label}:</span>
            {value ? (
                <span className="pdf-value">{value}</span>
            ) : (
                <span className="pdf-value-empty"></span>
            )}
        </div>
    )
}