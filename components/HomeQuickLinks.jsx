'use client'
import Link from 'next/link'
import { useLocale } from '../lib/i18n/LocaleContext'

export default function HomeQuickLinks() {
  const { t } = useLocale()

  const links = [
    { href: '/booking', icon: '📅', label: t('nav.booking'), sub: t('home.quickBookingSub') },
    { href: '/events', icon: '🏆', label: t('nav.clubEvents'), sub: t('home.quickEventsSub') },
    { href: '/open-matches', icon: '👥', label: t('nav.openMatches'), sub: t('home.quickMatchesSub') },
    { href: '/my-bookings', icon: '🎾', label: t('nav.myBookings'), sub: t('home.quickHistorySub') },
  ]

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '10px', marginBottom: '32px' }}>
      {links.map(a => (
        <Link key={a.href} href={a.href} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', padding: '20px 16px', textDecoration: 'none', display: 'block' }}>
          <div style={{ fontSize: '28px', marginBottom: '10px' }}>{a.icon}</div>
          <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)' }}>{a.label}</div>
          <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>{a.sub}</div>
        </Link>
      ))}
    </div>
  )
}
