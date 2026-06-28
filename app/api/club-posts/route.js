import { createServerSupabase } from '../../../lib/supabaseServer'
import { sendPushToAll } from '../../../lib/pushServer'

export async function POST(req) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { content, pinned } = await req.json()
  if (!content?.trim()) return new Response(JSON.stringify({ error: 'Contenu requis' }), { status: 400 })

  const { data: post, error } = await supabase.from('club_posts').insert({
    author_id: user.id,
    content: content.trim(),
    pinned: pinned || false,
  }).select().single()

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 })

  // Push à tous les abonnés
  const preview = content.length > 80 ? content.substring(0, 80) + '...' : content
  await sendPushToAll({
    title: 'Nouvelle annonce du club',
    body: preview,
    url: '/',
    tag: 'club-announcement',
  }, 'club_announcement')

  return new Response(JSON.stringify(post), { status: 201 })
}
