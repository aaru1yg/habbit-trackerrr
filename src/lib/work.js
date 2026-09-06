/* ============================================================
   WORK ENGINE — Projects & Assignments.
   Separate from habits on purpose: habits measure CONSISTENCY,
   projects measure PROGRESS, assignments measure DEADLINE RISK.

   Every value here is derived from stored data (tasks, timestamps,
   progress log). Nothing is estimated, invented, or rounded up to
   look better: 4 of 10 tasks is 40%, never 50%.
   ============================================================ */
import {
  todayStr, dayStr, addDaysStr, subDaysStr, weekDays, isValidDayStr,
  toLocalDate, dayOf, msUntil, daysUntil, hoursUntil, elapsedFraction,
  countdownLabel, dueLabel, relativeDayLabel, minutesBetween, minutesLabel, isoLocal,
} from './dates.js'

export const PRIORITIES = [
  { id: 'low', label: 'Low' },
  { id: 'normal', label: 'Normal' },
  { id: 'high', label: 'High' },
]
const PRIORITY_RANK = { high: 0, normal: 1, low: 2 }
export const priorityRank = (p) => PRIORITY_RANK[p] ?? 1

export const TASK_STATUSES = [
  { id: 'todo', label: 'To do' },
  { id: 'doing', label: 'In progress' },
  { id: 'blocked', label: 'Blocked' },
  { id: 'done', label: 'Done' },
]
export const taskStatusOf = (t) => (t?.done ? 'done' : TASK_STATUSES.find((s) => s.id === t?.status)?.id || 'todo')

/** Status → tone (drives color semantics everywhere). */
export const STATUS_TONE = {
  completed: 'good',
  onTrack: 'good',
  atRisk: 'warn',
  urgent: 'bad',
  overdue: 'bad',
  noDeadline: 'neutral',
  paused: 'neutral',
}
export const STATUS_LABEL = {
  completed: 'Completed',
  onTrack: 'On track',
  atRisk: 'At risk',
  urgent: 'Urgent',
  overdue: 'Overdue',
  noDeadline: 'No deadline',
  paused: 'Paused',
}

/* ------------------------------------------------------------
   PROGRESS — task-derived first, explicit percentage otherwise.
   ------------------------------------------------------------ */

export const allTasks = (project) => (project?.milestones || []).flatMap((m) => m.tasks || [])

/** Round-half-up to an integer percent so 1/3 → 33% and 2/3 → 67%. */
export const pctFrom = (done, total) => (total > 0 ? Math.round((done / total) * 100) : null)

/**
 * Project progress.
 * mode 'tasks'   → done/total across every milestone task (4/10 = 40%)
 * mode 'manual'  → explicit percent the user set (10-point steps in the UI)
 * mode 'legacy'  → percent carried over from an older version
 * mode 'none'    → nothing to measure yet (0%, honest)
 */
export function projectProgress(project) {
  if (!project) return { pct: 0, done: 0, total: 0, mode: 'none', remaining: 0 }
  const tasks = allTasks(project)
  if (tasks.length) {
    const done = tasks.filter((t) => t.done).length
    const pct = pctFrom(done, tasks.length)
    return { pct, done, total: tasks.length, mode: 'tasks', remaining: tasks.length - done }
  }
  if (Number.isFinite(project.manualPercent)) {
    const pct = Math.max(0, Math.min(100, Math.round(project.manualPercent)))
    return { pct, done: 0, total: 0, mode: 'manual', remaining: 0 }
  }
  if (Number.isFinite(project.legacyPercent)) {
    const pct = Math.max(0, Math.min(100, Math.round(project.legacyPercent)))
    return { pct, done: 0, total: 0, mode: 'legacy', remaining: 0 }
  }
  return { pct: 0, done: 0, total: 0, mode: 'none', remaining: 0 }
}

/** Backwards-compatible scalar (used by older screens/tests). */
export const projectPercent = (project) => projectProgress(project).pct

/**
 * Assignment progress. Subtasks win when the user asked for it
 * (progressMode 'subtasks'), otherwise the explicit 0–100 value is used.
 */
export function assignmentProgress(assignment) {
  if (!assignment) return { pct: 0, done: 0, total: 0, mode: 'none', remaining: 0 }
  const subs = assignment.subtasks || []
  if (assignment.progressMode === 'subtasks' && subs.length) {
    const done = subs.filter((s) => s.done).length
    return { pct: pctFrom(done, subs.length), done, total: subs.length, mode: 'subtasks', remaining: subs.length - done }
  }
  const pct = Math.max(0, Math.min(100, Math.round(Number(assignment.progress) || 0)))
  return { pct, done: subs.filter((s) => s.done).length, total: subs.length, mode: 'explicit', remaining: subs.length - subs.filter((s) => s.done).length }
}

