import { useState, useRef, useEffect } from 'react'
import { MdOutlineMeetingRoom, MdOutlineAddPhotoAlternate, MdOutlineVideocam } from 'react-icons/md'
import { useIncident } from '../../hooks/useIncident'
import { useAuth } from '../../contexts/AuthContext'

interface RoomInfo {
  _id: string;
  name: string;
  type: string;
}

interface IncidentProps {
  isOpen: boolean;
  onClose: () => void;
  room: RoomInfo;
  contractId: string;
}

export default function Incident({ isOpen, onClose, room, contractId }: IncidentProps) {
  const { user } = useAuth();
  const { createIncident, loading, error } = useIncident();

  const [category, setCategory] = useState("");
  const [priority, setPriority] = useState("Bình thường");
  const [description, setDescription] = useState("");
  const [images, setImages] = useState<File[]>([]);
  const [video, setVideo] = useState<File | null>(null);
  const [contactPhone, setContactPhone] = useState(user?.phone || "");
  const [availableTime, setAvailableTime] = useState("");

  useEffect(() => {
    if (isOpen && user?.phone && !contactPhone) {
      setContactPhone(user.phone);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, user]);

  // Prevent background scrolling when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!category) return alert("Vui lòng chọn loại sự cố!");
    if (!description.trim()) return alert("Vui lòng nhập mô tả chi tiết!");
    if (!contactPhone.trim()) return alert("Vui lòng nhập số điện thoại liên hệ!");
    if (!availableTime.trim()) return alert("Vui lòng nhập thời gian có nhà!");

    try {
      await createIncident({
        roomId: room._id,
        contractId,
        category,
        priority,
        description,
        contactPhone,
        availableTime,
        images,
        video: video || undefined
      });
      alert('Gửi báo cáo thành công!');
      // Reset form
      setCategory("");
      setPriority("Bình thường");
      setDescription("");
      setImages([]);
      setVideo(null);
      setContactPhone(user?.phone || "");
      setAvailableTime("");
      onClose();
    } catch (err: any) {
      alert(err.message || "Có lỗi xảy ra khi tạo báo cáo.");
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      if (images.length + selectedFiles.length > 5) {
        alert("Bạn chỉ được tải lên tối đa 5 hình ảnh.");
        return;
      }
      setImages(prev => [...prev, ...selectedFiles]);
    }
  };

  const handleVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setVideo(e.target.files[0]);
    }
  };

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
        {error && <div style={{ color: 'white', background: '#ef4444', padding: '12px', borderRadius: '8px', marginBottom: '24px' }}>{error}</div>}

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
            <select 
              value={category} 
              onChange={e => setCategory(e.target.value)}
              style={{ 
              width: '100%', padding: '14px 16px', background: '#e2e8f0', border: '1px solid transparent', borderRadius: '4px', color: '#475569', outline: 'none', appearance: 'none', fontWeight: 500,
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23475569'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
              backgroundRepeat: 'no-repeat', backgroundPosition: 'right 16px center', backgroundSize: '16px'
            }}>
              <option value="">Chọn loại sự cố...</option>
              <option value="Điện">Điện</option>
              <option value="Nước">Nước</option>
              <option value="Nội thất">Nội thất</option>
              <option value="Thiết bị điện tử">Thiết bị điện tử</option>
              <option value="Khác">Khác</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>Mức độ ưu tiên</label>
            <select 
              value={priority} 
              onChange={e => setPriority(e.target.value)}
              style={{ 
              width: '100%', padding: '14px 16px', background: '#e2e8f0', border: '1px solid transparent', borderRadius: '4px', color: '#475569', outline: 'none', appearance: 'none', fontWeight: 500,
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23475569'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
              backgroundRepeat: 'no-repeat', backgroundPosition: 'right 16px center', backgroundSize: '16px'
            }}>
              <option value="Thấp">Thấp</option>
              <option value="Bình thường">Bình thường</option>
              <option value="Cao">Cao</option>
              <option value="Khẩn cấp">Khẩn cấp</option>
            </select>
          </div>
        </div>

        {/* Row 2 */}
        <div style={{ marginBottom: '24px' }}>
          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>Mô tả chi tiết</label>
          <textarea 
            rows={4} 
            placeholder="Vui lòng mô tả chi tiết vấn đề bạn đang gặp phải..." 
            value={description}
            onChange={e => setDescription(e.target.value)}
            style={{ width: '100%', padding: '16px', background: '#e2e8f0', border: '1px solid transparent', borderRadius: '4px', color: '#475569', outline: 'none', resize: 'vertical', fontFamily: 'inherit', fontWeight: 500 }}></textarea>
        </div>

        {/* Row 3 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>Hình ảnh đính kèm ({images.length}/5)</label>
            <div 
              onClick={() => imageInputRef.current?.click()}
              style={{ border: '2px dashed #cbd5e1', background: '#f8fafc', borderRadius: '4px', padding: '32px 24px', textAlign: 'center', cursor: 'pointer' }}>
              <MdOutlineAddPhotoAlternate size={32} color="#94a3b8" style={{ marginBottom: '16px' }} />
              <div style={{ fontSize: '0.85rem', fontWeight: 500, color: '#64748b', marginBottom: '8px' }}>Tải lên ảnh</div>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>PNG, JPG, WEBP</div>
              <input type="file" multiple accept="image/*" ref={imageInputRef} style={{ display: 'none' }} onChange={handleImageChange} />
            </div>
            {images.length > 0 && (
              <div style={{ marginTop: '8px', fontSize: '0.8rem', color: '#64748b' }}>
                Đã chọn {images.length} hình ảnh
              </div>
            )}
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>Video đính kèm {video && "(1/1)"}</label>
            <div 
              onClick={() => videoInputRef.current?.click()}
              style={{ border: '2px dashed #cbd5e1', background: '#f8fafc', borderRadius: '4px', padding: '32px 24px', textAlign: 'center', cursor: 'pointer' }}>
              <MdOutlineVideocam size={32} color="#94a3b8" style={{ marginBottom: '16px' }} />
              <div style={{ fontSize: '0.85rem', fontWeight: 500, color: '#64748b', marginBottom: '8px' }}>Tải video lên</div>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>MP4 (Tối đa 1 video ngắn)</div>
              <input type="file" accept="video/mp4" ref={videoInputRef} style={{ display: 'none' }} onChange={handleVideoChange} />
            </div>
            {video && (
              <div style={{ marginTop: '8px', fontSize: '0.8rem', color: '#64748b' }}>
                Đã chọn video: {video.name.length > 20 ? video.name.substring(0, 20) + "..." : video.name}
              </div>
            )}
          </div>
        </div>

        {/* Row 4 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '40px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>Số điện thoại liên hệ</label>
            <input 
              placeholder="0912 345 678" 
              value={contactPhone}
              onChange={e => setContactPhone(e.target.value)}
              style={{ width: '100%', padding: '14px 16px', background: '#e2e8f0', border: '1px solid transparent', borderRadius: '4px', color: '#475569', outline: 'none', fontWeight: 500 }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>Thời gian có nhà (Dự kiến)</label>
            <input 
              placeholder="VD: Buổi sáng ngày mai, sau 18h..." 
              value={availableTime}
              onChange={e => setAvailableTime(e.target.value)}
              style={{ width: '100%', padding: '14px 16px', background: '#e2e8f0', border: '1px solid transparent', borderRadius: '4px', color: '#475569', outline: 'none', fontWeight: 500 }} />
          </div>
        </div>

        <div style={{ height: '1px', background: '#e2e8f0', margin: '0 0 24px 0' }}></div>

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button onClick={onClose} disabled={loading} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '0.95rem', fontWeight: 600, cursor: 'pointer', padding: '8px 0' }}>Huỷ bỏ</button>
          <button 
            onClick={handleSubmit} 
            disabled={loading}
            style={{ background: '#003e68', color: '#fff', border: 'none', padding: '14px 32px', borderRadius: '6px', fontSize: '0.95rem', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}>
            {loading ? "ĐANG GỬI..." : "GỬI BÁO CÁO"}
          </button>
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
