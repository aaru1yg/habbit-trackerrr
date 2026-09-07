/* ============================================================
   ADVANCED ANALYTICS — Phase D.

   LAZY BY DESIGN. Nothing eager imports this module: it is reached
   only through AnalyticsLab, which InsightsScreen loads with
   React.lazy. Keeping it out of the initial bundle is a hard
   requirement (docs/NEXTGEN-AUDIT.md §9) — if you import this from
   store.jsx, App.jsx, TodayScreen.jsx or personalization.js you will
   spend initial bundle the product does not have.

   It owns no new forecast, no new risk model and no new priority
   score. Where a number already exists elsewhere it is called, not
   reimplemented — see docs/ANALYTICS-AUDIT.md §1 for the inventory.

   Every function returns `enough` and a `reason`. Insufficient data
   is reported as "Not enough data yet.", never smoothed over.
   ============================================================ */
import {
  todayStr, dayStr, subDaysStr, addDaysStr, weekDays, dayOf, isValidDayStr,
  minutesLabel, shortDate, weekdayShort,
} from './dates.js'
import { WEEKDAY_NAMES, weekdayOf } from './schedule.js'
import {
  activeHabits, dayStats, trendSeries, habitMatrix, habitRate, habitStreak,
  eligibleOn, isDone, heatmapSeries,
} from './stats.js'
import {
  workloadSeries, progressSeries, projectStatus, assignmentStatus, projectProgress,
  assignmentProgress, allTasks, deadlineLanes,
} from './work.js'

/* work.js keeps these private; the same filter, stated once here. */
const openProjects = (state) => (state.projects || []).filter((p) => !p.archived)
const openAssignments = (state) => (state.assignments || []).filter((a) => !a.archived)
import { timelineEvents, smartInsights, weekdayPerformance, consistencyRanking, completionDistribution, timeOfDayPerformance } from './analytics.js'
import { goalProgress, goalPace, goalHealth } from './goals.js'
import { goalActualSeries, goalExpectedSeries, goalProjection, goalVelocity } from './goalAnalytics.js'
import { goalContributors, assignmentPace, projectForecast } from './adaptive.js'
import { preferencesOf } from './personalization.js'

export const NOT_ENOUGH = 'Not enough data yet.'

const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)
const dayList = (days, now) => Array.from({ length: days }, (_, i) => subDaysStr(dayStr(now), days - 1 - i))
const msDay = (d) => new Date(`${d}T12:00:00`).getTime()

/* ------------------------------------------------------------
   0 · THE ONE COMPLETION LIST

   Tasks, subtasks, milestones, check-ins and whole-item completions
   are counted in four different places across the codebase. This is
   the single dated list; velocity, timeline and comparisons all
   filter it rather than recounting.
   ------------------------------------------------------------ */

export function completionEvents(state) {
  const out = []
  const push = (at, kind, name, extra = {}) => {
    const day = dayOf(at)
    if (!day) return
    out.push({ at, day, kind, name, ...extra })
  }

  for (const h of state.habits || []) {
    for (const [date, entry] of Object.entries(state.checkins?.[h.id] || {})) {
      if (entry?.done !== true) continue
      push(entry.at || `${date}T12:00:00`, 'habit', h.name, { id: h.id, habitId: h.id })
    }
  }
  for (const p of state.projects || []) {
    for (const t of allTasks(p)) if (t.completedAt) push(t.completedAt, 'task', t.name, { projectId: p.id, parent: p.name })
    if (p.completedAt) push(p.completedAt, 'project', p.name, { projectId: p.id })
  }
  for (const a of state.assignments || []) {
    for (const s of a.subtasks || []) if (s.completedAt) push(s.completedAt, 'subtask', s.name, { assignmentId: a.id, parent: a.name })
    if (a.completedAt) push(a.completedAt, 'assignment', a.name, { assignmentId: a.id })
  }
  for (const g of state.goals || []) {
    for (const m of g.milestones || []) if (m.doneAt) push(m.doneAt, 'milestone', m.name, { goalId: g.id, parent: g.title })
  }
  for (const s of state.focusLog || []) {
    if (s?.completed && s.endedAt) push(s.endedAt, 'focus', s.name || 'Focus session', { minutes: s.actualMin })
  }

  out.sort((a, b) => String(a.at).localeCompare(String(b.at)))
  return out
}

const COMPLETION_LABEL = {
  habit: 'Habit check-in', task: 'Project task', subtask: 'Assignment subtask',
  project: 'Project completed', assignment: 'Assignment completed',
  milestone: 'Goal milestone', focus: 'Focus session',
}
export { COMPLETION_LABEL }

/* ------------------------------------------------------------
   2 · PRODUCTIVITY TIMELINE

   Built on the existing timelineEvents(), extended with the four
   kinds it does not carry: project tasks, goal milestones, focus
   sessions and deadlines. Nothing is re-derived from scratch.
   ------------------------------------------------------------ */

export const TIMELINE_RANGES = [
  { id: '7d', label: '7D', days: 7 },
  { id: '30d', label: '30D', days: 30 },
  { id: '90d', label: '90D', days: 90 },
  { id: '6m', label: '6M', days: 182 },
  { id: '1y', label: '1Y', days: 365 },
  { id: 'all', label: 'ALL', days: null },
]

export const TIMELINE_FILTERS = [
  { id: 'all', label: 'Everything' },
  { id: 'habit', label: 'Habits' },
  { id: 'work', label: 'Projects & assignments' },
  { id: 'goal', label: 'Goals' },
  { id: 'focus', label: 'Focus sessions' },
  { id: 'note', label: 'Notes' },
  { id: 'achievement', label: 'Achievements' },
  { id: 'deadline', label: 'Deadlines' },
]

