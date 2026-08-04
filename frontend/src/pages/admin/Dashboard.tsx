import { useState, useEffect } from 'react'
import api from '../../api/axios.ts'
import Spinner from '../../components/ui/Spinner.tsx'
import { useAuth } from '../../contexts/AuthContext.tsx'
import { FiMapPin, FiTrendingUp, FiTrendingDown, FiUsers, FiAlertCircle } from "react-icons/fi"
import { bookingService } from '../../api/booking.service.ts'
import {
  Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, ComposedChart, Bar
} from 'recharts'

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
  pendingInvoicesCount: number
  pendingInvoicesAmount: number
  cashRevenue: number
  momoRevenue: number
  vnpayRevenue: number
  // ── New fields ──
  monthlyExpenses: number
  previousMonthRevenue: number
  previousMonthExpenses: number
  revenueBySource: {
    rent: number
    booking: number
    service: number
    incident: number
  }
  chartData: { month: string; revenue: number; expenses: number }[]
}

interface ShortTermStats {
  totalBookings: number
  todayBookings: number
  monthBookings: number
  shortTermRevenue: number
  occupancyRate: number
  topRooms: any[]
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatMoney(value: number): string {
  return value.toLocaleString('vi-VN')
}

function calcChange(current: number, previous: number): { value: string; positive: boolean } {
  if (previous === 0) return { value: current > 0 ? '+100%' : '0%', positive: current >= 0 }
  const pct = ((current - previous) / previous) * 100
  return {
    value: `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`,
    positive: pct >= 0,
  }
}

// ── Custom Tooltip for Composed Chart ────────────────────────────────────────────
const CustomLineTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null

