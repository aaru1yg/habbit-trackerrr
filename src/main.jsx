import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { StoreProvider } from './core/store.jsx'
import { RouterProvider } from './app/router.jsx'
import { ToastHost } from './ui/index.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <StoreProvider>
      <RouterProvider>
        <ToastHost>
          <App />
        </ToastHost>
      </RouterProvider>
    </StoreProvider>
  </React.StrictMode>
)

/* Offline + installable. Production only, so the sandbox preview
   stays fully live-reloadable. */
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  let reg = null
  let reloaded = false
  const update = async () => {
    try {
      reg ||= await navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' })
      await reg.update()
      reg.waiting?.postMessage({ type: 'SKIP_WAITING' })
    } catch {
      /* a failed worker must never break the app */
    }
  }
  window.addEventListener('load', update)
  setInterval(update, 30 * 60 * 1000)
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloaded) return
    reloaded = true
    window.location.reload()
  })
}
