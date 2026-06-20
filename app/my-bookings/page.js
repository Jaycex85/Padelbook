'use client'
import { useState, useEffect } from 'react'
import { createClient } from '../../lib/supabase'
import { canCancelBooking, calcRefundAmount, calcEffectivePrice, calcOpenBalance } from '../../lib/bookingUtils'
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
  const [confirmTarget, setConfirmTarget] = useState(null)
  const [inviteTarget, setInviteTarget] = useState(null) // booking en cours d'invitation
  const [search, setSearch] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [inviting, setInviting] = useState(false)
  const [settling, setSettling] = useState(null)
  const [inviteTab, setInviteTab] = useState('member') // 'member' | 'guest'
  const [guestName, setGuestName] = useState('')
  const [guestEmail, setGuestEmail] = useState('')
  const [guestPayMethod, setGuestPayMethod] = useState('wallet') // 'wallet' | 'payconic'
  const supabase = createClient()

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    setUserId(user.id)

    const { data: asOwner } = await supabase
      .from('bookings')
      .select('*, court:courts(name, is_indoor), players:booking_players(id, player_id, is_owner, payment_status, effective_price, profile:profiles(first_name, last_name, email))')
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
        .select('*, court:courts(name, is_indoor), players:booking_players(id, player_id, is_owner, payment_status, effective_price, profile:profiles(first_name, last_name, email))')
        .in('id', otherBookingIds)
      asPlayer = data || []
    }

    const merged = [...(asOwner || []), ...asPlayer]
    merged.sort((a, b) => new Date(b.starts_at) - new Date(a.starts_at))
    setBookings(merged)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function refundPlayers(bookingId, players) {
    for (const p of players) {
      if (p.payment_status !== 'paid') continue
      const amount = parseFloat(p.effective_price) || 0
      if (amount <= 0) continue
      const { data: profile } = await supabase.from('profiles').select('wallet_balance').eq('id', p.player_id).single()
      const newBalance = (profile?.wallet_balance || 0) + amount
      await supabase.from('profiles').update({ wallet_balance: newBalance }).eq('id', p.player_id)
      await supabase.from('wallet_transactions').insert({
        profile_id: p.player_id, amount, type: 'refund',
        description: 'Remboursement annulation réservation', booking_id: bookingId,
      })
      await supabase.from('booking_players').update({ payment_status: 'refunded' }).eq('id', p.id)
    }
  }

  async function handleCancelFull(booking) {
    setCancelling(booking.id)
    await refundPlayers(booking.id, booking.players || [])
    await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', booking.id)
    setCancelling(null)
    setConfirmTarget(null)
    load()
  }

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

  // ─── Invitation de membres existants ───
  async function openInvite(booking) {
    setInviteTarget(booking)
    setSearch('')
    setSearchResults([])
    setInviteTab('member')
    setGuestName('')
    setGuestEmail('')
    setGuestPayMethod('wallet')
  }

  async function runSearch(q) {
    setSearch(q)
    if (q.trim().length < 2) { setSearchResults([]); return }
    setSearching(true)
    const { data } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, email')
      .or('email.ilike.%' + q + '%,first_name.ilike.%' + q + '%,last_name.ilike.%' + q + '%')
      .limit(8)
    // Exclure ceux déjà dans le match
    const alreadyIn = (inviteTarget?.players || []).map(p => p.player_id)
    setSearchResults((data || []).filter(p => !alreadyIn.includes(p.id)))
    setSearching(false)
  }

  async function inviteMember(member) {
    if (!inviteTarget) return
    const spotsLeft = (inviteTarget.max_players || 4) - (inviteTarget.players || []).length
    if (spotsLeft <= 0) { alert('Ce match est déjà complet.'); return }

    setInviting(true)
    const profileRow = await supabase.from('profiles').select('discount_percent').eq('id', member.id).single()
    const discount = profileRow.data?.discount_percent || 0
    const basePrice = inviteTarget.price_per_player
    const effectivePrice = calcEffectivePrice(basePrice, discount)

    await supabase.from('booking_players').insert({
      booking_id: inviteTarget.id,
      player_id: member.id,
      is_owner: false,
      payment_status: 'pending',
      base_price: basePrice,
      discount_percent: discount,
      effective_price: effectivePrice,
    })

    setInviting(false)
    setInviteTarget(null)
    load()
  }

  // ─── Ajout d'un invité sans compte — le owner paie immédiatement sa part ───
  async function inviteGuest() {
    if (!inviteTarget || !guestName.trim()) return
    const spotsLeft = (inviteTarget.max_players || 4) - (inviteTarget.players || []).length
    if (spotsLeft <= 0) { alert('Ce match est déjà complet.'); return }

    const basePrice = inviteTarget.price_per_player

    if (guestPayMethod === 'wallet') {
      const { data: ownerProfile } = await supabase.from('profiles').select('wallet_balance').eq('id', userId).single()
      const available = ownerProfile?.wallet_balance || 0
      if (available < basePrice) {
        alert('Solde wallet insuffisant pour couvrir cet invité (' + basePrice.toFixed(2) + ' € requis). Rechargez votre wallet ou choisissez le paiement par carte.')
        return
      }

      setInviting(true)
      const { data: newPlayer } = await supabase.from('booking_players').insert({
        booking_id: inviteTarget.id,
        guest_name: guestName.trim(),
        guest_email: guestEmail.trim() || null,
        is_owner: false,
        payment_status: 'paid',
        paid_at: new Date().toISOString(),
        base_price: basePrice,
        discount_percent: 0,
        effective_price: basePrice,
      }).select().single()

      await supabase.from('profiles').update({ wallet_balance: available - basePrice }).eq('id', userId)
      await supabase.from('wallet_transactions').insert({
        profile_id: userId, amount: -basePrice, type: 'debit',
        description: 'Invité ' + guestName.trim() + ' - ' + (inviteTarget.court?.name || ''),
        booking_id: inviteTarget.id,
      })

      setInviting(false)
      setInviteTarget(null)
      load()
    } else {
      // Paiement carte (PayConic) — passe par le flow de paiement stub existant.
      // On crée d'abord la place invité en pending, puis on redirige vers le paiement.
      setInviting(true)
      const { data: newPlayer } = await supabase.from('booking_players').insert({
        booking_id: inviteTarget.id,
        guest_name: guestName.trim(),
        guest_email: guestEmail.trim() || null,
        is_owner: false,
        payment_status: 'pending',
        base_price: basePrice,
        discount_percent: 0,
        effective_price: basePrice,
      }).select().single()

      const res = await fetch('/api/payments/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ booking_id: inviteTarget.id, booking_player_id: newPlayer.id }),
      })
      const payData = await res.json()
      setInviting(false)
      if (payData.payment_url) {
        window.location.href = payData.payment_url
      }
    }
  }

  // ─── Règlement manuel du solde dû (depuis le wallet du owner) ───
  async function settleBalance(booking) {
    const openBalance = calcOpenBalance(booking, booking.players || [])
    if (openBalance <= 0) return

    setSettling(booking.id)
    const { data: ownerProfile } = await supabase.from('profiles').select('wallet_balance').eq('id', userId).single()
    const available = ownerProfile?.wallet_balance || 0

    if (available < openBalance) {
      alert('Solde wallet insuffisant. Disponible : ' + available.toFixed(2) + ' € — Requis : ' + openBalance.toFixed(2) + ' €. Rechargez votre wallet.')
      setSettling(null)
      return
    }

    await supabase.from('profiles').update({ wallet_balance: available - openBalance }).eq('id', userId)
    await supabase.from('wallet_transactions').insert({
      profile_id: userId, amount: -openBalance, type: 'debit',
      description: 'Règlement solde réservation ' + (booking.court?.name || ''), booking_id: booking.id,
    })

    // Marquer tous les joueurs assignés impayés comme payés (le owner a couvert pour eux)
    const unpaidAssigned = (booking.players || []).filter(p => p.payment_status !== 'paid')
    for (const p of unpaidAssigned) {
      await supabase.from('booking_players').update({ payment_status: 'paid', paid_at: new Date().toISOString() }).eq('id', p.id)
    }

    // Si la résa était pending, elle est maintenant entièrement couverte -> confirmer
    if (booking.status === 'pending') {
      await supabase.from('bookings').update({ status: 'confirmed' }).eq('id', booking.id)
    }

    setSettling(null)
    load()
  }

  const fmt = d => new Date(d).toLocaleDateString('fr-BE', { weekday: 'short', day: 'numeric', month: 'short' })
  const fmtTime = d => new Date(d).toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit' })
  const memberName = p => p.profile ? (p.profile.first_name || p.profile.email || 'Joueur') : (p.guest_name ? p.guest_name + ' (invité)' : 'Joueur')

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
            const spotsLeft = (b.max_players || 4) - (b.players || []).length
            const openBalance = calcOpenBalance(b, b.players || [])

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

                    {/* Joueurs présents (avatars/noms) */}
                    {b.payment_mode !== 'full' && (b.players || []).length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '10px' }}>
                        {(b.players || []).map(p => (
                          <span key={p.id} style={{ fontSize: '11px', padding: '3px 9px', borderRadius: '99px', background: p.payment_status === 'paid' ? 'var(--brand-dim)' : 'var(--surface2)', color: p.payment_status === 'paid' ? 'var(--brand-light)' : 'var(--muted)' }}>
                            {memberName(p)} {p.payment_status === 'paid' ? '✓' : '⏳'}
                          </span>
                        ))}
                        {Array.from({ length: spotsLeft }).map((_, i) => (
                          <span key={'empty-' + i} style={{ fontSize: '11px', padding: '3px 9px', borderRadius: '99px', border: '1px dashed var(--border)', color: 'var(--muted)' }}>
                            Place libre
                          </span>
                        ))}
                      </div>
                    )}

                    {openBalance > 0 && isOwner && (
                      <div style={{ marginTop: '10px', background: 'rgba(252,211,77,0.06)', border: '1px solid rgba(252,211,77,0.2)', borderRadius: '8px', padding: '8px 12px', fontSize: '12px', color: 'var(--amber)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
                          <span>Solde non couvert : <strong>{openBalance.toFixed(2)} €</strong></span>
                          <button onClick={() => settleBalance(b)} disabled={settling === b.id}
                            style={{ background: 'var(--amber)', color: '#1a1400', border: 'none', borderRadius: '6px', padding: '4px 10px', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>
                            {settling === b.id ? '...' : 'Régler maintenant'}
                          </button>
                        </div>
                        <p style={{ fontSize: '10px', marginTop: '4px', opacity: 0.85 }}>
                          Si non réglé avant la fin du match, ce montant sera automatiquement débité de votre wallet.
                        </p>
                      </div>
                    )}

                    {deadlinePassed && canCancel && (
                      <p style={{ fontSize: '11px', color: 'var(--amber)', marginTop: '6px' }}>Délai d'annulation dépassé — contactez l'admin</p>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-end' }}>
                    {isOwner && b.payment_mode !== 'full' && spotsLeft > 0 && ['pending', 'confirmed'].includes(b.status) && (
                      <button onClick={() => openInvite(b)}
                        style={{ background: 'var(--brand-dim)', border: '1px solid var(--brand)', color: 'var(--brand-light)', borderRadius: '8px', padding: '6px 12px', fontSize: '12px', cursor: 'pointer' }}>
                        + Inviter
                      </button>
                    )}
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

      {/* Modal invitation : membre existant OU invité sans compte */}
      {inviteTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '16px' }}
          onClick={e => e.target === e.currentTarget && setInviteTarget(null)}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '24px', width: '100%', maxWidth: 'min(420px, calc(100vw - 32px))', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h2 style={{ fontFamily: "'Syne',sans-serif", fontSize: '18px', fontWeight: 700 }}>Inviter un joueur</h2>
              <button onClick={() => setInviteTarget(null)} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: '18px', cursor: 'pointer' }}>✕</button>
            </div>

            {/* Onglets */}
            <div style={{ display: 'flex', gap: '6px', marginBottom: '16px' }}>
              <button onClick={() => setInviteTab('member')}
                style={{ flex: 1, background: inviteTab === 'member' ? 'var(--brand-dim)' : 'var(--surface2)', border: '1px solid ' + (inviteTab === 'member' ? 'var(--brand)' : 'var(--border)'), color: inviteTab === 'member' ? 'var(--brand-light)' : 'var(--muted)', borderRadius: '8px', padding: '8px', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}>
                👤 Membre du club
              </button>
              <button onClick={() => setInviteTab('guest')}
                style={{ flex: 1, background: inviteTab === 'guest' ? 'var(--brand-dim)' : 'var(--surface2)', border: '1px solid ' + (inviteTab === 'guest' ? 'var(--brand)' : 'var(--border)'), color: inviteTab === 'guest' ? 'var(--brand-light)' : 'var(--muted)', borderRadius: '8px', padding: '8px', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}>
                🎾 Invité (sans compte)
              </button>
            </div>

            {inviteTab === 'member' ? (
              <>
                <input
                  type="text"
                  placeholder="Rechercher par nom ou email..."
                  value={search}
                  onChange={e => runSearch(e.target.value)}
                  style={{ width: '100%', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 14px', color: 'var(--text)', fontSize: '14px', marginBottom: '14px' }}
                  autoFocus
                />
                <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {searching && <p style={{ fontSize: '13px', color: 'var(--muted)', textAlign: 'center' }}>Recherche...</p>}
                  {!searching && search.length >= 2 && searchResults.length === 0 && (
                    <p style={{ fontSize: '13px', color: 'var(--muted)', textAlign: 'center', padding: '12px 0' }}>Aucun membre trouvé.</p>
                  )}
                  {searchResults.map(m => (
                    <button key={m.id} onClick={() => inviteMember(m)} disabled={inviting}
                      style={{ display: 'flex', alignItems: 'center', gap: '10px', textAlign: 'left', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '10px', padding: '10px 12px', cursor: 'pointer' }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--brand-dim)', border: '1px solid var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 600, color: 'var(--brand-light)', flexShrink: 0 }}>
                        {(m.first_name || m.email || '?')[0].toUpperCase()}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: '13px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {m.first_name ? (m.first_name + ' ' + (m.last_name || '')) : m.email}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.email}</div>
                      </div>
                    </button>
                  ))}
                </div>
                <p style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '14px', textAlign: 'center' }}>
                  Le membre paiera sa part lui-même. Sinon, elle sera couverte par votre wallet en fin de match.
                </p>
              </>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 500, color: 'var(--muted)', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Nom de l'invité</label>
                  <input type="text" value={guestName} onChange={e => setGuestName(e.target.value)} placeholder="Ex: Marc Dupont"
                    style={{ width: '100%', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 14px', color: 'var(--text)', fontSize: '14px' }} autoFocus />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 500, color: 'var(--muted)', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Email (optionnel)</label>
                  <input type="email" value={guestEmail} onChange={e => setGuestEmail(e.target.value)} placeholder="marc@exemple.com"
                    style={{ width: '100%', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 14px', color: 'var(--text)', fontSize: '14px' }} />
                </div>

                <div style={{ background: 'rgba(252,211,77,0.06)', border: '1px solid rgba(252,211,77,0.2)', borderRadius: '8px', padding: '10px 12px', fontSize: '12px', color: 'var(--amber)' }}>
                  Cet invité n'a pas de compte — c'est <strong>vous</strong> qui réglez sa part ({inviteTarget.price_per_player?.toFixed(2)} €) maintenant.
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 500, color: 'var(--muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Mode de paiement</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => setGuestPayMethod('wallet')}
                      style={{ flex: 1, background: guestPayMethod === 'wallet' ? 'var(--brand-dim)' : 'var(--surface2)', border: '1.5px solid ' + (guestPayMethod === 'wallet' ? 'var(--brand)' : 'var(--border)'), color: guestPayMethod === 'wallet' ? 'var(--brand-light)' : 'var(--muted)', borderRadius: '8px', padding: '10px', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}>
                      💳 Wallet
                    </button>
                    <button onClick={() => setGuestPayMethod('payconic')}
                      style={{ flex: 1, background: guestPayMethod === 'payconic' ? 'var(--brand-dim)' : 'var(--surface2)', border: '1.5px solid ' + (guestPayMethod === 'payconic' ? 'var(--brand)' : 'var(--border)'), color: guestPayMethod === 'payconic' ? 'var(--brand-light)' : 'var(--muted)', borderRadius: '8px', padding: '10px', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}>
                      💳 Carte (PayConic)
                    </button>
                  </div>
                </div>

                <button onClick={inviteGuest} disabled={inviting || !guestName.trim()}
                  style={{ background: 'var(--brand)', color: '#fff', border: 'none', borderRadius: '8px', padding: '12px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', fontFamily: "'Syne',sans-serif", opacity: (inviting || !guestName.trim()) ? 0.5 : 1, marginTop: '4px' }}>
                  {inviting ? 'Traitement...' : 'Ajouter et payer ' + (inviteTarget.price_per_player?.toFixed(2) || '') + ' €'}
                </button>
              </div>
            )}
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
