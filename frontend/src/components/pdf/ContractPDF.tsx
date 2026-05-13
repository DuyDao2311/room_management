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

    return (
        <div id="pdf-content" className='pdf-body'>

            {/* Header */}
            <div className="pdf-header">
                <div>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
                <div><b>Độc lập - Tự do - Hạnh phúc</b></div>
                <h2 className="pdf-title">HỢP ĐỒNG THUÊ PHÒNG</h2>
            </div>

            {/* BÊN A */}
            <div className="pdf-section">
                <h3>BÊN A (Bên cho thuê)</h3>
                <div className="pdf-grid">
                    <Field label="Tên" value="Phòng Trọ DTT" />
                    <Field label="SĐT" value="0869 188 512" />
                    <Field label="Email" value="duykmhd2311@gmail.com" />
                    <Field label="Địa chỉ" value="Hà Đông, Hà Nội" />
                </div>
            </div>

            {/* BÊN B */}
            <div className="pdf-section">
                <h3>BÊN B (Bên thuê)</h3>
                <div className="pdf-grid">
                    <Field label="Họ tên" value={contract.representativeName} />
                    <Field label="SĐT" value={contract.representativePhone} />
                    <Field label="Ngày sinh" value={formatDate(contract.representativeDob)} />
                    <Field label="CCCD" value={contract.representativeIdCard} />
                </div>
            </div>

            {/* Thành viên */}
            {(contract.coResidents || []).length > 0 && (
                <div className="pdf-section">
                    <h3>Thành viên cùng ở</h3>
                    {(contract.coResidents || []).map((r, i) => (
                        <div key={i} className="pdf-member">
                            <div className="pdf-member-title">Thành viên {i + 1}</div>
                            <div className="pdf-grid">
                                <Field label="Họ tên" value={r.name} />
                                <Field label="SĐT" value={r.phone} />
                                <Field label="Ngày sinh" value={formatDate(r.dob)} />
                                <Field label="CCCD" value={r.idCard} />
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Phòng */}
            <div className="pdf-section">
                <h3>Thông tin phòng</h3>
                <div className="pdf-grid">
                    <Field label="Tên phòng" value={contract.room?.name} />
                    <Field label="Địa chỉ" value={contract.room?.address} />
                    <Field label="Giá" value={`${contract.monthlyRent?.toLocaleString('vi-VN')} đ`} />
                    <Field label="Diện tích" value={`${contract.room?.area} m²`} />
                </div>
            </div>

            {/* Thời gian */}
            <div className="pdf-section">
                <h3>Thời hạn hợp đồng</h3>
                <div className="pdf-grid">
                    <Field label="Bắt đầu" value={formatDate(contract.startDate)} />
                    <Field label="Kết thúc" value={formatDate(contract.endDate)} />
                </div>
            </div>

            {/* Điều khoản */}
            <div className="pdf-section">
                <h3>Điều khoản hợp đồng</h3>
                <div className="pdf-terms">
                    <div className="no-break">
                        <p><b>1. Mục đích thuê:</b> Bên B thuê phòng để ở, không sử dụng vào mục đích kinh doanh, sản xuất hay các mục đích trái pháp luật.</p>
                    </div>

                    <div className="no-break">
                        <p><b>2. Thời hạn thuê:</b> Hợp đồng có giá trị trong vòng 12 tháng kể từ ngày ký. Sau khi hết hạn, nếu hai bên có nhu cầu tiếp tục, sẽ tiến hành gia hạn hợp đồng mới.</p>
                    </div>

                    <div className="no-break">
                        <p><b>3. Giá thuê và phương thức thanh toán:</b></p>
                        <ul>
                            <li>Giá thuê: {contract.monthlyRent?.toLocaleString()} VNĐ/tháng</li>
                            <li>Tiền điện: 3.500 VNĐ/Kwh</li>
                            <li>Tiền nước: 100.000 VNĐ/người</li>
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

            {/* Chữ ký */}
            <div className="pdf-signature no-break">
                <div className="pdf-sign">
                    <b>BÊN A</b>
                    {contract.signatureA && <img src={contract.signatureA} />}
                </div>

                <div className="pdf-sign">
                    <b>BÊN B</b>
                    {contract.signatureB && <img src={contract.signatureB} />}
                </div>
            </div>

        </div>
    )
}

/* Component Field */
function Field({ label, value }: { label: string; value?: string }) {
    return (
        <div className="pdf-col">
            <div className="pdf-label">{label}</div>
            <div className="pdf-box">{value || ""}</div>
        </div>
    )
}