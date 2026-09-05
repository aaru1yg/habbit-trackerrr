import { useMemo, useState } from 'react'
import { useStore } from '../store.jsx'
import SectionCard, { CardHead } from '../components/ui/SectionCard.jsx'
import AnimatedNumber from '../components/ui/AnimatedNumber.jsx'
import EmptyState from '../components/ui/EmptyState.jsx'
import MiniMonth from '../components/ui/MiniMonth.jsx'
import ProgressRing from '../components/ui/ProgressRing.jsx'
import { TrendChart, Heatmap, HabitMatrix } from '../components/charts/chartKit.jsx'
import { todayStr, subDaysStr, shortDate } from '../lib/dates.js'
import {
  activeHabits, topStreak, achievements, yearOverview, moodHabitLink,
  trendSeries, heatmapSeries, habitMatrix, weekComparison, habitPerformance,
} from '../lib/stats.js'
import { navigate } from '../lib/router.jsx'
import InsightsDeepDive from './InsightsDeepDive.jsx'
import { IconInsights, IconTrendUp, IconTrendDown, IconFlame } from '../lib/icons.jsx'

const YEAR = new Date().getFullYear()
const RANGES = [
  { id: '7d', label: '7D', days: 7 },
  { id: '30d', label: '30D', days: 30 },
  { id: '90d', label: '90D', days: 90 },
  { id: '1y', label: '1Y', days: 365 },
]

const INSIGHT_VIEWS = [
  { id: 'overview', label: 'Overview' },
  { id: 'deep', label: 'Deep dive' },
]

