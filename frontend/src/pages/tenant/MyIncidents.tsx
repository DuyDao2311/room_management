import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../api/axios';
import Spinner from '../../components/ui/Spinner';
import { MdOutlineConstruction, MdArrowForward } from 'react-icons/md';
import { FiDroplet, FiZap, FiHome } from 'react-icons/fi';
import IncidentDetail from '../../components/incident/IncidentDetail';
import StarRating from '../../components/ui/StarRating';
import { getIncidentById } from '../../api/incident.service';
import type { Incident } from '../../api/incident.service';

const statusMap: Record<string, { label: string; bg: string; color: string }> = {
  pending: { label: "Mới", bg: "#e0f2fe", color: "#0284c7" },
  assigned: { label: "Đã tiếp nhận", bg: "#e0f2fe", color: "#0369a1" },
  in_progress: { label: "Đang xử lý", bg: "#e5e7eb", color: "#4b5563" },
  resolved: { label: "Đã xử lý", bg: "#a7f3d0", color: "#059669" },
  closed: { label: "Đóng", bg: "#f3f4f6", color: "#4b5563" },
  rejected: { label: "Từ chối", bg: "#fee2e2", color: "#b91c1c" },
};

const priorityStyles: Record<string, { bg: string; text: string; border: string }> = {
  "Thấp": { bg: "#f0fdf4", text: "#166534", border: "#22c55e" },
  "Bình thường": { bg: "#f3f4f6", text: "#4b5563", border: "#003e68" }, // Changed to dark blue border as in image
  "Cao": { bg: "#fff7ed", text: "#c2410c", border: "#f97316" },
  "Khẩn cấp": { bg: "#fef2f2", text: "#b91c1c", border: "#f59e0b" }, // Changed to orange border as in image
};

export default function MyIncidents() {
  const { user } = useAuth();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);

  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    api.get('/incidents/my')
      .then(res => {
        setIncidents(res.data.data);
      })
      .catch(() => setError('Không thể tải danh sách sự cố.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const highlightId = searchParams.get('highlight');
    if (highlightId) {
      getIncidentById(highlightId)
        .then(data => {
          if (data) setSelectedIncident(data);
        })
        .catch(err => console.error("Không tìm thấy sự cố", err))
        .finally(() => {
          setSearchParams(prev => {
            const next = new URLSearchParams(prev);
            next.delete('highlight');
            return next;
          }, { replace: true });
        });
    }
  }, [searchParams, setSearchParams]);

  const handleQuickRate = async (e: React.MouseEvent, incident: Incident, ratingValue: number) => {
    e.stopPropagation(); // Ngăn sự kiện click bubble lên card
    try {
      await api.post(`/incidents/${incident._id}/rate`, { rating: ratingValue });
      // Cập nhật state cục bộ
      setIncidents(prev => prev.map(inc => 
        inc._id === incident._id ? { ...inc, rating: ratingValue } : inc
      ));
    } catch (err: any) {
      alert(err.response?.data?.message || 'Không thể gửi đánh giá.');
    }
  };

  const getCategoryIcon = (category: string) => {
    const lower = category.toLowerCase();
    if (lower.includes('nước')) return <FiDroplet size={14} color="#6b7280" />;
    if (lower.includes('điện')) return <FiZap size={14} color="#6b7280" />;
    return <FiHome size={14} color="#6b7280" />;
  };

  const renderCard = (incident: Incident) => {
    // Custom mapping for the image
    let priorityColor = priorityStyles[incident.priority] || priorityStyles["Bình thường"];
    if (incident.priority === "Gấp" || incident.priority === "Khẩn cấp") {
      priorityColor = priorityStyles["Khẩn cấp"];
    }

    const statusConfig = statusMap[incident.status] || statusMap.pending;
    const dateStr = new Date(incident.createdAt).toLocaleDateString('vi-VN');

    return (
      <div 
        key={incident._id}
        onClick={() => setSelectedIncident(incident)}
        style={{
          background: '#fff',
          borderRadius: '8px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          padding: '24px',
          marginBottom: '16px',
          borderLeft: `4px solid ${priorityColor.border}`,
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          transition: 'all 0.2s'
        }}
        onMouseOver={(e) => e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)'}
        onMouseOut={(e) => e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)'}
      >
        <div style={{ flex: 1 }}>
          {/* Top row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <span style={{ fontSize: '0.85rem', color: '#6b7280', fontWeight: 600 }}>{incident.ticketCode}</span>
            <span style={{ 
              background: priorityColor.bg, 
              color: priorityColor.text, 
              padding: '2px 8px', 
              borderRadius: '4px', 
              fontSize: '0.75rem', 
              fontWeight: 600 
            }}>
              {incident.priority || "Bình thường"}
            </span>
            <span style={{ fontSize: '0.8rem', color: '#6b7280', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span className="material-icons" style={{ fontSize: '14px' }}>event</span> {dateStr}
            </span>
          </div>

          {/* Title */}
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#111827', marginBottom: '8px' }}>
            {incident.description.length > 50 ? incident.description.substring(0, 50) + '...' : incident.description}
          </div>

          {/* Category */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: '#6b7280' }}>
            {getCategoryIcon(incident.category)}
            {incident.category}
          </div>
        </div>

        {/* Right side */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          {(incident.status === 'resolved' || incident.status === 'closed') && (
            <div 
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}
              onClick={(e) => e.stopPropagation()} // Prevent card click when interacting with rating area
            >
              <StarRating 
                value={incident.rating || 0} 
                size="sm" 
                onChange={!incident.rating ? (rating) => handleQuickRate({ stopPropagation: () => {} } as any, incident, rating) : undefined} 
              />
              <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#059669', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {incident.rating ? 'Đã đánh giá' : 'Gửi đánh giá'}
              </span>
            </div>
          )}

          <span style={{
            background: statusConfig.bg,
            color: statusConfig.color,
            padding: '6px 12px',
            borderRadius: '4px',
            fontSize: '0.8rem',
            fontWeight: 600
          }}>
            {statusConfig.label}
          </span>
          <MdArrowForward size={20} color="#003e68" />
        </div>
      </div>
    );
  };

  return (
    <div className="page-shell">
      <div className="tenant-page">
        <div className="admin-page-header">
          <div>
            <h1>Sự cố của tôi</h1>
            <p>Xin chào, <strong>{user?.name}</strong> 👋</p>
          </div>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        {loading ? <Spinner /> : (
          <div style={{ marginTop: '24px', maxWidth: '800px' }}>
            {incidents.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', background: '#fff', borderRadius: '8px', color: '#6b7280' }}>
                <MdOutlineConstruction size={48} style={{ opacity: 0.2, marginBottom: '16px' }} />
                <p>Bạn chưa báo cáo sự cố nào.</p>
              </div>
            ) : (
              incidents.map(renderCard)
            )}
          </div>
        )}

        {selectedIncident && (
          <IncidentDetail 
            incident={selectedIncident} 
            onClose={() => setSelectedIncident(null)} 
            userRole="tenant" 
          />
        )}
      </div>
    </div>
  );
}
