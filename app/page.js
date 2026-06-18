import Link from 'next/link'
import { createServerSupabase } from '../lib/supabaseServer'

export default async function HomePage() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: courts } = await supabase
    .from('courts')
    .select('*')
    .eq('status', 'active')
    .order('sort_order')

  // Non connecté : page d'accueil marketing avec CTA login
  if (!user) {
    return (
      <div>
        <div style={{ padding: '64px 0 48px', textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎾</div>
          <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: 'clamp(28px, 5vw, 48px)', fontWeight: 700, lineHeight: 1.1, letterSpacing: '-0.5px', marginBottom: '16px' }}>
            Réservez votre terrain de{' '}
            <span style={{ color: 'var(--green)' }}>padel</span>
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: '16px', maxWidth: '440px', margin: '0 auto 36px' }}>
            Créneaux en temps réel, paiement sécurisé, confirmation instantanée.
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/login" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '12px 28px', borderRadius: '10px', fontSize: '15px', fontWeight: 600, textDecoration: 'none', background: 'var(--green)', color: '#0D1117', fontFamily: "'Syne', sans-serif" }}>
              Se connecter
            </Link>
            <Link href="/register" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '12px 28px', borderRadius: '10px', fontSize: '15px', fontWeight: 500, textDecoration: 'none', background: 'none', color: 'var(--text)', border: '1px solid var(--border)' }}>
              Créer un compte
            </Link>
          </div>
        </div>

        {/* Terrains en aperçu */}
        {courts && courts.length > 0 && (
          <section style={{ marginTop: '16px' }}>
            <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: '16px', fontWeight: 700, marginBottom: '14px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px', fontSize: '12px' }}>
              Nos terrains
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' }}>
              {courts.map(court => (
                <div key={court.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', padding: '16px', opacity: 0.7 }}>
                  <div style={{ fontSize: '11px', color: 'var(--green)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
                    {court.is_indoor ? 'Indoor' : 'Outdoor'}
                  </div>
                  <div style={{ fontSize: '15px', fontWeight: 500 }}>{court.name}</div>
                  <div style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '4px' }}>{court.price_per_slot} € / slot</div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    )
  }

  // Connecté : accueil avec actions rapides
  return (
    <div>
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: '22px', fontWeight: 700 }}>Bonjour 👋</h1>
        <p style={{ color: 'var(--muted)', fontSize: '14px', marginTop: '4px' }}>
          {new Date().toLocaleDateString('fr-BE', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </div>

      {/* Actions rapides */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '10px', marginBottom: '32px' }}>
        {[
          { href: '/booking', icon: '📅', label: 'Réserver', sub: 'un terrain' },
          { href: '/open-matches', icon: '👥', label: 'Matchs ouverts', sub: 'rejoindre' },
          { href: '/my-bookings', icon: '🎾', label: 'Mes réservations', sub: 'historique' },
        ].map(a => (
          <Link key={a.href} href={a.href} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', padding: '20px 16px', textDecoration: 'none', display: 'block', transition: 'border-color .15s' }}>
            <div style={{ fontSize: '28px', marginBottom: '10px' }}>{a.icon}</div>
            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)' }}>{a.label}</div>
            <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>{a.sub}</div>
          </Link>
        ))}
      </div>

      {/* Terrains disponibles */}
      {courts && courts.length > 0 && (
        <section>
          <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: '16px', fontWeight: 700, marginBottom: '14px' }}>Terrains disponibles</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' }}>
            {courts.map(court => (
              <Link key={court.id} href={'/booking?court=' + court.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', padding: '16px', textDecoration: 'none', display: 'block' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--green)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 500 }}>
                    {court.is_indoor ? 'Indoor' : 'Outdoor'}
                  </span>
                  <span style={{ fontFamily: "'Syne', sans-serif", fontSize: '16px', fontWeight: 700, color: 'var(--green)' }}>
                    {court.price_per_slot} €
                  </span>
                </div>
                <div style={{ fontSize: '15px', fontWeight: 500, color: 'var(--text)' }}>{court.name}</div>
                {court.description && <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px' }}>{court.description}</p>}
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