/* ------------------------------------------------------------
   DEADLINE + STATUS ENGINE
   ------------------------------------------------------------ */

const clampPct = (v) => Math.max(0, Math.min(100, Math.round(v)))

/** Shared shape for both entities. `behind` = pace gap in percentage points. */
function deadlineFacts(item, pct, now) {
  const deadline = item.deadline || null
  const start = item.startDate || item.assignedDate || item.createdAtDay || null
  const ms = deadline ? msUntil(deadline, now) : null
  const days = deadline ? daysUntil(deadline, now) : null
  const hours = deadline ? hoursUntil(deadline, now) : null
  const elapsed = deadline && start ? elapsedFraction(start, deadline, now) : null
  const elapsedPct = elapsed == null ? null : clampPct(elapsed * 100)
  const behind = elapsedPct == null ? null : elapsedPct - pct // >0 → behind the pace line
  const durationDays = deadline && start
    ? Math.max(1, Math.round((toLocalDate(deadline, { endOfDay: true }) - toLocalDate(start, { endOfDay: true })) / 86400000))
    : null
  return {
    hasDeadline: !!deadline,
    deadline,
    start,
    msLeft: ms,
    daysLeft: days,
    hoursLeft: hours,
    elapsedPct,
    behind,
    durationDays,
    passed: ms != null && ms < 0,
    countdown: deadline ? countdownLabel(deadline, now) : null,
    dueText: deadline ? dueLabel(deadline, { completed: pct >= 100 }, now) : 'No deadline',
  }
}

/**
 * PROJECT status — §58
 *   completed  100% (or explicitly marked complete)
 *   overdue    deadline passed and not complete
 *   atRisk     behind the pace line by >15 points, or ≤1 day left under 90%
 *   onTrack    everything else
 *   noDeadline no date set → progress only
 */
export function projectStatus(project, now = new Date()) {
  const { pct } = projectProgress(project)
  const facts = deadlineFacts(project, pct, now)
  const complete = pct >= 100 || !!project.completedAt
  let id
  if (complete) id = 'completed'
  else if (!facts.hasDeadline) id = 'noDeadline'
  else if (facts.passed) id = 'overdue'
  else if ((facts.behind != null && facts.behind > 15) || (facts.daysLeft != null && facts.daysLeft <= 1 && pct < 90)) id = 'atRisk'
  else id = 'onTrack'
  return {
    id,
    label: STATUS_LABEL[id],
    tone: STATUS_TONE[id],
    pct,
    complete,
    ...facts,
  }
}

/**
 * ASSIGNMENT status — §68 (adds URGENT: under 24h and not done)
 */
export function assignmentStatus(assignment, now = new Date()) {
  const { pct } = assignmentProgress(assignment)
  const facts = deadlineFacts(assignment, pct, now)
  const complete = pct >= 100 || !!assignment.completedAt
  let id
  if (complete) id = 'completed'
  else if (!facts.hasDeadline) id = 'noDeadline'
  else if (facts.passed) id = 'overdue'
  else if (facts.hoursLeft != null && facts.hoursLeft <= 24) id = 'urgent'
  else if ((facts.behind != null && facts.behind > 15) || (facts.daysLeft != null && facts.daysLeft <= 1)) id = 'atRisk'
  else id = 'onTrack'
  return { id, label: STATUS_LABEL[id], tone: STATUS_TONE[id], pct, complete, ...facts }
}

/* ------------------------------------------------------------
   V3 · PHASE + PRESSURE — the two visual languages of work.
   ------------------------------------------------------------ */

/** The four life states of a project (spec §10). */
export const PROJECT_PHASES = [
  { id: 'planned', label: 'Planned' },
  { id: 'active', label: 'Active' },
  { id: 'at-risk', label: 'At risk' },
  { id: 'completed', label: 'Completed' },
]

/**
 * PLANNED   starts in the future
 * ACTIVE    in flight and healthy
 * AT RISK   behind pace, overdue, or urgent
 * COMPLETED done
 */
export function projectPhase(project, now = new Date()) {
  const st = projectStatus(project, now)
  if (st.complete) return 'completed'
  if (st.id === 'atRisk' || st.id === 'overdue') return 'at-risk'
  const start = project?.startDate || project?.createdAtDay
  if (isValidDayStr(start) && dayStr(now) < start) return 'planned'
  return 'active'
}

export const phaseTone = (phase) => (phase === 'completed' ? 'good'
  : phase === 'at-risk' ? 'warn'
    : phase === 'planned' ? 'neutral'
      : 'info')

/**
 * Expected vs actual progress for a project over a trailing window.
 * actual  — the real progress log carried forward day by day
 * expected — the straight line from start to deadline (null when the
 *            project has no honest window)
 */
