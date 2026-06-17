'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function BottomNav({ profile }) {
  const pathname = usePathname()
  const isAdmin = profile?.role === 'admin'

  const links = [
    { href: '/', icon: '⊞', label: 'Accueil' },
    { href: '/booking', icon: '📅', label: 'Réserver' },
    { href: '/open-matches', icon: '👥', label: 'Matchs' },
    { href: '/my-bookings', icon: '🎾', label: 'Mes résa' },
    ...(isAdmin ? [{ href: '/admin', icon: '◈', label: 'Admin' }] : []),
  ]

  return (
    <nav className="bottom-nav">
      {links.map(link => (
        <Link
          key={link.href}
          href={link.href}
          className={'bottom-nav-item' + (pathname === link.href || (link.href !== '/' && pathname.startsWith(link.href)) ? ' active' : '')}
        >
          <span className="bottom-nav-icon">{link.icon}</span>
          <span className="bottom-nav-label">{link.label}</span>
        </Link>
      ))}

      <style jsx>{`
        .bottom-nav {
          display: none;
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          height: var(--bottom-nav-h);
          background: var(--surface);
          border-top: 1px solid var(--border);
          z-index: 100;
          backdrop-filter: blur(8px);
        }
        @media (max-width: 767px) {
          .bottom-nav { display: flex; align-items: stretch; }
        }
        .bottom-nav-item {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 3px;
          text-decoration: none;
          color: var(--muted);
          font-size: 10px;
          transition: all .15s;
          padding: 6px 4px;
        }
        .bottom-nav-item.active { color: var(--green); }
        .bottom-nav-icon { font-size: 20px; line-height: 1; }
        .bottom-nav-label { font-size: 10px; font-weight: 500; }
      `}</style>
    </nav>
  )
}
