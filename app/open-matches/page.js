'use client'
import { useState, useEffect } from 'react'
import { createClient } from '../../lib/supabase'
import { calcEffectivePrice } from '../../lib/bookingUtils'

export default function OpenMatchesPage() {
  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState(null)
  const [joining, setJoining] = useState(null)
  const supabase = createClient()

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setProfile(p)
    }
    const now = new Date().toISOString()
    const { data } = await supabase
      .from('bookings')
      .select('*, court:courts(name, is_indoor, price_per_slot), owner:profiles(first_name, last_name, email), players:booking_players(id, player_id, payment_status)')
      .eq('is_public', true)
      .in('status', ['pending', 'confirmed'])
      .gte('starts_at', now)
      .order('starts_at')
    setMatches(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleJoin(match) {
    if (!profile) { window.location.href = '/login'; return }
    const alreadyIn = (match.players || []).some(p => p.player_id === profile.id)
    if (alreadyIn) { alert('Vous êtes déjà inscrit à ce match.'); return }
    const spots = match.max_players - (match.players || []).length
    if (spots <= 0) { alert('Ce match est complet.'); return }

    setJoining(match.id)
    const discount = profile.discount_percent || 0
    const basePrice = match.price_per_player
    const effectivePrice = calcEffectivePrice(basePrice, discount)

    await supabase.from('booking_players').insert({
      booking_id: match.id,
      player_id: profile.id,
      is_owner: false,
      payment_status: 'pending',
      base_price: basePrice,
      discount_percent: discount,
      effective_price: effectivePrice,
    })
    setJoining(null)
    load()
  }

  const fmt = d => new Date(d).toLocaleDateString('fr-BE', { weekday: 'short', day: 'numeric', month: 'short' })
  const fmtTime = d => new Date(d).toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit' })
  const ownerName = m => m.owner ? (m.owner.first_name || m.owner.email) : '—'

  if (loading) return <div style={{ textAlign: 'center', padding: '48px', color: 'var(--muted)' }}>Chargement...</div>

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontFamily: "'Syne',sans-serif", fontSize: '22px', fontWeight: 700 }}>Matchs ouverts</h1>
        <p style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '4px' }}>
          Rejoignez un match existant et payez uniquement votre part.
        </p>
      </div>

      {matches.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '64px', color: 'var(--muted)' }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>🎾</div>
          <p style={{ marginBottom: '16px' }}>Aucun match public disponible pour le moment.</p>
          <a href="/booking" style={{ background: 'var(--green)', color: '#0D1117', padding: '10px 20px', borderRadius: '8px', textDecoration: 'none', fontSize: '14px', fontWeight: 600 }}>
            Créer un match
          </a>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {matches.map(m => {
            const spotsTotal = m.max_players || 4
            const spotsTaken = (m.players || []).length
            const spotsLeft = spotsTotal - spotsTaken
            const isAlreadyIn = profile && (m.players || []).some(p => p.player_id === profile.id)
            const isFull = spotsLeft <= 0
            const myPrice = calcEffectivePrice(m.price_per_player, profile?.discount_percent || 0)

            return (
              <div key={m.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '18px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontFamily: "'Syne',sans-serif", fontSize: '16px', fontWeight: 700 }}>{m.court?.name}</span>
                      <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '99px', background: m.court?.is_indoor ? 'rgba(96,165,250,0.1)' : 'rgba(74,222,128,0.1)', color: m.court?.is_indoor ? '#93C5FD' : 'var(--green)' }}>
                        {m.court?.is_indoor ? 'Indoor' : 'Outdoor'}
                      </span>
                    </div>
                    <div style={{ fontSize: '14px', color: 'var(--muted)', marginBottom: '10px' }}>
                      {fmt(m.starts_at)} · {fmtTime(m.starts_at)} → {fmtTime(m.ends_at)}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                      {/* Joueurs spots */}
                      <div style={{ display: 'flex', gap: '4px' }}>
                        {Array.from({ length: spotsTotal }).map((_, i) => (
                          <div key={i} style={{ width: '28px', height: '28px', borderRadius: '50%', background: i < spotsTaken ? 'rgba(74,222,128,0.15)' : 'var(--surface2)', border: '1.5px solid ' + (i < spotsTaken ? 'var(--green)' : 'var(--border)'), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px' }}>
                            {i < spotsTaken ? '👤' : ''}
                          </div>
                        ))}
                      </div>
                      <span style={{ fontSize: '12px', color: isFull ? 'var(--red)' : 'var(--green)' }}>
                        {isFull ? 'Complet' : spotsLeft + ' place' + (spotsLeft > 1 ? 's' : '') + ' libre' + (spotsLeft > 1 ? 's' : '')}
                      </span>
                      <span style={{ fontSize: '12px', color: 'var(--muted)' }}>Organisé par {ownerName(m)}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                    <div style={{ fontFamily: "'Syne',sans-serif", fontSize: '20px', fontWeight: 700, color: 'var(--green)' }}>
                      {myPrice} €
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--muted)' }}>votre part</div>
                    {isAlreadyIn ? (
                      <span style={{ fontSize: '12px', color: 'var(--green)', padding: '6px 14px', border: '1px solid var(--green)', borderRadius: '8px' }}>Inscrit ✓</span>
                    ) : (
                      <button onClick={() => handleJoin(m)} disabled={isFull || joining === m.id}
                        style={{ background: isFull ? 'var(--surface2)' : 'var(--green)', color: isFull ? 'var(--muted)' : '#0D1117', border: 'none', borderRadius: '8px', padding: '9px 18px', fontSize: '13px', fontWeight: 600, cursor: isFull ? 'not-allowed' : 'pointer', fontFamily: "'Syne',sans-serif", opacity: joining === m.id ? 0.6 : 1 }}>
                        {joining === m.id ? '...' : isFull ? 'Complet' : 'Rejoindre'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
