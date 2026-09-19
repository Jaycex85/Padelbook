import { createServiceSupabase } from '../../../../lib/supabaseServer'
import { getMollieClient } from '../../../../lib/mollie'
import { finalizePayment } from '../../../../lib/paymentFinalize'

// Mollie envoie un POST en x-www-form-urlencoded contenant uniquement `id`.
// On ne fait JAMAIS confiance au corps de la requête pour le statut — on
// re-récupère toujours le paiement via l'API Mollie avec notre clé serveur.
export async function POST(req) {
  const supabase = await createServiceSupabase()

  let mollieId
  try {
    const formData = await req.formData()
    mollieId = formData.get('id')
  } catch (e) {
    // Certains appels de test Mollie envoient du JSON plutôt que form-encoded
    try {
      const json = await req.json()
      mollieId = json.id
    } catch (e2) { /* ignore */ }
  }

  if (!mollieId) {
    return new Response(JSON.stringify({ error: 'id manquant' }), { status: 400 })
  }

  const { data: paymentRecord } = await supabase.from('payments').select('*').eq('provider_payment_id', mollieId).single()
  if (!paymentRecord) {
    // Paiement inconnu de notre côté (test Mollie, ou race condition avant
    // que le insert initial ne soit visible) — on répond 200 pour éviter
    // que Mollie ne re-tente indéfiniment.
    return new Response(JSON.stringify({ received: true }), { status: 200 })
  }

  let molliePayment
  try {
    const mollie = getMollieClient()
    molliePayment = await mollie.payments.get(mollieId)
  } catch (e) {
    console.error('Mollie payments.get failed', e)
    return new Response(JSON.stringify({ error: 'Impossible de vérifier le paiement' }), { status: 502 })
  }

  // Idempotent : on ne finalise qu'une fois.
  if (molliePayment.status === 'paid' && paymentRecord.status !== 'paid') {
    await supabase.from('payments').update({ status: 'paid' }).eq('id', paymentRecord.id)
    await finalizePayment(supabase, paymentRecord)
  } else if (['failed', 'canceled', 'expired'].includes(molliePayment.status) && paymentRecord.status === 'pending') {
    await supabase.from('payments').update({ status: molliePayment.status }).eq('id', paymentRecord.id)
  }

  return new Response(JSON.stringify({ received: true }), { status: 200 })
}
