'use client'
import { useState } from 'react'
import { usePathname } from 'next/navigation'
import BottomNav from './BottomNav'
import Sidebar from './Sidebar'
import TopBar from './TopBar'

const AUTH_PATHS = ['/login', '/register']

export default function AppShell({ children, user, profile }) {
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const isAuth = AUTH_PATHS.includes(pathname)
  if (isAuth) return <>{children}</>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>

      {/* Sidebar (overlay sur toutes tailles) */}
      <Sidebar
        profile={profile}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Layout principal */}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
        <TopBar
          user={user}
          profile={profile}
          onMenuOpen={() => setSidebarOpen(true)}
        />
        <main className="page-content" style={{ flex: 1, padding: '24px', maxWidth: '900px', width: '100%', margin: '0 auto' }}>
          {children}
        </main>
      </div>

      {/* Bottom nav — toujours visible */}
      <BottomNav profile={profile} />
    </div>
  )
}
