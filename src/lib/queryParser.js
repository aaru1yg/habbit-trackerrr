/* ============================================================
   QUERY PARSER — natural-language productivity filters (Phase E13).

   These are SEARCH-side filters, kept separate from commands on
   purpose (E12): a filter answers "show me", a command answers
   "do this".

   Every filter is a thin reading of an engine that already exists.
   There is no second ranking system here and no new heuristic — if
   an engine says there is not enough data, the filter says so too.

   Deliberately does NOT import advancedAnalytics.js: that module is
   lazy-only and a Phase D test asserts it has exactly one importer.
   The workload arithmetic below is the same two lines, written here
   so this file stays importable from anywhere.
   ============================================================ */
import { dayStr, addDaysStr, subDaysStr, weekDays, shortDate, minutesLabel } from './dates.js'
import { weekdayOf } from './schedule.js'
import { activeHabits, eligibleOn, isDone } from './stats.js'
import { workloadSeries, projectStatus, assignmentStatus, assignmentProgress, projectProgress } from './work.js'
import { goalProgress, goalPace } from './goals.js'
import { getTodayPriorities } from './adaptive.js'
import { preferencesOf } from './personalization.js'

export const NOT_ENOUGH = 'Not enough data yet.'

export const QUERY_FILTERS = [
  { id: 'due-this-week', label: 'Due this week', hint: '“due this week”, “due by Friday”' },
  { id: 'at-risk', label: 'At risk', hint: '“at risk”, “overdue”, “slipping”' },
  { id: 'missing-habits', label: 'Habits I’m missing', hint: '“habits I’m missing”, “skipped today”' },
  { id: 'overloaded-days', label: 'Overloaded days', hint: '“overloaded days”, “too much planned”' },
  { id: 'goals-behind', label: 'Goals behind pace', hint: '“goals behind pace”, “falling behind”' },
  { id: 'today', label: 'What to do today', hint: '“what should I do today”, “today’s priorities”' },
]

const norm = (s) => String(s || '').toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, ' ').trim()

