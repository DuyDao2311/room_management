import { useState, useEffect } from "react";
import { FiX, FiCheckCircle, FiPlayCircle, FiTool, FiDollarSign, FiMapPin, FiFlag, FiFileText, FiImage, FiPhone, FiHome, FiMessageSquare, FiClock, FiVideo } from "react-icons/fi";
import {
  getIncidentTimeline,
  updateIncidentStatus,
  rateIncident
} from "../../api/incident.service";
import type { Incident, IncidentTimelineEntry } from "../../api/incident.service";
import StarRating from "../ui/StarRating";

interface IncidentDetailProps {
  incident: Incident;
  onClose: () => void;
  userRole: string;
}

const statusMap: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: "Chờ xử lý", color: "#b45309", bg: "#fef3c7" },
  assigned: { label: "Đã tiếp nhận", color: "#0369a1", bg: "#e0f2fe" },
  in_progress: { label: "Đang xử lý", color: "#b45309", bg: "#fde68a" },
  resolved: { label: "Đã xử lý", color: "#15803d", bg: "#dcfce3" },
  closed: { label: "Đóng", color: "#4b5563", bg: "#f3f4f6" },
  rejected: { label: "Từ chối", color: "#b91c1c", bg: "#fee2e2" },
};

const priorityStyles: Record<string, { bg: string; text: string; dot: string }> = {
  "Thấp": { bg: "#f0fdf4", text: "#166534", dot: "#22c55e" },
  "Bình thường": { bg: "#f1f5f9", text: "#475569", dot: "#64748b" },
  "Cao": { bg: "#fff7ed", text: "#c2410c", dot: "#f97316" },
  "Khẩn cấp": { bg: "#fef2f2", text: "#b91c1c", dot: "#ef4444" },
};

const formatDateTime = (dateString: string) => {
  const d = new Date(dateString);
  const time = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const date = d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  return `${time} ${date}`;
};

function getInitials(name: string) {
  if (!name) return "U";
  const parts = name.trim().split(" ");
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
}

