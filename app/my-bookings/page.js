'use client'
import { useState, useEffect } from 'react'
import { createClient } from '../../lib/supabase'
import { canCancelBooking, calcRefundAmount } from '../../lib/bookingUtils'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

const STATUS_STYLES = {
  confirmed: { bg: 'var(--brand-dim)', color: 'var(--brand-light)', label: 'Confirmé' },
  pending: { bg: 'rgba(252,211,77,0.1)', color: 'var(--amber)', label: 'En attente de paiement' },
  cancelled: { bg: 'rgba(248,113,113,0.1)', color: 'var(--red)', label: 'Annulé' },
  completed: { bg: 'rgba(139,148,158,0.1)', color: 'var(--muted)', label: 'Terminé' },
  expired: { bg: 'rgba(139,148,158,0.1)', color: 'var(--muted)', label: 'Expiré' },
}

function MyBookingsList() {
  const searchParams = useSearchParams()
  const newId = searchParams.get('new')
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState(null)
  const [cancelling, setCancelling] = useState(null)
  const [confirmTarget, setConfirmTarget] = useState(null) // { booking, mode: 'full' | 'leave' }
  const supabase = createClient()

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    setUserId(user.id)

    // Réservations où je suis owner OU simple joueur (match public rejoint)
    const { data: asOwner } = await supabase
      .from('bookings')
      .select('*, court:courts(name, is_indoor), players:booking_players(id, player_id, is_owner, payment_status, effective_price)')
      .eq('owner_id', user.id)

    const { data: myPlayerRows } = await supabase
      .from('booking_players')
      .select('booking_id')
      .eq('player_id', user.id)
      .eq('is_owner', false)

    const otherBookingIds = (myPlayerRows || []).map(r => r.booking_id)
    let asPlayer = []
    if (otherBookingIds.length > 0) {
      const { data } = await supabase
        .from('bookings')
        .select('*, court:courts(name, is_indoor), players:booking_players(id, player_id, is_owner, payment_status, effective_price)')
        .in('id', otherBookingIds)
      asPlayer = data || []
    }

    const merged = [...(asOwner || []), ...asPlayer]
    merged.sort((a, b) => new Date(b.starts_at) - new Date(a.starts_at))
    setBookings(merged)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  // Remboursement wallet : crédite le solde de chaque joueur concerné
  // pour ce qu'il a réellement payé (effective_price), peu importe le mode initial.
  async function refundPlayers(bookingId, players) {
    for (const p of players) {
      if (p.payment_status !== 'paid') continue
      const amount = parseFloat(p.effective_price) || 0
      if (amount <= 0) continue

      const { data: profile } = await supabase.from('profiles').select('wallet_balance').eq('id', p.player_id).single()
      const newBalance = (profile?.wallet_balance || 0) + amount

      await supabase.from('profiles').update({ wallet_balance: newBalance }).eq('id', p.player_id)
      await supabase.from('wallet_transactions').insert({
        profile_id: p.player_id,
        amount: amount,
        type: 'refund',
        description: 'Remboursement annulation réservation',
        booking_id: bookingId,
      })
      await supabase.from('booking_players').update({ payment_status: 'refunded' }).eq('id', p.id)
    }
  }

  // Owner annule TOUTE la réservation — rembourse tous les joueurs ayant payé
  async function handleCancelFull(booking) {
    setCancelling(booking.id)
    await refundPlayers(booking.id, booking.players || [])
    await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', booking.id)
    setCancelling(null)
    setConfirmTarget(null)
    load()
  }

  // Un joueur (non-owner) se retire d'un match — rembourse uniquement sa part,
  // libère sa place, la réservation continue pour les autres.
  async function handleLeave(booking) {
    setCancelling(booking.id)
    const myRow = (booking.players || []).find(p => p.player_id === userId)
    if (myRow) {
      await refundPlayers(booking.id, [myRow])
      await supabase.from('booking_players').delete().eq('id', myRow.id)
    }
    setCancelling(null)
    setConfirmTarget(null)
    load()
  }

  function openConfirm(booking, mode) {
    if (!canCancelBooking(booking)) {
      alert("Le délai d'annulation gratuite est dépassé. Contactez l'administrateur du club.")
      return
    }
    setConfirmTarget({ booking, mode })
  }

  async function togglePublic(booking) {
    await supabase.from('bookings').update({ is_public: !booking.is_public }).eq('id', booking.id)
    load()
  }

  const fmt = d => new Date(d).toLocaleDateString('fr-BE', { weekday: 'short', day: 'numeric', month: 'short' })
  const fmtTime = d => new Date(d).toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit' })

  if (loading) return <div style={{ textAlign: 'center', padding: '48px', color: 'var(--muted)' }}>Chargement...</div>

  return (
    <div>
      <h1 style={{ fontFamily: "'Syne',sans-serif", fontSize: '22px', fontWeight: 700, marginBottom: '24px' }}>Mes réservations</h1>

      {newId && (
        <div style={{ background: 'var(--brand-dim)', border: '1px solid var(--brand)', borderRadius: '12px', padding: '14px 18px', marginBottom: '20px', fontSize: '14px', color: 'var(--brand-light)' }}>
          ✓ Réservation créée avec succès. En attente de paiement.
        </div>
      )}

      {bookings.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '64px', color: 'var(--muted)' }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>🎾</div>
          <p style={{ marginBottom: '16px' }}>Aucune réservation.</p>
          <a href="/booking" style={{ background: 'var(--brand)', color: '#fff', padding: '10px 20px', borderRadius: '8px', textDecoration: 'none', fontSize: '14px', fontWeight: 600 }}>
            Réserver un terrain
          </a>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {bookings.map(b => {
            const s = STATUS_STYLES[b.status] || STATUS_STYLES.pending
            const paidCount = (b.players || []).filter(p => p.payment_status === 'paid').length
            const isOwner = b.owner_id === userId
            const canCancel = ['pending', 'confirmed'].includes(b.status)
            const deadlinePassed = !canCancelBooking(b)

            return (
              <div key={b.id} style={{ background: 'var(--surface)', border: '1px solid ' + (b.id === newId ? 'var(--brand)' : 'var(--border)'), borderRadius: '16px', padding: '18px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontFamily: "'Syne',sans-serif", fontSize: '16px', fontWeight: 700 }}>{b.court?.name}</span>
                      <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '99px', background: b.court?.is_indoor ? 'rgba(96,165,250,0.1)' : 'var(--brand-dim)', color: b.court?.is_indoor ? '#93C5FD' : 'var(--brand-light)' }}>
                        {b.court?.is_indoor ? 'Indoor' : 'Outdoor'}
                      </span>
                      {b.is_public && <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '99px', background: 'rgba(252,211,77,0.1)', color: 'var(--amber)' }}>Public</span>}
                      {!isOwner && <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '99px', background: 'var(--surface2)', color: 'var(--muted)' }}>Invité</span>}
                    </div>
                    <div style={{ fontSize: '14px', color: 'var(--muted)', marginBottom: '6px' }}>
                      {fmt(b.starts_at)} · {fmtTime(b.starts_at)} → {fmtTime(b.ends_at)}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                      <span style={{ background: s.bg, color: s.color, fontSize: '11px', padding: '3px 10px', borderRadius: '99px', fontWeight: 500 }}>{s.label}</span>
                      <span style={{ fontSize: '12px', color: 'var(--muted)' }}>{paidCount}/{b.players?.length || 1} joueur{paidCount !== 1 ? 's' : ''} payé{paidCount !== 1 ? 's' : ''}</span>
                      <span style={{ fontSize: '13px', color: 'var(--brand-light)', fontFamily: "'Syne',sans-serif", fontWeight: 600 }}>{b.total_price} €</span>
                    </div>
                    {deadlinePassed && canCancel && (
                      <p style={{ fontSize: '11px', color: 'var(--amber)', marginTop: '6px' }}>Délai d'annulation dépassé — contactez l'admin</p>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-end' }}>
                    {canCancel && isOwner && (
                      <button onClick={() => openConfirm(b, 'full')} disabled={cancelling === b.id || deadlinePassed}
                        style={{ background: 'none', border: '1px solid var(--border)', color: deadlinePassed ? 'var(--muted)' : 'var(--red)', borderRadius: '8px', padding: '6px 12px', fontSize: '12px', cursor: deadlinePassed ? 'not-allowed' : 'pointer', opacity: deadlinePassed ? 0.5 : 1 }}>
                        {cancelling === b.id ? '...' : 'Annuler le match'}
                      </button>
                    )}
                    {canCancel && !isOwner && (
                      <button onClick={() => openConfirm(b, 'leave')} disabled={cancelling === b.id || deadlinePassed}
                        style={{ background: 'none', border: '1px solid var(--border)', color: deadlinePassed ? 'var(--muted)' : 'var(--red)', borderRadius: '8px', padding: '6px 12px', fontSize: '12px', cursor: deadlinePassed ? 'not-allowed' : 'pointer', opacity: deadlinePassed ? 0.5 : 1 }}>
                        {cancelling === b.id ? '...' : 'Se désinscrire'}
                      </button>
                    )}
                    {isOwner && ['pending', 'confirmed'].includes(b.status) && (
                      <button onClick={() => togglePublic(b)}
                        style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--muted)', borderRadius: '8px', padding: '6px 12px', fontSize: '12px', cursor: 'pointer' }}>
                        {b.is_public ? 'Rendre privé' : 'Rendre public'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal confirmation annulation/désinscription */}
      {confirmTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '16px' }}
          onClick={e => e.target === e.currentTarget && setConfirmTarget(null)}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '24px', width: '100%', maxWidth: 'min(420px, calc(100vw - 32px))' }}>
            <h2 style={{ fontFamily: "'Syne',sans-serif", fontSize: '18px', fontWeight: 700, marginBottom: '12px' }}>
              {confirmTarget.mode === 'full' ? 'Annuler ce match ?' : 'Vous désinscrire ?'}
            </h2>
            <p style={{ fontSize: '14px', color: 'var(--muted)', marginBottom: '16px' }}>
              {confirmTarget.mode === 'full'
                ? 'Tous les joueurs ayant payé seront remboursés sur leur wallet. Cette action est irréversible.'
                : 'Si vous avez payé votre part, elle sera remboursée sur votre wallet.'}
            </p>
            {(() => {
              const relevantPlayers = confirmTarget.mode === 'full'
                ? (confirmTarget.booking.players || [])
                : (confirmTarget.booking.players || []).filter(p => p.player_id === userId)
              const refund = calcRefundAmount(relevantPlayers)
              return refund > 0 ? (
                <div style={{ background: 'var(--brand-dim)', border: '1px solid var(--brand)', borderRadius: '10px', padding: '12px 14px', marginBottom: '20px', fontSize: '14px', color: 'var(--brand-light)' }}>
                  💳 Remboursement total : <strong>{refund.toFixed(2)} €</strong>
                </div>
              ) : null
            })()}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => setConfirmTarget(null)} style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--muted)', borderRadius: '8px', padding: '10px 20px', fontSize: '14px', cursor: 'pointer' }}>
                Retour
              </button>
              <button
                onClick={() => confirmTarget.mode === 'full' ? handleCancelFull(confirmTarget.booking) : handleLeave(confirmTarget.booking)}
                disabled={cancelling === confirmTarget.booking.id}
                style={{ background: 'var(--red)', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 20px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', fontFamily: "'Syne',sans-serif", opacity: cancelling === confirmTarget.booking.id ? 0.6 : 1 }}>
                {cancelling === confirmTarget.booking.id ? 'Traitement...' : (confirmTarget.mode === 'full' ? 'Confirmer l\'annulation' : 'Confirmer le retrait')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function MyBookingsPage() {
  return (
    <Suspense fallback={<div style={{ textAlign: 'center', padding: '48px', color: 'var(--muted)' }}>Chargement...</div>}>
      <MyBookingsList />
    </Suspense>
  )
}
