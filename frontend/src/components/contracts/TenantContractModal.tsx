import { useState, useRef } from 'react'
import api from '../../api/axios.ts'
import SignaturePad from '../ui/SignaturePad.tsx'
import { MdOutlineMeetingRoom, MdOutlinePerson, MdOutlineGavel, MdOutlineBusiness, MdOutlinePeopleAlt, MdPictureAsPdf } from 'react-icons/md'
import { LuCalendarDays } from 'react-icons/lu'
// @ts-ignore
import html2pdf from 'html2pdf.js'

const DEFAULT_SIGNATURE_A = 'data:image/png;base64,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'
interface Contract {
    _id: string
    room: { name: string; address: string; price: number; type: string; area?: number }
    tenant?: { name: string; email: string } | string
    startDate: string
    endDate: string
    monthlyRent: number
    status: string
    signatureA?: string
    signatureB?: string
    isSignedByTenant?: boolean
    representativeName?: string
    representativePhone?: string
    representativeIdCard?: string
    representativeDob?: string
    coResidents?: any[]
}

interface Props {
    contract: Contract
    onClose: () => void
    onSuccess: () => void
}

export default function TenantContractModal({ contract, onClose, onSuccess }: Props) {
    const [signatureB, setSignatureB] = useState(contract.signatureB || '')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const pdfRef = useRef<HTMLDivElement>(null)

    const handleSign = async () => {
        if (!signatureB) {
            setError('Vui lòng ký tên xác nhận.')
            return
        }

        try {
            setLoading(true)
            setError('')
            await api.post(`/contracts/${contract._id}/sign`, {
                signatureB
            })
            alert('Đã ký xác nhận hợp đồng thành công!')
            onSuccess()
        } catch (err: any) {
            const msg = err.response?.data?.message || 'Có lỗi xảy ra khi ký hợp đồng.'
            setError(msg)
        } finally {
            setLoading(false)
        }
    }

    const formatDDMMYYYY = (d: string) => {
        if (!d) return ''
        const date = new Date(d)
        if (isNaN(date.getTime())) return d;
        return date.toLocaleDateString('vi-VN')
    }

    const calculateDuration = (start: string, end: string) => {
        if (!start || !end) return 12;
        const d1 = new Date(start);
        const d2 = new Date(end);
        if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return 12;

        let months = (d2.getFullYear() - d1.getFullYear()) * 12;
        months -= d1.getMonth();
        months += d2.getMonth();
        return months <= 0 ? 0 : months;
    }

    const handleExportPDF = () => {
        if (!pdfRef.current) return
        const opt = {
            margin: 0.5,
            filename: `HopDongThuePhong_${contract.room?.name || 'phong'}.pdf`,
            image: { type: 'jpeg' as 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true },
            jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' as 'portrait' }
        }
        html2pdf().set(opt).from(pdfRef.current).save()
    }

    return (
        <div className="rent-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
            <div className="rent-modal" style={{ maxWidth: '850px', borderRadius: '0', maxHeight: '95vh', overflowY: 'auto' }}>
                <div ref={pdfRef} id="pdf-content">
                    <div className="contract-modal-header">
                        <div className="contract-nation">CỘNG HOÀ XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
                        <div className="contract-motto">Độc lập - Tự do - Hạnh phúc</div>
                        <h2 className="contract-title">HỢP ĐỒNG THUÊ PHÒNG</h2>
                    </div>

                    <div className="rent-modal-body" style={{ padding: '0 40px' }}>
                        {error && (
                            <div style={{ background: '#fef2f2', color: '#991b1b', padding: '12px 16px', borderRadius: '8px', marginBottom: '20px', fontSize: '0.85rem', fontWeight: 600 }}>
                                ⚠️ {error}
                            </div>
                        )}

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
                                        <input className="contract-input" type="text" value={contract.representativeName || ''} readOnly />
                                    </div>
                                    <div className="contract-field">
                                        <label>Số điện thoại</label>
                                        <input className="contract-input" type="tel" value={contract.representativePhone || ''} readOnly />
                                    </div>
                                    <div className="contract-field">
                                        <label>Ngày sinh</label>
                                        <input className="contract-input" type="text" value={formatDDMMYYYY(contract.representativeDob || '')} readOnly />
                                    </div>
                                    <div className="contract-field">
                                        <label>Số CCCD/CMND</label>
                                        <input className="contract-input" type="text" value={contract.representativeIdCard || ''} readOnly />
                                    </div>
                                </div>
                            </div>

                            {(contract.coResidents || []).length > 0 && (
                                <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '24px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                                        <div style={{ background: '#ffedd5', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#d97706' }}>
                                            <MdOutlinePeopleAlt size={20} />
                                        </div>
                                        <div>
                                            <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#111827' }}>Thành viên cùng ở</div>
                                            <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>Hiện tại {(contract.coResidents || []).length} người</div>
                                        </div>
                                    </div>

                                    {(contract.coResidents || []).map((r, idx) => (
                                        <div key={idx} style={{ background: '#fff', border: '1px solid #d1d5db', borderRadius: '8px', padding: '16px', marginBottom: '16px' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#374151' }}>Thành viên {idx + 1}</span>
                                            </div>
                                            <div className="contract-grid">
                                                <div className="contract-field">
                                                    <label>Họ và tên</label>
                                                    <input className="contract-input" type="text" value={r.name || ''} readOnly />
                                                </div>
                                                <div className="contract-field">
                                                    <label>Số điện thoại</label>
                                                    <input className="contract-input" type="tel" value={r.phone || ''} readOnly />
                                                </div>
                                                <div className="contract-field">
                                                    <label>Ngày sinh</label>
                                                    <input className="contract-input" type="text" value={formatDDMMYYYY(r.dob)} readOnly />
                                                </div>
                                                <div className="contract-field">
                                                    <label>Số CCCD/CMND</label>
                                                    <input className="contract-input" type="text" value={r.idCard || ''} readOnly />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
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
                                        <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#111827' }}>{contract.room?.name}</div>
                                        <div style={{ fontSize: '0.9rem', color: '#4b5563', fontWeight: 500 }}>- {contract.room?.address}</div>
                                    </div>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                                    <div>
                                        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', marginBottom: '4px' }}>Giá thuê / tháng</div>
                                        <div style={{ fontSize: '1rem', fontWeight: 700, color: '#111827' }}>{contract.monthlyRent?.toLocaleString('vi-VN')} đ</div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', marginBottom: '4px' }}>Diện tích</div>
                                        <div style={{ fontSize: '1rem', fontWeight: 700, color: '#111827' }}>{contract.room?.area || 0} m²</div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', marginBottom: '4px' }}>Loại phòng</div>
                                        <div style={{ fontSize: '1rem', fontWeight: 700, color: '#111827' }}>{contract.room?.type || 'Phòng trọ'}</div>
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
                                    <input className="contract-input" type="text" value={formatDDMMYYYY(contract.startDate)} readOnly />
                                </div>
                                <div className="contract-field" style={{ flex: 1 }}>
                                    <label>Ngày kết thúc</label>
                                    <input className="contract-input" type="text" value={formatDDMMYYYY(contract.endDate)} readOnly />
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
                                <p style={{ margin: '0 0 12px' }}><strong>2. Thời hạn thuê:</strong> Hợp đồng có giá trị trong vòng {calculateDuration(contract.startDate, contract.endDate)} tháng kể từ ngày ký. Sau khi hết hạn, nếu hai bên có nhu cầu tiếp tục, sẽ tiến hành gia hạn hợp đồng mới.</p>
                                <p style={{ margin: '0 0 8px' }}><strong>3. Giá thuê và phương thức thanh toán:</strong></p>
                                <ul style={{ margin: '0 0 12px', paddingLeft: '20px' }}>
                                    <li>Giá thuê phòng: {contract.monthlyRent?.toLocaleString('vi-VN')} VNĐ/tháng.</li>
                                    <li>Tiền điện: 3.500 VNĐ/Kwh.</li>
                                    <li>Tiền nước: 70.000 VNĐ/người/tháng.</li>
                                    <li>Thanh toán từ ngày 1 đến ngày 5 hàng tháng.</li>
                                </ul>
                                <p style={{ margin: '0 0 8px' }}><strong>4. Trách nhiệm của Bên A:</strong> Đảm bảo phòng ốc bàn giao đúng tình trạng thỏa thuận. Hỗ trợ sửa chữa các hư hỏng kết cấu do hao mòn tự nhiên.</p>
                                <p style={{ margin: '0 0 8px' }}><strong>5. Trách nhiệm của Bên B:</strong> Giữ gìn vệ sinh chung, tuân thủ nội quy khu trọ. Không tự ý sửa chữa, thay đổi kết cấu phòng khi chưa có sự đồng ý của Bên A.</p>
                            </div>

                            {/* ── Khu vực chữ ký điện tử ── */}
                            <div className="contract-signatures-section">
                                <div className="contract-signatures-title">CHỮ KÝ CÁC BÊN</div>
                                <div className="contract-signatures">
                                    {/* Bên A – Bên cho thuê */}
                                    <SignaturePad
                                        label="BÊN CHO THUÊ (Bên A)"
                                        subLabel="(Ký, ghi rõ họ tên)"
                                        savedSignature={contract.signatureA || DEFAULT_SIGNATURE_A}
                                        accentColor="#0f5cc7"
                                        onSave={() => { }}
                                        onClear={() => { }}
                                        readOnly={true}
                                    />

                                    {/* Bên B – Bên thuê */}
                                    <SignaturePad
                                        label="BÊN THUÊ (Bên B)"
                                        subLabel="(Ký, ghi rõ họ tên)"
                                        savedSignature={signatureB}
                                        accentColor="#088373"
                                        onSave={(b64) => setSignatureB(b64)}
                                        onClear={() => setSignatureB('')}
                                        readOnly={contract.status !== 'pending' || contract.isSignedByTenant}
                                    />
                                </div>

                                {/* Nút lưu chữ ký lên server */}
                                {contract.status === 'pending' && !contract.isSignedByTenant && (
                                    <div className="sig-save-row">
                                        <button
                                            type="button"
                                            className="sig-save-btn"
                                            onClick={handleSign}
                                            disabled={loading || !signatureB}
                                        >
                                            {loading ? '⏳ Đang lưu...' : '💾 Xác nhận lưu chữ ký'}
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="contract-footer">
                    <button type="button" className="btn-cancel" onClick={onClose}>ĐÓNG</button>
                    <button type="button" className="btn-pdf" onClick={handleExportPDF}>
                        <MdPictureAsPdf size={18} /> TẢI XUỐNG BẢN PDF
                    </button>
                </div>
            </div>
        </div>
    )
}
