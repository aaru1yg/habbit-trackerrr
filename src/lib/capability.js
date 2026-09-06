/* ============================================================
   CAPABILITY — one honest model of what this device can carry.

   V3 adds real depth, scroll choreography and a WebGL layer.
   None of it may tax a weak device or a reduced-motion user, so
   every expensive primitive asks here first.

   The probe runs once per page load, is SSR/jsdom safe, and never
   throws. Anything unknown degrades to the conservative answer.

   Tiers
     high      rich depth, pointer parallax, WebGL scenes, particles
     balanced  depth + choreography, simplified particles, no WebGL
               ambient scenes on coarse pointers, static WebGL fallback
     low       static composition only (no parallax, no particles,
               poster/fallback art instead of live scenes)
   ============================================================ */

const probe = (() => {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return { webgl: false, tier: 'low', touch: false, cores: 2, memory: 2 }
  }

  const nav = navigator
  const cores = Number.isFinite(nav.hardwareConcurrency) ? nav.hardwareConcurrency : 2
  const memory = Number.isFinite(nav.deviceMemory) ? nav.deviceMemory : 4
  const touch = typeof window.matchMedia === 'function'
    ? window.matchMedia('(pointer: coarse)').matches
    : 'ontouchstart' in window

  let webgl = false
  try {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
    webgl = Boolean(gl)
    // Release the probe context immediately; the real scenes create their own.
    if (gl && gl.getExtension) gl.getExtension('WEBGL_lose_context')?.loseContext()
  } catch {
    webgl = false
  }

  let tier = 'high'
  if (!webgl || cores <= 4 || memory <= 4) tier = 'balanced'
  if (!webgl || cores <= 2 || memory <= 2) tier = 'low'
  // A coarse pointer never gets desktop-grade pointer parallax anyway.
  if (touch && tier === 'high') tier = 'balanced'

  return { webgl, tier, touch, cores, memory }
})()

/** Static snapshot — safe to call during render. */
export const getCapability = () => probe

export const canWebGL = () => probe.webgl
export const isTouch = () => probe.touch
export const deviceTier = () => probe.tier

/** WebGL scenes only earn their cost on capable, fine-pointer devices. */
export const allowsLiveScenes = () => probe.webgl && probe.tier === 'high'

/** Particles: high gets the full field, balanced a reduced one, low none. */
export const particleBudget = () => (probe.tier === 'high' ? 1 : probe.tier === 'balanced' ? 0.4 : 0)

/* ---- live reduced-motion preference ---- */

const query = () => (typeof window !== 'undefined' && typeof window.matchMedia === 'function'
  ? window.matchMedia('(prefers-reduced-motion: reduce)')
  : null)

export const prefersReducedMotion = () => query()?.matches ?? false

/** Subscribe to changes of the reduced-motion preference. */
export function onReducedMotionChange(fn) {
  const mq = query()
  if (!mq) return () => {}
  const handler = (e) => fn(e.matches)
  if (mq.addEventListener) mq.addEventListener('change', handler)
  else mq.addListener(handler)
  return () => {
    if (mq.removeEventListener) mq.removeEventListener('change', handler)
    else mq.removeListener(handler)
  }
}
