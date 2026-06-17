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
    .select()
    .single()

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  return new Response(JSON.stringify(data), { status: 201 })
}
