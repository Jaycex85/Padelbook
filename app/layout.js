import './globals.css'

export const metadata = {
  title: 'PadelBook — Réservation de terrains',
  description: 'Réservez votre terrain de padel en ligne',
  manifest: '/manifest.json',
}

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  )
}
