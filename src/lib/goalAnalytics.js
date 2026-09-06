/* ============================================================
   GOAL ANALYTICS — the time dimension for goals.

   goals.js answers "where is this goal now?". This module answers
   "how did it get here, and where is it going?" — always by
   recomputing from real evidence that carries a timestamp:

     milestones      → doneAt
     projects        → progressLog entries
     assignments     → progressLog entries + assignedDate
     habits          → check-ins in a trailing window
     manual percent  → no history exists, so history is null

   Where no honest value exists for a day, the series says null
   (a gap), never an interpolated guess.
   ============================================================ */
import { todayStr, subDaysStr, addDaysStr, isValidDayStr, dayOf, daysBetween } from './dates.js'
import { eligibleOn, isDone } from './stats.js'
import { goalProgress, goalPace } from './goals.js'

/** Progress of one project/assignment as it stood on `day`, from its log. */
function workPercentAt(item, day) {
  if (!item) return null
  const born = isValidDayStr(item.createdAtDay) ? item.createdAtDay : (isValidDayStr(item.assignedDate) ? item.assignedDate : null)
  if (born && day < born) return null
  const log = Array.isArray(item.progressLog) ? item.progressLog : []
  let pct = 0
  let seen = false
  for (const entry of log) {
    if (!entry || !isValidDayStr(dayOf(entry.at))) continue
    if (dayOf(entry.at) <= day) {
      pct = Math.max(0, Math.min(100, entry.pct))
      seen = true
    }
  }
  // completed items stay at 100 even if the log's last point predates `day`
  if (item.completedAt && dayOf(item.completedAt) <= day) return 100
  return seen ? pct : 0
}

/**
 * Goal progress as it stood on `day`. null = no honest value.
 */
export function goalProgressAt(state, goal, day) {
  if (!goal) return null

  const ms = goal.milestones || []
  if (ms.length > 0) {
    const done = ms.filter((m) => m.done && (!m.doneAt || dayOf(m.doneAt) <= day)).length
    return Math.round((done / ms.length) * 100)
  }

  const asg = (goal.linkedAssignmentIds || [])
    .map((id) => (state.assignments || []).find((a) => a.id === id))
    .filter(Boolean)
  if (asg.length > 0) {
    const pcts = asg.map((a) => workPercentAt(a, day)).filter((p) => p != null)
    if (pcts.length === 0) return null
    return Math.round(pcts.reduce((n, p) => n + p, 0) / pcts.length)
  }

  const proj = (goal.linkedProjectIds || [])
    .map((id) => (state.projects || []).find((p) => p.id === id))
    .filter(Boolean)
  if (proj.length > 0) {
    const pcts = proj.map((p) => workPercentAt(p, day)).filter((p) => p != null)
    if (pcts.length === 0) return null
    return Math.round(pcts.reduce((n, p) => n + p, 0) / pcts.length)
  }

  const habits = (goal.linkedHabitIds || [])
    .map((id) => (state.habits || []).find((h) => h.id === id))
    .filter((h) => h && !h.archived)
  if (habits.length > 0) {
    const from = subDaysStr(day, 29)
    let eligible = 0
    let done = 0
    for (const h of habits) {
      for (let d = from; d <= day; d = addDaysStr(d, 1)) {
        if (!eligibleOn(h, d)) continue
        if (isValidDayStr(h.createdAt) && d < h.createdAt) continue
        eligible += 1
        if (isDone(state, h.id, d)) done += 1
      }
    }
    return eligible > 0 ? Math.round((done / eligible) * 100) : null
  }

  // manual percent has no history — a gap is the honest answer
  return null
}

/**
 * Daily actual progress over a window ending today.
 * @returns {{day:string, pct:number|null}[]}
 */
export function goalActualSeries(state, goal, { days = 30 } = {}) {
  const end = todayStr()
  const rows = []
  for (let i = days - 1; i >= 0; i -= 1) {
    const day = subDaysStr(end, i)
    rows.push({ day, pct: goalProgressAt(state, goal, day) })
  }
  return rows
}

/**
 * The pace line: where the goal should be on each day of its own
 * window. null when the goal has no honest start+target span.
 */
export function goalExpectedSeries(state, goal, { days = 30 } = {}) {
  const pace = goalPace(goal)
  if (!pace) return null
  const end = todayStr()
  const rows = []
  for (let i = days - 1; i >= 0; i -= 1) {
    const day = subDaysStr(end, i)
    if (day < pace.start) { rows.push({ day, pct: 0 }); continue }
    const t0 = new Date(`${pace.start}T00:00:00`).getTime()
    const t1 = new Date(`${pace.end}T23:59:59`).getTime()
    const t = new Date(`${day}T12:00:00`).getTime()
    rows.push({ day, pct: Math.max(0, Math.min(100, Math.round(((t - t0) / (t1 - t0)) * 100))) })
  }
  return rows
}

