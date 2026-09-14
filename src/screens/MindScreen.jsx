/* ============================================================
   MIND (Step 7C) — behavioural insight.

   The question this screen answers, and nothing else:
     What patterns are visible in my behaviour, when do they
     occur, and what evidence supports that pattern?

   Rules carried over from the 7A audit (§9 colour, §12 visuals,
   §13 content model, §14 relationships):
     - every number comes from an existing engine (stats.js /
       analytics.js / habitPatterns.js); no new analytics, no AI;
     - where an engine says `enough: false`, the panel says so and
       shows nothing else;
     - capacity dimensions are NEUTRAL identities, so they wear the
       accent/category colours — never --good/--warn/--bad, which are
       reserved for real state (window-over-window deltas);
     - correlation language only, never causation.

   The write surfaces (mood faces, capacity levels, reflection) are
   input controls and are intentionally left as they were; only the
   read side was rebuilt.
   ============================================================ */
import { useEffect, useMemo, useState } from 'react'
import { useStore } from '../store.jsx'
import SectionCard, { CardHead } from '../components/ui/SectionCard.jsx'
import EmptyState from '../components/ui/EmptyState.jsx'
import { CompareBars } from '../components/charts/workCharts.jsx'
import { todayStr, subDaysStr, prettyDate, shortDate } from '../lib/dates.js'
import { WEEKDAY_SHORT, weekdayOf } from '../lib/schedule.js'
import { MOODS, moodOf, moodStats, moodHabitLink, activeHabits } from '../lib/stats.js'
import {
  mindSeries, moodCorrelations, moodScatter, scatterTrend,
  weekdayPerformance, weekdayVsWeekend, habitCorrelations,
} from '../lib/analytics.js'
import { workloadInteraction } from '../lib/habitPatterns.js'
/* The pillar's shared lazy stylesheet owns the ins-* frames and the
   correlation/stat rules; mind.css adds what only Mind needs. */
import '../styles/insights.css'
import '../styles/mind.css'
import { IconMind, IconNote, IconSparkle, IconTarget, IconFlame } from '../lib/icons.jsx'

const LEVELS = [1, 2, 3, 4, 5]

/* The four logged dimensions. Identity, not health: each owns one
   colour from the accent/category vocabulary and one marker SHAPE, so
   a series can be told apart without relying on colour (7A §9). */
const DIMS = [
  { id: 'score', label: 'Mood', Icon: IconSparkle, shape: 'circle', weight: 2.6, color: 'var(--cat-mind)', low: 'Running empty', high: 'Charged' },
  { id: 'energy', label: 'Energy', Icon: IconSparkle, shape: 'diamond', weight: 1.9, color: 'var(--accent-2)', low: 'Running empty', high: 'Charged' },
  { id: 'focus', label: 'Focus', Icon: IconTarget, shape: 'square', weight: 1.9, color: 'var(--accent-1)', low: 'Scattered', high: 'Locked in' },
  { id: 'motivation', label: 'Drive', Icon: IconFlame, shape: 'triangle', weight: 1.6, color: 'var(--cat-creative)', low: 'Flat', high: 'Driven' },
]
const DIM_BY_ID = Object.fromEntries(DIMS.map((d) => [d.id, d]))
const COMPLETION_C = 'var(--text-3)'

const RANGES = [
  { id: '30d', label: '30D', days: 30 },
  { id: '60d', label: '60D', days: 60 },
  { id: '90d', label: '90D', days: 90 },
]

/* Mon-first, matching the Week review's day order. */
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]

/* One window, two readings: how you felt (0–5) and how much you
   actually did (0–100), on the same x-axis. */
const GEO = {
  wide: { W: 780, H: 322, L: 44, R: 18, CT: 18, CB: 212, BT: 232, BB: 288, LY: 308, xCount: 6, fs: 10, yTicks: [1, 2, 3, 4, 5] },
  tight: { W: 360, H: 292, L: 26, R: 10, CT: 14, CB: 178, BT: 194, BB: 242, LY: 260, xCount: 4, fs: 11, yTicks: [1, 3, 5] },
}

/* Narrow screens get their own geometry rather than a shrunken desktop
   chart, so axis text stays readable instead of scaling to ~4px. */