const KIND_GROUP = {
  'habit-created': 'habit', streak: 'habit', note: 'note', reflection: 'note',
  'project-start': 'work', 'project-progress': 'work', 'project-complete': 'work',
  'assignment-complete': 'work', 'assignment-progress': 'work',
  achievement: 'achievement',
  'task-complete': 'work', deadline: 'work',
  milestone: 'goal', focus: 'focus',
}

export function timelineSeries(state, { rangeId = '30d', filter = 'all', now = new Date(), limit = 400 } = {}) {
  const range = TIMELINE_RANGES.find((r) => r.id === rangeId) || TIMELINE_RANGES[1]
  const today = dayStr(now)
  const cutoff = range.days == null ? null : subDaysStr(today, range.days - 1)

  const events = [...timelineEvents(state, 100000)]

  for (const p of state.projects || []) {
    for (const t of allTasks(p)) {
      if (!t.completedAt) continue
      events.push({ at: t.completedAt, day: dayOf(t.completedAt), kind: 'task-complete', title: `Task done: ${t.name}`, body: p.name, tone: 'good' })
    }
  }
  for (const g of state.goals || []) {
    for (const m of g.milestones || []) {
      if (!m.doneAt) continue
      events.push({ at: m.doneAt, day: dayOf(m.doneAt), kind: 'milestone', title: `Milestone reached: ${m.name}`, body: g.title, tone: 'good' })
    }
  }
  for (const s of state.focusLog || []) {
    if (!s?.completed || !s.endedAt) continue
    events.push({
      at: s.endedAt, day: dayOf(s.endedAt), kind: 'focus',
      title: `Focus session${Number.isFinite(s.actualMin) ? ` · ${minutesLabel(s.actualMin)}` : ''}`,
      body: s.name || null, tone: 'neutral',
    })
  }
  for (const item of [...(state.projects || []), ...(state.assignments || [])]) {
    if (!item.deadline) continue
    const day = dayOf(item.deadline)
    if (!day) continue
    const isProject = Boolean(item.milestones)
    events.push({
      at: item.deadline, day, kind: 'deadline',
      title: `Deadline: ${item.name}`, body: isProject ? 'Project' : 'Assignment',
      tone: item.completedAt ? 'good' : day < today ? 'bad' : 'neutral',
    })
  }

  const filtered = events
    .filter((e) => e.day && (!cutoff || e.day >= cutoff))
    .filter((e) => filter === 'all' || KIND_GROUP[e.kind] === filter)
    .sort((a, b) => String(b.at || b.day).localeCompare(String(a.at || a.day)))

  const seen = new Set()
  const unique = filtered.filter((e) => {
    const k = `${e.day}|${e.title}`
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })

  const groups = []
  for (const e of unique.slice(0, limit)) {
    const last = groups[groups.length - 1]
    if (last && last.day === e.day) last.events.push(e)
    else groups.push({ day: e.day, label: shortDate(e.day), weekday: weekdayShort(e.day), events: [e] })
  }

  const counts = {}
  for (const e of unique) { const g = KIND_GROUP[e.kind] || 'note'; counts[g] = (counts[g] || 0) + 1 }

  return {
    groups,
    count: unique.length,
    counts,
    range,
    filter,
    cutoff,
    enough: unique.length > 0,
    reason: unique.length ? `${unique.length} events${cutoff ? ` in the last ${range.days} days` : ''}.` : NOT_ENOUGH,
  }
}

/* ------------------------------------------------------------
   3 · PERFORMANCE TRAJECTORY — PAST / CURRENT / PROJECTED

   Goals reuse goalProjection verbatim. Projects and assignments use
   the same arithmetic on their own real progress-log points; that is
   the calculation goalProjection already performs, not a new model.
   Habits get no projection at all: cadence is not a percentage, and
   inventing one would be a lie.
   ------------------------------------------------------------ */

/** Points/day from real logged points, then the day 100% is reached. */
function projectFromPoints(rows, { now = new Date() } = {}) {
  const pts = rows.filter((r) => r.pct != null && !r.future)
  if (pts.length < 2) return { day: null, reason: 'insufficient' }
  const first = pts[0]
  const last = pts[pts.length - 1]
  const span = Math.round((msDay(last.date) - msDay(first.date)) / 86400000)
  if (span <= 0) return { day: null, reason: 'insufficient' }
  const perDay = (last.pct - first.pct) / span
  if (perDay <= 0) return { day: null, reason: 'stalled', perDay }
  const daysLeft = Math.ceil((100 - last.pct) / perDay)
  if (daysLeft > 3650) return { day: null, reason: 'stalled', perDay }
  return { day: addDaysStr(dayStr(now), daysLeft), reason: 'projected', perDay, daysLeft }
}

const PROJECTION_REASON = {
  projected: 'Projected from your real progress points.',
  insufficient: 'Not enough progress history to project.',
  stalled: 'No forward progress in the window, so there is nothing honest to project.',
  complete: 'Already complete.',
}

