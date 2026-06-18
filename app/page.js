import Link from 'next/link'
import { createServerSupabase } from '../lib/supabaseServer'

export default async function HomePage() {
  const supabase = await createServerSupabase()
  const { data: courts } = await supabase
    .from('courts')
    .select('*')
    .eq('status', 'active')
    .order('sort_order')

  return (
    <div style={{ padding: '0' }}>
      {/* Hero */}
      <div style={{ padding: '48px 0 40px', textAlign: 'center' }}>
        <h1 style={{
          fontFamily: "'Syne', sans-serif",
          fontSize: 'clamp(28px, 5vw, 48px)',
          fontWeight: 700,
          lineHeight: 1.1,
          letterSpacing: '-0.5px',
          marginBottom: '16px'
        }}>
          Réservez votre terrain de{' '}
          <span style={{ color: 'var(--green)' }}>padel</span>
        </h1>
        <p style={{ color: 'var(--muted)', fontSize: '16px', maxWidth: '480px', margin: '0 auto 32px' }}>
          Créneaux disponibles en temps réel. Paiement sécurisé. Confirmation instantanée.
        </p>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/booking" style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px',
            padding: '11px 22px', borderRadius: '10px', fontSize: '14px',
            fontWeight: 500, textDecoration: 'none',
            background: 'var(--green)', color: '#0D1117'
          }}>
            📅 Réserver
          </Link>
          <Link href="/open-matches" style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px',
            padding: '11px 22px', borderRadius: '10px', fontSize: '14px',
            fontWeight: 500, textDecoration: 'none',
            background: 'none', color: 'var(--text)', border: '1px solid var(--border)'
          }}>
            👥 Matchs ouverts
          </Link>
        </div>
      </div>

      {/* Terrains */}
      {courts && courts.length > 0 && (
        <section style={{ marginTop: '32px' }}>
          <h2 style={{
            fontFamily: "'Syne', sans-serif", fontSize: '18px',
            fontWeight: 700, marginBottom: '16px'
          }}>
            Nos terrains
          </h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: '12px'
          }}>
            {courts.map(court => (
              <div key={court.id} style={{
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: '16px', padding: '18px',
                display: 'flex', flexDirection: 'column', gap: '8px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{
                    fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px',
                    color: 'var(--green)', fontWeight: 500
                  }}>
                    {court.is_indoor ? 'Indoor' : 'Outdoor'}
                  </span>
                  <span style={{
                    fontFamily: "'Syne', sans-serif", fontSize: '18px',
                    fontWeight: 700, color: 'var(--green)'
                  }}>
                    {court.price_per_slot} €
                  </span>
                </div>
                <div style={{ fontSize: '16px', fontWeight: 500 }}>{court.name}</div>
                {court.description && (
                  <p style={{ fontSize: '13px', color: 'var(--muted)', flex: 1 }}>{court.description}</p>
                )}
                <Link href={'/booking?court=' + court.id} style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  padding: '8px 16px', borderRadius: '8px', fontSize: '13px',
                  fontWeight: 500, textDecoration: 'none',
                  background: 'var(--green)', color: '#0D1117', marginTop: '4px'
                }}>
                  Réserver ce terrain
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
