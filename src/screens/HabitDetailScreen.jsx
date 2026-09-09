/* ============================================================
   HABIT DETAIL — everything about one habit (Phase 5 §16-19).

   Hierarchy, top to bottom:
     HEADER (name, category, schedule, Edit)
     CURRENT STREAK + TODAY STATUS (with Complete / quick log)
     CONSISTENCY (rate, window, heatmap)
     HISTORY (streak runs, notes — progressive disclosure)
     PATTERNS (habitPatterns.js only: Observation → Evidence → Implication)
     SCHEDULE (cadence, reminder, start date, pause state)
     ACTIONS (Edit · Pause/Resume · Archive · Delete, confirmed)

   All numbers come from habitDetail() in analytics.js and the
   stats/schedule engines. Nothing is recomputed here.
   ============================================================ */
import { useMemo, useState } from 'react'
import { useStore } from '../store.jsx'
import { useHabitUI } from '../components/habits/HabitUIProvider.jsx'
import { useHabitActions } from '../components/habits/HabitActions.jsx'
import { Heatmap } from '../components/charts/chartKit.jsx'
import { HBarList, Sparkline } from '../components/charts/workCharts.jsx'
import Burst from '../components/motion/Burst.jsx'
import { habitDetail, consistencyLabel } from '../lib/analytics.js'
import { heatmapSeries } from '../lib/stats.js'
import { habitPatterns } from '../lib/habitPatterns.js'
import { patternCards, NOT_ENOUGH } from '../components/habits/habitPatternsView.js'
import { describeHabit } from '../components/habits/habitRowModel.js'
import { categoryOf, scheduleLabel, WEEKDAY_NAMES } from '../lib/schedule.js'
import { prettyDate, todayStr, shortDate } from '../lib/dates.js'
import { Link, navigate } from '../lib/router.jsx'
import { SegControl } from '../components/ui/controls.jsx'
import { IconPencil, IconChevronLeft, IconFlame, IconClock, IconCalendar, IconLayers, IconCheck, IconTrash, IconArchive, IconPlus } from '../lib/icons.jsx'
import '../styles/habits.css'

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

  const habit = useMemo(() => (state.habits || []).find((h) => h.id === id) || null, [state.habits, id])
  const detail = useMemo(() => habitDetail(state, habit, days), [state, habit, days])
  const row = useMemo(() => (habit ? describeHabit(state, habit, today) : null), [state, habit, today])
  const heat = useMemo(
    () => habit ? heatmapSeries({ ...state, habits: [habit] }, Math.ceil(days / 7) + 1) : [],
    [state, habit, days],
  )
  const patterns = useMemo(() => (habit ? habitPatterns(state, habit) : null), [state, habit])
  const cards = useMemo(() => patternCards(patterns, habit?.name), [patterns, habit])

  if (!habit) {
    return (
      <div className="screen habits-screen" id="habit-detail-screen">
        <header className="screen-head">
          <div>
            <h1 className="screen-title">Habit not found</h1>
            <p className="screen-sub">This habit may have been deleted.</p>
          </div>
        </header>
        <section className="card pad">
          <Link to="habits" className="btn primary">
            <IconChevronLeft size={16} /> Back to habits
          </Link>
        </section>
      </div>
    )
  }

  const cat = categoryOf(habit.category)
  const streaks = detail.streaks?.runs ?? []
  const rate = detail.rate
  const pct = rate?.rate != null ? Math.round(rate.rate * 100) : null
  const { status, done, scheduledToday, paused, archived, miss } = row

  const complete = () => {
    if (!done) { setBurst((b) => b + 1); habitUI?.fire?.() }
    actions.log(habit, today, { done })
  }

  const facts = [
    { label: 'Current streak', value: detail.streak, unit: detail.streak === 1 ? 'day' : 'days' },
    { label: 'Best streak', value: detail.best, unit: detail.best === 1 ? 'day' : 'days' },
    { label: `Last ${days} days`, value: pct == null ? '—' : pct, unit: pct == null ? 'no eligible days' : `% · ${rate.done} of ${rate.eligible}` },
    {
      label: 'Consistency',
      value: detail.consistency?.enough ? detail.consistency.score : '—',
      unit: detail.consistency?.enough ? consistencyLabel(detail.consistency.score) : 'not enough data',
    },
  ]

  const weekdayRows = detail.weekdays
    .filter((w) => w.rate != null)
    .map((w) => ({ label: w.label, value: Math.round(w.rate * 100) }))
  const trendValues = detail.trend.filter((t) => t.scheduled).map((t) => (t.pct ? 1 : 0))
  const scheduleDays = habit.schedule?.type === 'weekdays' && Array.isArray(habit.schedule.days)
    ? habit.schedule.days.map((d) => WEEKDAY_NAMES[d]).join(', ')
    : null

  return (
    <div className="screen habits-screen habit-detail" id="habit-detail-screen" data-status={status.id}>
      {/* ---------- HEADER ---------- */}
      <header className="screen-head habits-head">
        <div style={{ minWidth: 0 }}>
          <button type="button" className="btn ghost sm back-link" onClick={() => navigate('habits')}>
            <IconChevronLeft size={15} /> Habits
          </button>
          <h1 className="screen-title habit-detail-title">
            <span className="habit-dot" style={{ background: `var(${cat.cssVar})` }} aria-hidden="true" />
            {habit.name}
          </h1>
          <p className="screen-sub">
            {cat.label} · {scheduleLabel(habit)}{habit.reminder ? ` · ${habit.reminder}` : ''}
          </p>
        </div>
        <div className="head-actions">
          <button type="button" className="btn" onClick={() => habitUI.openEdit(habit)} aria-label={`Edit ${habit.name}`}>
            <IconPencil size={16} /> Edit
          </button>
        </div>
      </header>

      <div className="stack habit-detail-stack">
        {/* ---------- STREAK + TODAY ---------- */}
        <section className="card pad-lg habit-now" aria-labelledby="habit-now-title">
          <div className="habit-now-inner">
            <div className="habit-now-streak" aria-label={`Current streak ${detail.streak} ${detail.streak === 1 ? 'day' : 'days'}`}>
              <span className="habit-now-flame" data-hot={detail.streak >= 3} aria-hidden="true"><IconFlame size={22} /></span>
              <strong className="tnum">{detail.streak}</strong>
              <span className="habit-now-unit">day streak</span>
              {detail.best > detail.streak && <span className="tiny muted tnum">best {detail.best}</span>}
            </div>
            <div className="habit-now-today">
              <h2 id="habit-now-title" className="eyebrow">Today</h2>
              <p className="habit-now-status">
                <span className="status-pill" data-tone={status.tone === 'neutral' ? undefined : status.tone} data-status={status.id}>{status.label}</span>
                <span className="tiny muted">
                  {archived ? 'Archived habits are not scheduled.'
                    : paused ? `Paused${row.pausedUntil ? ` until ${shortDate(row.pausedUntil)}` : ''}.`
                      : scheduledToday ? (done ? 'Logged for today.' : 'Scheduled for today.')
                        : row.next ? `Not scheduled today · next ${row.next.label}.` : 'Not scheduled today.'}
                </span>
              </p>
              <div className="habit-now-actions">
                {scheduledToday && !archived && (
                  <button
                    type="button"
                    className={`btn hrow-complete${done ? ' is-done' : ' primary'}`}
                    aria-pressed={done}
                    aria-label={`Mark ${habit.name} ${done ? 'not done' : 'complete'}`}
                    onClick={complete}
                  >
                    <span className="hrow-complete-inner">
                      <Burst fire={burst} count={10} spread={34} size={4} />
                      {done && <IconCheck size={15} aria-hidden="true" />}
                      {done ? 'Completed' : 'Complete'}
                    </span>
                  </button>
                )}
                {paused && !archived && (
                  <button type="button" className="btn" onClick={() => actions.togglePause(habit)}>Resume</button>
                )}
                {miss && !archived && !paused && (
                  <button type="button" className="btn sm hrow-complete is-missed" onClick={() => actions.log(habit, miss.date)} aria-label={`Log ${habit.name} for ${prettyDate(miss.date)}`}>
                    <IconPlus size={14} aria-hidden="true" /> Log {miss.label}
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="habit-facts">
            {facts.map((f) => (
              <div key={f.label} className="habit-fact">
                <span className="habit-fact-label">{f.label}</span>
                <strong className="tnum">{f.value}</strong>
                <span className="habit-fact-unit">{f.unit}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ---------- CONSISTENCY ---------- */}
        <section className="card pad" aria-labelledby="habit-consistency-title">
          <div className="card-head">
            <h2 id="habit-consistency-title" className="card-title">Consistency</h2>
            <SegControl label="Date range" value={days} onChange={setDays} options={RANGES} />
          </div>
          <p className="habit-summary-line">
            {pct == null
              ? 'Not enough data yet.'
              : detail.delta == null
                ? `${pct}% of scheduled days in the last ${days} days. Not enough history to compare with the previous period.`
                : detail.delta === 0
                  ? `${pct}% — exactly level with the previous ${days} days.`
                  : `${pct}% — ${detail.delta > 0 ? 'up' : 'down'} ${Math.abs(detail.delta)} points on the previous ${days} days.`}
          </p>
          {trendValues.length > 2 && (
            <div className="habit-spark">
              <Sparkline values={trendValues} width={180} height={30} />
              <span className="tiny muted">every scheduled day, oldest first</span>
            </div>
          )}
          <div style={{ marginTop: 14 }}>
            <Heatmap weeks={heat} ariaLabel={`${habit.name} consistency heatmap`} />
          </div>
        </section>

        {/* ---------- HISTORY ---------- */}
        <section className="card pad" aria-labelledby="habit-history-title">
          <div className="card-head">
            <h2 id="habit-history-title" className="card-title">History</h2>
            <span className="tiny muted"><IconFlame size={13} /> best {detail.best}</span>
          </div>
          {streaks.length === 0 ? (
            <p className="empty-note">No completed streaks recorded yet.</p>
          ) : (
            <div className="streak-list">
              {streaks.slice(0, 5).map((s, i) => (
                <div key={`${s.start}-${i}`} className="streak-row">
                  <span className="streak-bar" style={{ width: `${Math.max(8, (s.length / Math.max(1, detail.best)) * 100)}%` }} aria-hidden="true" />
                  <span className="streak-len tnum">{s.length}d</span>
                  <span className="streak-range">
                    {prettyDate(s.start)}{s.end !== s.start ? ` → ${prettyDate(s.end)}` : ''}
                  </span>
                  {s.current && <span className="streak-now">current</span>}
                </div>
              ))}
            </div>
          )}
          {streaks.length > 5 && (
            <details className="habit-more">
              <summary>All {streaks.length} streaks</summary>
              <div className="streak-list" style={{ marginTop: 10 }}>
                {streaks.slice(5).map((s, i) => (
                  <div key={`${s.start}-${i}`} className="streak-row">
                    <span className="streak-bar" style={{ width: `${Math.max(8, (s.length / Math.max(1, detail.best)) * 100)}%` }} aria-hidden="true" />
                    <span className="streak-len tnum">{s.length}d</span>
                    <span className="streak-range">{prettyDate(s.start)}{s.end !== s.start ? ` → ${prettyDate(s.end)}` : ''}</span>
                  </div>
                ))}
              </div>
            </details>
          )}
          {detail.notes.length > 0 && (
            <details className="habit-more">
              <summary>Notes ({detail.notes.length})</summary>
              <div className="stack" style={{ gap: 10, marginTop: 10 }}>
                {detail.notes.map((n) => (
                  <div key={n.date} className="habit-note">
                    <span className="habit-note-date">{prettyDate(n.date)}</span>
                    <p>{n.note}</p>
                  </div>
                ))}
              </div>
            </details>
          )}
        </section>

        {/* ---------- PATTERNS ---------- */}
        <section className="card pad habit-patterns" aria-labelledby="habit-patterns-title">
          <div className="card-head">
            <h2 id="habit-patterns-title" className="card-title">Patterns</h2>
            <span className="tiny muted">from your check-ins</span>
          </div>
          {cards.length === 0 ? (
            <p className="empty-note">{NOT_ENOUGH} Patterns appear once a habit has a few weeks of scheduled days.</p>
          ) : (
            <ul className="pattern-list">
              {cards.map((c) => (
                <li key={c.id} className="pattern" data-pattern={c.id}>
                  <p className="pattern-observation">{c.observation}</p>
                  <dl className="pattern-detail">
                    <dt>Evidence</dt><dd>{c.evidence}</dd>
                    <dt>Implication</dt><dd>{c.implication}</dd>
                  </dl>
                </li>
              ))}
            </ul>
          )}
          {(weekdayRows.length > 0 || detail.times) && (
            <details className="habit-more">
              <summary>Breakdown by weekday and time of day</summary>
              <div className="habit-breakdown">
                {weekdayRows.length > 0 && (
                  <div>
                    <p className="eyebrow"><IconCalendar size={12} /> By weekday · last 12 weeks</p>
                    <HBarList rows={weekdayRows} max={100} unit="%" />
                  </div>
                )}
                {detail.times && (
                  <div>
                    <p className="eyebrow"><IconClock size={12} /> When you log it · {detail.times.total} completions</p>
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

        {/* ---------- SCHEDULE ---------- */}
        <section className="card pad" aria-labelledby="habit-schedule-title">
          <div className="card-head">
            <h2 id="habit-schedule-title" className="card-title">Schedule</h2>
            <button type="button" className="btn ghost sm" onClick={() => habitUI.openEdit(habit)}><IconPencil size={13} /> Change</button>
          </div>
          <dl className="habit-schedule">
            <div><dt>Cadence</dt><dd>{scheduleLabel(habit)}{scheduleDays ? ` (${scheduleDays})` : ''}</dd></div>
            <div><dt>Reminder</dt><dd>{habit.reminder || 'None'}</dd></div>
            <div><dt>Started</dt><dd>{habit.createdAt ? prettyDate(habit.createdAt) : 'Unknown'}</dd></div>
            <div><dt>State</dt><dd>{archived ? 'Archived' : paused ? `Paused${row.pausedUntil ? ` until ${prettyDate(row.pausedUntil)}` : ''}` : 'Active'}</dd></div>
            {Array.isArray(habit.skips) && habit.skips.length > 0 && (
              <div><dt>Skipped days</dt><dd>{habit.skips.length} (not counted as misses)</dd></div>
            )}
          </dl>
          {(detail.linkedProjects.length > 0 || detail.routines.length > 0) && (
            <div className="habit-links">
              <p className="eyebrow"><IconLayers size={12} /> Connected to</p>
              <div className="wrap-gap">
                {detail.routines.map((r) => (
                  <Link key={r.id} to="habits?view=routines" className="chip">{r.name}</Link>
                ))}
                {detail.linkedProjects.map((p) => (
                  <Link key={p.id} to={`projects/${p.id}`} className="btn sm">{p.name}</Link>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* ---------- ACTIONS ---------- */}
        <section className="card pad habit-manage" aria-labelledby="habit-actions-title">
          <div className="card-head"><h2 id="habit-actions-title" className="card-title">Manage</h2></div>
          <div className="habit-manage-row">
            <button type="button" className="btn" onClick={() => habitUI.openEdit(habit)}><IconPencil size={15} /> Edit</button>
            {!archived && (
              <button type="button" className="btn" onClick={() => actions.togglePause(habit)}>{paused ? 'Resume' : 'Pause for a week'}</button>
            )}
            <button type="button" className="btn" onClick={() => habitUI.archive(habit)}>
              <IconArchive size={15} /> {archived ? 'Restore' : 'Archive'}
            </button>
            <span className="routine-spacer" />
            {confirmDelete ? (
              <>
                <button type="button" className="btn ghost" onClick={() => setConfirmDelete(false)}>Keep</button>
                <button type="button" className="btn danger" onClick={() => { setConfirmDelete(false); habitUI.remove(habit); navigate('habits') }}>
                  <IconTrash size={15} /> Delete for good
                </button>
              </>
            ) : (
              <button type="button" className="btn ghost danger-text" onClick={() => setConfirmDelete(true)} aria-describedby="habit-delete-note">
                <IconTrash size={15} /> Delete
              </button>
            )}
          </div>
          <p id="habit-delete-note" className="tiny muted" style={{ marginTop: 10 }}>
            {confirmDelete
              ? `This removes ${habit.name} and all of its check-ins. An Undo is offered right after.`
              : 'Archiving hides a habit from Today and analytics without deleting its history.'}
          </p>
        </section>
      </div>
    </div>
  )
}
