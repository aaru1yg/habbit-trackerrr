/* ============================================================
   HABIT DETAIL (Step 4C) — deep entity view for one habit.

   Hierarchy:
     1. IDENTITY     back link · name · category dot · schedule/reminder · Edit
     2. STATE        ring · today status · primary Complete/Undo
     3. EVIDENCE     metrics strip + range heatmap (real history)
     4. PATTERNS     honest observation/evidence/implication cards
                     (habitPatterns.js); weekday/time breakdown collapsed
     5. HISTORY      streak runs (top 5); all runs + notes in details
     6. SCHEDULE     cadence / reminder / start / state
     7. MANAGEMENT   Edit · Pause · Archive · Delete (confirmed)

   All data derives from existing analytics/stats/schedule engines;
   no new metrics are invented. Reducers/actions are reused verbatim.
   ============================================================ */
import { useMemo, useState } from 'react'
import { useStore } from '../store.jsx'
import { useHabitUI } from '../components/habits/HabitUIProvider.jsx'
import { useHabitActions } from '../components/habits/HabitActions.jsx'
import '../styles/habit-detail.css'
import Burst from '../components/motion/Burst.jsx'
import { habitDetail, consistencyLabel } from '../lib/analytics.js'
import { heatmapSeries, checkinOf, eligibleOn, isDone } from '../lib/stats.js'
import { habitPatterns } from '../lib/habitPatterns.js'
import { patternCards, NOT_ENOUGH } from '../components/habits/habitPatternsView.js'
import { Heatmap } from '../components/charts/chartKit.jsx'
import { HBarList, Sparkline } from '../components/charts/workCharts.jsx'
import Button from '../components/primitives/Button.jsx'
import IconButton from '../components/primitives/IconButton.jsx'
import { Status } from '../components/primitives/index.js'
import { describeHabit } from '../components/habits/habitRowModel.js'
import { categoryOf, scheduleLabel, WEEKDAY_NAMES } from '../lib/schedule.js'
import { prettyDate, todayStr, shortDate, subDaysStr } from '../lib/dates.js'
import { Link, navigate } from '../lib/router.jsx'
import {
  IconChevronLeft, IconFlame, IconClock, IconCalendar, IconLayers,
  IconCheck, IconTrash, IconArchive, IconPencil, IconPlus,
} from '../lib/icons.jsx'

const RANGES = [
  { id: 30, label: '30D' },
  { id: 60, label: '60D' },
  { id: 90, label: '90D' },
]