export function projectPace(project, { days = 30, now = new Date() } = {}) {
  const today = dayStr(now)
  const from = subDaysStr(today, days - 1)
  const actual = progressSeries(project, from, today)
    .map((r) => ({ day: r.date, pct: r.future ? null : r.pct }))

  const start = project?.startDate || project?.createdAtDay
  const end = project?.deadline ? dayOf(project.deadline) : null
  let expected = null
  if (isValidDayStr(start) && end && end > start) {
    const t0 = new Date(`${start}T00:00:00`).getTime()
    const t1 = new Date(`${end}T23:59:59`).getTime()
    expected = actual.map((r) => {
      if (r.day < start) return { day: r.day, pct: 0 }
      const t = new Date(`${r.day}T12:00:00`).getTime()
      return { day: r.day, pct: clampPct(((t - t0) / (t1 - t0)) * 100) }
    })
  }
  return { actual, expected }
}

/**
 * Deadline pressure for an assignment (spec §11): how much of its
 * window is still left, as ten honest segments.
 *   10 days of a 10-day window  → ██████████
 *   half the window gone        → █████░░░░░
 *   due tomorrow                → █░░░░░░░░░
 * ratio null = no deadline to measure; 0 = the window has closed.
 */
export function assignmentPressure(assignment, now = new Date()) {
  const st = assignmentStatus(assignment, now)
  if (st.complete) {
    return { tone: 'good', ratio: 1, segments: 10, label: 'Completed', detail: 'Done before the pressure mattered.' }
  }
  if (!st.hasDeadline) {
    return { tone: 'neutral', ratio: null, segments: null, label: 'No deadline', detail: 'Set a deadline to see the pressure build.' }
  }
  const ratio = st.passed ? 0 : Math.max(0, Math.min(1, 1 - (st.elapsedPct ?? 100) / 100))
  const segments = Math.round(ratio * 10)
  return {
    tone: st.tone,
    ratio,
    segments,
    label: st.dueText,
    detail: st.passed
      ? `Window closed ${st.countdown || ''} — ${100 - st.pct}% still open.`
      : `${st.countdown || st.dueText} left · ${100 - st.pct}% of the work still open.`,
  }
}

/** Urgency 0..1 for sorting (1 = most urgent). Deadline first, then progress. */
/**
 * DEADLINE LANES — the next N days as one strip of lanes.
 * Each open project/assignment with a deadline gets a lane from its
 * start (clamped to the window) to its deadline; the inner fill is
 * real progress. Items whose deadline already passed the window, or
 * that have no deadline, are not drawn — the strip never guesses.
 */
export function deadlineLanes(state, { from = todayStr(), days = 14, now = new Date() } = {}) {
  const to = addDaysStr(from, days - 1)
  const lanes = []
  const add = (kind, item, status) => {
    const end = item.deadline ? dayOf(item.deadline) : item.due ? dayOf(item.due) : null
    if (!end) return
    const rawStart = item.startDate || item.createdAtDay || null
    const start = rawStart && rawStart > from ? rawStart : from
    if (end < from || start > to) return
    const phase = kind === 'project' ? projectPhase(item, now) : null
    lanes.push({
      id: `${kind}-${item.id}`,
      kind,
      name: item.name,
      href: kind === 'project' ? `#/projects/${item.id}` : `#/assignments/${item.id}`,
      start,
      end: end > to ? to : end,
      clipped: end > to,
      progress: status?.pct ?? 0,
      tone: kind === 'project'
        ? phaseTone(phase)
        : status?.passed ? 'warn' : 'info',
      passed: !!status?.passed,
    })
  }
  for (const r of projectsSummary(state, now).open) add('project', r.project, r.status)
  for (const r of assignmentsSummary(state, now).open) add('assignment', r.assignment, r.status)
  lanes.sort((a, b) => (a.end === b.end ? a.start.localeCompare(b.start) : a.end.localeCompare(b.end)))
  return { lanes, from, to, days, today: todayStr(now) }
}

export function urgencyOf(status) {
  if (status.id === 'completed') return -1
  if (!status.hasDeadline) return 0.05
  if (status.passed) return 2 - Math.min(1, (100 - status.pct) / 100) // most overdue+least done first
  const hours = status.hoursLeft ?? 24 * 365
  const timeScore = 1 / (1 + hours / 24) // <24h dominates
  return timeScore * 0.75 + (1 - status.pct / 100) * 0.25
}

/* ------------------------------------------------------------
   MILESTONES — evenly-anchored progression (§59)
   ------------------------------------------------------------ */

/**
 * Milestones get an even share of the 0→100 track: with 5 milestones the
 * anchors are 20/40/60/80/100. `reached` uses real task completion.
 */
