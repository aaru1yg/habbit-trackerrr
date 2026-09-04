import React from 'react'
import ReactDOM from 'react-dom/client'
import { StoreProvider } from './store.jsx'
import App from './App.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <StoreProvider>
      <App />
    </StoreProvider>
  </React.StrictMode>
)

// Offline + installable PWA support. Only on the production (hosted) build so
// the sandbox live preview stays fully live-reloadable.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  let swRegistration = null
  let didReload = false

  const updateServiceWorker = async () => {
    try {
      if (!swRegistration) {
        swRegistration = await navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' })
      }
      await swRegistration.update()
      if (swRegistration.waiting) {
        swRegistration.waiting.postMessage({ type: 'SKIP_WAITING' })
      }
    } catch (err) {
      // Ignore SW failures; the app still works without it.
    }
  }

  window.addEventListener('load', updateServiceWorker)

  // Re-check for a new service worker periodically so the app doesn't stay
  // stuck on an old version until the next full visit.
  setInterval(updateServiceWorker, 30 * 60 * 1000)

  // When a new worker takes control, reload once so the current page uses the
  // fresh app shell instead of the stale cached one.
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (didReload) return
    didReload = true
    window.location.reload()
  })
}
