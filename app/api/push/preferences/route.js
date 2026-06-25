import { createServerSupabase } from '../../../../lib/supabaseServer'

export async function GET(req) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { data } = await supabase.from('notification_preferences')
    .select('*').eq('profile_id', user.id).single()

  // Retourner les valeurs par défaut si pas encore de prefs
  const defaults = {
    booking_confirmed: true, booking_reminder: true,
    chat_message: true, club_announcement: true, spot_available: true,
  }
  return new Response(JSON.stringify(data || defaults), { status: 200 })
}

export async function PATCH(req) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const updates = await req.json()
  const allowed = ['booking_confirmed', 'booking_reminder', 'chat_message', 'club_announcement', 'spot_available']
  const filtered = Object.fromEntries(Object.entries(updates).filter(([k]) => allowed.includes(k)))

  await supabase.from('notification_preferences').upsert(
    { profile_id: user.id, ...filtered },
    { onConflict: 'profile_id' }
  )

  return new Response(JSON.stringify({ ok: true }), { status: 200 })
}