export function milestoneTrack(project) {
  const milestones = project?.milestones || []
  const n = milestones.length
  const { pct } = projectProgress(project)
  return milestones.map((m, i) => {
    const tasks = m.tasks || []
    const done = tasks.filter((t) => t.done).length
    const anchor = n ? Math.round(((i + 1) / n) * 100) : 100
    const own = pctFrom(done, tasks.length)
    return {
      ...m,
      index: i,
      anchor,
      done,
      total: tasks.length,
      own,
      reached: tasks.length ? done === tasks.length : pct >= anchor,
      partial: tasks.length ? done > 0 && done < tasks.length : pct > 0 && pct < anchor,
    }
  })
}

/* ------------------------------------------------------------
   SERIES — real timestamps only
   ------------------------------------------------------------ */

/** Last logged percent at or before `day` (null when nothing logged yet). */
function pctOnDay(log, day) {
  let value = null
  for (const e of log || []) {
    const d = dayOf(e.at || e.date)
    if (d && d <= day) value = e.pct
    else if (d && d > day) break
  }
  return value
}

const sortedLog = (item) =>
  [...(item?.progressLog || [])]
    .filter((e) => Number.isFinite(e?.pct))
    .map((e) => ({ at: e.at || e.date, pct: clampPct(e.pct) }))
    .sort((a, b) => String(a.at).localeCompare(String(b.at)))

/** Daily progress series (oldest → newest) for a line chart. */
export function progressSeries(item, from, to) {
  const log = sortedLog(item)
  const rows = []
  let cursor = from
  let guard = 0
  while (cursor <= to && guard++ < 800) {
    const pct = pctOnDay(log, cursor)
    rows.push({ date: cursor, pct, future: cursor > todayStr() })
    cursor = addDaysStr(cursor, 1)
  }
  return rows
}

/** Tasks (or subtasks) completed per day over the trailing window. */
export function velocitySeries(items, days, now = new Date()) {
  const today = dayStr(now)
  const from = subDaysStr(today, days - 1)
  const buckets = new Map()
  let cursor = from
  while (cursor <= today) { buckets.set(cursor, 0); cursor = addDaysStr(cursor, 1) }
  for (const it of items) {
    for (const t of it?.tasks || it?.subtasks || []) {
      const d = t.completedAt ? dayOf(t.completedAt) : null
      if (d && buckets.has(d)) buckets.set(d, buckets.get(d) + 1)
    }
  }
  return [...buckets.entries()].map(([date, count]) => ({ date, count }))
}

/** Total completions per day from an entity's own tasks. */
export function entityVelocity(entity, days, now = new Date()) {
  const tasks = entity?.milestones ? allTasks(entity) : entity?.subtasks || []
  return velocitySeries([{ tasks }], days, now)
}

/**
 * Deadline burndown (§60E): ideal remaining vs actual remaining.
 * Ideal is the straight line from 100% at `start` to 0% at `deadline`.
 * Actual comes from the real progress log (carried forward day to day).
 */
export function burndown(project, now = new Date()) {
  const start = project.startDate || project.createdAtDay
  const deadline = project.deadline
  if (!isValidDayStr(start) || !deadline) return null
  const endDay = dayOf(deadline)
  if (!endDay || endDay < start) return null
  const log = sortedLog(project)
  const totalDays = Math.max(1, Math.round((toLocalDate(endDay, { endOfDay: true }) - toLocalDate(start, { endOfDay: true })) / 86400000))
  const rows = []
  let cursor = start
  let guard = 0
  let idx = 0
  while (cursor <= endDay && guard++ < 400) {
    const step = Math.round((toLocalDate(cursor, { endOfDay: true }) - toLocalDate(start, { endOfDay: true })) / 86400000)
    const ideal = clampPct(100 - (step / totalDays) * 100)
    // actual: last real log entry up to this day, carried forward
    while (idx < log.length && dayOf(log[idx].at) <= cursor) idx++
    // Nothing logged yet means nothing done yet → 100% remaining (never 0).
    const lastPct = idx > 0 ? log[idx - 1].pct : null
    const future = cursor > dayStr(now)
    rows.push({
      date: cursor,
      ideal,
      actual: future ? null : lastPct == null ? 100 : clampPct(100 - lastPct),
      future,
    })
    cursor = addDaysStr(cursor, 1)
  }
  const todayRow = rows.find((r) => r.date === dayStr(now)) || rows.filter((r) => !r.future).pop() || null
  return {
    rows,
    start,
    end: endDay,
    totalDays,
    todayGap: todayRow && todayRow.actual != null ? todayRow.ideal - todayRow.actual : null, // >0 → ahead
  }
}

/** % time elapsed vs % work done — the "behind schedule" flag (§69F). */
export function timeVsWork(item, kind = 'project', now = new Date()) {
  const st = kind === 'project' ? projectStatus(item, now) : assignmentStatus(item, now)
  if (st.elapsedPct == null) return null
  return {
    elapsedPct: st.elapsedPct,
    workPct: st.pct,
    gapPct: st.elapsedPct - st.pct,
    behind: st.elapsedPct - st.pct > 15,
    ahead: st.pct - st.elapsedPct > 15,
    daysLeft: st.daysLeft,
    remainingWork: 100 - st.pct,
  }
}

