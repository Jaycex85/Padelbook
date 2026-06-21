'use client'
import { useState, useEffect } from 'react'
import { createClient } from '../../lib/supabase'
import Chat from '../../components/Chat'

export default function EventsPage() {
  const [events, setEvents] = useState([])
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [registering, setRegistering] = useState(null)
  const [openChatId, setOpenChatId] = useState(null)
  const supabase = createClient()

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    let p = null
    if (user) {
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      p = data
      setProfile(data)
    }

    const now = new Date().toISOString()
    const { data } = await supabase
      .from('club_events')
      .select('*, club_event_courts(courts(name)), event_registrations(id, player_id, status, payment_status)')
      .eq('status', 'active')
      .gte('ends_at', now)
      .order('starts_at')

    const role = p?.role || 'public'
    const visible = (data || []).filter(ev => {
      if (ev.who === 'all') return true
      if (ev.who === 'member') return role === 'member' || role === 'admin'
      if (ev.who === 'public') return role === 'public'
      return true
    })

    setEvents(visible)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleRegister(event) {
    if (!profile) { window.location.href = '/login'; return }
    setRegistering(event.id)

    const { data: reg, error } = await supabase.from('event_registrations').insert({
      event_id: event.id,
      player_id: profile.id,
      status: 'pending',
      payment_status: 'pending',
      price_paid: event.price_per_player,
    }).select().single()

    if (error) { alert(error.message); setRegistering(null); return }

    const res = await fetch('/api/payments/initiate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_registration_id: reg.id, amount: event.price_per_player }),
    })
    const payData = await res.json()
    setRegistering(null)
    if (payData.payment_url) window.location.href = payData.payment_url
    else load()
  }

  async function handleCancel(registrationId) {
    await supabase.from('event_registrations').update({ status: 'cancelled', cancelled_at: new Date().toISOString() }).eq('id', registrationId)
    load()
  }

  const fmt = d => new Date(d).toLocaleDateString('fr-BE', { weekday: 'short', day: 'numeric', month: 'short' })
  const fmtTime = d => new Date(d).toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit' })

  if (loading) return <div style={{ textAlign: 'center', padding: '48px', color: 'var(--muted)' }}>Chargement...</div>

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontFamily: "'Syne',sans-serif", fontSize: '22px', fontWeight: 700 }}>Club Events</h1>
        <p style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '4px' }}>Tournois et événements spéciaux du club</p>
      </div>

      {events.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '64px', color: 'var(--muted)' }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>🏆</div>
          <p>Aucun événement prévu pour le moment.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {events.map(ev => {
            const regs = (ev.event_registrations || []).filter(r => r.status !== 'cancelled')
            const spotsLeft = ev.max_players - regs.length
            const isFull = spotsLeft <= 0
            const myReg = profile && (ev.event_registrations || []).find(r => r.player_id === profile.id && r.status !== 'cancelled')
            const courtsNames = (ev.club_event_courts || []).map(c => c.courts?.name).filter(Boolean).join(', ')
            const isRegistered = !!myReg

            return (
              <div key={ev.id} style={{ background: 'var(--surface)', border: '1px solid var(--brand)', borderRadius: '16px', padding: '20px', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 0, right: 0, background: 'var(--brand)', color: '#fff', fontSize: '10px', fontWeight: 700, padding: '4px 14px', borderRadius: '0 0 0 10px', letterSpacing: '0.5px' }}>
                  EVENT
                </div>

                <div style={{ fontFamily: "'Syne',sans-serif", fontSize: '18px', fontWeight: 700, marginBottom: '6px', paddingRight: '70px' }}>
                  Mayfair Padel — {ev.label}
                </div>

                <div style={{ fontSize: '14px', color: 'var(--muted)', marginBottom: '4px' }}>
                  📅 {fmt(ev.starts_at)} · {fmtTime(ev.starts_at)} → {fmtTime(ev.ends_at)}
                </div>
                <div style={{ fontSize: '14px', color: 'var(--muted)', marginBottom: '12px' }}>
                  🎾 {courtsNames}
                </div>

                {ev.description && (
                  <p style={{ fontSize: '13px', color: 'var(--text)', background: 'var(--surface2)', borderRadius: '10px', padding: '12px', marginBottom: '14px', lineHeight: 1.5 }}>
                    {ev.description}
                  </p>
                )}

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '12px', padding: '4px 12px', borderRadius: '99px', background: isFull ? 'rgba(248,113,113,0.1)' : 'var(--brand-dim)', color: isFull ? 'var(--red)' : 'var(--brand-light)' }}>
                      {isFull ? 'Complet' : spotsLeft + ' place' + (spotsLeft > 1 ? 's' : '') + ' libre' + (spotsLeft > 1 ? 's' : '')}
                    </span>
                    <span style={{ fontSize: '12px', padding: '4px 12px', borderRadius: '99px', background: 'var(--surface2)', color: 'var(--muted)' }}>
                      {regs.length}/{ev.max_players} inscrits
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontFamily: "'Syne',sans-serif", fontSize: '18px', fontWeight: 700, color: 'var(--brand-light)' }}>
                      {ev.price_per_player} €
                    </span>
                    {myReg ? (
                      <button onClick={() => handleCancel(myReg.id)}
                        style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--red)', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', cursor: 'pointer' }}>
                        Se désinscrire
                      </button>
                    ) : (
                      <button onClick={() => handleRegister(ev)} disabled={isFull || registering === ev.id}
                        style={{ background: isFull ? 'var(--surface2)' : 'var(--brand)', color: isFull ? 'var(--muted)' : '#fff', border: 'none', borderRadius: '8px', padding: '9px 20px', fontSize: '13px', fontWeight: 600, cursor: isFull ? 'not-allowed' : 'pointer', fontFamily: "'Syne',sans-serif" }}>
                        {registering === ev.id ? '...' : isFull ? 'Complet' : "S'inscrire"}
                      </button>
                    )}
                  </div>
                </div>

                <button onClick={() => setOpenChatId(openChatId === ev.id ? null : ev.id)}
                  style={{ background: openChatId === ev.id ? 'var(--brand-dim)' : 'var(--surface2)', border: '1px solid ' + (openChatId === ev.id ? 'var(--brand)' : 'var(--border)'), color: openChatId === ev.id ? 'var(--brand-light)' : 'var(--muted)', borderRadius: '8px', padding: '7px 14px', fontSize: '12px', cursor: 'pointer' }}>
                  💬 Discussion {openChatId === ev.id ? '▲' : '▼'}
                </button>

                {openChatId === ev.id && (
                  <div style={{ marginTop: '12px' }}>
                    <Chat eventId={ev.id} endsAt={ev.ends_at} isRegistered={isRegistered} isPublicAccess={true} isAdmin={profile?.role === 'admin'} />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
