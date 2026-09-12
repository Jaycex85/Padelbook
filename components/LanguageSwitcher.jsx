'use client'
import { useLocale, LOCALES } from '../lib/i18n/LocaleContext'

export default function LanguageSwitcher({ style }) {
  const { locale, setLocale } = useLocale()

  return (
    <div style={{ display: 'flex', gap: '4px', ...style }}>
      {LOCALES.map(l => (
        <button
          key={l.code}
          onClick={() => setLocale(l.code)}
          style={{
            background: locale === l.code ? 'var(--brand-dim)' : 'var(--surface2)',
            border: '1px solid ' + (locale === l.code ? 'var(--brand)' : 'var(--border)'),
            color: locale === l.code ? 'var(--brand-light)' : 'var(--muted)',
            borderRadius: '6px', padding: '4px 8px', fontSize: '11px', fontWeight: 600, cursor: 'pointer',
          }}
        >
          {l.label}
        </button>
      ))}
    </div>
  )
}
