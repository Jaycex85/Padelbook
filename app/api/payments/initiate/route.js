import { createServiceSupabase } from '../../../../lib/supabaseServer'
import { calcOpenBalance } from '../../../../lib/bookingUtils'
import { getMollieClient } from '../../../../lib/mollie'

/**
 * POST /api/payments/initiate
 * body: { booking_id, booking_player_id } OU { booking_id, settle_open_balance: true }
 *       OU { event_registration_id, amount } OU { wallet_topup: true, amount, profile_id }
 *       OU { membership_request_id, amount }
 *
 * Utilise Mollie si MOLLIE_API_KEY est configuré (env Vercel), sinon retombe
 * sur le stub interne (/payment/stub) pour ne pas bloquer le développement
 * tant que la clé n'est pas mise en place.
 */
export async function POST(req) {
  const supabase = await createServiceSupabase()
  const body = await req.json()
  const { booking_id, booking_player_id, settle_open_balance, event_registration_id, wallet_topup, profile_id, membership_request_id } = body

  if (!booking_id && !event_registration_id && !wallet_topup && !membership_request_id) {
    return new Response(JSON.stringify({ error: 'booking_id, event_registration_id, membership_request_id ou wallet_topup requis' }), { status: 400 })
  }

  let amount = 0
  let sport = null
  let description = 'Brussels B&P Club'
  let resolvedProfileId = profile_id || null

  if (booking_id) {
    const { data: booking, error } = await supabase
      .from('bookings')
      .select('*, court:courts(*), players:booking_players(*)')
      .eq('id', booking_id)
      .single()

    if (error || !booking) {
      return new Response(JSON.stringify({ error: 'Réservation introuvable' }), { status: 404 })
    }

    if (settle_open_balance) {
      amount = calcOpenBalance(booking, booking.players || [])
      if (amount <= 0) {
        return new Response(JSON.stringify({ error: 'Aucun solde à régler' }), { status: 400 })
      }
      description = 'Brussels B&P — Solde réservation ' + (booking.court?.name || '')
      resolvedProfileId = booking.owner_id
    } else {
      amount = booking.total_price
      resolvedProfileId = booking.owner_id
      if (booking_player_id) {
        const player = booking.players.find(p => p.id === booking_player_id)
        if (player) {
          amount = player.effective_price || player.base_price
          resolvedProfileId = player.player_id || resolvedProfileId
        }
      }
      description = 'Brussels B&P — Réservation ' + (booking.court?.name || '')
    }
    sport = booking.court?.sport || null
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
    sport = registration.event?.sport || null
    resolvedProfileId = registration.player_id
    description = 'Brussels B&P — ' + (registration.event?.label || 'Club Event')
  } else if (membership_request_id) {
    const { data: request, error } = await supabase
      .from('membership_requests')
      .select('*, membership_type:membership_types(*)')
      .eq('id', membership_request_id)
      .single()

    if (error || !request) {
      return new Response(JSON.stringify({ error: 'Demande introuvable' }), { status: 404 })
    }

    amount = request.price ?? request.membership_type?.price ?? body.amount ?? 0
    sport = request.membership_type?.sport || null
    resolvedProfileId = request.profile_id
    description = 'Brussels B&P — ' + (request.membership_type?.label || 'Adhésion')
  } else if (wallet_topup) {
    if (!profile_id) {
      return new Response(JSON.stringify({ error: 'profile_id requis pour une recharge wallet' }), { status: 400 })
    }
    amount = parseFloat(body.amount)
    if (!amount || amount <= 0) {
      return new Response(JSON.stringify({ error: 'Montant invalide' }), { status: 400 })
    }
    description = 'Brussels B&P — Recharge wallet'
  }

  const category = wallet_topup ? 'wallet_topup' : booking_id ? 'booking' : event_registration_id ? 'event' : 'membership'
  const appUrl = process.env.NEXT_PUBLIC_APP_URL

  // ── Mollie configuré : vrai paiement ──────────────────────────────
  if (process.env.MOLLIE_API_KEY && appUrl) {
    const { data: paymentRecord, error: insertErr } = await supabase.from('payments').insert({
      status: 'pending',
      payment_method: 'mollie',
      provider: 'mollie',
      category,
      amount,
      sport,
      booking_id: booking_id || null,
      booking_player_id: booking_player_id || null,
      settle_open_balance: !!settle_open_balance,
      event_registration_id: event_registration_id || null,
      membership_request_id: membership_request_id || null,
      profile_id: resolvedProfileId,
    }).select().single()

    if (insertErr || !paymentRecord) {
      console.error('payments insert failed', insertErr)
      return new Response(JSON.stringify({ error: 'Impossible de préparer le paiement' }), { status: 500 })
    }

    try {
      const mollie = getMollieClient()
      const molliePayment = await mollie.payments.create({
        amount: { currency: 'EUR', value: amount.toFixed(2) },
        description,
        redirectUrl: appUrl + '/payment/return?ref=' + paymentRecord.id,
        webhookUrl: appUrl + '/api/payments/webhook',
        metadata: { payment_record_id: paymentRecord.id },
      })

      await supabase.from('payments').update({ provider_payment_id: molliePayment.id }).eq('id', paymentRecord.id)

      return new Response(JSON.stringify({
        payment_url: molliePayment._links.checkout.href,
        payment_id: paymentRecord.id,
        amount,
      }), { status: 200 })
    } catch (mollieErr) {
      console.error('Mollie payment creation failed', mollieErr)
      await supabase.from('payments').update({ status: 'failed' }).eq('id', paymentRecord.id)
      return new Response(JSON.stringify({ error: 'Le paiement par carte est momentanément indisponible.' }), { status: 502 })
    }
  }

  // ── Repli stub (MOLLIE_API_KEY pas encore configuré) ──────────────
  const paymentRow = { status: 'pending', payment_method: 'payconic', category, amount, sport, profile_id: resolvedProfileId }
  const stubPayconicRef = 'PAY-STUB-' + Date.now()
  paymentRow.amount = amount
  paymentRow.payconic_ref = stubPayconicRef
  paymentRow.booking_id = booking_id || null
  paymentRow.booking_player_id = booking_player_id || null

  if (event_registration_id) {
    await supabase.from('event_registrations').update({ payconic_ref: stubPayconicRef }).eq('id', event_registration_id)
  } else if (membership_request_id) {
    await supabase.from('membership_requests').update({ payconic_ref: stubPayconicRef }).eq('id', membership_request_id)
  } else if (!wallet_topup) {
    await supabase.from('payments').insert(paymentRow)
  }

  return new Response(JSON.stringify({
    payment_url: '/payment/stub?ref=' + stubPayconicRef +
      (booking_id ? '&booking=' + booking_id : '') +
      (settle_open_balance ? '&settle=1' : '') +
      (event_registration_id ? '&event_registration=' + event_registration_id : '') +
      (membership_request_id ? '&membership_request=' + membership_request_id : '') +
      (wallet_topup ? '&wallet_topup=1&amount=' + amount + '&profile=' + profile_id : ''),
    payconic_ref: stubPayconicRef,
    amount,
    stub: true,
  }), { status: 200 })
}
