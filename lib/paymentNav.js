// Navigue vers l'URL de paiement retournée par /api/payments/initiate.
// Le stub interne pointe vers notre propre domaine (/payment/stub) : on
// utilise alors la navigation client Next.js pour ne PAS recharger toute
// l'app (et donc ne pas perdre l'état en mémoire comme le sport actif).
// Pour un vrai provider externe (Mollie), on sort forcément du site — dans
// ce cas précis on mémorise le sport actif de façon TEMPORAIRE (une seule
// lecture, effacée aussitôt) pour le restaurer au retour, sans pour autant
// le persister de façon générale : les autres lancements/refresh continuent
// de redemander le sport comme voulu.
const RETURN_SPORT_KEY = 'pendingReturnSport'

export function goToPaymentUrl(router, paymentUrl, activeSport) {
  try {
    const url = new URL(paymentUrl, window.location.origin)
    if (url.origin === window.location.origin) {
      router.push(url.pathname + url.search)
      return
    }
  } catch (e) {
    // URL invalide/relative inattendue -> fallback ci-dessous
  }
  if (activeSport) {
    try { sessionStorage.setItem(RETURN_SPORT_KEY, activeSport) } catch (e) { /* ignore */ }
  }
  window.location.href = paymentUrl
}

// Appelé une seule fois par SportProvider au montage : restaure le sport
// mémorisé juste avant un départ vers un paiement externe, puis oublie
// aussitôt la valeur (pas de persistance générale).
export function consumePendingReturnSport() {
  try {
    const value = sessionStorage.getItem(RETURN_SPORT_KEY)
    if (value) sessionStorage.removeItem(RETURN_SPORT_KEY)
    return value
  } catch (e) {
    return null
  }
}
