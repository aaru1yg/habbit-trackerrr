/* Adaptive Intelligence: deterministic, explainable selectors.
 * This module is deliberately pure. It never mutates state or invents data;
 * callers can memoize these functions and use them offline or after sync.
 */
import { assignmentProgress, projectProgress, allTasks, workloadSeries, projectStatus } from './work.js'
import { goalProgress, goalPace } from './goals.js'

const clamp = (n, a = 0, b = 1) => Math.max(a, Math.min(b, Number.isFinite(n) ? n : 0))
const dayMs = 86400000
const dateValue = (v) => v ? new Date(v).getTime() : null
const daysUntil = (deadline, now) => deadline ? (dateValue(deadline) - dateValue(now)) / dayMs : null

export function deadlineRisk({ deadline, progress = 0, remainingMin = null, capacityMin = null, startDate = null, now = new Date() } = {}) {
  if (!deadline) return { id: 'SAFE', enough: false, reason: 'No deadline set.' }
  const leftDays = daysUntil(deadline, now)
  if (leftDays < 0) return { id: 'OVERDUE', enough: true, daysLeft: leftDays, reason: 'The deadline has passed.' }
  const remaining = Number.isFinite(remainingMin) ? remainingMin : null
  const capacity = Number.isFinite(capacityMin) ? capacityMin : null
  const required = leftDays > 0 && remaining != null ? remaining / leftDays : null
  if (remaining != null && capacity != null && remaining > capacity) {
    return { id: 'AT RISK', enough: true, daysLeft: leftDays, requiredMinPerDay: required, reason: `About ${Math.round(remaining - capacity)} minutes more work than available capacity.` }
  }
  if (leftDays <= 1 && progress < 90) return { id: 'CRITICAL', enough: true, daysLeft: leftDays, requiredMinPerDay: required, reason: 'Due within a day and not yet near completion.' }
  if (startDate && leftDays > 0) {
    const elapsed = clamp((dateValue(now) - dateValue(startDate)) / (dateValue(deadline) - dateValue(startDate)))
    if (progress / 100 + 0.15 < elapsed) return { id: 'AT RISK', enough: true, daysLeft: leftDays, requiredMinPerDay: required, reason: 'Progress is behind the required pace.' }
  }
  return { id: 'ON TRACK', enough: true, daysLeft: leftDays, requiredMinPerDay: required, reason: 'Current progress fits the available time.' }
}

export function scorePriority(item, { now = new Date(), _project = null, goal = null, capacityMin = null } = {}) {
  const progress = item.kind === 'assignment' ? assignmentProgress(item).pct : item.kind === 'project' ? projectProgress(item).pct : (item.progress || 0)
  const remainingMin = Number.isFinite(item.estimateMin) ? Math.max(0, item.estimateMin * (1 - progress / 100)) : null
  const left = daysUntil(item.deadline, now)
  const deadlineScore = left == null ? 0 : left < 0 ? 1 : clamp(1 - left / 14)
  const priorityScore = { high: 1, normal: .55, low: .2 }[item.priority] ?? .55
  const progressScore = clamp((100 - progress) / 100)
  const overdueScore = left != null && left < 0 ? 1 : 0
  const risk = deadlineRisk({ ...item, progress, remainingMin, capacityMin, now })
  const riskScore = ['OVERDUE', 'CRITICAL'].includes(risk.id) ? 1 : risk.id === 'AT RISK' ? .75 : 0
  const goalImportance = goal?.importance === 'high' || goal?.priority === 'high' ? 1 : goal ? .5 : 0
  const effortFit = remainingMin == null || capacityMin == null ? .5 : clamp(1 - Math.max(0, remainingMin - capacityMin) / Math.max(1, remainingMin))
  const total = deadlineScore * .28 + priorityScore * .18 + progressScore * .12 + riskScore * .2 + goalImportance * .1 + effortFit * .07 + overdueScore * .05
  const reasons = []
  if (overdueScore) reasons.push('overdue')
  else if (left != null && left <= 1) reasons.push('due within a day')
  if (risk.id === 'AT RISK' || risk.id === 'CRITICAL') reasons.push('behind the required pace')
  if (item.priority === 'high') reasons.push('high priority')
  if (remainingMin != null) reasons.push(`${Math.round(remainingMin)} min estimated remaining`)
  return { score: Math.round(total * 1000) / 1000, progress, remainingMin, risk, signals: { deadlineScore, priorityScore, progressScore, riskScore, goalImportance, effortFit, overdueScore }, reasons }
}

