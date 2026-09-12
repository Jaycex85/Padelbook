'use client'
import { useLocale } from '../lib/i18n/LocaleContext'

const DATE_LOCALES = { fr: 'fr-BE', en: 'en-GB', nl: 'nl-BE' }

export default function HomeGreeting({ firstName }) {
  const { t, locale } = useLocale()
  const dateLocale = DATE_LOCALES[locale] || 'fr-BE'

  return (
    <div style={{ marginBottom: '24px' }}>
      <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: '22px', fontWeight: 700 }}>{t('home.greeting')}{firstName ? ' ' + firstName : ''} 👋</h1>
      <p style={{ color: 'var(--muted)', fontSize: '14px', marginTop: '4px' }}>
        {new Date().toLocaleDateString(dateLocale, { weekday: 'long', day: 'numeric', month: 'long' })}
      </p>
    </div>
  )
}
