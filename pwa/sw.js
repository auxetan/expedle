// Service worker de Méridien : tout le site est mis en cache pour jouer hors ligne.
const CACHE = 'meridien-__VERSION__'
const PRECACHE = __PRECACHE__

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(['./', ...PRECACHE])))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  const fonts = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com'
  if (url.origin !== self.location.origin && !fonts) return

  const store = (response) => {
    if (response.ok || response.type === 'opaque') {
      const copy = response.clone()
      caches.open(CACHE).then((cache) => cache.put(request, copy))
    }
    return response
  }

  // pages : le réseau d'abord pour avoir la dernière version, le cache sinon
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then(store).catch(() => caches.match('./')))
    return
  }
  event.respondWith(caches.match(request).then((hit) => hit || fetch(request).then(store)))
})
