export async function POST(req) {
  // TODO: valider signature PayConic
  // const signature = req.headers.get('x-payconic-signature')

  const body = await req.json()
  console.log('PayConic webhook received:', body)

  // TODO: mettre à jour le statut du paiement et de la réservation
  return new Response(JSON.stringify({ received: true }), { status: 200 })
}
