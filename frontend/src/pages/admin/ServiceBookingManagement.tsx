import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import {
  serviceBookingService,
  type ServiceBooking,
} from "../../api/serviceBooking.service";
import { CATEGORY_LABELS } from "../../api/service.service";
import Spinner from "../../components/ui/Spinner";
import { MdFormatListBulleted, MdAssignment, MdPayments, MdCancel } from 'react-icons/md';

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> =
{
  pending: { label: "Chờ xác nhận", color: "#b86b00", bg: "#fddcb0" },
  confirmed: { label: "Đã xác nhận", color: "#0052cc", bg: "#deebff" },
  completed: { label: "Đã hoàn thành", color: "#088373", bg: "#bef2e8" },
  cancelled: { label: "Đã hủy", color: "#d92d20", bg: "#fee4e2" },
};
const PAYMENT_MAP: Record<string, { label: string; color: string }> = {
  unpaid: { label: "Chưa thanh toán", color: "#d92d20" },
  paid: { label: "Đã thanh toán", color: "#088373" },
};

export default function ServiceBookingManagement() {
  const [bookings, setBookings] = useState<ServiceBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [processing, setProcessing] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterPayment, setFilterPayment] = useState("");
  const [searchParams, setSearchParams] = useSearchParams();
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  const [statsMonth, setStatsMonth] = useState<number>(new Date().getMonth() + 1);
  const [statsYear, setStatsYear] = useState<number>(new Date().getFullYear());
  const [stats, setStats] = useState<any>(null);

  const fetchStats = () => {
    serviceBookingService.getStats({ month: statsMonth, year: statsYear })
      .then(res => setStats(res.data))
      .catch(console.error)
  }

  useEffect(() => {
    fetchStats()
  }, [statsMonth, statsYear])

  const fetchBookings = () => {
    setLoading(true);
    serviceBookingService
      .getBookings({ status: filterStatus, paymentStatus: filterPayment })
      .then((res) => setBookings(res.data))
      .catch(() => setError("Lỗi tải danh sách booking dịch vụ."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchBookings();
  }, [filterStatus, filterPayment]);

  // Cuộn tới + highlight booking được click từ notification (param ?highlight=id)
  useEffect(() => {
    const id = searchParams.get("highlight");
    if (!id || loading) return;
    if (bookings.some((b) => b._id === id)) {
      setHighlightedId(id);
      document
        .getElementById(`service-booking-${id}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
      setTimeout(() => setHighlightedId(null), 2500);
    }
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("highlight");
        return next;
      },
      { replace: true },
    );
  }, [bookings, loading, searchParams, setSearchParams]);

  const handleAction = async (
    id: string,
    action: "confirm" | "complete" | "cancel" | "pay",
  ) => {
    setProcessing(id);
    try {
      if (action === "confirm") await serviceBookingService.confirmBooking(id);
      else if (action === "complete")
        await serviceBookingService.completeBooking(id);
      else if (action === "cancel") {
        if (!confirm("Bạn có chắc chắn muốn hủy booking dịch vụ này?")) {
          setProcessing(null);
          return;
        }
        await serviceBookingService.cancelBooking(id);
      } else if (action === "pay") await serviceBookingService.payBooking(id);
      fetchBookings();
    } catch (err: any) {
      alert(err.response?.data?.message || "Có lỗi xảy ra.");
    } finally {
      setProcessing(null);
    }
  };

  return (
    <div className="page-shell">
      <div className="admin-page">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px" }}>
          <h1
            style={{
              color: "#003e68",
              fontSize: "2rem",
              fontWeight: 700,
              margin: "0",
              paddingBottom: "16px",
              borderBottom: "1px solid #eaecf0",
              flex: 1
            }}
          >
            Quản lý Booking Dịch vụ
          </h1>
          <div style={{ display: "flex", gap: "8px", marginLeft: "24px" }}>
            <select
              value={statsMonth}
              onChange={(e) => setStatsMonth(Number(e.target.value))}
              style={{
                padding: "8px 12px",
                borderRadius: "8px",
                border: "1px solid #eaecf0",
                outline: "none",
                fontWeight: 600,
                color: "#1c4c6b",
              }}
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>Tháng {m}</option>
              ))}
            </select>
            <select
              value={statsYear}
              onChange={(e) => setStatsYear(Number(e.target.value))}
              style={{
                padding: "8px 12px",
                borderRadius: "8px",
                border: "1px solid #eaecf0",
                outline: "none",
                fontWeight: 600,
                color: "#1c4c6b",
              }}
            >
              {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map((y) => (
                <option key={y} value={y}>Năm {y}</option>
              ))}
            </select>
          </div>
        </div>

        {stats && (
          <div className="incident-stats-grid" style={{ marginBottom: "24px" }}>
            <div className="incident-stat-card">
              <div className="incident-stat-stripe stripe-total" />
              <div className="incident-stat-header">
                <MdFormatListBulleted size={16} /> Tổng dịch vụ
              </div>
              <div className="incident-stat-content">
                <span className="incident-stat-value total">{stats.totalBookings}</span>
              </div>
            </div>
            <div className="incident-stat-card">
              <div className="incident-stat-stripe stripe-progress" />
              <div className="incident-stat-header">
                <MdAssignment size={16} color="#ea580c" /> Chưa hoàn thành
              </div>
              <div className="incident-stat-content">
                <span className="incident-stat-value progress">{stats.pendingBookings}</span>
              </div>
            </div>
            <div className="incident-stat-card">
              <div className="incident-stat-stripe stripe-cancelled" style={{ background: '#d92d20' }} />
              <div className="incident-stat-header">
                <MdCancel size={16} color="#d92d20" /> Đã huỷ
              </div>
              <div className="incident-stat-content">
                <span className="incident-stat-value" style={{ color: '#d92d20' }}>{stats.cancelledBookings}</span>
              </div>
            </div>
            <div className="incident-stat-card">
              <div className="incident-stat-stripe stripe-cost" />
              <div className="incident-stat-header">
                <MdPayments size={16} color="#0284c7" /> Doanh thu (tháng)
              </div>
              <div className="incident-stat-content">
                <span className="incident-stat-value cost">{stats.revenue?.toLocaleString('vi-VN')}</span>
                <span className="incident-stat-label">VND</span>
              </div>
            </div>
          </div>
        )}

        <div
          style={{
            display: "flex",
            gap: "12px",
            marginBottom: "24px",
            background: "white",
            padding: "12px 16px",
            borderRadius: "12px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
          }}
        >
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            style={{
              padding: "10px 16px",
              borderRadius: "8px",
              border: "1px solid #eaecf0",
              outline: "none",
            }}
          >
            <option value="">Tất cả trạng thái</option>
            <option value="pending">Chờ xác nhận</option>
            <option value="confirmed">Đã xác nhận</option>
            <option value="completed">Đã hoàn thành</option>
            <option value="cancelled">Đã hủy</option>
          </select>
          <select
            value={filterPayment}
            onChange={(e) => setFilterPayment(e.target.value)}
            style={{
              padding: "10px 16px",
              borderRadius: "8px",
              border: "1px solid #eaecf0",
              outline: "none",
            }}
          >
            <option value="">Tất cả thanh toán</option>
            <option value="unpaid">Chưa thanh toán</option>
            <option value="paid">Đã thanh toán</option>
          </select>
        </div>

        {error && <div className="alert alert-error">{error}</div>}
        {loading ? (
          <Spinner />
        ) : (
          <div
            style={{
              background: "white",
              borderRadius: "12px",
              boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
              overflow: "hidden",
            }}
          >
            {bookings.length === 0 ? (
              <div
                style={{
                  padding: "32px",
                  textAlign: "center",
                  color: "#667085",
                }}
              >
                Không có dữ liệu.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead style={{ background: '#f9fafb', borderBottom: '1px solid #eaecf0' }}>
                    <tr>
                      <th style={{ padding: '12px 16px', color: '#667085', fontSize: '0.85rem', fontWeight: 600 }}>Dịch vụ</th>
                      <th style={{ padding: '12px 16px', color: '#667085', fontSize: '0.85rem', fontWeight: 600 }}>Khách hàng</th>
                      <th style={{ padding: '12px 16px', color: '#667085', fontSize: '0.85rem', fontWeight: 600 }}>Hẹn lúc</th>
                      <th style={{ padding: '12px 16px', color: '#667085', fontSize: '0.85rem', fontWeight: 600 }}>Tổng tiền</th>
                      <th style={{ padding: '12px 16px', color: '#667085', fontSize: '0.85rem', fontWeight: 600 }}>Trạng thái</th>
                      <th style={{ padding: '12px 16px', color: '#667085', fontSize: '0.85rem', fontWeight: 600 }}>Thanh toán</th>
                      <th style={{ padding: '12px 16px', color: '#667085', fontSize: '0.85rem', fontWeight: 600 }}>Hành động</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bookings.map((b) => (
                      <tr
                        key={b._id}
                        id={`service-booking-${b._id}`}
                        style={{
                          borderBottom: "1px solid #eaecf0",
                          background:
                            highlightedId === b._id ? "#fff7e6" : undefined,
                          transition: "background 0.3s ease",
                        }}
                      >
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ fontWeight: 700, color: '#101828' }}>{b.service?.name || 'Dịch vụ đã ẩn'}</div>
                          <div style={{ fontSize: '0.8rem', color: '#667085' }}>
                            {b.service ? CATEGORY_LABELS[b.service.category] : ''} •{' '}
                            {b.selectedVariant ? `${b.selectedVariant} • SL: ${b.matchQuantity ?? b.quantity}` : `SL: ${b.quantity}`}
                          </div>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ fontWeight: 600, color: '#101828' }}>{b.tenant?.name}</div>
                          <div style={{ fontSize: '0.8rem', color: '#667085' }}>{b.tenant?.phone || b.tenant?.email}</div>
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: '0.9rem', color: '#101828' }}>
                          {new Date(b.scheduledAt).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' })}
                        </td>
                        <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                          <div style={{ fontWeight: 700, color: '#101828' }}>{b.totalAmount.toLocaleString('vi-VN')} đ</div>
                        </td>
                        <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                          <span style={{ background: STATUS_MAP[b.status]?.bg, color: STATUS_MAP[b.status]?.color, padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700, display: 'inline-block' }}>
                            {STATUS_MAP[b.status]?.label}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                          <span style={{ background: b.paymentStatus === 'paid' ? '#d3f2ec' : '#fee4e2', color: PAYMENT_MAP[b.paymentStatus]?.color, padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700, display: 'inline-block' }}>
                            {PAYMENT_MAP[b.paymentStatus]?.label}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                          {processing === b._id ? <Spinner /> : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              {(b.status === 'pending' || b.status === 'confirmed') && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span style={{ fontSize: '0.7rem', color: '#98a2b3', fontWeight: 600, minWidth: '62px', display: 'inline-block' }}>Xử lý:</span>
                                  <div style={{ display: 'flex', gap: '6px', width: '150px' }}>
                                    {b.status === 'pending' && (
                                      <button className="button button-primary" onClick={() => handleAction(b._id, 'confirm')} style={{ fontSize: '0.75rem', padding: '5px 10px' }}>Xác nhận</button>
                                    )}
                                    {b.status === 'confirmed' && (
                                      <button className="button button-primary" onClick={() => handleAction(b._id, 'complete')} style={{ fontSize: '0.75rem', padding: '5px 10px' }}>Hoàn thành</button>
                                    )}
                                    <button className="button button-secondary" onClick={() => handleAction(b._id, 'cancel')} style={{ fontSize: '0.75rem', padding: '5px 10px', flex: 1 }}>Hủy</button>
                                  </div>
                                </div>
                              )}
                              {b.paymentStatus === 'unpaid' && b.status !== 'cancelled' && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span style={{ fontSize: '0.7rem', color: '#98a2b3', fontWeight: 600, minWidth: '62px', display: 'inline-block' }}>Thanh toán:</span>
                                  <div style={{ display: 'flex', gap: '6px', width: '150px' }}>
                                    <button className="button" onClick={() => handleAction(b._id, 'pay')} style={{ fontSize: '0.75rem', padding: '5px 10px', flex: 1, background: '#d3f2ec', color: '#088373' }}>Đã thanh toán</button>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
