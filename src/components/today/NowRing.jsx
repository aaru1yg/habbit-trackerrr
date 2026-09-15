import { useId } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

/* ------------------------------------------------------------
   NowRing — the signature progress object for the NOW section.

   Thin, crisp, precision instrument. Single solid stroke (no
   rainbow gradient, no glow); tone maps to semantic status via
   existing token variables so consumers can pass an explicit
   entity color OR let a tone pick the semantic accent.

   Props:
     pct         0..100; null => indeterminate / empty track only
     size        diameter in px (default 96 desktop / 72 mobile via CSS)
     stroke      stroke width in px (default 4)
     tone        'accent'|'success'|'warning'|'danger'|'neutral'
     color       explicit entity accent color (overrides tone stroke)
     label       accessible label for the ring
     complete    boolean — render a check mark in the center
     children    optional center content (used only by complete state
                 or future caption needs; keep minimal)
   ------------------------------------------------------------ */
const TONE_VARS = {
  accent:  { stroke: 'var(--accent)',        glow: 'var(--accent-soft)' },
  success: { stroke: 'var(--color-success)', glow: 'var(--color-success-soft)' },
  warning: { stroke: 'var(--color-warning)', glow: 'var(--color-warning-soft)' },
  danger:  { stroke: 'var(--color-danger)',  glow: 'var(--color-danger-soft)' },
  neutral: { stroke: 'var(--text-muted)',    glow: 'transparent' },
}

export default function NowRing({
  pct = null,
  size = 96,
  stroke = 4,
  tone = 'accent',
  color = null,
  label,
  complete = false,
  children,
}) {
  const reduced = useReducedMotion()
  const gid = useId().replace(/:/g, '')
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const hasData = pct != null
  const clamped = hasData ? Math.max(0, Math.min(100, pct)) : 0
  const resolvedTone = TONE_VARS[tone] || TONE_VARS.accent
  const strokeColor = color || resolvedTone.stroke
  const effectivePct = complete ? 100 : clamped
  const dashOffset = c * (1 - effectivePct / 100)

  return (
    <div
      className="now-ring"
      data-tone={tone}
      style={{
        width: size,
        height: size,
        ['--now-ring-color']: strokeColor,
        ['--now-ring-size']: `${size}px`,
        ['--now-ring-stroke']: `${stroke}px`,
        ['--now-ring-pct']: (effectivePct / 100).toFixed(3),
      }}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={hasData || complete ? Math.round(effectivePct) : undefined}
      aria-label={label || (complete ? 'Complete' : hasData ? `${Math.round(effectivePct)} percent complete` : 'Progress')}
    >
      <svg
        viewBox={`0 0 ${size} ${size}`}
        aria-hidden="true"
        className="now-ring__svg"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* track */}
        <circle
          className="now-ring__track"
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
        />
        {/* progress arc */}
        {(hasData || complete) && (
          <motion.circle
            className="now-ring__progress"
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={strokeColor}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            initial={false}
            animate={{ strokeDashoffset: dashOffset }}
            transition={reduced
              ? { duration: 0 }
              : { duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          />
        )}
        {/* subtle terminal dot at the arc's tip for non-complete states with progress */}
        {(hasData && !complete && effectivePct > 5 && effectivePct < 100) && (
          <circle
            className="now-ring__dot"
            cx={size / 2 + r * Math.cos(((effectivePct / 100) * 2 * Math.PI) - Math.PI / 2)}
            cy={size / 2 + r * Math.sin(((effectivePct / 100) * 2 * Math.PI) - Math.PI / 2)}
            r={Math.max(2, stroke / 2 + 0.5)}
            fill={strokeColor}
          />
        )}
      </svg>
      <div className="now-ring__center" aria-hidden="true">
        {complete
          ? <svg className="now-ring__check" width={size * 0.34} height={size * 0.34} viewBox="0 0 24 24" fill="none" stroke={strokeColor} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" focusable="false" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7"/></svg>
          : children}
      </div>
      {/* Suppress unused-id warning; gid kept in case we ever add a gradient */}
      <span style={{ display: 'none' }} data-gid={gid} />
    </div>
  )
}
