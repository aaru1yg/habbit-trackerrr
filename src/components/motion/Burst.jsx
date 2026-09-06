import { useEffect, useRef, useState } from 'react'
import { prefersReducedMotion, particleBudget } from '../../lib/capability.js'

/* ============================================================
   BURST — a one-shot particle response for meaningful moments.

   Reserved language: a habit completing gets a small, tight
   burst; streak milestones and 100% projects get the full-screen
   celebration elsewhere. Never per-checkbox noise.

   Pure CSS animation on a handful of dots (≤ 14 on high tier,
   ≤ 6 on balanced, none on low / reduced motion). The element
   removes itself when the animation ends.
   ============================================================ */
const COLORS = ['var(--accent-1)', 'var(--accent-2)', 'var(--c3, #34d399)', 'var(--c4, #fbbf24)', 'var(--text)']

export default function Burst({ fire, count = 12, spread = 52, size = 5 }) {
  const [parts, setParts] = useState(null)
  const keyRef = useRef(0)

  useEffect(() => {
    if (!fire) return undefined
    if (prefersReducedMotion()) return undefined
    const budget = particleBudget()
    if (!budget) return undefined
    const n = Math.max(4, Math.round(count * budget))
    keyRef.current += 1
    const seed = keyRef.current
    setParts(
      Array.from({ length: n }, (_, i) => {
        const angle = (Math.PI * 2 * i) / n + (Math.random() - 0.5) * 0.6
        const dist = spread * (0.55 + Math.random() * 0.75)
        return {
          id: `${seed}-${i}`,
          dx: `${Math.round(Math.cos(angle) * dist)}px`,
          dy: `${Math.round(Math.sin(angle) * dist)}px`,
          s: Math.round(size * (0.6 + Math.random() * 0.8)),
          c: COLORS[i % COLORS.length],
          d: `${Math.round(Math.random() * 70)}ms`,
        }
      }),
    )
    const t = setTimeout(() => setParts(null), 900)
    return () => clearTimeout(t)
  }, [fire, count, spread, size])

  if (!parts) return null
  return (
    <span className="burst" aria-hidden="true">
      {parts.map((p) => (
        <i key={p.id} style={{ '--dx': p.dx, '--dy': p.dy, '--s': `${p.s}px`, '--c': p.c, '--d': p.d }} />
      ))}
    </span>
  )
}
