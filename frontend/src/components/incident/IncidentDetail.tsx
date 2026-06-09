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
  const [costPayer, setCostPayer] = useState("landlord");

  // Use monthsRented from backend if available, otherwise calculate locally as fallback
  const getMonthsRented = () => {
    if (localIncident.monthsRented !== undefined) return localIncident.monthsRented;
    if (!localIncident.contract || !localIncident.contract.startDate) return 0;
    const start = new Date(localIncident.contract.startDate);
    const now = new Date();
    return (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  };
  const monthsRented = getMonthsRented();

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

      await updateIncidentStatus(incident._id, status, note, costNum, resolutionNote, afterImages, costPayer);
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
      <div className={`incident-modal-content ${userRole === 'tenant' ? 'incident-tenant-modal' : ''}`}>

        {/* Modal Header Actions for Admin/Staff */}
        {userRole !== 'tenant' && (
          <div className="incident-modal-header-actions">
            <button onClick={onClose} disabled={actionLoading} className="incident-modal-close-btn">
              <FiX size={24} />
            </button>
          </div>
        )}
        {userRole === 'tenant' && (
          <div className="incident-tenant-close-wrap">
            <button
              onClick={onClose}
              disabled={actionLoading}
              className="incident-tenant-close-btn"
            >
              <FiX size={24} />
            </button>
          </div>
        )}

        {userRole === "tenant" ? (
          <div className="incident-tenant-body">
            {/* Staff Card */}
            {incident.assignedStaff ? (
              <div className="incident-staff-info-card">
                <div className="incident-flex-center-16">
                  <img src={incident.assignedStaff.avatar || "https://ui-avatars.com/api/?name=" + encodeURIComponent(incident.assignedStaff.name)} alt="avatar" className="incident-staff-info-avatar" />
                  <div>
                    <div className="incident-staff-info-name">{incident.assignedStaff.name}</div>
                    <div className="incident-staff-info-role">Nhân viên bảo trì được phân công</div>
                  </div>
                </div>
                <div className="incident-flex-8">
                  <button className="incident-staff-action-btn" onClick={() => window.location.href = `tel:${incident.assignedStaff?.phone}`}>
                    <FiPhone size={18} />
                  </button>
                  <button className="incident-staff-action-btn" onClick={() => window.open(`https://zalo.me/${incident.assignedStaff?.phone}`, '_blank')}>
                    <FiMessageSquare size={18} />
                  </button>
                </div>
              </div>
            ) : (
              <div className="incident-tenant-waiting-card">
                Đang chờ phân công nhân viên bảo trì...
              </div>
            )}

            {/* Rating Section for Tenant */}
            {(localIncident.status === "resolved" || localIncident.status === "closed") && (
              <div className="incident-rating-section">
                <h2 className="incident-rating-title">Đánh giá dịch vụ sửa chữa</h2>

                {localIncident.rating ? (
                  <div className="incident-rating-display-box">
                    <div className="incident-rating-display-header">
                      <div className="incident-rating-label">Đánh giá của bạn:</div>
                      <StarRating value={localIncident.rating} size="lg" />
                    </div>
                    {localIncident.ratingComment && (
                      <div className="incident-rating-comment-box">
                        "{localIncident.ratingComment}"
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    {error && <div className="incident-error-msg" style={{ marginBottom: '16px' }}>{error}</div>}
                    <div className="incident-rating-input-group">
                      <div>
                        <div className="incident-form-label-dark mb-12">Chất lượng phục vụ:</div>
                        <StarRating value={rating} onChange={setRating} size="lg" />
                      </div>
                      <div>
                        <div className="incident-form-label-dark">Nhận xét (Tùy chọn):</div>
                        <textarea
                          value={ratingComment}
                          onChange={(e) => setRatingComment(e.target.value)}
                          placeholder="Nhân viên nhiệt tình, xử lý nhanh..."
                          className="incident-rating-textarea"
                        />
                      </div>
                      <button
                        onClick={handleRate}
                        disabled={actionLoading || rating === 0}
                        className="incident-rating-submit-btn"
                      >
                        {actionLoading ? 'Đang gửi...' : 'GỬI ĐÁNH GIÁ'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Timeline */}
            <div className="incident-tenant-timeline-box">
              <h2 className="incident-rating-title mb-32">Lịch sử (Timeline)</h2>

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

                        <div className="incident-timeline-time-tenant">
                          <FiClock size={12} /> {formatDateTime(entry.createdAt)}
                        </div>

                        <div className="incident-timeline-tenant-status" style={{ color: statusConfig.color }}>
                          {statusConfig.label}
                        </div>
                        <div className={`incident-timeline-tenant-role ${entry.note ? 'with-note' : ''}`}>
                          {entry.createdBy?.name || "Hệ thống"} {entry.createdBy?.role ? `(${entry.createdBy.role === 'admin' || entry.createdBy.role === 'staff' ? 'BQL' : entry.createdBy.role === 'tenant' ? 'Người thuê' : 'Nhân viên bảo trì'})` : '(Tự động phân công)'}
                        </div>

                        {entry.note && (
                          <div className="incident-timeline-tenant-bubble">
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
                            className="incident-video-preview"
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Rating Card for Admin/Staff View */}
                  {localIncident.rating && userRole !== "tenant" && (
                    <div className="incident-card incident-admin-rating-card">
                      <div className="incident-card-header">
                        Đánh giá từ người thuê
                      </div>
                      <div style={{ marginTop: '16px' }}>
                        <div className="incident-rating-display-header mb-12">
                          <span className="incident-rating-label">Mức độ hài lòng:</span>
                          <StarRating value={localIncident.rating} size="md" />
                        </div>
                        {localIncident.ratingComment && (
                          <div className="incident-rating-comment-box small-bg">
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
                    {parseFloat(repairCost) > 0 && (
                      <div style={{ marginTop: '16px' }}>
                        <div className="incident-form-label">
                          Thời gian thuê: <strong>{monthsRented} tháng</strong>
                        </div>
                        {monthsRented < 3 ? (
                          <div style={{ padding: '8px', background: '#f0fdf4', color: '#166534', borderRadius: '4px', fontSize: '14px', marginTop: '4px' }}>
                            Khách thuê dưới 3 tháng. Chủ trọ (F4) sẽ chịu chi phí sửa chữa này.
                          </div>
                        ) : (
                          <div style={{ marginTop: '8px' }}>
                            <label className="incident-form-label">Ai chịu chi phí?</label>
                            <select
                              value={costPayer}
                              onChange={(e) => setCostPayer(e.target.value)}
                              style={{
                                width: '100%',
                                padding: '10px 12px',
                                borderRadius: '6px',
                                border: '1px solid #d0d5dd',
                                fontSize: '14px',
                                color: '#344054',
                                backgroundColor: '#fff',
                                outline: 'none',
                                boxShadow: '0 1px 2px rgba(16, 24, 40, 0.05)',
                                marginTop: '6px',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                              }}
                            >
                              <option value="landlord">Chủ trọ (F4)</option>
                              <option value="tenant">Người thuê</option>
                            </select>
                          </div>
                        )}
                      </div>
                    )}
                    <div style={{ marginTop: '16px' }}>
                      <label className="incident-form-label">Hình ảnh sau khi sửa (Tùy chọn)</label>
                      <div className="incident-upload-container">
                        <label
                          htmlFor="after-images-upload"
                          className="incident-image-upload-label"
                        >
                          <FiImage size={24} />
                          <span className="incident-image-upload-text">Nhấn để tải ảnh lên</span>
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
                          <div className="incident-image-preview-list">
                            {afterImages.map((file, index) => (
                              <div key={index} className="incident-image-preview-wrapper">
                                <img src={URL.createObjectURL(file)} alt={`preview-${index}`} className="incident-image-preview-img" />
                                <button
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setAfterImages(prev => prev.filter((_, i) => i !== index));
                                  }}
                                  className="incident-image-remove-btn"
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
