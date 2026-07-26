import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import Header from './components/layout/Header'
import Footer from './components/layout/Footer'
import Home from './pages/public/Home'
import RoomList from './pages/public/RoomList'
import RoomDetail from './pages/public/RoomDetail'
import RoomMapPage from './pages/public/RoomMapPage'
import PaymentCallback from './pages/public/PaymentCallback'
import Login from './pages/auth/Login'
import Register from './pages/auth/Register'
import ForgotPassword from './pages/auth/ForgotPassword'
import ResetPassword from './pages/auth/ResetPassword'
import VerifyEmail from './pages/auth/VerifyEmail'
import Dashboard from './pages/admin/Dashboard'
import AdminRoomMapPage from './pages/admin/AdminRoomMapPage'
import RoomManagement from './pages/admin/RoomManagement'
import AdminBookingDetail from './pages/admin/AdminBookingDetail'
import ContractManagement from './pages/admin/ContractManagement'
import InvoiceManagement from './pages/admin/InvoiceManagement'
import AppointmentManagement from './pages/admin/AppointmentManagement'
import AppointmentDetail from './pages/admin/AppointmentDetail'
import UserManagement from './pages/admin/UserManagement'
import StaffManagement from './pages/admin/StaffManagement'
import BookingManagement from './pages/admin/BookingManagement'
import MyInvoices from './pages/tenant/MyInvoices'
import MyRoom from './pages/tenant/MyRoom'
import MyBookings from './pages/tenant/MyBookings'
import BookingDetail from './pages/tenant/BookingDetail'
import MyIncidents from './pages/tenant/MyIncidents'
import IncidentManagement from './pages/admin/IncidentManagement'
import AdminLayout from './components/layout/AdminLayout'
import ChatBox from './components/ui/ChatBox'
import FeedbackManagement from './pages/admin/FeedbackManagement'
import PromotionManagement from './pages/admin/PromotionManagement'
import FavoritesPage from './pages/public/FavoritesPage'
import Profile from './pages/profile/Profile'
import UserProfileLayout from './pages/profile/UserProfileLayout'
import Payment from './pages/profile/Payment'
import Security from './pages/profile/Security'
import ServiceList from './pages/public/ServiceList'
import ServiceDetail from './pages/public/ServiceDetail'
import ServiceManagement from './pages/admin/ServiceManagement'
import ServiceBookingManagement from './pages/admin/ServiceBookingManagement'
import MyServiceBookings from './pages/tenant/MyServiceBookings'

/**
 * RequireAuth — Route protection component
 * Hỗ trợ kiểm tra 1 hoặc nhiều roles
 * Ví dụ: role="admin" hoặc role={["admin", "staff"]}
 */
function RequireAuth({ children, role }: { children: React.ReactNode; role?: string | string[] }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#667085' }}>Đang xác thực...</div>
  if (!user) {
    // Preserve query params khi redirect sang /login
    const searchParams = new URLSearchParams(location.search)
    const redirect = location.pathname + location.search
    searchParams.set('redirect', redirect)
    return <Navigate to={`/login?${searchParams.toString()}`} replace />
  }

  if (role) {
    const allowedRoles = Array.isArray(role) ? role : [role]
    if (!allowedRoles.includes(user.role)) return <Navigate to="/" replace />
  }

  return <>{children}</>
}

function AppLayout() {
  const location = useLocation()
  const isAuthPage =
    location.pathname === '/login' ||
    location.pathname === '/register' ||
    location.pathname === '/forgot-password' ||
    location.pathname.startsWith('/reset-password/')
  const isAdminPage = location.pathname.startsWith('/admin')
  const isMapPage = location.pathname === '/rooms/map'

  return (
    <div className="app-root">
      {!isAuthPage && !isAdminPage && <Header />}
      <Routes>
        {/* Public */}
        <Route path="/" element={<Home />} />
        <Route path="/rooms" element={<RoomList />} />
        <Route path="/rooms/map" element={<RoomMapPage />} />
        <Route path="/rooms/:id" element={<RoomDetail />} />
        <Route path="/favorites" element={<FavoritesPage />} />
        <Route path="/services" element={<ServiceList />} />
        <Route path="/services/:id" element={<ServiceDetail />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password/:token" element={<ResetPassword />} />
        <Route path="/verify-email/:token" element={<VerifyEmail />} />

        {/* Payment callbacks */}
        <Route path="/payment/momo-callback" element={<PaymentCallback />} />
        <Route path="/payment/vnpay-callback" element={<PaymentCallback />} />
        <Route path="/payment/success" element={<PaymentCallback />} />
        <Route path="/payment/success/:invoiceId" element={<PaymentCallback />} />
        <Route path="/payment/failed" element={<PaymentCallback />} />

        {/* Admin + Staff — dùng chung AdminLayout */}
        <Route path="/admin" element={<RequireAuth role={["admin", "staff"]}><AdminLayout /></RequireAuth>}>
          <Route index element={<Dashboard />} />
          <Route path="room-map" element={<AdminRoomMapPage />} />
          <Route path="rooms" element={<RoomManagement />} />
          <Route path="contracts" element={<ContractManagement />} />
          <Route path="invoices" element={<InvoiceManagement />} />
          <Route path="appointments" element={<AppointmentManagement />} />
          <Route path="appointments/:id" element={<AppointmentDetail />} />
          <Route path="incidents" element={<IncidentManagement />} />
          <Route path="bookings" element={<BookingManagement />} />
          <Route path="bookings/:id" element={<AdminBookingDetail />} />
          <Route path="services" element={<ServiceManagement />} />
          <Route path="service-bookings" element={<ServiceBookingManagement />} />
          <Route path="users" element={<RequireAuth role="admin"><UserManagement /></RequireAuth>} />
          <Route path="staff" element={<RequireAuth role="admin"><StaffManagement /></RequireAuth>} />
          <Route path="feedback" element={<FeedbackManagement />} />
          <Route path="promotions" element={<PromotionManagement />} />
        </Route>

        {/* Profile — any authenticated user */}
        <Route path="/profile" element={<RequireAuth><UserProfileLayout /></RequireAuth>}>
          <Route index element={<Profile />} />
          <Route path="payment" element={<Payment />} />
          <Route path="room-info" element={<div className="pf-page"><div className="pf-page-header"><h1 className="pf-page-title">Thông tin thuê phòng</h1></div><div className="pf-placeholder"><span className="pf-placeholder-icon">🏠</span><p>Đang xây dựng...</p></div></div>} />
          <Route path="security" element={<Security />} />
        </Route>

        {/* Tenant only */}
        <Route path="/my-invoices" element={<RequireAuth role="tenant"><MyInvoices /></RequireAuth>} />
        <Route path="/my-room" element={<RequireAuth role="tenant"><MyRoom /></RequireAuth>} />
        <Route path="/my-bookings" element={<RequireAuth role="tenant"><MyBookings /></RequireAuth>} />
        <Route path="/my-bookings/:id" element={<RequireAuth role="tenant"><BookingDetail /></RequireAuth>} />
        <Route path="/my-service-bookings" element={<RequireAuth role="tenant"><MyServiceBookings /></RequireAuth>} />
        <Route path="/my-incidents" element={<RequireAuth role="tenant"><MyIncidents /></RequireAuth>} />

        {/* 404 fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {!isAuthPage && !isAdminPage && !isMapPage && <Footer />}
      {!isAuthPage && !isAdminPage && <ChatBox />}
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppLayout />
    </BrowserRouter>
  )
}
