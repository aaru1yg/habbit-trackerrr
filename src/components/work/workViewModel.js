/* Work presentation adapter. No persisted model and no new intelligence:
 * statuses/progress/risk, calendar markers, timeline and capacity remain owned
 * by work.js/adaptive.js. This file only joins references and groups UI rows. */
import { assignmentStatus, projectStatus, projectProgress, milestoneTrack, deadlineTimeline, calendarMarkers, matchesQuery } from '../../lib/work.js'
import { scorePriority, getNextBestAction, workloadByDay, projectForecast } from '../../lib/adaptive.js'
import { preferencesOf } from '../../lib/personalization.js'
import { dayStr, dayOf, addDaysStr, toLocalDate, weekDays } from '../../lib/dates.js'

export const WORK_VIEWS = ['overview', 'deliverables', 'projects', 'workload', 'deadlines']
export const LEGACY_WORK_VIEWS = { projects: 'projects', assignments: 'deliverables', workload: 'workload', timeline: 'deadlines' }
export const FILTERS = [['all', 'All'], ['risk', 'At Risk'], ['soon', 'Due Soon'], ['overdue', 'Overdue'], ['active', 'Active'], ['completed', 'Completed']]
export const workView = (route, query = '') => LEGACY_WORK_VIEWS[route] || (WORK_VIEWS.includes(new URLSearchParams(query).get('view')) ? new URLSearchParams(query).get('view') : 'overview')
export const workHref = (view, filter = 'active', horizon = '') => `work?view=${view}&filter=${filter}${horizon ? `&horizon=${horizon}` : ''}`
const attention = ['OVERDUE', 'CRITICAL', 'AT RISK']
const riskOrder = { OVERDUE: 0, CRITICAL: 1, 'AT RISK': 2, 'DUE SOON': 3 }
const attentionOrder = (a, b) => (riskOrder[a.risk] ?? 4) - (riskOrder[b.risk] ?? 4) || b.score - a.score