export function trajectorySeries(state, { kind = 'goal', id, days = 30, now = new Date() } = {}) {
  const today = dayStr(now)

  if (kind === 'goal') {
    const goal = (state.goals || []).find((g) => g.id === id)
    if (!goal) return { enough: false, kind, reason: 'That goal no longer exists.' }
    const actual = goalActualSeries(state, goal, { days })
    const expected = goalExpectedSeries(state, goal, { days }) || null
    const prog = goalProgress(state, goal, { now })
    const projection = goalProjection(state, goal, { now })
    const velocity = goalVelocity(state, goal)
    return {
      enough: actual.some((r) => r.pct != null),
      kind, id, name: goal.title,
      past: actual, expected,
      expectedReason: expected ? null : 'No start date on this goal, so there is no expected pace to draw.',
      current: prog.pct,
      projected: projection.day,
      projectionReason: PROJECTION_REASON[projection.reason] || projection.reason,
      projectionState: projection.reason,
      velocity: velocity ? velocity.perWeek : null,
      velocityUnit: 'points/week',
      risk: goalHealth(state, goal, { now }).tone,
      reason: PROJECTION_REASON[projection.reason],
    }
  }

  if (kind === 'project' || kind === 'assignment') {
    const isProject = kind === 'project'
    const item = (isProject ? state.projects : state.assignments || []).find((x) => x.id === id)
    if (!item) return { enough: false, kind, reason: 'That item no longer exists.' }
    const from = subDaysStr(today, days - 1)
    const past = progressSeries(item, from, today)
    const current = isProject ? projectProgress(item).pct : assignmentProgress(item).pct
    const status = isProject ? projectStatus(item, now) : assignmentStatus(item, now)
    const projection = projectFromPoints(past, { now })
    const pace = isProject ? projectForecast(item, { now }) : assignmentPace(item, { now })
    return {
      enough: past.some((r) => r.pct != null),
      kind, id, name: item.name,
      past,
      expected: isProject
        ? past.map((r) => ({ day: r.date, pct: status.elapsedPct == null ? null : Math.max(0, Math.min(100, status.elapsedPct)) }))
        : (pace.enough ? past.map((r) => ({ day: r.date, pct: pace.expectedPct })) : null),
      current,
      projected: projection.day,
      projectionReason: PROJECTION_REASON[projection.reason] || projection.reason,
      projectionState: projection.reason,
      velocity: isProject ? null : (pace.enough ? pace.gap : null),
      velocityUnit: isProject ? null : 'points vs expected',
      risk: status.id,
      deadline: item.deadline || null,
      reason: PROJECTION_REASON[projection.reason],
    }
  }

  if (kind === 'habit') {
    const habit = (state.habits || []).find((h) => h.id === id)
    if (!habit) return { enough: false, kind, reason: 'That habit no longer exists.' }
    const past = trendSeries(state, days)
    const rate = habitRate(state, habit, subDaysStr(today, days - 1), today)
    return {
      enough: rate.eligible > 0,
      kind, id, name: habit.name,
      past: past.map((r) => ({ day: r.date, pct: r.pct })),
      expected: null,
      current: rate.eligible ? Math.round(rate.rate * 100) : null,
      projected: null,
      projectionReason: 'A habit measures cadence, not completion — there is no percentage to project.',
      projectionState: 'not-applicable',
      velocity: null,
      velocityUnit: null,
      risk: null,
      streak: habitStreak(state, habit),
      reason: rate.eligible ? `${rate.done} of ${rate.eligible} scheduled days completed in the window.` : NOT_ENOUGH,
    }
  }

  return { enough: false, kind, reason: 'Unknown trajectory kind.' }
}

/* ------------------------------------------------------------
   4 · WORKLOAD LANDSCAPE

   workloadSeries already returns per-day minutes *and* the items
   behind them. This adds the capacity frame and flattens the items
   into a drill-down list. Capacity is only ever what the user set.
   ------------------------------------------------------------ */

export function workloadLandscape(state, { days = 14, now = new Date() } = {}) {
  const prefs = preferencesOf(state)
  const capacityMin = prefs.dailyCapacityMin
  const series = workloadSeries(state, { from: dayStr(now), days, now })

  const rows = series.rows.map((r) => {
    const items = [
      ...r.assignments.map((x) => ({ kind: 'assignment', id: x.item.id, name: x.item.name, minutes: Number(x.item.estimateMin) || 0, href: `assignments/${x.item.id}`, status: x.status.label })),
      ...r.projects.map((x) => ({ kind: 'project', id: x.item.id, name: x.item.name, minutes: Number(x.item.estimateMin) || 0, href: `projects/${x.item.id}`, status: x.status.label })),
      ...r.tasks.map((x) => ({ kind: 'task', id: x.task.id, name: x.task.name, minutes: Number(x.task.estimateMin) || 0, href: `projects/${x.item.id}`, status: x.item.name })),
      ...r.milestones.map((x) => ({ kind: 'milestone', id: x.milestone.id, name: x.milestone.name, minutes: 0, href: x.item.id ? `projects/${x.item.id}` : 'goals', status: x.item.name })),
    ]
    return {
      date: r.date,
      label: r.label,
      weekday: WEEKDAY_NAMES[r.weekday],
      committedMin: r.minutes,
      count: r.count,
      capacityMin,
      remainingMin: capacityMin == null ? null : capacityMin - r.minutes,
      loadPct: capacityMin ? Math.round((r.minutes / capacityMin) * 100) : null,
      overloaded: capacityMin != null && r.minutes > capacityMin,
      past: r.past,
      items,
    }
  })

  const loaded = rows.filter((r) => r.committedMin > 0)
  const overloaded = rows.filter((r) => r.overloaded)
  const peak = rows.reduce((m, r) => (r.committedMin > (m?.committedMin ?? -1) ? r : m), null)
  const totalMin = rows.reduce((n, r) => n + r.committedMin, 0)

  return {
    rows,
    days,
    capacityMin,
    totalMin,
    meanMin: loaded.length ? Math.round(mean(loaded.map((r) => r.committedMin))) : null,
    peak,
    peakDay: peak?.date || null,
    overloadedDays: overloaded.length,
    enough: loaded.length > 0,
    capacityKnown: capacityMin != null,
    reason: !loaded.length
      ? NOT_ENOUGH
      : capacityMin == null
        ? `${loaded.length} day${loaded.length === 1 ? '' : 's'} carry committed work. Set a daily capacity in Settings → How you work to see overload.`
        : `${overloaded.length} of ${rows.length} day${rows.length === 1 ? '' : 's'} exceed your ${minutesLabel(capacityMin)} capacity.`,
  }
}

