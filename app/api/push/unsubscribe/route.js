import { createServerSupabase } from '../../../../lib/supabaseServer'

export async function POST(req) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { endpoint } = await req.json()
  if (!endpoint) return new Response(JSON.stringify({ error: 'endpoint manquant' }), { status: 400 })

  await supabase.from('push_subscriptions').delete()
    .eq('profile_id', user.id).eq('endpoint', endpoint)

  return new Response(JSON.stringify({ ok: true }), { status: 200 })
}
