import { createServerSupabase } from '../../../../lib/supabaseServer'

export async function POST(req) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { endpoint, p256dh, auth, user_agent } = await req.json()
  if (!endpoint || !p256dh || !auth) {
    return new Response(JSON.stringify({ error: 'Données manquantes' }), { status: 400 })
  }

  // Upsert sur l'endpoint (unique)
  const { error } = await supabase.from('push_subscriptions').upsert({
    profile_id: user.id,
    endpoint,
    p256dh,
    auth,
    user_agent: user_agent || null,
  }, { onConflict: 'endpoint' })

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 })

  // Créer les préférences par défaut si elles n'existent pas encore
  await supabase.from('notification_preferences').upsert(
    { profile_id: user.id },
    { onConflict: 'profile_id', ignoreDuplicates: true }
  )

  return new Response(JSON.stringify({ ok: true }), { status: 200 })
}