/* ------------------------------------------------------------
   5 · HABIT CONSISTENCY MATRIX

   habitMatrix already builds the grid; this adds filtering, range
   control, the weekday roll-up and the per-cell evidence a drill-down
   needs.
   ------------------------------------------------------------ */

export function consistencyMatrix(state, { days = 28, habitIds = null, now = new Date() } = {}) {
  const today = dayStr(now)
  const dates = dayList(days, now)
  const all = habitMatrix(state, dates)
  const wanted = Array.isArray(habitIds) && habitIds.length ? new Set(habitIds) : null
  const rows = all.filter((r) => !wanted || wanted.has(r.habit.id)).map((r) => {
    const scheduled = r.cells.filter((c) => c.scheduled)
    const done = scheduled.filter((c) => c.done).length
    return {
      habit: r.habit,
      cells: r.cells,
      scheduled: scheduled.length,
      done,
      pct: scheduled.length ? Math.round((done / scheduled.length) * 100) : null,
      streak: habitStreak(state, r.habit),
    }
  })

  const weekday = Array.from({ length: 7 }, (_, wd) => {
    let done = 0
    let total = 0
    for (const r of rows) {
      for (const c of r.cells) {
        if (!c.scheduled || weekdayOf(c.date) !== wd) continue
        total++
        if (c.done) done++
      }
    }
    return { weekday: wd, name: WEEKDAY_NAMES[wd], short: WEEKDAY_NAMES[wd].slice(0, 3), done, total, pct: total >= 3 ? Math.round((done / total) * 100) : null }
  })

  const best = weekday.filter((w) => w.pct != null).sort((a, b) => b.pct - a.pct)[0] || null
  const worst = weekday.filter((w) => w.pct != null).sort((a, b) => a.pct - b.pct)[0] || null

  return {
    dates, rows, weekday, days, today,
    best, worst,
    enough: rows.length > 0 && rows.some((r) => r.scheduled > 0),
    reason: rows.length ? `${rows.length} habit${rows.length === 1 ? '' : 's'} over ${days} days.` : NOT_ENOUGH,
  }
}

/** What actually happened in one cell of the matrix. */
export function matrixCellDetail(state, habit, date) {
  if (!habit || !isValidDayStr(date)) return { enough: false, reason: 'Not a valid cell.' }
  const scheduled = eligibleOn(habit, date)
  const done = isDone(state, habit.id, date)
  const entry = state.checkins?.[habit.id]?.[date] || null
  return {
    enough: true,
    habit: habit.name,
    date,
    scheduled,
    done,
    at: entry?.at || null,
    note: entry?.note || null,
    skipped: Array.isArray(habit.skips) && habit.skips.includes(date),
    paused: Boolean(habit.pause) && habit.pause.from <= date && (!habit.pause.until || date <= habit.pause.until),
    future: date > todayStr(),
    streak: habitStreak(state, habit),
    reason: done
      ? `Completed${entry?.at ? ` at ${String(entry.at).slice(11, 16)}` : ''}.`
      : !scheduled ? 'Not scheduled on this day.'
        : `Scheduled and not completed.`,
  }
}

/* ------------------------------------------------------------
   6 · GOAL CONTRIBUTION

   goalContributors supplies the share arithmetic; this adds the
   milestone layer and the nested shape. Habits are listed with a
   null share — a habit has no percentage to contribute.
   ------------------------------------------------------------ */

export function goalContribution(state, goal, { days = 30, now = new Date() } = {}) {
  if (!goal) return { enough: false, reason: 'No goal selected.' }
  const contributors = goalContributors(state, goal)
  const prog = goalProgress(state, goal, { now })
  const pace = goalPace(goal, { now })
  const today = dayStr(now)

  const milestones = (goal.milestones || []).map((m) => ({
    id: m.id, name: m.name, done: m.done,
    targetDate: m.targetDate || null,
    onTime: m.done && m.targetDate ? dayOf(m.doneAt) <= m.targetDate : null,
    overdue: !m.done && m.targetDate ? m.targetDate < today : false,
  }))

  const projects = (goal.linkedProjectIds || []).map((id) => (state.projects || []).find((p) => p.id === id)).filter(Boolean)
    .map((p) => ({
      id: p.id, name: p.name, pct: projectProgress(p).pct,
      tasks: allTasks(p).length,
      tasksDone: allTasks(p).filter((t) => t.done).length,
      deadline: p.deadline || null,
      status: projectStatus(p, now).label,
    }))

  const assignments = (goal.linkedAssignmentIds || []).map((id) => (state.assignments || []).find((a) => a.id === id)).filter(Boolean)
    .map((a) => ({
      id: a.id, name: a.name, pct: assignmentProgress(a).pct,
      subtasks: (a.subtasks || []).length,
      subtasksDone: (a.subtasks || []).filter((s) => s.done).length,
      deadline: a.deadline || null,
      status: assignmentStatus(a, now).label,
    }))

  const habits = (goal.linkedHabitIds || []).map((id) => (state.habits || []).find((h) => h.id === id)).filter(Boolean)
    .map((h) => {
      const r = habitRate(state, h, subDaysStr(today, days - 1), today)
      return { id: h.id, name: h.name, pct: r.eligible ? Math.round(r.rate * 100) : null, scheduled: r.eligible, done: r.done, streak: habitStreak(state, h) }
    })

  const linked = projects.length + assignments.length + habits.length
  return {
    enough: contributors.enough,
    reason: contributors.enough ? contributors.reason : (linked ? 'Linked items have no measurable progress yet.' : 'Nothing is linked to this goal yet.'),
    goal: { id: goal.id, title: goal.title, pct: prog.pct, expected: pace?.expected ?? null, targetDate: goal.targetDate || null },
    milestones, projects, assignments, habits,
    shares: contributors.rows,
    counts: { milestones: milestones.length, projects: projects.length, assignments: assignments.length, habits: habits.length, linked },
  }
}