export function workWorkspace(state, now = new Date()) {
  const today = dayStr(now)
  const capacityMin = preferencesOf(state).dailyCapacityMin
  const rows = []
  const add = (kind, item, status, parent = null, milestone = null) => {
    const entity = { ...item, kind, ...(parent ? { projectId: parent.id } : {}), ...(milestone ? { milestoneId: milestone.id } : {}), deadline: item.deadline || item.due || null, ...(['project-task', 'milestone'].includes(kind) ? { progress: status.pct } : {}) }
    // Tasks/milestones store calendar days. Match work.js's end-of-local-day
    // convention before passing that date to the timestamp-based risk selector.
    const scored = scorePriority({ ...entity, deadline: entity.deadline ? toLocalDate(entity.deadline, { endOfDay: true })?.toISOString() : null }, { now })
    // A display precedence across existing deterministic sources, not a risk formula.
    const risk = status.complete ? 'COMPLETED' : attention.includes(scored.risk.id) ? scored.risk.id : ({ overdue: 'OVERDUE', urgent: 'CRITICAL', atRisk: 'AT RISK' }[status.id] || scored.risk.id)
    const href = kind === 'assignment' ? `assignments/${item.id}` : kind === 'project' ? `projects/${item.id}` : `projects/${parent.id}?${kind === 'project-task' ? 'task' : 'milestone'}=${encodeURIComponent(item.id)}`
    rows.push({ key: `${kind}:${item.id}`, kind, item: entity, status, risk, atRisk: !status.complete && attention.includes(risk), score: scored.score, remainingMin: scored.remainingMin, parent, milestone, href, day: dayOf(entity.deadline) || null })
  }
  for (const a of state.assignments || []) if (!a.archived) add('assignment', a, assignmentStatus(a, now), (state.projects || []).find(p => p.id === a.projectId) || null)
  for (const p of state.projects || []) {
    if (p.archived) continue
    add('project', p, projectStatus(p, now))
    for (const m of milestoneTrack(p)) {
      const pct = m.own ?? (m.reached ? 100 : 0)
      add('milestone', m, { pct, complete: m.reached }, p)
      for (const t of m.tasks || []) add('project-task', t, { pct: t.done ? 100 : 0, complete: !!t.done }, p, m)
    }
  }
  const byKey = new Map(rows.map(r => [r.key, r]))
  // Parent deadlines come from the canonical timeline. Child dates come from
  // the existing calendar marker selector (timeline itself only emits parents).
  const timeline = deadlineTimeline(state, { now })
  const dated = timeline.groups.flatMap(g => g.entries.map(e => byKey.get(`${e.kind}:${e.item.id}`))).filter(Boolean)
  const childDays = [...new Set(rows.filter(r => r.parent && r.day).map(r => r.day))]
  for (const markers of calendarMarkers(state, childDays).values()) for (const marker of markers) {
    const key = marker.kind === 'task' ? `project-task:${marker.task.id}` : marker.kind === 'milestone' ? `milestone:${marker.milestone.id}` : null
    if (key && byKey.has(key)) dated.push(byKey.get(key))
  }
  const deadlines = [...new Map(dated.map(r => [r.key, r])).values()].sort((a, b) => a.day.localeCompare(b.day) || b.score - a.score)
  const horizons = [{ id: 'today', label: 'Today', end: today, start: today }, { id: 'tomorrow', label: 'Tomorrow', start: addDaysStr(today, 1), end: addDaysStr(today, 1) }, { id: '3', label: '3 days', start: today, end: addDaysStr(today, 2) }, { id: '7', label: '7 days', start: today, end: addDaysStr(today, 6) }].map(h => {
    const items = deadlines.filter(r => !r.status.complete && r.day >= h.start && r.day <= h.end)
    return { ...h, items, count: items.length, effort: items.reduce((n, r) => n + (r.remainingMin ?? 0), 0), unknown: items.filter(r => r.remainingMin == null).length, highest: [...items].sort(attentionOrder)[0] || null }
  })
  for (const row of horizons[3].items) if (!row.atRisk) row.risk = 'DUE SOON'
  const active = rows.filter(r => !r.status.complete).sort(attentionOrder)
  const next = getNextBestAction(state, { now, capacityMin })
  return { rows, active, atRisk: active.filter(r => r.atRisk), deadlines, horizons, today, next: next && ['project', 'assignment'].includes(next.item.kind) ? next : null, load: workloadByDay(state, { from: today, days: 7, now, capacityMin }) }
}

export function filterWork(rows, { filter = 'active', query = '', horizon = '' } = {}, model) {
  const horizonKeys = horizon ? new Set(model.horizons.find(h => h.id === horizon)?.items.map(r => r.key) || []) : null
  return rows.filter(r => matchesQuery(r.item, query) && (!horizonKeys || horizonKeys.has(r.key)) && (
    filter === 'all' ? true : filter === 'completed' ? r.status.complete : filter === 'risk' ? r.atRisk : filter === 'overdue' ? r.risk === 'OVERDUE' : filter === 'soon' ? model.horizons[3].items.some(x => x.key === r.key) : !r.status.complete
  ))
}

export function deadlineGroups(rows, today) {
  const groups = ['Overdue', 'Today', 'Tomorrow', 'This week', 'Later'].map(label => ({ label, rows: [] }))
  for (const row of rows) {
    const i = row.day < today && !row.status.complete ? 0 : row.day === today ? 1 : row.day === addDaysStr(today, 1) ? 2 : row.day > today && row.day <= weekDays(today)[6] ? 3 : 4
    groups[i].rows.push(row)
  }
  return groups.filter(g => g.rows.length)
}

export function projectContext(row, now) {
  return { progress: projectProgress(row.item), forecast: projectForecast(row.item, { now }) }
}
