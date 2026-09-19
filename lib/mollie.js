import createMollieClient from '@mollie/api-client'

let client = null

export function getMollieClient() {
  if (!client) {
    const apiKey = process.env.MOLLIE_API_KEY
    if (!apiKey) throw new Error('MOLLIE_API_KEY manquant — configure-le dans les variables d\'environnement Vercel')
    client = createMollieClient({ apiKey })
  }
  return client
}
