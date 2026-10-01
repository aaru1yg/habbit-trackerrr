/* WebGL + motion capability probe. Lives in its own module so
   importing it never pulls the 3D scene (or three.js) into the
   initial bundle. */
let cached = null

export function webglAvailable() {
  if (cached != null) return cached
  if (typeof window === 'undefined') return false
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return (cached = false)
  // Very small screens get the CSS fallback: a second canvas and
  // a 190 kB download is not worth it on a phone over mobile data.
  if (window.matchMedia?.('(max-width: 480px)').matches) return (cached = false)
  try {
    const c = document.createElement('canvas')
    cached = Boolean(c.getContext('webgl2') || c.getContext('webgl'))
  } catch {
    cached = false
  }
  return cached
}
