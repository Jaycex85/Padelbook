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
    <div>
      {/* Hero */}
      <div style={{ padding: '40px 0 36px', textAlign: 'center' }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '6px',
          background: 'var(--purple-dim)', border: '1px solid var(--border2)',
          borderRadius: '99px', padding: '5px 14px',
          fontSize: '12px', color: 'var(--purple-l)',
          fontWeight: 500, marginBottom: '20px',
        }}>
          🎾 Réservation en ligne ouverte
        </div>
        <h1 style={{
          fontFamily: "'Syne',sans-serif",
          fontSize: 'clamp(28px,6vw,52px)',
          fontWeight: 800,
          lineHeight: 1.05,
          letterSpacing: '-1px',
          marginBottom: '16px',
        }}>
          Votre terrain de padel,<br />
          <span style={{
            background: 'linear-gradient(135deg, var(--purple-l), #C084FC)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>réservé en 30 secondes.</span>
        </h1>
        <p style={{ color: 'var(--muted)', fontSize: '16px', maxWidth: '440px', margin: '0 auto 32px' }}>
          Créneaux en temps réel, paiement sécurisé, confirmation instantanée.
        </p>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/booking" style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px',
            padding: '12px 26px', borderRadius: '10px',
            background: 'linear-gradient(135deg, var(--purple), var(--purple-l))',
            color: '#fff', fontSize: '15px', fontWeight: 600,
            textDecoration: 'none', fontFamily: "'Syne',sans-serif",
            boxShadow: '0 4px 24px var(--purple-glow)',
          }}>
            Réserver maintenant
          </Link>
          <Link href="/open-matches" style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px',
            padding: '12px 26px', borderRadius: '10px',
            background: 'var(--surface2)', border: '1px solid var(--border2)',
            color: 'var(--text-dim)', fontSize: '15px', fontWeight: 500,
            textDecoration: 'none',
          }}>
            Matchs ouverts
          </Link>
        </div>
      </div>

      {/* Terrains */}
      {courts && courts.length > 0 && (
        <section style={{ marginTop: '16px' }}>
          <h2 style={{
            fontFamily: "'Syne',sans-serif", fontSize: '16px',
            fontWeight: 700, marginBottom: '14px', color: 'var(--text-dim)',
            textTransform: 'uppercase', letterSpacing: '0.5px',
          }}>
            Terrains disponibles
          </h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: '10px',
          }}>
            {courts.map(court => (
              <Link key={court.id} href={'/booking?court=' + court.id} style={{ textDecoration: 'none' }}>
                <div style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-xl)',
                  padding: '20px',
                  cursor: 'pointer',
                  transition: 'all .2s',
                  display: 'flex', flexDirection: 'column', gap: '8px',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <span style={{
                      fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.8px',
                      color: 'var(--purple-l)', fontWeight: 600,
                      background: 'var(--purple-dim)', padding: '3px 8px', borderRadius: '99px',
                    }}>
                      {court.is_indoor ? 'Indoor' : 'Outdoor'}
                    </span>
                    <span style={{
                      fontFamily: "'Syne',sans-serif", fontSize: '20px',
                      fontWeight: 800, color: 'var(--text)',
                    }}>
                      {court.price_per_slot} €
                    </span>
                  </div>
                  <div style={{ fontSize: '17px', fontWeight: 600, fontFamily: "'Syne',sans-serif" }}>
                    {court.name}
                  </div>
                  {court.description && (
                    <p style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: 1.4 }}>
                      {court.description}
                    </p>
                  )}
                  <div style={{
                    marginTop: '4px', fontSize: '12px', fontWeight: 500,
                    color: 'var(--purple-l)',
                    display: 'flex', alignItems: 'center', gap: '4px',
                  }}>
                    Voir les créneaux →
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Empty state */}
      {(!courts || courts.length === 0) && (
        <div style={{ textAlign: 'center', padding: '64px 0', color: 'var(--muted)' }}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>🏟</div>
          <p>Aucun terrain configuré pour le moment.</p>
        </div>
      )}
    </div>
  )
}
