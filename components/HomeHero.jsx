'use client'
import Link from 'next/link'
import { useLocale } from '../lib/i18n/LocaleContext'

const btnPrimary = { display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '12px 28px', borderRadius: '10px', fontSize: '15px', fontWeight: 600, textDecoration: 'none', background: 'var(--brand)', color: '#fff', fontFamily: "'Syne', sans-serif" }
const btnOutline = { display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '12px 28px', borderRadius: '10px', fontSize: '15px', fontWeight: 500, textDecoration: 'none', background: 'none', color: 'var(--text)', border: '1px solid var(--border)' }

export default function HomeHero({ courts }) {
  const { t } = useLocale()

  return (
    <div>
      <div style={{ padding: '64px 0 48px', textAlign: 'center' }}>
        <img src="/logo.png" alt="Brussels Badminton & Padel Club" style={{ width: '90px', height: '90px', borderRadius: '18px', objectFit: 'cover', marginBottom: '20px' }} />
        <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: 'clamp(28px, 5vw, 46px)', fontWeight: 800, lineHeight: 1.1, letterSpacing: '-0.5px', marginBottom: '14px' }}>
          {t('home.welcomeTo')}{' '}
          <span style={{ color: 'var(--brand-light)' }}>Brussels Badminton &amp; Padel Club</span>
        </h1>
        <p style={{ color: 'var(--muted)', fontSize: '16px', maxWidth: '420px', margin: '0 auto 32px' }}>
          {t('home.heroSubtitle')}
        </p>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/login" style={btnPrimary}>{t('home.login')}</Link>
          <Link href="/register" style={btnOutline}>{t('home.register')}</Link>
        </div>
      </div>

      {courts && courts.length > 0 && (
        <section style={{ marginTop: '16px' }}>
          <p style={{ fontSize: '11px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px' }}>{t('home.ourCourts')}</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' }}>
            {courts.map(c => (
              <div key={c.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', padding: '16px', opacity: 0.6 }}>
                <div style={{ fontSize: '11px', color: 'var(--brand-light)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>{c.is_indoor ? 'Indoor' : 'Outdoor'}</div>
                <div style={{ fontSize: '15px', fontWeight: 500 }}>{c.name}</div>
                <div style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '4px' }}>{c.price_per_slot} € / slot</div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