const PATTERNS = {
  'due-this-week': [/\bdue (this|next) week\b/, /\bdue (today|tomorrow)\b/, /\bdue by\b/, /\bthis week\b.*\bdue\b/],
  'at-risk': [/\bat risk\b/, /\boverdue\b/, /\bslipping\b/, /\bbehind\b.*\b(deadline|schedule)\b/, /\burgent\b/],
  'missing-habits': [/\bhabits? (i'?m|i am) missing\b/, /\bmiss(ing|ed) habits?\b/, /\bskipped today\b/, /\bnot done today\b/, /\buncompleted habits?\b/],
  'overloaded-days': [/\boverloaded\b/, /\btoo (much|busy)\b/, /\bheaviest days?\b/, /\bcapacity\b/],
  'goals-behind': [/\bgoals? behind\b/, /\bbehind pace\b/, /\bfalling behind\b/, /\bgoals? (off|off track|at risk)\b/],
  'today': [/\bwhat (should|can) i do\b/, /\btoday'?s priorities\b/, /\bdo today\b/, /\bfor today\b/, /\bright now\b/],
}

/**
 * @returns {{id: string, label: string}|null}
 * null means "this is not a filter, treat it as ordinary search".
 */
export function matchQuery(text) {
  const q = norm(text)
  if (!q) return null
  for (const f of QUERY_FILTERS) {
    for (const re of PATTERNS[f.id]) {
      if (re.test(q)) return { id: f.id, label: f.label }
    }
  }
  return null
}

/* ------------------------------------------------------------
   The filters themselves
   ------------------------------------------------------------ */

function dueThisWeek(state, { now }) {
  const today = dayStr(now)
  const week = weekDays(today, preferencesOf(state).weekStartsOn)
  const end = week[week.length - 1]
  const items = []

  for (const a of state.assignments || []) {
    if (a.archived || a.completedAt || !a.deadline) continue
    const day = String(a.deadline).slice(0, 10)
    if (day < today || day > end) continue
    const st = assignmentStatus(a, now)
    items.push({ kind: 'assignment', id: a.id, name: a.name, sub: `${shortDate(day)} · ${st.label} · ${assignmentProgress(a).pct}%`, href: `assignments/${a.id}`, day })
  }
  for (const p of state.projects || []) {
    if (p.archived || p.completedAt || !p.deadline) continue
    const day = String(p.deadline).slice(0, 10)
    if (day < today || day > end) continue
    const st = projectStatus(p, now)
    items.push({ kind: 'project', id: p.id, name: p.name, sub: `${shortDate(day)} · ${st.label} · ${projectProgress(p).pct}%`, href: `projects/${p.id}`, day })
  }
  items.sort((a, b) => String(a.day).localeCompare(String(b.day)))

  return {
    enough: items.length > 0,
    reason: items.length ? `${items.length} item${items.length === 1 ? '' : 's'} due between ${shortDate(today)} and ${shortDate(end)}.` : NOT_ENOUGH,
    items,
  }
}

function atRisk(state, { now }) {
  const items = []
  const add = (kind, entity, st, pct, href) => {
    const id = String(st.id || '').toUpperCase()
    if (!['AT RISK', 'URGENT', 'OVERDUE', 'CRITICAL'].includes(id)) return
    items.push({
      kind, id: entity.id, name: entity.name, href,
      sub: `${st.label} · ${pct}% · ${entity.deadline ? shortDate(String(entity.deadline).slice(0, 10)) : 'no deadline'}`,
      severity: id === 'OVERDUE' || id === 'CRITICAL' ? 2 : 1,
    })
  }
  for (const a of state.assignments || []) if (!a.archived && !a.completedAt) add('assignment', a, assignmentStatus(a, now), assignmentProgress(a).pct, `assignments/${a.id}`)
  for (const p of state.projects || []) if (!p.archived && !p.completedAt) add('project', p, projectStatus(p, now), projectProgress(p).pct, `projects/${p.id}`)
  items.sort((a, b) => b.severity - a.severity)

  return {
    enough: items.length > 0,
    reason: items.length ? `${items.length} item${items.length === 1 ? '' : 's'} need attention.` : 'Nothing is flagged as at risk right now.',
    items,
  }
}

function missingHabits(state, { now }) {
  const today = dayStr(now)
  const items = []
  for (const h of activeHabits(state)) {
    if (!eligibleOn(h, today) || isDone(state, h.id, today)) continue
    items.push({ kind: 'habit', id: h.id, name: h.name, sub: 'Scheduled today, not completed', href: `habits/${h.id}` })
  }
  // also the last seven days, so "missing" is not just about right now
  const recent = []
  for (let i = 1; i <= 7; i++) {
    const d = subDaysStr(today, i)
    for (const h of activeHabits(state)) {
      if (eligibleOn(h, d) && !isDone(state, h.id, d)) recent.push({ name: h.name, date: d })
    }
  }

  return {
    enough: items.length > 0 || recent.length > 0,
    reason: items.length
      ? `${items.length} habit${items.length === 1 ? '' : 's'} still open today${recent.length ? `, and ${recent.length} missed in the last 7 days` : ''}.`
      : recent.length ? `Everything scheduled today is done. ${recent.length} miss${recent.length === 1 ? '' : 'es'} in the last 7 days.` : NOT_ENOUGH,
    items,
    recent,
  }
}

function overloadedDays(state, { now }) {
  const capacityMin = preferencesOf(state).dailyCapacityMin
  if (capacityMin == null) {
    return {
      enough: false,
      reason: 'Set a daily capacity in Settings → How you work and this can tell you which days are over it.',
      items: [],
    }
  }
  const series = workloadSeries(state, { from: dayStr(now), days: 14, now })
  const items = series.rows
    .filter((r) => r.minutes > capacityMin)
    .map((r) => ({
      kind: 'day', id: r.date, name: `${r.label} · ${minutesLabel(r.minutes)}`,
      sub: `${minutesLabel(r.minutes - capacityMin)} over your ${minutesLabel(capacityMin)} · ${r.count} item${r.count === 1 ? '' : 's'}`,
      href: `calendar/${String(r.date).slice(0, 7)}`,
    }))

  return {
    enough: items.length > 0,
    reason: items.length
      ? `${items.length} day${items.length === 1 ? '' : 's'} in the next fortnight exceed your ${minutesLabel(capacityMin)}.`
      : `No day in the next fortnight exceeds your ${minutesLabel(capacityMin)}.`,
    items,
  }
}

function goalsBehind(state, { now }) {
  const items = []
  for (const g of state.goals || []) {
    if (g.archived) continue
    const pace = goalPace(g, { now })
    const prog = goalProgress(state, g, { now })
    if (!pace) continue // no start date or target date → no pace to be behind
    const gap = pace.expected - prog.pct
    if (gap < 5) continue
    items.push({
      kind: 'goal', id: g.id, name: g.title, href: `goals/${g.id}`,
      sub: `${prog.pct}% done vs ${pace.expected}% expected · ${gap} points behind`,
      gap,
    })
  }
  items.sort((a, b) => b.gap - a.gap)

  const measurable = (state.goals || []).filter((g) => !g.archived && goalPace(g, { now })).length
  return {
    enough: measurable > 0,
    reason: !measurable
      ? 'No goal has both a start and a target date, so there is no pace to compare against.'
      : items.length ? `${items.length} goal${items.length === 1 ? '' : 's'} behind pace.` : 'Every measurable goal is on pace.',
    items,
  }
}

function whatsToday(state, { now }) {
  const rows = getTodayPriorities(state, { now, limit: 6, capacityMin: preferencesOf(state).dailyCapacityMin })
  const hrefFor = (item) => (item.kind === 'assignment' ? `assignments/${item.id}`
    : item.kind === 'project' || item.kind === 'project-task' ? `projects/${item.projectId || item.id}`
      : item.kind === 'goal-milestone' ? `goals/${item.goalId}`
        : `habits/${item.id}`)

  return {
    enough: rows.length > 0,
    reason: rows.length ? `Ranked by your existing priority engine. ${rows.length} item${rows.length === 1 ? '' : 's'}.` : NOT_ENOUGH,
    items: rows.map((r, i) => ({
      kind: r.item.kind, id: r.item.id, name: r.item.label || r.item.name,
      sub: `#${i + 1} · ${r.reasons?.length ? r.reasons.join(' · ') : 'ranked by priority'}`,
      href: hrefFor(r.item),
    })),
  }
}

const RUNNERS = {
  'due-this-week': dueThisWeek,
  'at-risk': atRisk,
  'missing-habits': missingHabits,
  'overloaded-days': overloadedDays,
  'goals-behind': goalsBehind,
  'today': whatsToday,
}

/**
 * Run one filter. Unknown ids return an honest miss rather than a
 * silent empty list.
 */
export function runQuery(state, id, { now = new Date() } = {}) {
  const filter = QUERY_FILTERS.find((f) => f.id === id)
  const runner = RUNNERS[id]
  if (!filter || !runner) {
    return { id, label: null, enough: false, reason: 'That filter does not exist.', items: [] }
  }
  const result = runner(state, { now })
  return {
    id,
    label: filter.label,
    enough: result.enough,
    reason: result.reason,
    items: result.items,
    recent: result.recent || null,
  }
}

/** Filter a free-text query in one step: match, then run. */
export function answerQuery(state, text, { now = new Date() } = {}) {
  const match = matchQuery(text)
  if (!match) return null
  return runQuery(state, match.id, { now })
}

/* Re-exported so callers can build "due in N days" without re-deriving. */
export { weekDays, addDaysStr, weekdayOf }
