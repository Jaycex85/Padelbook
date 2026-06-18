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
  '/admin/rules': "Règles d'accès",
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
    <header style={{
      height: '56px',
      background: 'var(--surface)',
      borderBottom: '1px solid var(--border)',
      display: 'flex',
      alignItems: 'center',
      padding: '0 20px',
      gap: '16px',
      position: 'sticky',
      top: 0,
      zIndex: 50,
    }}>
      <div style={{ flex: 1, fontFamily: "'Syne', sans-serif", fontSize: '16px', fontWeight: 700 }}>
        {title}
      </div>
      <div>
        {user ? (
          <button onClick={handleLogout} style={{
            background: 'none', border: '1px solid var(--border)', color: 'var(--muted)',
            fontSize: '13px', padding: '6px 14px', borderRadius: '8px', cursor: 'pointer'
          }}>
            Déconnexion
          </button>
        ) : (
          <a href="/login" style={{
            background: 'var(--green)', color: '#0D1117', border: 'none',
            fontSize: '13px', padding: '7px 16px', borderRadius: '8px',
            fontWeight: 500, textDecoration: 'none'
          }}>
            Connexion
          </a>
        )}
      </div>
    </header>
  )
}
