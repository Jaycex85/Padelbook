'use client'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import BottomNav from './BottomNav'

export default function AppShell({ children, user, profile }) {
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => { setSidebarOpen(false) }, [pathname])

  const isAuth = pathname.startsWith('/login') || pathname.startsWith('/register')
  if (isAuth) return <>{children}</>

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>

      {/* Sidebar desktop */}
      <div className="sidebar-desktop-wrapper">
        <Sidebar profile={profile} />
      </div>

      {/* Overlay mobile (hamburger menu) */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 150, backdropFilter: 'blur(2px)' }}
        />
      )}

      {/* Sidebar mobile — slide menu complet */}
      <div className={'sidebar-mobile-wrapper' + (sidebarOpen ? ' open' : '')}>
        <Sidebar profile={profile} onClose={() => setSidebarOpen(false)} />
      </div>

      {/* Main */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <TopBar user={user} profile={profile} onHamburger={() => setSidebarOpen(o => !o)} sidebarOpen={sidebarOpen} />
        <main style={{ flex: 1, padding: '24px' }} className="app-main-content">
          {children}
        </main>
      </div>

      {/* Bottom nav — accès rapide mobile */}
      <BottomNav profile={profile} />

      <style jsx global>{`
        .sidebar-desktop-wrapper { display: flex; }
        .sidebar-mobile-wrapper {
          display: none;
          position: fixed;
          top: 0; left: 0; bottom: 0;
          width: var(--sidebar-w);
          z-index: 200;
          transform: translateX(-100%);
          transition: transform .25s cubic-bezier(.4,0,.2,1);
        }
        .sidebar-mobile-wrapper.open { transform: translateX(0); }

        @media (max-width: 767px) {
          .sidebar-desktop-wrapper { display: none; }
          .sidebar-mobile-wrapper { display: flex; }
          .app-main-content { padding: 16px !important; }
        }
      `}</style>
    </div>
  )
}