export default function HabitDetailScreen({ id }) {
  const { state } = useStore()
  const habitUI = useHabitUI()
  const actions = useHabitActions()
  const [days, setDays] = useState(90)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [burst, setBurst] = useState(0)
  const today = todayStr()
  const now = useMemo(() => new Date(), [])

  const habit = useMemo(() => (state.habits || []).find((h) => h.id === id) || null, [state.habits, id])
  const detail = useMemo(() => habitDetail(state, habit, days), [state, habit, days])
  const row = useMemo(() => (habit ? describeHabit(state, habit, today) : null), [state, habit, today])
  const heat = useMemo(
    () => habit ? heatmapSeries({ ...state, habits: [habit] }, Math.ceil(days / 7) + 1) : [],
    [state, habit, days],
  )
  const patterns = useMemo(() => (habit ? habitPatterns(state, habit) : null), [state, habit])
  const cards = useMemo(() => patternCards(patterns, habit?.name), [patterns, habit])

  // Reference metric strip — all real: total completed check-ins, cadence,
  // and the habit's own target time when it has one.
  const totalDone = useMemo(() => (
    habit ? Object.values(state.checkins?.[habit.id] || {}).filter((c) => c?.done === true).length : 0
  ), [state, habit])

  // This month: done vs eligible days so far (real engines, no projections).
  const monthInfo = useMemo(() => {
    if (!habit) return null
    const d = now
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    let done = 0, eligible = 0
    for (let i = 1; i <= 31; i++) {
      const date = `${ym}-${String(i).padStart(2, '0')}`
      if (date > today) break
      if (!eligibleOn(habit, date)) continue
      eligible++
      if (isDone(state, habit.id, date)) done++
    }
    return { done, eligible, pct: eligible ? Math.round((100 * done) / eligible) : null }
  }, [state, habit, today, now])

  // Recent activity: the last eligible days, honestly labelled.
  const recent = useMemo(() => {
    if (!habit) return []
    const rows = []
    for (let i = 0; i < 21 && rows.length < 4; i++) {
      const date = subDaysStr(today, i)
      if (!eligibleOn(habit, date)) continue
      const entry = checkinOf(state, habit.id, date)
      const done = entry?.done === true
      let at = null
      if (done && entry.at) {
        if (typeof entry.at === 'string' && entry.at.includes('T')) {
          at = new Date(entry.at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
        } else if (/^\d{2}:\d{2}/.test(String(entry.at))) {
          at = formatReminder(String(entry.at).slice(0, 5))
        }
      }
      rows.push({ date, done, at })
    }
    return rows
  }, [state, habit, today])

  const scrollTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  if (!habit) {
    return (
      <main className="screen habits-screen habit-detail" id="habit-detail-screen">
        <header className="habits-head">
          <div>
            <h1 className="screen-title">Habit not found</h1>
            <p className="screen-sub">This habit may have been deleted.</p>
          </div>
        </header>
        <section className="hd-section">
          <Button as={Link} to="habits" variant="primary" icon={<IconChevronLeft size={16} />}>Back to habits</Button>
        </section>
      </main>
    )
  }

  const cat = categoryOf(habit.category)
  const { status, done, scheduledToday, paused, archived, miss, streak: currentStreak, atRisk } = row

  const complete = () => {
    if (!done) { setBurst((b) => b + 1); habitUI?.fire?.() }
    actions.log(habit, today, { done })
  }

  // Step 4G-2B: small 28px identity ring (same stroke language as HabitObject
  // compact). No giant hero ring — the habit name is the hero.
  const isize = 28, istroke = 2.5, ir = (isize - istroke) / 2, icirc = 2 * Math.PI * ir, idash = icirc * (1 - (done ? 1 : 0))
  const rate = detail.rate
  const pct = rate?.rate != null ? Math.round(rate.rate * 100) : null
  const weekdayRows = (detail.weekdays || []).filter((w) => w.rate != null).map((w) => ({ label: w.label, value: Math.round(w.rate * 100) }))
  const trendValues = (detail.trend || []).filter((t) => t.scheduled).map((t) => (t.pct ? 1 : 0))
  const streaks = detail.streaks?.runs ?? []
  const best = detail.best || 0

  const statusTone = status.tone === 'neutral' ? undefined : status.tone
  const stateClass = [
    done && 'is-done',
    paused && 'is-paused',
    archived && 'is-archived',
    atRisk && !done && 'is-atrisk',
  ].filter(Boolean).join(' ')

  const todayDesc =
    archived ? 'Archived — not scheduled.'
      : paused ? `Paused${row.pausedUntil ? ` until ${shortDate(row.pausedUntil)}` : ''}.`
        : scheduledToday
          ? (done ? 'Completed today.' : 'Scheduled for today.')
          : row.next ? `Next ${row.next.label}.` : 'Not scheduled today.'

  return (
    <main className="screen habits-screen habit-detail" id="habit-detail-screen"
      data-status={status.id}
      style={{ '--cat-color': `var(${cat.cssVar})` }}>

      {/* 1. IDENTITY HEADER — compact, typography-led (Step 4G-2B) */}
      <header className="hd-hero" data-status={status.id}>
        <button type="button" className="hd-back" onClick={() => navigate('habits')}>
          <IconChevronLeft size={14} /> Habits
        </button>
        <div className="hd-hero__identity">
          <span className="hd-idtile" style={{ '--cat-color': `var(${cat.cssVar})` }} aria-hidden="true">
            <span className="hd-idtile__initial">{(habit.name || '?').slice(0, 1).toUpperCase()}</span>
            <span className={`hd-identity__ring${done ? ' is-done' : ''}${paused ? ' is-paused' : ''}${archived ? ' is-archived' : ''}`}>
              <svg width={isize} height={isize} viewBox={`0 0 ${isize} ${isize}`} focusable="false" aria-hidden="true">
                <circle className="hd-identity__ring-track" cx={isize/2} cy={isize/2} r={ir} />
                <circle className="hd-identity__ring-fill" cx={isize/2} cy={isize/2} r={ir}
                  strokeDasharray={icirc} strokeDashoffset={idash}
                  transform={`rotate(-90 ${isize/2} ${isize/2})`} />
              </svg>
              <span className="hd-identity__ring-dot" />
              <span className="hd-identity__ring-mark"><IconCheck size={16} aria-hidden="true" /></span>
            </span>
          </span>
          <div className="hd-hero__text" style={{ minWidth: 0 }}>
            <div className="hd-hero__eyebrow">
              <span className="hd-sub__dot" style={{ background: `var(${cat.cssVar})` }} />
              <span>{cat.label}</span>
              {currentStreak > 0 && (
                <span className="hd-hero__streak">
                  <IconFlame size={11} aria-hidden="true" />
                  <span className="tnum">{currentStreak}</span>d streak
                </span>
              )}
            </div>
            <h1 className="hd-title">{habit.name}</h1>
            <p className="hd-sub">
              <span>{scheduleLabel(habit)}</span>
              {habit.reminder && (<><span aria-hidden="true"> · </span><span>{formatReminder(habit.reminder)}</span></>)}
            </p>
            {typeof habit.notes === 'string' && habit.notes.trim() && (
              <p className="hd-hero__line">{habit.notes.trim()}</p>
            )}
          </div>
          <div className="head-actions">
            <IconButton label={`Edit ${habit.name}`} onClick={() => habitUI.openEdit(habit)} icon={<IconPencil size={16} />} />
          </div>
        </div>

        {/* 2. CURRENT STATE + PRIMARY ACTION — flat row, no giant card/ring */}
        <div className={`hd-state ${stateClass}`}>
          <h2 className="hd-state__title" id="hd-today-title">Today</h2>
          <span className="hd-state__label" aria-labelledby="hd-today-title">
            <Status tone={statusTone}>{status.label}</Status>
          </span>
          <p className="hd-state__desc">{todayDesc}</p>
          <span className="hd-state__primary">
            {scheduledToday && !archived ? (
              <>
                <Burst fire={burst} count={10} spread={34} size={4} />
                <Button
                  variant={done ? 'quiet' : 'primary'}
                  className={`hrow-complete${done ? ' is-done' : ''}`}
                  onClick={complete}
                  aria-pressed={done}
                  aria-label={`Mark ${habit.name} as ${done ? 'not complete' : 'complete'}`}
                  icon={done ? <IconCheck size={15} aria-hidden="true" /> : null}
                >
                  {done ? 'Completed' : 'Complete'}
                </Button>
              </>
            ) : paused && !archived ? (
              <Button variant="secondary" onClick={() => actions.togglePause(habit)}>Resume</Button>
            ) : archived ? (
              <Button variant="quiet" onClick={() => actions.archive(habit)}>Restore</Button>
            ) : null}
          </span>
        </div>
      </header>

      {/* Reference metric strip — streak / total / cadence / target (all real). */}
      <div className="hd-metrics" role="list" aria-label="Key numbers">
        <div className="hd-metric" role="listitem">
          <span className="hd-metric__label"><IconFlame size={12} aria-hidden="true" /> Day streak</span>
          <span className="hd-metric__value">{currentStreak}</span>
        </div>
        <div className="hd-metric" role="listitem">
          <span className="hd-metric__label"><IconCheck size={12} aria-hidden="true" /> Total completed</span>
          <span className="hd-metric__value">{totalDone}</span>
        </div>
        <div className="hd-metric" role="listitem">
          <span className="hd-metric__label"><IconCalendar size={12} aria-hidden="true" /> Frequency</span>
          <span className="hd-metric__value hd-metric__value--text">{scheduleLabel(habit)}</span>
        </div>
        <div className="hd-metric" role="listitem">
          <span className="hd-metric__label"><IconClock size={12} aria-hidden="true" /> Target time</span>
          <span className="hd-metric__value hd-metric__value--text">{habit.estimateMin ? `${habit.estimateMin} min` : '—'}</span>
        </div>
      </div>

      {/* Reference segmented navigation — anchors over the real sections. */}
      <nav className="hd-anchornav" aria-label="Detail sections">
        <button type="button" onClick={() => scrollTo('habit-detail-screen')}>Overview</button>
        <button type="button" onClick={() => scrollTo('hd-sec-performance')}>Calendar</button>
        <button type="button" onClick={() => scrollTo('hd-sec-history')}>History</button>
        <button type="button" onClick={() => scrollTo('hd-sec-manage')}>Manage</button>
      </nav>

      {miss && !archived && !paused && scheduledToday && !done &&(
        <div className="hd-missed">
          <span>Missed {miss.label}.</span>
          <Button variant="quiet" size="sm" onClick={() => actions.log(habit, miss.date)} aria-label={`Log ${habit.name} for ${miss.label}`}>
            Log it
          </Button>
        </div>
      )}
      {miss && !archived && !paused && !scheduledToday && (
        <div className="hd-missed">
          <span style={{ color: 'var(--text-3)' }}>Not scheduled today.</span>
          <Button variant="quiet" size="sm" onClick={() => actions.log(habit, miss.date)} aria-label={`Log ${habit.name} for ${miss.label}`}>
            <IconPlus size={14} aria-hidden="true" /> Log {miss.label}
          </Button>
        </div>
      )}

      {/* 4. PERFORMANCE EVIDENCE */}
      <section className="hd-section" id="hd-sec-performance" aria-labelledby="hd-evidence-title">
        <div className="hd-section__head">
          <h2 className="hd-section__title" id="hd-evidence-title">Performance</h2>
          <div className="hd-range" role="group" aria-label="Date range">
            {RANGES.map((r) => (
              <button key={r.id} type="button" aria-pressed={days === r.id} onClick={() => setDays(r.id)}>{r.label}</button>
            ))}
          </div>
        </div>

        <p className="hd-summary-line">
          {pct == null
            ? <>Not enough scheduled days yet to show a rate.</>
            : detail.delta == null
              ? <>Completed <strong>{pct}%</strong> of scheduled days in the last {days} days.</>
              : detail.delta === 0
                ? <>Completed <strong>{pct}%</strong> — level with the previous {days} days.</>
                : <>Completed <strong>{pct}%</strong> — <span style={{ color: detail.delta > 0 ? 'var(--good)' : 'var(--warn)' }}>{detail.delta > 0 ? 'up' : 'down'} {Math.abs(detail.delta)} points</span> on the previous {days} days.</>}
        </p>

        <div className="hd-evidence" role="list">
          <Metric label="Current streak" value={detail.streak} unit={detail.streak === 1 ? 'day' : 'days'} tone={atRisk ? 'warn' : undefined} />
          <Metric label="Best streak" value={best} unit={best === 1 ? 'day' : 'days'} />
          <Metric label={`Last ${days} days`} value={pct == null ? '—' : `${pct}%`}
                  sub={pct == null ? 'no eligible days' : `${rate.done} of ${rate.eligible}`}
                  tone={pct != null && pct >= 80 ? 'good' : undefined} />
          <Metric label="Consistency"
                  value={detail.consistency?.enough ? detail.consistency.score : '—'}
                  sub={detail.consistency?.enough ? consistencyLabel(detail.consistency.score) : 'not enough data'} />
        </div>

        {trendValues.length > 2 && (
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom: 12, color:'var(--text-3)', fontSize:'var(--fs-xs)' }}>
            <Sparkline values={trendValues} width={180} height={28} color={`var(${cat.cssVar})`} />
            <span>Scheduled days, oldest → newest</span>
          </div>
        )}

        <div className="hd-evidence-grid">
          <div className="hd-heatmap">
            <Heatmap weeks={heat} ariaLabel={`${habit.name} completion heatmap`} />
          </div>
          {monthInfo && monthInfo.pct != null && (
            <div className="hd-month" aria-label={`This month: ${monthInfo.pct}% (${monthInfo.done} of ${monthInfo.eligible} days)`}>
              <h3 className="hd-month__title">This month</h3>
              <span className="hd-month__ring" aria-hidden="true">
                <svg viewBox="0 0 44 44" focusable="false">
                  <circle className="hd-month__track" cx="22" cy="22" r="18" fill="none" strokeWidth="4.5" />
                  <circle
                    className="hd-month__arc"
                    cx="22" cy="22" r="18" fill="none" strokeWidth="4.5" strokeLinecap="round"
                    strokeDasharray={`${Math.round((monthInfo.pct / 100) * 113.1)} 113.1`}
                    transform="rotate(-90 22 22)"
                  />
                </svg>
                <span className="hd-month__pct">{monthInfo.pct}%</span>
              </span>
              <span className="hd-month__meta tnum">{monthInfo.done} of {monthInfo.eligible} days</span>
            </div>
          )}
        </div>
      </section>

      {/* 6b. RECENT ACTIVITY — the last eligible days, real states. */}
      {recent.length > 0 && (
        <section className="hd-section" aria-labelledby="hd-activity-title">
          <div className="hd-section__head">
            <h2 className="hd-section__title" id="hd-activity-title">Recent activity</h2>
          </div>
          <ul className="hd-activity" role="list">
            {recent.map((r) => (
              <li key={r.date} className="hd-activity__row" data-done={r.done ? 'true' : 'false'}>
                <span className="hd-activity__mark" aria-hidden="true">{r.done ? '✓' : '×'}</span>
                <span className="hd-activity__label">{r.done ? 'Completed' : 'Missed'}</span>
                <span className="hd-activity__when tnum">{prettyDate(r.date)}{r.at ? ` · ${r.at}` : ''}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 6. PATTERNS */}
      <section className="hd-section" aria-labelledby="hd-patterns-title">
        <div className="hd-section__head">
          <h2 className="hd-section__title" id="hd-patterns-title">Patterns</h2>
          <span className="hd-section__meta">from your check-ins</span>
        </div>
        {cards.length === 0 ? (
          <p className="hd-summary-line">{NOT_ENOUGH}</p>
        ) : (
          <div>
            {cards.map((c) => (
              <article key={c.id} className="hd-pattern" data-pattern={c.id}>
                <p className="hd-pattern__obs">{c.observation}</p>
                <dl className="hd-pattern__dl">
                  <dt>Evidence</dt><dd>{c.evidence}</dd>
                  <dt>Implication</dt><dd>{c.implication}</dd>
                </dl>
              </article>
            ))}
          </div>
        )}

        {(weekdayRows.length > 0 || detail.times?.enough) && (
          <details className="hd-details">
            <summary>Breakdown by weekday and time of day</summary>
            <div className="hd-breakdown">
              {weekdayRows.length > 0 && (
                <div>
                  <p className="hd-section__meta" style={{ display:'inline-flex', alignItems:'center', gap:4, marginBottom:8 }}>
                    <IconCalendar size={12} /> By weekday · last 12 weeks
                  </p>
                  <HBarList rows={weekdayRows} max={100} unit="%" />
                </div>
              )}
              {detail.times?.enough && (
                <div>
                  <p className="hd-section__meta" style={{ display:'inline-flex', alignItems:'center', gap:4, marginBottom:8 }}>
                    <IconClock size={12} /> When you log it · {detail.times.total} completions
                  </p>
                  <HBarList
                    rows={detail.times.parts.map((p) => ({ label: p.label, value: p.count }))}
                    max={Math.max(...detail.times.parts.map((p) => p.count))}
                  />
                </div>
              )}
            </div>
          </details>
        )}
      </section>

      {/* 7. HISTORY */}
      <section className="hd-section" id="hd-sec-history" aria-labelledby="hd-history-title">
        <div className="hd-section__head">
          <h2 className="hd-section__title" id="hd-history-title">History</h2>
          {best > 0 && <span className="hd-section__meta"><IconFlame size={12} /> best {best}</span>}
        </div>
        {streaks.length === 0 ? (
          <p className="hd-summary-line">No completed streaks recorded yet.</p>
        ) : (
          <div className="hd-streak-list" role="list">
            {streaks.slice(0, 5).map((s, i) => (
              <div key={`${s.start}-${i}`} className="hd-streak-row" role="listitem">
                <span className="hd-streak-len tnum">{s.length}d</span>
                <span className="hd-streak-bar" style={{ ['--w']: `${Math.max(8, (s.length / Math.max(1, best)) * 100)}%` }} />
                <span className="hd-streak-range">{prettyDate(s.start)}{s.end !== s.start ? ` → ${prettyDate(s.end)}` : ''}</span>
                {s.current && <span className="hd-streak-current">current</span>}
              </div>
            ))}
          </div>
        )}

        {(streaks.length > 5 || detail.notes.length > 0) && (
          <details className="hd-details">
            <summary>
              {streaks.length > 5 ? `All ${streaks.length} streaks` : 'Notes'}
              {streaks.length > 5 && detail.notes.length > 0 ? ' & notes' : ''}
            </summary>
            {streaks.length > 5 && (
              <div className="hd-streak-list" style={{ marginTop: 10 }}>
                {streaks.slice(5).map((s, i) => (
                  <div key={`${s.start}-${i}`} className="hd-streak-row">
                    <span className="hd-streak-len tnum">{s.length}d</span>
                    <span className="hd-streak-bar" style={{ ['--w']: `${Math.max(8, (s.length / Math.max(1, best)) * 100)}%` }} />
                    <span className="hd-streak-range">{prettyDate(s.start)}{s.end !== s.start ? ` → ${prettyDate(s.end)}` : ''}</span>
                  </div>
                ))}
              </div>
            )}
            {detail.notes.length > 0 && (
              <div style={{ marginTop: streaks.length > 5 ? 14 : 0 }}>
                <p className="hd-section__meta" style={{ marginBottom: 6 }}>Notes</p>
                {detail.notes.map((n) => (
                  <div key={n.date} className="hd-note">
                    <div className="hd-note__date">{prettyDate(n.date)}</div>
                    <p>{n.note}</p>
                  </div>
                ))}
              </div>
            )}
          </details>
        )}

        {detail.notes.length > 0 && streaks.length <= 5 && (
          <details className="hd-details">
            <summary>Notes ({detail.notes.length})</summary>
            <div>
              {detail.notes.map((n) => (
                <div key={n.date} className="hd-note">
                  <div className="hd-note__date">{prettyDate(n.date)}</div>
                  <p>{n.note}</p>
                </div>
              ))}
            </div>
          </details>
        )}
      </section>

      {/* 9. SCHEDULE */}
      <section className="hd-section" aria-labelledby="hd-schedule-title">
        <div className="hd-section__head">
          <h2 className="hd-section__title" id="hd-schedule-title">Schedule</h2>
          <Button variant="quiet" size="sm" onClick={() => habitUI.openEdit(habit)} icon={<IconPencil size={13} />}>Change</Button>
        </div>
        <dl className="hd-facts">
          <div className="hd-fact"><dt>Cadence</dt><dd>{scheduleLabel(habit)}{habit.schedule?.type === 'weekdays' && Array.isArray(habit.schedule.days) ? ` (${habit.schedule.days.map((d) => WEEKDAY_NAMES[d]).join(', ')})` : ''}</dd></div>
          <div className="hd-fact"><dt>Reminder</dt><dd>{habit.reminder || 'None'}</dd></div>
          <div className="hd-fact"><dt>Started</dt><dd>{habit.createdAt ? prettyDate(habit.createdAt) : 'Unknown'}</dd></div>
          <div className="hd-fact"><dt>State</dt><dd>{archived ? 'Archived' : paused ? `Paused${row.pausedUntil ? ` until ${prettyDate(row.pausedUntil)}` : ''}` : 'Active'}</dd></div>
          {Array.isArray(habit.skips) && habit.skips.length > 0 && (
            <div className="hd-fact"><dt>Skipped days</dt><dd>{habit.skips.length} (not counted as misses)</dd></div>
          )}
        </dl>
        {(detail.linkedProjects?.length > 0 || detail.routines?.length > 0) && (
          <div className="hd-links">
            <span className="hd-section__meta" style={{ display:'inline-flex', alignItems:'center', gap:4, marginRight:4 }}><IconLayers size={12} /> Connected to</span>
            {detail.routines.map((r) => (<Link key={r.id} to="habits?view=routines" className="chip">{r.name}</Link>))}
            {detail.linkedProjects.map((p) => (<Button key={p.id} as={Link} to={`projects/${p.id}`} variant="secondary" size="sm">{p.name}</Button>))}
          </div>
        )}
      </section>

      {/* 10. MANAGEMENT */}
      <section className="hd-section" id="hd-sec-manage" aria-labelledby="hd-manage-title">
        <div className="hd-section__head">
          <h2 className="hd-section__title" id="hd-manage-title">Manage</h2>
        </div>
        <div className="hd-manage">
          <div className="hd-setrow">
            <span className="hd-setrow__ico" aria-hidden="true"><IconPencil size={15} /></span>
            <span className="hd-setrow__body"><span className="hd-setrow__label">Edit habit</span><span className="hd-setrow__sub">Name, schedule, reminder</span></span>
            <Button variant="secondary" size="sm" onClick={() => habitUI.openEdit(habit)}>Edit</Button>
          </div>
          {!archived && (
            <div className="hd-setrow">
              <span className="hd-setrow__ico" aria-hidden="true"><IconClock size={15} /></span>
              <span className="hd-setrow__body"><span className="hd-setrow__label">{paused ? 'Resume habit' : 'Pause habit'}</span><span className="hd-setrow__sub">{paused ? 'Back on Today from now on' : 'Temporarily pause'}</span></span>
              <Button variant="quiet" size="sm" onClick={() => actions.togglePause(habit)}>{paused ? 'Resume' : 'Pause'}</Button>
            </div>
          )}
          <div className="hd-setrow">
            <span className="hd-setrow__ico" aria-hidden="true"><IconArchive size={15} /></span>
            <span className="hd-setrow__body"><span className="hd-setrow__label">{archived ? 'Restore habit' : 'Archive habit'}</span><span className="hd-setrow__sub">Hide from active list</span></span>
            <Button variant="quiet" size="sm" onClick={() => habitUI.archive(habit)}>
              {archived ? 'Restore' : 'Archive'}
            </Button>
          </div>
          <div className="hd-setrow hd-setrow--danger">
            <span className="hd-setrow__ico" aria-hidden="true"><IconTrash size={15} /></span>
            <span className="hd-setrow__body"><span className="hd-setrow__label">Delete habit</span><span className="hd-setrow__sub">Permanently delete</span></span>
            {confirmDelete ? (
              <>
                <Button variant="quiet" size="sm" onClick={() => setConfirmDelete(false)}>Keep</Button>
                <Button variant="danger" size="sm" onClick={() => { setConfirmDelete(false); habitUI.remove(habit); navigate('habits') }}>
                  Delete for good
                </Button>
              </>
            ) : (
              <Button variant="quiet" size="sm" onClick={() => setConfirmDelete(true)} aria-describedby="hd-delete-note">
                Delete
              </Button>
            )}
          </div>
          <p id="hd-delete-note" className="hd-manage__note">
            {confirmDelete
              ? `This removes ${habit.name} and its check-ins. An Undo is offered right after.`
              : 'Archiving hides a habit from Today and analytics without deleting its history.'}
          </p>
        </div>
      </section>
    </main>
  )
}

function formatReminder(hhmm) {
  if (!hhmm) return ''
  const [h, m] = String(hhmm).split(':').map(Number)
  if (Number.isNaN(h)) return hhmm
  const isPm = h >= 12
  const h12 = ((h + 11) % 12) + 1
  return `${h12}${m ? ':' + String(m).padStart(2,'0') : ''} ${isPm ? 'PM' : 'AM'}`
}

function Metric({ label, value, unit, sub, tone }) {
  return (
    <div className="hd-metric" role="listitem">
      <span className="hd-metric__label">{label}</span>
      <span className={`hd-metric__value${tone === 'good' ? ' is-good' : ''}${tone === 'warn' ? ' is-warn' : ''}`}>
        {value}{unit && typeof value === 'number' ? <span style={{ fontSize:'.7em', color:'var(--text-3)', fontWeight:'var(--fw-regular)', marginLeft:3 }}>{unit}</span> : ''}
      </span>
      {unit && typeof value !== 'number' && <span className="hd-metric__sub">{unit}</span>}
      {sub && <span className="hd-metric__sub">{sub}</span>}
    </div>
  )
}
