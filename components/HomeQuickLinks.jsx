'use client'
import Link from 'next/link'
import { useLocale } from '../lib/i18n/LocaleContext'
import { usePreferences } from '../lib/preferencesContext'

export default function HomeQuickLinks() {
  const { t } = useLocale()
  const { homeTiles } = usePreferences()

  const ALL_LINKS = {
    booking: { href: '/booking', icon: '📅', label: t('nav.booking'), sub: t('home.quickBookingSub') },
    events: { href: '/events', icon: '🏆', label: t('nav.clubEvents'), sub: t('home.quickEventsSub') },
    openMatches: { href: '/open-matches', icon: '👥', label: t('nav.openMatches'), sub: t('home.quickMatchesSub') },
    myBookings: { href: '/my-bookings', icon: '🎾', label: t('nav.myBookings'), sub: t('home.quickHistorySub') },
  }

  // Ordre + visibilité pilotés par les préférences ; on retombe sur l'ordre
  // par défaut si un ancien état sauvegardé ne contient pas encore une clé.
  const links = homeTiles
    .filter(pref => pref.visible && ALL_LINKS[pref.key])
    .map(pref => ALL_LINKS[pref.key])

  if (links.length === 0) return null

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
