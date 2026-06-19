'use client'
import { useState, useEffect } from 'react'
import { createClient } from '../../lib/supabase'
import { generateSlots, evaluateAccessRules, calcEffectivePrice } from '../../lib/bookingUtils'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

const PAYMENT_MODE_LABELS = { full: 'Paiement complet', split: 'Split par joueur', wallet: 'Wallet' }

function BookingForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const [courts, setCourts] = useState([])
  const [selectedCourt, setSelectedCourt] = useState(null)
  const [selectedDate, setSelectedDate] = useState('')
  const [slots, setSlots] = useState([])
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [profile, setProfile] = useState(null)
  const [accessRules, setAccessRules] = useState([])
  const [isPublic, setIsPublic] = useState(false)
  const [paymentMode, setPaymentMode] = useState('full')
  const [loading, setLoading] = useState(true)
  const [booking, setBooking] = useState(false)
  const [error, setError] = useState(null)

  const dates = Array.from({ length: 14 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() + i)
    return d.toISOString().split('T')[0]
  })

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
        setProfile(p)
      }
      const { data: c } = await supabase.from('courts').select('*').eq('status', 'active').order('sort_order')
      setCourts(c || [])
      const { data: r } = await supabase.from('access_rules').select('*').eq('is_active', true)
      setAccessRules(r || [])

      const courtParam = searchParams.get('court')
      if (courtParam && c) {
        const found = c.find(x => x.id === courtParam)
        if (found) setSelectedCourt(found)
      } else if (c && c.length > 0) {
        setSelectedCourt(c[0])
      }
      setSelectedDate(dates[0])
      setLoading(false)
    }
    init()
  }, [])

  useEffect(() => {
    if (!selectedCourt || !selectedDate) return
    loadSlots()
  }, [selectedCourt, selectedDate])

  async function loadSlots() {
    const [{ data: schedule }, { data: bookings }, { data: blocks }] = await Promise.all([
      supabase.from('weekly_schedule').select('*').eq('court_id', selectedCourt.id).eq('is_active', true),
      supabase.from('bookings').select('starts_at, ends_at').eq('court_id', selectedCourt.id).in('status', ['confirmed', 'pending']),
      supabase.from('blocks').select('*').gte('ends_at', selectedDate + 'T00:00:00').lte('starts_at', selectedDate + 'T23:59:59'),
    ])
    const generated = generateSlots(selectedDate, schedule || [], bookings || [], blocks || [], selectedCourt.id)
    setSlots(generated)
    setSelectedSlot(null)
  }

  async function handleBook() {
    if (!selectedSlot || !selectedCourt) return
    if (!profile) { router.push('/login'); return }

    const userRole = profile?.role || 'public'
    const timeStr = selectedSlot.start.toTimeString().substring(0, 5)
    const allowed = evaluateAccessRules(accessRules, userRole, selectedDate, timeStr)
    if (!allowed) { setError("Ce créneau n'est pas accessible avec votre profil."); return }

    setBooking(true)
    setError(null)

    const totalPrice = selectedCourt.price_per_slot
    const pricePerPlayer = totalPrice / 4
    const discount = profile?.discount_percent || 0
    const effectivePrice = calcEffectivePrice(pricePerPlayer, discount)

    const { data: newBooking, error: bookErr } = await supabase.from('bookings').insert({
      court_id: selectedCourt.id,
      owner_id: profile.id,
      status: 'pending',
      starts_at: selectedSlot.start.toISOString(),
      ends_at: selectedSlot.end.toISOString(),
      payment_mode: paymentMode,
      total_price: totalPrice,
      price_per_player: pricePerPlayer,
      is_public: isPublic,
      max_players: 4,
      cancellation_deadline: new Date(selectedSlot.start.getTime() - 24 * 3600 * 1000).toISOString(),
    }).select().single()

    if (bookErr) { setError(bookErr.message); setBooking(false); return }

    await supabase.from('booking_players').insert({
      booking_id: newBooking.id,
      player_id: profile.id,
      is_owner: true,
      payment_status: 'pending',
      base_price: pricePerPlayer,
      discount_percent: discount,
      effective_price: effectivePrice,
    })

    setBooking(false)
    router.push('/my-bookings?new=' + newBooking.id)
  }

  if (loading) return <div style={{ textAlign: 'center', padding: '48px', color: 'var(--muted)' }}>Chargement...</div>

  const formatDate = str => new Date(str).toLocaleDateString('fr-BE', { weekday: 'short', day: 'numeric', month: 'short' })
  const formatTime = d => d.toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit' })

  const availableModes = selectedCourt
    ? ((selectedCourt.payment_modes && selectedCourt.payment_modes.length > 0) ? selectedCourt.payment_modes : [selectedCourt.payment_mode || 'full'])
    : ['full']

  useEffect(() => {
    if (selectedCourt && !availableModes.includes(paymentMode)) {
      setPaymentMode(availableModes[0])
    }
  }, [selectedCourt])

  const pricePerPlayerDisplay = selectedCourt ? (selectedCourt.price_per_slot / 4) : 0
  const myPrice = selectedCourt ? calcEffectivePrice(pricePerPlayerDisplay, profile?.discount_percent || 0) : 0

  return (
    <div>
      <h1 style={{ fontFamily: "'Syne',sans-serif", fontSize: '22px', fontWeight: 700, marginBottom: '24px' }}>Réserver un terrain</h1>

      {/* Terrains */}
      <section style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--muted)', marginBottom: '10px', fontWeight: 500 }}>Terrain</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '8px' }}>
          {courts.map(c => (
            <button key={c.id} onClick={() => { setSelectedCourt(c); setSelectedSlot(null) }}
              style={{ background: selectedCourt?.id === c.id ? 'var(--brand-dim)' : 'var(--surface)', border: '1.5px solid ' + (selectedCourt?.id === c.id ? 'var(--brand)' : 'var(--border)'), borderRadius: '12px', padding: '14px', textAlign: 'left', cursor: 'pointer', transition: 'all .15s' }}>
              <div style={{ fontSize: '11px', color: 'var(--brand-light)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
                {c.is_indoor ? 'Indoor' : 'Outdoor'}
              </div>
              <div style={{ fontSize: '14px', fontWeight: 500 }}>{c.name}</div>
              <div style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '2px' }}>{(c.price_per_slot / 4).toFixed(2)} € / joueur</div>
            </button>
          ))}
        </div>
      </section>

      {/* Dates */}
      <section style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--muted)', marginBottom: '10px', fontWeight: 500 }}>Date</h2>
        <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px' }}>
          {dates.map(d => (
            <button key={d} onClick={() => { setSelectedDate(d); setSelectedSlot(null) }}
              style={{ flexShrink: 0, background: selectedDate === d ? 'var(--brand-dim)' : 'var(--surface)', border: '1.5px solid ' + (selectedDate === d ? 'var(--brand)' : 'var(--border)'), borderRadius: '10px', padding: '10px 14px', textAlign: 'center', cursor: 'pointer', minWidth: '64px' }}>
              <div style={{ fontSize: '11px', color: 'var(--muted)' }}>
                {new Date(d + 'T12:00:00').toLocaleDateString('fr-BE', { weekday: 'short' })}
              </div>
              <div style={{ fontSize: '20px', fontFamily: "'Syne',sans-serif", fontWeight: 700, color: selectedDate === d ? 'var(--brand-light)' : 'var(--text)' }}>
                {new Date(d + 'T12:00:00').getDate()}
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Créneaux horaires */}
      <section style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--muted)', marginBottom: '10px', fontWeight: 500 }}>
          Horaires disponibles — {formatDate(selectedDate)}
        </h2>
        {slots.length === 0 ? (
          <p style={{ color: 'var(--muted)', fontSize: '14px' }}>Aucun horaire disponible ce jour.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: '8px' }}>
            {slots.map((slot, i) => {
              const unavailable = !slot.available
              const isPastSlot = slot.past
              return (
                <button key={i}
                  disabled={unavailable}
                  onClick={() => slot.available && setSelectedSlot(slot)}
                  style={{
                    background: unavailable ? 'var(--surface2)' : selectedSlot === slot ? 'var(--brand-dim)' : 'var(--surface)',
                    border: '1px solid ' + (unavailable ? 'var(--border)' : selectedSlot === slot ? 'var(--brand)' : 'var(--border)'),
                    borderRadius: '8px', padding: '10px', textAlign: 'center',
                    cursor: unavailable ? 'not-allowed' : 'pointer',
                    opacity: unavailable ? 0.55 : 1, transition: 'all .15s',
                    position: 'relative',
                  }}>
                  <div style={{
                    fontSize: '14px', fontWeight: 500,
                    color: unavailable ? 'var(--muted)' : selectedSlot === slot ? 'var(--brand-light)' : 'var(--text)',
                    textDecoration: unavailable ? 'line-through' : 'none',
                    textDecorationColor: 'var(--red)',
                    textDecorationThickness: '1.5px',
                  }}>
                    {formatTime(slot.start)}
                  </div>
                  <div style={{ fontSize: '10px', color: unavailable ? 'var(--red)' : 'var(--muted)', marginTop: '3px', fontWeight: unavailable ? 500 : 400, letterSpacing: unavailable ? '0.3px' : 0 }}>
                    {unavailable ? (isPastSlot ? 'Passé' : 'Complet') : (slot.duration + ' min')}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </section>

      {/* Toggle match public — coloré et clair */}
      {selectedSlot && (
        <section style={{ marginBottom: '24px' }}>
          <button
            onClick={() => setIsPublic(!isPublic)}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
              background: isPublic ? 'var(--brand-dim)' : 'var(--surface)',
              border: '1.5px solid ' + (isPublic ? 'var(--brand)' : 'var(--border)'),
              borderRadius: '12px', padding: '16px', cursor: 'pointer', textAlign: 'left',
              transition: 'all .15s',
            }}>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 600, color: isPublic ? 'var(--brand-light)' : 'var(--text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                {isPublic ? '🌍 Match public' : '🔒 Match privé'}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
                {isPublic ? 'Visible par tous, les joueurs peuvent rejoindre et payer leur part' : 'Seuls les joueurs que vous invitez peuvent participer'}
              </div>
            </div>
            <div style={{
              width: '46px', height: '26px', borderRadius: '99px', flexShrink: 0, position: 'relative',
              background: isPublic ? 'var(--brand)' : 'var(--border)', transition: 'all .2s',
            }}>
              <div style={{
                position: 'absolute', top: '3px', left: isPublic ? '23px' : '3px',
                width: '20px', height: '20px', background: '#fff', borderRadius: '50%', transition: 'left .2s',
                boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
              }} />
            </div>
          </button>
        </section>
      )}

      {/* Récapitulatif */}
      {selectedSlot && selectedCourt && (
        <section>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '20px' }}>
            <h3 style={{ fontFamily: "'Syne',sans-serif", fontSize: '15px', fontWeight: 700, marginBottom: '14px' }}>Récapitulatif</h3>
            {[
              ['Terrain', selectedCourt.name],
              ['Date', formatDate(selectedDate)],
              ['Horaire', formatTime(selectedSlot.start) + ' → ' + formatTime(selectedSlot.end)],
              ['Durée', selectedSlot.duration + ' min'],
              ['Visibilité', isPublic ? 'Public' : 'Privé'],
            ].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ color: 'var(--muted)' }}>{k}</span>
                <span>{v}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ color: 'var(--muted)' }}>Prix total du terrain</span>
              <span>{selectedCourt.price_per_slot} €</span>
            </div>
            {profile?.discount_percent > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ color: 'var(--muted)' }}>Votre remise membre</span>
                <span style={{ color: 'var(--amber)' }}>- {profile.discount_percent} %</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '16px', fontWeight: 500, paddingTop: '12px', marginBottom: '14px' }}>
              <span>Votre part (par joueur)</span>
              <span style={{ fontFamily: "'Syne',sans-serif", fontSize: '20px', fontWeight: 700, color: 'var(--brand-light)' }}>
                {myPrice.toFixed(2)} €
              </span>
            </div>

            {/* Choix du mode de paiement */}
            {availableModes.length > 1 && (
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 500, color: 'var(--muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                  Mode de paiement
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {availableModes.map(mode => (
                    <button key={mode} onClick={() => setPaymentMode(mode)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '10px', textAlign: 'left',
                        background: paymentMode === mode ? 'var(--brand-dim)' : 'var(--surface2)',
                        border: '1.5px solid ' + (paymentMode === mode ? 'var(--brand)' : 'var(--border)'),
                        borderRadius: '8px', padding: '10px 12px', cursor: 'pointer', transition: 'all .15s',
                      }}>
                      <div style={{
                        width: '16px', height: '16px', borderRadius: '50%', flexShrink: 0,
                        border: '1.5px solid ' + (paymentMode === mode ? 'var(--brand)' : 'var(--muted)'),
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {paymentMode === mode && <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--brand)' }} />}
                      </div>
                      <span style={{ fontSize: '13px', fontWeight: 500, color: paymentMode === mode ? 'var(--brand-light)' : 'var(--text)' }}>
                        {PAYMENT_MODE_LABELS[mode]}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {error && <div style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', color: 'var(--red)', marginTop: '12px' }}>{error}</div>}
            <button onClick={handleBook} disabled={booking}
              style={{ width: '100%', background: 'var(--brand)', color: '#fff', border: 'none', borderRadius: '8px', padding: '13px', fontSize: '15px', fontWeight: 600, cursor: 'pointer', marginTop: '16px', fontFamily: "'Syne',sans-serif", opacity: booking ? 0.6 : 1 }}>
              {booking ? 'Réservation...' : profile ? 'Confirmer la réservation' : 'Se connecter pour réserver'}
            </button>
          </div>
        </section>
      )}
    </div>
  )
}

export default function BookingPage() {
  return (
    <Suspense fallback={<div style={{ textAlign: 'center', padding: '48px', color: 'var(--muted)' }}>Chargement...</div>}>
      <BookingForm />
    </Suspense>
  )
}
