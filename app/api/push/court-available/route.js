import { createServiceSupabase } from '../../../../lib/supabaseServer'
import { sendPushToAll } from '../../../../lib/pushServer'

const MAX_DAYS_AHEAD = 10

/**
 * POST /api/push/court-available
 * Appelé quand un terrain se libère (annulation résa, bloc ou event).
 * body: { court_name, starts_at, ends_at, reason? }
 * N'envoie la notif que si le créneau est dans les 10 jours.
 */
export async function POST(req) {
  const { court_name, starts_at, ends_at, reason } = await req.json()

  const slotDate = new Date(starts_at)
  const now = new Date()
  const daysUntil = Math.ceil((slotDate - now) / (24 * 3600 * 1000))

  // Hors fenêtre J+10 → pas de notification
  if (daysUntil < 0 || daysUntil > MAX_DAYS_AHEAD) {
    return new Response(JSON.stringify({ skipped: true, reason: 'hors_fenetre', daysUntil }), { status: 200 })
  }

  const fmtDate = d => new Date(d).toLocaleDateString('fr-BE', { weekday: 'long', day: 'numeric', month: 'long' })
  const fmtTime = d => new Date(d).toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit' })

  const dateStr = fmtDate(starts_at)
  const timeStr = fmtTime(starts_at) + ' - ' + fmtTime(ends_at)

  let body = court_name + ' libre le ' + dateStr + ' de ' + timeStr

  const result = await sendPushToAll({
    title: 'Terrain disponible !',
    body,
    url: '/booking',
    tag: 'court-available',
  }, 'spot_available')

  return new Response(JSON.stringify({ ok: true, sent: result.sent }), { status: 200 })
}
