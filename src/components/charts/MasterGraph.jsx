/* ============================================================
   MASTER HABIT GRAPH — the central navigation surface (spec §3/§5).

   Every habit is ONE line, in the habit's OWN stored colour.
     X axis — days (7D · 30D · 90D · 6M · 1Y · ALL)
     Y axis — completion %, per habit, as an honest rolling
              7-day average over scheduled days only.

   Interactions (all real, none decorative):
     · hover  a day   → crosshair tooltip with that day's record:
                        date, per-habit state, notes, streaks
     · click  a day   → opens that day's full activity sheet
     · click  a line  → opens that habit's detail page
     · chips          → toggle habits on/off; All / Important reset
     · range chips    → switch windows

   Accessibility: every control is a real button; the svg carries a
   text summary of the visible lines.
   ============================================================ */
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useStore } from '../../store.jsx'
import { Link } from '../../lib/router.jsx'
import { todayStr, subDaysStr, shortDate } from '../../lib/dates.js'
import { eligibleOn, isDone, checkinOf, runEndingOn } from '../../lib/stats.js'
import { habitColorHex, habitPriority, priorityMeta } from '../../lib/habitIdentity.js'

export const MASTER_RANGES = [
  { days: 7, label: '7D' },
  { days: 30, label: '30D' },
  { days: 90, label: '90D' },
  { days: 182, label: '6M' },
  { days: 365, label: '1Y' },
  { days: 1095, label: 'ALL' },
]

const W = 960
const H = 300
const L = 46
const R = 18
const T = 14
const B = 30
const ROLL = 7 // rolling window (calendar days) behind each plotted value

/** re-exported so sheets and charts share one run definition */
export { runEndingOn }

/**
 * Build plotted rows: one entry per day (oldest → newest) per habit.
 * value = rolling 7-day completion % (null until the habit has a
 * scheduled day to measure — the line never invents history).
 */
function buildSeries(state, habits, days) {
  const today = todayStr()
  const rows = []
  for (let i = days - 1; i >= 0; i--) rows.push({ date: subDaysStr(today, i) })
  const perHabit = habits.map((h) => {
    const created = h.createdAt
    const rws = rows.map((r, i) => {
      const { date } = r
      const active = !created || date >= created
      const scheduledToday = active && eligibleOn(h, date)
      let sched = 0
      let done = 0
      for (let j = i; j >= 0 && j > i - ROLL; j--) {
        const d = rows[j].date
        if (created && d < created) break
        if (eligibleOn(h, d)) {
          sched++
          if (isDone(state, h.id, d)) done++
        }
      }
      return {
        i,
        date,
        value: sched > 0 ? Math.round((done / sched) * 100) : null,
        scheduledToday,
        doneToday: scheduledToday && isDone(state, h.id, date),
        note: checkinOf(state, h.id, date)?.note || null,
      }
    })
    return { habit: h, rows: rws }
  })
  return { rows, perHabit }
}

const monthOf = (dateStr) => {
  const [y, m] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'short' })
}