/** Completion history for a finished item (§69G). */
export function itemHistory(item, kind = 'project', now = new Date()) {
  const progress = kind === 'project' ? projectProgress(item) : assignmentProgress(item)
  const start = item.startDate || item.assignedDate || item.createdAtDay || null
  const completedAt = item.completedAt || null
  if (!completedAt) return null
  const started = start ? toLocalDate(start, { endOfDay: true }) : null
  const finished = toLocalDate(completedAt)
  const actualMin = Number(item.actualMin) || 0
  const estimateMin = Number(item.estimateMin) || 0
  return {
    start: start ? dayOf(start) : null,
    completedDay: dayOf(completedAt),
    completedAt,
    durationDays: started && finished ? Math.max(0, Math.round((finished - started) / 86400000)) : null,
    estimated: estimateMin ? minutesLabel(estimateMin) : null,
    actual: actualMin ? minutesLabel(actualMin) : null,
    varianceMin: estimateMin && actualMin ? actualMin - estimateMin : null,
    finalPct: progress.pct,
    tasksDone: progress.done,
    tasksTotal: progress.total,
    early: item.deadline ? msUntil(item.deadline, finished) > 0 : null,
  }
}

/* ------------------------------------------------------------
   DASHBOARDS
   ------------------------------------------------------------ */

const activeProjects = (state) => (state.projects || []).filter((p) => !p.archived)
const activeAssignments = (state) => (state.assignments || []).filter((a) => !a.archived)

export const isCompleteProject = (p, now) => projectStatus(p, now).complete
export const isCompleteAssignment = (a, now) => assignmentStatus(a, now).complete

/** Projects dashboard roll-up (§61). */
export function projectsSummary(state, now = new Date()) {
  const all = activeProjects(state)
  const today = dayStr(now)
  const weekEnd = addDaysStr(today, 6)
  let completed = 0, atRisk = 0, overdue = 0, dueThisWeek = 0, dueToday = 0, noDeadline = 0
  const rows = all.map((p) => {
    const st = projectStatus(p, now)
    if (st.id === 'completed') completed++
    else if (st.id === 'overdue') overdue++
    else if (st.id === 'atRisk') atRisk++
    else if (st.id === 'noDeadline') noDeadline++
    if (!st.complete && st.deadline) {
      const d = dayOf(st.deadline)
      if (d === today) dueToday++
      if (d >= today && d <= weekEnd) dueThisWeek++
    }
    return { project: p, status: st }
  })
  return {
    total: all.length,
    active: all.length - completed,
    completed,
    atRisk,
    overdue,
    dueToday,
    dueThisWeek,
    noDeadline,
    rows,
    open: rows.filter((r) => !r.status.complete),
    done: rows.filter((r) => r.status.complete),
  }
}

/** Assignments dashboard roll-up (§70). */
export function assignmentsSummary(state, now = new Date()) {
  const all = activeAssignments(state)
  const today = dayStr(now)
  const weekEnd = addDaysStr(today, 6)
  let dueToday = 0, dueThisWeek = 0, dueSoon = 0, overdue = 0, completed = 0, urgent = 0
  const rows = all.map((a) => {
    const st = assignmentStatus(a, now)
    if (st.id === 'completed') completed++
    else if (st.id === 'overdue') overdue++
    else if (st.id === 'urgent') urgent++
    if (!st.complete && st.deadline) {
      const d = dayOf(st.deadline)
      if (d === today) dueToday++
      if (d >= today && d <= weekEnd) dueThisWeek++
      if (!st.passed && st.hoursLeft != null && st.hoursLeft <= 72) dueSoon++
    }
    return { assignment: a, status: st }
  })
  return {
    total: all.length,
    open: rows.filter((r) => !r.status.complete),
    done: rows.filter((r) => r.status.complete),
    dueToday,
    dueThisWeek,
    dueSoon,
    overdue,
    urgent,
    completed,
    rows,
  }
}

/** Sorting used across dashboards: urgency, then priority, then name. */
export function sortWorkRows(rows, key = 'urgency') {
  const copy = [...rows]
  const cmp = {
    urgency: (a, b) => urgencyOf(b.status) - urgencyOf(a.status),
    deadline: (a, b) => String(a.status.deadline || '9999').localeCompare(String(b.status.deadline || '9999')),
    progress: (a, b) => b.status.pct - a.status.pct,
    priority: (a, b) => priorityRank(a.item?.priority) - priorityRank(b.item?.priority) || urgencyOf(b.status) - urgencyOf(a.status),
    name: (a, b) => String(a.item?.name || '').localeCompare(String(b.item?.name || '')),
    recent: (a, b) => String(b.item?.updatedAt || '').localeCompare(String(a.item?.updatedAt || '')),
  }[key] || ((a, b) => urgencyOf(b.status) - urgencyOf(a.status))
  return copy.sort((a, b) => cmp({ item: a.project || a.assignment, status: a.status }, { item: b.project || b.assignment, status: b.status }))
}

