/**
 * Génère la liste des dates d'occurrence pour une série récurrente
 * entre series_starts_on et series_ends_on, pour un day_of_week donné.
 * day_of_week : 0=Lundi ... 6=Dimanche
 */
export function generateSeriesDates(seriesStartsOn, seriesEndsOn, dayOfWeek) {
  const dates = []
  const start = new Date(seriesStartsOn + 'T00:00:00')
  const end = new Date(seriesEndsOn + 'T00:00:00')

  // Trouver le premier jour correspondant à dayOfWeek à partir de start
  const current = new Date(start)
  const jsTargetDay = dayOfWeek === 6 ? 0 : dayOfWeek + 1 // notre 0=Lun -> JS 0=Dim

  while (current.getDay() !== jsTargetDay) {
    current.setDate(current.getDate() + 1)
  }

  while (current <= end) {
    dates.push(new Date(current))
    current.setDate(current.getDate() + 7)
  }

  return dates
}

/**
 * Construit le payload complet d'un club_event à partir d'une série + une date d'occurrence
 */
export function buildOccurrencePayload(series, occurrenceDate) {
  const dateStr = occurrenceDate.toISOString().split('T')[0]
  const [startH, startM] = series.start_time.split(':').map(Number)
  const [endH, endM] = series.end_time.split(':').map(Number)

  const startsAt = new Date(occurrenceDate)
  startsAt.setHours(startH, startM, 0, 0)
  const endsAt = new Date(occurrenceDate)
  endsAt.setHours(endH, endM, 0, 0)

  return {
    label: series.label,
    starts_at: startsAt.toISOString(),
    ends_at: endsAt.toISOString(),
    max_players: series.max_players,
    price_per_player: series.price_per_player,
    description: series.description,
    who: series.who,
    cancellation_deadline_hours: series.cancellation_deadline_hours,
    series_id: series.id,
    status: 'active',
  }
}
