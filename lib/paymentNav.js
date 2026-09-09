// Navigue vers l'URL de paiement retournée par /api/payments/initiate.
// Actuellement le stub PayConic pointe vers notre propre domaine (/payment/stub) :
// on utilise alors la navigation client Next.js pour ne PAS recharger toute l'app
// (et donc ne pas perdre l'état en mémoire comme le sport actif de la session).
// Le jour où un vrai provider externe est branché, l'URL sera sur un autre domaine
// et on bascule automatiquement sur une redirection classique (nécessaire pour sortir du site).
export function goToPaymentUrl(router, paymentUrl) {
  try {
    const url = new URL(paymentUrl, window.location.origin)
    if (url.origin === window.location.origin) {
      router.push(url.pathname + url.search)
      return
    }
  } catch (e) {
    // URL invalide/relative inattendue -> fallback ci-dessous
  }
  window.location.href = paymentUrl
}
