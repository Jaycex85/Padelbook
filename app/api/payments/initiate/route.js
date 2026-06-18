import { createServiceSupabase } from '../../../../lib/supabaseServer'

/**
 * Stub PayConic — à remplacer par l'intégration réelle
 * POST /api/payments/initiate
 * body: { booking_id, booking_player_id }
 */
export async function POST(req) {
  const supabase = await createServiceSupabase()
  const { booking_id, booking_player_id } = await req.json()

  if (!booking_id) {
    return new Response(JSON.stringify({ error: 'booking_id requis' }), { status: 400 })
  }

  // Récupérer la réservation
  const { data: booking, error } = await supabase
    .from('bookings')
    .select('*, court:courts(*), players:booking_players(*)')
    .eq('id', booking_id)
    .single()

  if (error || !booking) {
    return new Response(JSON.stringify({ error: 'Réservation introuvable' }), { status: 404 })
  }

  // Déterminer le montant selon le mode
  let amount = booking.total_price
  if (booking_player_id) {
    const player = booking.players.find(p => p.id === booking_player_id)
    if (player) amount = player.effective_price || player.base_price
  }

  // TODO: Appel API PayConic réel
  // const payconicResponse = await fetch('https://api.payconic.be/v1/payments', {
  //   method: 'POST',
  //   headers: { 'Authorization': 'Bearer ' + process.env.PAYCONIC_API_KEY, 'Content-Type': 'application/json' },
  //   body: JSON.stringify({
  //     amount: Math.round(amount * 100), // centimes
  //     currency: 'EUR',
  //     redirect_url: process.env.NEXT_PUBLIC_APP_URL + '/payment/success?booking=' + booking_id,
  //     webhook_url: process.env.NEXT_PUBLIC_APP_URL + '/api/payments/webhook',
  //     metadata: { booking_id, booking_player_id }
  //   })
  // })

  // STUB : simule une réponse PayConic
  const stubPayconicRef = 'PAY-STUB-' + Date.now()

  // Créer l'entrée payment en base
  await supabase.from('payments').insert({
    booking_id,
    booking_player_id: booking_player_id || null,
    amount,
    status: 'pending',
    payment_method: 'payconic',
    payconic_ref: stubPayconicRef,
  })

  // STUB : retourne une fausse URL de paiement
  // En production : retourner payconicResponse.checkout_url
  return new Response(JSON.stringify({
    payment_url: process.env.NEXT_PUBLIC_APP_URL + '/payment/stub?ref=' + stubPayconicRef + '&booking=' + booking_id,
    payconic_ref: stubPayconicRef,
    amount,
    stub: true,
  }), { status: 200 })
}
