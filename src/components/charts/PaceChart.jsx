/* ============================================================
   PACE CHART — expected vs actual progress, told with motion.

   The dashed line is the promise (the goal's own calendar window);
   the filled area is what actually happened, recomputed day by day
   from real evidence. Where a day has no honest value the line
   breaks instead of guessing.

   On first entry: frame → area grows → line draws → dots pop →
   labels settle. After that it is a static, readable chart with
   hover/touch inspection. Reduced motion shows the final chart.
   ============================================================ */
import { useId, useMemo, useState } from 'react'
import { shortDate } from '../../lib/dates.js'
import AnimateOnView from '../motion/AnimateOnView.jsx'

const TNUM = { fontVariantNumeric: 'tabular-nums' }

export default function PaceChart({ actual, expected = null, height = 190, ariaLabel }) {
  const gid = useId().replace(/:/g, '')
  const [sel, setSel] = useState(null)
  const W = 640
  const H = height
  const L = 34
  const R = 12
  const T = 12
  const B = 24

  const days = actual?.map((r) => r.day) || []
  const n = days.length

  const geom = useMemo(() => {
    const x = (i) => (n <= 1 ? (L + W - R) / 2 : L + (i / (n - 1)) * (W - L - R))
    const y = (v) => T + (1 - v / 100) * (H - T - B)
    const solid = (actual || []).map((r, i) => ({ ...r, i, x: x(i), y: r.pct == null ? null : y(r.pct) }))
    const known = solid.filter((p) => p.y != null)
    let d = ''
    known.forEach((p, k) => { d += (k === 0 ? 'M' : 'L') + p.x.toFixed(1) + ' ' + p.y.toFixed(1) })
    let area = ''
    if (known.length > 1) {
      area = `M${known[0].x.toFixed(1)} ${y(0).toFixed(1)}`
      known.forEach((p) => { area += `L${p.x.toFixed(1)} ${p.y.toFixed(1)}` })
      area += `L${known[known.length - 1].x.toFixed(1)} ${y(0).toFixed(1)}Z`
    }
    const exp = (expected || []).map((r, i) => ({ ...r, i, x: x(i), y: y(r.pct) }))
    let ed = ''
    exp.forEach((p, k) => { ed += (k === 0 ? 'M' : 'L') + p.x.toFixed(1) + ' ' + p.y.toFixed(1) })
    return { x, y, solid, known, d, area, ed }
  }, [actual, expected, n, H])

  if (!n || geom.known.length === 0) {
    return (
      <p style={{ color: 'var(--text-3)', fontSize: 'var(--fs-sm)', padding: '12px 0' }}>
        Not enough real progress yet to draw a pace line.
      </p>
    )
  }

  const xIdx = n <= 4 ? days.map((_, i) => i)
    : Array.from({ length: 4 }, (_, k) => Math.round((k * (n - 1)) / 3))
  const label = ariaLabel
    || `Expected versus actual progress over ${n} days. Latest actual ${geom.known[geom.known.length - 1].pct} percent.`

  const dotStep = n > 20 ? 3 : n > 12 ? 2 : 1
  const selRow = sel != null ? actual[sel] : null

  return (
    <AnimateOnView effect="chart-draw" className="trend-chart">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={label} onMouseLeave={() => setSel(null)}>
        <defs>
          <linearGradient id={`pace-${gid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent-1)" stopOpacity="0.34" />
            <stop offset="100%" stopColor="var(--accent-2)" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        <g className="chart-frame">
          {[0, 50, 100].map((v) => (
            <g key={v}>
              <line x1={L} y1={geom.y(v)} x2={W - R} y2={geom.y(v)} stroke="var(--grid)" strokeWidth="1" />
              <text x={L - 6} y={geom.y(v) + 3} textAnchor="end" fontSize="10" fill="var(--text-3)" style={TNUM}>{v}</text>
            </g>
          ))}
          {xIdx.filter((i) => days[i]).map((i) => (
            <text
              key={i}
              className="chart-label"
              x={i === 0 ? L : i === n - 1 ? W - R : geom.x(i)}
              y={H - 6}
              textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}
              fontSize="10"
              fill="var(--text-3)"
            >
              {shortDate(days[i])}
            </text>
          ))}
        </g>

        {geom.area && <path className="chart-area" d={geom.area} fill={`url(#pace-${gid})`} stroke="none" />}

        {expected && geom.ed && (
          <path
            className="chart-fade"
            d={geom.ed}
            fill="none"
            stroke="var(--text-3)"
            strokeWidth="1.6"
            strokeDasharray="4 5"
          />
        )}

        {geom.d && (
          <path
            className="chart-line"
            d={geom.d}
            fill="none"
            stroke="var(--accent-2)"
            strokeWidth="2.4"
            strokeLinejoin="round"
            strokeLinecap="round"
            pathLength={1}
            style={{ '--len': 1 }}
          />
        )}

        {geom.known.filter((_, k) => k % dotStep === 0 || k === geom.known.length - 1).map((p, k) => (
          <circle
            key={p.i}
            className="chart-dot"
            style={{ '--i': k }}
            cx={p.x}
            cy={p.y}
            r={sel === p.i ? 4.2 : 2.4}
            fill={sel === p.i ? 'var(--accent-2)' : 'var(--surface-solid)'}
            stroke="var(--accent-2)"
            strokeWidth="1.6"
          />
        ))}

        {sel != null && (
          <line x1={geom.x(sel)} y1={T} x2={geom.x(sel)} y2={H - B} stroke="var(--border-2)" strokeWidth="1" strokeDasharray="3 3" />
        )}

        {days.map((d, i) => (
          <rect
            key={d}
            x={geom.x(i) - (W - L - R) / Math.max(1, n) / 2}
            y={T}
            width={(W - L - R) / Math.max(1, n)}
            height={H - T - B}
            fill="transparent"
            onPointerEnter={() => setSel(i)}
            onClick={() => setSel(sel === i ? null : i)}
          />
        ))}

        {selRow && (
          <g pointerEvents="none" transform={`translate(${Math.min(Math.max(geom.x(sel), L + 8), W - R - 158)}, ${T + 2})`}>
            <rect width="158" height={expected ? 54 : 40} rx="9" fill="var(--surface-solid)" stroke="var(--border-2)" />
            <text x="9" y="14" fontSize="10.5" fontWeight="700" fill="var(--text)">{shortDate(selRow.day)}</text>
            <text x="9" y="28" fontSize="10.5" fill="var(--text-2)" style={TNUM}>
              actual: {selRow.pct == null ? '—' : `${selRow.pct}%`}
            </text>
            {expected && (
              <text x="9" y="42" fontSize="10.5" fill="var(--text-3)" style={TNUM}>
                expected: {expected[sel] ? `${expected[sel].pct}%` : '—'}
              </text>
            )}
          </g>
        )}
      </svg>
    </AnimateOnView>
  )
}
