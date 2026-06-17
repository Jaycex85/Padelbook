'use client'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase'

const PAGE_TITLES = {
  '/': 'Accueil',
  '/booking': 'Réserver',
  '/my-bookings': 'Mes réservations',
  '/open-matches': 'Matchs ouverts',
  '/admin': 'Dashboard',
  '/admin/courts': 'Terrains',
  '/admin/schedule': 'Calendrier',
  '/admin/rules': 'Règles d'accès',
  '/admin/members': 'Membres',
  '/admin/bookings': 'Réservations',
  '/admin/integrations': 'Intégrations',
}

export default function TopBar({ user, profile }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const title = PAGE_TITLES[pathname] || 'PadelBook'

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <header className="topbar">
      <div className="topbar-logo">
        <span>🎾</span>
        <span className="topbar-logo-text">PadelBook</span>
      </div>
      <div className="topbar-title">{title}</div>
      <div className="topbar-actions">
        {user ? (
          <button onClick={handleLogout} className="topbar-btn">
            Déconnexion
          </button>
        ) : (
          <a href="/login" className="topbar-btn topbar-btn-primary">Connexion</a>
        )}
      </div>

      <style jsx>{`
        .topbar {
          height: 56px;
          background: var(--surface);
          border-bottom: 1px solid var(--border);
          display: flex;
          align-items: center;
          padding: 0 20px;
          gap: 16px;
          position: sticky;
          top: 0;
          z-index: 50;
        }
        .topbar-logo {
          display: none;
          align-items: center;
          gap: 8px;
          font-family: 'Syne', sans-serif;
          font-weight: 700;
          font-size: 16px;
          color: var(--green);
        }
        @media (max-width: 767px) {
          .topbar-logo { display: flex; }
        }
        .topbar-logo-text { font-size: 16px; }
        .topbar-title {
          flex: 1;
          font-family: 'Syne', sans-serif;
          font-size: 16px;
          font-weight: 700;
        }
        @media (max-width: 767px) {
          .topbar-title { display: none; }
        }
        .topbar-actions { display: flex; align-items: center; gap: 8px; margin-left: auto; }
        .topbar-btn {
          background: none;
          border: 1px solid var(--border);
          color: var(--muted);
          font-size: 13px;
          padding: 6px 14px;
          border-radius: 8px;
          cursor: pointer;
          transition: all .15s;
          text-decoration: none;
        }
        .topbar-btn:hover { color: var(--text); border-color: var(--muted); }
        .topbar-btn-primary {
          background: var(--green);
          color: #0D1117;
          border-color: var(--green);
          font-weight: 500;
        }
        .topbar-btn-primary:hover { background: #86efac; }
      `}</style>
    </header>
  )
}
