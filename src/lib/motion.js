/* ============================================================
   MOTION — one motion language for the whole product.

   Two halves:

   1. Tokens. Springs / durations / staggers as named constants so a
      checkbox, a sheet and a 3D scene all settle with the same
      physics. The CSS side lives in styles/motion.css; these are the
      JS/framer-motion equivalents of the same contract.

   2. interactionFeedback(kind). The single place an interaction
      announces itself (spec §25). Today it dispatches a DOM event a
      future sound module can subscribe to; nothing audible ships.
      Keeping every tap/toggle/unlock funnelled through one function
      means sound, haptics or analytics can be added later without
      touching screens.
   ============================================================ */
import { useEffect, useRef, useState } from 'react'
import { prefersReducedMotion, onReducedMotionChange } from './capability.js'

/* ---- durations (seconds) — mirror of --dur-* ---- */
export const DUR = {
  press: 0.12,
  hover: 0.2,
  sheet: 0.32,
  enter: 0.45,
  hero: 0.62,
  scene: 0.8,
}

/* ---- springs: named, reused everywhere ---- */
export const SPRING = {
  /* button press / release */
  press: { type: 'spring', stiffness: 520, damping: 32, mass: 0.7 },
  /* checkbox + completion pop */
  pop: { type: 'spring', stiffness: 420, damping: 18, mass: 0.9 },
  /* cards settling into place */
  settle: { type: 'spring', stiffness: 260, damping: 28, mass: 1 },
  /* sheets and dialogs arriving with depth */
  sheet: { type: 'spring', stiffness: 340, damping: 32, mass: 1 },
  /* heavy objects (3D scenes) easing, never bouncing */
  glide: { type: 'spring', stiffness: 120, damping: 26, mass: 1.2 },
}

/* ---- entrance choreography ---- */
export const EASE_OUT = [0.22, 1, 0.36, 1]
export const EASE_SPRING = [0.34, 1.42, 0.64, 1]

/** Staggered delay for the i-th item of a group; capped so long lists stay calm. */
export const stagger = (i, step = 0.05, cap = 0.4) => Math.min(i * step, cap)

/* ============================================================
   INTERACTION FEEDBACK
   ============================================================ */

export const FEEDBACK = {
  tap: 'tap',               /* buttons, chips, nav */
  toggle: 'toggle',         /* switches, filters */
  complete: 'complete',     /* habit checked */
  uncomplete: 'uncomplete', /* habit unchecked */
  milestone: 'milestone',   /* streak milestone, project 100% */
  unlock: 'unlock',         /* achievement earned */
  nav: 'nav',               /* screen change */
}

/**
 * Announce an interaction. No-op-safe: if nothing listens, nothing
 * happens. A future audio module would subscribe to 'aaru:feedback'.
 */
export function interactionFeedback(kind, detail = {}) {
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') return
  try {
    window.dispatchEvent(new CustomEvent('aaru:feedback', { detail: { kind, ...detail } }))
  } catch {
    /* CustomEvent unavailable — feedback is optional by design */
  }
}

/* ============================================================
   HOOKS
   ============================================================ */

/** Live prefers-reduced-motion as state (re-renders on change). */
export function useReducedMotionPref() {
  const [reduced, setReduced] = useState(prefersReducedMotion)
  useEffect(() => onReducedMotionChange(setReduced), [])
  return reduced
}

/**
 * Observe an element once; returns [ref, inView].
 * IntersectionObserver where available, immediate truth elsewhere
 * (jsdom, ancient browsers) so content is never stuck hidden.
 */
export function useInViewOnce({ margin = '-12% 0px', threshold = 0.12 } = {}) {
  const ref = useRef(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return undefined
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true)
      return undefined
    }
    // Already on screen at mount? Reveal now — no flash, no wait for a
    // callback the browser would deliver on the next frame anyway.
    if (typeof el.getBoundingClientRect === 'function' && typeof window !== 'undefined') {
      const rect = el.getBoundingClientRect()
      const vh = window.innerHeight || 0
      if (rect.top < vh && rect.bottom > 0) {
        setInView(true)
        return undefined
      }
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setInView(true)
            io.disconnect()
          }
        }
      },
      { rootMargin: margin, threshold },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [margin, threshold])

  return [ref, inView]
}

/**
 * Scroll progress (0..1) of an element travelling through the
 * viewport. rAF-throttled, transform-only consumers. Returns a plain
 * number via callback to avoid re-render storms: subscribe(fn).
 */
export function useScrollProgress(ref) {
  const valueRef = useRef(0)
  const subsRef = useRef(new Set())

  useEffect(() => {
    const el = ref.current
    if (!el || typeof window === 'undefined') return undefined
    let raf = 0
    const compute = () => {
      raf = 0
      const rect = el.getBoundingClientRect()
      const vh = window.innerHeight || 1
      const total = rect.height + vh
      const passed = vh - rect.top
      const p = Math.max(0, Math.min(1, passed / total))
      if (p !== valueRef.current) {
        valueRef.current = p
        subsRef.current.forEach((fn) => fn(p))
      }
    }
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(compute) }
    compute()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [ref])

  const subscribe = useRef((fn) => {
    subsRef.current.add(fn)
    fn(valueRef.current)
    return () => subsRef.current.delete(fn)
  }).current

  return { subscribe, get: () => valueRef.current }
}
