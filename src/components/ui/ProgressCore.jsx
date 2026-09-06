import { useId, useMemo } from 'react'
import AnimatedNumber from './AnimatedNumber.jsx'
import { useReducedMotionPref } from '../../lib/motion.js'

/* ============================================================
   PROGRESS CORE — the signature visual object of Habit OS.

   One reusable representation of 0–100% used by Today, goals,
   projects, assignments, weeks and achievements. Built from SVG
   + CSS so it is crisp, themeable, accessible and works on every
   device; the optional WebGL energy field (ProgressCoreScene)
   layers *behind* it on capable hardware and never replaces it.

   Anatomy (outside → in):
     halo        soft light field, intensity follows progress
     orbit dots  momentum particles, count follows progress
     tick ring   60 ticks, lit up to the current percentage
     arc         the progress stroke (gradient, round caps)
     orb         the core itself — glows brighter as it fills

   Reduced motion: everything renders in its final state; the
   object still reads perfectly as a static composition.
   ============================================================ */
export default function ProgressCore({
  pct,
  size = 168,
  stroke = 10,
  orbit = true,
  caption = null,
  label,
  valueFormat,
  children,
  className = '',
  style,
}) {
  const gid = useId().replace(/:/g, '')
  const reduced = useReducedMotionPref()
  const value = pct == null ? 0 : Math.max(0, Math.min(100, pct))
  const hasData = pct != null

  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const tickR = r - stroke / 2 - 7
  const orbR = Math.max(10, r * 0.34)

  const ticks = useMemo(() => {
    const n = 48
    return Array.from({ length: n }, (_, i) => {
      const a = (i / n) * Math.PI * 2 - Math.PI / 2
      const lit = hasData && i / n <= value / 100
      const inner = tickR - 3.2
      const outer = tickR + 1.6
      return {
        i,
        lit,
        x1: size / 2 + Math.cos(a) * inner,
        y1: size / 2 + Math.sin(a) * inner,
        x2: size / 2 + Math.cos(a) * outer,
        y2: size / 2 + Math.sin(a) * outer,
      }
    })
  }, [value, hasData, size, tickR])

  const dots = useMemo(() => {
    if (!orbit || !hasData) return []
    const n = Math.min(7, 2 + Math.floor(value / 16))
    return Array.from({ length: n }, (_, i) => ({
      i,
      a: `${Math.round((360 / n) * i)}deg`,
      r: `${44 + (i % 3) * 4}%`,
      o: (0.32 + (value / 100) * 0.5).toFixed(2),
      d: `${3 + (i % 3)}px`,
      c: i % 2 ? 'var(--accent-2)' : 'var(--accent-1-lift, var(--accent-1))',
    }))
  }, [orbit, hasData, value])

  return (
    <div
      className={`core-wrap ${className}`.trim()}
      style={{ width: size, height: size, '--pct': (value / 100).toFixed(3), ...style }}
      role="img"
      aria-label={label || (hasData ? `${Math.round(value)} percent complete` : 'No progress yet')}
    >
      <div className={`core-halo${reduced ? '' : ' core-breathe'}`} aria-hidden="true" />

      {dots.length > 0 && !reduced && (
        <div className="core-orbit" aria-hidden="true">
          {dots.map((d) => (
            <i key={d.i} style={{ '--a': d.a, '--r': d.r, '--dot-o': d.o, '--dot': d.d, '--dot-c': d.c }} />
          ))}
        </div>
      )}

      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }} aria-hidden="true">
        <defs>
          <linearGradient id={`core-${gid}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--accent-1)" />
            <stop offset="58%" stopColor="var(--accent-2)" />
            <stop offset="100%" stopColor="var(--c5, var(--accent-1))" />
          </linearGradient>
          <radialGradient id={`orb-${gid}`} cx="38%" cy="34%" r="72%">
            <stop offset="0%" stopColor="var(--accent-1-lift, var(--accent-1))" stopOpacity="0.95" />
            <stop offset="46%" stopColor="var(--accent-1)" stopOpacity="0.62" />
            <stop offset="100%" stopColor="var(--accent-2)" stopOpacity="0.16" />
          </radialGradient>
        </defs>

        {/* tick ring — lit up to progress */}
        <g className="core-ticks" style={{ transform: 'rotate(90deg)', transformOrigin: '50% 50%' }}>
          {ticks.map((t) => (
            <line
              key={t.i}
              x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2}
              stroke={t.lit ? 'var(--accent-2)' : 'var(--track)'}
              strokeWidth={t.lit ? 1.6 : 1}
              strokeLinecap="round"
              opacity={t.lit ? 0.85 : 0.55}
            />
          ))}
        </g>

        {/* track + progress arc */}
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--track)" strokeWidth={stroke} />
        {hasData && (
          <circle
            className="core-arc"
            cx={size / 2} cy={size / 2} r={r}
            fill="none"
            stroke={`url(#core-${gid})`}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - value / 100)}
          />
        )}

        {/* the core */}
        <circle
          className="core-orb"
          cx={size / 2} cy={size / 2} r={orbR}
          fill={`url(#orb-${gid})`}
          opacity={0.34 + (value / 100) * 0.56}
          style={{ transform: 'rotate(90deg)', transformOrigin: '50% 50%' }}
        />
        <circle
          cx={size / 2} cy={size / 2} r={orbR * 0.52}
          fill="var(--bg-deep, var(--bg))"
          opacity="0.55"
          style={{ transform: 'rotate(90deg)', transformOrigin: '50% 50%' }}
        />
      </svg>

      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center' }}>
        {children || (
          <div>
            <div className="core-value" style={{ fontSize: size * 0.2 }}>
              <AnimatedNumber value={value} format={valueFormat || ((v) => `${Math.round(v)}`)} />
              {valueFormat ? null : <span style={{ fontSize: size * 0.11, color: 'var(--text-3)' }}>%</span>}
            </div>
            {caption && <div className="core-caption">{caption}</div>}
          </div>
        )}
      </div>
    </div>
  )
}