export default function MasterGraph({ habits: habitList, onOpenDay }) {
  const { state } = useStore()
  const gid = useId().replace(/:/g, '')
  const svgRef = useRef(null)
  const [days, setDays] = useState(30)
  const [visible, setVisible] = useState(() => new Set((habitList || []).map((h) => h.id)))
  const [hoverI, setHoverI] = useState(null)
  const [hoverHabitId, setHoverHabitId] = useState(null)

  const habits = useMemo(
    () => (habitList || []).filter((h) => !h.archived).slice(0, 24),
    [habitList],
  )

  // newly created habits join the graph automatically (off-habits stay off)
  useEffect(() => {
    setVisible((prev) => {
      let changed = false
      const next = new Set(prev)
      for (const h of habits) {
        if (!next.has(h.id)) { next.add(h.id); changed = true }
      }
      return changed ? next : prev
    })
  }, [habits])

  // keep visibility sane when habits are added/removed
  const activeIds = useMemo(() => new Set(habits.map((h) => h.id)), [habits])
  const visibleHabits = useMemo(
    () => habits.filter((h) => visible.has(h.id) && activeIds.has(h.id)),
    [habits, visible, activeIds],
  )

  const { rows, perHabit } = useMemo(
    () => buildSeries(state, visibleHabits, days),
    [state, visibleHabits, days],
  )

  const anyData = useMemo(
    () => perHabit.some((s) => s.rows.some((r) => r.value != null)),
    [perHabit],
  )

  const n = rows.length
  const plotW = W - L - R
  const plotH = H - T - B
  const x = (i) => (n <= 1 ? L + plotW / 2 : L + (i / (n - 1)) * plotW)
  const y = (v) => T + (1 - v / 100) * plotH

  const toPath = (seriesRows) => {
    let d = ''
    let pen = false
    for (const r of seriesRows) {
      if (r.value == null) { pen = false; continue }
      d += (pen ? ' L' : 'M') + `${x(r.i).toFixed(1)} ${y(r.value).toFixed(1)}`
      pen = true
    }
    return d
  }

  const lastValue = (seriesRows) => {
    for (let i = seriesRows.length - 1; i >= 0; i--) {
      if (seriesRows[i].value != null) return seriesRows[i]
    }
    return null
  }

  // x axis labels: even spread, month names for long windows
  const xLabels = useMemo(() => {
    if (!n) return []
    const want = days <= 92 ? 6 : 9
    const out = []
    for (let k = 0; k < want; k++) {
      const i = Math.round((k / (want - 1)) * (n - 1))
      const d = rows[i].date
      out.push({ i, label: days <= 92 ? shortDate(d) : monthOf(d) })
    }
    if (days > 92) {
      const dedup = []
      let prev = null
      for (const o of out) {
        if (o.label !== prev) dedup.push(o)
        prev = o.label
      }
      return dedup
    }
    return out
  }, [rows, n, days])

  if (!habits.length) return null

  const setAll = () => setVisible(new Set(habits.map((h) => h.id)))
  const setImportant = () => setVisible(new Set(habits.filter((h) => habitPriority(h) >= 4).map((h) => h.id)))
  const toggle = (id) => setVisible((prev) => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })

  const hover = hoverI != null ? rows[hoverI] : null

  const posToIndex = (clientX) => {
    const svg = svgRef.current
    if (!svg) return null
    const rect = svg.getBoundingClientRect()
    if (!rect.width) return null
    const scale = W / rect.width
    const px = (clientX - rect.left) * scale
    const i = Math.round(((px - L) / plotW) * (n - 1))
    return Math.max(0, Math.min(n - 1, i))
  }

  const grid = [0, 25, 50, 75, 100].map((v) => ({ v, y: y(v) }))
  const todayIdx = n - 1

  const lineSummary = visibleHabits.map((h) => {
    const s = perHabit.find((p) => p.habit.id === h.id)
    const last = s ? lastValue(s.rows) : null
    return { h, last }
  })

  return (
    <div className="master-graph">
      <div className="mg-bar">
        <div className="seg seg-sm" role="group" aria-label="Graph window">
          {MASTER_RANGES.map((r) => (
            <button
              key={r.label}
              type="button"
              className={`seg-btn${days === r.days ? ' active' : ''}`}
              aria-pressed={days === r.days}
              onClick={() => setDays(r.days)}
            >
              {r.label}
            </button>
          ))}
        </div>
        <div className="wrap-gap" style={{ gap: 6 }}>
          <button type="button" className="btn sm" onClick={setAll} disabled={visibleHabits.length === habits.length}>All</button>
          <button type="button" className="btn sm" onClick={setImportant}>Important</button>
        </div>
      </div>

      <div className="mg-canvas" key={`${days}`}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          role="img"
          aria-label={`Master habit graph. ${visibleHabits.length} of ${habits.length} habits, last ${days} days. ${lineSummary.map((l) => `${l.h.name}: ${l.last ? `${l.last.value}%` : 'not enough data'}`).join('. ')}`}
          onPointerMove={(e) => { const i = posToIndex(e.clientX); if (i != null) setHoverI(i) }}
          onPointerLeave={() => setHoverI(null)}
          onClick={(e) => {
            const i = posToIndex(e.clientX)
            if (i != null && onOpenDay) onOpenDay(rows[i].date)
          }}
        >
          <defs>
            {visibleHabits.map((h, idx) => {
              const s = perHabit.find((p) => p.habit.id === h.id)
              const last = s ? lastValue(s.rows) : null
              const hex = habitColorHex(h)
              return (
                <linearGradient key={h.id} id={`mg${gid}${idx}`} x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor={hex} stopOpacity={0.92} />
                  <stop offset="100%" stopColor={hex} stopOpacity={last && last.value != null && last.value < 40 ? 0.6 : 0.92} />
                </linearGradient>
              )
            })}
          </defs>

          {/* grid + y labels */}
          {grid.map((g) => (
            <g key={g.v}>
              <line x1={L} y1={g.y} x2={W - R} y2={g.y} stroke="var(--grid)" strokeWidth="1" />
              <text x={L - 8} y={g.y + 3.5} textAnchor="end" fontSize="10.5" fill="var(--text-3)" style={{ fontVariantNumeric: 'tabular-nums' }}>{g.v}</text>
            </g>
          ))}
          {/* x labels */}
          {xLabels.map((l) => (
            <text key={`${l.i}-${l.label}`} x={x(l.i)} y={H - 9} textAnchor="middle" fontSize="10.5" fill="var(--text-3)">{l.label}</text>
          ))}

          {/* today hairline */}
          <line x1={x(todayIdx)} y1={T} x2={x(todayIdx)} y2={H - B} stroke="var(--border-2)" strokeWidth="1.2" strokeDasharray="2 3" />
          <text x={x(todayIdx)} y={T - 5} textAnchor="middle" fontSize="9.5" fill="var(--text-3)" letterSpacing="0.09em">TODAY</text>

          {/* per-habit lines */}
          {visibleHabits.map((h, idx) => {
            const s = perHabit.find((p) => p.habit.id === h.id)
            const d = toPath(s ? s.rows : [])
            if (!d) return null
            const hex = habitColorHex(h)
            const emphasized = hoverHabitId === h.id
            const last = s ? lastValue(s.rows) : null
            return (
              <g key={h.id}>
                {/* fat invisible stroke = comfortable tap target */}
                <path
                  d={d} fill="none" stroke="transparent" strokeWidth="18" pointerEvents="stroke"
                  style={{ cursor: 'pointer' }}
                  onClick={(e) => { e.stopPropagation(); window.location.hash = `#/habits/${h.id}` }}
                  onPointerEnter={() => setHoverHabitId(h.id)}
                  onPointerLeave={() => setHoverHabitId((cur) => (cur === h.id ? null : cur))}
                />
                <path
                  d={d} fill="none" stroke={`url(#mg${gid}${idx})`} strokeWidth={emphasized ? 3.6 : 2.4}
                  strokeLinejoin="round" strokeLinecap="round" style={{ pointerEvents: 'none' }}
                />
                {last && (
                  <circle cx={x(last.i)} cy={y(last.value)} r={emphasized ? 5 : 3.4} fill={hex}
                    stroke="var(--surface)" strokeWidth="1.6" style={{ pointerEvents: 'none' }} />
                )}
              </g>
            )
          })}

          {/* hover crosshair */}
          {hover && (
            <g pointerEvents="none">
              <line x1={x(hover.i)} y1={T} x2={x(hover.i)} y2={H - B} stroke="var(--border-2)" strokeWidth="1" />
            </g>
          )}
        </svg>

        {!anyData && (
          <div className="mg-empty">
            <p>No check-ins in this window yet.</p>
            <p className="tiny muted">Complete a scheduled day and its line will start here — nothing is ever invented.</p>
          </div>
        )}
      </div>

      {/* per-habit toggle legend */}
      <div className="mg-legend" role="group" aria-label="Toggle habits on the graph">
        {habits.map((h) => {
          const on = visible.has(h.id)
          const s = perHabit.find((p) => p.habit.id === h.id)
          const last = s ? lastValue(s.rows) : null
          const p = habitPriority(h)
          return (
            <button
              key={h.id}
              type="button"
              className={`mg-chip${on ? ' is-on' : ''}`}
              aria-pressed={on}
              data-p={p}
              onClick={() => toggle(h.id)}
              onPointerEnter={() => setHoverHabitId(h.id)}
              onPointerLeave={() => setHoverHabitId(null)}
            >
              <span className="mg-chip-dot" style={{ background: habitColorHex(h) }} aria-hidden="true" />
              <span className="mg-chip-name">{h.name}</span>
              <span className="mg-chip-val tnum">{on && last ? `${last.value}%` : ''}</span>
              <Link
                to={`habits/${h.id}`}
                className="mg-chip-open"
                aria-label={`Open ${h.name} detail`}
                onClick={(e) => e.stopPropagation()}
                tabIndex={-1}
              >
                ›
              </Link>
            </button>
          )
        })}
      </div>

      <p className="tiny muted mg-note">
        {visibleHabits.length === 0
          ? 'Every habit is hidden — toggle one on above.'
          : 'Each line is that habit\u2019s real 7-day completion average. Click a line for the habit, or a day for its full record.'}
      </p>

      {/* screen-reader digest of the visible lines */}
      <ul className="sr-only">
        {lineSummary.map((l) => (
          <li key={l.h.id}>
            {`${l.h.name}: ${l.last ? `${l.last.value} percent over the last scheduled days` : 'not enough data yet'}${habitPriority(l.h) >= 4 ? `, ${priorityMeta(habitPriority(l.h)).label} priority` : ''}`}
          </li>
        ))}
      </ul>

      {/* floating crosshair detail */}
      {hover && (
        <DayTip
          state={state}
          date={hover.date}
          xPct={((x(hover.i) - L) / plotW) * 100}
          habits={visibleHabits}
          onOpenHabit={(h) => { window.location.hash = `#/habits/${h.id}` }}
        />
      )}
    </div>
  )
}

