/* ============================================================
   SPATIAL — the camera model for V4 (spec §19).

   One damped, velocity-aware camera per SpatialStage. The rig
   writes ONLY CSS custom properties from a single rAF loop:

     --cam-x / --cam-y   pointer parallax (fine pointers only)
     --cam-scroll        0..1 travel of the stage through the viewport

   React never re-renders for camera motion. The loop idles itself
   to sleep when the target stops changing, the stage leaves the
   viewport, or the tab is hidden — so a background stage costs
   nothing. Everything degrades to a still composition:

     reduced motion → vars pinned at rest
     touch / low    → no pointer parallax (scroll travel stays, gentle)
     jsdom          → no listeners at all, content visible (static)

   Durations live in tokens (--cam-*), springs are named here so
   the camera shares the product's motion language (lib/motion.js).
   ============================================================ */
import { useEffect } from 'react'
import { getCapability, prefersReducedMotion, onReducedMotionChange } from './capability.js'

/* Camera choreography budget — spec §8: fast, never decorative waiting. */
export const CAM = {
  enter: 420,    /* route entrance from depth (ms) */
  focus: 640,    /* gallery / panel focus move */
  travel: 760,   /* long scene-to-scene travel — max allowed */
  /* damping factors per rAF tick (spring-like, non-bouncy) */
  ease: { settle: 0.11, glide: 0.07, quick: 0.18 },
}

/** Should this device get the animated camera at all? */
export const cameraEnabled = () => {
  if (typeof window === 'undefined') return false
  const cap = getCapability()
  if (cap.tier === 'low') return false
  if (prefersReducedMotion()) return false
  return true
}

/** Pointer parallax is a fine-pointer luxury only. */
export const pointerCameraEnabled = () => {
  const cap = getCapability()
  return cameraEnabled() && !cap.touch
}

/**
 * Attach the camera rig to a stage element.
 *
 * opts:
 *   parallax   px ceiling for pointer travel (default 12)
 *   scroll     also write --cam-scroll from the stage's viewport progress
 *   maxTilt    reserved for future 3D tilt stages (unused here; CSS reads it)
 */
export function useCameraRig(stageRef, { parallax = 12, scroll = true } = {}) {
  useEffect(() => {
    const el = stageRef.current
    if (!el || typeof window === 'undefined') return undefined
    if (typeof el.style?.setProperty !== 'function') return undefined
    // Low tier / reduced motion: no rig at all. Custom props stay unset,
    // the static composition in CSS carries the depth.
    if (!cameraEnabled()) return undefined

    let raf = 0
    let running = false
    let onscreen = true
    let hidden = typeof document !== 'undefined' && document.visibilityState === 'hidden'
    let reduced = prefersReducedMotion()

    // targets (what the world asks for) and current (what CSS gets)
    const t = { x: 0, y: 0, s: 0 }
    const c = { x: 0, y: 0, s: 0 }

    const write = () => {
      el.style.setProperty('--cam-x', (c.x * parallax).toFixed(3))
      el.style.setProperty('--cam-y', (c.y * parallax).toFixed(3))
      el.style.setProperty('--cam-scroll', c.s.toFixed(4))
    }

    const settled = () =>
      Math.abs(t.x - c.x) < 0.001 && Math.abs(t.y - c.y) < 0.001 && Math.abs(t.s - c.s) < 0.0005

    const setRest = () => {
      t.x = t.y = t.s = 0
      c.x = c.y = c.s = 0
      el.style.setProperty('--cam-x', '0')
      el.style.setProperty('--cam-y', '0')
      el.style.setProperty('--cam-scroll', '0')
    }

    const ease = CAM.ease.glide
    const step = () => {
      raf = 0
      if (running) {
        c.x += (t.x - c.x) * ease
        c.y += (t.y - c.y) * ease
        c.s += (t.s - c.s) * 0.16
        write()
      }
      if (!running || settled()) {
        running = false
        return
      }
      raf = requestAnimationFrame(step)
    }

    const kick = () => {
      if (reduced || !onscreen || hidden) return
      if (!running) {
        running = true
        if (!raf) raf = requestAnimationFrame(step)
      }
    }

    const clamp01 = (v) => Math.max(0, Math.min(1, v))
    const scrollOf = () => {
      if (!scroll) return
      const rect = el.getBoundingClientRect()
      const vh = window.innerHeight || 1
      // 0 when the stage enters the bottom, 1 when it leaves the top
      const total = rect.height + vh
      t.s = total > 0 ? clamp01((vh - rect.top) / total) : 0
      kick()
    }

    let pointer = null
    if (pointerCameraEnabled()) {
      pointer = (e) => {
        if (reduced) return
        t.x = (e.clientX / (window.innerWidth || 1) - 0.5) * 2
        t.y = (e.clientY / (window.innerHeight || 1) - 0.5) * 2
        kick()
      }
      window.addEventListener('pointermove', pointer, { passive: true })
    }

    const onScroll = () => scrollOf()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll, { passive: true })

    let io = null
    if (typeof IntersectionObserver !== 'undefined') {
      io = new IntersectionObserver(
        (entries) => {
          onscreen = entries.some((en) => en.isIntersecting)
          if (onscreen) { scrollOf(); kick() }
        },
        { rootMargin: '160px' },
      )
      io.observe(el)
    }

    const onVis = () => {
      hidden = document.visibilityState === 'hidden'
      if (!hidden) kick()
      else running = false
    }
    document.addEventListener('visibilitychange', onVis)

    const offReduced = onReducedMotionChange((v) => {
      reduced = v
      if (v) { running = false; setRest() }
      else scrollOf()
    })

    scrollOf()
    kick()

    return () => {
      running = false
      if (raf) cancelAnimationFrame(raf)
      if (pointer) window.removeEventListener('pointermove', pointer)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      document.removeEventListener('visibilitychange', onVis)
      io?.disconnect()
      offReduced()
    }
  }, [stageRef, parallax, scroll])
}

