/* Aaru Habits — offline-capable service worker.
   Strategy: network-first for the app shell so deployments are picked up
   immediately; cache-first only for immutable hashed build assets and
   same-origin fonts. Old caches are evicted on activate. */
const CACHE = 'aaru-habits-v5'
const CORE = ['./', './index.html', './manifest.webmanifest', './favicon.svg', './icon-192.png', './icon-512.png', './icon-512-maskable.png']

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

self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

self.addEventListener('fetch', (e) => {
  const request = e.request
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return // fonts are bundled locally now

  const isNavigation = request.mode === 'navigate'
  const isIndexHtml = url.pathname === '/' || url.pathname.endsWith('/index.html')
  const isHashedAsset = url.pathname.includes('/assets/')

  // Hashed /assets/* never change — cache-first.
  if (isHashedAsset) {
    e.respondWith(
      caches.match(request).then((cached) =>
        cached ||
        fetch(request).then((res) => {
          if (res && res.ok) {
            const copy = res.clone()
            caches.open(CACHE).then((cache) => cache.put(request, copy))
          }
          return res
        })
      )
    )
    return
  }

  // App shell (index.html / root / manifest / icons / sw.js): network-first,
  // cache fallback when offline. Prevents stale UI after deployments.
  e.respondWith(
    fetch(request).then((res) => {
      if (res && res.ok && (res.type === 'basic' || isNavigation)) {
        const copy = res.clone()
        caches.open(CACHE).then((cache) => cache.put(request, copy))
      }
      return res
    }).catch(() =>
      caches.match(request).then((cached) => {
        if (cached) return cached
        if (isNavigation || isIndexHtml) return caches.match('./index.html')
        return Response.error()
      })
    )
  )
})
