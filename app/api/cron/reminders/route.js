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
    .select('*, owner:profiles(*), court:courts(*)')
    .eq('status', 'confirmed')
    .gte('starts_at', dateStr + 'T00:00:00')
    .lte('starts_at', dateStr + 'T23:59:59')

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 })

  // TODO: envoyer les emails de rappel
  console.log('Reminders to send:', bookings.length)

  return new Response(JSON.stringify({ sent: bookings.length }), { status: 200 })
}
