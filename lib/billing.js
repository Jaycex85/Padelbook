// Enregistre un élément facturable dans le registre unifié (billable_events),
// utilisé pour les rapports financiers (revenus par sport, par catégorie...).
// Appelé à chaque fois qu'un paiement est réellement finalisé — que ce soit
// par wallet (débit immédiat) ou par carte (confirmation sur /payment/stub).
export async function logBillableEvent(supabase, {
  profileId, category, sport, amount, paymentMethod, description,
  bookingId, bookingPlayerId, membershipRequestId, eventRegistrationId,
}) {
  if (!amount || amount <= 0) return // rien à loguer pour du 100% gratuit
  await supabase.from('billable_events').insert({
    profile_id: profileId,
    category,
    sport: sport || null,
    amount,
    payment_method: paymentMethod,
    description: description || null,
    booking_id: bookingId || null,
    booking_player_id: bookingPlayerId || null,
    membership_request_id: membershipRequestId || null,
    event_registration_id: eventRegistrationId || null,
  })
}
