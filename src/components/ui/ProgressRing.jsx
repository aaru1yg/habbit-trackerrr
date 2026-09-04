import { useId } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

/**
 * Progress ring — the app's signature progress element.
 * size px, stroke px, pct 0..100 (null = no data / indeterminate empty).
 */
export default function ProgressRing({ pct, size = 120, stroke = 10, trackClass = 'ring-track', children, label }) {
  const reduced = useReducedMotion()
  const gid = useId()
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
          <linearGradient id={gid} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--accent-1)" />
            <stop offset="100%" stopColor="var(--accent-2)" />
          </linearGradient>
        </defs>
        <circle className={trackClass} cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} />
        {hasData && (
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={`url(#${gid})`}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            initial={false}
            animate={{ strokeDashoffset: c * (1 - clamped / 100) }}
            transition={reduced ? { duration: 0 } : { duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            style={{ filter: 'drop-shadow(0 0 6px var(--accent-soft))' }}
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
