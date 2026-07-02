// Mayfair Padel Club — Service Worker
const CACHE_NAME = 'mayfair-v1'

self.addEventListener('install', e => {
  self.skipWaiting()
})

self.addEventListener('activate', e => {
  e.waitUntil(clients.claim())
})

// Gestion des push events
self.addEventListener('push', e => {
  if (!e.data) return
  const data = e.data.json()
  const options = {
    body: data.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-96.png',
    tag: data.tag || 'mayfair',
    renotify: true,
    data: { url: data.url || '/' },
    actions: data.actions || [],
  }
  e.waitUntil(self.registration.showNotification(data.title || 'Mayfair Padel Club', options))
})

// Clic sur la notification → ouvrir l'URL
self.addEventListener('notificationclick', e => {
  e.notification.close()
  const url = e.notification.data?.url || '/'
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url)
          return client.focus()
        }
      }
      return clients.openWindow(url)
    })
  )
})
