'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function BottomNav({ profile }) {
  const pathname = usePathname()
  const isAdmin = profile?.role === 'admin'

  const links = [
    {
      href: '/booking',
      label: 'Réserver',
      icon: (active) => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/>
          <line x1="8" y1="2" x2="8" y2="6"/>
          <line x1="3" y1="10" x2="21" y2="10"/>
          <circle cx="12" cy="15" r="2" fill={active ? 'currentColor' : 'none'}/>
        </svg>
      ),
    },
    {
      href: '/open-matches',
      label: 'Matchs',
      icon: (active) => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="9" cy="7" r="3"/>
          <circle cx="15" cy="7" r="3"/>
          <path d="M3 21v-2a5 5 0 0 1 5-5h8a5 5 0 0 1 5 5v2"/>
        </svg>
      ),
    },
    ...(isAdmin ? [{
      href: '/admin',
      label: 'Admin',
      icon: (active) => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2L2 7l10 5 10-5-10-5z"/>
          <path d="M2 17l10 5 10-5"/>
          <path d="M2 12l10 5 10-5"/>
        </svg>
      ),
    }] : []),
  ]

  return (
    <nav style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      height: 'var(--bottomnav-h)',
      background: 'var(--surface)',
      borderTop: '1px solid var(--border)',
      display: 'flex', alignItems: 'stretch',
      zIndex: 80,
    }}>
      {links.map(link => {
        const active = link.href === '/'
          ? pathname === '/'
          : pathname.startsWith(link.href)
        return (
          <Link key={link.href} href={link.href} style={{
            flex: 1,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            gap: '3px',
            textDecoration: 'none',
            color: active ? 'var(--purple-l)' : 'var(--muted)',
            fontSize: '10px', fontWeight: active ? 600 : 400,
            transition: 'color .15s',
            position: 'relative',
          }}>
            {active && (
              <span style={{
                position: 'absolute', top: 0, left: '20%', right: '20%',
                height: '2px',
                background: 'linear-gradient(90deg, var(--purple), var(--purple-l))',
                borderRadius: '0 0 4px 4px',
              }} />
            )}
            {link.icon(active)}
            {link.label}
          </Link>
        )
      })}
    </nav>
  )
}
