import { useId } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

/**
 * The compact habit-specific progress language. A ring is deliberately a
 * single-day signal: it never pretends to be a long-term percentage when the
 * only truth available is today's check-in.
 */
export default function HabitRing({ done = false, streak = 0, size = 48, label, style }) {
  const reduced = useReducedMotion()
  const id = useId().replace(/:/g, '')
  const stroke = 4
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const pct = done ? 100 : 0

  return (
    <span
      className={`habit-ring${done ? ' is-done' : ''}`}
      style={{ width: size, height: size, '--habit-pct': pct / 100, ...style }}
      role="img"
      aria-label={label || (done ? 'Completed today' : 'Not completed today')}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <defs>
          <linearGradient id={`habit-ring-${id}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--habit-strong, var(--accent-1))" />
            <stop offset="100%" stopColor="var(--habit-color, var(--accent-2))" />
          </linearGradient>
        </defs>
        <circle className="habit-ring-track" cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={stroke} />
        <motion.circle
          className="habit-ring-progress"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={`url(#habit-ring-${id})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={false}
          animate={{ strokeDashoffset: circumference * (1 - pct / 100) }}
          transition={reduced ? { duration: 0 } : { duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      <span className="habit-ring-center" aria-hidden="true">
        {done ? '✓' : <span className="habit-ring-dot" />}
      </span>
      {streak > 1 && <span className="habit-ring-streak tnum" aria-hidden="true">{streak}</span>}
    </span>
  )
}
