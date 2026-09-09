/* ============================================================
   WEEK REVIEW — the weekly view of the Habits workspace
   (Phase 5 §15). Rendered inside HabitsScreen for
   #/habits?view=week and the legacy #/week.

   Completion → change vs the previous week → strongest / needs
   attention → missed days you can still log → by-habit grid →
   a short summary. Every number comes from weekStats / weekDelta /
   strongestHabit / weakestHabit / weeklyReview in stats.js.
   Work deadlines are not shown here; they belong to Work.
   ============================================================ */
import { useMemo, useState } from 'react'
import { useStore } from '../store.jsx'
import { useHabitUI } from '../components/habits/HabitUIProvider.jsx'
import { useHabitActions } from '../components/habits/HabitActions.jsx'
import ProgressRing from '../components/ui/ProgressRing.jsx'
import EmptyState from '../components/ui/EmptyState.jsx'
import AnimatedNumber from '../components/ui/AnimatedNumber.jsx'
import MiniBars from '../components/ui/Bars.jsx'
import { Link } from '../lib/router.jsx'
import { todayStr, subDaysStr, weekDays, weekdayShort, shortDate, prettyDate } from '../lib/dates.js'
import { activeHabits, isDone, eligibleOn, weekStats, weekDelta, strongestHabit, weakestHabit, habitStreak, weeklyReview } from '../lib/stats.js'
import { isScheduled, categoryOf, WEEKDAY_NAMES } from '../lib/schedule.js'
import { IconChevronLeft, IconChevronRight, IconTrendUp, IconTrendDown, IconFlame, IconPlus, IconWeek } from '../lib/icons.jsx'

