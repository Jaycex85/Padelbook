import { createServerSupabase } from '../../../lib/supabaseServer'
import { sendPushToAll } from '../../../lib/pushServer'

export async function POST(req) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { content, pinned, post_type, options } = await req.json()
  if (!content?.trim()) return new Response(JSON.stringify({ error: 'Contenu requis' }), { status: 400 })

  const isPoll = post_type === 'poll'
  const cleanOptions = isPoll ? (options || []).map(o => o.trim()).filter(Boolean) : []
  if (isPoll && cleanOptions.length < 2) {
    return new Response(JSON.stringify({ error: 'Un sondage nécessite au moins 2 options' }), { status: 400 })
  }

  const { data: post, error } = await supabase.from('club_posts').insert({
    author_id: user.id,
    content: content.trim(),
    pinned: pinned || false,
    post_type: isPoll ? 'poll' : 'text',
  }).select().single()

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 })

  if (isPoll) {
    const rows = cleanOptions.map((label, i) => ({ post_id: post.id, label, sort_order: i }))
    const { error: optError } = await supabase.from('club_poll_options').insert(rows)
    if (optError) return new Response(JSON.stringify({ error: optError.message }), { status: 500 })
  }

  // Push à tous les abonnés
  const preview = content.length > 80 ? content.substring(0, 80) + '...' : content
  await sendPushToAll({
    title: isPoll ? 'Nouveau sondage du club' : 'Nouvelle annonce du club',
    body: preview,
    url: '/',
    tag: 'club-announcement',
  }, 'club_announcement')

  return new Response(JSON.stringify(post), { status: 201 })
}
