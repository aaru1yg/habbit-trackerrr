/* ============================================================
   SCHEDULE ENGINE
   A habit is SCHEDULED on a date only when its recurrence says so
   AND it is not paused AND the day was not explicitly skipped.
   Everything downstream (streaks, rates, heatmaps, missed days)
   treats an unscheduled day as "not a failure" — never counted.

   Recurrence types
     daily              → every day
     weekdays  days[]   → specific weekdays (0=Sun … 6=Sat)
     interval  every,anchor → every N days starting at `anchor`
     dates     dates[]  → only the listed calendar dates
   ============================================================ */
import { addDaysStr, isValidDayStr, dayStr } from './dates.js'

export const CATEGORIES = [
  { id: 'fitness', label: 'Fitness', cssVar: '--cat-fitness' },
  { id: 'mind', label: 'Mind', cssVar: '--cat-mind' },
  { id: 'learning', label: 'Learning', cssVar: '--cat-learning' },
  { id: 'health', label: 'Health', cssVar: '--cat-health' },
  { id: 'creative', label: 'Creative', cssVar: '--cat-creative' },
  { id: 'social', label: 'Social', cssVar: '--cat-social' },
]

export const categoryOf = (id) => CATEGORIES.find((c) => c.id === id) || CATEGORIES[1]

export const WEEKDAY_OPTIONS = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 0, label: 'Sun' },
]

export const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
export const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** Local weekday index (0=Sun) of a 'yyyy-MM-dd' string — no UTC drift. */
export const weekdayOf = (dateStr) => {
  const [y, m, d] = String(dateStr).slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d).getDay()
}

/* ---------------- Pause / skip ---------------- */

/** { from, until? } — a paused habit is unscheduled from `from` up to (not incl.) `until`.
 *  An open-ended pause (no `until`) pauses everything from `from` onward. */
export function isPaused(habit, date) {
  const p = habit?.pause
  if (!p || !isValidDayStr(p.from)) return false
  if (date < p.from) return false
  if (p.until && isValidDayStr(p.until)) return date < p.until
  return true
}

export const isSkipped = (habit, date) => Array.isArray(habit?.skips) && habit.skips.includes(date)

/* ---------------- Recurrence ---------------- */

function recursOn(habit, date) {
  const sched = habit?.schedule || { type: 'daily' }
  switch (sched.type) {
    case 'weekdays': {
      const days = Array.isArray(sched.days) ? sched.days : []
      if (!days.length) return false
      return days.includes(weekdayOf(date))
    }
    case 'interval': {
      const every = Math.max(1, Math.round(Number(sched.every) || 1))
      const anchor = isValidDayStr(sched.anchor) ? sched.anchor : habit?.createdAt
      if (!isValidDayStr(anchor)) return true // no anchor → treat as daily rather than vanish
      if (date < anchor) return false
      // count days between anchor and date without Date math drift
      let steps = 0
      let cursor = anchor
      // fast path: use Date arithmetic for the diff
      const a = new Date(`${anchor}T12:00:00`)
      const b = new Date(`${date}T12:00:00`)
      steps = Math.round((b - a) / 86400000)
      if (steps < 0) return false
      return steps % every === 0
    }
    case 'dates': {
      const dates = Array.isArray(sched.dates) ? sched.dates : []
      return dates.includes(date)
    }
    case 'daily':
    default:
      return true
  }
}

/** Is this habit scheduled on this date? (archived habits never are) */
export function isScheduled(habit, date) {
  if (!habit || habit.archived) return false
  if (isPaused(habit, date) || isSkipped(habit, date)) return false
  return recursOn(habit, date)
}

/* ---------------- Labels ---------------- */

export function scheduleLabel(habit) {
  const sched = habit?.schedule || { type: 'daily' }
  if (sched.type === 'interval') {
    const every = Math.max(1, Math.round(Number(sched.every) || 1))
    return every === 1 ? 'Every day' : `Every ${every} days`
  }
  if (sched.type === 'dates') {
    const n = Array.isArray(sched.dates) ? sched.dates.length : 0
    return n === 0 ? 'No dates picked' : n === 1 ? '1 chosen date' : `${n} chosen dates`
  }
  if (sched.type !== 'weekdays' || !Array.isArray(sched.days) || !sched.days.length) return 'Every day'
  if (sched.days.length === 7) return 'Every day'
  const ordered = [1, 2, 3, 4, 5, 6, 0].filter((d) => sched.days.includes(d))
  if (ordered.length === 5 && [1, 2, 3, 4, 5].every((d) => ordered.includes(d))) return 'Weekdays'
  if (ordered.length === 2 && [0, 6].every((d) => ordered.includes(d))) return 'Weekends'
  return ordered.map((d) => WEEKDAY_SHORT[d]).join(' · ')
}

/** Status line for the habit row: paused / next date / cadence. */
export function scheduleState(habit, date = dayStr(new Date())) {
  if (habit.archived) return { id: 'archived', label: 'Archived' }
  if (isPaused(habit, date)) {
    const until = habit.pause?.until
    return { id: 'paused', label: until && isValidDayStr(until) ? `Paused until ${until.slice(5).replace('-', '/')}` : 'Paused' }
  }
  return { id: 'active', label: scheduleLabel(habit) }
}

/** Next scheduled date on/after `from` (capped at 400 days) — null when none. */
export function nextScheduledDate(habit, from = dayStr(new Date())) {
  let cursor = from
  for (let i = 0; i < 400; i++) {
    if (isScheduled(habit, cursor)) return cursor
    cursor = addDaysStr(cursor, 1)
  }
  return null
}

/** Scheduled dates inside [from, to] inclusive. */
export function scheduledDates(habit, from, to) {
  const out = []
  let cursor = from
  let guard = 0
  while (cursor <= to && guard++ < 2000) {
    if (isScheduled(habit, cursor)) out.push(cursor)
    cursor = addDaysStr(cursor, 1)
  }
  return out
}

/** Starter suggestions for onboarding / add flow. Real habits, no fake history. */
export const STARTER_HABITS = [
  { name: 'Move for 20 minutes', category: 'fitness' },
  { name: 'Read 10 pages', category: 'learning' },
  { name: 'Meditate', category: 'mind' },
  { name: 'Drink water', category: 'health' },
  { name: 'Make something', category: 'creative' },
  { name: 'Message a friend', category: 'social' },
  { name: 'Stretch', category: 'fitness' },
  { name: 'Journal', category: 'mind' },
  { name: 'Sleep by 11', category: 'health' },
]

/** Starter routines (habit stacking) — created only from habits the user picked. */
export const ROUTINE_KINDS = [
  { id: 'morning', label: 'Morning reset' },
  { id: 'workout', label: 'Workout' },
  { id: 'study', label: 'Study block' },
  { id: 'night', label: 'Wind down' },
  { id: 'custom', label: 'Custom' },
]
