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
          aria-label={l.label}
          aria-pressed={locale === l.code}
          title={l.label}
          style={{
            background: locale === l.code ? 'var(--brand-dim)' : 'var(--surface2)',
            border: '1px solid ' + (locale === l.code ? 'var(--brand)' : 'var(--border)'),
            borderRadius: '6px', padding: '3px 7px', fontSize: '15px', lineHeight: 1,
            cursor: 'pointer', opacity: locale === l.code ? 1 : 0.55,
            filter: locale === l.code ? 'none' : 'grayscale(35%)',
            transition: 'opacity 0.15s, filter 0.15s',
          }}
        >
          {l.flag}
        </button>
      ))}
    </div>
  )
}
