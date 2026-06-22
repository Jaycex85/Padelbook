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
 * Détermine si un profil correspond à la cible 'who' d'une règle.
 * who peut être : 'all' | 'member' | 'public' | 'cotisant'
 * 'cotisant' = statut membership_status actif ET non expiré (indépendant du role applicatif).
 */
function matchesWho(who, userRole, isActiveMember) {
  if (who === 'all') return true
  if (who === 'member') return userRole === 'member' || userRole === 'admin'
  if (who === 'public') return userRole === 'public'
  if (who === 'cotisant') return !!isActiveMember
  return false
}

/**
 * Vérifie si une règle s'applique au contexte temporel donné (jour/heure/date),
 * indépendamment de qui elle cible. Commun aux différents types de vérification.
 */
function ruleMatchesContext(rule, dayOfWeek, timeStr, dateStr) {
  if (rule.days_of_week && !rule.days_of_week.includes(dayOfWeek)) return false
  if (rule.time_from && rule.time_to) {
    if (timeStr < rule.time_from.substring(0, 5) || timeStr >= rule.time_to.substring(0, 5)) return false
  }
  if (rule.date_from && dateStr < rule.date_from) return false
  if (rule.date_to && dateStr > rule.date_to) return false
  return true
}

/**
 * Évalue les règles d'accès allow/deny pour un user/créneau donné.
 * userContext : { role: 'admin'|'member'|'public', isActiveMember: boolean }
 * Retourne true si la réservation est autorisée.
 */
export function evaluateAccessRules(rules, userContext, date, time) {
  const userRole = typeof userContext === 'string' ? userContext : userContext.role
  const isActiveMember = typeof userContext === 'string' ? false : !!userContext.isActiveMember

  const d = new Date(date + 'T' + time)
  const jsDay = d.getDay()
  const dayOfWeek = jsDay === 0 ? 6 : jsDay - 1
  const timeStr = time.substring(0, 5)
  const dateStr = date

  const sorted = [...rules].filter(r => r.is_active).sort((a, b) => a.priority - b.priority)

  let result = true

  for (const rule of sorted) {
    if (!matchesWho(rule.who, userRole, isActiveMember)) continue
    if (!ruleMatchesContext(rule, dayOfWeek, timeStr, dateStr)) continue
    if (rule.effect) result = rule.effect === 'allow'
  }

  return result
}

/**
 * Spécificité d'un who : cotisant > public > all
 * Utilisé pour fenêtre et quota — la règle la plus spécifique gagne,
 * sans que l'admin ait à gérer des priorités manuelles pour ces types.
 */
function whoSpecificity(who) {
  if (who === 'cotisant') return 3
  if (who === 'member') return 2  // rétrocompat ancien rôle
  if (who === 'public') return 1
  return 0 // 'all'
}

/**
 * Vérifie la fenêtre d'ouverture de réservation.
 *
 * Logique "plus spécifique gagne" :
 *   - cotisant > public > all
 *   - Si un membre du club a une règle cotisant (21j) ET une règle all (14j),
 *     c'est la règle cotisant qui s'applique — pas besoin de priorité manuelle.
 *
 * Admin bypass total : toujours autorisé, aucune fenêtre ne s'applique.
 * Retourne { allowed: boolean, daysUntilOpen: number|null, windowDays: number|null }
 */
export function checkBookingWindow(rules, userContext, slotDate) {
  const userRole = typeof userContext === 'string' ? userContext : userContext.role
  const isActiveMember = typeof userContext === 'string' ? false : !!userContext.isActiveMember

  // Admin : bypass total
  if (userRole === 'admin') return { allowed: true, daysUntilOpen: null, windowDays: null }

  // Filtrer les règles de type fenêtre qui s'appliquent à ce profil
  const matching = rules
    .filter(r => r.is_active && r.booking_window_days != null && matchesWho(r.who, userRole, isActiveMember))

  if (matching.length === 0) return { allowed: true, daysUntilOpen: null, windowDays: null }

  // Prendre la règle la plus spécifique (cotisant > public > all)
  const best = matching.reduce((prev, curr) =>
    whoSpecificity(curr.who) > whoSpecificity(prev.who) ? curr : prev
  )

  const now = new Date()
  const slot = new Date(slotDate)
  const daysUntilSlot = Math.ceil((slot - now) / (24 * 3600 * 1000))
  const allowed = daysUntilSlot <= best.booking_window_days

  return {
    allowed,
    daysUntilOpen: allowed ? null : daysUntilSlot - best.booking_window_days,
    windowDays: best.booking_window_days,
  }
}