/**
 * PRIORITY WORK for the Today screen (§82) — a contextual layer only.
 * Overdue first, then the next 3 most urgent open items.
 */
export function priorityWork(state, now = new Date(), limit = 3) {
  const items = [
    ...assignmentsSummary(state, now).open.map((r) => ({ kind: 'assignment', item: r.assignment, status: r.status })),
    ...projectsSummary(state, now).open.map((r) => ({ kind: 'project', item: r.project, status: r.status })),
  ].filter((x) => x.status.hasDeadline)
  items.sort((a, b) => urgencyOf(b.status) - urgencyOf(a.status))
  const overdue = items.filter((i) => i.status.passed)
  const dueToday = items.filter((i) => !i.status.passed && i.status.daysLeft === 0)
  const rest = items.filter((i) => !i.status.passed && i.status.daysLeft !== 0)
  return { overdue, dueToday, upcoming: rest.slice(0, Math.max(0, limit - overdue.length - dueToday.length)), all: items.slice(0, limit) }
}

/* ------------------------------------------------------------
   WORKLOAD (§73) — what is landing on each day
   ------------------------------------------------------------ */

/**
 * Per-day workload for `days` starting at `from`.
 * Counts assignment deadlines, project deadlines, milestone dues and task dues,
 * and sums real estimated minutes when the user provided them.
 */
export function workloadSeries(state, { from = todayStr(), days = 14, now = new Date() } = {}) {
  const projects = activeProjects(state)
  const assignments = activeAssignments(state)
  const rows = []
  for (let i = 0; i < days; i++) {
    const date = addDaysStr(from, i)
    const entry = {
      date,
      label: relativeDayLabel(date, now),
      weekday: toLocalDate(date, { endOfDay: true }).getDay(),
      assignments: [],
      projects: [],
      tasks: [],
      milestones: [],
      minutes: 0,
      count: 0,
      past: date < dayStr(now),
    }
    for (const a of assignments) {
      const st = assignmentStatus(a, now)
      if (st.complete) continue
      if (dayOf(a.deadline) === date) {
        entry.assignments.push({ item: a, status: st })
        entry.minutes += Number(a.estimateMin) || 0
      }
    }
    for (const p of projects) {
      const st = projectStatus(p, now)
      if (st.complete) continue
      if (p.deadline && dayOf(p.deadline) === date) {
        entry.projects.push({ item: p, status: st })
        entry.minutes += Number(p.estimateMin) || 0
      }
      for (const m of p.milestones || []) {
        if (m.due && dayOf(m.due) === date && !(m.tasks || []).length) entry.milestones.push({ item: p, milestone: m })
        for (const t of m.tasks || []) {
          if (t.due && dayOf(t.due) === date && !t.done) {
            entry.tasks.push({ item: p, milestone: m, task: t })
            entry.minutes += Number(t.estimateMin) || 0
          }
        }
      }
    }
    entry.count = entry.assignments.length + entry.projects.length + entry.tasks.length + entry.milestones.length
    rows.push(entry)
  }
  const peak = rows.reduce((m, r) => Math.max(m, r.count), 0)
  return { rows, peak, total: rows.reduce((n, r) => n + r.count, 0), minutes: rows.reduce((n, r) => n + r.minutes, 0) }
}

/** Workload roll-up for the dashboard header. */
export function workloadSummary(state, now = new Date()) {
  const today = dayStr(now)
  const weekEnd = addDaysStr(today, 6)
  const series = workloadSeries(state, { from: today, days: 7, now })
  const p = projectsSummary(state, now)
  const a = assignmentsSummary(state, now)
  const openTasks = p.rows.flatMap((r) => allTasks(r.project).filter((t) => !t.done))
  const estRemaining = openTasks.reduce((n, t) => n + (Number(t.estimateMin) || 0), 0)
    + a.open.reduce((n, r) => n + (Number(r.assignment.estimateMin) || 0) * (1 - r.status.pct / 100), 0)
  return {
    dueToday: series.rows[0]?.count || 0,
    dueThisWeek: series.total,
    activeProjects: p.active,
    activeAssignments: a.open.length,
    overdue: p.overdue + a.overdue,
    openTasks: openTasks.length,
    estimatedMinutes: Math.round(estRemaining),
    estimatedLabel: minutesLabel(Math.round(estRemaining)),
    peakDay: series.rows.reduce((best, r) => (r.count > (best?.count || 0) ? r : best), null),
    series,
  }
}

/* ------------------------------------------------------------
   DEADLINE TIMELINE (§72)
   ------------------------------------------------------------ */

