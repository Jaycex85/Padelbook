import { logBillableEvent } from './billing'

// Marque tout ce qui doit l'être en base une fois qu'un paiement Mollie est
// confirmé "paid". Appelé uniquement depuis le webhook (jamais depuis le
// client) : c'est la seule source de vérité pour l'argent réel.
// Idempotent : à appeler seulement si paymentRecord.status !== 'paid' avant coup
// (vérifié par l'appelant), mais chaque étape individuelle reste défensive.
export async function finalizePayment(supabase, paymentRecord) {
  const { category, amount, booking_id, booking_player_id, event_registration_id, membership_request_id, profile_id, settle_open_balance } = paymentRecord

  if (category === 'booking' && booking_id) {
    const { data: booking } = await supabase.from('bookings').select('*, court:courts(sport)').eq('id', booking_id).single()

    if (settle_open_balance) {
      // Règlement global : tous les joueurs impayés + création de "places
      // couvertes" pour les slots vides (sinon le solde ne retombe jamais à 0).
      const { data: players } = await supabase.from('booking_players').select('id, payment_status').eq('booking_id', booking_id)
      const unpaid = (players || []).filter(p => p.payment_status !== 'paid')
      for (const p of unpaid) {
        await supabase.from('booking_players').update({ payment_status: 'paid', paid_at: new Date().toISOString() }).eq('id', p.id)
      }
      const emptySlots = Math.max(0, (booking?.max_players || 4) - (players || []).length)
      for (let i = 0; i < emptySlots; i++) {
        await supabase.from('booking_players').insert({
          booking_id, guest_name: 'Place couverte', is_owner: false,
          payment_status: 'paid', paid_at: new Date().toISOString(),
          base_price: booking?.price_per_player, discount_percent: 0, effective_price: booking?.price_per_player,
        })
      }
    } else if (booking_player_id) {
      await supabase.from('booking_players').update({ payment_status: 'paid', paid_at: new Date().toISOString() }).eq('id', booking_player_id)
    }

    await supabase.from('bookings').update({ status: 'confirmed' }).eq('id', booking_id)

    await logBillableEvent(supabase, {
      profileId: profile_id, category: 'booking', sport: booking?.court?.sport,
      amount, paymentMethod: 'card', description: settle_open_balance ? 'Règlement solde réservation' : 'Réservation',
      bookingId: booking_id, bookingPlayerId: settle_open_balance ? null : booking_player_id,
    })
  }

  if (category === 'event' && event_registration_id) {
    await supabase.from('event_registrations').update({ status: 'confirmed', payment_status: 'paid' }).eq('id', event_registration_id)
    const { data: registration } = await supabase.from('event_registrations').select('event:club_events(sport)').eq('id', event_registration_id).single()
    await logBillableEvent(supabase, {
      profileId: profile_id, category: 'event', sport: registration?.event?.sport,
      amount, paymentMethod: 'card', description: 'Inscription Club Event',
      eventRegistrationId: event_registration_id,
    })
  }

  if (category === 'membership' && membership_request_id) {
    // Le paiement est fait, mais la demande reste "pending" (statut métier)
    // tant que l'admin ne l'a pas validée avec une période de validité.
    await supabase.from('membership_requests').update({ payment_status: 'paid' }).eq('id', membership_request_id)
    const { data: request } = await supabase.from('membership_requests').select('membership_type:membership_types(sport)').eq('id', membership_request_id).single()
    await logBillableEvent(supabase, {
      profileId: profile_id, category: 'membership', sport: request?.membership_type?.sport,
      amount, paymentMethod: 'card', description: 'Adhésion / licence',
      membershipRequestId: membership_request_id,
    })
  }

  if (category === 'wallet_topup' && profile_id) {
    const { data: prof } = await supabase.from('profiles').select('wallet_balance').eq('id', profile_id).single()
    const available = prof?.wallet_balance || 0
    await supabase.from('profiles').update({ wallet_balance: available + amount }).eq('id', profile_id)
    await supabase.from('wallet_transactions').insert({
      profile_id, amount, type: 'credit', description: 'Recharge wallet par carte',
    })
    await logBillableEvent(supabase, {
      profileId: profile_id, category: 'wallet_topup', sport: null,
      amount, paymentMethod: 'card', description: 'Recharge wallet',
    })
  }
}
