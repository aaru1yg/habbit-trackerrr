import { lazy, Suspense, useEffect, useState } from 'react'
import { allowsLiveScenes } from '../../lib/capability.js'
import { useReducedMotionPref } from '../../lib/motion.js'

/* The WebGL scene lives in its own chunk; three.js is imported only
   inside ProgressCoreScene.jsx, so none of it reaches the initial
   bundle. Consumers get this gate instead of the scene itself. */
const ProgressCoreScene = lazy(() => import('./ProgressCoreScene.jsx'))

/* ============================================================
   SCENE LAYER — the only door into the WebGL universe.

   Gates: device capability, reduced motion, and an idle delay so
   the first paint is never competing with a shader compile.
   Renders nothing (not even a layout box change) when the gate
   closes — the composition must stand without it.
   ============================================================ */
export default function SceneLayer({ pct, theme, className = '', style, delay = 450 }) {
  const reduced = useReducedMotionPref()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!allowsLiveScenes() || reduced) return undefined
    let id = 0
    const mount = () => setReady(true)
    if (typeof window.requestIdleCallback === 'function') {
      id = window.requestIdleCallback(mount, { timeout: delay + 900 })
    } else {
      id = window.setTimeout(mount, delay)
    }
    return () => {
      if (typeof window.cancelIdleCallback === 'function') window.cancelIdleCallback(id)
      else clearTimeout(id)
    }
  }, [reduced, delay])

  if (!ready || reduced || !allowsLiveScenes()) return null

  return (
    <Suspense fallback={null}>
      <ProgressCoreScene pct={pct} theme={theme} className={className} style={style} />
    </Suspense>
  )
}
