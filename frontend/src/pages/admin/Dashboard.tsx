import { useState, useEffect } from 'react'
// import { Link } from 'react-router-dom'
import api from '../../api/axios.ts'
import Spinner from '../../components/ui/Spinner.tsx'
import { FiHome, FiKey, FiUserPlus, FiDollarSign, FiCalendar, FiDownload } from "react-icons/fi";

interface Stats {
  totalRooms: number
  availableRooms: number
  occupiedRooms: number
  activeContracts: number
  monthlyRevenue: number
  totalTenants: number
  expiringContracts: number
  overdueInvoicesCount: number
  overdueInvoicesAmount: number
  newTenants: number
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get('/admin/stats')
      .then(res => setStats(res.data))
      .catch(() => setError('Không thể tải thống kê.'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="page-shell"><Spinner /></div>

  const today = new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).format(new Date()).replace('thg', 'Thg')

  return (
    <div className="page-shell">
      <div className="admin-page">
        <div className="admin-page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: 'none', marginBottom: '24px' }}>
          <div>
            <h1 style={{ color: '#003e68', fontSize: '1.8rem', fontWeight: 800, margin: '0 0 8px 0' }}>Chào buổi sáng, Quản trị viên</h1>
            <p style={{ color: '#667085', margin: 0, fontSize: '0.95rem' }}>Dưới đây là tóm tắt tình hình kinh doanh của bạn hôm nay.</p>
          </div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginTop: '6px' }}>
            <div style={{ background: '#f0f2f5', padding: '10px 16px', borderRadius: '6px', color: '#475467', fontWeight: 600, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FiCalendar size={18} /> {today}
            </div>
            <button className="button" style={{ background: '#003e68', color: 'white', display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', borderRadius: '6px', fontSize: '0.9rem', fontWeight: 600, border: 'none', cursor: 'pointer' }}>
              <FiDownload size={18} /> Xuất báo cáo
            </button>
          </div>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        {/* Top Stats Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
          {/* Card 1 */}
          <div style={{ background: 'white', padding: '24px', borderRadius: '12px', borderLeft: '4px solid #003e68', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
            <div>
              <p style={{ margin: 0, fontSize: '0.75rem', color: '#667085', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Tổng số phòng</p>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '8px' }}>
                <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#003e68' }}>{stats?.totalRooms ?? '128'}</span>
              </div>
            </div>
            <FiHome size={26} color="#23385aff" />
          </div>
          {/* Card 2 */}
          <div style={{ background: 'white', padding: '24px', borderRadius: '12px', borderLeft: '4px solid #088373', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
            <div>
              <p style={{ margin: 0, fontSize: '0.75rem', color: '#667085', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Phòng đang trống</p>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '8px' }}>
                <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#088373' }}>{stats?.availableRooms ?? '12'}</span>
                {/* <span style={{ fontSize: '0.75rem', color: '#667085', fontWeight: 500 }}>9.3% tỉ lệ trống</span> */}
              </div>
            </div>
            <FiKey size={26} color="#108a51ff" />
          </div>
          {/* Card 3 */}
          <div style={{ background: 'white', padding: '24px', borderRadius: '12px', borderLeft: '4px solid #f79009', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
            <div>
              <p style={{ margin: 0, fontSize: '0.75rem', color: '#667085', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Khách mới (Tháng)</p>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '8px' }}>
                <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#f79009' }}>{(stats?.newTenants ?? 0) < 10 ? `0${stats?.newTenants ?? 0}` : stats?.newTenants ?? 0}</span>
                <span style={{ fontSize: '0.75rem', color: '#088373', fontWeight: 700 }}>{stats?.newTenants && stats.newTenants > 0 ? "Xu hướng tăng" : ""}</span>
              </div>
            </div>
            <FiUserPlus size={26} color="#f79009" />
          </div>
          {/* Card 4 */}
          <div style={{ background: 'white', padding: '24px', borderRadius: '12px', borderLeft: '4px solid #003e68', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
            <div>
              <p style={{ margin: 0, fontSize: '0.75rem', color: '#667085', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Doanh thu tháng này</p>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '8px' }}>
                <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#003e68' }}>{stats ? `${(stats.monthlyRevenue / 1_000_000).toFixed(1)}M` : '452.8M'}</span>
                <span style={{ fontSize: '0.75rem', color: '#003e68', fontWeight: 700 }}>VND</span>
              </div>
            </div>
            <FiDollarSign size={26} color="#133b72ff" />
          </div>
        </div>

        {/* Lower Grid (Chart & Notifications) */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
          {/* Chart Placeholder */}
          <div style={{ background: 'white', padding: '32px', borderRadius: '16px', boxShadow: '0 4px 12px rgba(0,0,0,0.03)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h2 style={{ color: '#003e68', fontSize: '1.15rem', fontWeight: 800, margin: '0 0 6px 0' }}>Doanh thu 6 tháng gần nhất</h2>
                <p style={{ color: '#667085', margin: 0, fontSize: '0.85rem' }}>Tăng trưởng ổn định so với cùng kỳ năm ngoái</p>
              </div>
              <select style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: '#f0f2f5', color: '#475467', fontSize: '0.85rem', fontWeight: 600, outline: 'none' }}>
                <option>Năm 2023</option>
                <option>Năm 2024</option>
                <option>Năm 2025</option>
                <option>Năm 2026</option>
                <option>Năm 2027</option>
              </select>
            </div>
            <div style={{ flex: 1, minHeight: '260px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around', paddingTop: '40px', borderBottom: '1px solid #eaecf0', paddingBottom: '16px', marginTop: '40px' }}>
              {/* Labels for chart */}
              {[1, 2, 3, 4, 5, 6].map(m => (
                <span key={m} style={{ fontSize: '0.75rem', color: m === 4 ? '#003e68' : '#98a2b3', fontWeight: m === 4 ? 800 : 600 }}>Tháng {m}</span>
              ))}
            </div>
          </div>

          {/* Action Panel */}
          <div style={{ background: '#003e68', borderRadius: '16px', padding: '32px', color: 'white', display: 'flex', flexDirection: 'column' }}>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 800, margin: '0 0 32px 0', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ color: '#f79009' }}>⏳</span> Cần xử lý ngay
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '28px', flex: 1 }}>
              <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                <div style={{ width: '40px', height: '40px', background: 'rgba(255,255,255,0.1)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem' }}>
                  ⏱️
                </div>
                <div>
                  <h3 style={{ margin: '0 0 6px 0', fontSize: '0.95rem', fontWeight: 700 }}>{stats?.expiringContracts ?? 0} Hợp đồng hết hạn</h3>
                  <p style={{ margin: 0, color: '#aab4c5', fontSize: '0.8rem' }}>Trong 7 ngày tới</p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                <div style={{ width: '40px', height: '40px', background: 'rgba(255,255,255,0.1)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem' }}>
                  📄
                </div>
                <div>
                  <h3 style={{ margin: '0 0 6px 0', fontSize: '0.95rem', fontWeight: 700 }}>{stats?.overdueInvoicesCount ?? 0} Hoá đơn quá hạn</h3>
                  <p style={{ margin: 0, color: '#aab4c5', fontSize: '0.8rem' }}>Tổng cộng: {stats?.overdueInvoicesAmount ? (stats.overdueInvoicesAmount / 1_000_000).toFixed(1) + 'M' : '0'} VND</p>
                </div>
              </div>
            </div>

            <button style={{ background: 'white', color: '#003e68', width: '100%', padding: '14px', border: 'none', borderRadius: '8px', fontWeight: 800, fontSize: '0.9rem', marginTop: '32px', cursor: 'pointer' }}>
              Xem tất cả thông báo →
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
