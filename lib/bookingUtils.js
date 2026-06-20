/**
 * Calcule le prix effectif d'un joueur après remise
 */
export function calcEffectivePrice(basePrice, discountPercent) {
  if (!discountPercent || discountPercent <= 0) return basePrice
  return parseFloat((basePrice * (1 - discountPercent / 100)).toFixed(2))
}

/**
 * Vérifie si un créneau est disponible (non bloqué, non réservé)
 * slots : liste de { starts_at, ends_at } des réservations existantes
 * blocks : liste de { starts_at, ends_at, all_courts, court_id }
 */
export function isSlotAvailable(slotStart, slotEnd, courtId, existingBookings, blocks) {
  const start = new Date(slotStart)
  const end = new Date(slotEnd)

  // Vérifier les blocs
  for (const block of blocks) {
    if (!block.all_courts && block.court_id !== courtId) continue
    const bStart = new Date(block.starts_at)
    const bEnd = new Date(block.ends_at)
    if (start < bEnd && end > bStart) return false
  }

  // Vérifier les réservations existantes
  for (const booking of existingBookings) {
    const bStart = new Date(booking.starts_at)
    const bEnd = new Date(booking.ends_at)
    if (start < bEnd && end > bStart) return false
  }

  return true
}

/**
 * Génère les créneaux disponibles pour un terrain/date donnés
 * à partir de la weekly_schedule, moins les bookings et blocks
 */
export function generateSlots(date, weeklySchedule, existingBookings, blocks, courtId) {
  const d = new Date(date)
  // 0=Dim en JS, on mappe vers 0=Lun
  const jsDay = d.getDay()
  const dayOfWeek = jsDay === 0 ? 6 : jsDay - 1

  const daySlots = weeklySchedule.filter(s => s.day_of_week === dayOfWeek && s.is_active)

  return daySlots.map(slot => {
    const [h, m] = slot.start_time.split(':').map(Number)
    const slotStart = new Date(d)
    slotStart.setHours(h, m, 0, 0)
    const slotEnd = new Date(slotStart)
    slotEnd.setMinutes(slotEnd.getMinutes() + slot.duration_minutes)

    const available = isSlotAvailable(slotStart, slotEnd, courtId, existingBookings, blocks)
    const isPast = slotStart <= new Date()

    return {
      id: slot.id,
      start: slotStart,
      end: slotEnd,
      duration: slot.duration_minutes,
      available: available && !isPast,
      past: isPast,
    }
  }).sort((a, b) => a.start - b.start)
}

/**
 * Évalue les règles d'accès pour un user/créneau donné
 * Retourne true si la réservation est autorisée
 */
export function evaluateAccessRules(rules, userRole, date, time) {
  const d = new Date(date + 'T' + time)
  const jsDay = d.getDay()
  const dayOfWeek = jsDay === 0 ? 6 : jsDay - 1
  const timeStr = time.substring(0, 5)
  const dateStr = date

  // Trier par priorité croissante (dernière règle active gagne)
  const sorted = [...rules].filter(r => r.is_active).sort((a, b) => a.priority - b.priority)

  let result = true // Par défaut autorisé

  for (const rule of sorted) {
    // Vérifier si la règle s'applique à ce user
    if (rule.who !== 'all') {
      if (rule.who === 'member' && userRole !== 'member' && userRole !== 'admin') continue
      if (rule.who === 'public' && userRole !== 'public') continue
    }

    // Vérifier les jours
    if (rule.days_of_week && !rule.days_of_week.includes(dayOfWeek)) continue

    // Vérifier les heures
    if (rule.time_from && rule.time_to) {
      if (timeStr < rule.time_from.substring(0, 5) || timeStr >= rule.time_to.substring(0, 5)) continue
    }

    // Vérifier les dates
    if (rule.date_from && dateStr < rule.date_from) continue
    if (rule.date_to && dateStr > rule.date_to) continue

    // La règle s'applique
    result = rule.effect === 'allow'
  }

  return result
}


/**
 * Vérifie si une réservation doit être auto-confirmée :
 * - le owner a payé en mode 'full'
 * - OU tous les booking_players ont payment_status = 'paid' (mode split/wallet)
 * - le cas 100% remise (effective_price = 0) compte comme "payé" via wallet/split automatique
 * Retourne true si le solde dû restant est à 0.
 */
export function isBookingFullyPaid(booking, players) {
  if (booking.payment_mode === 'full') {
    const owner = players.find(p => p.is_owner)
    return owner ? owner.payment_status === 'paid' : false
  }
  // split ou wallet : tous les joueurs présents doivent avoir payé
  if (!players || players.length === 0) return false
  return players.every(p => p.payment_status === 'paid')
}

/**
 * Marque un booking_player comme payé. Si effective_price est 0 (ex: 100% remise),
 * le paiement est automatiquement considéré comme effectué sans transaction réelle.
 */
export function shouldSkipPayment(effectivePrice) {
  return !effectivePrice || effectivePrice <= 0
}