/* ------------------------------------------------------------
   7 · PRODUCTIVITY VELOCITY

   Definitions are in docs/ANALYTICS-AUDIT.md §4. One completion is
   one dated event from completionEvents(); nothing is weighted or
   inferred.
   ------------------------------------------------------------ */

export function productivityVelocity(state, { weeks = 8, baselineWeeks = 4, now = new Date() } = {}) {
  const events = completionEvents(state)
  const today = dayStr(now)

  // Most recent *complete* week first, then backwards.
  const rows = []
  for (let w = 0; w < weeks; w++) {
    const anchor = subDaysStr(today, w * 7)
    const days = weekDays(anchor, preferencesOf(state).weekStartsOn)
    const complete = days.every((d) => d <= today)
    const set = new Set(days)
    const inWeek = events.filter((e) => set.has(e.day))
    const byKind = {}
    for (const e of inWeek) byKind[e.kind] = (byKind[e.kind] || 0) + 1
    rows.push({ start: days[0], end: days[days.length - 1], label: w === 0 ? 'This week' : w === 1 ? 'Last week' : `${shortDate(days[0])}`, count: inWeek.length, byKind, complete, index: w })
  }
  rows.reverse()

  const completeRows = rows.filter((r) => r.complete)
  const current = completeRows.at(-1) || null
  const previous = completeRows.at(-2) || null
  const baselineRows = completeRows.slice(0, Math.max(0, completeRows.length - 1)).slice(-baselineWeeks)
  const baseline = baselineRows.length >= 2 ? Math.round(mean(baselineRows.map((r) => r.count)) * 10) / 10 : null
  const acceleration = current && previous ? current.count - previous.count : null
  /* Two empty weeks are not a velocity — there is nothing to describe. */
  const enough = Boolean(current && previous) && (current.count > 0 || previous.count > 0)

  let trend = 'INSUFFICIENT DATA'
  if (enough && baseline != null && baseline > 0) {
    const ratio = acceleration / baseline
    trend = ratio >= 0.15 ? 'ACCELERATING' : ratio <= -0.15 ? 'DECELERATING' : 'STEADY'
  }

  const byKind = {}
  for (const e of events) byKind[e.kind] = (byKind[e.kind] || 0) + 1

  return {
    rows, current, previous, baseline, baselineWeeks: baselineRows.length,
    acceleration, trend, byKind, total: events.length,
    enough,
    reason: !enough
      ? NOT_ENOUGH
      : `${current.count} completions this week vs ${previous.count} last week${baseline != null ? `, against a ${baseline}/week baseline` : ''}.`,
  }
}

/* ------------------------------------------------------------
   8 · DEADLINE PRESSURE MAP

   Exclusive bands, so an item is counted once. Risk labels come from
   the existing status engines — this module invents none.
   ------------------------------------------------------------ */

export const PRESSURE_BANDS = [
  { id: 'overdue', label: 'Overdue', from: -Infinity, to: -1 },
  { id: 'today', label: 'Today', from: 0, to: 0 },
  { id: 'tomorrow', label: 'Tomorrow', from: 1, to: 1 },
  { id: '3d', label: '2–3 days', from: 2, to: 3 },
  { id: '7d', label: '4–7 days', from: 4, to: 7 },
  { id: '30d', label: '8–30 days', from: 8, to: 30 },
]

export function deadlinePressureMap(state, { now = new Date() } = {}) {
  const today = dayStr(now)
  const rows = PRESSURE_BANDS.map((b) => ({ ...b, items: [], count: 0, minutes: 0, atRisk: 0, critical: 0, overdue: 0 }))
  const byId = new Map(rows.map((r) => [r.id, r]))

  for (const p of openProjects(state)) {
    if (!p.deadline) continue
    const day = dayOf(p.deadline)
    if (!day) continue
    const diff = Math.round((msDay(day) - msDay(today)) / 86400000)
    const band = [...byId.values()].find((b) => diff >= b.from && diff <= b.to)
    if (!band) continue
    const st = projectStatus(p, now)
    const pct = projectProgress(p).pct
    band.items.push({ kind: 'project', id: p.id, name: p.name, pct, minutes: Math.round((Number(p.estimateMin) || 0) * (1 - pct / 100)), status: st.label, tone: st.tone, href: `projects/${p.id}`, day })
  }
  for (const a of openAssignments(state)) {
    if (!a.deadline) continue
    const day = dayOf(a.deadline)
    if (!day) continue
    const diff = Math.round((msDay(day) - msDay(today)) / 86400000)
    const band = [...byId.values()].find((b) => diff >= b.from && b.to >= diff)
    if (!band) continue
    const st = assignmentStatus(a, now)
    const pct = assignmentProgress(a).pct
    band.items.push({ kind: 'assignment', id: a.id, name: a.name, pct, minutes: Math.round((Number(a.estimateMin) || 0) * (1 - pct / 100)), status: st.label, tone: st.tone, href: `assignments/${a.id}`, day })
  }

  for (const r of rows) {
    r.count = r.items.length
    r.minutes = r.items.reduce((n, i) => n + i.minutes, 0)
    r.atRisk = r.items.filter((i) => ['AT RISK', 'at risk'].includes(i.status)).length
    r.critical = r.items.filter((i) => ['URGENT', 'urgent'].includes(i.status)).length
    r.overdue = r.items.filter((i) => i.tone === 'bad' || ['OVERDUE', 'overdue'].includes(i.status)).length
    r.items.sort((a, b) => String(a.day).localeCompare(String(b.day)) || b.minutes - a.minutes)
  }

  const dated = rows.filter((r) => r.id !== 'overdue')
  const total = rows.reduce((n, r) => n + r.count, 0)
  const peak = dated.reduce((m, r) => (r.minutes > (m?.minutes ?? -1) ? r : m), null)

  return {
    rows, total,
    totalMinutes: rows.reduce((n, r) => n + r.minutes, 0),
    atRisk: rows.reduce((n, r) => n + r.atRisk, 0),
    critical: rows.reduce((n, r) => n + r.critical, 0),
    overdue: byId.get('overdue')?.count || 0,
    peakBand: peak && peak.count > 0 ? peak.id : null,
    enough: total > 0,
    reason: total ? `${total} item${total === 1 ? '' : 's'} carry a deadline in the next 30 days or are already late.` : NOT_ENOUGH,
  }
}

