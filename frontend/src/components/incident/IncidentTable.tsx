import type { Incident } from "../../api/incident.service";
import StarRating from "../ui/StarRating";

interface IncidentTableProps {
  incidents: Incident[];
  onViewDetail: (incident: Incident) => void;
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
  "Bình thường": { bg: "#eff6ff", text: "#1e40af", dot: "#3b82f6" },
  "Cao": { bg: "#fff7ed", text: "#c2410c", dot: "#f97316" },
  "Khẩn cấp": { bg: "#fef2f2", text: "#b91c1c", dot: "#ef4444" },
};

const formatDateTime = (dateString: string) => {
  const d = new Date(dateString);
  const time = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  const date = d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
  return `${time}, ${date}`;
};

export default function IncidentTable({ incidents, onViewDetail }: IncidentTableProps) {
  return (
    <div className="incident-table-wrapper">
      <div className="table-responsive" style={{ margin: 0 }}>
        <table className="admin-table">
          <thead>
            <tr>
              <th className="nowrap">Mã SC</th>
              <th>Phòng</th>
              <th>Chi tiết vấn đề</th>
              <th>Mức độ</th>
              <th>Chi phí</th>
              <th>Đánh giá</th>
              <th>Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {incidents.map((incident) => {
              const statusInfo = statusMap[incident.status] || statusMap.pending;
              const priorityInfo = priorityStyles[incident.priority] || priorityStyles["Bình thường"];
              
              return (
                <tr 
                  key={incident._id}
                  onClick={() => onViewDetail(incident)}
                  style={{ cursor: 'pointer', transition: 'background-color 0.2s' }}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = ''}
                >
                  <td className="incident-ticket-code nowrap">
                    {incident.ticketCode}
                  </td>
                  <td className="nowrap">
                    <div className="incident-room-wrapper">
                      <span className="incident-room-badge">
                        {incident.room?.name || "N/A"}
                      </span>
                      <span className="incident-district">
                        {incident.room?.district || "Khu vực chung"}
                      </span>
                    </div>
                  </td>
                  <td>
                    <div className="incident-desc">
                      {incident.description}
                    </div>
                    <div className="incident-time">
                      Báo cáo: {formatDateTime(incident.createdAt)}
                    </div>
                  </td>
                  <td className="nowrap">
                    <div className="incident-priority-badge" style={{ background: priorityInfo.bg, color: priorityInfo.text }}>
                      <span className="incident-priority-dot" style={{ background: priorityInfo.dot }}></span>
                      {incident.priority || "Bình thường"}
                    </div>
                  </td>
                  <td className="nowrap" style={{ fontWeight: 500, color: '#374151' }}>
                    {(incident.status === 'resolved' || incident.status === 'closed') 
                      ? (incident.repairCost ? incident.repairCost.toLocaleString('vi-VN') + ' đ' : '0 đ')
                      : '-'}
                  </td>
                  <td className="nowrap">
                    {incident.rating ? (
                      <StarRating value={incident.rating} size="sm" />
                    ) : (
                      <span style={{ color: '#9ca3af' }}>-</span>
                    )}
                  </td>
                  <td className="nowrap">
                    <span className="incident-status-badge" style={{ backgroundColor: statusInfo.bg, color: statusInfo.color }}>
                      {statusInfo.label}
                    </span>
                  </td>
                </tr>
              );
            })}
            
            {incidents.length === 0 && (
              <tr>
                <td colSpan={7} className="incident-empty">
                  Không có sự cố nào.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
