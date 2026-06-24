'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const playerLinks = [
  { href: '/', icon: '⊞', label: 'Accueil' },
  { href: '/booking', icon: '📅', label: 'Réserver' },
  { href: '/events', icon: '🏆', label: 'Club Events' },
  { href: '/my-bookings', icon: '🎾', label: 'Mes réservations' },
  { href: '/open-matches', icon: '👥', label: 'Matchs ouverts' },
  { href: '/profile', icon: '👤', label: 'Mon profil' },
]

const adminLinks = [
  { href: '/admin', icon: '◈', label: 'Dashboard' },
  { href: '/admin/courts', icon: '🏟', label: 'Terrains' },
  { href: '/admin/pricing', icon: '💶', label: 'Tarification' },
  { href: '/admin/schedule', icon: '🗓', label: 'Calendrier' },
  { href: '/admin/events', icon: '🏆', label: 'Club Events' },
  { href: '/admin/rules', icon: '⚙', label: "Règles d'accès" },
  { href: '/admin/members', icon: '👥', label: 'Membres' },
  { href: '/admin/membership', icon: '🎖️', label: 'Membres du club' },
  { href: '/admin/bookings', icon: '📋', label: 'Réservations' },
  { href: '/admin/reports', icon: '📊', label: 'Rapports' },
  { href: '/admin/integrations', icon: '🔌', label: 'Intégrations' },
]

export default function Sidebar({ profile, onClose }) {
  const pathname = usePathname()
  const isAdmin = profile?.role === 'admin'

  return (
    <aside style={{
      width: 'var(--sidebar-w)',
      background: 'var(--surface)',
      borderRight: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      flexShrink: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
          <img src="/logo.png" alt="Mayfair Padel Club" style={{ width: '36px', height: '36px', borderRadius: '8px', objectFit: 'cover' }} />
          <div>
            <div style={{ fontFamily: "'Syne', sans-serif", fontSize: '13px', fontWeight: 800, color: 'var(--brand-light)', lineHeight: 1.1 }}>MAYFAIR</div>
            <div style={{ fontFamily: "'Syne', sans-serif", fontSize: '10px', fontWeight: 600, color: 'var(--muted)', letterSpacing: '1px' }}>PADEL CLUB</div>
          </div>
        </Link>
        {onClose && (
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '20px', padding: '4px', lineHeight: 1 }}>✕</button>
        )}
      </div>

      <nav style={{ flex: 1, padding: '12px 8px', overflowY: 'auto' }}>
        {isAdmin && <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--muted)', padding: '0 10px', marginBottom: '6px' }}>Joueur</div>}
        {playerLinks.map(link => {
          const active = link.href === '/' ? pathname === '/' : pathname.startsWith(link.href)
          return (
            <Link key={link.href} href={link.href} style={{
              display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 10px',
              borderRadius: '8px', textDecoration: 'none',
              color: active ? 'var(--brand-light)' : 'var(--muted)',
              background: active ? 'var(--brand-dim)' : 'none',
              fontSize: '14px', marginBottom: '2px', transition: 'all .15s',
              borderLeft: active ? '2px solid var(--brand)' : '2px solid transparent',
            }}>
              <span style={{ fontSize: '16px', width: '20px', textAlign: 'center' }}>{link.icon}</span>
              {link.label}
            </Link>
          )
        })}

        {isAdmin && (
          <>
            <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--muted)', padding: '0 10px', marginTop: '20px', marginBottom: '6px' }}>Administration</div>
            {adminLinks.map(link => {
              const active = pathname === link.href
              return (
                <Link key={link.href} href={link.href} style={{
                  display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 10px',
                  borderRadius: '8px', textDecoration: 'none',
                  color: active ? 'var(--brand-light)' : 'var(--muted)',
                  background: active ? 'var(--brand-dim)' : 'none',
                  fontSize: '14px', marginBottom: '2px', transition: 'all .15s',
                  borderLeft: active ? '2px solid var(--brand)' : '2px solid transparent',
                }}>
                  <span style={{ fontSize: '16px', width: '20px', textAlign: 'center' }}>{link.icon}</span>
                  {link.label}
                </Link>
              )
            })}
          </>
        )}
      </nav>

      {profile && (
        <Link href="/profile" style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '14px 16px', borderTop: '1px solid var(--border)', textDecoration: 'none' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--brand-dim)', border: '1px solid var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 600, color: 'var(--brand-light)', flexShrink: 0 }}>
            {(profile.first_name || profile.email || '?')[0].toUpperCase()}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {profile.first_name ? (profile.first_name + ' ' + (profile.last_name || '')) : profile.email}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{profile.role === 'admin' ? 'Admin' : profile.role === 'member' ? 'Joueur' : 'Joueur'}</div>
          </div>
        </Link>
      )}
    </aside>
  )
}
