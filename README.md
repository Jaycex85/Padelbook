# PadelBook

PWA de gestion et réservation de terrains de padel.

## Stack
- **Next.js 15** App Router
- **Supabase** (Auth + DB + RLS)
- **Tailwind CSS**
- **Vercel** (hosting + cron jobs)
- **PayConic** (paiements)

## Structure
\`\`\`
app/
  (auth)/login/        # Connexion
  (auth)/register/     # Inscription
  admin/               # Dashboard admin (protégé)
  booking/             # Page de réservation publique
  api/
    bookings/          # CRUD réservations
    payments/webhook/  # Webhook PayConic
    cron/reminders/    # Rappels J-1
lib/
  supabase.js          # Client browser
  supabaseServer.js    # Client server + service role
  constants.js         # Constantes partagées
middleware.js          # Protection des routes
\`\`\`

## Démarrage local
\`\`\`bash
npm install
cp .env.example .env.local
# Remplir .env.local avec vos clés
npm run dev
\`\`\`

## Variables d'environnement
Voir `.env.example`