function useIsTight() {
  const [tight, setTight] = useState(() => (typeof window !== 'undefined' && window.matchMedia
    ? window.matchMedia('(max-width: 640px)').matches
    : false))
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined
    const mq = window.matchMedia('(max-width: 640px)')
    const on = (e) => setTight(e.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return tight
}

/* Nulls break the line — a day you did not log must never be drawn as
   a value, so segments are built between gaps rather than through them. */
function segments(pts) {
  const out = []
  let run = []
  for (const p of pts) {
    if (p.y == null) { if (run.length) out.push(run); run = [] } else run.push(p)
  }
  if (run.length) out.push(run)
  return out.map((run) => run.map((p, k) => `${k ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' '))
}

function Mark({ shape, x, y: cy, size = 2.6, color }) {
  if (shape === 'circle') return <circle cx={x} cy={cy} r={size} fill="var(--surface-solid)" stroke={color} strokeWidth="1.5" />
  if (shape === 'square') return <rect x={x - size} y={cy - size} width={size * 2} height={size * 2} fill="var(--surface-solid)" stroke={color} strokeWidth="1.5" />
  if (shape === 'diamond') return <rect x={x - size} y={cy - size} width={size * 2} height={size * 2} fill="var(--surface-solid)" stroke={color} strokeWidth="1.5" transform={`rotate(45 ${x} ${cy})`} />
  const s = size + 0.6
  return <path d={`M${x} ${cy - s} L${x + s} ${cy + s * 0.8} L${x - s} ${cy + s * 0.8} Z`} fill="var(--surface-solid)" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
}

/* Legend key: colour rail + the same marker shape the chart uses. */
function SeriesKey({ color, shape }) {
  return (
    <svg width="26" height="12" viewBox="0 0 26 12" aria-hidden="true" style={{ flex: 'none' }}>
      <line x1="0" y1="6" x2="26" y2="6" stroke={color} strokeWidth="2.4" strokeLinecap="round" />
      <g transform="translate(13 6)">
        <Mark shape={shape} x={0} y={0} size={2.7} color={color} />
      </g>
    </svg>
  )
}

/* ---------- primary visual: capacity × completion, day by day ---------- */
function CoMove({ rows, activeDims, moodAvg, today, days }) {
  const tight = useIsTight()
  const g = tight ? GEO.tight : GEO.wide
  const { W, H, L, R, CT, CB, BT, BB, LY, xCount, fs, yTicks } = g
  const n = rows.length
  if (n < 2) return <p className="empty-note">A trend needs at least two days of check-ins.</p>

  const slot = (W - L - R) / n
  const x = (i) => L + slot * (i + 0.5)
  const y = (v) => CB - (v / 5) * (CB - CT)
  const yb = (pct) => BB - (pct / 100) * (BB - BT)

  const lineSets = activeDims.map((d) => {
    const pts = rows.map((r, i) => ({ x: x(i), y: r[d.id] == null ? null : y(r[d.id]), raw: r, value: r[d.id] }))
    return { dim: d, pts, paths: segments(pts) }
  })

  const bars = rows.map((r, i) => ({
    date: r.date, x: x(i), pct: r.completion,
    w: Math.max(1.4, slot * (tight ? 0.62 : 0.66)),
  }))

  const compVals = rows.map((r) => r.completion).filter((v) => v != null)
  const compMean = compVals.length ? Math.round(compVals.reduce((a, b) => a + b, 0) / compVals.length) : null

  const xIdx = n <= xCount ? rows.map((_, i) => i)
    : Array.from({ length: xCount }, (_, k) => Math.round((k * (n - 1)) / (xCount - 1)))
  const todayIdx = rows.findIndex((r) => r.date === today)

  const describe = (d, v) => {
    const mood = d.id === 'score' ? MOODS.find((m) => m.score === v)?.label : null
    return `${d.label} ${v}${mood ? ` (${mood})` : ''} of 5`
  }
  const avgOf = (id) => rows.map((r) => r[id]).filter((v) => v != null)
  const aria = [
    `Line chart of ${activeDims.map((d) => d.label.toLowerCase()).join(', ')} on a 0 to 5 scale, over ${days} days ending ${prettyDate(today)}.`,
    ...activeDims.map((d) => {
      const vals = avgOf(d.id)
      if (!vals.length) return null
      const avg = Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10
      return `${d.label}: ${vals.length} logged days, average ${avg} of 5.`
    }),
    compMean != null ? `In the band below, daily habit completion averaged ${compMean} percent across ${compVals.length} days.` : 'No completion data inside this window.',
    'A day with no entry is left blank, which is not the same as zero.',
  ].filter(Boolean).join(' ')

  return (
    <div className="ins-svg-wrap mind-cocomove">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={aria}>
        {/* capacity gridlines + 0–5 axis */}
        {yTicks.map((v) => (
          <g key={v}>
            <line x1={L} y1={y(v)} x2={W - R} y2={y(v)} stroke="var(--grid)" strokeWidth="1" strokeDasharray="2 6" />
            <text x={L - 7} y={y(v) + 3} textAnchor="end" fontSize={fs} fill="var(--text-3)" style={{ fontVariantNumeric: 'tabular-nums' }}>{v}</text>
          </g>
        ))}
        <line x1={L} y1={y(0)} x2={W - R} y2={y(0)} stroke="var(--border)" strokeWidth="1" />

        {/* today marker */}
        {todayIdx >= 0 && (
          <g>
            <line x1={x(todayIdx)} y1={CT - 4} x2={x(todayIdx)} y2={BB} stroke="var(--accent-1)" strokeWidth="1.1" strokeDasharray="3 3" opacity="0.8" />
            <polygon points={`${x(todayIdx) - 4},${CT - 3} ${x(todayIdx) + 4},${CT - 3} ${x(todayIdx)},${CT + 3}`} fill="var(--accent-1)" />
            {/* flip the label inside when today sits at the right edge */}
            <text
              x={todayIdx > n - 4 ? x(todayIdx) - 6 : x(todayIdx) + 6}
              y={CT + 2}
              textAnchor={todayIdx > n - 4 ? 'end' : 'start'}
              fontSize={fs - 0.5}
              fontWeight="700"
              fill="var(--accent-1)"
            >Today</text>
          </g>
        )}

        {/* mood mean, dashed reference in the mood's own colour */}
        {moodAvg != null && (
          <g>
            <line x1={L} y1={y(moodAvg)} x2={W - R} y2={y(moodAvg)} stroke="var(--cat-mind)" strokeWidth="1.3" strokeDasharray="5 5" opacity="0.6" />
            {!tight && (
              <text x={W - R - 2} y={y(moodAvg) - 5} textAnchor="end" fontSize={fs - 1} fill="var(--cat-mind)" opacity="0.95">
                mood avg {moodAvg}
              </text>
            )}
          </g>
        )}

        {/* the four dimension lines */}
        {lineSets.map((s) => (
          <g key={s.dim.id}>
            {s.paths.map((d, k) => (
              <path key={k} d={d} fill="none" stroke={s.dim.color} strokeWidth={s.dim.weight} strokeLinejoin="round" strokeLinecap="round" />
            ))}
            {s.pts.filter((p) => p.y != null).map((p) => (
              <g key={p.raw.date}>
                <Mark shape={s.dim.shape} x={p.x} y={p.y} size={tight ? 2.2 : 2.6} color={s.dim.color} />
                <title>{`${prettyDate(p.raw.date)} · ${describe(s.dim, p.value)}`}</title>
              </g>
            ))}
          </g>
        ))}

        {/* completion band: one real bar per day with scheduled checks */}
        <g>
          <text x={L - 7} y={BB + 3} textAnchor="end" fontSize={fs - 1} fill="var(--text-3)">0</text>
          <text x={L - 7} y={yb(100) + 3} textAnchor="end" fontSize={fs - 1} fill="var(--text-3)">100</text>
          <line x1={L} y1={BB} x2={W - R} y2={BB} stroke="var(--border)" strokeWidth="1" />
          {bars.map((b) => (b.pct == null ? (
            /* scheduled-but-unlogged day: show the absence, don't hide it */
            <rect key={b.date} x={b.x - b.w / 2} y={BB - 1.5} width={b.w} height="1.5" fill="var(--border-2)" opacity="0.75" />
          ) : (
            <g key={b.date}>
              <rect x={b.x - b.w / 2} y={yb(b.pct)} width={b.w} height={Math.max(1, BB - yb(b.pct))} fill={COMPLETION_C} opacity="0.5" rx="1" />
              <title>{`${prettyDate(b.date)} · ${b.pct}% of scheduled habits done`}</title>
            </g>
          )))}
          {compMean != null && (
            <line x1={L} y1={yb(compMean)} x2={W - R} y2={yb(compMean)} stroke="var(--text-3)" strokeWidth="1.2" strokeDasharray="4 4" opacity="0.9" />
          )}
        </g>

        {/* shared x axis */}
        {xIdx.filter((i) => rows[i]).map((i) => (
          <text key={i} x={x(i)} y={LY} textAnchor="middle" fontSize={fs} fill="var(--text-3)">{shortDate(rows[i].date)}</text>
        ))}
      </svg>
    </div>
  )
}

export default function MindScreen() {
  const { state, dispatch } = useStore()
  const today = todayStr()
  const [range, setRange] = useState('30d')
  const days = RANGES.find((r) => r.id === range).days

  const current = moodOf(state, today)
  const [note, setNote] = useState(current?.note || '')
  const [wentWell, setWentWell] = useState(current?.wentWell || '')
  const [difficult, setDifficult] = useState(current?.difficult || '')
  const [reflectOpen, setReflectOpen] = useState(false)
  const [saved, setSaved] = useState(false)

  /* ---- existing engines, no new maths ---- */
  const stats = useMemo(() => moodStats(state, days), [state, days])
  const series = useMemo(() => mindSeries(state, days), [state, days])
  const wd = useMemo(() => weekdayPerformance(state, 12), [state])
  const split = useMemo(() => weekdayVsWeekend(state, 12), [state])
  const corr = useMemo(() => moodCorrelations(state, days), [state, days])
  const link = useMemo(() => moodHabitLink(state, days), [state, days])
  const cooc = useMemo(() => habitCorrelations(state, days, 3), [state, days])
  const habits = useMemo(() => activeHabits(state), [state])
  const load = useMemo(
    () => habits.map((h) => ({ habit: h, w: workloadInteraction(state, h, 90) })).filter((r) => r.w.enough).slice(0, 3),
    [state, habits],
  )
  /* Pearson r per dimension — the engine that already owns this maths. */
  const assoc = useMemo(
    () => Object.fromEntries(DIMS.map((d) => {
      const sc = moodScatter(state, days, d.id)
      return [d.id, { ...sc, trend: scatterTrend(sc) }]
    })),
    [state, days],
  )

  const from = subDaysStr(today, days - 1)
  const rows = series.rows
  const moodAvg = series.averages.score
  const activeDims = useMemo(() => DIMS.filter((d) => rows.filter((r) => r[d.id] != null).length >= 1), [rows])
  const logged = rows.filter((r) => r.score != null).length

  /* Window-over-window shift per dimension: the only place on this screen
     where a real state exists, so the only place a tone is allowed. */
  const shifts = useMemo(() => {
    const half = Math.floor(rows.length / 2)
    const mean = (vals) => (vals.length >= 3 ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 : null)
    const pick = (d, slice) => mean(slice.map((r) => r[d]).filter((v) => v != null))
    return Object.fromEntries(DIMS.map((d) => {
      const cur = pick(d.id, rows.slice(half))
      const prev = pick(d.id, rows.slice(0, half))
      return [d.id, { cur, prev, delta: cur != null && prev != null ? Math.round((cur - prev) * 10) / 10 : null }]
    }))
  }, [rows])

  const reflections = useMemo(
    () => Object.entries(state.moods || {})
      .filter(([, m]) => m && (m.wentWell || m.difficult))
      .sort((a, b) => b[0].localeCompare(a[0]))
      .slice(0, 6),
    [state],
  )
  const notes = useMemo(
    () => [...stats.entries].reverse().filter((e) => e.note).slice(0, 6),
    [stats],
  )

  const hasHistory = stats.count > 0

  /* ---- write surfaces (unchanged behaviour) ---- */
  const flash = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 1600)
  }
  const setDim = (key, value) => {
    const next = { ...current }
    if (next[key] === value) delete next[key]
    else next[key] = value
    const patch = { ...next }
    if (note.trim()) patch.note = note.trim()
    if (wentWell.trim()) patch.wentWell = wentWell.trim()
    if (difficult.trim()) patch.difficult = difficult.trim()
    dispatch({ type: 'SET_MOOD', date: today, patch: Object.keys(patch).length ? patch : null })
    flash()
  }
  const saveNote = () => {
    dispatch({ type: 'SET_MOOD', date: today, patch: { ...(current || {}), note: note.trim() || undefined } })
    flash()
  }
  const saveReflection = () => {
    const patch = {
      ...(current || {}),
      wentWell: wentWell.trim() || undefined,
      difficult: difficult.trim() || undefined,
    }
    dispatch({ type: 'SET_MOOD', date: today, patch: Object.keys(patch).length ? patch : null })
    flash()
  }

  /* strongest co-variation, for the primary chart's interpretation line */
  const strongest = useMemo(() => {
    const scored = DIMS
      .map((d) => ({ dim: d, ...assoc[d.id] }))
      .filter((s) => s.enough && s.trend)
      .sort((a, b) => Math.abs(b.r) - Math.abs(a.r))
    return scored[0] || null
  }, [assoc])

  /* weekday reading: does the day you feel best match the day you do most? */
  const wdView = useMemo(() => {
    const moodBy = Object.fromEntries(WEEK_ORDER.map((k) => [k, { sum: 0, n: 0 }]))
    for (const r of rows) {
      if (r.score == null) continue
      const w = weekdayOf(r.date)
      if (moodBy[w]) { moodBy[w].sum += r.score; moodBy[w].n += 1 }
    }
    const byRate = wd.rows.filter((r) => r.rate != null).sort((a, b) => b.rate - a.rate)
    const bestDay = byRate[0]?.weekday ?? null
    const weakDay = byRate.length > 1 ? byRate[byRate.length - 1].weekday : null
    const moodRank = WEEK_ORDER
      .map((w) => ({ weekday: w, avg: moodBy[w].n >= 2 ? Math.round((moodBy[w].sum / moodBy[w].n) * 10) / 10 : null, n: moodBy[w].n }))
      .filter((m) => m.avg != null)
      .sort((a, b) => b.avg - a.avg)
    return {
      moodBy: Object.fromEntries(WEEK_ORDER.map((w) => [w, moodBy[w].n >= 2 ? Math.round((moodBy[w].sum / moodBy[w].n) * 10) / 10 : null])),
      moodDays: moodRank.length >= 2 ? moodRank : [],
      bestDay, weakDay, enough: wd.enough || moodRank.length >= 2,
    }
  }, [rows, wd])

  return (
    <div className="screen" id="mind-screen">
      <header className="screen-head">
        <div>
          <h1 className="screen-title">Mind</h1>
          <p className="screen-sub">What your check-ins say about how you work — pattern, evidence, and the window it came from.</p>
        </div>
        <div className="ins-range mind-range" role="group" aria-label="Analysis window">
          {RANGES.map((r) => (
            <button key={r.id} type="button" aria-pressed={range === r.id} onClick={() => setRange(r.id)}>{r.label}</button>
          ))}
        </div>
      </header>

      <div className="stack insights-layout">
        {/* ---------- today's check-in (write surfaces, as-is) ---------- */}
        <SectionCard className="pad mind-checkin">
          <CardHead title="Today">
            <span className="tiny muted tnum">{hasHistory ? `${logged} of ${days} days logged` : 'no entries yet'}</span>
          </CardHead>
          <div className="mind-checkin__grid">
            <div className="mind-checkin__col">
              <p className="mind-block-label">How are you feeling today?</p>
              <div className="mood-row">
                {MOODS.map((m) => (
                  <button
                    key={m.score}
                    className="mood-btn"
                    aria-pressed={current?.score === m.score}
                    style={{ '--mood-c': m.color }}
                    onClick={() => setDim('score', m.score)}
                  >
                    <MoodFace score={m.score} active={current?.score === m.score} />
                    {m.label}
                  </button>
                ))}
              </div>
              {current?.score ? (
                <div className="mind-note-line">
                  <label className="field-label" htmlFor="mood-note">A line about today <span className="mind-opt">(optional)</span></label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      id="mood-note"
                      className="field"
                      maxLength={500}
                      placeholder="Woke up early, focused morning…"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && saveNote()}
                    />
                    <button className="btn" onClick={saveNote} disabled={!note.trim()}>Save</button>
                  </div>
                </div>
              ) : (
                <p className="mind-note-hint">Pick a mood to unlock the note field. You can change it any time today.</p>
              )}
              <div className="mind-checkin__reflect">
                <div className="row-between" style={{ marginBottom: reflectOpen ? 10 : 0 }}>
                  <p className="mind-block-label" style={{ margin: 0 }}>Reflection</p>
                  <button className="btn ghost sm" onClick={() => setReflectOpen((o) => !o)} aria-expanded={reflectOpen}>
                    {reflectOpen ? 'Close' : current?.wentWell || current?.difficult ? 'Edit today' : 'Write today'}
                  </button>
                </div>
                {reflectOpen && (
                  <div className="stack" style={{ gap: 12 }}>
                    <div className="mind-reflect__fields">
                      <div>
                        <label className="field-label" htmlFor="went-well">What went well?</label>
                        <textarea id="went-well" className="field" rows={2} maxLength={400} value={wentWell}
                          placeholder="Shipped the draft, walked after lunch…"
                          onChange={(e) => setWentWell(e.target.value)} />
                      </div>
                      <div>
                        <label className="field-label" htmlFor="difficult">What got in the way?</label>
                        <textarea id="difficult" className="field" rows={2} maxLength={400} value={difficult}
                          placeholder="Late meetings, phone in the room…"
                          onChange={(e) => setDifficult(e.target.value)} />
                      </div>
                    </div>
                    <div className="row-between">
                      <p className="tiny muted" style={{ margin: 0 }}>Reflections land in your Record timeline.</p>
                      <button className="btn primary sm" onClick={saveReflection} disabled={!wentWell.trim() && !difficult.trim()}>Save reflection</button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="mind-checkin__col">
              <p className="mind-block-label">Capacity today</p>
              <div className="stack" style={{ gap: 12 }}>
                {DIMS.filter((d) => d.id !== 'score').map(({ id, label, Icon, low, high }) => {
                  const value = current?.[id]
                  return (
                    <div key={id}>
                      <div className="row-between" style={{ marginBottom: 7 }}>
                        <span className="dim-label"><Icon size={15} /> {label}</span>
                        <span className="tiny muted">{value == null ? 'Not logged' : value <= 2 ? low : value >= 4 ? high : 'Steady'}</span>
                      </div>
                      <div className="level-row" role="group" aria-label={`${label} level, 1 low to 5 high`}>
                        {LEVELS.map((n) => (
                          <button
                            key={n}
                            type="button"
                            className="level-btn"
                            data-on={value === n ? 'true' : 'false'}
                            aria-pressed={value === n}
                            aria-label={`${label} ${n} of 5`}
                            onClick={() => setDim(id, n)}
                          >
                            {n}
                          </button>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
              <p className="tiny muted mind-checkin__foot">
                Logging capacity alongside habits is what makes everything below exist at all.
              </p>
            </div>
          </div>
          {saved && <p className="mind-saved" role="status">Saved.</p>}
        </SectionCard>

        {!hasHistory ? (
          <SectionCard>
            <EmptyState art="art/empty-mind.webp" icon={<IconMind size={40} />} title="No check-ins in this window">
              Mind reads your own log. Check in for a few days and the patterns below fill themselves — nothing is estimated, so nothing appears before it is supported.
            </EmptyState>
          </SectionCard>
        ) : (
          <>
            {/* ---------- signal: one tile per dimension ---------- */}
            <div className="ins-signal-strip" aria-label="Average self-reported levels this window">
              {DIMS.map((d) => {
                const s = shifts[d.id]
                const tone = s.delta == null ? 'neutral' : s.delta >= 0.3 ? 'good' : s.delta <= -0.3 ? 'warn' : 'neutral'
                return (
                  <div key={d.id} className="ins-signal is-id" data-tone={tone} style={{ '--dim-c': d.color }}>
                    <p className="ins-signal-title">
                      <SeriesKey color={d.color} shape={d.shape} /> {d.label}
                    </p>
                    <p className="ins-signal-value">{series.averages[d.id] ?? '—'}<span className="ins-signal-of">/5</span></p>
                    <p className="ins-signal-sub">
                      {s.delta == null
                        ? `${rows.filter((r) => r[d.id] != null).length} of ${days} days logged.`
                        : `${s.delta >= 0 ? '+' : ''}${s.delta} vs the first ${Math.floor(days / 2)} days (${s.prev} → ${s.cur}).`}
                    </p>
                  </div>
                )
              })}
            </div>

            {/* ---------- primary visual ---------- */}
            <div className="ins-surface ins-chart-card">
              <div className="ins-chart-head">
                <div>
                  <h2>Do your capable days turn into doing days?</h2>
                  <p>Self-reported levels (0–5) over {days} days, with habit completion % on the same axis below — {from} to {today}.</p>
                </div>
              </div>

              <CoMove rows={rows} activeDims={activeDims} moodAvg={moodAvg} today={today} days={days} />

              <div className="ins-legend mind-legend">
                {activeDims.map((d) => (
                  <span key={d.id}>
                    <SeriesKey color={d.color} shape={d.shape} />
                    {d.label}
                    <b className="tnum">{series.averages[d.id] == null ? '—' : `avg ${series.averages[d.id]}`}</b>
                  </span>
                ))}
                <span><i style={{ background: COMPLETION_C, height: 9, borderRadius: 2 }} /> Completion %</span>
                <span><i className="is-dash" /> Window mean</span>
              </div>

              <p className="ins-trust">
                <IconSparkle size={13} />
                <span>
                  {strongest
                    ? `${strongest.dim.label} and completion co-vary at r = ${strongest.r.toFixed(2)} across ${strongest.n} days that had both — a ${strongest.trend.strength} ${strongest.trend.slope >= 0 ? 'upward' : 'downward'} drift. Association, not causation.`
                    : `Nothing here is imputed: ${logged} of ${days} days in this window carry a check-in, and no level co-varies with completion strongly enough (|r| ≥ 0.3) to fit a line — so none is drawn.`}
                </span>
              </p>
            </div>

            {/* ---------- when in the week ---------- */}
            <div className="ins-surface">
              <div className="ins-chart-head">
                <div>
                  <h2>When in the week you show up</h2>
                  <p>Completion across the last {wd.windowWeeks} weeks, against the mood you logged on those weekdays.</p>
                </div>
                <span className="tiny muted tnum">{days}-day mood window</span>
              </div>
              {wdView.enough ? (
                <div className="stack" style={{ gap: 12 }}>
                  <div className="dist mind-wd" role="img" aria-label={
                    `By weekday: ${WEEK_ORDER.map((w) => {
                      const r = wd.rows[w]
                      const m = wdView.moodBy[w]
                      return `${WEEKDAY_SHORT[w]} ${r.rate == null ? 'no completion data' : `${Math.round(r.rate * 100)} percent done`}${m == null ? '' : `, mood ${m} of 5`}`
                    }).join('; ')}`
                  }>
                    {WEEK_ORDER.map((w) => {
                      const r = wd.rows[w]
                      const mood = wdView.moodBy[w]
                      const tone = w === wdView.bestDay ? 'good' : w === wdView.weakDay ? 'warn' : undefined
                      return (
                        <div className="dist-row mind-wd__row" key={w} data-today={r.weekday === weekdayOf(today) ? 'true' : undefined}>
                          <span className="dist-label">{WEEKDAY_SHORT[w]}</span>
                          <span className="meter thin" data-tone={tone}>
                            <i style={{ width: `${r.rate == null ? 0 : Math.max(2, r.rate * 100)}%` }} />
                          </span>
                          <span className="dist-value tnum">
                            {r.rate == null ? <span className="muted">no data</span> : `${Math.round(r.rate * 100)}%`}
                            <span className="muted"> {r.samples || 0}d</span>
                          </span>
                          <span className="mind-wd__mood" title={`Average mood ${WEEKDAY_SHORT[w]}`}>
                            <i style={{ background: 'var(--cat-mind)' }} />
                            <b className="tnum">{mood == null ? '—' : mood}</b>
                          </span>
                        </div>
                      )
                    })}
                  </div>
                  <p className="tiny muted" style={{ marginTop: -4 }}>
                    Grey meter = share of scheduled habits done. Violet number = average mood logged that weekday. A blank means you did not log it — it is not a zero.
                  </p>
                  {split && (
                    <div className="corr-row">
                      <p className="corr-text"><b>Weekdays vs weekends</b></p>
                      <CompareBars
                        a={{ label: 'Weekdays', value: split.weekdayPct, color: 'var(--accent-2)' }}
                        b={{ label: 'Weekends', value: split.weekendPct, color: COMPLETION_C }}
                      />
                    </div>
                  )}
                  <p className="corr-text">
                    {(() => {
                      const bits = []
                      if (wd.best && wd.worst && wd.best.weekday !== wd.worst.weekday) {
                        bits.push(`completion peaks on ${wd.best.name}s (${Math.round(wd.best.rate * 100)}%) and dips on ${wd.worst.name}s (${Math.round(wd.worst.rate * 100)}%)`)
                      }
                      if (wdView.moodDays.length >= 2 && wdView.moodDays[0].avg !== wdView.moodDays[wdView.moodDays.length - 1].avg) {
                        const hi = wdView.moodDays[0]
                        bits.push(`you rate ${WEEKDAY_SHORT[hi.weekday]}s highest on mood (${hi.avg}/5)`)
                        const bestName = wd.best ? WEEKDAY_SHORT[wd.best.weekday] : null
                        if (bestName) bits.push(bestName === WEEKDAY_SHORT[hi.weekday] ? '— the same day you get most done' : `while ${bestName} is your most productive day`)
                      }
                      if (!bits.length) return 'One weekday needs at least two logged days before this says anything honest.'
                      return `Across this window, ${bits.join(', ')}. That is a pattern in your log, not a rule about weekdays.`
                    })()}
                  </p>
                </div>
              ) : (
                <p className="empty-note">Two or more weekdays with real check-ins are needed before a weekday pattern means anything.</p>
              )}
            </div>

            {/* ---------- what moves together ---------- */}
            <div className="ins-surface">
              <div className="ins-chart-head">
                <div>
                  <h2>What moves together</h2>
                  <p>Each comparison needs both sides to hold at least four real days. Anything below that stays unspoken.</p>
                </div>
                <span className="tiny muted tnum">last {days} days</span>
              </div>
              <div className="stack" style={{ gap: 14 }}>
                <div>
                  <h3 className="mind-block-label">Level of the day vs execution</h3>
                  {corr.enough ? (
                    <div className="stack" style={{ gap: 10 }}>
                      {corr.rows.map((r) => {
                        const d = DIM_BY_ID[r.dim] || { label: r.dim, color: 'var(--text-3)', shape: 'circle' }
                        return (
                          <div key={r.dim} className="corr-row">
                            <p className="corr-pair" style={{ color: d.color }}>
                              <SeriesKey color={d.color} shape={d.shape} /> {d.label} days vs flat days
                            </p>
                            <CompareBars
                              a={{ label: 'High (4–5)', value: r.highPct, color: d.color }}
                              b={{ label: 'Low (1–2)', value: r.lowPct, color: COMPLETION_C }}
                            />
                            <p className="corr-text">
                              Completion ran{' '}
                              <b className={r.delta >= 0 ? 'corr-up' : 'corr-down'}>
                                {r.delta >= 0 ? 'higher' : 'lower'} by {Math.abs(r.delta)} points
                              </b>{' '}
                              on {r.delta >= 0 ? 'your strongest' : 'your flat'} {d.label.toLowerCase()} days, across {r.highTotal} and {r.lowTotal} logged days.{' '}
                              {assoc[r.dim]?.enough
                                ? `r = ${assoc[r.dim].r?.toFixed(2) ?? '—'}${assoc[r.dim].trend ? ` (${assoc[r.dim].trend.strength} ${assoc[r.dim].trend.slope >= 0 ? 'upward' : 'downward'})` : ' — too weak to fit a line'}.`
                                : 'Not enough paired days to compute r.'}
                            </p>
                          </div>
                        )
                      })}
                      {link && (
                        <p className="corr-text">
                          Overall: on days you rated your mood 4–5 you completed <b className="tnum">{link.goodPct}%</b> of scheduled habits; on 1–2 days, <b className="tnum">{link.lowPct}%</b>.
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="empty-note">
                      {logged} logged {logged === 1 ? 'day' : 'days'} so far. This needs at least four days at 4–5 and four days at 1–2 on the same dimension — until then there is no honest comparison to draw.
                    </p>
                  )}
                </div>

                <div>
                  <h3 className="mind-block-label">Habits that appear together</h3>
                  {cooc.enough ? (
                    <div className="stack" style={{ gap: 10 }}>
                      {cooc.pairs.map((p) => (
                        <div key={`${p.a.id}-${p.b.id}`} className="corr-row">
                          <p className="corr-pair">
                            <span style={{ color: `var(--cat-${p.a.category || 'mind'})` }}>{p.a.name}</span>
                            <span aria-hidden="true">·</span>
                            <span style={{ color: `var(--cat-${p.b.category || 'mind'})` }}>{p.b.name}</span>
                          </p>
                          <p className="corr-text">
                            On days you complete <b>{p.a.name}</b>, <b>{p.b.name}</b> gets done <b className="tnum">{p.withRate}%</b> of the time — on the days you skip it, <b className="tnum">{p.withoutRate}%</b>{' '}
                            <span className={p.delta >= 0 ? 'corr-up' : 'corr-down'}>({p.delta >= 0 ? '+' : ''}{p.delta} points)</span>.
                          </p>
                          <p className="tiny muted">Across {p.withTotal} days with {p.a.name} done and {p.withoutTotal} without — co-occurrence, not cause.</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="empty-note">No habit pair clears the bar yet — co-occurrence needs four scheduled days on both sides and a 15-point gap.</p>
                  )}
                </div>

                <div>
                  <h3 className="mind-block-label">Heaviest vs lightest work days</h3>
                  {load.length ? (
                    <div className="stack" style={{ gap: 10 }}>
                      {load.map(({ habit, w }) => (
                        <div key={habit.id} className="corr-row">
                          <p className="corr-pair" style={{ color: `var(--cat-${habit.category || 'mind'})` }}>
                            {habit.name}
                          </p>
                          <CompareBars
                            a={{ label: 'Lighter days', value: w.low, color: 'var(--accent-2)' }}
                            b={{ label: 'Heaviest 25%', value: w.high, color: COMPLETION_C }}
                          />
                          <p className="corr-text">
                            Completion was {w.high}% on your heaviest-workload days and {w.low}% on lighter ones.
                            {' '}{w.high > w.low
                              ? 'Higher, not lower — worth knowing, since it is the opposite of the usual assumption.'
                              : 'Lower on loaded days.'}
                            {' '}Reported as an association between two counts; nothing here says work changes your habit.
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="empty-note">
                      Needs at least five days carrying committed work and five without, in the same window — Work data on your days decides whether this comparison can be drawn.
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* ---------- your own words (evidence, in the raw) ---------- */}
            {(reflections.length > 0 || notes.length > 0) && (
              <div className="ins-surface">
                <div className="ins-chart-head">
                  <div>
                    <h2>In your own words</h2>
                    <p>What you wrote is evidence too — the numbers above say nothing about why.</p>
                  </div>
                  <span className="tiny muted tnum">{reflections.length + notes.length} recent</span>
                </div>
                <div className="stack" style={{ gap: 10 }}>
                  {reflections.map(([date, m]) => (
                    <div key={date} className="corr-row">
                      <p className="tiny muted">{prettyDate(date)}</p>
                      {m.wentWell && <p className="corr-text"><b>Went well:</b> {m.wentWell}</p>}
                      {m.difficult && <p className="corr-text"><b>In the way:</b> {m.difficult}</p>}
                    </div>
                  ))}
                  {notes.map((e) => (
                    <div key={e.date} className="corr-row mind-note">
                      <span aria-hidden="true"><IconNote size={15} /></span>
                      <div>
                        <p className="tiny muted">
                          {prettyDate(e.date)} · {MOODS.find((m) => m.score === e.score)?.label || 'no mood'}
                        </p>
                        <p className="corr-text">{e.note}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <p className="ins-trust mind-trust">
              <IconSparkle size={13} />
              <span>
                Everything above is a deterministic count of your own log between {from} and {today} — no model, no invented trend, no advice you did not ask for. Where the evidence runs out, the card says so.
              </span>
            </p>
          </>
        )}
      </div>
    </div>
  )
}

/* Simple, friendly SVG faces — color follows the mood. */
function MoodFace({ score, active }) {
  const color = MOODS.find((m) => m.score === score)?.color
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true" style={{ opacity: active ? 1 : 0.75 }}>
      <circle cx="13" cy="13" r="11" fill={active ? color : 'transparent'} stroke={color} strokeWidth="1.6" />
      <circle cx="9.4" cy="10.6" r="1.3" fill={active ? '#0b0f1a' : color} />
      <circle cx="16.6" cy="10.6" r="1.3" fill={active ? '#0b0f1a' : color} />
      {score >= 4 && <path d="M8.6 15.2q4.4 4 8.8 0" stroke={active ? '#0b0f1a' : color} strokeWidth="1.8" fill="none" strokeLinecap="round" />}
      {score === 3 && <path d="M8.8 16.4h8.4" stroke={active ? '#0b0f1a' : color} strokeWidth="1.8" fill="none" strokeLinecap="round" />}
      {score <= 2 && <path d="M8.6 17.6q4.4 -4 8.8 0" stroke={active ? '#0b0f1a' : color} strokeWidth="1.8" fill="none" strokeLinecap="round" />}
    </svg>
  )
}
