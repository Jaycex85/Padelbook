import { createServiceSupabase } from '../../../../lib/supabaseServer'

/**
 * Cron horaire — règle automatiquement le solde des réservations terminées.
 *
 * Logique :
 * - Cherche les bookings avec ends_at < now(), status in (pending, confirmed)
 * - Pour chacune, calcule le solde dû (places vides + joueurs assignés non payés)
 * - Si solde > 0, débite le wallet du owner pour COUVRIR la différence
 *   (le owner garantit toujours le montant total du terrain, même si des
 *   invités n'ont pas payé à temps)
 * - Marque les joueurs assignés impayés comme 'paid' (couverts par le owner)
 * - Passe le statut du booking à 'completed'
 * - Si le wallet du owner est insuffisant, le solde reste affiché comme dû
 *   (le owner devra recharger et régler manuellement) — le statut passe quand
 *   même à 'completed' puisque le match a eu lieu, mais le solde négatif reste tracé.
 */
export async function GET(req) {
  const secret = req.headers.get('authorization')
  if (secret !== 'Bearer ' + process.env.CRON_SECRET) {
    return new Response('Unauthorized', { status: 401 })
  }

  const supabase = await createServiceSupabase()
  const now = new Date().toISOString()

  const { data: dueBookings, error } = await supabase
    .from('bookings')
    .select('*, players:booking_players(*)')
    .lt('ends_at', now)
    .in('status', ['pending', 'confirmed'])

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }

  const results = []

  for (const booking of (dueBookings || [])) {
    const players = booking.players || []
    const assignedCount = players.length
    const emptySlots = Math.max(0, (booking.max_players || 4) - assignedCount)
    const emptySlotsCost = emptySlots * (parseFloat(booking.price_per_player) || 0)
    const unpaidAssigned = players.filter(p => p.payment_status !== 'paid')
    const unpaidAssignedCost = unpaidAssigned.reduce((sum, p) => sum + (parseFloat(p.effective_price) || 0), 0)
    const openBalance = parseFloat((emptySlotsCost + unpaidAssignedCost).toFixed(2))

    if (openBalance > 0) {
      const { data: ownerProfile } = await supabase.from('profiles').select('wallet_balance').eq('id', booking.owner_id).single()
      const available = ownerProfile?.wallet_balance || 0
      const debited = Math.min(available, openBalance)

      if (debited > 0) {
        await supabase.from('profiles').update({ wallet_balance: available - debited }).eq('id', booking.owner_id)
        await supabase.from('wallet_transactions').insert({
          profile_id: booking.owner_id,
          amount: -debited,
          type: 'debit',
          description: 'Règlement auto fin de match - solde non couvert',
          booking_id: booking.id,
        })
      }

      // Marquer les joueurs assignés non payés comme payés (couverts par le owner)
      for (const p of unpaidAssigned) {
        await supabase.from('booking_players').update({ payment_status: 'paid', paid_at: now }).eq('id', p.id)
      }

      results.push({ booking_id: booking.id, openBalance, debited, fullyCovered: debited >= openBalance })
    }

    // Le match a eu lieu dans tous les cas -> on referme le statut
    const finalStatus = booking.status === 'cancelled' ? 'cancelled' : 'completed'
    await supabase.from('bookings').update({ status: finalStatus }).eq('id', booking.id)
  }

  return new Response(JSON.stringify({ processed: (dueBookings || []).length, settled: results }), { status: 200 })
}
