'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const playerLinks = [
  { href: '/', icon: '⊞', label: 'Accueil' },
  { href: '/booking', icon: '📅', label: 'Réserver' },
  { href: '/my-bookings', icon: '🎾', label: 'Mes réservations' },
  { href: '/open-matches', icon: '👥', label: 'Matchs ouverts' },
]

const adminLinks = [
  { href: '/admin', icon: '◈', label: 'Dashboard' },
  { href: '/admin/courts', icon: '🏟', label: 'Terrains' },
  { href: '/admin/schedule', icon: '🗓', label: 'Calendrier' },
  { href: '/admin/rules', icon: '⚙', label: 'Règles accès' },
  { href: '/admin/members', icon: '👤', label: 'Membres' },
  { href: '/admin/bookings', icon: '📋', label: 'Réservations' },
  { href: '/admin/integrations', icon: '🔌', label: 'Intégrations' },
]

export default function Sidebar({ profile }) {
  const pathname = usePathname()
  const isAdmin = profile?.role === 'admin'
  const links = isAdmin ? [...playerLinks, ...adminLinks] : playerLinks

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <span className="logo-icon">🎾</span>
        <span className="logo-text">PadelBook</span>
      </div>

      {/* Nav */}
      <nav className="sidebar-nav">
        {isAdmin && <div className="nav-section-label">Joueur</div>}
        {playerLinks.map(link => (
          <Link
            key={link.href}
            href={link.href}
            className={'nav-item' + (pathname === link.href ? ' active' : '')}
          >
            <span className="nav-icon">{link.icon}</span>
            <span className="nav-label">{link.label}</span>
          </Link>
        ))}

        {isAdmin && (
          <>
            <div className="nav-section-label" style={{marginTop: '16px'}}>Administration</div>
            {adminLinks.map(link => (
              <Link
                key={link.href}
                href={link.href}
                className={'nav-item' + (pathname === link.href ? ' active' : '')}
              >
                <span className="nav-icon">{link.icon}</span>
                <span className="nav-label">{link.label}</span>
              </Link>
            ))}
          </>
        )}
      </nav>

      {/* Profile */}
      {profile && (
        <div className="sidebar-profile">
          <div className="profile-avatar">
            {(profile.first_name || profile.email || '?')[0].toUpperCase()}
          </div>
          <div className="profile-info">
            <div className="profile-name">
              {profile.first_name ? profile.first_name + ' ' + (profile.last_name || '') : profile.email}
            </div>
            <div className="profile-role">{profile.role}</div>
          </div>
        </div>
      )}

      <style jsx>{`
        .sidebar {
          width: var(--sidebar-w);
          background: var(--surface);
          border-right: 1px solid var(--border);
          display: flex;
          flex-direction: column;
          position: sticky;
          top: 0;
          height: 100vh;
          flex-shrink: 0;
        }
        @media (max-width: 767px) { .sidebar { display: none; } }

        .sidebar-logo {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 20px 16px;
          border-bottom: 1px solid var(--border);
          font-family: 'Syne', sans-serif;
          font-size: 18px;
          font-weight: 700;
          color: var(--green);
        }
        .logo-icon { font-size: 22px; }

        .sidebar-nav {
          flex: 1;
          padding: 12px 8px;
          overflow-y: auto;
        }
        .nav-section-label {
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.8px;
          color: var(--muted);
          padding: 0 10px;
          margin-bottom: 4px;
        }
        .nav-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 9px 10px;
          border-radius: 8px;
          text-decoration: none;
          color: var(--muted);
          font-size: 14px;
          transition: all .15s;
          margin-bottom: 2px;
        }
        .nav-item:hover { background: var(--surface2); color: var(--text); }
        .nav-item.active { background: var(--green-dim); color: var(--green); }
        .nav-icon { font-size: 16px; width: 20px; text-align: center; }

        .sidebar-profile {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 14px 16px;
          border-top: 1px solid var(--border);
        }
        .profile-avatar {
          width: 32px;
          height: 32px;
          background: var(--green-dim);
          border: 1px solid var(--green);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 13px;
          font-weight: 600;
          color: var(--green);
          flex-shrink: 0;
        }
        .profile-name {
          font-size: 13px;
          font-weight: 500;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .profile-role {
          font-size: 11px;
          color: var(--muted);
          text-transform: capitalize;
        }
      `}</style>
    </aside>
  )
}
