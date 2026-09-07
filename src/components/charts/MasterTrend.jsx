/* ============================================================
   MASTER TREND — the signature chart. Every habit's momentum on
   one canvas over a chosen window (7D → ALL), each line wearing
   the habit's own colour, with honest eligibility rules, hover
   isolation (rest dims) and a tap-to-hide legend. Same SVG
   language as the rest of the chart kit: real dates, real
   values, theme tokens, no chart junk.
   ============================================================ */
import { useMemo, useRef, useState } from 'react'
import { todayStr, subDaysStr, daysBetween, shortDate } from '../../lib/dates.js'
import { activeHabits, rollingSeries, scheduledIn } from '../../lib/stats.js'
import { categoryOf } from '../../lib/schedule.js'
import SectionCard, { CardHead } from '../ui/SectionCard.jsx'
import { Link } from '../../lib/router.jsx'
import { IconEye, IconEyeOff, IconChevronRight } from '../../lib/icons.jsx'

const RANGES = [
  { id: '7d', label: '7D', aria: 'last 7 days', days: 7 },
  { id: '30d', label: '30D', aria: 'last 30 days', days: 30 },
  { id: '90d', label: '90D', aria: 'last 90 days', days: 90 },
  { id: '6m', label: '6M', aria: 'last 6 months', days: 182 },
  { id: '1y', label: '1Y', aria: 'last 12 months', days: 365 },
  { id: 'all', label: 'ALL', aria: 'all history', days: null },
]
const MAX_SERIES = 8
const W = 640
const H = 250
const L = 38
const R = 12
const T = 12
const B = 24
const TNUM = { fontVariantNumeric: 'tabular-nums' }

const truncate = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)

/** Consecutive non-null runs → separate path segments (no bridging gaps). */
function segmentsOf(points, x, y) {
  const segs = []
  let cur = null
  for (let i = 0; i < points.length; i++) {
    const p = points[i]
    if (p.value == null) {
      cur = null
      continue
    }
    if (!cur) {
      cur = { d: `M${x(i).toFixed(1)} ${y(p.value).toFixed(1)}`, first: i }
      segs.push(cur)
    } else {
      cur.d += `L${x(i).toFixed(1)} ${y(p.value).toFixed(1)}`
    }
  }
  return segs
}