/* ------------------------------------------------------------
   9 · COMPARISON MODE

   Both windows must be real and complete before anything is shown.
   A metric with a null on either side reports `enough: false` rather
   than a delta against nothing.
   ------------------------------------------------------------ */

const cmp = (label, unit, current, previous, higherIsBetter = true) => {
  /* A number on both sides is not by itself enough: 0 vs 0 says nothing
     about change, so it is withheld like any other thin comparison. */
  const ok = Number.isFinite(current) && Number.isFinite(previous) && !(current === 0 && previous === 0)
  const delta = ok ? Math.round((current - previous) * 10) / 10 : null
  return {
    label, unit, current, previous, delta,
    deltaPct: ok && previous !== 0 ? Math.round(((current - previous) / Math.abs(previous)) * 100) : null,
    direction: !ok ? null : delta === 0 ? 'flat' : (delta > 0) === higherIsBetter ? 'good' : 'warn',
    enough: ok,
    reason: ok ? null : NOT_ENOUGH,
  }
}

export function comparisonSeries(state, { window = 'week', now = new Date() } = {}) {
  const today = dayStr(now)
  const span = window === 'month' ? 30 : 7
  const curFrom = subDaysStr(today, span - 1)
  const prevFrom = subDaysStr(today, span * 2 - 1)
  const prevTo = subDaysStr(today, span)

  const events = completionEvents(state)
  const countIn = (from, to) => events.filter((e) => e.day >= from && e.day <= to).length

  const consistencyIn = (from, to) => {
    let done = 0
    let total = 0
    let cursor = from
    while (cursor <= to) {
      const s = dayStats(state, cursor)
      done += s.done
      total += s.total
      cursor = addDaysStr(cursor, 1)
    }
    return total ? Math.round((done / total) * 100) : null
  }

  const workloadIn = (from, days) => {
    const s = workloadSeries(state, { from, days, now })
    return s.minutes
  }

  const meanGoalPct = (day) => {
    const goals = (state.goals || []).filter((g) => !g.archived && (g.status || 'active') === 'active')
    if (!goals.length) return null
    const vals = goals.map((g) => goalProgress(state, g, { now: new Date(`${day}T12:00:00`) }).pct).filter(Number.isFinite)
    return vals.length ? Math.round(mean(vals)) : null
  }

  const meanWorkPct = (list, day) => {
    const open = list.filter((x) => !x.archived)
    if (!open.length) return null
    const vals = open.map((x) => progressSeries(x, day, day)[0]?.pct).filter(Number.isFinite)
    return vals.length ? Math.round(mean(vals)) : null
  }

  const metrics = [
    cmp('Completions', 'events', countIn(curFrom, today), countIn(prevFrom, prevTo)),
    cmp('Habit consistency', '%', consistencyIn(curFrom, today), consistencyIn(prevFrom, prevTo)),
    cmp('Committed workload', 'min', workloadIn(curFrom, span), workloadIn(prevFrom, span), false),
    cmp('Goal progress', '%', meanGoalPct(today), meanGoalPct(prevTo)),
    cmp('Project progress', '%', meanWorkPct(state.projects || [], today), meanWorkPct(state.projects || [], prevTo)),
    cmp('Assignment execution', '%', meanWorkPct(state.assignments || [], today), meanWorkPct(state.assignments || [], prevTo)),
  ]

  const shown = metrics.filter((m) => m.enough)
  return {
    window,
    span,
    current: { from: curFrom, to: today },
    previous: { from: prevFrom, to: prevTo },
    metrics,
    shown,
    enough: shown.length > 0,
    reason: shown.length
      ? `${shown.length} of ${metrics.length} comparisons have real data on both sides.`
      : NOT_ENOUGH,
  }
}

/* ------------------------------------------------------------
   10 · INSIGHT DRILL-DOWN

   OBSERVATION → EVIDENCE → UNDERSTANDING. Each entry names the
   observation, lists the evidence behind it, and returns the actual
   items so the UI can show what created it.
   ------------------------------------------------------------ */

function weekdayEvidence(state, weekday, { now = new Date(), days = 84 } = {}) {
  const today = dayStr(now)
  const from = subDaysStr(today, days - 1)
  const dayRows = []
  let cursor = from
  while (cursor <= today) {
    if (weekdayOf(cursor) === weekday) {
      const s = dayStats(state, cursor)
      const load = workloadSeries(state, { from: cursor, days: 1, now }).rows[0]
      dayRows.push({
        date: cursor, done: s.done, total: s.total, pct: s.pct,
        committedMin: load?.minutes || 0,
        items: [
          ...(load?.assignments || []).map((x) => ({ kind: 'assignment', name: x.item.name, href: `assignments/${x.item.id}` })),
          ...(load?.projects || []).map((x) => ({ kind: 'project', name: x.item.name, href: `projects/${x.item.id}` })),
          ...(load?.tasks || []).map((x) => ({ kind: 'task', name: x.task.name, href: `projects/${x.item.id}` })),
        ],
      })
    }
    cursor = addDaysStr(cursor, 1)
  }
  const focus = (state.focusLog || []).filter((s) => s?.startedAt && weekdayOf(dayOf(s.startedAt)) === weekday)
  const measured = dayRows.filter((d) => d.total > 0)
  return {
    dayRows, measured,
    rate: measured.length ? Math.round((measured.reduce((n, d) => n + d.done, 0) / measured.reduce((n, d) => n + d.total, 0)) * 100) : null,
    meanLoad: measured.length ? Math.round(mean(measured.map((d) => d.committedMin))) : null,
    focusSessions: focus.length,
  }
}

