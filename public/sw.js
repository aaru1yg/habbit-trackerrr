/* Aaru habit tracker — offline-first service worker */
const CACHE = 'aaru-habits-v3'
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

// Let clients ask a waiting worker to skip waiting and activate immediately.
self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

// Fetch: network-first for the document/app-shell, cache-first only for
// immutable hashed build assets under /assets/. Everything else same-origin
// is network-first with a cache fallback for offline use.
self.addEventListener('fetch', (e) => {
  const request = e.request
  if (request.method !== 'GET') return

  const url = new URL(request.url)

  // Cross-origin (fonts, etc.): try cache, then network.
  if (url.origin !== self.location.origin) {
    e.respondWith(
      caches.match(request).then((cached) => cached || fetch(request).then((res) => {
        const copy = res.clone()
        caches.open(CACHE).then((cache) => cache.put(request, copy))
        return res
      }).catch(() => cached))
    )
    return
  }

  const isNavigation = request.mode === 'navigate'
  const isIndexHtml = url.pathname === '/' || url.pathname.endsWith('/index.html')
  const isHashedAsset = url.pathname.includes('/assets/')

  // Hashed /assets/* files never change — cache-first.
  if (isHashedAsset) {
    e.respondWith(
      caches.match(request).then((cached) =>
        cached || fetch(request).then((res) => {
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
  // fall back to the cache when offline. This prevents stale index.html.
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
