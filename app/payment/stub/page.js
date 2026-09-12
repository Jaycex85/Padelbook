'use client'
import { useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '../../../lib/supabase'
import { logBillableEvent } from '../../../lib/billing'
import { Suspense } from 'react'

function StubPaymentContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const ref = searchParams.get('ref')
  const bookingId = searchParams.get('booking')
  const isSettle = searchParams.get('settle') === '1'
  const eventRegistrationId = searchParams.get('event_registration')
  const membershipRequestId = searchParams.get('membership_request')
  const isWalletTopup = searchParams.get('wallet_topup') === '1'
  const topupAmount = parseFloat(searchParams.get('amount') || '0')
  const [processing, setProcessing] = useState(false)
  const [done, setDone] = useState(false)
  const supabase = createClient()

  async function confirmPayment() {
    setProcessing(true)
    const { data: { user } } = await supabase.auth.getUser()

    if (bookingId) {
      const { data: payment } = await supabase.from('payments').select('*').eq('payconic_ref', ref).single()
      await supabase.from('payments').update({ status: 'paid' }).eq('payconic_ref', ref)
      await supabase.from('bookings').update({ status: 'confirmed' }).eq('id', bookingId)

      if (isSettle) {
        // Règlement global : tous les joueurs encore impayés de cette réservation sont couverts,
        // ET les places encore vides (sans ligne booking_players) sont créées comme "couvertes" —
        // sinon le calcul du solde dû resterait bloqué sur "places vides à payer" indéfiniment.
        const { data: bookingRow } = await supabase.from('bookings').select('max_players, price_per_player').eq('id', bookingId).single()
        const { data: players } = await supabase.from('booking_players').select('id, payment_status').eq('booking_id', bookingId)
        const unpaid = (players || []).filter(p => p.payment_status !== 'paid')
        for (const p of unpaid) {
          await supabase.from('booking_players').update({ payment_status: 'paid', paid_at: new Date().toISOString() }).eq('id', p.id)
        }
        const emptySlots = Math.max(0, (bookingRow?.max_players || 4) - (players || []).length)
        for (let i = 0; i < emptySlots; i++) {
          await supabase.from('booking_players').insert({
            booking_id: bookingId,
            guest_name: 'Place couverte',
            is_owner: false,
            payment_status: 'paid',
            paid_at: new Date().toISOString(),
            base_price: bookingRow?.price_per_player,
            discount_percent: 0,
            effective_price: bookingRow?.price_per_player,
          })
        }
      } else if (payment?.booking_player_id) {
        await supabase.from('booking_players').update({ payment_status: 'paid', paid_at: new Date().toISOString() }).eq('id', payment.booking_player_id)
      }

      const { data: booking } = await supabase.from('bookings').select('court:courts(sport)').eq('id', bookingId).single()
      await logBillableEvent(supabase, {
        profileId: user?.id, category: 'booking', sport: booking?.court?.sport,
        amount: payment?.amount, paymentMethod: 'card', description: isSettle ? 'Règlement solde réservation' : 'Réservation',
        bookingId, bookingPlayerId: isSettle ? null : payment?.booking_player_id,
      })
    }

    if (eventRegistrationId) {
      await supabase.from('event_registrations').update({ status: 'confirmed', payment_status: 'paid' }).eq('id', eventRegistrationId)
      const { data: registration } = await supabase.from('event_registrations').select('price_paid, event:club_events(sport)').eq('id', eventRegistrationId).single()
      await logBillableEvent(supabase, {
        profileId: user?.id, category: 'event', sport: registration?.event?.sport,
        amount: registration?.price_paid, paymentMethod: 'card', description: 'Inscription Club Event',
        eventRegistrationId,
      })
    }

    if (membershipRequestId) {
      // Le paiement est fait, mais la demande reste "pending" (statut métier) tant
      // que l'admin ne l'a pas validée avec une période de validité.
      await supabase.from('membership_requests').update({ payment_status: 'paid' }).eq('id', membershipRequestId)
      const { data: request } = await supabase.from('membership_requests').select('price, membership_type:membership_types(sport)').eq('id', membershipRequestId).single()
      await logBillableEvent(supabase, {
        profileId: user?.id, category: 'membership', sport: request?.membership_type?.sport,
        amount: request?.price, paymentMethod: 'card', description: 'Adhésion / licence',
        membershipRequestId,
      })
    }

    if (isWalletTopup && topupAmount > 0) {
      if (user) {
        const { data: prof } = await supabase.from('profiles').select('wallet_balance').eq('id', user.id).single()
        const available = prof?.wallet_balance || 0
        await supabase.from('profiles').update({ wallet_balance: available + topupAmount }).eq('id', user.id)
        await supabase.from('wallet_transactions').insert({
          profile_id: user.id, amount: topupAmount, type: 'credit',
          description: 'Recharge wallet par carte',
        })
        await logBillableEvent(supabase, {
          profileId: user.id, category: 'wallet_topup', sport: null,
          amount: topupAmount, paymentMethod: 'card', description: 'Recharge wallet',
        })
      }
    }

    setDone(true)
    setProcessing(false)
    setTimeout(() => router.push(eventRegistrationId ? '/events' : membershipRequestId ? '/membership' : isWalletTopup ? '/profile' : '/my-bookings'), 2000)
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '32px', width: '100%', maxWidth: '400px', textAlign: 'center' }}>
        {done ? (
          <>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>✅</div>
            <h2 style={{ fontFamily: "'Syne',sans-serif", fontSize: '20px', fontWeight: 700, color: 'var(--brand-light)', marginBottom: '8px' }}>Paiement confirmé !</h2>
            <p style={{ color: 'var(--muted)', fontSize: '14px' }}>Redirection...</p>
          </>
        ) : (
          <>
            <div style={{ background: 'var(--brand-dim)', border: '1px solid var(--brand)', borderRadius: '8px', padding: '8px 14px', display: 'inline-block', marginBottom: '20px' }}>
              <span style={{ fontSize: '12px', color: 'var(--brand-light)', fontWeight: 500 }}>⚠️ Mode STUB — PayConic non connecté</span>
            </div>
            <h2 style={{ fontFamily: "'Syne',sans-serif", fontSize: '20px', fontWeight: 700, marginBottom: '8px' }}>
              {isWalletTopup ? 'Recharge du wallet' : 'Simulation de paiement'}
            </h2>
            <p style={{ color: 'var(--muted)', fontSize: '14px', marginBottom: '24px' }}>
              {isWalletTopup && <>Montant : <strong style={{ color: 'var(--brand-light)' }}>{topupAmount.toFixed(2)} €</strong><br /></>}
              Référence : <code style={{ fontFamily: 'monospace', color: 'var(--brand-light)' }}>{ref}</code>
            </p>
            <button onClick={confirmPayment} disabled={processing}
              style={{ width: '100%', background: 'var(--brand)', color: '#fff', border: 'none', borderRadius: '8px', padding: '13px', fontSize: '15px', fontWeight: 600, cursor: 'pointer', fontFamily: "'Syne',sans-serif", opacity: processing ? 0.6 : 1 }}>
              {processing ? 'Traitement...' : 'Simuler le paiement ✓'}
            </button>
            <button onClick={() => router.back()} style={{ width: '100%', background: 'none', border: '1px solid var(--border)', color: 'var(--muted)', borderRadius: '8px', padding: '11px', fontSize: '14px', cursor: 'pointer', marginTop: '8px' }}>
              Annuler
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export default function StubPaymentPage() {
  return (
    <Suspense fallback={<div style={{ textAlign: 'center', padding: '48px', color: 'var(--muted)' }}>Chargement...</div>}>
      <StubPaymentContent />
    </Suspense>
  )
}