  const formatCompact = (val: number) => {
    if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(0)}M`
    if (val >= 1_000) return `${(val / 1_000).toFixed(0)}K`
    return val.toString()
  }

  return (
    <div style={{
      background: '#2d333b', padding: '12px 16px', borderRadius: '8px',
      boxShadow: '0 4px 20px rgba(0,0,0,0.15)', border: 'none',
    }}>
      <p style={{ margin: '0 0 8px 0', fontWeight: 700, color: '#ffffff', fontSize: '0.9rem' }}>
        Tháng {label?.replace('T', '')}
      </p>
      {payload.map((entry: any, i: number) => (
        <p key={i} style={{ margin: '4px 0', color: entry.dataKey === 'revenue' ? '#93c5fd' : '#6ee7b7', fontSize: '0.85rem', fontWeight: 600 }}>
          {entry.name}: {formatCompact(entry.value)}
        </p>
      ))}
    </div>
  )
}

// ── Custom Tooltip for Donut Chart ────────────────────────────────────────────
const CustomPieTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: 'white', padding: '10px 14px', borderRadius: '10px',
      boxShadow: '0 4px 20px rgba(0,0,0,0.12)', border: '1px solid #eaecf0',
    }}>
      <p style={{ margin: 0, color: payload[0].payload.fill, fontSize: '0.85rem', fontWeight: 700 }}>
        {payload[0].name}: {formatMoney(payload[0].value)} đ
      </p>
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const cardStyle: React.CSSProperties = {
  background: 'white',
  padding: '24px 28px',
  borderRadius: '16px',
  boxShadow: '0 2px 12px rgba(0,62,104,0.06)',
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
  position: 'relative',
  overflow: 'hidden',
  transition: 'box-shadow 0.2s ease',
}

const chartCardStyle: React.CSSProperties = {
  background: 'white',
  padding: '28px',
  borderRadius: '16px',
  boxShadow: '0 2px 12px rgba(0,62,104,0.06)',
}

// ═════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═════════════════════════════════════════════════════════════════════════════

export default function Dashboard() {
  const { user } = useAuth()
  const [stats, setStats] = useState<Stats | null>(null)
  const [_shortTermStats, setShortTermStats] = useState<ShortTermStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())

  const isStaff = user?.role === 'staff'

  useEffect(() => {
    setLoading(true)
    Promise.all([
      api.get('/admin/stats', { params: { month: selectedMonth, year: selectedYear } }),
      bookingService.getStats()
    ])
      .then(([statsRes, bookingRes]) => {
        setStats(statsRes.data)
        setShortTermStats(bookingRes.data)
      })
      .catch(() => setError('Không thể tải thống kê.'))
      .finally(() => setLoading(false))
  }, [selectedMonth, selectedYear])

  if (loading) return <div className="page-shell"><Spinner /></div>

  // ── Date formatting ────────────────────────────────────────────────────────
  const now = new Date()
  const selectedDate = new Date(selectedYear, selectedMonth - 1, 1)
  const monthName = selectedDate.toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' })
  const timeStr = now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase()

  const monthOptions = Array.from({ length: 12 }, (_, i) => i + 1)
  const yearOptions = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 3 + i)

  // ── Trend calculations ─────────────────────────────────────────────────────
  const revenueChange = stats ? calcChange(stats.monthlyRevenue, stats.previousMonthRevenue) : { value: '0%', positive: true }
  const expenseChange = stats ? calcChange(stats.monthlyExpenses, stats.previousMonthExpenses) : { value: '0%', positive: true }

  // ── Donut chart data ───────────────────────────────────────────────────────
  const DONUT_COLORS = ['#003e68', '#088373', '#f79009', '#eab308']
  const totalRevAll = (stats?.revenueBySource?.rent ?? 0) + (stats?.revenueBySource?.booking ?? 0) + (stats?.revenueBySource?.service ?? 0) + (stats?.revenueBySource?.incident ?? 0)
  const donutData = [
    { name: 'Tiền thuê phòng', value: Math.max(0, stats?.revenueBySource?.rent ?? 0) },
    { name: 'Tiền booking', value: Math.max(0, stats?.revenueBySource?.booking ?? 0) },
    { name: 'Tiền dịch vụ', value: Math.max(0, stats?.revenueBySource?.service ?? 0) },
    { name: 'Tiền sự cố', value: Math.max(0, stats?.revenueBySource?.incident ?? 0) },
  ]
  const sumDonutValue = donutData.reduce((acc, curr) => acc + curr.value, 0)
  const donutPercents = donutData.map(d => sumDonutValue > 0 ? Math.round((d.value / sumDonutValue) * 100) : 0)

  // ── Line chart Y axis formatter ────────────────────────────────────────────
  const formatYAxis = (value: number) => {
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(0)}M`
    if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`
    return value.toString()
  }

  return (
    <div className="page-shell">
      <h1
        style={{
          color: '#003e68',
          fontSize: '2rem',
          fontWeight: 700,
          margin: 0,
          paddingBottom: '10px',
          borderBottom: '1px solid #eaecf0',
          flex: 1,
        }}
      >
        Thống kê tài chính
      </h1>
      <div className="admin-page">
        {/* Staff District Banner */}
        {isStaff && user?.managedDistricts && user.managedDistricts.length > 0 && (
          <div style={{
            background: 'linear-gradient(135deg, #e6f4ff, #ecfdf3)',
            border: '1px solid #b2d8f7',
            borderRadius: '12px', padding: '14px 20px',
            marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '12px',
          }}>
            <FiMapPin size={20} color="#003e68" />
            <div>
              <span style={{ fontWeight: 700, color: '#003e68', fontSize: '0.9rem' }}>Khu vực quản lý: </span>
              {user.managedDistricts.map(d => (
                <span key={d} style={{
                  background: '#003e68', color: 'white', padding: '3px 10px',
                  borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600,
                  marginLeft: '6px', display: 'inline-block', marginTop: '2px',
                }}>
                  {d}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
          <p style={{ margin: 0, color: '#088373', fontSize: '0.85rem', fontWeight: 600 }}>
            {monthName.charAt(0).toUpperCase() + monthName.slice(1)} • Cập nhật lần cuối: Hôm nay {timeStr}
          </p>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              style={{
                padding: '8px 14px', borderRadius: '8px', border: '1px solid #eaecf0',
                background: 'white', color: '#344054', fontSize: '0.85rem',
                fontWeight: 600, outline: 'none', cursor: 'pointer',
              }}
            >
              {monthOptions.map(m => (
                <option key={m} value={m}>Tháng {m}</option>
              ))}
            </select>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              style={{
                padding: '8px 14px', borderRadius: '8px', border: '1px solid #eaecf0',
                background: 'white', color: '#344054', fontSize: '0.85rem',
                fontWeight: 600, outline: 'none', cursor: 'pointer',
              }}
            >
              {yearOptions.map(y => (
                <option key={y} value={y}>Năm {y}</option>
              ))}
            </select>
          </div>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        {/* ── 4 Summary Cards ─────────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '18px', marginBottom: '28px' }}>

          {/* Card 1: Tổng Doanh Thu */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <p style={{ margin: 0, fontSize: '0.8rem', color: '#667085', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Tổng doanh thu
              </p>
              <div style={{
                width: '36px', height: '36px', borderRadius: '10px',
                background: 'linear-gradient(135deg, #e6f4ff, #d0ebff)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <FiTrendingUp size={18} color="#003e68" />
              </div>
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                <span style={{ fontSize: '2rem', fontWeight: 800, color: '#003e68', lineHeight: 1 }}>
                  {stats ? formatMoney(stats.monthlyRevenue) : '0'}
                </span>
                <span style={{ fontSize: '0.85rem', color: '#667085', fontWeight: 600 }}>đ</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '8px' }}>
                {revenueChange.positive
                  ? <FiTrendingUp size={14} color="#088373" />
                  : <FiTrendingDown size={14} color="#d92d20" />
                }
                <span style={{
                  fontSize: '0.78rem', fontWeight: 700,
                  color: revenueChange.positive ? '#088373' : '#d92d20',
                }}>
                  {revenueChange.value} so với tháng trước
                </span>
              </div>
            </div>
          </div>

          {/* Card 2: Tổng Chi Phí */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <p style={{ margin: 0, fontSize: '0.8rem', color: '#667085', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Tổng chi phí
              </p>
              <div style={{
                width: '36px', height: '36px', borderRadius: '10px',
                background: 'linear-gradient(135deg, #fef3f2, #fee4e2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <FiTrendingDown size={18} color="#d92d20" />
              </div>
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                <span style={{ fontSize: '2rem', fontWeight: 800, color: '#d92d20', lineHeight: 1 }}>
                  {stats ? formatMoney(stats.monthlyExpenses) : '0'}
                </span>
                <span style={{ fontSize: '0.85rem', color: '#667085', fontWeight: 600 }}>đ</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '8px' }}>
                {/* For expenses, increasing is "bad" so we invert colors */}
                {!expenseChange.positive
                  ? <FiTrendingDown size={14} color="#088373" />
                  : <FiTrendingUp size={14} color="#d92d20" />
                }
                <span style={{
                  fontSize: '0.78rem', fontWeight: 700,
                  color: !expenseChange.positive ? '#088373' : '#d92d20',
                }}>
                  {expenseChange.value} so với tháng trước
                </span>
              </div>
            </div>
          </div>

          {/* Card 3: Tổng Người Thuê */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <p style={{ margin: 0, fontSize: '0.8rem', color: '#667085', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Tổng người thuê
              </p>
              <div style={{
                width: '36px', height: '36px', borderRadius: '10px',
                background: 'linear-gradient(135deg, #ecfdf3, #d1fadf)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <FiUsers size={18} color="#088373" />
              </div>
            </div>
            <div>
              <span style={{ fontSize: '2rem', fontWeight: 800, color: '#003e68', lineHeight: 1 }}>
                {stats?.totalTenants ?? 0}
              </span>
              {(stats?.newTenants ?? 0) > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '8px' }}>
                  <FiTrendingUp size={14} color="#088373" />
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#088373' }}>
                    +{stats?.newTenants} khách mới tháng này
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Card 4: Dư Nợ Còn Lại */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <p style={{ margin: 0, fontSize: '0.8rem', color: '#667085', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Dư nợ còn lại
              </p>
              {(stats?.overdueInvoicesCount ?? 0) > 0 && (
                <div style={{
                  background: '#b54708', color: 'white', padding: '3px 10px',
                  borderRadius: '20px', fontSize: '0.7rem', fontWeight: 800,
                  display: 'flex', alignItems: 'center', gap: '4px',
                }}>
                  {stats?.overdueInvoicesCount} Quá hạn
                </div>
              )}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                <span style={{ fontSize: '2rem', fontWeight: 800, color: '#b54708', lineHeight: 1 }}>
                  {stats ? formatMoney(stats.overdueInvoicesAmount) : '0'}
                </span>
                <span style={{ fontSize: '0.85rem', color: '#667085', fontWeight: 600 }}>đ</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '8px' }}>
                <FiAlertCircle size={14} color="#b54708" />
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#b54708' }}>
                  Cần thu hồi gấp trong tuần
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Charts Section ──────────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: '20px' }}>

          {/* Line Chart: Doanh Thu & Chi Phí */}
          <div style={chartCardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ color: '#003e68', fontSize: '1.1rem', fontWeight: 800, margin: 0 }}>
                Doanh Thu & Chi Phí (6 tháng gần nhất)
              </h2>
            </div>

            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={stats?.chartData ?? []} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f5" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 13, fill: '#98a2b3', fontWeight: 600 }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={formatYAxis} tick={{ fontSize: 12, fill: '#98a2b3' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomLineTooltip />} cursor={{ fill: 'transparent' }} />
                <Legend
                  wrapperStyle={{ paddingTop: '16px' }}
                  formatter={(value: string) => (
                    <span style={{ color: '#475467', fontSize: '0.85rem', fontWeight: 600 }}>{value}</span>
                  )}
                />
                <Bar
                  dataKey="revenue" name="Doanh Thu"
                  fill="#003e68" barSize={40} radius={[4, 4, 0, 0]}
                />
                <Line
                  type="monotone" dataKey="expenses" name="Chi Phí"
                  stroke="#088373" strokeWidth={3}
                  dot={{ r: 5, fill: '#ffffff', stroke: '#088373', strokeWidth: 2 }}
                  activeDot={{ r: 7, strokeWidth: 2 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Donut Chart: Nguồn Doanh Thu */}
          <div style={chartCardStyle}>
            <h2 style={{ color: '#003e68', fontSize: '1.1rem', fontWeight: 800, margin: '0 0 20px 0' }}>
              Nguồn Doanh Thu
            </h2>

            <div style={{ display: 'flex', justifyContent: 'center', position: 'relative' }}>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={donutData}
                    cx="50%"
                    cy="50%"
                    innerRadius={65}
                    outerRadius={95}
                    paddingAngle={3}
                    dataKey="value"
                    stroke="none"
                  >
                    {donutData.map((_entry, index) => (
                      <Cell key={`cell-${index}`} fill={DONUT_COLORS[index % DONUT_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomPieTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              {/* Center label */}
              <div style={{
                position: 'absolute', top: '50%', left: '50%',
                transform: 'translate(-50%, -50%)',
                textAlign: 'center', pointerEvents: 'none',
              }}>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#003e68' }}>
                  {formatMoney(totalRevAll)}
                </div>
                <div style={{ fontSize: '0.65rem', color: '#98a2b3', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Tổng doanh thu
                </div>
              </div>
            </div>

            {/* Legend */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '20px' }}>
              {donutData.map((item, i) => (
                <div key={item.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: DONUT_COLORS[i] }} />
                    <span style={{ color: '#475467', fontSize: '0.85rem', fontWeight: 600 }}>{item.name}</span>
                  </div>
                  <span style={{ color: '#003e68', fontSize: '0.9rem', fontWeight: 800 }}>{donutPercents[i]}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
