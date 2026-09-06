import { useEffect, useRef, useState } from 'react'
import { getCapability, prefersReducedMotion } from '../../lib/capability.js'

/* ============================================================
   POINTER LIGHT — the room responds to the cursor (spec §20).

   A single fixed radial highlight follows the pointer at a
   whisper of opacity. Fine pointers only; it fades out when the
   pointer rests or leaves, and never appears for touch or
   reduced-motion users. No custom cursor, no scroll hijack.
   ============================================================ */
export default function PointerLight() {
  const ref = useRef(null)
  const [on, setOn] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    const cap = getCapability()
    if (cap.touch || cap.tier === 'low') return undefined

    let raf = 0
    let idle = 0
    let reduced = prefersReducedMotion()

    const apply = (e) => {
      raf = 0
      const el = ref.current
      if (!el) return
      const x = ((e.clientX / (window.innerWidth || 1)) * 100).toFixed(2)
      const y = ((e.clientY / (window.innerHeight || 1)) * 100).toFixed(2)
      el.style.setProperty('--pointer-x', `${x}%`)
      el.style.setProperty('--pointer-y', `${y}%`)
    }
    const onMove = (e) => {
      if (reduced) return
      if (!raf) raf = requestAnimationFrame(() => apply(e))
      if (!on) setOn(true)
      clearTimeout(idle)
      idle = setTimeout(() => setOn(false), 1400)
    }
    const onLeave = () => setOn(false)
    const offReduced = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    const handler = (e) => { reduced = e.matches; if (reduced) setOn(false) }
    offReduced?.addEventListener?.('change', handler)

    window.addEventListener('pointermove', onMove, { passive: true })
    document.documentElement.addEventListener('pointerleave', onLeave)
    return () => {
      window.removeEventListener('pointermove', onMove)
      document.documentElement.removeEventListener('pointerleave', onLeave)
      offReduced?.removeEventListener?.('change', handler)
      clearTimeout(idle)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [on])

  return <div ref={ref} className="pointer-light" data-pointer={on ? 'on' : 'off'} aria-hidden="true" />
}
