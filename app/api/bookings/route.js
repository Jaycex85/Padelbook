import { createServiceSupabase } from '../../../lib/supabaseServer'

export async function GET(req) {
  const supabase = await createServiceSupabase()
  const { searchParams } = new URL(req.url)
  const courtId = searchParams.get('court_id')
  const date = searchParams.get('date')

  const query = supabase
    .from('bookings')
    .select('*, court:courts(*), owner:profiles(*), players:booking_players(*)')
    .eq('status', 'confirmed')

  if (courtId) query.eq('court_id', courtId)
  if (date) {
    query.gte('starts_at', date + 'T00:00:00')
    query.lte('starts_at', date + 'T23:59:59')
  }

  const { data, error } = await query
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  return new Response(JSON.stringify(data), { status: 200 })
}

export async function POST(req) {
  const supabase = await createServiceSupabase()
  const body = await req.json()

  const { data, error } = await supabase
    .from('bookings')
    .insert(body)
    .select('*, court:courts(name)')
    .single()

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 })

  // Push confirmation au owner
  if (data.owner_id && data.status === 'confirmed') {
    const { sendPushToProfile } = await import('../../../lib/pushServer')
    const fmtDate = d => new Date(d).toLocaleDateString('fr-BE', { weekday: 'long', day: 'numeric', month: 'long' })
    const fmtTime = d => new Date(d).toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit' })
    await sendPushToProfile(data.owner_id, {
      title: 'Reservation confirmee !',
      body: data.court?.name + ' - ' + fmtDate(data.starts_at) + ' ' + fmtTime(data.starts_at),
      url: '/my-bookings',
      tag: 'booking-confirmed',
    }, 'booking_confirmed')
  }

  return new Response(JSON.stringify(data), { status: 201 })
}

// PATCH - mise à jour statut (annulation → déclenche notification terrain libéré)
export async function PATCH(req) {
  const supabase = await createServiceSupabase()
  const { id, status, ...rest } = await req.json()

  if (!id) return new Response(JSON.stringify({ error: 'id requis' }), { status: 400 })

  // Récupérer le booking avant update pour avoir les infos du créneau
  const { data: existing } = await supabase
    .from('bookings')
    .select('*, court:courts(name)')
    .eq('id', id)
    .single()

  const { data, error } = await supabase
    .from('bookings')
    .update({ status, ...rest })
    .eq('id', id)
    .select()
    .single()

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 })

  // Si annulation → vérifier si terrain libéré dans les J+10
  if (status === 'cancelled' && existing) {
    await fetch(process.env.NEXT_PUBLIC_APP_URL + '/api/push/court-available', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        court_id: existing.court_id,
        court_name: existing.court?.name || 'Terrain',
        starts_at: existing.starts_at,
        ends_at: existing.ends_at,
      }),
    })
  }

  return new Response(JSON.stringify(data), { status: 200 })
}