export function insightDrilldown(state, insightId, { now = new Date() } = {}) {
  const id = String(insightId || '')

  const weekdayMatch = id.match(/^weekday-(best|worst)$/)
  if (weekdayMatch) {
    const perf = weekdayPerformance(state, 12)
    const row = weekdayMatch[1] === 'best' ? perf.best : perf.worst
    if (!row) return { enough: false, id, observation: null, reason: NOT_ENOUGH }
    const ev = weekdayEvidence(state, row.weekday, { now })
    return {
      enough: true, id,
      observation: `${row.name} is your ${weekdayMatch[1] === 'best' ? 'strongest' : 'hardest'} day at ${Math.round(row.rate * 100)}%.`,
      evidence: [
        { label: 'Completion rate', value: `${Math.round(row.rate * 100)}%` },
        { label: 'Observed days', value: String(row.samples) },
        { label: 'Mean committed work', value: ev.meanLoad == null ? 'unknown' : minutesLabel(ev.meanLoad) },
        { label: 'Focus sessions', value: String(ev.focusSessions) },
      ],
      detail: ev.dayRows.slice(-8),
      items: ev.dayRows.flatMap((d) => d.items).slice(0, 12),
      reason: `${row.done} of ${row.total} scheduled habit slots completed on ${row.name}s over ${perf.windowWeeks} weeks.`,
    }
  }

  if (id === 'workload-peak') {
    const land = workloadLandscape(state, { days: 14, now })
    if (!land.peak || land.peak.committedMin === 0) return { enough: false, id, observation: null, reason: NOT_ENOUGH }
    const p = land.peak
    return {
      enough: true, id,
      observation: `${p.weekday} ${shortDate(p.date)} is your heaviest day at ${minutesLabel(p.committedMin)}.`,
      evidence: [
        { label: 'Committed', value: minutesLabel(p.committedMin) },
        { label: 'Capacity', value: p.capacityMin == null ? 'not set' : minutesLabel(p.capacityMin) },
        { label: 'Items', value: String(p.count) },
      ],
      detail: p.items,
      items: p.items,
      reason: p.overloaded ? `That is ${minutesLabel(Math.abs(p.remainingMin))} over your capacity.` : 'Here is what lands on that day.',
    }
  }

  if (id === 'most-consistent' || id === 'least-consistent') {
    const ranked = consistencyRanking(state, 90)
    if (!ranked.length) return { enough: false, id, observation: null, reason: NOT_ENOUGH }
    const row = id === 'most-consistent' ? ranked[0] : ranked[ranked.length - 1]
    return {
      enough: true, id,
      observation: `${row.habit.name} scores ${row.score}/100 for consistency.`,
      evidence: [
        { label: 'Score', value: String(row.score) },
        { label: 'Best run', value: `${row.bestRun} days` },
        { label: 'Current streak', value: `${habitStreak(state, row.habit)} days` },
      ],
      detail: trendSeries(state, 30).map((r) => ({ date: r.date, pct: r.pct })),
      items: [],
      reason: 'Scored over the last 90 days of real check-ins.',
    }
  }

  if (id === 'time-of-day') {
    const tod = timeOfDayPerformance(state, 90)
    if (!tod.enough) return { enough: false, id, observation: null, reason: NOT_ENOUGH }
    const peak = tod.parts.find((p) => p.id === tod.peak)
    return {
      enough: true, id,
      observation: `${peak.pct}% of your check-ins happen in the ${peak.label.toLowerCase()}.`,
      evidence: tod.parts.map((p) => ({ label: p.label, value: `${p.pct}%` })),
      detail: (state.focusLog || []).slice(-10).map((s) => ({ date: dayOf(s.startedAt), name: s.name, minutes: s.actualMin })),
      items: [],
      reason: `From ${tod.total} logged check-in times.`,
    }
  }

  if (id === 'dist-full' || id === 'dist-low') {
    const dist = completionDistribution(state, 90)
    if (!dist.enough) return { enough: false, id, observation: null, reason: NOT_ENOUGH }
    return {
      enough: true, id,
      observation: id === 'dist-full' ? 'Most of your tracked days land at 75% completion or better.' : 'Many of your tracked days finish under 25%.',
      evidence: dist.buckets.map((b) => ({ label: b.label, value: `${b.pct}%` })),
      detail: [],
      items: [],
      reason: `Across ${dist.total} tracked days.`,
    }
  }

  // Anything unrecognised is reported honestly rather than guessed at.
  return { enough: false, id, observation: null, evidence: [], detail: [], items: [], reason: 'This insight has no drill-down yet.' }
}

/** Attach drill-down availability to the existing insights. */
export function explorableInsights(state, { limit = 6, now = new Date() } = {}) {
  const land = workloadLandscape(state, { days: 14, now })
  const base = smartInsights(state, limit).map((i) => ({ ...i, drilldown: insightDrilldown(state, i.id, { now }) }))
  if (land.enough && land.peak && land.peak.committedMin > 0) {
    const d = insightDrilldown(state, 'workload-peak', { now })
    base.push({
      id: 'workload-peak',
      tone: land.peak.overloaded ? 'warn' : 'neutral',
      title: 'Heaviest day',
      text: d.observation,
      metric: minutesLabel(land.peak.committedMin),
      drilldown: d,
    })
  }
  return base.filter((i) => i.drilldown.enough)
}

/* ------------------------------------------------------------
   11 · DATA STORY MODE

   Five steps, each with a headline, a finding and the evidence
   behind it. A step with no data says so instead of padding.
   ------------------------------------------------------------ */