export const TIMELINE_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'projects', label: 'Projects' },
  { id: 'assignments', label: 'Assignments' },
  { id: 'overdue', label: 'Overdue' },
  { id: 'soon', label: 'Due soon' },
  { id: 'completed', label: 'Completed' },
]

/** Chronological, day-grouped list of every deadline across both systems. */
export function deadlineTimeline(state, { filter = 'all', now = new Date(), limitDays = 90 } = {}) {
  const today = dayStr(now)
  const entries = []
  if (filter !== 'assignments') {
    for (const p of activeProjects(state)) {
      const st = projectStatus(p, now)
      if (!p.deadline) continue
      entries.push({ kind: 'project', item: p, status: st, day: dayOf(p.deadline) })
    }
  }
  if (filter !== 'projects') {
    for (const a of activeAssignments(state)) {
      const st = assignmentStatus(a, now)
      if (!a.deadline) continue
      entries.push({ kind: 'assignment', item: a, status: st, day: dayOf(a.deadline) })
    }
  }
  const filtered = entries.filter((e) => {
    if (filter === 'overdue') return e.status.passed && !e.status.complete
    if (filter === 'soon') return !e.status.complete && !e.status.passed && e.status.hoursLeft != null && e.status.hoursLeft <= 72
    if (filter === 'completed') return e.status.complete
    if (filter === 'all') return true
    return true
  })
  filtered.sort((a, b) => String(a.day).localeCompare(String(b.day)) || urgencyOf(b.status) - urgencyOf(a.status))
  const groups = []
  for (const e of filtered) {
    const last = groups[groups.length - 1]
    if (last && last.day === e.day) last.entries.push(e)
    else groups.push({ day: e.day, label: relativeDayLabel(e.day, now), past: e.day < today, entries: [e] })
  }
  return { groups, count: filtered.length, limitDays }
}

/* ------------------------------------------------------------
   CALENDAR MARKERS (§71)
   ------------------------------------------------------------ */

/** Everything landing on a given day: project starts/deadlines, assignment deadlines, tasks, milestones. */
export function calendarMarkers(state, days) {
  const set = new Set(days)
  const map = new Map(days.map((d) => [d, []]))
  const push = (day, marker) => { if (set.has(day) && map.get(day)) map.get(day).push(marker) }
  for (const p of activeProjects(state)) {
    const st = projectStatus(p)
    if (p.startDate && isValidDayStr(p.startDate)) push(p.startDate, { kind: 'project-start', item: p, status: st })
    if (p.deadline) push(dayOf(p.deadline), { kind: 'project-deadline', item: p, status: st })
    for (const m of p.milestones || []) {
      if (m.due) push(dayOf(m.due), { kind: 'milestone', item: p, milestone: m, status: st })
      for (const t of m.tasks || []) if (t.due) push(dayOf(t.due), { kind: 'task', item: p, task: t, milestone: m, status: st })
    }
  }
  for (const a of activeAssignments(state)) {
    const st = assignmentStatus(a)
    if (a.assignedDate) push(dayOf(a.assignedDate), { kind: 'assignment-start', item: a, status: st })
    if (a.deadline) push(dayOf(a.deadline), { kind: 'assignment-deadline', item: a, status: st })
  }
  return map
}

/* ------------------------------------------------------------
   ANALYTICS (project-side) — §60
   ------------------------------------------------------------ */

/** Aggregate completion trend across every open project (mean pct per day). */
export function projectCompletionTrend(state, days = 30, now = new Date()) {
  const projects = activeProjects(state).filter((p) => (p.progressLog || []).length)
  if (!projects.length) return { rows: [], enough: false }
  const today = dayStr(now)
  const from = subDaysStr(today, days - 1)
  const rows = []
  let cursor = from
  while (cursor <= today) {
    const values = projects.map((p) => pctOnDay(sortedLog(p), cursor)).filter((v) => v != null)
    rows.push({ date: cursor, pct: values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null, count: values.length })
    cursor = addDaysStr(cursor, 1)
  }
  return { rows, enough: rows.some((r) => r.pct != null) }
}

/** Assignment progress trend (mean pct/day across open assignments with logs). */
export function assignmentCompletionTrend(state, days = 30, now = new Date()) {
  const items = activeAssignments(state).filter((a) => (a.progressLog || []).length)
  if (!items.length) return { rows: [], enough: false }
  const today = dayStr(now)
  const from = subDaysStr(today, days - 1)
  const rows = []
  let cursor = from
  while (cursor <= today) {
    const values = items.map((a) => pctOnDay(sortedLog(a), cursor)).filter((v) => v != null)
    rows.push({ date: cursor, pct: values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null, count: values.length })
    cursor = addDaysStr(cursor, 1)
  }
  return { rows, enough: rows.some((r) => r.pct != null) }
}