export function getTodayPriorities(state, { now = new Date(), limit = 5, capacityMin = null } = {}) {
  const today = now.toISOString().slice(0, 10)
  const candidates = []
  for (const a of state.assignments || []) if (!a.archived && !a.completedAt && assignmentProgress(a).pct < 100) candidates.push({ ...a, kind: 'assignment', label: a.name })
  for (const p of state.projects || []) {
    if (p.archived || p.completedAt || projectProgress(p).pct >= 100) continue
    candidates.push({ ...p, kind: 'project', label: p.name })
    for (const m of p.milestones || []) for (const t of m.tasks || []) if (!t.done) candidates.push({ ...t, kind: 'project-task', label: t.name, deadline: t.due || m.due || p.deadline, priority: t.priority || p.priority, projectId: p.id, milestoneId: m.id })
  }
  for (const g of state.goals || []) for (const m of g.milestones || []) if (!m.done) candidates.push({ ...m, kind: 'goal-milestone', label: m.name, deadline: m.targetDate || g.targetDate, priority: g.priority, goalId: g.id })
  for (const h of state.habits || []) if (!h.archived && !state.checkins?.[h.id]?.[today]?.done) candidates.push({ ...h, kind: 'habit', label: h.name })
  return candidates.map((item) => ({ item, ...scorePriority(item, { now, capacityMin }) })).sort((a, b) => b.score - a.score || String(a.item.id).localeCompare(String(b.item.id))).slice(0, limit)
}

export function getNextBestAction(state, { now = new Date(), capacityMin = null } = {}) {
  const candidates = []
  for (const a of state.assignments || []) if (!a.archived && !a.completedAt && assignmentProgress(a).pct < 100) candidates.push({ ...a, kind: 'assignment', label: a.name })
  for (const p of state.projects || []) if (!p.archived && !p.completedAt && projectProgress(p).pct < 100) candidates.push({ ...p, kind: 'project', label: p.name })
  for (const h of state.habits || []) if (!h.archived && !(state.checkins?.[h.id]?.[now.toISOString().slice(0, 10)]?.done)) candidates.push({ ...h, kind: 'habit', label: h.name, estimateMin: h.estimateMin ?? null })
  if (!candidates.length) return null
  const ranked = candidates.map((item) => ({ item, ...scorePriority(item, { now, capacityMin }) })).sort((a, b) => b.score - a.score || String(a.item.id).localeCompare(String(b.item.id)))
  const best = ranked[0]
  return { item: best.item, reason: best.reasons.length ? `Consider this next because it is ${best.reasons.join(' and ')}.` : 'Consider this next based on your current open work.', urgency: best.risk.id, estimatedMin: best.remainingMin, deadline: best.item.deadline || null, signals: best.signals }
}

export function workloadCapacity({ availableMin, items = [] } = {}) {
  const committedMin = items.reduce((n, item) => n + (Number.isFinite(item.estimateMin) ? item.estimateMin : 0), 0)
  const remainingMin = Number.isFinite(availableMin) ? availableMin - committedMin : null
  return { availableMin: Number.isFinite(availableMin) ? availableMin : null, committedMin, remainingMin, overloaded: remainingMin != null && remainingMin < 0, reason: remainingMin == null ? 'Set a capacity to compare workload.' : remainingMin < 0 ? `Workload exceeds capacity by ${Math.abs(Math.round(remainingMin))} minutes.` : `${Math.round(remainingMin)} minutes remain after committed work.` }
}

export function workloadByDay(state, { from, days = 7, now = new Date(), capacityMin = null } = {}) {
  const series = workloadSeries(state, { from, days, now })
  return series.rows.map((row) => {
    const items = [...row.assignments.map((x) => ({ ...x.item, label: x.item.name, kind: 'assignment' })), ...row.projects.map((x) => ({ ...x.item, label: x.item.name, kind: 'project' })), ...row.tasks.map((x) => ({ ...x.task, label: x.task.name, kind: 'project task' })), ...row.milestones.map((x) => ({ ...x.milestone, label: x.milestone.name, kind: 'goal/project milestone' }))]
    const result = workloadCapacity({ availableMin: capacityMin, items })
    return { ...row, ...result, items }
  })
}

export function deadlinePressure(state, { now = new Date(), days = 7 } = {}) {
  const rows = Array.from({ length: days }, (_, i) => ({ label: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : `Next ${i + 1} days`, date: new Date(dateValue(now) + i * dayMs).toISOString().slice(0, 10), items: [] }))
  for (const item of [...(state.assignments || []), ...(state.projects || [])]) {
    if (item.archived || item.completedAt || !item.deadline) continue
    const d = Math.floor((dateValue(item.deadline) - dateValue(now)) / dayMs)
    if (d >= 0 && d < days) rows[d].items.push(item)
  }
  return rows
}

export function rescheduleSuggestions(day, { minimumOverloadMin = 0 } = {}) {
  if (!day?.overloaded || Math.abs(day.remainingMin) <= minimumOverloadMin) return []
  return day.items.filter((item) => item.priority !== 'high').slice(0, 3).map((item, i) => ({ item, reason: `Consider moving ${item.label || item.name} to a later day; it is not marked high priority.`, requiresConfirmation: true, suggestedOffsetDays: i + 1 }))
}

