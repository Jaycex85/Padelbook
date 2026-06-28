import { createServerSupabase } from '../../../lib/supabaseServer'
import { sendPushToProfile } from '../../../lib/pushServer'

export async function POST(req) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { booking_id, event_id, content } = await req.json()
  if (!content?.trim()) return new Response(JSON.stringify({ error: 'Contenu requis' }), { status: 400 })

  const payload = {
    sender_id: user.id,
    content: content.trim(),
    ...(booking_id ? { booking_id } : { event_id }),
  }

  const { data: msg, error } = await supabase.from('chat_messages').insert(payload).select().single()
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 })

  // Récupérer le nom de l'expéditeur
  const { data: sender } = await supabase.from('profiles').select('first_name, last_name, email').eq('id', user.id).single()
  const senderName = sender?.first_name || sender?.email?.split('@')[0] || "Quelqu'un"

  // Récupérer les participants à notifier (sauf l'expéditeur)
  let participantIds = []

  if (booking_id) {
    const { data: players } = await supabase.from('booking_players').select('player_id').eq('booking_id', booking_id).neq('player_id', user.id)
    participantIds = (players || []).map(p => p.player_id).filter(Boolean)
    // Ajouter le owner
    const { data: booking } = await supabase.from('bookings').select('owner_id').eq('id', booking_id).single()
    if (booking?.owner_id && booking.owner_id !== user.id && !participantIds.includes(booking.owner_id)) {
      participantIds.push(booking.owner_id)
    }
  } else if (event_id) {
    const { data: regs } = await supabase.from('event_registrations').select('player_id').eq('event_id', event_id).eq('status', 'confirmed').neq('player_id', user.id)
    participantIds = (regs || []).map(r => r.player_id).filter(Boolean)
  }

  // Envoyer la push à chaque participant
  const preview = content.length > 60 ? content.substring(0, 60) + '...' : content
  const url = booking_id ? '/my-bookings' : '/events'

  for (const profileId of participantIds) {
    await sendPushToProfile(profileId, {
      title: senderName + ' a ecrit un message',
      body: preview,
      url,
      tag: 'chat-message',
    }, 'chat_message')
  }
  return new Response(JSON.stringify(msg), { status: 201 })
}
