import { lazy, Suspense, useId, useMemo, useState } from 'react'
import { SpatialStage } from '../components/spatial/Depth.jsx'
import { useStore } from '../store.jsx'
import SectionCard from '../components/ui/SectionCard.jsx'
import EmptyState from '../components/ui/EmptyState.jsx'
import { todayStr, subDaysStr, shortDate } from '../lib/dates.js'
import {
  activeHabits, topStreak, achievements,
  trendSeries, weekComparison, moodHabitLink, eligibleOn, isDone as isDoneCheck,
} from '../lib/stats.js'
import { achievementSummary } from '../lib/achievements.js'
import {
  weekdayPerformance, weekdayVsWeekend, consistencyRanking,
  personalBests, smartInsights, timeOfDayPerformance,
} from '../lib/analytics.js'
import { Link } from '../lib/router.jsx'
import InsightsDeepDive from './InsightsDeepDive.jsx'
import {
  IconInsights, IconMind, IconRecord, IconTrophy, IconChevronRight, IconSparkle,
} from '../lib/icons.jsx'
import '../styles/insights.css'

const RANGES = [
  { id: '14d', label: '14D', days: 14 },
  { id: '30d', label: '30D', days: 30 },
  { id: '90d', label: '90D', days: 90 },
]

/* Phase D: the Lab carries the heavy analytics engine, so it is loaded
   only when the tab is opened — it never enters the Insights chunk. */
const AnalyticsLab = lazy(() => import('./AnalyticsLab.jsx'))

const INSIGHT_VIEWS = [
  { id: 'overview', label: 'Overview' },
  { id: 'deep', label: 'Deep dive' },
]

/* The number of habits to overlay on the primary chart. Each gets
   its category color; we cap at three to stay out of rainbow territory
   (7A color strategy §9). */
const MAX_HABIT_SERIES = 3