export function assignmentPace(assignment, { now = new Date() } = {}) {
  if (!assignment.deadline || !assignment.assignedDate) return { enough: false, reason: 'Not enough history to forecast.' }
  const start = dateValue(assignment.assignedDate), end = dateValue(assignment.deadline), current = dateValue(now)
  if (!(end > start)) return { enough: false, reason: 'Not enough data yet.' }
  const elapsed = clamp((current - start) / (end - start)), expected = Math.round(elapsed * 100)
  const actual = assignmentProgress(assignment).pct
  return { enough: true, elapsedPct: Math.round(elapsed * 100), expectedPct: expected, actualPct: actual, gap: actual - expected, remainingMin: Number.isFinite(assignment.estimateMin) ? Math.round(assignment.estimateMin * (1 - actual / 100)) : null, requiredPace: current < end && Number.isFinite(assignment.estimateMin) ? Math.round(assignment.estimateMin * (1 - actual / 100) / Math.max((end - current) / dayMs, 1)) : null }
}

export function goalForecast(state, goal, { now = new Date() } = {}) {
  const progress = goalProgress(state, goal, { now })
  const pace = goalPace(goal, { now })
  const points = Array.isArray(goal.progressLog) ? goal.progressLog.filter((p) => Number.isFinite(p.pct) && p.at).sort((a, b) => dateValue(a.at) - dateValue(b.at)) : []
  const velocityPerDay = points.length >= 2 ? (points[points.length - 1].pct - points[0].pct) / Math.max(1, (dateValue(points.at(-1).at) - dateValue(points[0].at)) / dayMs) : null
  const remaining = Math.max(0, 100 - progress.pct)
  const projectedCompletion = velocityPerDay > 0 && remaining > 0 ? new Date(dateValue(now) + remaining / velocityPerDay * dayMs).toISOString() : progress.pct >= 100 ? now.toISOString() : null
  const risk = !goal.targetDate ? { id: 'SAFE', reason: 'No target date set.' } : dateValue(goal.targetDate) < dateValue(now) && progress.pct < 100 ? { id: 'OVERDUE', reason: 'The target date has passed.' } : pace && progress.pct < pace.expected - 15 ? { id: 'AT RISK', reason: 'Actual progress is behind expected progress.' } : { id: 'ON TRACK', reason: 'Actual progress is within the expected pace.' }
  return { currentProgress: progress.pct, expectedProgress: pace?.expected ?? null, actualPacePerDay: velocityPerDay, requiredPacePerDay: pace ? Math.max(0, 100 - progress.pct) / Math.max(1, (dateValue(goal.targetDate) - dateValue(now)) / dayMs) : null, remainingWork: remaining, deadline: goal.targetDate || null, projectedCompletion, risk, enough: points.length >= 2 && !!pace, reason: points.length < 2 || !pace ? 'Not enough history to forecast.' : risk.reason }
}

export function goalContributors(state, goal) {
  const rows = []
  for (const id of goal.linkedHabitIds || []) { const h = state.habits?.find((x) => x.id === id); if (h) rows.push({ type: 'habit', name: h.name, progress: null }) }
  for (const id of goal.linkedProjectIds || []) { const p = state.projects?.find((x) => x.id === id); if (p) rows.push({ type: 'project', name: p.name, progress: projectProgress(p).pct }) }
  for (const id of goal.linkedAssignmentIds || []) { const a = state.assignments?.find((x) => x.id === id); if (a) rows.push({ type: 'assignment', name: a.name, progress: assignmentProgress(a).pct }) }
  const known = rows.filter((r) => r.progress != null)
  if (!known.length) return { rows, enough: false, reason: 'Not enough data yet.' }
  const total = known.reduce((n, r) => n + r.progress, 0)
  return { rows: rows.map((r) => ({ ...r, contribution: r.progress == null ? null : Math.round(r.progress / total * 100) })), enough: total > 0, reason: total > 0 ? null : 'Not enough data yet.' }
}

export function projectForecast(project, { now = new Date(), velocityMinPerDay = null } = {}) {
  const progress = projectProgress(project)
  const tasks = allTasks(project)
  const remainingMin = tasks.reduce((n, t) => n + (t.done ? 0 : (Number.isFinite(t.estimateMin) ? t.estimateMin : 0)), 0)
  const velocity = Number.isFinite(velocityMinPerDay) && velocityMinPerDay > 0 ? velocityMinPerDay : null
  const projectedCompletion = velocity && remainingMin ? new Date(dateValue(now) + remainingMin / velocity * dayMs).toISOString() : null
  const status = projectStatus(project, now)
  const expectedProgress = status.elapsedPct
  const risk = status.complete ? 'COMPLETED' : status.id === 'overdue' ? 'OVERDUE' : status.id === 'atRisk' ? 'AT RISK' : expectedProgress != null ? 'ON TRACK' : 'SAFE'
  return { actualProgress: progress.pct, expectedProgress, remainingMin: tasks.length || Number.isFinite(project.estimateMin) ? remainingMin : null, velocityMinPerDay: velocity, projectedCompletion, deadline: project.deadline || null, risk, enough: velocity != null && remainingMin > 0, reason: velocity == null ? 'Not enough history to forecast.' : risk === 'AT RISK' ? 'Actual progress is behind the expected pace.' : 'Current progress is within the available window.' }
}
