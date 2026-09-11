import Link from 'next/link'
import { createServerSupabase } from '../lib/supabaseServer'
import ClubFeed from '../components/ClubFeed'
import CourtsGrid from '../components/CourtsGrid'
import NextEventBanner from '../components/NextEventBanner'

export default async function HomePage() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: courts } = await supabase.from('courts').select('*').eq('status', 'active').order('sort_order')

  let profile = null
  if (user) {
    const { data: p } = await supabase.from('profiles').select('role, first_name').eq('id', user.id).single()
    profile = p
  }

  const btnPrimary = { display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '12px 28px', borderRadius: '10px', fontSize: '15px', fontWeight: 600, textDecoration: 'none', background: 'var(--brand)', color: '#fff', fontFamily: "'Syne', sans-serif" }
  const btnOutline = { display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '12px 28px', borderRadius: '10px', fontSize: '15px', fontWeight: 500, textDecoration: 'none', background: 'none', color: 'var(--text)', border: '1px solid var(--border)' }

  if (!user) {
    return (
      <div>
        <div style={{ padding: '64px 0 48px', textAlign: 'center' }}>
          <img src="/logo.png" alt="Brussels Badminton & Padel Club" style={{ width: '90px', height: '90px', borderRadius: '18px', objectFit: 'cover', marginBottom: '20px' }} />
          <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: 'clamp(28px, 5vw, 46px)', fontWeight: 800, lineHeight: 1.1, letterSpacing: '-0.5px', marginBottom: '14px' }}>
            Bienvenue au{' '}
            <span style={{ color: 'var(--brand-light)' }}>Brussels Badminton &amp; Padel Club</span>
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: '16px', maxWidth: '420px', margin: '0 auto 32px' }}>
            Réservez votre terrain en ligne, paiement sécurisé, confirmation instantanée.
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/login" style={btnPrimary}>Se connecter</Link>
            <Link href="/register" style={btnOutline}>Créer un compte</Link>
          </div>
        </div>

        {courts && courts.length > 0 && (
          <section style={{ marginTop: '16px' }}>
            <p style={{ fontSize: '11px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px' }}>Nos terrains</p>
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

  // Prochains événements à venir — on en récupère plusieurs pour pouvoir
  // trouver le premier qui correspond au sport actif de la session (côté client).
  const now = new Date().toISOString()
  const { data: nextEvents } = await supabase
    .from('club_events')
    .select('*, club_event_courts(courts(name)), event_registrations(id, status)')
    .eq('status', 'active')
    .gte('ends_at', now)
    .order('starts_at')
    .limit(20)

  const nextEvent = nextEvents && nextEvents[0]
  const fmtEventDate = d => new Date(d).toLocaleDateString('fr-BE', { weekday: 'long', day: 'numeric', month: 'long' })
  const fmtEventTime = d => new Date(d).toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit' })

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: '22px', fontWeight: 700 }}>Bonjour{profile?.first_name ? ' ' + profile.first_name : ''} 👋</h1>
        <p style={{ color: 'var(--muted)', fontSize: '14px', marginTop: '4px' }}>
          {new Date().toLocaleDateString('fr-BE', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </div>

      {/* Prochain Club Event en avant si présent, filtré par sport côté client */}
      {nextEvents && nextEvents.length > 0 && <NextEventBanner events={nextEvents} />}

      <ClubFeed isAdmin={profile?.role === 'admin'} userId={user.id} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '10px', marginBottom: '32px' }}>
        {[
          { href: '/booking', icon: '📅', label: 'Réserver', sub: 'un terrain' },
          { href: '/events', icon: '🏆', label: 'Club Events', sub: 'tournois & soirées' },
          { href: '/open-matches', icon: '👥', label: 'Matchs ouverts', sub: 'rejoindre' },
          { href: '/my-bookings', icon: '🎾', label: 'Mes réservations', sub: 'historique' },
        ].map(a => (
          <Link key={a.href} href={a.href} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', padding: '20px 16px', textDecoration: 'none', display: 'block' }}>
            <div style={{ fontSize: '28px', marginBottom: '10px' }}>{a.icon}</div>
            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)' }}>{a.label}</div>
            <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>{a.sub}</div>
          </Link>
        ))}
      </div>

      {courts && courts.length > 0 && <CourtsGrid courts={courts} />}
    </div>
  )
}
