'use client'
import { usePathname } from 'next/navigation'
import Link from 'next/link'

const PAGE_TITLES = {
  '/': 'Accueil',
  '/booking': 'Réserver',
  '/my-bookings': 'Mes réservations',
  '/open-matches': 'Matchs ouverts',
  '/profile': 'Mon profil',
  '/admin': 'Dashboard',
  '/admin/courts': 'Terrains',
  '/admin/pricing': 'Tarification',
  '/admin/schedule': 'Calendrier',
  '/admin/rules': "Règles d'accès",
  '/admin/members': 'Joueurs',
  '/admin/bookings': 'Réservations',
  '/admin/membership': 'Membres du club',
  '/admin/integrations': 'Intégrations',
}

export default function TopBar({ user, profile, onHamburger, sidebarOpen }) {
  const pathname = usePathname()
  const title = PAGE_TITLES[pathname] || 'Mayfair Padel Club'

  return (
    <header style={{
      height: '56px',
      background: 'var(--surface)',
      borderBottom: '1px solid var(--border)',
      display: 'flex',
      alignItems: 'center',
      padding: '0 16px',
      gap: '12px',
      position: 'sticky',
      top: 0,
      zIndex: 50,
    }}>

      {/* Hamburger — mobile only */}
      <button
        onClick={onHamburger}
        className="hamburger-btn"
        aria-label="Menu"
        style={{
          display: 'none',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: '5px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '6px',
          borderRadius: '8px',
          flexShrink: 0,
        }}
      >
        <span style={{
          display: 'block', width: '22px', height: '2px',
          background: sidebarOpen ? 'var(--brand-light)' : 'var(--muted)',
          borderRadius: '2px',
          transform: sidebarOpen ? 'translateY(7px) rotate(45deg)' : 'none',
          transition: 'all .2s',
        }}/>
        <span style={{
          display: 'block', width: '22px', height: '2px',
          background: sidebarOpen ? 'transparent' : 'var(--muted)',
          borderRadius: '2px',
          transition: 'all .2s',
        }}/>
        <span style={{
          display: 'block', width: '22px', height: '2px',
          background: sidebarOpen ? 'var(--brand-light)' : 'var(--muted)',
          borderRadius: '2px',
          transform: sidebarOpen ? 'translateY(-7px) rotate(-45deg)' : 'none',
          transition: 'all .2s',
        }}/>
      </button>

      {/* Logo mobile */}
      <Link href="/" className="topbar-logo-mobile" style={{ display: 'none', alignItems: 'center', gap: '8px', textDecoration: 'none' }}>
        <img src="/logo.png" alt="Mayfair Padel Club" style={{ width: '30px', height: '30px', borderRadius: '6px', objectFit: 'cover' }} />
        <div>
          <div style={{ fontFamily: "'Syne', sans-serif", fontSize: '12px', fontWeight: 800, color: 'var(--brand-light)', lineHeight: 1 }}>MAYFAIR</div>
          <div style={{ fontFamily: "'Syne', sans-serif", fontSize: '9px', fontWeight: 600, color: 'var(--muted)', letterSpacing: '1px' }}>PADEL CLUB</div>
        </div>
      </Link>

      {/* Titre desktop */}
      <div className="topbar-title-desktop" style={{ flex: 1, fontFamily: "'Syne', sans-serif", fontSize: '16px', fontWeight: 700 }}>
        {title}
      </div>

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
        {user ? (
          <Link href="/profile" style={{
            display: 'flex', alignItems: 'center', gap: '7px',
            background: 'none', border: '1px solid var(--border)',
            borderRadius: '8px', padding: '5px 12px',
            textDecoration: 'none', color: 'var(--muted)', fontSize: '13px',
            transition: 'all .15s',
          }}>
            <span style={{
              width: '22px', height: '22px', borderRadius: '50%',
              background: 'var(--brand-dim)', border: '1px solid var(--brand)',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '11px', fontWeight: 700, color: 'var(--brand-light)',
            }}>
              {(profile?.first_name || user.email || '?')[0].toUpperCase()}
            </span>
            <span className="topbar-name-desktop">
              {profile?.first_name || user.email?.split('@')[0]}
            </span>
          </Link>
        ) : (
          <Link href="/login" style={{
            background: 'var(--brand)', color: '#fff',
            fontSize: '13px', padding: '7px 16px', borderRadius: '8px',
            fontWeight: 500, textDecoration: 'none',
          }}>
            Connexion
          </Link>
        )}
      </div>

      <style jsx global>{`
        @media (max-width: 767px) {
          .hamburger-btn { display: flex !important; }
          .topbar-logo-mobile { display: flex !important; }
          .topbar-title-desktop { display: none !important; }
          .topbar-name-desktop { display: none; }
        }
      `}</style>
    </header>
  )
}
