/* ============================================================
   WEEK REVIEW — a concise weekly briefing.
   Rendered inside HabitsScreen for #/habits?view=week and
   legacy #/week.

   Hierarchy (per Step 4E brief):
     HEADER → SUMMARY → HABIT PERFORMANCE → PATTERNS + ATTENTION → TAKEAWAY

   All numbers come from existing stats/analytics: weekStats,
   weekDelta, strongestHabit, weakestHabit, weeklyReview,
   habitStreak, weakestWeekday. No invented metrics.

   Visualization: ONE — the 7-dot per-habit stripe. It is *not*
   the Calendar (it collapses a week into 7 columns × N habits
   and is read down the page), and it is not a dashboard of
   charts. Habit color is used only for the small mark + row dot.
   ============================================================ */
import { useMemo, useState } from 'react'
import { useStore } from '../store.jsx'
import { useHabitUI } from '../components/habits/HabitUIProvider.jsx'
import Button from '../components/primitives/Button.jsx'
import IconButton from '../components/primitives/IconButton.jsx'
import { useHabitActions } from '../components/habits/HabitActions.jsx'
import { Link } from '../lib/router.jsx'
import {
  todayStr, subDaysStr, weekDays, weekdayShort, shortDate, prettyDate,
} from '../lib/dates.js'
import {
  activeHabits, isDone, eligibleOn,
  weekStats, weekDelta, strongestHabit, weakestHabit, habitStreak, weeklyReview,
  weakestWeekday, habitRate, checkinOf,
} from '../lib/stats.js'
import { isScheduled, categoryOf, WEEKDAY_NAMES } from '../lib/schedule.js'
import {
  IconChevronLeft, IconChevronRight,
  IconTrendUp, IconTrendDown,
  IconFlame, IconPlus, IconWeek,
} from '../lib/icons.jsx'

function HabitDot({ habit, size = 8 }) {
  return (
    <span
      className="wr-row__dot"
      style={{ width: size, height: size, background: `var(${categoryOf(habit.category).cssVar})`, color: `var(${categoryOf(habit.category).cssVar})` }}
      aria-hidden="true"
    />
  )
}

