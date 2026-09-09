import { createServiceSupabase } from '../../../../lib/supabaseServer'

/**
 * Stub PayConic — à remplacer par l'intégration réelle
 * POST /api/payments/initiate
 * body: { booking_id, booking_player_id } OU { event_registration_id, amount } OU { wallet_topup: true, amount, profile_id }
 */
export async function POST(req) {
  const supabase = await createServiceSupabase()
  const body = await req.json()
  const { booking_id, booking_player_id, event_registration_id, wallet_topup, profile_id } = body

  if (!booking_id && !event_registration_id && !wallet_topup) {
    return new Response(JSON.stringify({ error: 'booking_id, event_registration_id ou wallet_topup requis' }), { status: 400 })
  }

  let amount = 0
  const paymentRow = { status: 'pending', payment_method: 'payconic' }

  if (booking_id) {
    const { data: booking, error } = await supabase
      .from('bookings')
      .select('*, court:courts(*), players:booking_players(*)')
      .eq('id', booking_id)
      .single()

    if (error || !booking) {
      return new Response(JSON.stringify({ error: 'Réservation introuvable' }), { status: 404 })
    }

    amount = booking.total_price
    if (booking_player_id) {
      const player = booking.players.find(p => p.id === booking_player_id)
      if (player) amount = player.effective_price || player.base_price
    }
    paymentRow.booking_id = booking_id
    paymentRow.booking_player_id = booking_player_id || null
  } else if (event_registration_id) {
    const { data: registration, error } = await supabase
      .from('event_registrations')
      .select('*, event:club_events(*)')
      .eq('id', event_registration_id)
      .single()

    if (error || !registration) {
      return new Response(JSON.stringify({ error: 'Inscription introuvable' }), { status: 404 })
    }

    amount = registration.price_paid || registration.event?.price_per_player || body.amount || 0
    paymentRow.event_registration_id = event_registration_id
  } else if (wallet_topup) {
    if (!profile_id) {
      return new Response(JSON.stringify({ error: 'profile_id requis pour une recharge wallet' }), { status: 400 })
    }
    amount = parseFloat(body.amount)
    if (!amount || amount <= 0) {
      return new Response(JSON.stringify({ error: 'Montant invalide' }), { status: 400 })
    }
  }

  // TODO: Appel API PayConic réel
  // const payconicResponse = await fetch('https://api.payconic.be/v1/payments', {
  //   method: 'POST',
  //   headers: { 'Authorization': 'Bearer ' + process.env.PAYCONIC_API_KEY, 'Content-Type': 'application/json' },
  //   body: JSON.stringify({
  //     amount: Math.round(amount * 100),
  //     currency: 'EUR',
  //     redirect_url: process.env.NEXT_PUBLIC_APP_URL + '/payment/success',
  //     webhook_url: process.env.NEXT_PUBLIC_APP_URL + '/api/payments/webhook',
  //     metadata: { booking_id, booking_player_id, event_registration_id, wallet_topup, profile_id }
  //   })
  // })

  const stubPayconicRef = 'PAY-STUB-' + Date.now()
  paymentRow.amount = amount
  paymentRow.payconic_ref = stubPayconicRef

  // Note : la table payments n'a pas encore de colonne event_registration_id/wallet_topup —
  // pour l'event on stocke la ref directement dessus ; pour la recharge wallet, le montant
  // et le profil sont passés dans l'URL de retour (stub uniquement, pas encore de table dédiée).
  if (event_registration_id) {
    await supabase.from('event_registrations').update({ payconic_ref: stubPayconicRef }).eq('id', event_registration_id)
  } else if (!wallet_topup) {
    await supabase.from('payments').insert(paymentRow)
  }

  return new Response(JSON.stringify({
    payment_url: process.env.NEXT_PUBLIC_APP_URL + '/payment/stub?ref=' + stubPayconicRef +
      (booking_id ? '&booking=' + booking_id : '') +
      (event_registration_id ? '&event_registration=' + event_registration_id : '') +
      (wallet_topup ? '&wallet_topup=1&amount=' + amount + '&profile=' + profile_id : ''),
    payconic_ref: stubPayconicRef,
    amount,
    stub: true,
  }), { status: 200 })
}
