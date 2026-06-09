import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { 
  getAllIncidents, 
  getDistrictIncidents,
  getIncidentById,
  getIncidentStats
} from "../../api/incident.service";
import type { Incident, IncidentStats } from "../../api/incident.service";
import IncidentFilters from "../../components/incident/IncidentFilters";
import IncidentTable from "../../components/incident/IncidentTable";
import IncidentDetail from "../../components/incident/IncidentDetail";
import { MdFormatListBulleted, MdAssignment, MdCheckCircle, MdPayments } from 'react-icons/md';

export default function IncidentManagement() {
  const { user } = useAuth();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Filters
  const [filters, setFilters] = useState({
    search: "",
    category: "",
    priority: "",
    status: "",
  });

  // Detail Modal
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();

  const [stats, setStats] = useState<IncidentStats | null>(null);

  const fetchStats = async () => {
    try {
      const data = await getIncidentStats();
      setStats(data);
    } catch (err) {
      console.error("Lỗi khi tải thống kê sự cố", err);
    }
  };

  const fetchIncidents = async () => {
    try {
      setLoading(true);
      setError("");
      
      const queryParams = {
        page,
        limit: 9,
        ...filters,
      };

      let res;
      if (user?.role === "admin") {
        res = await getAllIncidents(queryParams);
      } else {
        res = await getDistrictIncidents(queryParams);
      }
      
      setIncidents(res.incidents);
      setTotalPages(res.totalPages);
    } catch (err: any) {
      setError(err.response?.data?.message || "Lỗi khi tải danh sách sự cố");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [user]); // fetch once

  useEffect(() => {
    fetchIncidents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, filters, user]);

  useEffect(() => {
    const highlightId = searchParams.get('highlight');
    if (highlightId) {
      getIncidentById(highlightId)
        .then(data => {
          if (data) setSelectedIncident(data);
        })
        .catch(err => console.error("Error fetching highlighted incident", err))
        .finally(() => {
          setSearchParams(prev => {
            const next = new URLSearchParams(prev);
            next.delete('highlight');
            return next;
          }, { replace: true });
        });
    }
  }, [searchParams, setSearchParams]);

  const handleFilterChange = (newFilters: any) => {
    setFilters({ ...filters, ...newFilters });
    setPage(1); // Reset trang khi filter đổi
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  const handleViewDetail = (incident: Incident) => {
    setSelectedIncident(incident);
  };

  const handleCloseDetail = () => {
    setSelectedIncident(null);
    fetchIncidents(); // Refresh danh sách sau khi đóng modal
    fetchStats(); // Update stats as well
  };

  return (
    <div className="page-shell">
      <div className="admin-page">
        <h1 className="admin-page-title">
          Quản lý sự cố
        </h1>

        {stats && (
          <div className="incident-stats-grid">
            {/* Card 1 */}
            <div className="incident-stat-card">
              <div className="incident-stat-stripe stripe-total" />
              <div className="incident-stat-header">
                <MdFormatListBulleted size={16} /> Tổng số sự cố
              </div>
              <div className="incident-stat-content">
                <span className="incident-stat-value total">{stats.total}</span>
              </div>
            </div>

            {/* Card 2 */}
            <div className="incident-stat-card">
              <div className="incident-stat-stripe stripe-progress" />
              <div className="incident-stat-header">
                <MdAssignment size={16} color="#ea580c" /> Đang xử lý
              </div>
              <div className="incident-stat-content">
                <span className="incident-stat-value progress">{stats.inProgress}</span>
                <span className="incident-stat-label">Sự cố</span>
              </div>
            </div>

            {/* Card 3 */}
            <div className="incident-stat-card">
              <div className="incident-stat-stripe stripe-completed" />
              <div className="incident-stat-header">
                <MdCheckCircle size={16} color="#059669" /> Đã hoàn thành
              </div>
              <div className="incident-stat-content">
                <span className="incident-stat-value completed">{stats.completed}</span>
              </div>
            </div>

            {/* Card 4 */}
            <div className="incident-stat-card">
              <div className="incident-stat-stripe stripe-cost" />
              <div className="incident-stat-header">
                <MdPayments size={16} color="#0284c7" /> Tổng chi phí
              </div>
              <div className="incident-stat-content">
                <span className="incident-stat-value cost">{stats.totalCost.toLocaleString('vi-VN')}</span>
                <span className="incident-stat-label">VND</span>
              </div>
            </div>
          </div>
        )}

      {error && <div className="error-message" style={{ color: 'red', marginBottom: '1rem' }}>{error}</div>}

      <div className="admin-table-wrap" style={{ background: '#fff' }}>
        <IncidentFilters 
          filters={filters} 
          onFilterChange={handleFilterChange} 
        />

        {loading ? (
          <div style={{ padding: "20px", textAlign: "center", color: "#667085" }}>Đang tải...</div>
        ) : incidents.length === 0 ? (
          <div style={{ padding: "40px", textAlign: "center", color: "#667085" }}>
            Không có báo cáo sự cố nào phù hợp.
          </div>
        ) : (
          <>
            <IncidentTable 
              incidents={incidents} 
              onViewDetail={handleViewDetail} 
            />
            
            {/* Phân trang */}
            {totalPages > 1 && (
              <div className="pagination" style={{ display: 'flex', justifyContent: 'center', gap: '8px', padding: '16px' }}>
                <button 
                  disabled={page === 1}
                  onClick={() => handlePageChange(page - 1)}
                  style={{ padding: '8px 12px', border: '1px solid #d0d5dd', borderRadius: '4px', background: '#fff', cursor: page === 1 ? 'not-allowed' : 'pointer' }}
                >
                  Trước
                </button>
                <span style={{ padding: '8px 12px' }}>
                  Trang {page} / {totalPages}
                </span>
                <button 
                  disabled={page === totalPages}
                  onClick={() => handlePageChange(page + 1)}
                  style={{ padding: '8px 12px', border: '1px solid #d0d5dd', borderRadius: '4px', background: '#fff', cursor: page === totalPages ? 'not-allowed' : 'pointer' }}
                >
                  Sau
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {selectedIncident && (
        <IncidentDetail 
          incident={selectedIncident} 
          onClose={handleCloseDetail} 
          userRole={user?.role || ""}
        />
      )}
    </div>
    </div>
  );
}