/**
 * Completion velocity: points of progress per week, measured over
 * the real series (first vs last known point in the window).
 * @returns {{perWeek:number, fromDay:string|null, toDay:string|null, points:number}|null}
 */
export function goalVelocity(state, goal, { days = 14 } = {}) {
  const rows = goalActualSeries(state, goal, { days }).filter((r) => r.pct != null)
  if (rows.length < 2) return null
  const first = rows[0]
  const last = rows[rows.length - 1]
  const span = daysBetween(first.day, last.day)
  if (span <= 0) return null
  const perDay = (last.pct - first.pct) / span
  return {
    perWeek: Math.round(perDay * 7 * 10) / 10,
    fromDay: first.day,
    toDay: last.day,
    points: rows.length,
  }
}

/**
 * Projected completion date from current velocity.
 * null with a reason when the data cannot support a projection.
 */
export function goalProjection(state, goal, { now = new Date() } = {}) {
  const prog = goalProgress(state, goal, { now })
  if (prog.pct >= 100) return { day: null, reason: 'complete', pct: 100 }
  const v = goalVelocity(state, goal)
  if (!v) return { day: null, reason: 'insufficient', pct: prog.pct }
  if (v.perWeek <= 0) return { day: null, reason: 'stalled', pct: prog.pct }
  const perDay = v.perWeek / 7
  const daysLeft = Math.ceil((100 - prog.pct) / perDay)
  if (daysLeft > 3650) return { day: null, reason: 'stalled', pct: prog.pct }
  return { day: addDaysStr(todayStr(), daysLeft), reason: 'projected', pct: prog.pct, daysLeft }
}

/**
 * Consistency: how reliably the contributing behaviour shows up.
 *  - habit-linked goals: scheduled days completed in the window
 *  - milestone goals: share of reached milestones met on time
 *  - work-linked goals: null (progress, not cadence, is the signal)
 */
export function goalConsistency(state, goal, { days = 30 } = {}) {
  const ms = goal?.milestones || []
  if (ms.length > 0) {
    const done = ms.filter((m) => m.done)
    if (done.length === 0) return { pct: 0, source: 'milestones', detail: 'No milestone reached yet.' }
    const dated = done.filter((m) => m.doneAt && m.targetDate)
    if (dated.length === 0) {
      return { pct: null, source: 'milestones', detail: 'Reached milestones carry no target dates to compare against.' }
    }
    const onTime = dated.filter((m) => dayOf(m.doneAt) <= m.targetDate).length
    return {
      pct: Math.round((onTime / dated.length) * 100),
      source: 'milestones',
      detail: `${onTime} of ${dated.length} reached milestones met their target date`,
    }
  }

  const habits = (goal?.linkedHabitIds || [])
    .map((id) => (state.habits || []).find((h) => h.id === id))
    .filter((h) => h && !h.archived)
  if (habits.length > 0) {
    const end = todayStr()
    const from = subDaysStr(end, days - 1)
    let eligible = 0
    let done = 0
    for (const h of habits) {
      for (let d = from; d <= end; d = addDaysStr(d, 1)) {
        if (!eligibleOn(h, d)) continue
        eligible += 1
        if (isDone(state, h.id, d)) done += 1
      }
    }
    if (eligible === 0) return { pct: null, source: 'habits', detail: 'Linked habits have no scheduled days in this window yet.' }
    return {
      pct: Math.round((done / eligible) * 100),
      source: 'habits',
      detail: `${done} of ${eligible} scheduled habit days completed`,
    }
  }

  if ((goal?.linkedProjectIds || []).length || (goal?.linkedAssignmentIds || []).length) {
    return { pct: null, source: 'work', detail: 'Work-linked goals measure progress, not cadence.' }
  }
  return { pct: null, source: 'none', detail: 'Nothing linked yet.' }
}

/** Screen-ready roll-up of everything the detail screen shows. */
export function goalAnalytics(state, goal, { days = 30, now = new Date() } = {}) {
  return {
    actual: goalActualSeries(state, goal, { days, now }),
    expected: goalExpectedSeries(state, goal, { days }),
    velocity: goalVelocity(state, goal),
    projection: goalProjection(state, goal, { now }),
    consistency: goalConsistency(state, goal, { days }),
  }
}
