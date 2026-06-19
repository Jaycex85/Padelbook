'use client'
import { useState, useEffect } from 'react'
import { createClient } from '../../lib/supabase'
import { generateSlots, evaluateAccessRules, calcEffectivePrice } from '../../lib/bookingUtils'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

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
  const [loading, setLoading] = useState(true)
  const [booking, setBooking] = useState(false)
  const [error, setError] = useState(null)

  // Dates : aujourd'hui + 13 jours
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

    const discount = profile?.discount_percent || 0
    const basePrice = selectedCourt.price_per_slot / 4
    const effectivePrice = calcEffectivePrice(basePrice, discount)
    const totalPrice = selectedCourt.price_per_slot

    const { data: newBooking, error: bookErr } = await supabase.from('bookings').insert({
      court_id: selectedCourt.id,
      owner_id: profile.id,
      status: 'pending',
      starts_at: selectedSlot.start.toISOString(),
      ends_at: selectedSlot.end.toISOString(),
      payment_mode: selectedCourt.payment_mode,
      total_price: totalPrice,
      price_per_player: basePrice,
      is_public: isPublic,
      max_players: 4,
      cancellation_deadline: new Date(selectedSlot.start.getTime() - 24 * 3600 * 1000).toISOString(),
    }).select().single()

    if (bookErr) { setError(bookErr.message); setBooking(false); return }

    // Ajouter le owner comme premier joueur
    await supabase.from('booking_players').insert({
      booking_id: newBooking.id,
      player_id: profile.id,
      is_owner: true,
      payment_status: 'pending',
      base_price: basePrice,
      discount_percent: discount,
      effective_price: effectivePrice,
    })

    setBooking(false)
    router.push('/my-bookings?new=' + newBooking.id)
  }

  if (loading) return <div style={{ textAlign: 'center', padding: '48px', color: 'var(--muted)' }}>Chargement...</div>

  const formatDate = str => new Date(str).toLocaleDateString('fr-BE', { weekday: 'short', day: 'numeric', month: 'short' })
  const formatTime = d => d.toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit' })

  return (
    <div>
      <h1 style={{ fontFamily: "'Syne',sans-serif", fontSize: '22px', fontWeight: 700, marginBottom: '24px' }}>Réserver un terrain</h1>

      {/* Terrains */}
      <section style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--muted)', marginBottom: '10px', fontWeight: 500 }}>Terrain</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '8px' }}>
          {courts.map(c => (
            <button key={c.id} onClick={() => { setSelectedCourt(c); setSelectedSlot(null) }}
              style={{ background: selectedCourt?.id === c.id ? 'rgba(74,222,128,0.08)' : 'var(--surface)', border: '1.5px solid ' + (selectedCourt?.id === c.id ? 'var(--brand)' : 'var(--border)'), borderRadius: '12px', padding: '14px', textAlign: 'left', cursor: 'pointer', transition: 'all .15s' }}>
              <div style={{ fontSize: '11px', color: 'var(--brand)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
                {c.is_indoor ? 'Indoor' : 'Outdoor'}
              </div>
              <div style={{ fontSize: '14px', fontWeight: 500 }}>{c.name}</div>
              <div style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '2px' }}>{c.price_per_slot} € / slot</div>
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
              style={{ flexShrink: 0, background: selectedDate === d ? 'rgba(74,222,128,0.08)' : 'var(--surface)', border: '1.5px solid ' + (selectedDate === d ? 'var(--brand)' : 'var(--border)'), borderRadius: '10px', padding: '10px 14px', textAlign: 'center', cursor: 'pointer', minWidth: '64px' }}>
              <div style={{ fontSize: '11px', color: 'var(--muted)' }}>
                {new Date(d + 'T12:00:00').toLocaleDateString('fr-BE', { weekday: 'short' })}
              </div>
              <div style={{ fontSize: '20px', fontFamily: "'Syne',sans-serif", fontWeight: 700, color: selectedDate === d ? 'var(--brand)' : 'var(--text)' }}>
                {new Date(d + 'T12:00:00').getDate()}
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Créneaux */}
      <section style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--muted)', marginBottom: '10px', fontWeight: 500 }}>
          Créneaux — {formatDate(selectedDate)}
        </h2>
        {slots.length === 0 ? (
          <p style={{ color: 'var(--muted)', fontSize: '14px' }}>Aucun créneau disponible ce jour.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: '8px' }}>
            {slots.map((slot, i) => (
              <button key={i}
                disabled={!slot.available}
                onClick={() => slot.available && setSelectedSlot(slot)}
                style={{
                  background: !slot.available ? 'transparent' : selectedSlot === slot ? 'rgba(74,222,128,0.12)' : 'var(--surface)',
                  border: '1px solid ' + (!slot.available ? 'var(--border)' : selectedSlot === slot ? 'var(--brand)' : 'var(--border)'),
                  borderRadius: '8px', padding: '10px', textAlign: 'center', cursor: slot.available ? 'pointer' : 'not-allowed',
                  opacity: slot.available ? 1 : 0.35, transition: 'all .15s',
                }}>
                <div style={{ fontSize: '14px', fontWeight: 500, color: selectedSlot === slot ? 'var(--brand)' : 'var(--text)' }}>
                  {formatTime(slot.start)}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>
                  {slot.available ? (slot.duration + ' min') : 'Occupé'}
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Options match */}
      {selectedSlot && (
        <section style={{ marginBottom: '24px' }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 500 }}>Match public</div>
              <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
                Les autres joueurs peuvent rejoindre et payer leur part
              </div>
            </div>
            <button onClick={() => setIsPublic(!isPublic)}
              style={{ width: '44px', height: '24px', background: isPublic ? 'var(--brand)' : 'var(--border)', borderRadius: '99px', border: 'none', cursor: 'pointer', position: 'relative', transition: 'all .2s', flexShrink: 0 }}>
              <div style={{ position: 'absolute', top: '3px', left: isPublic ? '23px' : '3px', width: '18px', height: '18px', background: '#fff', borderRadius: '50%', transition: 'left .2s' }} />
            </button>
          </div>
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
              ['Créneau', formatTime(selectedSlot.start) + ' → ' + formatTime(selectedSlot.end)],
              ['Durée', selectedSlot.duration + ' min'],
              ['Mode paiement', selectedCourt.payment_mode],
            ].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ color: 'var(--muted)' }}>{k}</span>
                <span>{v}</span>
              </div>
            ))}
            {profile?.discount_percent > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ color: 'var(--muted)' }}>Remise membre</span>
                <span style={{ color: 'var(--amber)' }}>- {profile.discount_percent} %</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '16px', fontWeight: 500, paddingTop: '12px' }}>
              <span>Votre part</span>
              <span style={{ fontFamily: "'Syne',sans-serif", fontSize: '20px', fontWeight: 700, color: 'var(--brand)' }}>
                {calcEffectivePrice(selectedCourt.price_per_slot / 4, profile?.discount_percent || 0)} €
              </span>
            </div>
            {error && <div style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', color: 'var(--red)', marginTop: '12px' }}>{error}</div>}
            <button onClick={handleBook} disabled={booking}
              style={{ width: '100%', background: 'var(--brand)', color: '#0D1117', border: 'none', borderRadius: '8px', padding: '13px', fontSize: '15px', fontWeight: 600, cursor: 'pointer', marginTop: '16px', fontFamily: "'Syne',sans-serif", opacity: booking ? 0.6 : 1 }}>
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
