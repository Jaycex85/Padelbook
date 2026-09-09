import './globals.css'
import { createServerSupabase } from '../lib/supabaseServer'
import AppShell from '../components/layout/AppShell'
import ServiceWorkerInit from '../components/ServiceWorkerInit'
import { SportProvider } from '../lib/sportContext'

export const metadata = {
  title: 'Mayfair Padel Club',
  description: 'Réservez votre terrain de padel — Mayfair Padel Club',
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.png',
    apple: '/icons/icon-192.png',
  },
}

export default async function RootLayout({ children }) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()

  let profile = null
  if (user) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()
    profile = data
  }

  return (
    <html lang="fr">
      <body>
        <ServiceWorkerInit />
        <SportProvider>
          <AppShell user={user} profile={profile}>
            {children}
          </AppShell>
        </SportProvider>
      </body>
    </html>
  )
}
