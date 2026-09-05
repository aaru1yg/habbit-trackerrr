import { useId } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

/**
 * Progress ring — the app's signature progress element.
 * size px, stroke px, pct 0..100 (null = no data / indeterminate empty).
 * The gradient is deliberately reserved for primary progress moments.
 */
export default function ProgressRing({ pct, size = 120, stroke = 10, trackClass = 'ring-track', children, label }) {
  const reduced = useReducedMotion()
  const gid = useId().replace(/:/g, '')
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const clamped = Math.max(0, Math.min(100, pct ?? 0))
  const hasData = pct != null

  return (
    <div
      className="ring-wrap"
      style={{ width: size, height: size, position: 'relative', flex: 'none' }}
      role="img"
      aria-label={label || `${Math.round(clamped)} percent complete`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
        <defs>
          <linearGradient id={`progress-${gid}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--accent-1)" />
            <stop offset="58%" stopColor="var(--accent-2)" />
            <stop offset="100%" stopColor="var(--v3-pink, var(--accent-1))" />
          </linearGradient>
        </defs>
        <circle className={trackClass} cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} />
        {hasData && (
          <motion.circle
            className="ring-progress"
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={`url(#progress-${gid})`}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            initial={false}
            animate={{ strokeDashoffset: c * (1 - clamped / 100) }}
            transition={reduced ? { duration: 0 } : { duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            style={{ filter: 'drop-shadow(0 0 6px rgba(139, 92, 246, .46))' }}
          />
        )}
      </svg>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'grid',
          placeItems: 'center',
          textAlign: 'center',
        }}
      >
        {children}
      </div>
    </div>
  )
}