export default function MasterTrend({ state }) {
  const [rangeId, setRangeId] = useState('30d')
  const [hidden, setHidden] = useState([]) // habit ids switched off in the legend
  const [hoverId, setHoverId] = useState(null)
  const [sel, setSel] = useState(null) // hovered/pinned day index
  const svgRef = useRef(null)

  const model = useMemo(() => {
    const habits = activeHabits(state)
    const today = todayStr()
    const range = RANGES.find((r) => r.id === rangeId)
    let days = range.days
    if (days == null) {
      let earliest = today
      for (const h of habits) if (h.createdAt && h.createdAt < earliest) earliest = h.createdAt
      days = Math.max(7, daysBetween(earliest, today) + 1)
    }
    const dates = Array.from({ length: days }, (_, i) => subDaysStr(today, days - 1 - i))
    // A line is only drawn once a habit has a fair number of scheduled
    // days inside the window — it scales with the range so a weekly
    // habit isn't excluded from a 90-day view.
    const need = days <= 7 ? 3 : Math.max(4, Math.ceil(days * 0.08))
    const qualified = []
    for (const habit of habits) {
      const scheduled = scheduledIn(state, habit, dates)
      if (scheduled < need) continue
      qualified.push({ habit, scheduled, points: rollingSeries(state, habit, dates) })
    }
    qualified.sort((a, b) => b.scheduled - a.scheduled || (a.habit.order ?? 0) - (b.habit.order ?? 0))
    const shown = qualified.slice(0, MAX_SERIES)
    return {
      today,
      range,
      dates,
      need,
      totalHabits: habits.length,
      tooFew: habits.length - qualified.length,
      overflow: Math.max(0, qualified.length - MAX_SERIES),
      shown: shown.map(({ habit, scheduled, points }) => {
        const cat = categoryOf(habit.category)
        let latest = null
        for (let i = points.length - 1; i >= 0; i--) {
          if (points[i].value != null) {
            latest = { value: points[i].value, date: points[i].date }
            break
          }
        }
        return {
          id: habit.id,
          full: habit.name,
          label: truncate(habit.name, 16),
          scheduled,
          color: `var(${cat.cssVar})`,
          points,
          latest: latest ? latest.value : null,
          latestDate: latest ? latest.date : null,
        }
      }),
    }
  }, [state, rangeId])

  const dates = model.dates
  const n = dates.length
  const visible = model.shown.filter((s) => !hidden.includes(s.id))
  const x = (i) => (n <= 1 ? (L + W - R) / 2 : L + (i / (n - 1)) * (W - L - R))
  const y = (v) => T + (1 - v / 100) * (H - T - B)
  const showPoints = n <= 61

  const idxFromEvent = (e) => {
    const el = svgRef.current
    if (!el) return null
    const rect = el.getBoundingClientRect()
    if (!rect.width) return null
    const px = ((e.clientX - rect.left) / rect.width) * W
    if (px < L || px > W - R) return null
    return Math.max(0, Math.min(n - 1, Math.round(((px - L) / (W - R - L)) * (n - 1))))
  }

  const xTicks = n <= 12
    ? dates.map((_, i) => i)
    : Array.from({ length: 5 }, (_, k) => Math.round((k * (n - 1)) / 4))

  const caption = model.range.days == null
    ? `${n} days of history`
    : model.range.aria

  const rangeLabel = model.range.days == null ? `${n} days` : model.range.aria

  const aria = `Habit completion over ${rangeLabel}, one line per habit, 7-day rolling. ${
    visible.map((s) => `${s.full}: ${s.latest == null ? 'no completed week yet' : `${s.latest}% as of ${shortDate(s.latestDate)}`}`).join('. ')
  }.`

  const toggle = (s) => {
    const off = hidden.includes(s.id)
    setHidden(off ? hidden.filter((id) => id !== s.id) : [...hidden, s.id])
    if (!off && hoverId === s.id) setHoverId(null)
  }

  return (
    <SectionCard className="pad today-master">
      <CardHead title="Habit trends">
        <span className="tiny muted">{`7-day rolling · ${caption}`}</span>
      </CardHead>

      <div className="seg seg-wide mt-seg" role="group" aria-label="Trend range">
        {RANGES.map((r) => (
          <button
            key={r.id}
            type="button"
            className={`seg-btn${rangeId === r.id ? ' active' : ''}`}
            aria-pressed={rangeId === r.id}
            onClick={() => { setRangeId(r.id); setSel(null) }}
          >
            {r.label}
          </button>
        ))}
      </div>

      {model.totalHabits === 0 ? (
        <p className="empty-note">
          Add a habit first — once you start checking in, each habit gets a momentum line here.
        </p>
      ) : model.shown.length === 0 ? (
        <p className="empty-note">
          {`Momentum lines need at least ${model.need} scheduled days in this window before they're fair to draw, and none of your habits qualify yet. Try a longer range above or keep checking in — nothing here is estimated.`}
        </p>
      ) : visible.length === 0 ? (
        <p className="empty-note">
          All habit lines are switched off — use the eye buttons below to bring them back.
        </p>
      ) : (
        <>
          <div className="trend-chart mt-chart">
            <svg
              ref={svgRef}
              viewBox={`0 0 ${W} ${H}`}
              width="100%"
              role="img"
              aria-label={aria}
              onPointerMove={(e) => { const i = idxFromEvent(e); if (i != null) setSel(i) }}
              onClick={(e) => {
                const i = idxFromEvent(e)
                if (i != null) setSel((cur) => (cur === i ? null : i))
              }}
              onPointerLeave={() => { setSel(null); setHoverId(null) }}
            >
              {/* grid + y labels */}
              {[0, 50, 100].map((v) => (
                <g key={v}>
                  <line x1={L} y1={y(v)} x2={W - R} y2={y(v)} stroke="var(--border)" strokeWidth="1" />
                  <text x={L - 6} y={y(v) + 3} textAnchor="end" fontSize="12.5" fill="var(--text-3)" style={TNUM}>{v}</text>
                </g>
              ))}
              {xTicks.map((i) => (
                <text key={i} x={x(i)} y={H - 6} textAnchor="middle" fontSize="12.5" fill="var(--text-3)" style={TNUM}>
                  {shortDate(dates[i])}
                </text>
              ))}

              {/* crosshair on the hovered/pinned day */}
              {sel != null && (
                <line x1={x(sel)} y1={T} x2={x(sel)} y2={H - B} stroke="var(--border-2)" strokeWidth="1" strokeDasharray="3 3" />
              )}

              {/* one path per habit, split at gaps */}
              {visible.map((s) => {
                const emphasized = hoverId === s.id
                const dimmed = hoverId != null && !emphasized
                const width = emphasized ? 3 : dimmed ? 1.4 : 2
                const opacity = dimmed ? 0.12 : 1
                return (
                  <g key={s.id} opacity={opacity}>
                    {segmentsOf(s.points, x, y).map((seg, k) => (
                      <path key={k} d={seg.d} fill="none" stroke={s.color} strokeWidth={width}
                        strokeLinejoin="round" strokeLinecap="round" />
                    ))}
                    {showPoints && s.points.map((p, i) =>
                      p.value == null ? null : (
                        <circle key={i} cx={x(i)} cy={y(p.value)} r={emphasized ? 4 : 2.2}
                          fill={emphasized ? s.color : 'var(--surface-solid)'} stroke={s.color} strokeWidth="1.6"
                          pointerEvents="none" />
                      )
                    )}
                    {/* invisible fat stroke: hover to isolate this habit */}
                    {segmentsOf(s.points, x, y).map((seg, k) => (
                      <path key={`h${k}`} d={seg.d} fill="none" stroke="transparent" strokeWidth="18"
                        pointerEvents="stroke"
                        onPointerEnter={() => setHoverId(s.id)}
                        onPointerLeave={() => setHoverId((cur) => (cur === s.id ? null : cur))} />
                    ))}
                  </g>
                )
              })}

              {/* day readout */}
              {sel != null && (
                <g pointerEvents="none" transform={`translate(${Math.min(Math.max(x(sel), L + 8), W - R - 172)}, ${T + 2})`}>
                  <rect width="172" height={36 + visible.length * 17} rx="9" fill="var(--surface-solid)" stroke="var(--border-2)" />
                  <text x="9" y="16" fontSize="12.5" fontWeight="700" fill="var(--text)">{shortDate(dates[sel])}</text>
                  {visible.map((s, k) => {
                    const v = s.points[sel]?.value
                    return (
                      <text key={s.id} x="9" y={32 + k * 17} fontSize="12.5" fill={hoverId === s.id ? 'var(--text)' : 'var(--text-2)'} style={TNUM}>
                        {`${s.label}: ${v == null ? '—' : `${v}%`}`}
                      </text>
                    )
                  })}
                </g>
              )}
            </svg>
          </div>

          <p className="card-blurb mt-blurb">
            Hover a habit below to isolate its line · click its name to open it · use the eye to hide it — or hover the chart to read one day across habits.
          </p>

          <div className="mt-legend" role="group" aria-label="Habits on the chart">
            {model.shown.map((s) => {
              const off = hidden.includes(s.id)
              const tip = `${s.full} — ${s.latest == null ? 'no completed week yet' : `${s.latest}% as of ${shortDate(s.latestDate)}`} · ${s.scheduled} scheduled days in range`
              return (
                <div
                  key={s.id}
                  className="mt-row"
                  data-off={off || undefined}
                  onPointerEnter={() => setHoverId(s.id)}
                  onPointerLeave={() => setHoverId((cur) => (cur === s.id ? null : cur))}
                  onFocusCapture={() => setHoverId(s.id)}
                  onBlurCapture={() => setHoverId((cur) => (cur === s.id ? null : cur))}
                >
                  <Link
                    className="mt-main"
                    to={`habits/${s.id}`}
                    title={tip}
                    aria-label={`Open ${s.full} — habit details`}
                  >
                    <i className="mt-swatch" style={off ? {} : { background: s.color }} aria-hidden="true" />
                    <span className="mt-name">{s.full}</span>
                    <span className="mt-val">{s.latest == null ? '—' : `${s.latest}%`}</span>
                    <IconChevronRight className="mt-go" size={15} aria-hidden="true" />
                  </Link>
                  <button
                    type="button"
                    className="mt-toggle"
                    aria-pressed={!off}
                    aria-label={`${off ? 'Show' : 'Hide'} ${s.full} on the chart`}
                    onClick={() => toggle(s)}
                  >
                    {off ? <IconEyeOff size={17} /> : <IconEye size={17} />}
                  </button>
                </div>
              )
            })}
          </div>

          {(model.tooFew > 0 || model.overflow > 0) && (
            <p className="tiny muted mt-note">
              {model.tooFew > 0 && `${model.tooFew} habit${model.tooFew === 1 ? '' : 's'} ${model.tooFew === 1 ? 'has' : 'have'} fewer than ${model.need} scheduled days in this window and won't draw yet — that's real, not an estimate.`}
              {model.tooFew > 0 && model.overflow > 0 && ' '}
              {model.overflow > 0 && `More than ${MAX_SERIES} habits qualify; the ${MAX_SERIES} with the most scheduled days are shown.`}
            </p>
          )}
        </>
      )}
    </SectionCard>
  )
}