export default function IncidentDetail({ incident, onClose, userRole }: IncidentDetailProps) {
  const [timeline, setTimeline] = useState<IncidentTimelineEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");

  // States for rating
  const [rating, setRating] = useState(0);
  const [ratingComment, setRatingComment] = useState("");
  const [localIncident, setLocalIncident] = useState<Incident>(incident);

  useEffect(() => {
    setLocalIncident(incident);
  }, [incident]);

  // States for actions
  const [showResolveForm, setShowResolveForm] = useState(false);
  const [note, setNote] = useState("");
  const [repairCost, setRepairCost] = useState("");
  const [resolutionNote, setResolutionNote] = useState("");
  const [afterImages, setAfterImages] = useState<File[]>([]);

  useEffect(() => {
    fetchTimeline();
  }, [incident._id]);

  const fetchTimeline = async () => {
    try {
      setLoading(true);
      const data = await getIncidentTimeline(incident._id);
      setTimeline(data);
    } catch (err: any) {
      console.error(err);
      setError("Không thể tải lịch sử sự cố.");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (status: string) => {
    try {
      setActionLoading(true);
      setError("");

      let costNum = 0;
      if (status === "resolved") {
        if (!resolutionNote) {
          setError("Vui lòng nhập ghi chú sửa chữa");
          setActionLoading(false);
          return;
        }
        costNum = parseFloat(repairCost) || 0;
      }

      await updateIncidentStatus(incident._id, status, note, costNum, resolutionNote, afterImages);
      onClose(); // Close modal on success
    } catch (err: any) {
      setError(err.response?.data?.message || "Cập nhật thất bại");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRate = async () => {
    if (rating === 0) {
      setError("Vui lòng chọn số sao để đánh giá.");
      return;
    }
    try {
      setActionLoading(true);
      setError("");
      const updatedIncident = await rateIncident(localIncident._id, { rating, comment: ratingComment });
      setLocalIncident(updatedIncident);
      
      // Có thể thêm tính năng tự động chuyển state sang closed ở đây nếu cần gọi updateIncidentStatus, 
      // nhưng backend rateIncident không tự động update status. Có thể gọi cập nhật nếu cần.
    } catch (err: any) {
      setError(err.response?.data?.message || "Đánh giá thất bại");
    } finally {
      setActionLoading(false);
    }
  };

  const statusInfo = statusMap[localIncident.status] || statusMap.pending;
  const priorityInfo = priorityStyles[localIncident.priority] || priorityStyles["Bình thường"];

  const tenantName = typeof localIncident.tenant === 'object' ? localIncident.tenant.name : "Khách thuê";
  const tenantPhone = typeof localIncident.tenant === 'object' ? localIncident.tenant.phone : localIncident.contactPhone;

  return (
    <div className="incident-modal-overlay">
      <div className="incident-modal-content" style={userRole === 'tenant' ? { maxWidth: '600px', background: '#f8fafc', padding: 0, position: 'relative', overflow: 'hidden' } : {}}>

        {/* Modal Header Actions for Admin/Staff */}
        {userRole !== 'tenant' && (
          <div className="incident-modal-header-actions">
            <button onClick={onClose} disabled={actionLoading} className="incident-modal-close-btn">
              <FiX size={24} />
            </button>
          </div>
        )}
        {userRole === 'tenant' && (
          <div style={{ position: 'absolute', right: '12px', top: '12px', zIndex: 20 }}>
            <button 
              onClick={onClose} 
              disabled={actionLoading} 
              style={{ background: 'transparent', color: '#6b7280', border: 'none', padding: '4px', cursor: 'pointer', display: 'flex' }}
            >
              <FiX size={24} />
            </button>
          </div>
        )}

        {userRole === "tenant" ? (
          <div style={{ padding: '40px 24px 24px 24px', maxHeight: '90vh', overflowY: 'auto' }}>
            {/* Staff Card */}
            {incident.assignedStaff ? (
              <div style={{ background: '#fff', borderRadius: '16px', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px', borderLeft: '4px solid #003e68', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <img src={incident.assignedStaff.avatar || "https://ui-avatars.com/api/?name=" + encodeURIComponent(incident.assignedStaff.name)} alt="avatar" style={{ width: '48px', height: '48px', borderRadius: '8px', objectFit: 'cover' }} />
                  <div>
                    <div style={{ fontWeight: 700, color: '#111827', fontSize: '1rem', marginBottom: '4px' }}>{incident.assignedStaff.name}</div>
                    <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>Nhân viên bảo trì được phân công</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button style={{ width: '36px', height: '36px', borderRadius: '8px', border: '1px solid #e5e7eb', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#003e68' }} onClick={() => window.location.href = `tel:${incident.assignedStaff?.phone}`}>
                    <FiPhone size={18} />
                  </button>
                  <button style={{ width: '36px', height: '36px', borderRadius: '8px', border: '1px solid #e5e7eb', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#003e68' }} onClick={() => window.open(`https://zalo.me/${incident.assignedStaff?.phone}`, '_blank')}>
                    <FiMessageSquare size={18} />
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ background: '#fff', borderRadius: '16px', padding: '16px', display: 'flex', alignItems: 'center', marginBottom: '32px', borderLeft: '4px solid #f59e0b', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', color: '#b45309', fontWeight: 600 }}>
                Đang chờ phân công nhân viên bảo trì...
              </div>
            )}

            {/* Rating Section for Tenant */}
            {(localIncident.status === "resolved" || localIncident.status === "closed") && (
              <div style={{ background: '#fff', borderRadius: '16px', padding: '32px', marginBottom: '32px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#003e68', marginBottom: '24px', marginTop: 0 }}>Đánh giá dịch vụ sửa chữa</h2>
                
                {localIncident.rating ? (
                  <div style={{ background: '#f8fafc', padding: '24px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
                      <div style={{ fontWeight: 600, color: '#334155' }}>Đánh giá của bạn:</div>
                      <StarRating value={localIncident.rating} size="lg" />
                    </div>
                    {localIncident.ratingComment && (
                      <div style={{ fontStyle: 'italic', color: '#475569', background: '#fff', padding: '16px', borderRadius: '8px', borderLeft: '3px solid #cbd5e1' }}>
                        "{localIncident.ratingComment}"
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    {error && <div className="incident-error-msg" style={{ marginBottom: '16px' }}>{error}</div>}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                      <div>
                        <div style={{ marginBottom: '12px', fontWeight: 600, color: '#334155' }}>Chất lượng phục vụ:</div>
                        <StarRating value={rating} onChange={setRating} size="lg" />
                      </div>
                      <div>
                        <div style={{ marginBottom: '8px', fontWeight: 600, color: '#334155' }}>Nhận xét (Tùy chọn):</div>
                        <textarea
                          value={ratingComment}
                          onChange={(e) => setRatingComment(e.target.value)}
                          placeholder="Nhân viên nhiệt tình, xử lý nhanh..."
                          style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', minHeight: '80px', fontFamily: 'inherit' }}
                        />
                      </div>
                      <button 
                        onClick={handleRate} 
                        disabled={actionLoading || rating === 0}
                        style={{ background: rating > 0 ? '#10b981' : '#94a3b8', color: 'white', border: 'none', padding: '12px 24px', borderRadius: '8px', fontWeight: 600, cursor: rating > 0 ? 'pointer' : 'not-allowed', alignSelf: 'flex-start', transition: 'all 0.2s' }}
                      >
                        {actionLoading ? 'Đang gửi...' : 'GỬI ĐÁNH GIÁ'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Timeline */}
            <div style={{ background: '#fff', borderRadius: '16px', padding: '32px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#003e68', marginBottom: '32px', marginTop: 0 }}>Lịch sử (Timeline)</h2>

              {loading ? (
                <div className="incident-loading-text">Đang tải...</div>
              ) : (
                <div className="incident-timeline-container" style={{ marginLeft: '12px' }}>
                  {timeline.map((entry, index) => {
                    const statusConfig = statusMap[entry.status] || statusMap.pending;
                    const isLast = index === timeline.length - 1;

                    return (
                      <div key={entry._id} className="incident-timeline-item" style={{ paddingBottom: isLast ? '0' : '32px' }}>
                        <div className="incident-timeline-dot" style={{ background: statusConfig.color }}></div>

                        <div className="incident-timeline-time" style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', color: '#6b7280', marginBottom: '6px' }}>
                          <FiClock size={12} /> {formatDateTime(entry.createdAt)}
                        </div>

                        <div style={{ fontWeight: 700, color: statusConfig.color, fontSize: '0.95rem', marginBottom: '4px' }}>
                          {statusConfig.label}
                        </div>
                        <div style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: entry.note ? '12px' : '0' }}>
                          {entry.createdBy?.name || "Hệ thống"} {entry.createdBy?.role ? `(${entry.createdBy.role === 'admin' || entry.createdBy.role === 'staff' ? 'BQL' : entry.createdBy.role === 'tenant' ? 'Người thuê' : 'Nhân viên bảo trì'})` : '(Tự động phân công)'}
                        </div>

                        {entry.note && (
                          <div className="incident-timeline-bubble" style={{ background: '#f9fafb', border: '1px solid #f3f4f6', padding: '16px', borderRadius: '8px', fontSize: '0.9rem', color: '#4b5563', lineHeight: 1.5, position: 'relative' }}>
                            {entry.note}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {localIncident.status !== 'closed' && localIncident.status !== 'resolved' && localIncident.status !== 'rejected' && (
                    <div className="incident-timeline-pending">
                      <div className="incident-timeline-dot-gray"></div>
                      <div className="incident-timeline-pending-text">Chờ xử lý tiếp theo...</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          <>
            <div className="incident-modal-body">
              {error && <div className="incident-error-msg">{error}</div>}

              {/* Top Header Card */}
              <div className="incident-top-card">
                <div>
                  <div className="incident-top-left-row1">
                    <h1 className="incident-top-title">{localIncident.ticketCode}</h1>
                    <span className="incident-top-status" style={{ background: statusInfo.bg, color: statusInfo.color }}>
                      <span className="incident-top-status-dot" style={{ background: statusInfo.color }}></span>
                      {statusInfo.label}
                    </span>
                  </div>
                  <div className="incident-top-left-row2">
                    <div className="incident-top-icon-text">
                      <FiHome size={18} /> Phòng {localIncident.room?.name || "N/A"}
                    </div>
                    <span className="incident-top-dot-divider">•</span>
                    <div className="incident-top-icon-text">
                      <FiMapPin size={18} /> {localIncident.district || localIncident.room?.district || "Khu vực chung"}
                    </div>
                  </div>
                </div>
                <div className="incident-top-right">
                  <div className="incident-top-priority-label">Mức độ ưu tiên</div>
                  <div className="incident-top-priority-badge" style={{ background: priorityInfo.bg, color: priorityInfo.text }}>
                    <FiFlag /> {localIncident.priority || "Bình thường"}
                  </div>
                </div>
              </div>

              <div className="incident-grid-layout">

                {/* Left Column */}
                <div>
                  <div className="incident-section-header">
                    <div className="incident-section-bar-blue"></div>
                    <h2 className="incident-section-title">Thông tin chi tiết</h2>
                  </div>

                  {/* Card 1: Meta info */}
                  <div className="incident-card">
                    <div className="incident-info-grid">
                      <div>
                        <div className="incident-label-small">Loại sự cố</div>
                        <div className="incident-value-bold">{localIncident.category}</div>
                      </div>
                      <div>
                        <div className="incident-label-small">Thời gian rảnh của khách</div>
                        <div className="incident-value-bold">{localIncident.availableTime}</div>
                      </div>
                    </div>

                    <div className="incident-divider"></div>

                    <div style={{ marginBottom: '20px' }}>
                      <div className="incident-label-small">Người báo (Người thuê)</div>
                      <div className="incident-user-block">
                        <div className="incident-avatar-gray">
                          {getInitials(tenantName)}
                        </div>
                        <div>
                          <div className="incident-user-name">{tenantName}</div>
                          <div className="incident-user-phone">
                            <FiPhone size={14} /> {tenantPhone}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="incident-divider"></div>

                    <div>
                      <div className="incident-label-small">Nhân viên phụ trách</div>
                      {localIncident.assignedStaff ? (
                        <div className="incident-staff-box">
                          <div className="incident-avatar-green">
                            {getInitials(localIncident.assignedStaff.name)}
                          </div>
                          <div>
                            <div className="incident-staff-name">{localIncident.assignedStaff.name}</div>
                            <div className="incident-staff-role">Kỹ thuật viên</div>
                          </div>
                        </div>
                      ) : (
                        <div className="incident-unassigned">Chưa phân công</div>
                      )}
                    </div>
                  </div>

                  {/* Card 2: Description */}
                  <div className="incident-card">
                    <div className="incident-card-header">
                      <FiFileText size={16} /> Mô tả chi tiết
                    </div>
                    <div className="incident-desc-box">
                      {localIncident.description}
                    </div>
                  </div>

                  {/* Card 3: Images */}
                  {localIncident.images && localIncident.images.length > 0 && (
                    <div className="incident-card">
                      <div className="incident-card-header">
                        <FiImage size={16} /> Hình ảnh đính kèm
                      </div>
                      <div className="incident-image-grid">
                        {localIncident.images.map((img, i) => (
                          <a key={i} href={img} target="_blank" rel="noopener noreferrer" className="incident-image-item">
                            <img src={img} alt={`Incident image ${i}`} />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Card 4: Videos (Admin/Staff only as requested) */}
                  {userRole !== 'tenant' && localIncident.videos && localIncident.videos.length > 0 && (
                    <div className="incident-card">
                      <div className="incident-card-header">
                        <FiVideo size={16} /> Video đính kèm
                      </div>
                      <div className="incident-image-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
                        {localIncident.videos.map((vid, i) => (
                          <video 
                            key={i} 
                            src={vid} 
                            controls 
                            style={{ width: '100%', borderRadius: '8px', border: '1px solid #e5e7eb', maxHeight: '200px', objectFit: 'cover' }} 
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Rating Card for Admin/Staff View */}
                  {localIncident.rating && userRole !== "tenant" && (
                    <div className="incident-card" style={{ borderLeft: '4px solid #f59e0b' }}>
                      <div className="incident-card-header">
                        Đánh giá từ người thuê
                      </div>
                      <div style={{ marginTop: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                          <span style={{ fontWeight: 600, color: '#334155' }}>Mức độ hài lòng:</span>
                          <StarRating value={localIncident.rating} size="md" />
                        </div>
                        {localIncident.ratingComment && (
                          <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', borderLeft: '3px solid #cbd5e1', fontStyle: 'italic', color: '#475569', fontSize: '0.9rem' }}>
                            "{localIncident.ratingComment}"
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Right Column */}
                <div>
                  <div className="incident-section-header">
                    <div className="incident-section-bar-yellow"></div>
                    <h2 className="incident-section-title">Lịch sử (Timeline)</h2>
                  </div>

                  <div className="incident-card">
                    {loading ? (
                      <div className="incident-loading-text">Đang tải...</div>
                    ) : (
                      <div className="incident-timeline-container">
                        {timeline.map((entry, index) => {
                          const statusConfig = statusMap[entry.status] || statusMap.pending;
                          const isLast = index === timeline.length - 1;

                          return (
                            <div key={entry._id} className="incident-timeline-item" style={{ paddingBottom: isLast ? '0' : '32px' }}>
                              <div className="incident-timeline-dot" style={{ background: statusConfig.color }}></div>

                              <div className="incident-timeline-time">
                                {formatDateTime(entry.createdAt)}
                              </div>

                              <div className="incident-timeline-title">
                                <span style={{ color: statusConfig.color }}>{statusConfig.label}</span>
                                <span className="incident-timeline-divider">-</span>
                                <span>{entry.createdBy?.name || "Hệ thống"}</span>
                              </div>

                              {entry.note && (
                                <div className="incident-timeline-bubble">
                                  <div className="incident-timeline-bubble-tail"></div>
                                  {entry.note}
                                </div>
                              )}
                            </div>
                          );
                        })}

                        {/* Placeholder for "Chờ xử lý tiếp theo..." */}
                        {localIncident.status !== 'closed' && localIncident.status !== 'resolved' && localIncident.status !== 'rejected' && (
                          <div className="incident-timeline-pending">
                            <div className="incident-timeline-dot-gray"></div>
                            <div className="incident-timeline-pending-text">Chờ xử lý tiếp theo...</div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Action Bar Footer */}
            {(userRole === "admin" || userRole === "staff") && !showResolveForm && (
              <div className="incident-action-bar">
                {(localIncident.status === "pending" || localIncident.status === "assigned") && (
                  <button
                    onClick={() => {
                      const reason = prompt("Lý do từ chối:");
                      if (reason) {
                        setNote(reason);
                        handleUpdateStatus("rejected");
                      }
                    }}
                    disabled={actionLoading}
                    className="incident-btn-outline"
                  >
                    TỪ CHỐI
                  </button>
                )}

                {localIncident.status === "pending" && (
                  <button
                    onClick={() => handleUpdateStatus("assigned")}
                    disabled={actionLoading}
                    className="incident-btn-primary"
                  >
                    <FiCheckCircle size={18} /> NHẬN XỬ LÝ
                  </button>
                )}

                {localIncident.status === "assigned" && (
                  <button
                    onClick={() => handleUpdateStatus("in_progress")}
                    disabled={actionLoading}
                    className="incident-btn-primary"
                  >
                    <FiPlayCircle size={18} /> BẮT ĐẦU XỬ LÝ
                  </button>
                )}

                {localIncident.status === "in_progress" && (
                  <button
                    onClick={() => setShowResolveForm(true)}
                    disabled={actionLoading}
                    className="incident-btn-success"
                  >
                    <FiTool size={18} /> HOÀN THÀNH XỬ LÝ
                  </button>
                )}
              </div>
            )}

            {/* Resolve Form Inline */}
            {showResolveForm && (
              <div className="incident-resolve-form">
                <h3 className="incident-resolve-title">Xác nhận hoàn thành</h3>
                <div className="incident-resolve-grid">
                  <div>
                    <label className="incident-form-label">Ghi chú sửa chữa (Bắt buộc) *</label>
                    <textarea
                      value={resolutionNote}
                      onChange={e => setResolutionNote(e.target.value)}
                      placeholder="Mô tả chi tiết những gì đã sửa..."
                      className="incident-textarea"
                    />
                  </div>
                  <div className="incident-resolve-subgrid">
                    <div>
                      <label className="incident-form-label">Chi phí sửa chữa (VNĐ)</label>
                      <div className="incident-input-icon-wrapper">
                        <FiDollarSign className="incident-input-icon" />
                        <input
                          type="number"
                          value={repairCost}
                          onChange={e => setRepairCost(e.target.value)}
                          placeholder="0"
                          className="incident-input-with-icon"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="incident-form-label">Hình ảnh sau khi sửa (Tùy chọn)</label>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <label 
                          htmlFor="after-images-upload" 
                          style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center', 
                            gap: '8px', 
                            padding: '16px', 
                            border: '1.5px dashed #cbd5e1', 
                            borderRadius: '12px', 
                            background: '#f8fafc', 
                            cursor: 'pointer',
                            color: '#64748b',
                            transition: 'all 0.2s'
                          }}
                          onMouseOver={e => { e.currentTarget.style.borderColor = '#003e68'; e.currentTarget.style.color = '#003e68'; e.currentTarget.style.background = '#f0f9ff'; }}
                          onMouseOut={e => { e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.color = '#64748b'; e.currentTarget.style.background = '#f8fafc'; }}
                        >
                          <FiImage size={24} />
                          <span style={{ fontSize: '0.95rem', fontWeight: 500 }}>Nhấn để tải ảnh lên</span>
                        </label>
                        <input
                          id="after-images-upload"
                          type="file" 
                          multiple 
                          accept="image/*"
                          onChange={e => {
                            if (e.target.files) {
                              const newFiles = Array.from(e.target.files);
                              setAfterImages(prev => [...prev, ...newFiles]);
                            }
                          }}
                          style={{ display: 'none' }}
                        />
                        
                        {afterImages.length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '4px' }}>
                            {afterImages.map((file, index) => (
                              <div key={index} style={{ position: 'relative', width: '64px', height: '64px', borderRadius: '8px', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                                <img src={URL.createObjectURL(file)} alt={`preview-${index}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                <button 
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setAfterImages(prev => prev.filter((_, i) => i !== index));
                                  }}
                                  style={{ position: 'absolute', top: '2px', right: '2px', background: 'rgba(0,0,0,0.6)', color: 'white', border: 'none', borderRadius: '50%', width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}
                                >
                                  <FiX size={12} />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="incident-resolve-actions">
                  <button
                    onClick={() => setShowResolveForm(false)}
                    disabled={actionLoading}
                    className="incident-btn-outline-small"
                  >
                    HỦY
                  </button>
                  <button
                    onClick={() => handleUpdateStatus("resolved")}
                    disabled={actionLoading}
                    className="incident-btn-success-small"
                  >
                    {actionLoading ? "ĐANG LƯU..." : "XÁC NHẬN HOÀN THÀNH"}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