/**
 * Scene presence for WebGL hosts (spec §4): reports whether the host
 * element is on-screen and the tab is visible. Scenes subscribe and
 * pause their own rAF loops; nothing runs behind another tab.
 */
export function scenePresence(el) {
  const state = { onscreen: true, visible: typeof document === 'undefined' ? true : document.visibilityState !== 'hidden' }
  const subs = new Set()
  const fire = () => subs.forEach((fn) => fn(state.onscreen && state.visible))

  let io = null
  if (el && typeof IntersectionObserver !== 'undefined') {
    io = new IntersectionObserver((entries) => {
      state.onscreen = entries.some((en) => en.isIntersecting)
      fire()
    }, { rootMargin: '80px' })
    io.observe(el)
  }
  const onVis = () => {
    state.visible = document.visibilityState !== 'hidden'
    fire()
  }
  document.addEventListener?.('visibilitychange', onVis)

  return {
    live: () => state.onscreen && state.visible,
    subscribe: (fn) => {
      subs.add(fn)
      fn(state.onscreen && state.visible)
      return () => subs.delete(fn)
    },
    dispose: () => {
      io?.disconnect()
      document.removeEventListener?.('visibilitychange', onVis)
      subs.clear()
    },
  }
}

/* ============================================================
   GLOBAL SPATIAL MODE
   One data-attribute on <html> tells the CSS which spatial tier to
   serve: full (high tier), reduced (balanced — no pointer tilt) or
   flat (low tier / reduced motion — depth shown as a still, layered
   composition). Re-evaluated when the motion preference changes.
   ============================================================ */

export function spatialMode() {
  if (typeof document === 'undefined') return 'flat'
  if (prefersReducedMotion()) return 'flat'
  const cap = getCapability()
  if (cap.tier === 'high') return 'full'
  if (cap.tier === 'balanced') return 'reduced'
  return 'flat'
}

/** Apply + keep the mode in sync; returns an unsubscribe. */
export function applySpatialMode() {
  if (typeof document === 'undefined' || !document.documentElement) return () => {}
  const write = () => { document.documentElement.dataset.spatial = spatialMode() }
  write()
  return onReducedMotionChange(write)
}
