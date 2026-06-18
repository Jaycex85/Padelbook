import { createServerSupabase } from '../../../lib/supabaseServer'
import { cookies } from 'next/headers'

export async function GET() {
  const cookieStore = await cookies()
  const allCookies = cookieStore.getAll()

  const supabase = await createServerSupabase()
  const { data: { user }, error } = await supabase.auth.getUser()

  return new Response(JSON.stringify({
    user: user ? { id: user.id, email: user.email } : null,
    error: error?.message || null,
    cookies: allCookies.map(c => ({ name: c.name, length: c.value.length })),
  }, null, 2), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  })
}
