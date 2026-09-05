import React from 'react'
import ReactDOM from 'react-dom/client'
import { StoreProvider } from './store.jsx'
import App from './App.jsx'
import './index.css'
import { BUILD_ID, BUILD_TIME } from './lib/buildInfo.js'

// Production-safe build identity: proves exactly which commit is being served.
// Non-intrusive — window vars + console line only; visible captions live in the
// onboarding footer and Settings → About.
window.__BUILD_ID__ = BUILD_ID
window.__BUILD_TIME__ = BUILD_TIME
if (import.meta.env.PROD) {
  console.info(`[aaru] build ${BUILD_ID} (${BUILD_TIME})`)
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <StoreProvider>
      <App />
    </StoreProvider>
  </React.StrictMode>
)

// Offline + installable PWA support. Registered only on the production
// (hosted) build so the sandbox live preview stays fully live-reloadable.
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
    } catch {
      // SW failures are non-fatal; the app still works without it.
    }
  }

  window.addEventListener('load', updateServiceWorker)

  // Re-check periodically so a deployed update reaches open tabs.
  setInterval(updateServiceWorker, 30 * 60 * 1000)

  // When a new worker takes control, reload once so the page uses the
  // fresh shell instead of a stale cached one.
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (didReload) return
    didReload = true
    window.location.reload()
  })
}
