/* ============================================================
   WORLD LAYER — the gated door to the ambient WebGL environment.

   Same discipline as V3's SceneLayer, one level out: fixed behind
   the whole app, mounts only when the device earns it (high tier,
   WebGL, motion allowed), mounts at idle so first paint never
   waits for a shader compile, and disappears completely otherwise
   — the CSS backdrop is a finished atmosphere on its own.
   ============================================================ */
import { lazy, Suspense, useEffect, useState } from 'react'
import { allowsLiveScenes } from '../../lib/capability.js'
import { useReducedMotionPref } from '../../lib/motion.js'

const WorldScene = lazy(() => import('../three/WorldScene.jsx'))

export default function WorldLayer() {
  const reduced = useReducedMotionPref()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!allowsLiveScenes() || reduced) return undefined
    let id = 0
    const mount = () => setReady(true)
    if (typeof window.requestIdleCallback === 'function') {
      id = window.requestIdleCallback(mount, { timeout: 2400 })
    } else {
      id = window.setTimeout(mount, 900)
    }
    return () => {
      if (typeof window.cancelIdleCallback === 'function') window.cancelIdleCallback(id)
      else clearTimeout(id)
    }
  }, [reduced])

  if (!ready || reduced || !allowsLiveScenes()) return null

  return (
    <div className="world-layer" role="presentation">
      <Suspense fallback={null}>
        <WorldScene />
      </Suspense>
    </div>
  )
}