/* ------------------------------------------------------------------ */
/* Primary multi-series trend chart — aggregate completion (area +
   solid line) + up to 3 strongest/most-active habit series (category
   color, thinner solid). Reference: 7-day rolling average (muted dash).
   Null points stay null — the SVG path breaks at gaps, no smoothing.
------------------------------------------------------------------ */
function PrimaryTrend({ state, data, habits, rangeDays, today }) {
  const gid = useId().replace(/:/g, '')
  const W = 780; const H = 270; const L = 42; const R = 16; const T = 18; const B = 48
  const n = data.length
  if (n < 2) return <p className="empty-note">Not enough data yet to draw a trend.</p>

  const x = (i) => (n <= 1 ? (L + W - R) / 2 : L + (i / (n - 1)) * (W - L - R))
  const y = (v) => T + (1 - v / 100) * (H - T - B)
  const xIdxs = (() => {
    const want = 6
    if (n <= want) return data.map((_, i) => i)
    return Array.from({ length: want }, (_, k) => Math.round((k * (n - 1)) / (want - 1)))
  })()
  const todayIdx = data.findIndex((d) => d.date === today)

  // Aggregate area path.
  const agg = data.map((d, i) => ({ ...d, i, x: x(i), y: d.pct == null ? null : y(d.pct) }))
  const aggSolid = agg.filter((p) => p.y != null)
  let aggLine = ''
  aggSolid.forEach((p, k) => { aggLine += (k === 0 ? 'M' : 'L') + p.x.toFixed(1) + ' ' + p.y.toFixed(1) })
  let aggArea = ''
  if (aggSolid.length) {
    aggArea = aggLine + ` L${aggSolid[aggSolid.length - 1].x.toFixed(1)} ${H - B} L${aggSolid[0].x.toFixed(1)} ${H - B} Z`
  }

  // 7-day rolling average of aggregate (reference, muted dashed).
  const roll = data.map((d, i) => {
    if (d.pct == null) return { i, value: null }
    const slice = data.slice(Math.max(0, i - 6), i + 1)
    const nums = slice.map((s) => s.pct).filter((v) => v != null)
    if (nums.length < 3) return { i, value: null }
    return { i, value: Math.round(nums.reduce((a, b) => a + b, 0) / nums.length) }
  })
  let rollPath = ''; let started = false
  roll.forEach((p) => {
    if (p.value == null) { started = false; return }
    const X = x(p.i); const Y = y(p.value)
    rollPath += (started ? 'L' : 'M') + X.toFixed(1) + ' ' + Y.toFixed(1)
    started = true
  })

  // Per-habit series (capped).
  const habitSeries = habits.map((h) => {
    const pts = []
    for (let i = 0; i < n; i++) {
      const d = data[i].date
      const sch = eligibleOn(h, d)
      const done = isDoneCheck(state, h.id, d)
      const v = sch ? (done ? 100 : 0) : null
      pts.push({ date: d, value: v, x: x(i), y: v == null ? null : y(v) })
    }
    // Build broken path (gaps stay gaps).
    let d = ''; let down = false
    pts.forEach((p) => {
      if (p.y == null) { down = false; return }
      d += (down ? 'L' : 'M') + p.x.toFixed(1) + ' ' + p.y.toFixed(1)
      down = true
    })
    return {
      habit: h,
      color: `var(--cat-${h.category || 'mind'})`,
      pts, d,
    }
  })

  // Accessible summary
  const withData = data.filter((d) => d.pct != null)
  const avg = withData.length
    ? Math.round(withData.reduce((s, d) => s + d.pct, 0) / withData.length)
    : null
  const aria = [
    `Completion trend over the last ${rangeDays} days.`,
    avg != null ? `Average ${avg}% across ${withData.length} days with data.` : 'Not enough data yet.',
    ...habitSeries.map((s) => `${s.habit.name} shown individually in its category color.`),
  ].join(' ')

  return (
    <div className="ins-svg-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={aria}>
        <defs>
          <linearGradient id={`ins-fill-${gid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent-2)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--accent-2)" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* Y grid */}
        {[0, 25, 50, 75, 100].map((v) => (
          <g key={v}>
            <line x1={L} y1={y(v)} x2={W - R} y2={y(v)} stroke="var(--grid)" strokeWidth="1" strokeDasharray="2 6" />
            <text x={L - 8} y={y(v) + 3} textAnchor="end" fontSize="10" fill="var(--text-3)" style={{ fontVariantNumeric: 'tabular-nums' }}>{v}</text>
          </g>
        ))}

        {/* X labels */}
        {xIdxs.filter((i) => i < n).map((i) => (
          <text key={i} x={x(i)} y={H - 22} textAnchor="middle" fontSize="10" fill="var(--text-3)">{shortDate(data[i].date)}</text>
        ))}

        {/* Aggregate area + line */}
        {aggArea && <path d={aggArea} fill={`url(#ins-fill-${gid})`} />}
        {aggLine && <path d={aggLine} fill="none" stroke="var(--accent-2)" strokeWidth="2.6" strokeLinejoin="round" strokeLinecap="round" />}

        {/* Rolling average */}
        {rollPath && <path d={rollPath} fill="none" stroke="var(--text-3)" strokeWidth="1.4" strokeDasharray="4 4" opacity="0.75" />}

        {/* Habit series (category colors, thinner) */}
        {habitSeries.map((s) => (
          s.d && <path key={s.habit.id} d={s.d} fill="none" stroke={s.color} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" opacity="0.9" />
        ))}

        {/* Today marker */}
        {todayIdx >= 0 && (
          <g>
            <line x1={x(todayIdx)} y1={T} x2={x(todayIdx)} y2={H - B} stroke="var(--accent-1)" strokeWidth="1.2" strokeDasharray="3 3" />
            <polygon points={`${x(todayIdx) - 4},${T + 1} ${x(todayIdx) + 4},${T + 1} ${x(todayIdx)},${T + 7}`} fill="var(--accent-1)" />
            <text x={x(todayIdx) + 6} y={T + 10} fontSize="9.5" fontWeight="700" fill="var(--accent-1)">Today</text>
          </g>
        )}

        {/* Aggregate points (subtle) */}
        {aggSolid.map((p) => (
          <circle key={p.i} cx={p.x} cy={p.y} r={2.2} fill="var(--surface-solid)" stroke="var(--accent-2)" strokeWidth="1.4" />
        ))}
      </svg>
    </div>
  )
}

/* ---------- helpers ---------- */
function addDaysLocal(d, n = 1) {
  const dt = new Date(`${d}T12:00:00`)
  dt.setDate(dt.getDate() + n)
  return dt.toISOString().slice(0, 10)
}

export default function InsightsScreen() {
  const { state } = useStore()
  const today = todayStr()
  const habits = activeHabits(state)
  const [view, setView] = useState('overview')
  const [range, setRange] = useState('30d')

  const hasData = habits.length > 0 && Object.values(state.checkins || {}).some((days) => Object.keys(days || {}).length > 0)

  // Range-driven data.
  const rangeDays = RANGES.find((r) => r.id === range).days
  const trend = useMemo(() => trendSeries(state, rangeDays), [state, rangeDays])

  // Headline signals.
  const last30agg = useMemo(() => {
    let done = 0; let total = 0
    for (const r of trendSeries(state, 30)) { done += r.done; total += r.total }
    return total ? Math.round((done / total) * 100) : null
  }, [state])
  const totalCheckins = useMemo(
    () => Object.values(state.checkins || {}).reduce((n, days) => n + Object.values(days || {}).filter((c) => c?.done).length, 0),
    [state],
  )
  const best = achievements(state)
  // Achievements summary uses the same source AchievementsScreen uses so the
  // "X/Y earned" count and next-up label never diverge from the actual
  // Achievements pillar (FINAL 2E alignment).
  const ach = useMemo(() => achievementSummary(state), [state])
  const top = topStreak(state)
  const cmp = useMemo(() => weekComparison(state), [state])

  // Habits to show on the chart: top N by 30-day completion (eligible≥6 only).
  const chartHabits = useMemo(() => {
    const from = subDaysStr(today, rangeDays - 1)
    const rows = []
    for (const h of habits) {
      let done = 0; let eligible = 0
      let cursor = from
      while (cursor <= today) {
        if (eligibleOn(h, cursor)) {
          eligible++
          if (isDoneCheck(h.id, cursor)) done++
        }
        cursor = addDaysLocal(cursor)
      }
      if (eligible >= Math.min(6, Math.floor(rangeDays / 3))) rows.push({ h, done, eligible, rate: done / eligible })
    }
    rows.sort((a, b) => b.rate - a.rate)
    return rows.slice(0, MAX_HABIT_SERIES).map((r) => r.h)
  }, [habits, today, rangeDays])

  // Smart insights — capped at 4 honest signals.
  const insights = useMemo(() => smartInsights(state, 6).filter((ins) => {
    // Drop the "least consistent" unsupported recommendation already handled in analytics.js;
    // also drop streak-milestone near-misses when no action is possible beyond "keep going".
    if (ins.id.startsWith('streak-')) return false
    return true
  }).slice(0, 4), [state])

  // Weekday / weekend split for interpretation line.
  const split = useMemo(() => weekdayVsWeekend(state, 12), [state])
  const wd = useMemo(() => weekdayPerformance(state, 12), [state])
  const bests = useMemo(() => personalBests(state), [state])
  const moodLink = useMemo(() => moodHabitLink(state, 30), [state])
  const tod = useMemo(() => timeOfDayPerformance(state, 90), [state])

  // Deterministic "where next" link: pick the single clearest action target.
  const nextAction = useMemo(() => {
    if (!wd.enough || !wd.worst) return null
    const weakHabit = consistencyRanking(state, 90).slice(-1)[0]
    if (weakHabit && weakHabit.score <= 45) {
      return { kind: 'habit', href: `habits/${weakHabit.habit.id}`, label: weakHabit.habit.name, copy: `Open ${weakHabit.habit.name}` }
    }
    if (cmp.delta != null && cmp.delta < -5) {
      return { kind: 'week', href: 'habits?view=week', label: 'Week review', copy: 'Open Week review' }
    }
    return null
  }, [wd, state, cmp])

  // Headline completion delta vs previous window (for signal strip).
  const windowDelta = useMemo(() => {
    const cur = trend
    const prevTo = subDaysStr(today, rangeDays)
    const prev = trendSeries(state, rangeDays * 2).slice(0, rangeDays) // oldest half
    const c = cur.filter((r) => r.pct != null)
    const p = prev.filter((r) => r.pct != null && r.date <= prevTo)
    if (!c.length || !p.length) return null
    const cAvg = Math.round(c.reduce((s, r) => s + r.pct, 0) / c.length)
    const pAvg = Math.round(p.reduce((s, r) => s + r.pct, 0) / p.length)
    return { cur: cAvg, prev: pAvg, delta: cAvg - pAvg }
  }, [state, today, rangeDays, trend])

  if (!habits.length) {
    return (
      <div className="screen" id="insights-screen">
        <header className="screen-head">
          <div>
            <h1 className="screen-title">Insights</h1>
            <p className="screen-sub">Pattern, evidence, interpretation.</p>
          </div>
        </header>
        <SectionCard>
          <EmptyState art="art/empty-insights.webp" icon={<IconInsights size={40} />} title="Nothing to analyze yet">
            Add habits and check them off — insights appear as your history grows.
          </EmptyState>
        </SectionCard>
      </div>
    )
  }

  return (
    <div className="screen" id="insights-screen">
      <header className="screen-head">
        <div>
          <h1 className="screen-title">Insights</h1>
          <p className="screen-sub">Signal, evidence, interpretation — all from your own data.</p>
        </div>
      </header>

      <SpatialStage className="insights-stage" focus={1800} parallax={7}>
      <div className="stack insights-layout">
        <div className="insights-view-row">
          <div className="seg seg-wide insights-switch" role="group" aria-label="Insights view">
            {INSIGHT_VIEWS.map((v) => (
              <button
                key={v.id}
                type="button"
                className={`seg-btn${view === v.id ? ' active' : ''}`}
                aria-pressed={view === v.id}
                onClick={() => setView(v.id)}
              >
                {v.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            className={`btn sm insights-lab-btn${view === 'lab' ? ' primary' : ''}`}
            aria-pressed={view === 'lab'}
            onClick={() => setView(view === 'lab' ? 'overview' : 'lab')}
          >
            Advanced
          </button>
        </div>

        {view === 'deep' && <InsightsDeepDive state={state} />}

        {view === 'lab' && (
          <Suspense fallback={<p className="empty-note">Loading advanced analytics…</p>}>
            <AnalyticsLab />
          </Suspense>
        )}

        {view === 'overview' && (
          <div className="insights-overview">

            {/* ------ Signal strip ------ */}
            <div className="ins-signal-strip" aria-label="Current signals">
              <div
                className="ins-signal"
                data-tone={windowDelta == null ? 'neutral' : windowDelta.delta >= 0 ? 'good' : 'warn'}
              >
                <p className="ins-signal-title">Completion</p>
                <p className="ins-signal-value">{last30agg == null ? '—' : `${last30agg}%`}</p>
                <p className="ins-signal-sub">
                  {windowDelta == null
                    ? '30-day average.'
                    : windowDelta.delta === 0
                      ? `Steady versus the prior ${rangeDays} days (${windowDelta.cur}%).`
                      : `${windowDelta.delta > 0 ? 'Up' : 'Down'} ${Math.abs(windowDelta.delta)} pts vs the prior ${rangeDays} days (${windowDelta.prev}% → ${windowDelta.cur}%).`}
                </p>
              </div>
              <div className="ins-signal" data-tone={cmp.delta == null ? 'neutral' : cmp.delta >= 0 ? 'good' : 'warn'}>
                <p className="ins-signal-title">This week</p>
                <p className="ins-signal-value">{cmp.thisWeek.total ? `${cmp.thisWeek.pct}%` : '—'}</p>
                <p className="ins-signal-sub">
                  {cmp.thisWeek.total
                    ? `${cmp.thisWeek.done}/${cmp.thisWeek.total} done${cmp.delta != null ? ` · ${cmp.delta >= 0 ? '+' : ''}${cmp.delta} pts vs last week` : ''}.`
                    : 'No completions logged yet this week.'}
                </p>
              </div>
              <div className="ins-signal" data-tone={top.habit ? 'good' : 'neutral'}>
                <p className="ins-signal-title">Current streak</p>
                <p className="ins-signal-value">{top.habit ? top.streak : '—'}{top.habit ? <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-3)', marginLeft: 4 }}>d</span> : null}</p>
                <p className="ins-signal-sub">{top.habit ? `${top.habit.name} · best ${best.best}d all-time.` : 'No active streak yet.'}</p>
              </div>
              <div className="ins-signal" data-tone="neutral">
                <p className="ins-signal-title">Total</p>
                <p className="ins-signal-value">{totalCheckins}</p>
                <p className="ins-signal-sub">{habits.length} active habit{habits.length === 1 ? '' : 's'} · {bests.totalCheckins ?? totalCheckins} check-ins recorded.</p>
              </div>
            </div>

            {/* ------ Primary multi-series chart (Evidence) ------ */}
            <div className="ins-surface ins-chart-card sp-depth" data-z="2">
              <div className="ins-chart-head">
                <div>
                  <h2>What changed</h2>
                  <p>Aggregate completion %, 7-day rolling average, and your top {chartHabits.length} habit{chartHabits.length === 1 ? '' : 's'} by recent consistency.</p>
                </div>
                <div className="ins-range" role="group" aria-label="Trend range">
                  {RANGES.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      aria-pressed={range === r.id}
                      onClick={() => setRange(r.id)}
                    >{r.label}</button>
                  ))}
                </div>
              </div>

              <PrimaryTrend
                state={state}
                data={trend}
                habits={chartHabits}
                rangeDays={rangeDays}
                today={today}
              />

              <div className="ins-legend" aria-hidden="true">
                <span><i style={{ background: 'var(--accent-2)' }} /> Aggregate</span>
                <span><i className="is-dash" style={{ borderColor: 'var(--text-3)' }} /> 7-day average</span>
                {chartHabits.map((h) => (
                  <span key={h.id}>
                    <i style={{ background: `var(--cat-${h.category || 'mind'})` }} />
                    {h.name}
                  </span>
                ))}
              </div>

              {/* Interpretation line under the chart */}
              <p className="ins-trust">
                <IconSparkle size={13} />
                <span>
                  {(() => {
                    const bits = []
                    if (wd.enough && wd.best && wd.worst && wd.best.weekday !== wd.worst.weekday && (wd.best.rate - wd.worst.rate) >= 0.12) {
                      bits.push(`${wd.best.name}s are your strongest day (${Math.round(wd.best.rate * 100)}%) and ${wd.worst.name}s drop to ${Math.round(wd.worst.rate * 100)}%`)
                    }
                    if (split && Math.abs(split.delta) >= 10) {
                      bits.push(`${split.delta > 0 ? 'weekdays outpace' : 'weekends outpace'} weekdays by ${Math.abs(split.delta)} pts`)
                    }
                    if (tod.enough) {
                      const peak = tod.parts.find((p) => p.id === tod.peak)
                      if (peak) bits.push(`${peak.pct}% of check-ins happen in the ${peak.label.toLowerCase()}`)
                    }
                    if (moodLink) {
                      bits.push(`on good-mood days you complete ${moodLink.goodPct}% of habits vs ${moodLink.lowPct}% on low days (association)`)
                    }
                    if (!bits.length) return 'Keep logging — patterns become clearer as history grows.'
                    return bits.slice(0, 3).join(' · ') + '.'
                  })()}
                </span>
              </p>
            </div>

            {/* ------ Insight cards (Signal → Evidence → Meaning) ------ */}
            <div className="ins-insights">
              {insights.map((ins) => {
                const href = insightHref(ins)
                return (
                  <article key={ins.id} className="ins-insight sp-depth" data-z="1" data-tone={ins.tone || 'neutral'}>
                    <div className="ins-insight-head">
                      <h3 className="ins-insight-title">{ins.title}</h3>
                      {ins.metric && <span className="ins-insight-metric">{ins.metric}</span>}
                    </div>
                    <p className="ins-insight-text">{ins.text}</p>
                    {href && (
                      <Link to={href} className="ins-insight-action">
                        {href.label}
                        <IconChevronRight size={13} />
                      </Link>
                    )}
                  </article>
                )
              })}
              {insights.length === 0 && hasData && (
                <article className="ins-insight" data-tone="neutral">
                  <div className="ins-insight-head"><h3 className="ins-insight-title">Building your picture</h3></div>
                  <p className="ins-insight-text">Not enough history yet to draw reliable patterns. Signals appear once you have a few weeks of consistent check-ins.</p>
                </article>
              )}
            </div>

            {/* ------ Where next (Action) ------ */}
            {nextAction && (
              <div className="ins-surface sp-depth" data-z="1">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ minWidth: 0 }}>
                    <p className="insights-eyebrow">Where to look</p>
                    <p style={{ margin: '2px 0 0', fontWeight: 700, fontSize: 'var(--fs-sm)' }}>{nextAction.copy}</p>
                    <p className="ins-sub">Deterministic nudge — the clearest friction point in your current data.</p>
                  </div>
                  <Link to={nextAction.href} className="btn sm" style={{ flex: 'none' }}>Open <IconChevronRight size={13} /></Link>
                </div>
              </div>
            )}

            {/* ------ Sub-pillars (Mind / Records / Achievements / Advanced) ------ */}
            <div className="ins-pillars" aria-label="Insights sections">
              <Link to="insights?view=mind" className="ins-pillar" data-cat="mind">
                <span className="ins-pillar-icon"><IconMind size={18} /></span>
                <span style={{ minWidth: 0 }}>
                  <p className="ins-pillar-label">Mind</p>
                  <p className="ins-pillar-sub">Daily mood, capacity, reflection</p>
                </span>
              </Link>
              <Link to="insights?view=record" className="ins-pillar" data-cat="record">
                <span className="ins-pillar-icon"><IconRecord size={18} /></span>
                <span style={{ minWidth: 0 }}>
                  <p className="ins-pillar-label">Record</p>
                  <p className="ins-pillar-sub">Timeline of what actually happened</p>
                </span>
              </Link>
              <Link to="insights?view=achievements" className="ins-pillar" data-cat="achievements">
                <span className="ins-pillar-icon"><IconTrophy size={18} /></span>
                <span style={{ minWidth: 0 }}>
                  <p className="ins-pillar-label">Achievements</p>
                  <p className="ins-pillar-sub">{ach.unlocked}/{ach.total} earned · next: {ach.nextUp?.[0]?.title || 'all earned'}</p>
                </span>
              </Link>
              <button type="button" className="ins-pillar" data-cat="advanced" onClick={() => setView('lab')} style={{ appearance: 'none', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit' }}>
                <span className="ins-pillar-icon"><IconInsights size={18} /></span>
                <span style={{ minWidth: 0 }}>
                  <p className="ins-pillar-label">Advanced</p>
                  <p className="ins-pillar-sub">Timelines, trajectories, workload, trends</p>
                </span>
              </button>
            </div>

            <p className="ins-trust" style={{ justifyContent: 'center', textAlign: 'center', marginTop: 4 }}>
              <span>Every finding here is derived from your own logged data — no fabricated trends, no AI coaching.</span>
            </p>
          </div>
        )}
      </div>
      </SpatialStage>
    </div>
  )
}

/* Map an insight id to a deep-link (existing routes only). */
function insightHref(ins) {
  switch (ins.id) {
    case 'weekday-best':
    case 'weekday-worst':
      return { to: 'habits?view=week', label: 'Open Week review' }
    case 'weekend-split':
      return { to: 'habits?view=week', label: 'Week review' }
    case 'improvement':
    case 'most-consistent':
    case 'least-consistent':
      return null // we don't have a habit id here without re-resolving; surface plain text
    case 'time-of-day':
      return { to: 'insights', label: 'Trends' }
    case 'dist-full':
    case 'dist-low':
      return { to: 'insights?view=deep', label: 'See distribution' }
    case 'correlation':
    case 'mood-score':
    case 'mood-energy':
    case 'mood-focus':
    case 'mood-motivation':
      return { to: 'insights?view=mind', label: 'Open Mind' }
    default:
      return null
  }
}
