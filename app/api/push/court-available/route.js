import { createServiceSupabase } from '../../../../lib/supabaseServer'
import { sendPushToProfile } from '../../../../lib/pushServer'
import { evaluateAccessRules, checkBookingWindow } from '../../../../lib/bookingUtils'

/**
 * POST /api/push/court-available
 * Appelé quand un créneau de terrain se libère (annulation résa, suppression
 * event/série, suppression bloc ponctuel).
 *
 * body: { court_id, court_name, starts_at, ends_at }
 *
 * Ne notifie QUE les membres qui auraient effectivement le droit de réserver
 * ce créneau précis, selon le moteur de règles d'accès (access_rules) :
 *   - qui peut réserver à ce jour/heure (evaluateAccessRules)
 *   - dans quelle fenêtre de jours à l'avance (checkBookingWindow, par who)
 * Les admins sont exclus (ils ont accès de toute façon, pas besoin de notif).
 */
export async function POST(req) {
  const { court_id, court_name, starts_at, ends_at } = await req.json()

  const slotDate = new Date(starts_at)
  const now = new Date()
  if (slotDate < now) {
    return new Response(JSON.stringify({ skipped: true, reason: 'creneau_passe' }), { status: 200 })
  }

  const supabase = await createServiceSupabase()

  const { data: rules } = await supabase.from('access_rules').select('*').eq('is_active', true)

  // Seuls les profils ayant au moins une subscription push valent la peine d'être évalués
  const { data: subs } = await supabase.from('push_subscriptions').select('profile_id')
  const candidateIds = [...new Set((subs || []).map(s => s.profile_id))]
  if (candidateIds.length === 0) {
    return new Response(JSON.stringify({ ok: true, sent: 0 }), { status: 200 })
  }

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, role, membership_status, membership_valid_until')
    .in('id', candidateIds)

  const dateStr = starts_at.substring(0, 10)
  const timeStr = new Date(starts_at).toTimeString().substring(0, 5)

  const eligibleIds = (profiles || []).filter(p => {
    if (p.role === 'admin') return false // pas besoin de notifier les admins

    const isActiveMember = p.membership_status === 'active' &&
      (!p.membership_valid_until || p.membership_valid_until >= new Date().toISOString().substring(0, 10))
    const userContext = { role: p.role, isActiveMember }

    const accessOk = evaluateAccessRules(rules || [], userContext, dateStr, timeStr)
    if (!accessOk) return false

    const windowCheck = checkBookingWindow(rules || [], userContext, starts_at)
    return windowCheck.allowed
  }).map(p => p.id)

  const tz = { timeZone: 'Europe/Brussels' }
  const fmtDate = d => new Date(d).toLocaleDateString('fr-BE', { weekday: 'long', day: 'numeric', month: 'long', ...tz })
  const fmtTime = d => new Date(d).toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit', ...tz })
  const body = (court_name || 'Un terrain') + ' libre le ' + fmtDate(starts_at) + ' de ' + fmtTime(starts_at) + ' - ' + fmtTime(ends_at)

  let sent = 0
  for (const profileId of eligibleIds) {
    const result = await sendPushToProfile(profileId, {
      title: 'Terrain disponible !',
      body,
      url: '/booking',
      tag: 'court-available',
    }, 'spot_available')
    sent += result.sent || 0
  }

  return new Response(JSON.stringify({ ok: true, eligible: eligibleIds.length, sent }), { status: 200 })
}
