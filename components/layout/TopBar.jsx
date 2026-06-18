'use client'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase'

const PAGE_TITLES = {
  '/': 'Accueil',
  '/booking': 'Réserver',
  '/my-bookings': 'Mes réservations',
  '/open-matches': 'Matchs ouverts',
  '/profile': 'Mon profil',
  '/admin': 'Dashboard',
  '/admin/courts': 'Terrains',
  '/admin/schedule': 'Calendrier',
  '/admin/rules': "Règles d'accès",
  '/admin/members': 'Membres',
  '/admin/bookings': 'Réservations',
  '/admin/integrations': 'Intégrations',
}

export default function TopBar({ user, profile, onMenuOpen }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  const segments = pathname.split('/').filter(Boolean)
  const title = PAGE_TITLES[pathname] || (segments[segments.length - 1] || 'PadelBook')

  async function handleLogout() {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <header style={{
      height: 'var(--topbar-h)',
      background: 'var(--surface)',
      borderBottom: '1px solid var(--border)',
      display: 'flex', alignItems: 'center',
      padding: '0 16px', gap: '12px',
      position: 'sticky', top: 0, zIndex: 50,
      flexShrink: 0,
    }}>

      {/* Hamburger */}
      <button
        onClick={onMenuOpen}
        aria-label="Ouvrir le menu"
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          display: 'flex', flexDirection: 'column', gap: '5px',
          padding: '6px', borderRadius: '8px',
          transition: 'background .15s',
        }}
      >
        <span style={{ display: 'block', width: '20px', height: '2px', background: 'var(--text)', borderRadius: '99px' }} />
        <span style={{ display: 'block', width: '20px', height: '2px', background: 'var(--text)', borderRadius: '99px' }} />
        <span style={{ display: 'block', width: '14px', height: '2px', background: 'var(--muted)', borderRadius: '99px' }} />
      </button>

      {/* Titre page */}
      <span style={{
        fontFamily: "'Syne',sans-serif",
        fontWeight: 700, fontSize: '16px',
        flex: 1,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {title}
      </span>

      {/* Actions droite */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
        {user ? (
          <>
            {/* Avatar */}
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--purple), var(--purple-l))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '13px', fontWeight: 700, color: '#fff',
              flexShrink: 0, cursor: 'pointer',
            }} onClick={() => router.push('/profile')}>
              {(profile?.first_name || profile?.email || '?')[0].toUpperCase()}
            </div>
            <button onClick={handleLogout} style={{
              background: 'none',
              border: '1px solid var(--border)',
              color: 'var(--muted)', fontSize: '12px',
              padding: '5px 12px', borderRadius: '8px', cursor: 'pointer',
              transition: 'all .15s',
            }}>
              Déconnexion
            </button>
          </>
        ) : (
          <a href="/login" style={{
            background: 'linear-gradient(135deg, var(--purple), var(--purple-l))',
            color: '#fff', fontSize: '13px', fontWeight: 500,
            padding: '7px 16px', borderRadius: '8px',
            textDecoration: 'none',
          }}>
            Connexion
          </a>
        )}
      </div>
    </header>
  )
}
