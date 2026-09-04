/* Aaru habit tracker — offline-first service worker */
const CACHE = 'aaru-habits-v1'
const CORE = ['./', './index.html', './manifest.webmanifest', './icon.svg', './icon-192.png', './icon-512.png']

// Install: pre-cache the app shell.
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(CORE)).then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
})

// Fetch: cache-first for app assets, network-first for everything else.
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url)
  if (e.request.method !== 'GET') return

  // The app shell and hashed assets are cached aggressively.
  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.match(e.request).then((cached) => {
        if (cached) return cached
        return fetch(e.request).then((res) => {
          if (res && res.status === 200 && res.type === 'basic') {
            const copy = res.clone()
            caches.open(CACHE).then((cache) => cache.put(e.request, copy))
          }
          return res
        }).catch(() => caches.match('./index.html'))
      })
    )
    return
  }

  // Cross-origin (fonts, etc.): try cache, then network.
  e.respondWith(
    caches.match(e.request).then((cached) => cached || fetch(e.request).then((res) => {
      const copy = res.clone()
      caches.open(CACHE).then((cache) => cache.put(e.request, copy))
      return res
    }).catch(() => cached))
  )
})
