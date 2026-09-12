'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useLocale } from '../../lib/i18n/LocaleContext'

export default function BottomNav({ profile }) {
  const pathname = usePathname()
  const { t } = useLocale()
  const isAdmin = profile?.role === 'admin'

  const links = [
    { href: '/', icon: '⊞', label: t('nav.home') },
    { href: '/booking', icon: '📅', label: t('nav.booking') },
    { href: '/open-matches', icon: '👥', label: t('nav.matches') },
    { href: '/my-bookings', icon: '🎾', label: t('nav.myBookingsShort') },
    isAdmin
      ? { href: '/admin', icon: '◈', label: t('nav.admin') }
      : { href: '/profile', icon: '👤', label: t('nav.profile') },
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
        {links.map(link => (
          <Link key={link.href} href={link.href} style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: '3px',
            textDecoration: 'none',
            color: isActive(link.href) ? 'var(--brand-light)' : 'var(--muted)',
            padding: '6px 4px', transition: 'all .15s',
          }}>
            <span style={{ fontSize: '20px', lineHeight: 1 }}>{link.icon}</span>
            <span style={{ fontSize: '10px', fontWeight: 500 }}>{link.label}</span>
          </Link>
        ))}
      </nav>
      <style jsx global>{`
        @media (max-width: 767px) {
          .bottom-nav-mobile { display: flex !important; }
        }
      `}</style>
    </>
  )
}