/* ------------------------------------------------------------
   DAY TIP — floating crosshair detail. Anchored in % of the canvas
   width, flips sides at the edges so it never overflows.
   ------------------------------------------------------------ */
function DayTip({ state, date, xPct, habits, onOpenHabit }) {
  const done = []
  const open = []
  const off = []
  for (const h of habits) {
    const check = checkinOf(state, h.id, date)
    const scheduled = eligibleOn(h, date)
    if (check?.done) done.push({ h, check })
    else if (scheduled) open.push({ h })
    else off.push({ h })
  }
  const future = date > todayStr()
  const flip = xPct > 55
  const tipStyle = flip
    ? { right: `calc(${100 - xPct}% + 14px)` }
    : { left: `calc(${xPct}% + 14px)` }
  return (
    <div className="mg-tip" style={tipStyle} role="status">
      <div className="mg-tip-head">
        <strong className="tnum">{shortDate(date)}</strong>
        <span className={`tiny ${future ? 'muted' : done.length ? '' : 'muted'}`} data-tone={!future && done.length ? 'good' : undefined}>
          {future ? 'upcoming' : `${done.length} done · ${open.length} left`}
        </span>
      </div>
      {done.map(({ h, check }) => (
        <button key={h.id} type="button" className="mg-tip-row is-done" onClick={() => onOpenHabit(h)}>
          <span className="mg-tip-dot" style={{ background: habitColorHex(h) }} aria-hidden="true" />
          <span className="mg-tip-name">{h.name}</span>
          <span className="mg-tip-state">✓</span>
          {check.note && <span className="mg-tip-note">{check.note}</span>}
        </button>
      ))}
      {open.map(({ h }) => (
        <button key={h.id} type="button" className="mg-tip-row" onClick={() => onOpenHabit(h)}>
          <span className="mg-tip-dot" style={{ background: habitColorHex(h) }} aria-hidden="true" />
          <span className="mg-tip-name">{h.name}</span>
          <span className="mg-tip-state">{future ? 'soon' : 'left'}</span>
        </button>
      ))}
      {off.slice(0, 3).map(({ h }) => (
        <span key={h.id} className="mg-tip-row is-off">
          <span className="mg-tip-dot" style={{ background: habitColorHex(h), opacity: 0.4 }} aria-hidden="true" />
          <span className="mg-tip-name">{h.name}</span>
          <span className="mg-tip-state">off</span>
        </span>
      ))}
      {off.length > 3 && <p className="tiny muted mg-tip-more">+ {off.length - 3} not scheduled</p>}
    </div>
  )
}
