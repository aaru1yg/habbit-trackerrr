import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'framer-motion'

/**
 * Canvas confetti burst. `fire` increments to trigger.
 * Renders nothing (and fires nothing) under prefers-reduced-motion.
 */
export default function Confetti({ fire, count = 130, origin }) {
  const canvasRef = useRef(null)
  const reduced = useReducedMotion()

  useEffect(() => {
    if (!fire || reduced) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext && canvas.getContext('2d')
    if (!ctx) return // no canvas support (e.g. jsdom) — silently skip
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const resize = () => {
      canvas.width = window.innerWidth * dpr
      canvas.height = window.innerHeight * dpr
      canvas.style.width = `${window.innerWidth}px`
      canvas.style.height = `${window.innerHeight}px`
    }
    resize()
    window.addEventListener('resize', resize)

    const colors = ['#6d4aff', '#22d3ee', '#4ade80', '#fbbf24', '#f472b6', '#f3f1ec']
    const cx = (origin?.x ?? 0.5) * canvas.width
    const cy = (origin?.y ?? 0.62) * canvas.height
    const parts = Array.from({ length: count }, () => {
      const angle = Math.random() * Math.PI - Math.PI // upward bias
      const speed = (6 + Math.random() * 9) * dpr
      return {
        x: cx, y: cy,
        vx: Math.cos(angle) * speed * (Math.random() > 0.5 ? 1 : -1) * 0.9,
        vy: Math.sin(angle) * speed - 3 * dpr,
        w: (4 + Math.random() * 4) * dpr,
        h: (6 + Math.random() * 6) * dpr,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.3,
        color: colors[(Math.random() * colors.length) | 0],
      }
    })

    let raf = 0
    const start = performance.now()
    const tick = (now) => {
      const t = (now - start) / 1000
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      let alive = false
      for (const p of parts) {
        p.vy += 0.32 * dpr
        p.vx *= 0.99
        p.x += p.vx
        p.y += p.vy
        p.rot += p.vr
        if (p.y < canvas.height + 40 && t < 3.5) alive = true
        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rot)
        ctx.fillStyle = p.color
        ctx.globalAlpha = Math.max(0, 1 - t / 2.6)
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h)
        ctx.restore()
      }
      if (alive) raf = requestAnimationFrame(tick)
      else ctx.clearRect(0, 0, canvas.width, canvas.height)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [fire, reduced, count, origin])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{ position: 'fixed', inset: 0, zIndex: 85, pointerEvents: 'none' }}
    />
  )
}
