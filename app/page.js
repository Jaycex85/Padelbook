import { createServerSupabase } from '../lib/supabaseServer'
import ClubFeed from '../components/ClubFeed'
import CourtsGrid from '../components/CourtsGrid'
import NextEventBanner from '../components/NextEventBanner'
import HomeHero from '../components/HomeHero'
import HomeGreeting from '../components/HomeGreeting'
import HomeQuickLinks from '../components/HomeQuickLinks'

export default async function HomePage() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: courts } = await supabase.from('courts').select('*').eq('status', 'active').order('sort_order')

  let profile = null
  if (user) {
    const { data: p } = await supabase.from('profiles').select('role, first_name').eq('id', user.id).single()
    profile = p
  }

  if (!user) {
    return <HomeHero courts={courts} />
  }

  // Prochains événements à venir — on en récupère plusieurs pour pouvoir
  // trouver le premier qui correspond au sport actif de la session (côté client).
  const now = new Date().toISOString()
  const { data: nextEvents } = await supabase
    .from('club_events')
    .select('*, club_event_courts(courts(name)), event_registrations(id, status)')
    .eq('status', 'active')
    .gte('ends_at', now)
    .order('starts_at')
    .limit(20)

  const nextEvent = nextEvents && nextEvents[0]
  const fmtEventDate = d => new Date(d).toLocaleDateString('fr-BE', { weekday: 'long', day: 'numeric', month: 'long' })
  const fmtEventTime = d => new Date(d).toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit' })

  return (
    <div>
      <HomeGreeting firstName={profile?.first_name} />

      {/* Prochain Club Event en avant si présent, filtré par sport côté client */}
      {nextEvents && nextEvents.length > 0 && <NextEventBanner events={nextEvents} />}

      <ClubFeed isAdmin={profile?.role === 'admin'} userId={user.id} />

      <HomeQuickLinks />

      {courts && courts.length > 0 && <CourtsGrid courts={courts} />}
    </div>
  )
}
