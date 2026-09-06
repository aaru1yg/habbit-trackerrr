/* ============================================================
   DAY CLOCK — where in the day your check-ins actually land.

   A 24-hour dial. Each part of day owns its real clock quadrant
   (night 00–06, morning 06–12, afternoon 12–18, evening 18–24);
   the ARC THICKNESS is the share of check-ins in that band, so
   the shape of your day is readable at a glance. Bands with zero
   check-ins stay a hairline track — absence is shown, not hidden.

   Motion: arcs sweep in from their start hour on first view
   (stroke-dash draw). Reduced motion: full arcs, no sweep.
   ============================================================ */
import AnimateOnView from '../motion/AnimateOnView.jsx'

const BANDS = [
  { id: 'night', label: 'Night', from: 0, to: 6 },
  { id: 'morning', label: 'Morning', from: 6, to: 12 },
  { id: 'afternoon', label: 'Afternoon', from: 12, to: 18 },
  { id: 'evening', label: 'Evening', from: 18, to: 24 },
]

const polar = (cx, cy, r, hour) => {
  const a = ((hour / 24) * 2 * Math.PI) - Math.PI / 2
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)]
}

function arcPath(cx, cy, r, from, to) {
  const [x0, y0] = polar(cx, cy, r, from)
  const [x1, y1] = polar(cx, cy, r, to)
  const large = to - from > 12 ? 1 : 0
  return `M${x0.toFixed(1)} ${y0.toFixed(1)} A${r} ${r} 0 ${large} 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`
}

export default function DayClock({ data, size = 220 }) {
  if (!data?.enough) return null
  const total = data.total
  const share = (id) => (data.parts.find((p) => p.id === id)?.count || 0) / total
  const maxShare = Math.max(...BANDS.map((b) => share(b.id)), 0.0001)
  const C = size / 2
  const R = C - 22

  const aria = `Day clock: ${data.parts.map((p) => `${p.label.toLowerCase()} ${p.pct}%`).join(', ')}. Based on ${total} timestamped check-ins.`

  return (
    <div className="dayclock">
      <AnimateOnView effect="clock-sweep" className="dayclock-dial">
        <svg viewBox={`0 0 ${size} ${size}`} width="100%" role="img" aria-label={aria}>
          {/* hour ticks at 0/6/12/18 */}
          {[0, 6, 12, 18].map((h) => {
            const [x0, y0] = polar(C, C, R + 12, h)
            const [x1, y1] = polar(C, C, R + 6, h)
            const [tx, ty] = polar(C, C, R + 19, h)
            return (
              <g key={h}>
                <line x1={x0} y1={y0} x2={x1} y2={y1} stroke="var(--border-2)" strokeWidth="1" />
                <text x={tx} y={ty + 3} fontSize="9" fill="var(--text-3)" textAnchor="middle">
                  {String(h).padStart(2, '0')}
                </text>
              </g>
            )
          })}
          {BANDS.map((b, i) => {
            const s = share(b.id)
            const w = s === 0 ? 1.5 : 3 + (s / maxShare) * 13
            const d = arcPath(C, C, R, b.from + 0.35, b.to - 0.35)
            return (
              <path
                key={b.id}
                className="dayclock-arc"
                style={{ '--i': i }}
                d={d}
                fill="none"
                stroke={b.id === data.peak ? 'var(--accent-1)' : 'var(--accent-2)'}
                strokeOpacity={s === 0 ? 0.22 : b.id === data.peak ? 0.95 : 0.62}
                strokeWidth={w}
                strokeLinecap="round"
                pathLength={1}
              />
            )
          })}
          <text x={C} y={C - 4} fontSize="20" fontWeight="800" fill="var(--text)" textAnchor="middle" className="tnum">
            {total}
          </text>
          <text x={C} y={C + 12} fontSize="9.5" fill="var(--text-3)" textAnchor="middle">
            timed check-ins
          </text>
        </svg>
      </AnimateOnView>
      <ul className="dayclock-legend" aria-hidden="true">
        {data.parts.map((p) => (
          <li key={p.id}>
            <i className={p.id === data.peak ? 'peak' : ''} />
            <span>{p.label}</span>
            <b className="tnum">{p.count}</b>
            <em className="tnum">{p.pct}%</em>
          </li>
        ))}
      </ul>
    </div>
  )
}