export default function WeekScreen() {
  const { state } = useStore()
  const habitUI = useHabitUI()
  const actions = useHabitActions()
  const [offset, setOffset] = useState(0) // weeks back from current
  const today = todayStr()

  const week = useMemo(() => weekDays(subDaysStr(today, offset * 7)), [today, offset])
  const prevWeek = useMemo(() => weekDays(subDaysStr(week[0], 7)), [week])
  const stats = useMemo(() => weekStats(state, week), [state, week])
  const delta = useMemo(() => weekDelta(state, week, prevWeek), [state, week, prevWeek])
  const rangeLabel = `${shortDate(week[0])} – ${shortDate(week[6])}`
  const isThisWeek = offset === 0

  const habits = useMemo(() => activeHabits(state).filter((h) => week.some((d) => isScheduled(h, d))), [state, week])
  const strong = useMemo(() => strongestHabit(state, week[0], week[6], 3), [state, week])
  const weak = useMemo(() => weakestHabit(state, week[0], week[6], 3), [state, week])
  const review = useMemo(() => (isThisWeek ? weeklyReview(state) : null), [state, isThisWeek])

  // Missed days in this week that can still be logged (past, scheduled, not done).
  const missed = useMemo(() => {
    const out = []
    for (const h of habits) {
      for (const d of week) {
        if (d >= today) break
        if (eligibleOn(h, d) && !isDone(state, h.id, d)) out.push({ habit: h, date: d })
      }
    }
    return out
  }, [state, habits, week, today])

  // Missed-pattern: which weekday collected the most misses this week.
  const missedByDay = useMemo(() => {
    const counts = new Map()
    for (const m of missed) counts.set(m.date, (counts.get(m.date) || 0) + 1)
    let worst = null
    for (const [date, n] of counts) if (!worst || n > worst.n) worst = { date, n }
    return worst
  }, [missed])

  const summary = useMemo(() => {
    const lines = []
    if (stats.total === 0) return lines
    if (delta.delta == null) lines.push(`${stats.done} of ${stats.total} check-ins so far — no previous week to compare with yet.`)
    else if (delta.delta === 0) lines.push(`Level with the previous week at ${stats.pct}%.`)
    else lines.push(`${delta.delta > 0 ? 'Up' : 'Down'} ${Math.abs(delta.delta)}% versus the previous week (${stats.pct}% vs ${delta.b.pct}%).`)
    if (strong) lines.push(`${strong.habit.name} held up best at ${Math.round(strong.rate * 100)}%.`)
    if (weak && weak.habit.id !== strong?.habit.id) lines.push(`${weak.habit.name} needs attention at ${Math.round(weak.rate * 100)}%.`)
    if (missedByDay && missedByDay.n > 1) {
      lines.push(`${WEEKDAY_NAMES[new Date(`${missedByDay.date}T12:00:00`).getDay()]} collected the most misses (${missedByDay.n}).`)
    }
    if (review?.enough && review.suggestion) lines.push(review.suggestion)
    return lines
  }, [stats, delta, strong, weak, missedByDay, review])

  return (
    <div className="habits-view week-view" id="week-screen">
      <div className="week-nav">
        <button className="btn icon" onClick={() => setOffset((o) => o + 1)} aria-label="Previous week"><IconChevronLeft size={18} /></button>
        <div className="week-range">
          <h2 className="card-title">{isThisWeek ? 'This week' : offset === 1 ? 'Last week' : `${offset} weeks ago`}</h2>
          <p className="tiny muted tnum">{rangeLabel}{isThisWeek && ' · in progress'}</p>
        </div>
        <button className="btn icon" onClick={() => setOffset((o) => Math.max(0, o - 1))} aria-label="Next week" disabled={offset === 0}><IconChevronRight size={18} /></button>
      </div>

      {habits.length === 0 ? (
        <section className="card" role="status">
          <EmptyState
            art="art/empty-week.webp"
            icon={<IconWeek size={40} />}
            title="No habits scheduled this week"
            action={activeHabits(state).length === 0 && (
              <div className="empty-actions">
                <button type="button" className="btn primary" onClick={habitUI.openAdd}><IconPlus size={16} /> Create habit</button>
              </div>
            )}
          >
            {activeHabits(state).length === 0
              ? "You don't have any habits yet. Create one to start tracking your week."
              : 'Nothing is scheduled in this week.'}
          </EmptyState>
        </section>
      ) : (
        <>
          {/* completion + delta */}
          <section className="card pad-lg week-hero" aria-labelledby="week-completion-title">
            <div className="week-hero-inner">
              <ProgressRing pct={stats.pct} size={116} stroke={10} label={`${stats.pct ?? 0} percent this week`}>
                <div>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.7rem', lineHeight: 1 }}>
                    <AnimatedNumber value={stats.pct ?? 0} />%
                  </div>
                  <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-3)', marginTop: 2 }}>week</div>
                </div>
              </ProgressRing>
              <div className="week-hero-copy">
                <p id="week-completion-title" className="week-checkins">
                  <AnimatedNumber value={stats.done} /> of <AnimatedNumber value={stats.total} /> check-ins
                </p>
                {delta.delta != null ? (
                  <p className={`week-delta ${delta.delta >= 0 ? 'up' : 'down'}`}>
                    {delta.delta >= 0 ? <IconTrendUp size={15} /> : <IconTrendDown size={15} />}
                    {delta.delta >= 0 ? 'Up' : 'Down'} {Math.abs(delta.delta)}% vs previous week
                    <span className="muted tnum"> ({delta.b.pct}% → {stats.pct}%)</span>
                  </p>
                ) : (
                  <p className="tiny muted" style={{ marginTop: 8 }}>No comparison yet — the previous week has no data.</p>
                )}
                {missed.length > 0 && (
                  <p className="tiny muted" style={{ marginTop: 6 }}>
                    {missed.length} missed day{missed.length === 1 ? '' : 's'} you can still log below.
                  </p>
                )}
              </div>
            </div>
            <div style={{ marginTop: 18 }}>
              <MiniBars
                data={week.map((d) => ({
                  label: weekdayShort(d),
                  value: (() => {
                    const s = stats.perDay.find((x) => x.date === d)
                    return s && s.total ? s.done / s.total : null
                  })(),
                }))}
                height={72}
                highlightLast={false}
              />
            </div>
          </section>

          {/* strongest / weakest */}
          {(strong || weak) && (
            <div className="week-pair">
              {strong && (
                <section className="card pad week-tile" data-tone="good">
                  <p className="eyebrow">Strongest habit</p>
                  <Link to={`habits/${strong.habit.id}`} className="week-tile-name">{strong.habit.name}</Link>
                  <p className="tnum week-tile-rate">{Math.round(strong.rate * 100)}% this week</p>
                </section>
              )}
              {weak && (
                <section className="card pad week-tile" data-tone="warn">
                  <p className="eyebrow">Needs attention</p>
                  <Link to={`habits/${weak.habit.id}`} className="week-tile-name">{weak.habit.name}</Link>
                  <p className="tnum week-tile-rate">{Math.round(weak.rate * 100)}% this week</p>
                </section>
              )}
            </div>
          )}

          {/* missed days with quick logging */}
          {missed.length > 0 && (
            <section className="card pad" aria-labelledby="week-missed-title">
              <div className="card-head">
                <h2 id="week-missed-title" className="card-title">Missed this week</h2>
                <span className="tiny muted">tap to log</span>
              </div>
              <ul className="week-missed" aria-label="Missed days you can still log">
                {missed.slice(0, 12).map(({ habit, date }) => (
                  <li key={`${habit.id}-${date}`}>
                    <button type="button" className="btn sm week-missed-btn" onClick={() => actions.log(habit, date)} aria-label={`Log ${habit.name} for ${prettyDate(date)}`}>
                      <IconPlus size={13} aria-hidden="true" /> {habit.name} · {weekdayShort(date)}
                    </button>
                  </li>
                ))}
              </ul>
              {missed.length > 12 && (
                <p className="tiny muted" style={{ marginTop: 8 }}>
                  {missed.length - 12} more in the <Link to="habits?view=calendar">calendar</Link>.
                </p>
              )}
            </section>
          )}

          {/* habit × day grid */}
          <section className="card pad" aria-labelledby="week-by-habit-title">
            <div className="card-head"><h2 id="week-by-habit-title" className="card-title">By habit</h2></div>
            <ul className="week-habits" aria-label="Habits this week">
              {habits.map((h) => {
                const streak = habitStreak(state, h)
                const doneThisWeek = week.filter((d) => isDone(state, h.id, d)).length
                const scheduledThisWeek = week.filter((d) => isScheduled(h, d)).length
                return (
                  <li key={h.id}>
                    <Link to={`habits/${h.id}`} className="week-habit" aria-label={`${h.name}: ${doneThisWeek} of ${scheduledThisWeek} scheduled days done this week. Open details`}>
                      <span className="dot" style={{ width: 8, height: 8, borderRadius: 99, background: `var(${categoryOf(h.category).cssVar})`, flex: 'none' }} aria-hidden="true" />
                      <span className="week-habit-name">{h.name}</span>
                      {streak > 1 && (
                        <span className="hrow-streak" aria-hidden="true"><IconFlame size={12} /> {streak}d</span>
                      )}
                      <span className="week-dots" aria-hidden="true">
                        {week.map((d) => {
                          const sched = isScheduled(h, d)
                          const done = isDone(state, h.id, d)
                          const future = d > today
                          return (
                            <span
                              key={d}
                              className="week-dot"
                              data-state={done ? 'done' : sched ? (future ? 'upcoming' : d === today ? 'today' : 'missed') : 'off'}
                              title={`${prettyDate(d)}: ${done ? 'done' : sched ? (future ? 'upcoming' : d === today ? 'today' : 'missed') : 'not scheduled'}`}
                            />
                          )
                        })}
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
            <p className="tiny muted" style={{ marginTop: 12 }}>
              Solid = completed · outline = missed · dashed = not scheduled
            </p>
          </section>

          {/* concise summary */}
          {summary.length > 0 && (
            <section className="card pad week-summary" aria-labelledby="week-summary-title">
              <div className="card-head"><h2 id="week-summary-title" className="card-title">In short</h2></div>
              <ul className="week-summary-list">
                {summary.map((line, i) => <li key={i}>{line}</li>)}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  )
}
