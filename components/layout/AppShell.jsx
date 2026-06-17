'use client'
import { usePathname } from 'next/navigation'
import BottomNav from './BottomNav'
import Sidebar from './Sidebar'
import TopBar from './TopBar'

export default function AppShell({ children, user, profile }) {
  const pathname = usePathname()
  const isAuth = pathname.startsWith('/login') || pathname.startsWith('/register')
  if (isAuth) return <>{children}</>

  return (
    <div className="app-shell">
      {/* Sidebar desktop */}
      <Sidebar profile={profile} />

      {/* Main */}
      <div className="app-main">
        <TopBar user={user} profile={profile} />
        <main className="app-content">
          {children}
        </main>
      </div>

      {/* Bottom nav mobile */}
      <BottomNav profile={profile} />

      <style jsx>{`
        .app-shell {
          display: flex;
          min-height: 100vh;
        }
        .app-main {
          flex: 1;
          display: flex;
          flex-direction: column;
          min-width: 0;
        }
        .app-content {
          flex: 1;
          padding: 24px;
        }
        @media (max-width: 767px) {
          .app-content { padding: 16px; }
        }
      `}</style>
    </div>
  )
}
