'use client'
import { useState, useEffect } from 'react'
import { createClient } from '../../lib/supabase'
import { canCancelBooking, calcRefundAmount, calcEffectivePrice, calcOpenBalance } from '../../lib/bookingUtils'
import { useSearchParams, useRouter } from 'next/navigation'
import { Suspense } from 'react'
import Chat from '../../components/Chat'
import MatchScore from '../../components/MatchScore'
import { useSport } from '../../lib/sportContext'
import PaymentMethodModal from '../../components/PaymentMethodModal'
import { goToPaymentUrl } from '../../lib/paymentNav'
import { logBillableEvent } from '../../lib/billing'

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
  const [payingShare, setPayingShare] = useState(null)
  const [pendingPayment, setPendingPayment] = useState(null) // { bookingId, playerId, amount }
  const [pendingSettle, setPendingSettle] = useState(null) // booking complet, pour "Régler maintenant"
  const [inviteTab, setInviteTab] = useState('member') // 'member' | 'guest'
  const [guestName, setGuestName] = useState('')
  const [guestEmail, setGuestEmail] = useState('')
  const [openChatId, setOpenChatId] = useState(null)
  const supabase = createClient()
  const { activeSport } = useSport()
  const router = useRouter()

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    setUserId(user.id)

    const { data: asOwner } = await supabase
      .from('bookings')
      .select('*, court:courts(name, is_indoor, sport), players:booking_players(id, player_id, guest_name, guest_email, is_owner, payment_status, effective_price, team, profile:profiles(first_name, last_name, email)), match_results(id, sets, winning_team, recorded_by)')
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
        .select('*, court:courts(name, is_indoor, sport), players:booking_players(id, player_id, guest_name, guest_email, is_owner, payment_status, effective_price, team, profile:profiles(first_name, last_name, email)), match_results(id, sets, winning_team, recorded_by)')
        .in('id', otherBookingIds)
      asPlayer = data || []
    }

    // Historique affiché = uniquement le sport actif de la session.
    const merged = [...(asOwner || []), ...asPlayer].filter(b => !activeSport || b.court?.sport === activeSport)
    merged.sort((a, b) => new Date(b.starts_at) - new Date(a.starts_at))
    setBookings(merged)
    setLoading(false)
  }

  useEffect(() => { load() }, [activeSport])

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
    const isFull = inviteTarget.payment_mode === 'full'
    const profileRow = await supabase.from('profiles').select('discount_percent').eq('id', member.id).single()
    const discount = isFull ? 0 : (profileRow.data?.discount_percent || 0)
    const basePrice = isFull ? 0 : inviteTarget.price_per_player
    const effectivePrice = isFull ? 0 : calcEffectivePrice(basePrice, discount)

    await supabase.from('booking_players').insert({
      booking_id: inviteTarget.id,
      player_id: member.id,
      is_owner: false,
      payment_status: isFull ? 'paid' : 'pending',
      paid_at: isFull ? new Date().toISOString() : null,
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

    const isFull = inviteTarget.payment_mode === 'full'
    const basePrice = isFull ? 0 : inviteTarget.price_per_player

    // Mode full : invité gratuit, ajout direct sans paiement
    if (isFull) {
      setInviting(true)
      await supabase.from('booking_players').insert({
        booking_id: inviteTarget.id,
        guest_name: guestName.trim(),
        ...(guestEmail.trim() && { guest_email: guestEmail.trim() }),
        is_owner: false,
        payment_status: 'paid',
        paid_at: new Date().toISOString(),
        base_price: 0,
        discount_percent: 0,
        effective_price: 0,
      })
      setInviting(false)
      setInviteTarget(null)
      load()
      return
    }

    // Mode split/wallet payant : on crée la place en attente, puis on ouvre
    // le choix de paiement partagé (même modal que partout ailleurs).
    setInviting(true)
    const { data: newPlayer } = await supabase.from('booking_players').insert({
      booking_id: inviteTarget.id,
      guest_name: guestName.trim(),
      ...(guestEmail.trim() && { guest_email: guestEmail.trim() }),
      is_owner: false,
      payment_status: 'pending',
      base_price: basePrice,
      discount_percent: 0,
      effective_price: basePrice,
    }).select().single()
    setInviting(false)

    if (newPlayer) {
      const target = inviteTarget
      setInviteTarget(null)
      setGuestName('')
      setGuestEmail('')
      setPendingPayment({ bookingId: target.id, playerId: newPlayer.id, amount: basePrice })
    }
  }

  // ─── Paiement de sa propre part (joueur non-owner ou owner en split) ───
  function payMyShare(booking, myPlayerRow) {
    setPendingPayment({ bookingId: booking.id, playerId: myPlayerRow.id, amount: myPlayerRow.effective_price })
  }

  async function payShareViaWallet() {
    setPayingShare(pendingPayment.playerId)
    const { data: { user } } = await supabase.auth.getUser()
    const { data: prof } = await supabase.from('profiles').select('wallet_balance').eq('id', user.id).single()
    const available = prof?.wallet_balance || 0
    if (available >= pendingPayment.amount) {
      // On marque d'abord la place comme payée et on VÉRIFIE que ça a pris effet
      // avant de toucher au wallet (une update peut être bloquée silencieusement
      // par les droits d'accès, sans erreur — déjà rencontré sur ce projet).
      const { data: playerUpd, error: playerErr } = await supabase.from('booking_players')
        .update({ payment_status: 'paid', paid_at: new Date().toISOString() })
        .eq('id', pendingPayment.playerId).select('id')

      if (playerErr || !playerUpd || playerUpd.length === 0) {
        console.error('payShareViaWallet: mise à jour booking_players bloquée', playerErr)
        alert('Le paiement a été bloqué par un problème de droits d\'accès — aucun montant n\'a été débité.')
        setPayingShare(null)
        setPendingPayment(null)
        load()
        return
      }

      const { data: walletUpd, error: walletErr } = await supabase.from('profiles')
        .update({ wallet_balance: available - pendingPayment.amount }).eq('id', user.id).select('id')

      if (walletErr || !walletUpd || walletUpd.length === 0) {
        await supabase.from('booking_players').update({ payment_status: 'pending', paid_at: null }).eq('id', pendingPayment.playerId)
        console.error('payShareViaWallet: débit wallet bloqué', walletErr)
        alert('Le débit du wallet a échoué — rien n\'a été modifié.')
        setPayingShare(null)
        setPendingPayment(null)
        load()
        return
      }

      await supabase.from('wallet_transactions').insert({
        profile_id: user.id, amount: -pendingPayment.amount, type: 'debit',
        description: 'Part réservation', booking_id: pendingPayment.bookingId,
      })

      const booking = bookings.find(b => b.id === pendingPayment.bookingId)
      await logBillableEvent(supabase, {
        profileId: user.id, category: 'booking', sport: booking?.court?.sport,
        amount: pendingPayment.amount, paymentMethod: 'wallet', description: 'Réservation',
        bookingId: pendingPayment.bookingId, bookingPlayerId: pendingPayment.playerId,
      })
    }
    setPayingShare(null)
    setPendingPayment(null)
    load()
  }

  async function payShareViaCard() {
    setPayingShare(pendingPayment.playerId)
    const res = await fetch('/api/payments/initiate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ booking_id: pendingPayment.bookingId, booking_player_id: pendingPayment.playerId }),
    })
    const payData = await res.json().catch(() => ({}))
    setPayingShare(null)
    if (payData.payment_url) {
      goToPaymentUrl(router, payData.payment_url)
    } else {
      alert('Impossible d\'initier le paiement pour le moment.')
    }
  }

  // ─── Règlement manuel du solde dû (depuis le wallet du owner) ───
  async function settleViaWallet(booking) {
    const openBalance = calcOpenBalance(booking, booking.players || [])
    if (openBalance <= 0) { setPendingSettle(null); return }

    setSettling(booking.id)
    const { data: ownerProfile, error: profErr } = await supabase.from('profiles').select('wallet_balance').eq('id', userId).single()
    if (profErr) { console.error('settleViaWallet: lecture profil échouée', profErr); alert('Erreur : ' + profErr.message); setSettling(null); return }
    const available = ownerProfile?.wallet_balance || 0

    if (available < openBalance) {
      alert('Solde wallet insuffisant. Disponible : ' + available.toFixed(2) + ' € — Requis : ' + openBalance.toFixed(2) + ' €. Rechargez votre wallet.')
      setSettling(null)
      return
    }

    // 1. Marquer d'abord les joueurs impayés comme payés, et VÉRIFIER que ça a
    // vraiment pris effet (0 ligne modifiée = bloqué par les droits d'accès,
    // sans erreur levée — comportement Supabase déjà rencontré sur ce projet).
    // On ne touche au wallet qu'une fois cette étape confirmée, pour ne jamais
    // débiter sans que la dette soit effectivement soldée.
    const unpaidAssigned = (booking.players || []).filter(p => p.payment_status !== 'paid')
    const updatedPlayerIds = []
    for (const p of unpaidAssigned) {
      const { data: upd, error: playerErr } = await supabase.from('booking_players')
        .update({ payment_status: 'paid', paid_at: new Date().toISOString() })
        .eq('id', p.id).select('id')
      if (playerErr || !upd || upd.length === 0) {
        console.error('settleViaWallet: mise à jour booking_players bloquée pour', p.id, playerErr)
        alert('Le règlement a été bloqué par un problème de droits d\'accès — aucun montant n\'a été débité. Contacte le support en précisant : booking_players ' + p.id)
        setSettling(null)
        return
      }
      updatedPlayerIds.push(p.id)
    }

    // 2. Débit du wallet, seulement maintenant que l'étape 1 est confirmée.
    const { data: walletUpdated, error: walletErr } = await supabase.from('profiles')
      .update({ wallet_balance: available - openBalance }).eq('id', userId).select('id')

    if (walletErr || !walletUpdated || walletUpdated.length === 0) {
      // Rollback : le débit n'a pas eu lieu, on annule le marquage "payé" fait à l'étape 1.
      for (const id of updatedPlayerIds) {
        await supabase.from('booking_players').update({ payment_status: 'pending', paid_at: null }).eq('id', id)
      }
      console.error('settleViaWallet: débit wallet bloqué', walletErr)
      alert('Le débit du wallet a échoué — rien n\'a été modifié.')
      setSettling(null)
      return
    }

    const { error: txErr } = await supabase.from('wallet_transactions').insert({
      profile_id: userId, amount: -openBalance, type: 'debit',
      description: 'Règlement solde réservation ' + (booking.court?.name || ''), booking_id: booking.id,
    })
    if (txErr) console.error('settleViaWallet: insertion wallet_transactions échouée (non bloquant)', txErr)

    await logBillableEvent(supabase, {
      profileId: userId, category: 'booking', sport: booking.court?.sport,
      amount: openBalance, paymentMethod: 'wallet', description: 'Règlement solde réservation',
      bookingId: booking.id,
    })

    // Si la résa était pending, elle est maintenant entièrement couverte -> confirmer
    if (booking.status === 'pending') {
      const { error: bookingErr } = await supabase.from('bookings').update({ status: 'confirmed' }).eq('id', booking.id)
      if (bookingErr) console.error('settleViaWallet: confirmation booking échouée', bookingErr)
    }

    setSettling(null)
    setPendingSettle(null)
    load()
  }

  async function settleViaCard(booking) {
    setSettling(booking.id)
    const res = await fetch('/api/payments/initiate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ booking_id: booking.id, settle_open_balance: true }),
    })
    const payData = await res.json().catch(() => ({}))
    setSettling(null)
    if (payData.payment_url) {
      goToPaymentUrl(router, payData.payment_url)
    } else {
      alert(payData.error || 'Impossible d\'initier le paiement pour le moment.')
    }
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
                    {(b.players || []).length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '10px' }}>
                        {(b.players || []).map(p => (
                          <span key={p.id} style={{ fontSize: '11px', padding: '3px 9px', borderRadius: '99px', background: p.payment_status === 'paid' ? 'var(--brand-dim)' : 'var(--surface2)', color: p.payment_status === 'paid' ? 'var(--brand-light)' : 'var(--muted)' }}>
                            {memberName(p)} {p.payment_status === 'paid'
                              ? (b.payment_mode === 'full' && !p.is_owner
                                  ? (() => { const o = (b.players || []).find(pl => pl.is_owner); return '(payé par ' + (o?.profile?.first_name || 'le réservant') + ')' })()
                                  : '✓')
                              : '⏳'}
                          </span>
                        ))}
                        {Array.from({ length: spotsLeft }).map((_, i) => (
                          <span key={'empty-' + i} style={{ fontSize: '11px', padding: '3px 9px', borderRadius: '99px', border: '1px dashed var(--border)', color: 'var(--muted)' }}>
                            Place libre
                          </span>
                        ))}
                      </div>
                    )}

                    {(() => {
                      const myRow = (b.players || []).find(p => p.player_id === userId)
                      if (!myRow || myRow.payment_status === 'paid' || !myRow.effective_price) return null
                      return (
                        <div style={{ marginTop: '10px', background: 'var(--brand-dim)', border: '1px solid var(--brand)', borderRadius: '8px', padding: '8px 12px', fontSize: '12px', color: 'var(--brand-light)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
                            <span>Votre part : <strong>{myRow.effective_price.toFixed(2)} €</strong></span>
                            <button onClick={() => payMyShare(b, myRow)} disabled={payingShare === myRow.id}
                              style={{ background: 'var(--brand)', color: '#fff', border: 'none', borderRadius: '6px', padding: '4px 10px', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>
                              {payingShare === myRow.id ? '...' : 'Payer ma part'}
                            </button>
                          </div>
                        </div>
                      )
                    })()}

                    {openBalance > 0 && isOwner && (
                      <div style={{ marginTop: '10px', background: 'rgba(252,211,77,0.06)', border: '1px solid rgba(252,211,77,0.2)', borderRadius: '8px', padding: '8px 12px', fontSize: '12px', color: 'var(--amber)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
                          <span>Solde non couvert : <strong>{openBalance.toFixed(2)} €</strong></span>
                          <button onClick={() => setPendingSettle(b)} disabled={settling === b.id}
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
                    {isOwner && spotsLeft > 0 && ['pending', 'confirmed'].includes(b.status) && (
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
                    <button onClick={() => setOpenChatId(openChatId === b.id ? null : b.id)}
                      style={{ background: openChatId === b.id ? 'var(--brand-dim)' : 'none', border: '1px solid ' + (openChatId === b.id ? 'var(--brand)' : 'var(--border)'), color: openChatId === b.id ? 'var(--brand-light)' : 'var(--muted)', borderRadius: '8px', padding: '6px 12px', fontSize: '12px', cursor: 'pointer' }}>
                      💬 Discussion
                    </button>
                  </div>
                </div>

                {openChatId === b.id && (
                  <div style={{ marginTop: '14px' }}>
                    <Chat bookingId={b.id} endsAt={b.ends_at} isRegistered={true} isPublicAccess={b.is_public} isAdmin={false} />
                  </div>
                )}

                {(b.status === 'completed' || new Date(b.ends_at) < new Date()) && (b.players || []).length >= 2 && (
                  <MatchScore booking={b} userId={userId} isAdmin={false} onUpdate={load} />
                )}
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {inviteTarget?.payment_mode === 'full' && (
                  <span style={{ fontSize: '11px', background: 'var(--brand-dim)', color: 'var(--brand-light)', border: '1px solid var(--brand)', borderRadius: '99px', padding: '3px 8px' }}>
                    {(() => { const o = (inviteTarget.players || []).find(p => p.is_owner); return 'Terrain payé par ' + (o?.profile?.first_name || 'le réservant') + (o?.profile?.last_name ? ' ' + o.profile.last_name : '') })()}
                  </span>
                )}
                <button onClick={() => setInviteTarget(null)} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: '18px', cursor: 'pointer' }}>✕</button>
              </div>
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
                  {inviteTarget?.payment_mode === 'full'
                    ? (() => { const o = (inviteTarget.players || []).find(p => p.is_owner); const name = (o?.profile?.first_name || 'Le réservant') + (o?.profile?.last_name ? ' ' + o.profile.last_name : ''); return 'Terrain payé par ' + name + '.' })()
                    : 'Le membre paiera sa part lui-même. Sinon, elle sera couverte par votre wallet en fin de match.'}
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

                {inviteTarget?.payment_mode !== 'full' && (
                  <div style={{ background: 'rgba(252,211,77,0.06)', border: '1px solid rgba(252,211,77,0.2)', borderRadius: '8px', padding: '10px 12px', fontSize: '12px', color: 'var(--amber)' }}>
                    Cet invité n'a pas de compte — c'est <strong>vous</strong> qui réglez sa part ({inviteTarget?.price_per_player?.toFixed(2)} €). Le choix du mode de paiement sera proposé juste après.
                  </div>
                )}

                <button onClick={inviteGuest} disabled={inviting || !guestName.trim()}
                  style={{ background: 'var(--brand)', color: '#fff', border: 'none', borderRadius: '8px', padding: '12px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', fontFamily: "'Syne',sans-serif", opacity: (inviting || !guestName.trim()) ? 0.5 : 1, marginTop: '4px' }}>
                  {inviting ? 'Traitement...' : inviteTarget?.payment_mode === 'full' ? 'Ajouter l\'invité' : 'Ajouter (' + (inviteTarget?.price_per_player?.toFixed(2) || '') + ' €)'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {pendingPayment && (
        <PaymentMethodModal
          amount={pendingPayment.amount}
          onChooseWallet={payShareViaWallet}
          onChooseCard={payShareViaCard}
          onClose={() => setPendingPayment(null)}
        />
      )}

      {pendingSettle && (
        <PaymentMethodModal
          amount={calcOpenBalance(pendingSettle, pendingSettle.players || [])}
          onChooseWallet={() => settleViaWallet(pendingSettle)}
          onChooseCard={() => settleViaCard(pendingSettle)}
          onClose={() => setPendingSettle(null)}
        />
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