function Mark({ state, color }) {
  // state: done | missed | today | upcoming | off
  // done/missed use semantic --good/--bad via CSS; today/upcoming use habit color.
  if (state === 'off') return <span className="wr-mark off" aria-hidden="true" />
  const semantic = state === 'done' || state === 'missed'
  return <span className={`wr-mark ${state}`} style={!semantic && color ? { color } : undefined} aria-hidden="true" />
}

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

  const habits = useMemo(
    () => activeHabits(state).filter((h) => week.some((d) => isScheduled(h, d) && (!h.createdAt || d >= h.createdAt))),
    [state, week],
  )

  const wFrom = week[0]; const wTo = week[6]
  const strong = useMemo(() => strongestHabit(state, wFrom, wTo, 3), [state, wFrom, wTo])
  const weak   = useMemo(() => weakestHabit(state, wFrom, wTo, 3),   [state, wFrom, wTo])
  const review = useMemo(() => (isThisWeek ? weeklyReview(state) : null), [state, isThisWeek])
  const weakDay = useMemo(() => isThisWeek ? weakestWeekday(state, 4) : null, [state, isThisWeek])

  // Missed days you can still log.
  const missed = useMemo(() => {
    const byHabit = new Map()
    for (const h of habits) {
      let n = 0
      for (const d of week) {
        if (d >= today) break
        if (eligibleOn(h, d) && !isDone(state, h.id, d)) n++
      }
      if (n > 0) byHabit.set(h.id, { habit: h, count: n })
    }
    return [...byHabit.values()].sort((a, b) => b.count - a.count)
  }, [state, habits, week, today])

  const firstMissLog = useMemo(() => {
    for (const { habit } of missed) {
      for (const d of week) {
        if (d >= today) break
        if (eligibleOn(habit, d) && !isDone(state, habit.id, d)) return { habit, date: d }
      }
    }
    return null
  }, [missed, state, week, today])

  // Patterns (evidence-backed sentences, no AI).
  const patterns = useMemo(() => {
    const out = []
    if (strong) {
      out.push({
        tone: 'good',
        text: `${strong.habit.name} was your strongest habit this week.`,
        sub: `${Math.round(strong.rate * 100)}% of scheduled days completed${strong.eligible ? ` (${strong.done}/${strong.eligible})` : ''}.`,
      })
    }
    if (weak && (!strong || weak.habit.id !== strong.habit.id)) {
      out.push({
        tone: 'bad',
        text: `${weak.habit.name} needs attention.`,
        sub: `${Math.round(weak.rate * 100)}% completion — ${weak.done} of ${weak.eligible} scheduled days.`,
      })
    }
    if (weakDay && weakDay.rate < 0.7 && (!weak || weak.habit.id !== strong?.habit.id)) {
      out.push({
        tone: 'neutral',
        text: `${WEEKDAY_NAMES[weakDay.weekday]}s are your weakest day.`,
        sub: `${Math.round(weakDay.rate * 100)}% completion over the last month on ${WEEKDAY_NAMES[weakDay.weekday].toLowerCase()}s.`,
      })
    }
    // Streak callout
    const streaks = habits.map((h) => ({ h, s: habitStreak(state, h) })).filter((x) => x.s >= 3)
    streaks.sort((a, b) => b.s - a.s)
    if (streaks[0]) {
      const top = streaks[0]
      out.push({
        tone: 'neutral',
        text: `${top.h.name} has a ${top.s}-day streak going.`,
        sub: 'Keep the chain going.',
      })
    }
    return out
  }, [strong, weak, weakDay, habits, state])

  const takeaway = useMemo(() => {
    if (!isThisWeek) return null
    if (review?.suggestion) return review.suggestion
    if (review?.enough && delta.delta != null) {
      if (delta.delta >= 5) return 'You improved on last week — protect the habits that carried you.'
      if (delta.delta <= -5) return 'Completion slipped this week. Pick one habit to defend next week.'
      return 'You held steady with last week. Small wins compound.'
    }
    return null
  }, [isThisWeek, review, delta])

  const consistentCount = useMemo(() => {
    let n = 0
    for (const h of habits) {
      const r = habitRate(state, h, wFrom, wTo)
      if (r.rate != null && r.rate >= 0.8 && r.eligible >= 3) n++
    }
    return n
  }, [state, habits, wFrom, wTo])

  const navPrev = () => setOffset((o) => o + 1)
  const navNext = () => setOffset((o) => Math.max(0, o - 1))
  const navToday = () => setOffset(0)

  const cellState = (h, d) => {
    const sched = isScheduled(h, d) && (!h.createdAt || d >= h.createdAt)
    if (!sched) return 'off'
    if (isDone(state, h.id, d)) return 'done'
    if (d > today) return 'upcoming'
    if (d === today) return 'today'
    return 'missed'
  }

  const hasHabits = activeHabits(state).length > 0
  const pct = stats.pct ?? 0
  const dir = delta.delta == null ? null : delta.delta > 0 ? 'up' : delta.delta === 0 ? 'flat' : 'down'

  return (
    <div className="wr" id="week-screen">
      {/* 1. HEADER */}
      <div className="wr-head">
        <div />
        <nav className="wr-nav" aria-label="Week navigation">
          <IconButton onClick={navPrev} label="Previous week" icon={<IconChevronLeft size={16} />} className="wr-nav-btn" />
          <h2 className="wr-title" aria-live="polite">
            {isThisWeek ? 'This week' : offset === 1 ? 'Last week' : `${offset} weeks ago`}
            <small className="tnum">{rangeLabel}{isThisWeek ? ' · in progress' : ''}</small>
          </h2>
          <IconButton onClick={navNext} label="Next week" icon={<IconChevronRight size={16} />} disabled={offset === 0} className="wr-nav-btn" />
          {!isThisWeek && (
            <Button variant="quiet" size="sm" className="wr-today" onClick={navToday}>This week</Button>
          )}
        </nav>
        <div />
      </div>

      {!hasHabits ? (
        <section className="wr-empty" role="status">
          <div style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--surface-2)', display: 'grid', placeItems: 'center', color: 'var(--text-2)' }}>
            <IconWeek size={20} />
          </div>
          <strong>No habits yet</strong>
          <p>Create a habit and check in through the week — your review will appear here.</p>
          <Button variant="primary" icon={<IconPlus size={14} />} onClick={habitUI.openAdd}>Create habit</Button>
        </section>
      ) : habits.length === 0 || stats.total === 0 ? (
        <section className="wr-empty" role="status">
          <div style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--surface-2)', display: 'grid', placeItems: 'center', color: 'var(--text-2)' }}>
            <IconWeek size={20} />
          </div>
          <strong>Nothing scheduled this week</strong>
          <p>None of your habits fall in this range. Try another week or adjust a habit's schedule.</p>
        </section>
      ) : (
        <>
          {/* 2. SUMMARY */}
          <section className="wr-summary" aria-labelledby="wr-summary-title">
            <div className="wr-summary__pct" aria-hidden="true">
              {pct}<sup>%</sup>
            </div>
            <div className="wr-summary__body">
              <p className="wr-summary__label" id="wr-summary-title">
                {isThisWeek ? 'This week' : 'Week'} completion
              </p>
              <p className="wr-summary__line tnum">
                <strong>{stats.done}</strong> of <strong>{stats.total}</strong> check-ins completed
                {consistentCount > 0 && <> · <strong>{consistentCount}</strong> consistent habit{consistentCount === 1 ? '' : 's'}</>}
                {isThisWeek ? ' so far.' : '.'}
              </p>
              {dir === null ? (
                <p className="wr-summary__meta">No previous-week data to compare yet.</p>
              ) : (
                <span className="wr-summary__delta" data-dir={dir} aria-label={`${dir === 'up' ? 'Up' : dir === 'down' ? 'Down' : 'Level'} ${Math.abs(delta.delta)} percentage points versus last week`}>
                  {dir === 'up'   ? <IconTrendUp size={13} aria-hidden="true" /> :
                   dir === 'down' ? <IconTrendDown size={13} aria-hidden="true" /> :
                                    <span aria-hidden="true" style={{ width: 13, height: 2, background: 'currentColor', borderRadius: 1, display: 'inline-block' }} />}
                  {dir === 'flat'
                    ? `Level with last week (${delta.b.pct}%)`
                    : `${dir === 'up' ? '+' : '−'}${Math.abs(delta.delta)}% vs last week`}
                </span>
              )}
              {missed.length > 0 && firstMissLog && (
                <p className="wr-summary__meta">
                  {missed.reduce((a, m) => a + m.count, 0)} missed check-in{missed.reduce((a, m) => a + m.count, 0) === 1 ? '' : 's'} you can still log.
                </p>
              )}
            </div>
          </section>

          {/* 3+4. HABIT PERFORMANCE (the only weekly visualization: 7-day stripes) */}
          <section className="wr-habits" aria-labelledby="wr-habits-title">
            <div className="wr-habits__head">
              <p className="wr-habits__head-label" id="wr-habits-title">This week, habit by habit</p>
              {week.map((d) => (
                <span
                  key={d}
                  className={`wr-habits__day${d === today ? ' is-today' : ''}`}
                  aria-label={prettyDate(d)}
                  title={prettyDate(d)}
                >{weekdayShort(d).slice(0, 1)}</span>
              ))}
            </div>
            {habits.map((h) => {
              const rate = habitRate(state, h, wFrom, wTo)
              const streak = habitStreak(state, h)
              const hasAnyNote = week.some((d) => !!checkinOf(state, h.id, d)?.note)
              return (
                <div
                  key={h.id}
                  className="wr-row"
                  data-has-note={hasAnyNote}
                >
                  <div className="wr-row__name">
                    <HabitDot habit={h} />
                    <Link to={`habits/${h.id}`} aria-label={`${h.name}, ${rate.rate == null ? 'no data' : Math.round(rate.rate * 100) + ' percent this week'}`}>
                      {h.name}
                    </Link>
                    {streak >= 2 && (
                      <span className="wr-row__streak" aria-label={`${streak}-day streak`}>
                        <IconFlame size={11} aria-hidden="true" /> {streak}d
                      </span>
                    )}
                  </div>
                  {week.map((d) => {
                    const s = cellState(h, d)
                    const title = `${prettyDate(d)}: ${s === 'done' ? 'done' : s === 'missed' ? 'missed' : s === 'today' ? 'today' : s === 'upcoming' ? 'upcoming' : 'not scheduled'}`
                    return (
                      <span key={d} className="wr-cell" title={title}>
                        <Mark state={s} color={`var(${categoryOf(h.category).cssVar})`} />
                      </span>
                    )
                  })}
                </div>
              )
            })}
          </section>

          {/* 5/7. PATTERNS + ATTENTION */}
          <div className="wr-split">
            <section className="wr-block" aria-labelledby="wr-patterns-title">
              <h2 id="wr-patterns-title">Patterns</h2>
              {patterns.length === 0 ? (
                <p className="wr-none">Not enough data yet. Check in for a few more days and patterns will appear.</p>
              ) : (
                <ul className="wr-block__list">
                  {patterns.map((p, i) => (
                    <li key={i} className="wr-block__item" data-tone={p.tone}>
                      <span className="wr-block__bullet" aria-hidden="true" />
                      <div>
                        <p>{p.text}</p>
                        <small>{p.sub}</small>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="wr-block" aria-labelledby="wr-attention-title">
              <h2 id="wr-attention-title">Needs attention</h2>
              {missed.length === 0 ? (
                <p className="wr-none">Nothing missed in this week yet.</p>
              ) : (
                <ul className="wr-attention__list" aria-label={`${missed.reduce((a, m) => a + m.count, 0)} missed check-ins you can still log`}>
                  {missed.slice(0, 5).map(({ habit: h, count }) => (
                    <li key={h.id} className="wr-attention__row">
                      <HabitDot habit={h} size={6} />
                      <Link to={`habits/${h.id}`}>{h.name}</Link>
                      <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                        <span className="wr-attention__count tnum">{count} missed</span>
                        {firstMissLog && firstMissLog.habit.id === h.id && (
                          <button
                            type="button"
                            className="wr-attention__btn"
                            onClick={() => actions.log(h, firstMissLog.date)}
                            aria-label={`Log ${h.name} for ${prettyDate(firstMissLog.date)}`}
                          >Log</button>
                        )}
                      </span>
                    </li>
                  ))}
                  {missed.length > 5 && (
                    <li className="wr-none" style={{ fontSize: 'var(--fs-xs)' }}>
                      {missed.length - 5} more — open the <Link to="habits?view=calendar">calendar</Link> to log them.
                    </li>
                  )}
                </ul>
              )}
            </section>
          </div>

          {/* 8. TAKEAWAY */}
          {takeaway && (
            <section className="wr-takeaway" aria-label="Next-week takeaway">
              <p className="wr-takeaway__label">Going into next week</p>
              <p>{takeaway}</p>
            </section>
          )}
        </>
      )}
    </div>
  )
}
