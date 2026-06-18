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
    isAdmin
      ? { href: '/admin', icon: '◈', label: 'Admin' }
      : { href: '/profile', icon: '👤', label: 'Profil' },
  ]

  const isActive = (href) => href === '/' ? pathname === '/' : pathname.startsWith(href)

  return (
    <>
      <nav className="bottom-nav-mobile" style={{
        display: 'none',
        position: 'fixed',
        bottom: 0, left: 0, right: 0,
        height: 'var(--bottom-nav-h)',
        background: 'var(--surface)',
        borderTop: '1px solid var(--border)',
        zIndex: 100,
        backdropFilter: 'blur(8px)',
      }}>
        {links.map(link => {
          const active = isActive(link.href)
          return (
            <Link key={link.href} href={link.href} style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '3px',
              textDecoration: 'none',
              color: active ? 'var(--brand-light)' : 'var(--muted)',
              padding: '6px 4px',
              transition: 'all .15s',
              borderTop: active ? '2px solid var(--brand)' : '2px solid transparent',
            }}>
              <span style={{ fontSize: '20px', lineHeight: 1 }}>{link.icon}</span>
              <span style={{ fontSize: '10px', fontWeight: active ? 600 : 400 }}>{link.label}</span>
            </Link>
          )
        })}
      </nav>
      <style jsx global>{`
        @media (max-width: 767px) {
          .bottom-nav-mobile { display: flex !important; }
          main { padding-bottom: calc(var(--bottom-nav-h) + 16px); }
        }
      `}</style>
    </>
  )
}