/**
 * Vérifie le nombre max de réservations actives simultanées en tant qu'owner.
 *
 * Logique "plus spécifique gagne" : même principe que checkBookingWindow.
 * Admin bypass total : toujours autorisé.
 * Retourne { allowed: boolean, max: number|null, current: number }
 */
export function checkMaxConcurrentBookings(rules, userContext, activeOwnerBookingsCount) {
  const userRole = typeof userContext === 'string' ? userContext : userContext.role
  const isActiveMember = typeof userContext === 'string' ? false : !!userContext.isActiveMember

  // Admin : bypass total
  if (userRole === 'admin') return { allowed: true, max: null, current: activeOwnerBookingsCount }

  const matching = rules
    .filter(r => r.is_active && r.max_concurrent_bookings != null && matchesWho(r.who, userRole, isActiveMember))

  if (matching.length === 0) return { allowed: true, max: null, current: activeOwnerBookingsCount }

  const best = matching.reduce((prev, curr) =>
    whoSpecificity(curr.who) > whoSpecificity(prev.who) ? curr : prev
  )

  return {
    allowed: activeOwnerBookingsCount < best.max_concurrent_bookings,
    max: best.max_concurrent_bookings,
    current: activeOwnerBookingsCount,
  }
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


/**
 * Détermine si l'annulation est encore autorisée (délai non dépassé).
 * Passé le délai, seul l'admin peut annuler/supprimer (depuis /admin/bookings).
 */
export function canCancelBooking(booking) {
  if (!booking.cancellation_deadline) return true
  return new Date() <= new Date(booking.cancellation_deadline)
}

/**
 * Calcule le montant total à rembourser sur le wallet pour un ou plusieurs joueurs.
 * Ne rembourse que ce qui a été réellement payé (effective_price si payment_status === 'paid').
 * Le remboursement va TOUJOURS sur le wallet, peu importe le mode de paiement initial.
 */
export function calcRefundAmount(players) {
  return players
    .filter(p => p.payment_status === 'paid')
    .reduce((sum, p) => sum + (parseFloat(p.effective_price) || 0), 0)
}


/**
 * Calcule le solde encore dû sur une réservation.
 *
 * Mode 'full' : un seul payeur (le owner) règle le terrain entier.
 * Les places vides ne sont PAS une dette — ce sont des invités optionnels
 * que le owner peut ajouter gratuitement (il a déjà tout payé).
 * Le solde dû est donc juste : total_price si le owner n'a pas payé, sinon 0.
 *
 * Mode 'split' ou 'wallet' : chaque place (occupée ou vide) représente une part
 * à payer. Le solde dû = part des joueurs non payés + part des places encore vides
 * (car quelqu'un devra payer ces parts pour que le match soit complet).
 *
 * Retourne le montant total dû (0 si tout est couvert).
 */
export function calcOpenBalance(booking, players) {
  const list = players || []

  if (booking.payment_mode === 'full') {
    const owner = list.find(p => p.is_owner)
    if (!owner) return parseFloat(booking.total_price) || 0
    return owner.payment_status === 'paid' ? 0 : (parseFloat(booking.total_price) || 0)
  }

  // split / wallet : places vides + joueurs assignés non payés
  const assignedCount = list.length
  const emptySlots = Math.max(0, (booking.max_players || 4) - assignedCount)
  const emptySlotsCost = emptySlots * (parseFloat(booking.price_per_player) || 0)

  const unpaidAssigned = list
    .filter(p => p.payment_status !== 'paid')
    .reduce((sum, p) => sum + (parseFloat(p.effective_price) || 0), 0)

  return parseFloat((emptySlotsCost + unpaidAssigned).toFixed(2))
}

/**
 * Vérifie si le owner a un solde dû sur un match DÉJÀ TERMINÉ (completed) qui
 * n'a pas pu être couvert automatiquement (wallet insuffisant au moment du cron).
 * C'est uniquement CE cas qui bloque une nouvelle réservation — un match à venir
 * avec des places vides ou des joueurs pas encore payés n'est pas bloquant,
 * le owner a jusqu'à la fin du match pour que ça se résolve (invitation, paiement).
 * bookingsWithPlayers : liste de { booking, players } pour toutes les résas du owner.
 */
export function hasUnpaidBalance(bookingsWithPlayers) {
  return bookingsWithPlayers.some(({ booking, players }) => {
    if (booking.status !== 'completed') return false
    return calcOpenBalance(booking, players) > 0
  })
}
