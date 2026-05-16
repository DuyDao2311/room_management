import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext.tsx'
import Header from './components/layout/Header.tsx'
import Footer from './components/layout/Footer.tsx'
import Home from './pages/public/Home.tsx'
import RoomList from './pages/public/RoomList.tsx'
import RoomDetail from './pages/public/RoomDetail.tsx'
import Login from './pages/auth/Login.tsx'
import Register from './pages/auth/Register.tsx'
import Dashboard from './pages/admin/Dashboard.tsx'
import RoomManagement from './pages/admin/RoomManagement.tsx'
import ContractManagement from './pages/admin/ContractManagement.tsx'
import InvoiceManagement from './pages/admin/InvoiceManagement.tsx'
import AppointmentManagement from './pages/admin/AppointmentManagement.tsx'
import AppointmentDetail from './pages/admin/AppointmentDetail.tsx'
import UserManagement from './pages/admin/UserManagement.tsx'
import StaffManagement from './pages/admin/StaffManagement.tsx'
import MyInvoices from './pages/tenant/MyInvoices.tsx'
import MyRoom from './pages/tenant/MyRoom.tsx'
import AdminLayout from './components/layout/AdminLayout.tsx'
import ChatBox from './components/ui/ChatBox.tsx'

/**
 * RequireAuth — Route protection component
 * Hỗ trợ kiểm tra 1 hoặc nhiều roles
 * Ví dụ: role="admin" hoặc role={["admin", "staff"]}
 */
function RequireAuth({ children, role }: { children: React.ReactNode; role?: string | string[] }) {
  const { user, loading } = useAuth()
  if (loading) return <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#667085' }}>Đang xác thực...</div>
  if (!user) return <Navigate to="/login" replace />

  if (role) {
    const allowedRoles = Array.isArray(role) ? role : [role]
    if (!allowedRoles.includes(user.role)) return <Navigate to="/" replace />
  }

  return <>{children}</>
}

function AppLayout() {
  const location = useLocation()
  const isAuthPage = location.pathname === '/login' || location.pathname === '/register'
  const isAdminPage = location.pathname.startsWith('/admin')

  return (
    <div className="app-root">
      {!isAuthPage && !isAdminPage && <Header />}
      <Routes>
        {/* Public */}
        <Route path="/" element={<Home />} />
        <Route path="/rooms" element={<RoomList />} />
        <Route path="/rooms/:id" element={<RoomDetail />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Admin + Staff — dùng chung AdminLayout */}
        <Route path="/admin" element={<RequireAuth role={["admin", "staff"]}><AdminLayout /></RequireAuth>}>
          <Route index element={<Dashboard />} />
          <Route path="rooms" element={<RoomManagement />} />
          <Route path="contracts" element={<ContractManagement />} />
          <Route path="invoices" element={<InvoiceManagement />} />
          <Route path="appointments" element={<AppointmentManagement />} />
          <Route path="appointments/:id" element={<AppointmentDetail />} />
          {/* Admin only routes */}
          <Route path="users" element={<RequireAuth role="admin"><UserManagement /></RequireAuth>} />
          <Route path="staff" element={<RequireAuth role="admin"><StaffManagement /></RequireAuth>} />
        </Route>

        {/* Tenant only */}
        <Route path="/my-room" element={<RequireAuth role="tenant"><MyRoom /></RequireAuth>} />
        <Route path="/my-invoices" element={<RequireAuth role="tenant"><MyInvoices /></RequireAuth>} />

        {/* 404 fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {!isAuthPage && !isAdminPage && <Footer />}
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
