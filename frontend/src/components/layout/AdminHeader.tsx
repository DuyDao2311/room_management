import { useState, useEffect } from 'react'
import AdminSearchBar from './AdminSearchBar'
import AdminNotificationBell from './AdminNotificationBell'
import AdminUserProfile from './AdminUserProfile'

/**
 * AdminHeader — Header Dashboard SaaS hiện đại
 * - Height: 72px
 * - Sticky top, background trắng, shadow khi scroll
 * - Layout: Logo (240px) | SearchBar (flex) | NotificationBell | UserProfile
 * - Responsive
 */
export default function AdminHeader() {
  const [scrolled, setScrolled] = useState(false)

  // ── Shadow khi scroll ───────────────────────────────────────────────────
  useEffect(() => {
    const mainContent = document.querySelector('.admin-main-wrapper')
    if (!mainContent) return

    const handler = () => {
      setScrolled(mainContent.scrollTop > 8)
    }

    mainContent.addEventListener('scroll', handler, { passive: true })
    return () => mainContent.removeEventListener('scroll', handler)
  }, [])

  return (
    <header
      className={`adm-header ${scrolled ? 'adm-header--scrolled' : ''}`}
      id="admin-dashboard-header"
    >

      {/* ── Search Bar ────────────────────────────────────────────────── */}
      <div className="adm-header-center">
        <AdminSearchBar />
      </div>

      {/* ── Right actions ─────────────────────────────────────────────── */}
      <div className="adm-header-actions">
        <AdminNotificationBell />
        <div className="adm-header-divider" />
        <AdminUserProfile />
      </div>
    </header>
  )
}