export default function InsightsScreen() {
  const { state } = useStore()
  const today = todayStr()
  const habits = activeHabits(state)
  const [view, setView] = useState('overview')

  const hasData = habits.length > 0 && Object.values(state.checkins || {}).some((days) => Object.keys(days || {}).length > 0)

  // ---- hero: 30-day ring + streaks ----
  const last30 = useMemo(() => {
    let done = 0
    let total = 0
    for (const r of trendSeries(state, 30)) {
      done += r.done
      total += r.total
    }
    return total ? Math.round((done / total) * 100) : null
  }, [state])

  const totalCheckins = useMemo(
    () => Object.values(state.checkins || {}).reduce((n, days) => n + Object.values(days || {}).filter((c) => c?.done).length, 0),
    [state]
  )
  const best = achievements(state)
  const top = topStreak(state)

  // ---- trend (range switch) ----
  const [range, setRange] = useState('30d')
  const rangeDays = RANGES.find((r) => r.id === range).days
  const trend = useMemo(() => trendSeries(state, rangeDays), [state, rangeDays])

  // ---- this week vs last ----
  const cmp = useMemo(() => weekComparison(state), [state])

  // ---- sortable habit performance ----
  const [sort, setSort] = useState({ key: 'rate', dir: 'desc' })
  const perf = useMemo(() => {
    const rows = habitPerformance(state, subDaysStr(today, 29), today)
    const dir = sort.dir === 'asc' ? 1 : -1
    const value = (r) => {
      if (sort.key === 'name') return r.habit.name.toLowerCase()
      if (sort.key === 'streak') return r.streak
      if (sort.key === 'best') return r.best
      return r.rate ?? -1
    }
    return [...rows].sort((a, b) => {
      const va = value(a)
      const vb = value(b)
      if (va < vb) return -1 * dir
      if (va > vb) return 1 * dir
      return 0
    })
  }, [state, today, sort])

  const toggleSort = (key) => setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' }))

  // ---- heatmap (GitHub-style) ----
  const weeks = useMemo(() => heatmapSeries(state, 52), [state])

  // ---- habit × day matrix (last 28 days) ----
  const matrixDays = useMemo(() => {
    const out = []
    for (let i = 27; i >= 0; i--) out.push(subDaysStr(today, i))
    return out
  }, [today])
  const matrixRows = useMemo(() => habitMatrix(state, matrixDays), [state, matrixDays])
  const weekLabels = useMemo(() => {
    const out = []
    for (let i = 0; i < matrixDays.length; i += 7) {
      out.push({ label: shortDate(matrixDays[i]), span: Math.min(7, matrixDays.length - i) })
    }
    return out
  }, [matrixDays])

  // ---- year overview / mood ----
  const year = useMemo(() => yearOverview(state, YEAR), [state])
  const yearsWithData = year.some((m) => m.anyEligible)
  const moodLink = useMemo(() => moodHabitLink(state, 30), [state])

  if (!habits.length) {
    return (
      <div className="screen" id="insights-screen">
        <header className="screen-head">
          <div>
            <h1 className="screen-title">Insights</h1>
            <p className="screen-sub">Your numbers, straight from your data.</p>
          </div>
        </header>
        <SectionCard>
          <EmptyState icon={<IconInsights size={40} />} title="Nothing to analyze yet">
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
          <p className="screen-sub">Every number here comes from your own check-ins.</p>
        </div>
      </header>

      <div className="stack">
        <div className="seg seg-wide" role="group" aria-label="Insights view">
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

        {view === 'deep' && <InsightsDeepDive state={state} />}

        {view === 'overview' && (
        <>
        {/* Hero: ring + streaks */}
        <SectionCard className="pad">
          <div className="insights-grid">
            <div className="insights-ring">
              <ProgressRing pct={last30} size={148} stroke={11} label={last30 == null ? 'No completion data yet' : `${last30} percent completion over 30 days`}>
                <div>
                  <p className="eyebrow">30-day</p>
                  <p className="stat-value" style={{ marginTop: 2 }}>
                    {last30 == null ? '—' : <><AnimatedNumber value={last30} />%</>}
                  </p>
                </div>
              </ProgressRing>
            </div>
            <div className="insights-stat">
              <p className="eyebrow">Best streak</p>
              <p className="insights-stat-value"><AnimatedNumber value={best.best} /><span className="u">days</span></p>
            </div>
            <div className="insights-stat">
              <p className="eyebrow">Current streak</p>
              <p className="insights-stat-value">
                {top.habit ? <><AnimatedNumber value={top.streak} /><span className="u">days</span></> : '—'}
              </p>
              {top.habit && <p className="insights-stat-sub">{top.habit.name}</p>}
            </div>
            <div className="insights-stat">
              <p className="eyebrow">Active habits</p>
              <p className="insights-stat-value"><AnimatedNumber value={habits.length} /></p>
            </div>
            <div className="insights-stat">
              <p className="eyebrow">Total check-ins</p>
              <p className="insights-stat-value"><AnimatedNumber value={totalCheckins} /></p>
            </div>
          </div>
        </SectionCard>

        {/* Trend */}
        <SectionCard className="pad">
          <CardHead title="Completion trend" />
          <div className="seg seg-wide" role="group" aria-label="Trend range">
            {RANGES.map((r) => (
              <button
                key={r.id}
                type="button"
                className={`seg-btn${range === r.id ? ' active' : ''}`}
                aria-pressed={range === r.id}
                onClick={() => setRange(r.id)}
              >
                {r.label}
              </button>
            ))}
          </div>
          {hasData ? (
            <TrendChart data={trend} />
          ) : (
            <p className="empty-note">No check-ins yet — this chart fills in as you go.</p>
          )}
        </SectionCard>

        {/* This week vs last week */}
        <SectionCard className="pad">
          <CardHead title="This week vs last week" />
          <div className="vs">
            <div className="vs-block">
              <p className="vs-label">This week</p>
              <p className="vs-value">{cmp.thisWeek.total ? `${cmp.thisWeek.pct}%` : '—'}</p>
              <p className="vs-sub">{cmp.thisWeek.done} of {cmp.thisWeek.total} done</p>
            </div>
            <div className="vs-block">
              <p className="vs-label">Last week</p>
              <p className="vs-value">{cmp.lastWeek.total ? `${cmp.lastWeek.pct}%` : '—'}</p>
              <p className="vs-sub">{cmp.lastWeek.done} of {cmp.lastWeek.total} done</p>
            </div>
            <div className={`vs-block vs-delta ${cmp.delta == null ? 'none' : cmp.delta >= 0 ? 'up' : 'down'}`}>
              <p className="vs-label">Change</p>
              <p className="vs-value">
                {cmp.delta == null ? '—' : (
                  <>
                    {cmp.delta >= 0 ? <IconTrendUp size={18} /> : <IconTrendDown size={18} />}
                    {Math.abs(cmp.delta)}%
                  </>
                )}
              </p>
              <p className="vs-sub">{cmp.delta == null ? 'not enough data' : cmp.delta >= 0 ? 'up from last week' : 'down from last week'}</p>
            </div>
          </div>
        </SectionCard>

        {/* Sortable habit performance */}
        <SectionCard className="pad">
          <CardHead title="Habit performance">
            <span className="perf-window">last 30 days</span>
          </CardHead>
          <div className="perf" aria-label="Habit performance">
            <div className="perf-row perf-head">
              <button type="button" className="perf-cell perf-name" aria-label="Sort by habit name" onClick={() => toggleSort('name')}>
                Habit{sort.key === 'name' ? (sort.dir === 'asc' ? ' ↑' : ' ↓') : ''}
              </button>
              <button type="button" className="perf-cell tnum" aria-label="Sort by 30 day rate" onClick={() => toggleSort('rate')}>
                30d{sort.key === 'rate' ? (sort.dir === 'asc' ? ' ↑' : ' ↓') : ''}
              </button>
              <button type="button" className="perf-cell tnum" aria-label="Sort by current streak" onClick={() => toggleSort('streak')}>
                Streak{sort.key === 'streak' ? (sort.dir === 'asc' ? ' ↑' : ' ↓') : ''}
              </button>
              <button type="button" className="perf-cell tnum" aria-label="Sort by best streak" onClick={() => toggleSort('best')}>
                Best{sort.key === 'best' ? (sort.dir === 'asc' ? ' ↑' : ' ↓') : ''}
              </button>
            </div>
            {perf.map(({ habit, rate, done, eligible, streak, best }) => (
              <div className="perf-row" key={habit.id}>
                <div className="perf-cell perf-name">
                  <span className="perf-bar" style={{ width: `${Math.round((rate ?? 0) * 100)}%` }} aria-hidden="true" />
                  <span className="perf-name-text">{habit.name}</span>
                </div>
                <div className="perf-cell tnum">
                  {rate == null ? '—' : `${Math.round(rate * 100)}%`}
                  <span className="perf-sub">{done}/{eligible}</span>
                </div>
                <div className="perf-cell tnum"><IconFlame size={13} /> {streak}</div>
                <div className="perf-cell tnum">{best}</div>
              </div>
            ))}
            {perf.length === 0 && <p className="empty-note">No habits with enough history yet.</p>}
          </div>
        </SectionCard>

        {/* Heatmap */}
        <SectionCard className="pad">
          <CardHead title="Activity heatmap" />
          <p className="card-blurb">Tap any day for details.</p>
          <Heatmap weeks={weeks} />
        </SectionCard>

        {/* Habit × day matrix */}
        <SectionCard className="pad">
          <CardHead title="Habit × day" />
          <p className="card-blurb">Last 28 days · tap is read-only on this screen.</p>
          <HabitMatrix rows={matrixRows} days={matrixDays} weekLabels={weekLabels} />
        </SectionCard>

        {/* Year overview */}
        <SectionCard className="pad">
          <CardHead title={`${YEAR} at a glance`} />
          {yearsWithData ? (
            <>
              <div className="mini-grid">
                {year.map((m) => (
                  <MiniMonth key={m.month} year={YEAR} month={m.month} cells={m.cells} onSelect={(y, mo) => navigate(`calendar/${y}-${String(mo + 1).padStart(2, '0')}`)} />
                ))}
              </div>
              <p className="card-blurb" style={{ marginTop: 12 }}>Tap a month to open it in the calendar.</p>
            </>
          ) : (
            <p className="empty-note">Your {YEAR} heatmap appears once you start checking off habits.</p>
          )}
        </SectionCard>

        {/* Achievements */}
        <SectionCard className="pad">
          <CardHead title="Achievements" />
          <div className="badge-grid">
            {best.badges.map((b) => (
              <div
                key={b.id}
                className={`badge ${b.earned ? 'earned' : ''}`}
              >
                <BadgeArt id={b.id} earned={b.earned} />
                <div style={{ minWidth: 0 }}>
                  <p className="badge-title">{b.label}</p>
                  <p className="badge-sub">{b.earned ? 'Earned' : b.blurb}</p>
                </div>
              </div>
            ))}
          </div>
          {best.next && (
            <p className="next-badge">
              <IconTrendUp size={14} />
              {best.next.threshold - best.best} more streak day{best.next.threshold - best.best === 1 ? '' : 's'} to reach {best.next.label}.
            </p>
          )}
        </SectionCard>

        {/* Mood link */}
        {moodLink && (
          <SectionCard className="pad">
            <CardHead title="Mood and habits" />
            <p className="card-blurb">
              On days you felt good, you completed <b className="tnum" style={{ color: 'var(--good)' }}>{moodLink.goodPct}%</b> of your habits.
              On low days, <b className="tnum" style={{ color: 'var(--warn)' }}>{moodLink.lowPct}%</b>. (Last 30 days.)
            </p>
          </SectionCard>
        )}

        <SectionCard className="pad">
          <div className="row-between">
            <p className="card-blurb" style={{ margin: 0 }}>
              Weekday patterns, consistency scores, streak history and what tends to travel together.
            </p>
            <button className="btn sm" onClick={() => setView('deep')}>Deep dive</button>
          </div>
        </SectionCard>
        </>
        )}
      </div>
    </div>
  )
}

/* Badge artwork (generated) with graceful fallback. */
function BadgeArt({ id, earned }) {
  const [failed, setFailed] = useState(false)
  if (failed) {
    return (
      <span
        aria-hidden="true"
        className="badge-fallback"
        style={{ background: earned ? 'linear-gradient(135deg, var(--accent-1), var(--accent-2))' : 'var(--surface-3)' }}
      />
    )
  }
  return (
    <img
      src={`art/badge-${id}.webp`}
      alt=""
      width={34}
      height={34}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className="badge-img"
      style={{ filter: earned ? 'none' : 'grayscale(0.9) opacity(0.6)' }}
    />
  )
}
