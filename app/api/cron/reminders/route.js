import { createServiceSupabase } from '../../../../lib/supabaseServer'

export async function GET(req) {
  const secret = req.headers.get('authorization')
  if (secret !== 'Bearer ' + process.env.CRON_SECRET) {
    return new Response('Unauthorized', { status: 401 })
  }

  const supabase = await createServiceSupabase()
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const dateStr = tomorrow.toISOString().split('T')[0]

  const { data: bookings, error } = await supabase
    .from('bookings')
    .select('*, owner:profiles(id, first_name, email), court:courts(name)')
    .eq('status', 'confirmed')
    .gte('starts_at', dateStr + 'T00:00:00')
    .lte('starts_at', dateStr + 'T23:59:59')

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 })

  const { sendPushToProfile } = await import('../../../../lib/pushServer')

  let sent = 0
  for (const booking of (bookings || [])) {
    const fmtTime = d => new Date(d).toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit' })
    const result = await sendPushToProfile(booking.owner.id, {
      title: 'Rappel - Demain vous jouez !',
      body: (booking.court?.name || 'Terrain') + ' a ' + fmtTime(booking.starts_at),
      url: '/my-bookings',
      tag: 'booking-reminder',
    }, 'booking_reminder')
    if (result.sent > 0) sent++
  }

  return new Response(JSON.stringify({ sent }), { status: 200 })
}
