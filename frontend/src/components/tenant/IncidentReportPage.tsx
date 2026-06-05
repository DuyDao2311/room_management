import { MdOutlineMeetingRoom, MdOutlineAddPhotoAlternate, MdOutlineVideocam } from 'react-icons/md'

interface RoomInfo {
  name: string;
  type: string;
}

interface IncidentProps {
  isOpen: boolean;
  onClose: () => void;
  room: RoomInfo;
}

export default function Incident({ isOpen, onClose, room }: IncidentProps) {
  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999, background: '#f8fafc',
      overflowY: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 20px'
    }}>
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <h2 style={{ fontSize: '2rem', fontWeight: 800, color: '#003e68', margin: '0 0 12px 0' }}>Báo cáo sự cố</h2>
        <p style={{ color: '#6b7280', fontSize: '1rem', margin: 0 }}>Mô tả chi tiết vấn đề để chúng tôi có thể hỗ trợ bạn nhanh nhất.</p>
      </div>

      <div style={{ background: '#fff', borderRadius: '16px', padding: '40px', width: '100%', maxWidth: '680px', boxShadow: '0 10px 40px -10px rgba(0,0,0,0.08)' }}>
        {/* Current Room Card */}
        <div style={{ background: '#f8fafc', border: '1px solid #f1f5f9', borderRadius: '12px', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ width: '48px', height: '48px', background: '#e2e8f0', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0f172a' }}>
              <MdOutlineMeetingRoom size={24} />
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>CĂN HỘ HIỆN TẠI</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>Phòng {room.name} - {room.type}</div>
            </div>
          </div>
          <button style={{ background: 'none', border: 'none', color: '#0284c7', fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer' }}>Thay đổi</button>
        </div>

        {/* Row 1 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>Loại sự cố</label>
            <select style={{ 
              width: '100%', padding: '14px 16px', background: '#e2e8f0', border: '1px solid transparent', borderRadius: '4px', color: '#475569', outline: 'none', appearance: 'none', fontWeight: 500,
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23475569'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
              backgroundRepeat: 'no-repeat', backgroundPosition: 'right 16px center', backgroundSize: '16px'
            }}>
              <option>Chọn loại sự cố...</option>
              <option>Điện</option>
              <option>Nước</option>
              <option>Nội thất</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>Mức độ ưu tiên</label>
            <select style={{ 
              width: '100%', padding: '14px 16px', background: '#e2e8f0', border: '1px solid transparent', borderRadius: '4px', color: '#475569', outline: 'none', appearance: 'none', fontWeight: 500,
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23475569'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
              backgroundRepeat: 'no-repeat', backgroundPosition: 'right 16px center', backgroundSize: '16px'
            }}>
              <option>Bình thường</option>
              <option>Khẩn cấp</option>
            </select>
          </div>
        </div>

        {/* Row 2 */}
        <div style={{ marginBottom: '24px' }}>
          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>Mô tả chi tiết</label>
          <textarea rows={4} placeholder="Vui lòng mô tả chi tiết vấn đề bạn đang gặp phải..." style={{ width: '100%', padding: '16px', background: '#e2e8f0', border: '1px solid transparent', borderRadius: '4px', color: '#475569', outline: 'none', resize: 'vertical', fontFamily: 'inherit', fontWeight: 500 }}></textarea>
        </div>

        {/* Row 3 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>Hình ảnh đính kèm</label>
            <div style={{ border: '2px dashed #cbd5e1', background: '#f8fafc', borderRadius: '4px', padding: '32px 24px', textAlign: 'center', cursor: 'pointer' }}>
              <MdOutlineAddPhotoAlternate size={32} color="#94a3b8" style={{ marginBottom: '16px' }} />
              <div style={{ fontSize: '0.85rem', fontWeight: 500, color: '#64748b', marginBottom: '8px' }}>Tải lên hoặc kéo thả vào đây</div>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>PNG, JPG, GIF up to 10MB</div>
            </div>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>Video đính kèm</label>
            <div style={{ border: '2px dashed #cbd5e1', background: '#f8fafc', borderRadius: '4px', padding: '32px 24px', textAlign: 'center', cursor: 'pointer' }}>
              <MdOutlineVideocam size={32} color="#94a3b8" style={{ marginBottom: '16px' }} />
              <div style={{ fontSize: '0.85rem', fontWeight: 500, color: '#64748b', marginBottom: '8px' }}>Tải video lên (Tối đa 1 video ngắn)</div>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>MP4, MOV up to 50MB</div>
            </div>
          </div>
        </div>

        {/* Row 4 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '40px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>Số điện thoại liên hệ</label>
            <input placeholder="0912 345 678" style={{ width: '100%', padding: '14px 16px', background: '#e2e8f0', border: '1px solid transparent', borderRadius: '4px', color: '#475569', outline: 'none', fontWeight: 500 }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>Thời gian có nhà (Dự kiến)</label>
            <input placeholder="VD: Buổi sáng ngày mai, sau 18h..." style={{ width: '100%', padding: '14px 16px', background: '#e2e8f0', border: '1px solid transparent', borderRadius: '4px', color: '#475569', outline: 'none', fontWeight: 500 }} />
          </div>
        </div>

        <div style={{ height: '1px', background: '#e2e8f0', margin: '0 0 24px 0' }}></div>

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '0.95rem', fontWeight: 600, cursor: 'pointer', padding: '8px 0' }}>Huỷ bỏ</button>
          <button onClick={() => { alert('Gửi báo cáo thành công!'); onClose(); }} style={{ background: '#003e68', color: '#fff', border: 'none', padding: '14px 32px', borderRadius: '6px', fontSize: '0.95rem', fontWeight: 700, cursor: 'pointer' }}>GỬI BÁO CÁO</button>
        </div>
      </div>

      {/* Bottom Warning */}
      <div style={{ marginTop: '24px', background: '#f5f5f4', color: '#6b7280', padding: '16px 24px', borderRadius: '8px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid #e5e5e5' }}>
        <span style={{ color: '#f59e0b', fontSize: '1.1rem' }}>⚠️</span> 
        <span>Trong trường hợp khẩn cấp (cháy nổ, ngập nước nặng), vui lòng gọi ngay hotline: <strong style={{ color: '#111827' }}>1900 8888</strong></span>
      </div>
    </div>
  )
}