export function storySteps(state, { now = new Date() } = {}) {
  const today = dayStr(now)
  const velocity = productivityVelocity(state, { weeks: 8, now })
  const comparison = comparisonSeries(state, { window: 'week', now })
  const land = workloadLandscape(state, { days: 14, now })
  const pressure = deadlinePressureMap(state, { now })
  const ranking = consistencyRanking(state, 90)

  const steps = []

  // 1 · What happened
  steps.push({
    id: 'happened',
    question: 'What happened?',
    enough: velocity.enough || velocity.total > 0,
    headline: velocity.enough
      ? `${velocity.current.count} things completed this week.`
      : velocity.total ? `${velocity.total} completions on record.` : NOT_ENOUGH,
    finding: velocity.enough ? velocity.reason : NOT_ENOUGH,
    evidence: velocity.enough
      ? Object.entries(velocity.current.byKind).map(([k, v]) => ({ label: COMPLETION_LABEL[k] || k, value: String(v) }))
      : [],
    detail: velocity.rows.slice(-8),
    tone: 'neutral',
  })

  // 2 · What changed
  const changed = comparison.shown.filter((m) => m.delta !== 0)
  steps.push({
    id: 'changed',
    question: 'What changed?',
    enough: changed.length > 0,
    headline: changed.length ? `${changed.length} measure${changed.length === 1 ? '' : 's'} moved versus last week.` : comparison.enough ? 'Nothing moved versus last week.' : NOT_ENOUGH,
    finding: comparison.reason,
    evidence: changed.map((m) => ({ label: m.label, value: `${m.delta > 0 ? '+' : ''}${m.delta}${m.unit === '%' ? '%' : ` ${m.unit}`}` })),
    detail: comparison.metrics,
    tone: changed.some((m) => m.direction === 'warn') ? 'warn' : 'good',
  })

  // 3 · Why
  const best = ranking[0] || null
  const weekdayPerf = weekdayPerformance(state, 12)
  steps.push({
    id: 'why',
    question: 'Why?',
    enough: Boolean(best || (weekdayPerf.enough && weekdayPerf.best)),
    headline: best && weekdayPerf.enough && weekdayPerf.best
      ? `${best.habit.name} is carrying the most consistency, and ${weekdayPerf.best.name}s are your strongest days.`
      : best ? `${best.habit.name} is your most consistent habit.` : NOT_ENOUGH,
    finding: best ? `${best.habit.name} scores ${best.score}/100 over 90 days with a ${best.bestRun}-day best run.` : NOT_ENOUGH,
    evidence: [
      ...(best ? [{ label: 'Consistency score', value: String(best.score) }] : []),
      ...(weekdayPerf.enough && weekdayPerf.best ? [{ label: 'Strongest weekday', value: `${weekdayPerf.best.name} · ${Math.round(weekdayPerf.best.rate * 100)}%` }] : []),
      ...(land.enough && land.meanMin != null ? [{ label: 'Mean daily load', value: minutesLabel(land.meanMin) }] : []),
    ],
    detail: land.rows.slice(-7),
    tone: 'neutral',
  })

  // 4 · What is at risk
  const riskItems = pressure.rows.flatMap((r) => r.items.filter((i) => ['bad', 'warn'].includes(i.tone)))
  steps.push({
    id: 'risk',
    question: 'What is at risk?',
    enough: pressure.enough,
    headline: pressure.overdue
      ? `${pressure.overdue} item${pressure.overdue === 1 ? ' is' : 's are'} already past a deadline.`
      : pressure.atRisk ? `${pressure.atRisk} item${pressure.atRisk === 1 ? '' : 's'} at risk in the next 30 days.`
        : pressure.enough ? 'Nothing is flagged as at risk.' : NOT_ENOUGH,
    finding: pressure.reason,
    evidence: [
      { label: 'Overdue', value: String(pressure.overdue) },
      { label: 'At risk', value: String(pressure.atRisk) },
      { label: 'Effort ahead', value: minutesLabel(pressure.totalMinutes) },
    ],
    detail: riskItems.slice(0, 8),
    tone: pressure.overdue ? 'bad' : pressure.atRisk ? 'warn' : 'good',
  })

  // 5 · What to consider next
  const suggestion = land.overloadedDays > 0
    ? `${land.overloadedDays} day${land.overloadedDays === 1 ? '' : 's'} in the next fortnight exceed your capacity. Moving one non-critical item would flatten the peak.`
    : velocity.enough && velocity.trend === 'DECELERATING'
      ? 'Completion has slowed against your own baseline. A shorter first task usually restarts it.'
      : pressure.enough && pressure.peakBand
        ? `The ${PRESSURE_BANDS.find((b) => b.id === pressure.peakBand)?.label.toLowerCase()} band holds the most work. Starting there protects the rest of the week.`
        : 'Nothing needs changing right now.'
  steps.push({
    id: 'next',
    question: 'What should I consider next?',
    enough: land.enough || pressure.enough || velocity.enough,
    headline: suggestion,
    finding: land.reason,
    evidence: [
      ...(land.capacityKnown ? [{ label: 'Overloaded days', value: String(land.overloadedDays) }] : []),
      ...(velocity.enough ? [{ label: 'Trend', value: velocity.trend }] : []),
    ],
    detail: land.rows.filter((r) => r.overloaded).slice(0, 5),
    tone: 'neutral',
  })

  return {
    steps,
    enough: steps.some((s) => s.enough),
    supported: steps.filter((s) => s.enough).length,
    total: steps.length,
    generatedOn: today,
    reason: steps.some((s) => s.enough) ? 'Every step below is derived from your own logged data.' : NOT_ENOUGH,
  }
}

/* Re-exported so the UI has one import surface for ranges and filters. */
export { heatmapSeries, deadlineLanes, activeHabits, WEEKDAY_NAMES }