/** Completions per week (tasks + subtasks) for the "completion speed" chart. */
export function weeklyCompletionSpeed(state, weeks = 8, now = new Date()) {
  const today = dayStr(now)
  const out = []
  for (let w = weeks - 1; w >= 0; w--) {
    const anchor = subDaysStr(today, w * 7)
    const days = weekDays(anchor)
    const items = [
      ...activeProjects(state).flatMap((p) => allTasks(p)),
      ...activeAssignments(state).flatMap((a) => a.subtasks || []),
    ]
    const count = items.filter((t) => t.completedAt && days.includes(dayOf(t.completedAt))).length
    out.push({ label: w === 0 ? 'This wk' : w === 1 ? 'Last wk' : `${shortLabel(days[0])}`, count, start: days[0] })
  }
  return out
}

const shortLabel = (d) => (isValidDayStr(d) ? d.slice(5).replace('-', '/') : '')

/** Side-by-side project comparison (§60G). */
export function projectComparison(state, now = new Date()) {
  const rows = activeProjects(state).map((p) => {
    const st = projectStatus(p, now)
    const log = sortedLog(p)
    const first = log[0]
    const last = log[log.length - 1]
    const daysSpan = first && last ? Math.max(1, minutesBetween(first.at, last.at) / 1440) : null
    return {
      project: p,
      status: st,
      pct: st.pct,
      daysLeft: st.daysLeft,
      overdue: st.passed && !st.complete,
      speed: daysSpan && last ? Math.round((last.pct - (first?.pct ?? 0)) / daysSpan * 10) / 10 : null, // pct points / day
      tasks: projectProgress(p).total,
    }
  })
  rows.sort((a, b) => b.pct - a.pct)
  return { rows, enough: rows.length >= 2 }
}

/** Time distribution across task categories (§60F) — only real estimates. */
export function timeDistribution(state) {
  const buckets = new Map()
  for (const p of activeProjects(state)) {
    for (const t of allTasks(p)) {
      const mins = Number(t.estimateMin) || Number(t.actualMin) || 0
      if (!mins) continue
      const key = t.category || p.category || 'General'
      buckets.set(key, (buckets.get(key) || 0) + mins)
    }
  }
  const rows = [...buckets.entries()].map(([label, minutes]) => ({ label, minutes, text: minutesLabel(minutes) }))
  rows.sort((a, b) => b.minutes - a.minutes)
  const total = rows.reduce((n, r) => n + r.minutes, 0)
  return { rows, total, enough: rows.length > 0 && total > 0 }
}

/* ------------------------------------------------------------
   FILTERS + SEARCH (§78)
   ------------------------------------------------------------ */

export const WORK_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'open', label: 'Open' },
  { id: 'today', label: 'Due today' },
  { id: 'week', label: 'This week' },
  { id: 'overdue', label: 'Overdue' },
  { id: 'risk', label: 'At risk' },
  { id: 'done', label: 'Completed' },
]

export function matchesWorkFilter(status, filter, now = new Date()) {
  const today = dayStr(now)
  const day = status.deadline ? dayOf(status.deadline) : null
  switch (filter) {
    case 'open': return !status.complete
    case 'done': return status.complete
    case 'today': return !status.complete && day === today
    case 'week': return !status.complete && !!day && day >= today && day <= addDaysStr(today, 6)
    case 'overdue': return status.passed && !status.complete
    case 'risk': return status.id === 'atRisk' || status.id === 'urgent'
    default: return true
  }
}

/** Case-insensitive search across name/description/subject/notes/tasks. */
export function matchesQuery(item, q) {
  const query = String(q || '').trim().toLowerCase()
  if (!query) return true
  const hay = [
    item?.name, item?.description, item?.subject, item?.notes, item?.category,
    ...(item?.milestones || []).flatMap((m) => [m.name, ...(m.tasks || []).map((t) => t.name)]),
    ...(item?.subtasks || []).map((s) => s.name),
  ].filter(Boolean).join(' ').toLowerCase()
  return query.split(/\s+/).every((token) => hay.includes(token))
}

/* ------------------------------------------------------------
   SMALL PRESENTATION HELPERS
   ------------------------------------------------------------ */

/** 10-point progress steps for the quick controls (§66). */
export const PROGRESS_STEPS = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]

export const WORK_CATEGORIES = ['General', 'Study', 'Work', 'Design', 'Development', 'Research', 'Testing', 'Personal']

/** Deadline presets → concrete local deadline strings. */
export function deadlineFromPreset(presetId, now = new Date()) {
  const hours = { '2h': 2, '6h': 6, '12h': 12, '1d': 24, '2d': 48, '3d': 72, '5d': 120, '7d': 168, '14d': 336, '30d': 720, '60d': 1440 }[presetId]
  if (hours == null) return null
  return isoLocal(new Date(now.getTime() + hours * 3600000))
}

export { isoLocal }
