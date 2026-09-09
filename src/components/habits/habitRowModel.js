/* ============================================================
   HABIT ROW MODEL — Phase 5 presentation adapter.

   Pure functions that turn a habit + the existing engines
   (schedule.js for recurrence/pause/skip, stats.js for check-ins
   and streaks) into the row states the Habits workspace shows:

     TODAY · COMPLETED · MISSED · NOT SCHEDULED · PAUSED · ARCHIVED

   Nothing here recomputes a schedule, a streak or a completion —
   it only names what the engines already say, so Today, the
   Habits list, the calendar and the detail page agree.
   ============================================================ */
import { isPaused, scheduleLabel, nextScheduledDate } from '../../lib/schedule.js'
import { isDone, eligibleOn, habitStreak } from '../../lib/stats.js'
import { subDaysStr, weekdayShort, shortDate } from '../../lib/dates.js'

export const HABIT_STATES = {
  today: { id: 'today', label: 'Today', tone: 'info' },
  completed: { id: 'completed', label: 'Completed', tone: 'good' },
  missed: { id: 'missed', label: 'Missed', tone: 'warn' },
  'not-scheduled': { id: 'not-scheduled', label: 'Not scheduled', tone: 'neutral' },
  paused: { id: 'paused', label: 'Paused', tone: 'neutral' },
  archived: { id: 'archived', label: 'Archived', tone: 'neutral' },
}

/** Most recent scheduled day in the last `days` days that was neither
 *  done nor skipped (skips are not misses — schedule.js already excludes
 *  them from isScheduled, so eligibleOn is false on a skipped day). */
export function recentMiss(state, habit, today, days = 3) {
  if (!habit || habit.archived) return null
  for (let i = 1; i <= days; i++) {
    const d = subDaysStr(today, i)
    if (eligibleOn(habit, d) && !isDone(state, habit.id, d)) return { date: d, label: weekdayShort(d) }
  }
  return null
}

/** The one status a row leads with. */
export function habitStatus(state, habit, today) {
  if (habit.archived) return HABIT_STATES.archived
  if (isPaused(habit, today)) return HABIT_STATES.paused
  if (eligibleOn(habit, today)) {
    return isDone(state, habit.id, today) ? HABIT_STATES.completed : HABIT_STATES.today
  }
  if (recentMiss(state, habit, today)) return HABIT_STATES.missed
  return HABIT_STATES['not-scheduled']
}

/** Everything a row needs, derived once per render of the list. */
export function describeHabit(state, habit, today) {
  const status = habitStatus(state, habit, today)
  const paused = status.id === 'paused'
  const archived = Boolean(habit.archived)
  const scheduledToday = !archived && !paused && eligibleOn(habit, today)
  const done = scheduledToday && isDone(state, habit.id, today)
  const miss = archived || paused ? null : recentMiss(state, habit, today)
  const nextDate = !scheduledToday && !paused && !archived ? nextScheduledDate(habit, today) : null
  const streak = archived ? 0 : habitStreak(state, habit)
  return {
    habit,
    status,
    paused,
    archived,
    scheduledToday,
    done,
    streak,
    // Same threshold today.js uses for its attention rows ("7-day streak at risk").
    atRisk: status.id === 'today' && streak >= 7,
    schedule: scheduleLabel(habit),
    pausedUntil: paused ? habit.pause?.until || null : null,
    next: nextDate && nextDate !== today ? { date: nextDate, label: shortDate(nextDate) } : null,
    miss,
    reminder: habit.reminder || null,
  }
}

/* ---------------- Filters (§22) ---------------- */

export const HABIT_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'today', label: 'Today' },
  { id: 'attention', label: 'Needs attention' },
  { id: 'active', label: 'Active' },
  { id: 'paused', label: 'Paused' },
  { id: 'archived', label: 'Archived' },
]

export function matchesFilter(row, filter) {
  switch (filter) {
    case 'archived': return row.archived
    case 'paused': return row.paused
    case 'active': return !row.archived && !row.paused
    case 'today': return row.scheduledToday
    case 'attention': return !row.archived && !row.paused && (Boolean(row.miss) || row.atRisk)
    case 'all':
    default: return !row.archived
  }
}

export function filterCounts(rows) {
  const counts = {}
  for (const f of HABIT_FILTERS) counts[f.id] = rows.filter((r) => matchesFilter(r, f.id)).length
  return counts
}

/** Short summary for the workspace header: "5 active · 2 of 4 done today". */
export function habitsSummary(rows) {
  const live = rows.filter((r) => !r.archived)
  const scheduled = live.filter((r) => r.scheduledToday)
  const done = scheduled.filter((r) => r.done)
  const paused = live.filter((r) => r.paused)
  const parts = [`${live.length} active habit${live.length === 1 ? '' : 's'}`]
  if (scheduled.length) parts.push(`${done.length} of ${scheduled.length} done today`)
  if (paused.length) parts.push(`${paused.length} paused`)
  return parts.join(' · ')
}
