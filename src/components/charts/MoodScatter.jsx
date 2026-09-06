/* ============================================================
   MOOD SCATTER — logged mood vs completion, day by day.

   Every dot is one real day that had BOTH a mood entry and
   scheduled checks. Nothing is imputed. A trend line is drawn
   only when the co-variation clears |r| ≥ 0.3, and it is labelled
   with its strength — the caption always says association, not
   causation.

   Motion: dots pop in staggered; the trend line draws last.
   Reduced motion: everything present, nothing moving.
   ============================================================ */
import { scatterTrend } from '../../lib/analytics.js'
import AnimateOnView from '../motion/AnimateOnView.jsx'

const W = 640
const H = 220
const L = 36
const R = 14
const T = 14
const B = 28

export default function MoodScatter({ data, dimLabel = 'mood' }) {
  if (!data?.enough) return null
  const x = (mood) => L + ((mood - 1) / 4) * (W - L - R)
  const y = (pct) => T + (1 - pct / 100) * (H - T - B)
  const trend = scatterTrend(data)
  const rTxt = data.r == null ? '—' : data.r.toFixed(2)

  return (
    <div className="scatter">
      <AnimateOnView effect="scatter-pop" className="scatter-box">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          role="img"
          aria-label={`Scatter of ${dimLabel} against completion for ${data.n} days. Correlation r equals ${rTxt}.`}
        >
          <g className="chart-frame">
            {[0, 50, 100].map((v) => (
              <g key={v}>
                <line x1={L} y1={y(v)} x2={W - R} y2={y(v)} stroke="var(--grid)" strokeWidth="1" />
                <text x={L - 6} y={y(v) + 3} textAnchor="end" fontSize="10" fill="var(--text-3)" className="tnum">{v}</text>
              </g>
            ))}
            {[1, 2, 3, 4, 5].map((m) => (
              <text key={m} x={x(m)} y={H - 8} textAnchor="middle" fontSize="10" fill="var(--text-3)" className="tnum">
                {m}
              </text>
            ))}
            <text x={(L + W - R) / 2} y={H - 8} textAnchor="middle" fontSize="9" fill="var(--text-3)" dy="10">{dimLabel} →</text>
          </g>
          {trend && (
            <line
              className="scatter-trend"
              x1={x(1)}
              y1={Math.max(T, Math.min(H - B, y(trend.intercept + trend.slope * 1)))}
              x2={x(5)}
              y2={Math.max(T, Math.min(H - B, y(trend.intercept + trend.slope * 5)))}
              stroke="var(--accent-1)"
              strokeWidth="1.8"
              strokeDasharray="5 5"
              pathLength={1}
            />
          )}
          {data.points.map((p, i) => (
            <circle
              key={p.date}
              className="scatter-dot"
              style={{ '--i': i }}
              cx={x(p.mood)}
              cy={y(p.pct)}
              r="3.4"
              fill="var(--accent-2)"
              fillOpacity="0.75"
              stroke="var(--surface-solid)"
              strokeWidth="1"
            >
              <title>{`${p.date} · ${dimLabel} ${p.mood} · ${p.pct}%`}</title>
            </circle>
          ))}
        </svg>
      </AnimateOnView>
      <p className="scatter-caption tiny muted">
        {data.n} days with both a {dimLabel} entry and scheduled checks · r = <b className="tnum">{rTxt}</b>
        {trend ? ` · a ${trend.strength} ${trend.slope >= 0 ? 'upward' : 'downward'} co-variation` : ' · too weak to draw a trend line'}
        {' '}— association, not causation.
      </p>
    </div>
  )
}
