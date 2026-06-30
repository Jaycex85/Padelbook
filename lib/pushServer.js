import webpush from 'web-push'
import { createServiceSupabase } from './supabaseServer'

webpush.setVapidDetails(
  'mailto:admin@mayfairpadelclub.be',
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
)

/**
 * Envoie une push notification à un profil donné.
 * Vérifie les préférences de l'utilisateur avant d'envoyer.
 *
 * @param {string} profileId
 * @param {object} payload { title, body, url, tag }
 * @param {string} prefKey  clé dans notification_preferences (ex: 'booking_confirmed')
 */
export async function sendPushToProfile(profileId, payload, prefKey) {
  const supabase = await createServiceSupabase()

  // Vérifier les préférences si une clé est fournie
  if (prefKey) {
    const { data: prefs } = await supabase
      .from('notification_preferences')
      .select(prefKey)
      .eq('profile_id', profileId)
      .single()

    // Si prefs existe ET que la clé est false → ne pas envoyer
    if (prefs && prefs[prefKey] === false) {
      console.log('[push] skipped, pref disabled', { profileId, prefKey })
      return { sent: 0, skipped: true }
    }
  }

  // Récupérer toutes les subscriptions de ce profil
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('profile_id', profileId)

  console.log('[push] subs found', { profileId, count: subs?.length || 0 })

  if (!subs || subs.length === 0) return { sent: 0 }

  let sent = 0
  const expired = []

  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify({
          title: payload.title || 'Mayfair Padel Club',
          body: payload.body || '',
          url: payload.url || '/',
          tag: payload.tag || 'mayfair',
        })
      )
      // Mettre à jour last_used_at
      await supabase.from('push_subscriptions').update({ last_used_at: new Date().toISOString() }).eq('id', sub.id)
      sent++
    } catch (err) {
      // 410 Gone = subscription expirée → supprimer
      if (err.statusCode === 410 || err.statusCode === 404) {
        expired.push(sub.id)
      } else {
        console.error('[push] sendNotification failed', {
          statusCode: err.statusCode,
          body: err.body,
          message: err.message,
          endpoint: sub.endpoint?.substring(0, 60),
        })
      }
    }
  }

  // Nettoyer les subscriptions expirées
  if (expired.length > 0) {
    await supabase.from('push_subscriptions').delete().in('id', expired)
  }

  return { sent, expired: expired.length }
}

/**
 * Envoie une push à tous les profils ayant une subscription active.
 * Utilisé pour les annonces club.
 */
export async function sendPushToAll(payload, prefKey) {
  const supabase = await createServiceSupabase()

  // Récupérer tous les profils avec au moins une subscription
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('profile_id')

  if (!subs || subs.length === 0) return { sent: 0 }

  const profileIds = [...new Set(subs.map(s => s.profile_id))]
  let totalSent = 0

  for (const profileId of profileIds) {
    const result = await sendPushToProfile(profileId, payload, prefKey)
    totalSent += result.sent || 0
  }

  return { sent: totalSent }
}
