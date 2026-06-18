'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const PLAYER_LINKS = [
  { href: '/', icon: '⊞', label: 'Accueil' },
  { href: '/my-bookings', icon: '🎾', label: 'Mes réservations' },
  { href: '/profile', icon: '👤', label: 'Mon profil' },
]

const ADMIN_LINKS = [
  { href: '/admin', icon: '◈', label: 'Dashboard' },
  { href: '/admin/courts', icon: '🏟', label: 'Terrains' },
  { href: '/admin/schedule', icon: '🗓', label: 'Calendrier' },
  { href: '/admin/rules', icon: '⚙', label: "Règles d'accès" },
  { href: '/admin/members', icon: '👥', label: 'Membres' },
  { href: '/admin/bookings', icon: '📋', label: 'Réservations' },
  { href: '/admin/integrations', icon: '🔌', label: 'Intégrations' },
]

export default function Sidebar({ profile, open, onClose }) {
  const pathname = usePathname()
  const isAdmin = profile?.role === 'admin'

  const isActive = (href) => {
    if (href === '/') return pathname === '/'
    return pathname.startsWith(href)
  }

  return (
    <>
      {/* Overlay mobile */}
      {open && (
        <div
          onClick={onClose}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.6)',
            zIndex: 90,
            backdropFilter: 'blur(2px)',
          }}
        />
      )}

      {/* Sidebar panel */}
      <aside style={{
        position: 'fixed',
        top: 0, left: 0, bottom: 0,
        width: 'var(--sidebar-w)',
        background: 'var(--surface)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 100,
        transform: open ? 'translateX(0)' : 'translateX(-100%)',
        transition: 'transform 0.25s cubic-bezier(0.4,0,0.2,1)',
      }}>

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 16px',
          height: 'var(--topbar-h)',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: 32, height: 32,
              background: 'linear-gradient(135deg, var(--purple), var(--purple-l))',
              borderRadius: '8px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '16px',
            }}>🎾</div>
            <span style={{
              fontFamily: "'Syne',sans-serif",
              fontWeight: 800, fontSize: '17px',
              color: 'var(--text)',
              letterSpacing: '-0.3px',
            }}>PadelBook</span>
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--muted)', fontSize: '20px', lineHeight: 1,
            padding: '4px', borderRadius: '6px',
            transition: 'color .15s',
          }}>✕</button>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '12px 10px', overflowY: 'auto' }}>

          {/* Section joueur */}
          <div style={{ marginBottom: '4px' }}>
            {PLAYER_LINKS.map(link => (
              <Link key={link.href} href={link.href} onClick={onClose} style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                padding: '9px 12px',
                borderRadius: '10px',
                textDecoration: 'none',
                color: isActive(link.href) ? 'var(--text)' : 'var(--muted)',
                background: isActive(link.href) ? 'var(--purple-dim)' : 'transparent',
                fontSize: '14px',
                fontWeight: isActive(link.href) ? 500 : 400,
                marginBottom: '2px',
                transition: 'all .15s',
                borderLeft: isActive(link.href) ? '2px solid var(--purple-l)' : '2px solid transparent',
              }}>
                <span style={{ fontSize: '15px', width: '20px', textAlign: 'center', flexShrink: 0 }}>{link.icon}</span>
                {link.label}
              </Link>
            ))}
          </div>

          {/* Section admin */}
          {isAdmin && (
            <div style={{ marginTop: '16px' }}>
              <div style={{
                fontSize: '10px', fontWeight: 600,
                textTransform: 'uppercase', letterSpacing: '1px',
                color: 'var(--muted)',
                padding: '0 12px', marginBottom: '6px',
              }}>Administration</div>
              {ADMIN_LINKS.map(link => (
                <Link key={link.href} href={link.href} onClick={onClose} style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '9px 12px',
                  borderRadius: '10px',
                  textDecoration: 'none',
                  color: isActive(link.href) ? 'var(--text)' : 'var(--muted)',
                  background: isActive(link.href) ? 'var(--purple-dim)' : 'transparent',
                  fontSize: '14px',
                  fontWeight: isActive(link.href) ? 500 : 400,
                  marginBottom: '2px',
                  transition: 'all .15s',
                  borderLeft: isActive(link.href) ? '2px solid var(--purple-l)' : '2px solid transparent',
                }}>
                  <span style={{ fontSize: '15px', width: '20px', textAlign: 'center', flexShrink: 0 }}>{link.icon}</span>
                  {link.label}
                </Link>
              ))}
            </div>
          )}
        </nav>

        {/* Profile footer */}
        {profile && (
          <div style={{
            padding: '12px 16px',
            borderTop: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', gap: '10px',
            flexShrink: 0,
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--purple), var(--purple-l))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '14px', fontWeight: 700, color: '#fff',
              flexShrink: 0,
            }}>
              {(profile.first_name || profile.email || '?')[0].toUpperCase()}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: '13px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {profile.first_name ? (profile.first_name + ' ' + (profile.last_name || '')).trim() : profile.email}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--muted)', textTransform: 'capitalize' }}>
                {profile.role}
                {profile.ranking ? ' · ' + profile.ranking : ''}
              </div>
            </div>
          </div>
        )}
      </aside>
    </>
  )
}
