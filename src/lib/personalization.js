/* ============================================================
   PERSONALIZATION — the adaptive layer.

   Two sources of truth, and only two:

     1. observable product behaviour — the signal log — plus the
        user's own stored data
     2. preferences the user explicitly set

   Nothing here infers who a person is. No demographic, no health,
   no mood attribution, nothing sensitive: only what the app can see
   them do inside the app.

   Every function is pure, and every result carries the evidence it
   came from. When the evidence is thin the result says so with
   `enough: false` and the same plain sentence the rest of the product
   uses: "Not enough data yet." Nothing is ever guessed at.

   Deterministic priority (adaptive.js) stays authoritative. This
   module may only *nudge* a score, inside ADJUSTMENT_CAP, and it
   always reports every nudge it made.
   ============================================================ */
import { subDaysStr, dayStr, toLocalDate, minutesLabel, partOfDay } from './dates.js'
import { activeHabits } from './stats.js'
import { assignmentProgress, projectProgress, allTasks, workloadSeries } from './work.js'
import { getTodayPriorities } from './adaptive.js'
import { weekdayPerformance } from './analytics.js'

export const NOT_ENOUGH = 'Not enough data yet.'

/* Minimum evidence before any personal claim is made. */
export const PERSONALIZATION_THRESHOLDS = {
  signals: 5,             // quick actions need this many observations
  windowObservations: 5,  // total timestamps before a working window is claimed
  windowModal: 3,         // …and this many inside the winning hour
  estimateSamples: 3,     // completed pairs of estimate vs actual
  focusSessions: 3,       // finished focus sessions
  completionDays: 90,     // how far back completion history is read
  activityDays: 30,       // window for the activity mix
}

/* ------------------------------------------------------------
   1 · SIGNALS — the observable behaviour log

   Append-only, capped, and prunable. A signal is a fact about what
   happened in the app, nothing more. Unknown types are rejected
   rather than stored, so the log can never fill with invention.
   ------------------------------------------------------------ */

export const SIGNAL_TYPES = {
  'screen-visit': 'Visited a screen',
  'habit-add': 'Added a habit',
  'habit-complete': 'Completed a habit',
  'work-add': 'Added work',
  'focus-start': 'Started a focus session',
  'focus-complete': 'Finished a focus session',
  'plan-build': 'Built a plan',
  'capture': 'Used quick capture',
  'insight-open': 'Opened insights',
  'workload-open': 'Reviewed workload',
  'item-defer': 'Moved work to another day',
}

export const MAX_SIGNALS = 400

const newSignalId = (at) => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}-${at}`

/** Append one real event. Unknown types are ignored, never stored. */
export function recordSignal(log, type, { at = new Date().toISOString(), target = null, note = null } = {}) {
  const list = Array.isArray(log) ? log : []
  if (!SIGNAL_TYPES[type]) return list
  const entry = { id: newSignalId(at), type, at, target: target == null ? null : String(target).slice(0, 80), note: note == null ? null : String(note).slice(0, 120) }
  return [...list, entry].slice(-MAX_SIGNALS)
}

/** Drop signals older than the window. Keeps the log bounded and honest. */
export function pruneSignals(log, { days = 180, now = new Date() } = {}) {
  const cutoff = subDaysStr(dayStr(now), days - 1)
  return (Array.isArray(log) ? log : []).filter((s) => s && s.at && dayStr(toLocalDate(s.at) || now) >= cutoff)
}

/** Count signals per type inside the window. */
export function signalCounts(log, { days = 30, now = new Date() } = {}) {
  const cutoff = subDaysStr(dayStr(now), days - 1)
  const counts = {}
  for (const s of Array.isArray(log) ? log : []) {
    if (!s || !s.at || !SIGNAL_TYPES[s.type]) continue
    if (dayStr(toLocalDate(s.at) || now) < cutoff) continue
    counts[s.type] = (counts[s.type] || 0) + 1
  }
  return counts
}

/** Total observations in the window — the honesty gate for quick actions. */
export const signalTotal = (log, opts = {}) =>
  Object.values(signalCounts(log, opts)).reduce((n, v) => n + v, 0)

/* ------------------------------------------------------------
   2 · PREFERENCES — explicit, editable, never assumed

   Every value defaults to null. `planningBufferPct` (15) and
   `weekStartsOn` (1) are the product's existing defaults — the same
   ones planning.js and dates.js already fall back to — not guesses
   about the person.
   ------------------------------------------------------------ */

export const BREAK_STYLES = [
  { id: 'short', label: 'Short breaks (5 min)' },
  { id: 'long', label: 'Long breaks (15–20 min)' },
  { id: 'none', label: 'No breaks' },
]

export const DEFAULT_PREFERENCES = {
  focusStartHour: null,
  focusEndHour: null,
  planningTime: null,
  breakStyle: null,
  dailyCapacityMin: null,
  planningBufferPct: 15,
  weekStartsOn: 1,
  reminderWindow: null,
}

/**
 * An hour is only an hour if the user actually picked one. `null`, `''` and
 * `undefined` must stay null — coercing them to 0 would invent a midnight
 * preference nobody chose, which is exactly the assumption this layer
 * exists to avoid.
 */
const hourOrNull = (v) => {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isInteger(n) && n >= 0 && n <= 23 ? n : null
}
const hhmm = (v) => (typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? v : null)
const windowOrNull = (v) => {
  if (typeof v !== 'string') return null
  const m = v.match(/^([01]\d|2[0-3]):[0-5]\d-([01]\d|2[0-3]):[0-5]\d$/)
  return m ? v : null
}
const numOrNull = (v, min, max) => (Number.isFinite(v) && v >= min && v <= max ? Math.round(v) : null)

/**
 * Validate preferences from storage, an import file or the cloud.
 * Anything unrecognised becomes null — a preference is only ever what
 * the user actually chose.
 */
export function coercePreferences(raw) {
  const p = raw && typeof raw === 'object' ? raw : {}
  return {
    focusStartHour: hourOrNull(p.focusStartHour),
    focusEndHour: hourOrNull(p.focusEndHour),
    planningTime: hhmm(p.planningTime),
    breakStyle: BREAK_STYLES.some((b) => b.id === p.breakStyle) ? p.breakStyle : null,
    dailyCapacityMin: numOrNull(p.dailyCapacityMin, 15, 960),
    planningBufferPct: numOrNull(p.planningBufferPct, 0, 50) ?? DEFAULT_PREFERENCES.planningBufferPct,
    weekStartsOn: numOrNull(p.weekStartsOn, 0, 6) ?? DEFAULT_PREFERENCES.weekStartsOn,
    reminderWindow: windowOrNull(p.reminderWindow),
  }
}

export const preferencesOf = (state) => coercePreferences(state?.preferences)

/** How many preferences the user has actually set. Drives UI copy. */
export function preferencesSet(state) {
  const p = preferencesOf(state)
  return Object.entries(p).filter(([k, v]) => v != null && k !== 'planningBufferPct' && k !== 'weekStartsOn').map(([k]) => k)
}

/* ------------------------------------------------------------
   3 · FOCUS LOG — the missing data source for learning

   Without this nothing can learn from actual durations. Capped,
   validated, and only ever written from a session that really ran.
   ------------------------------------------------------------ */

export const MAX_FOCUS_SESSIONS = 300

export function baseFocusSession(s = {}) {
  const raw = s && typeof s === 'object' ? s : {}
  return {
    // Raw fields first, validated fields last: a caller-supplied value must
    // never be able to override the checks below.
    ...raw,
    id: typeof raw.id === 'string' && raw.id ? raw.id : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    kind: ['habit', 'assignment', 'project', 'project-task', 'goal-milestone'].includes(raw.kind) ? raw.kind : null,
    itemId: raw.itemId == null ? null : String(raw.itemId),
    name: raw.name == null ? null : String(raw.name).slice(0, 120),
    startedAt: raw.startedAt || null,
    endedAt: raw.endedAt || null,
    plannedMin: numOrNull(raw.plannedMin, 1, 1440),
    actualMin: numOrNull(raw.actualMin, 0, 14400),
    completed: raw.completed === true,
    interrupted: raw.interrupted === true,
  }
}

/** Append a session that actually happened. A session with no end is not stored. */
export function recordFocusSession(log, session) {
  const list = Array.isArray(log) ? log : []
  const s = baseFocusSession(session || {})
  if (!s.startedAt || !s.endedAt) return list
  return [...list, s].slice(-MAX_FOCUS_SESSIONS)
}

/* ------------------------------------------------------------
   4 · REAL COMPLETION HISTORY

   Everything below reads timestamps the user's own actions produced.
   ------------------------------------------------------------ */

const inWindow = (value, cutoff) => {
  if (!value) return false
  const d = dayStr(toLocalDate(value) || new Date(value))
  return d >= cutoff
}

/** Completed habit check-ins, work completions and milestones in a window. */
export function completedByKind(state, { days = PERSONALIZATION_THRESHOLDS.completionDays, now = new Date() } = {}) {
  const cutoff = subDaysStr(dayStr(now), days - 1)
  const counts = { habit: 0, assignment: 0, project: 0, 'project-task': 0, 'goal-milestone': 0 }

  for (const h of state.habits || []) {
    for (const [date, entry] of Object.entries(state.checkins?.[h.id] || {})) {
      if (entry?.done === true && date >= cutoff) counts.habit++
    }
  }
  for (const a of state.assignments || []) if (inWindow(a.completedAt, cutoff)) counts.assignment++
  for (const p of state.projects || []) {
    if (inWindow(p.completedAt, cutoff)) counts.project++
    for (const t of allTasks(p)) if (inWindow(t.completedAt, cutoff)) counts['project-task']++
  }
  for (const g of state.goals || []) {
    for (const m of g.milestones || []) if (inWindow(m.doneAt, cutoff)) counts['goal-milestone']++
  }

  const total = Object.values(counts).reduce((n, v) => n + v, 0)
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]
  return {
    counts,
    total,
    enough: total >= PERSONALIZATION_THRESHOLDS.signals,
    topKind: top && top[1] > 0 ? top[0] : null,
    reason: total ? `${total} completions in the last ${days} days.` : NOT_ENOUGH,
  }
}

/**
 * The activity mix over a window, from dated completions only.
 * Used to decide what Today should emphasise — never to label a person.
 */
export function activityMix(state, { days = PERSONALIZATION_THRESHOLDS.activityDays, now = new Date() } = {}) {
  const cutoff = subDaysStr(dayStr(now), days - 1)
  const by = completedByKind(state, { days, now })
  const habit = by.counts.habit
  const work = by.counts.assignment + by.counts.project + by.counts['project-task']
  const goal = by.counts['goal-milestone']
  const total = habit + work + goal
  const shares = total ? { habit: habit / total, work: work / total, goal: goal / total } : { habit: 0, work: 0, goal: 0 }
  const top = Object.entries(shares).sort((a, b) => b[1] - a[1])[0]
  const enough = total >= PERSONALIZATION_THRESHOLDS.signals
  return {
    habit, work, goal, total, shares,
    dominant: enough ? top[0] : null,
    enough,
    windowDays: days,
    cutoff,
    reason: enough ? `${total} completed items in the last ${days} days.` : NOT_ENOUGH,
  }
}

/* ------------------------------------------------------------
   5 · PREFERRED WORKING WINDOW

   Built from timestamps the user produced: when they checked habits
   in, when they started focus sessions, when they logged progress.
   ------------------------------------------------------------ */

export function windowObservations(state, { days = PERSONALIZATION_THRESHOLDS.completionDays, now = new Date() } = {}) {
  const cutoff = subDaysStr(dayStr(now), days - 1)
  const out = []
  const push = (value, source) => {
    if (!inWindow(value, cutoff)) return
    const d = toLocalDate(value)
    if (!d) return
    out.push({ hour: d.getHours(), at: value, source })
  }

  for (const h of state.habits || []) {
    for (const entry of Object.values(state.checkins?.[h.id] || {})) {
      if (entry?.done === true && entry.at) push(entry.at, 'habit check-in')
    }
  }
  for (const s of state.focusLog || []) if (s?.startedAt) push(s.startedAt, 'focus session')
  for (const p of state.projects || []) for (const e of p.progressLog || []) push(e.at, 'project progress')
  for (const a of state.assignments || []) for (const e of a.progressLog || []) push(e.at, 'assignment progress')

  return out
}

export function preferredWindow(state, { days = PERSONALIZATION_THRESHOLDS.completionDays, now = new Date() } = {}) {
  const obs = windowObservations(state, { days, now })
  if (obs.length < PERSONALIZATION_THRESHOLDS.windowObservations) {
    return { enough: false, hour: null, label: null, part: null, share: null, observations: obs.length, reason: NOT_ENOUGH }
  }
  const byHour = {}
  for (const o of obs) byHour[o.hour] = (byHour[o.hour] || 0) + 1
  const ranked = Object.entries(byHour).sort((a, b) => b[1] - a[1] || Number(a[0]) - Number(b[0]))
  const [hourStr, count] = ranked[0]
  const hour = Number(hourStr)
  if (count < PERSONALIZATION_THRESHOLDS.windowModal) {
    return { enough: false, hour: null, label: null, part: null, share: null, observations: obs.length, reason: 'Your activity is spread across the day.' }
  }
  const label = `${String(hour).padStart(2, '0')}:00`
  return {
    enough: true,
    hour,
    label,
    part: partOfDay(new Date(2000, 0, 1, hour, 30)),
    share: Math.round((count / obs.length) * 100),
    observations: obs.length,
    reason: `${count} of ${obs.length} logged actions happened around ${label}.`,
  }
}

/** Explicit focus hours beat inference — but never silently replace it. */
export function workingWindow(state, opts = {}) {
  const p = preferencesOf(state)
  if (p.focusStartHour != null) {
    const end = p.focusEndHour != null ? p.focusEndHour : (p.focusStartHour + 2) % 24
    return {
      enough: true, source: 'preference', startHour: p.focusStartHour, endHour: end,
      label: `${String(p.focusStartHour).padStart(2, '0')}:00–${String(end).padStart(2, '0')}:00`,
      reason: 'You set these focus hours yourself.',
    }
  }
  const observed = preferredWindow(state, opts)
  if (!observed.enough) return { enough: false, source: 'none', startHour: null, endHour: null, label: null, reason: NOT_ENOUGH }
  return {
    enough: true, source: 'observed', startHour: observed.hour, endHour: (observed.hour + 2) % 24,
    label: `around ${observed.label}`, reason: observed.reason,
  }
}

/* ------------------------------------------------------------
   6 · ADAPTIVE ESTIMATES

   Compares what the user estimated with what actually happened, on
   comparable completed work. It only ever *suggests*; the stored
   estimate is never rewritten.
   ------------------------------------------------------------ */

const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)

function estimateSamples(state, kind, { days, now }) {
  const cutoff = subDaysStr(dayStr(now), days - 1)
  const out = []
  const add = (estimateMin, actualMin, at, name) => {
    if (!Number.isFinite(estimateMin) || !Number.isFinite(actualMin)) return
    if (estimateMin <= 0 || actualMin <= 0) return
    if (!inWindow(at, cutoff)) return
    out.push({ estimateMin, actualMin, name })
  }

  if (kind === 'assignment') {
    for (const a of state.assignments || []) if (a.completedAt) add(a.estimateMin, a.actualMin, a.completedAt, a.name)
  } else if (kind === 'project') {
    for (const p of state.projects || []) if (p.completedAt) add(p.estimateMin, p.actualMin, p.completedAt, p.name)
  } else if (kind === 'project-task') {
    for (const p of state.projects || []) for (const t of allTasks(p)) if (t.done) add(t.estimateMin, t.actualMin, t.completedAt, t.name)
  } else if (kind === 'habit') {
    for (const s of state.focusLog || []) {
      if (!s?.completed) continue
      add(s.plannedMin, s.actualMin, s.endedAt || s.startedAt, s.name)
    }
  }
  return out
}

/**
 * "Your recent similar sessions average ~67 min."
 * Returns null-free, evidence-backed advice — or says there is none.
 */
export function estimateAdvice(item, state, { days = PERSONALIZATION_THRESHOLDS.completionDays, now = new Date() } = {}) {
  const kind = item?.kind || 'assignment'
  const samples = estimateSamples(state, kind, { days, now })
  if (samples.length < PERSONALIZATION_THRESHOLDS.estimateSamples) {
    return { enough: false, kind, samples: samples.length, suggestedMin: null, actualMeanMin: null, plannedMeanMin: null, deltaMin: null, ratio: null, reason: NOT_ENOUGH }
  }
  const actualMeanMin = Math.round(mean(samples.map((s) => s.actualMin)))
  const plannedMeanMin = Math.round(mean(samples.map((s) => s.estimateMin)))
  const ratio = plannedMeanMin > 0 ? Math.round((actualMeanMin / plannedMeanMin) * 100) / 100 : null
  const estimated = Number.isFinite(item?.estimateMin) ? item.estimateMin : null
  const deltaMin = estimated != null ? actualMeanMin - estimated : null
  return {
    enough: true,
    kind,
    samples: samples.length,
    suggestedMin: actualMeanMin,
    actualMeanMin,
    plannedMeanMin,
    deltaMin,
    ratio,
    estimateMin: estimated,
    reason: `Your last ${samples.length} comparable ${kind.replace('-', ' ')}${samples.length === 1 ? '' : 's'} averaged ${minutesLabel(actualMeanMin)} of real time.`,
  }
}

/* ------------------------------------------------------------
   7 · QUICK ACTIONS — learned from what the user actually does

   Ranked by observation. Below the threshold the list falls back to
   the product's default order and says so, rather than pretending to
   have learned something.
   ------------------------------------------------------------ */

export const QUICK_ACTIONS = [
  { id: 'capture', label: 'Quick capture', signal: 'capture' },
  { id: 'add-habit', label: 'Add habit', signal: 'habit-add' },
  { id: 'add-project', label: 'Add project', signal: 'work-add', target: 'project' },
  { id: 'add-assignment', label: 'Add assignment', signal: 'work-add', target: 'assignment' },
  { id: 'start-focus', label: 'Start focus', signal: 'focus-start' },
  { id: 'plan-day', label: 'Plan my day', signal: 'plan-build' },
  { id: 'review-workload', label: 'Review workload', signal: 'workload-open' },
  { id: 'view-insights', label: 'View insights', signal: 'insight-open' },
]

/** Count real observations of one action inside the window. */
function actionScore(action, log, days, now) {
  const cutoff = subDaysStr(dayStr(now), days - 1)
  let n = 0
  for (const s of Array.isArray(log) ? log : []) {
    if (!s || s.type !== action.signal) continue
    if (dayStr(toLocalDate(s.at) || now) < cutoff) continue
    // 'work-add' is one signal with two targets; count only the matching one
    // so "Add project" and "Add assignment" learn independently.
    if (action.signal === 'work-add' && s.target !== action.target) continue
    n++
  }
  return n
}

export function quickActions(state, { signals, days = 30, now = new Date(), limit = 4 } = {}) {
  const log = Array.isArray(signals) ? signals : (state?.signals || [])
  const total = signalTotal(log, { days, now })
  const learned = total >= PERSONALIZATION_THRESHOLDS.signals

  const rows = QUICK_ACTIONS.map((action, i) => ({
    ...action,
    observations: learned ? actionScore(action, log, days, now) : 0,
    defaultOrder: i,
  }))

  rows.sort((a, b) => (b.observations - a.observations) || (a.defaultOrder - b.defaultOrder))
  const picked = rows.slice(0, limit)

  return {
    actions: picked,
    learned,
    observations: total,
    windowDays: days,
    source: learned ? 'observed' : 'default',
    reason: learned
      ? `Ordered from your last ${total} actions in ${days} days.`
      : `Default order — ${total} of the ${PERSONALIZATION_THRESHOLDS.signals} actions needed to personalise this.`,
  }
}

/* ------------------------------------------------------------
   8 · ADAPTIVE HOME — emphasis, never structure

   The screen keeps the same sections in the same order. Only the
   *weight* changes, and every weight stays inside a narrow band so
   the visual hierarchy can never be destroyed by the adapter.
   ------------------------------------------------------------ */

export const EMPHASIS_WEIGHTS = {
  deadline: { deadline: 1.30, work: 1.15, habit: 1.00, goal: 0.90 },
  work: { deadline: 1.10, work: 1.30, habit: 1.00, goal: 0.95 },
  habit: { deadline: 1.00, work: 0.95, habit: 1.30, goal: 1.00 },
  goal: { deadline: 1.00, work: 0.95, habit: 1.05, goal: 1.30 },
  start: { deadline: 1.00, work: 1.00, habit: 1.15, goal: 1.00 },
  balanced: { deadline: 1.00, work: 1.00, habit: 1.00, goal: 1.00 },
}

export const EMPHASIS_RANGE = { min: 0.85, max: 1.35 }

const isOpen = (x) => !x.archived && !x.completedAt

export function homeEmphasis(state, { now = new Date(), days = 7, preferences } = {}) {
  const prefs = preferences || preferencesOf(state)
  const assignments = (state.assignments || []).filter(isOpen)
  const projects = (state.projects || []).filter(isOpen)
  const habits = activeHabits(state)
  const goals = (state.goals || []).filter((g) => !g.archived && (g.status || 'active') === 'active')
  const today = dayStr(now)

  let overdue = 0
  let dueSoon = 0
  let committedMin = 0
  for (const item of [...assignments, ...projects]) {
    if (!item.deadline) continue
    const d = toLocalDate(item.deadline, { endOfDay: true })
    if (!d) continue
    const diff = Math.round((new Date(dayStr(d)).getTime() - new Date(today).getTime()) / 86400000)
    const progress = item.progress != null ? item.progress : (assignments.includes(item) ? assignmentProgress(item).pct : projectProgress(item).pct)
    if (diff < 0) overdue++
    else if (diff < days) dueSoon++
    if (diff >= 0 && diff < days && Number.isFinite(item.estimateMin)) committedMin += Math.round(item.estimateMin * (1 - progress / 100))
  }

  const mix = activityMix(state, { now })
  const capacity = prefs.dailyCapacityMin
  const hasAnything = habits.length || assignments.length || projects.length || goals.length

  const build = (id, reason, evidence) => ({
    id,
    reason,
    evidence,
    weights: EMPHASIS_WEIGHTS[id],
    mix,
    counts: { overdue, dueSoon, assignments: assignments.length, projects: projects.length, habits: habits.length, goals: goals.length, committedMin, capacityMin: capacity },
    enough: Boolean(hasAnything),
    windowDays: days,
  })

  if (!hasAnything) {
    return build('start', 'Nothing is being tracked yet.', [{ label: 'Tracked items', value: '0' }])
  }
  if (overdue > 0) {
    return build('deadline', `${overdue} item${overdue === 1 ? ' is' : 's are'} past a deadline.`, [{ label: 'Overdue', value: String(overdue) }, { label: 'Due in ' + days + ' days', value: String(dueSoon) }])
  }
  if (dueSoon >= 3) {
    return build('deadline', `${dueSoon} deadlines land in the next ${days} days.`, [{ label: 'Due in ' + days + ' days', value: String(dueSoon) }])
  }
  if (capacity != null && committedMin <= capacity * 0.4 && goals.length) {
    return build('goal', `Only ${minutesLabel(committedMin)} is committed against a ${minutesLabel(capacity)} day, and ${goals.length} goal${goals.length === 1 ? '' : 's'} are open.`, [{ label: 'Committed', value: minutesLabel(committedMin) }, { label: 'Capacity', value: minutesLabel(capacity) }])
  }
  if (mix.enough && mix.dominant === 'habit') {
    return build('habit', `${mix.habit} of your last ${mix.total} completions were habits.`, [{ label: 'Habit completions', value: String(mix.habit) }, { label: 'Work completions', value: String(mix.work) }])
  }
  if (mix.enough && mix.dominant === 'work') {
    return build('work', `${mix.work} of your last ${mix.total} completions were project or assignment work.`, [{ label: 'Work completions', value: String(mix.work) }, { label: 'Habit completions', value: String(mix.habit) }])
  }
  if (habits.length && !assignments.length && !projects.length) {
    return build('habit', `Habits are the only thing being tracked (${habits.length} active).`, [{ label: 'Active habits', value: String(habits.length) }])
  }
  if (!habits.length && (assignments.length || projects.length)) {
    return build('work', `Work is the only thing being tracked (${assignments.length + projects.length} open items).`, [{ label: 'Open work', value: String(assignments.length + projects.length) }])
  }
  return build('balanced', 'Habits, work and goals are all in play, with nothing urgent.', [{ label: 'Overdue', value: '0' }, { label: 'Due in ' + days + ' days', value: String(dueSoon) }])
}

/* ------------------------------------------------------------
   9 · PERSONAL PRODUCTIVITY PROFILE

   A transparent read-out. Every section names the evidence behind
   it. There is deliberately no score: a number with no visible
   derivation would be a mystery, not an insight.
   ------------------------------------------------------------ */

export function typicalFocusDuration(state, { days = PERSONALIZATION_THRESHOLDS.completionDays, now = new Date() } = {}) {
  const cutoff = subDaysStr(dayStr(now), days - 1)
  const mins = (state.focusLog || [])
    .filter((s) => s?.completed && Number.isFinite(s.actualMin) && inWindow(s.endedAt || s.startedAt, cutoff))
    .map((s) => s.actualMin)
    .sort((a, b) => a - b)
  if (mins.length < PERSONALIZATION_THRESHOLDS.focusSessions) {
    return { enough: false, sessions: mins.length, meanMin: null, lowMin: null, highMin: null, label: null, reason: NOT_ENOUGH }
  }
  const meanMin = Math.round(mean(mins))
  const lowMin = mins[Math.floor(mins.length * 0.25)]
  const highMin = mins[Math.min(mins.length - 1, Math.floor(mins.length * 0.75))]
  return {
    enough: true,
    sessions: mins.length,
    meanMin,
    lowMin,
    highMin,
    label: lowMin === highMin ? minutesLabel(meanMin) : `${minutesLabel(lowMin)}–${minutesLabel(highMin)}`,
    reason: `Across ${mins.length} finished focus sessions.`,
  }
}

export function typicalDailyLoad(state, { days = 14, now = new Date() } = {}) {
  const from = subDaysStr(dayStr(now), days - 1)
  const series = workloadSeries(state, { from, days, now })
  const minutes = series.rows.map((r) => r.minutes).filter((v) => Number.isFinite(v) && v > 0)
  if (minutes.length < 5) return { enough: false, days: minutes.length, meanMin: null, peakMin: null, label: null, reason: NOT_ENOUGH }
  const meanMin = Math.round(mean(minutes))
  const peakMin = Math.max(...minutes)
  return { enough: true, days: minutes.length, meanMin, peakMin, label: minutesLabel(meanMin), reason: `Across ${minutes.length} days with tracked work.` }
}

/** The most-postponed real items, from the defer signal log. */
export function postponementPattern(state, { days = 30, now = new Date() } = {}) {
  const log = Array.isArray(state?.signals) ? state.signals : []
  const cutoff = subDaysStr(dayStr(now), days - 1)
  const byName = {}
  for (const s of log) {
    if (s?.type !== 'item-defer' || !s.target) continue
    if (dayStr(toLocalDate(s.at) || now) < cutoff) continue
    byName[s.target] = (byName[s.target] || 0) + 1
  }
  const rows = Object.entries(byName).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  const total = rows.reduce((n, r) => n + r[1], 0)
  if (!rows.length) return { enough: false, total: 0, rows: [], top: null, reason: 'Nothing has been moved to another day.' }
  return { enough: true, total, rows, top: rows[0][0], reason: `${total} move${total === 1 ? '' : 's'} in the last ${days} days.` }
}

export function productivityProfile(state, { now = new Date(), days = PERSONALIZATION_THRESHOLDS.completionDays } = {}) {
  const window = workingWindow(state, { days, now })
  const focus = typicalFocusDuration(state, { days, now })
  const weekday = weekdayPerformance(state, 12)
  const load = typicalDailyLoad(state, { now })
  const completions = completedByKind(state, { days, now })
  const postponed = postponementPattern(state, { now })

  const sections = [
    {
      id: 'working-window',
      label: window.source === 'preference' ? 'Focus hours you set' : 'When you usually work',
      value: window.enough ? window.label : null,
      enough: window.enough,
      reason: window.reason,
      evidence: window.enough ? [{ label: 'Source', value: window.source === 'preference' ? 'your preference' : 'observed from your logged actions' }] : [],
    },
    {
      id: 'typical-focus',
      label: 'Typical focus session',
      value: focus.enough ? focus.label : null,
      enough: focus.enough,
      reason: focus.reason,
      evidence: focus.enough ? [{ label: 'Sessions', value: String(focus.sessions) }, { label: 'Average', value: minutesLabel(focus.meanMin) }] : [],
    },
    {
      id: 'best-days',
      label: 'Best completion days',
      value: weekday.enough && weekday.best ? weekday.best.name : null,
      enough: Boolean(weekday.enough && weekday.best),
      reason: weekday.enough && weekday.best
        ? `${weekday.best.name}s reach ${Math.round(weekday.best.rate * 100)}% over ${weekday.windowWeeks} weeks.`
        : NOT_ENOUGH,
      evidence: weekday.enough && weekday.best && weekday.worst
        ? [{ label: 'Strongest', value: `${weekday.best.name} · ${Math.round(weekday.best.rate * 100)}%` }, { label: 'Hardest', value: `${weekday.worst.name} · ${Math.round(weekday.worst.rate * 100)}%` }]
        : [],
    },
    {
      id: 'typical-load',
      label: 'Typical daily load',
      value: load.enough ? load.label : null,
      enough: load.enough,
      reason: load.reason,
      evidence: load.enough ? [{ label: 'Busiest day', value: minutesLabel(load.peakMin) }] : [],
    },
    {
      id: 'completion-mix',
      label: 'What you complete most',
      value: completions.enough && completions.topKind ? completions.topKind.replace('-', ' ') : null,
      enough: completions.enough,
      reason: completions.reason,
      evidence: completions.enough ? Object.entries(completions.counts).filter(([, v]) => v > 0).map(([k, v]) => ({ label: k.replace('-', ' '), value: String(v) })) : [],
    },
    {
      id: 'postponement',
      label: 'Commonly postponed',
      value: postponed.enough ? postponed.top : null,
      enough: postponed.enough,
      reason: postponed.reason,
      evidence: postponed.enough ? postponed.rows.slice(0, 3).map(([name, n]) => ({ label: name, value: `${n}×` })) : [],
    },
  ]

  const supported = sections.filter((s) => s.enough)
  return {
    sections,
    enough: supported.length > 0,
    supported: supported.length,
    total: sections.length,
    generatedFrom: [
      'habit check-in timestamps',
      'focus session log',
      'project and assignment progress logs',
      'completion timestamps',
      'workload estimates',
      'your saved preferences',
    ],
    reason: supported.length
      ? `${supported.length} of ${sections.length} patterns have enough real data behind them.`
      : NOT_ENOUGH,
    windowDays: days,
  }
}

/* ------------------------------------------------------------
   10 · PERSONALIZED PRIORITY

   The deterministic engine ranks first. This may only nudge, by at
   most ADJUSTMENT_CAP in total, and reports every nudge.
   ------------------------------------------------------------ */

export const ADJUSTMENT_CAP = 0.08

const hourDistance = (a, b) => { const d = Math.abs(a - b) % 24; return Math.min(d, 24 - d) }

export function personalizeScore(ranked, { now = new Date(), preferences, capacityMin = null, completions } = {}) {
  const prefs = preferences || DEFAULT_PREFERENCES
  const adjustments = []

  // 1 · window fit — only for work with no hard deadline. A deadline
  //     already dominates the deterministic score, and it should.
  const windowStart = prefs.focusStartHour
  if (windowStart != null && !ranked.item?.deadline) {
    const h = (toLocalDate(now) || now).getHours()
    const dist = hourDistance(h, windowStart)
    if (dist <= 1) adjustments.push({ id: 'window-fit', delta: 0.04, reason: 'It is inside your preferred focus hours.' })
    else if (dist >= 8) adjustments.push({ id: 'window-fit', delta: -0.02, reason: 'It is well outside your preferred focus hours.' })
  }

  // 2 · capacity fit — favour work that actually fits what is left.
  const remainingMin = ranked.remainingMin
  if (capacityMin != null && Number.isFinite(remainingMin) && remainingMin > 0) {
    if (remainingMin > capacityMin) adjustments.push({ id: 'capacity-fit', delta: -0.04, reason: `Bigger than today's whole capacity (${minutesLabel(remainingMin)} vs ${minutesLabel(capacityMin)}).` })
    else if (remainingMin <= capacityMin * 0.5) adjustments.push({ id: 'capacity-fit', delta: 0.02, reason: 'Fits comfortably inside today’s capacity.' })
  }

  // 3 · kind preference — from real completion counts, not a guess.
  const topKind = completions?.enough ? completions.topKind : null
  if (topKind && ranked.item?.kind === topKind) {
    adjustments.push({ id: 'kind-preference', delta: 0.03, reason: `You complete ${topKind.replace('-', ' ')} work more than anything else.` })
  }

  const raw = adjustments.reduce((n, a) => n + a.delta, 0)
  const delta = Math.round(Math.max(-ADJUSTMENT_CAP, Math.min(ADJUSTMENT_CAP, raw)) * 1000) / 1000
  return {
    adjustments,
    delta,
    capped: Math.abs(raw) > ADJUSTMENT_CAP,
    adjustedScore: Math.round((ranked.score + delta) * 1000) / 1000,
  }
}

/**
 * The same ranked list the deterministic engine produced, re-ordered
 * only where a bounded personal nudge genuinely changes the outcome.
 * With no personal data the order is identical to adaptive.js.
 */
export function personalizedRanking(state, { now = new Date(), limit = 5, capacityMin = null, preferences } = {}) {
  const prefs = preferences || preferencesOf(state)
  const cap = capacityMin != null ? capacityMin : prefs.dailyCapacityMin
  const completions = completedByKind(state, { now })
  const base = getTodayPriorities(state, { now, limit: 50, capacityMin: cap })

  const rows = base.map((ranked) => {
    const personal = personalizeScore(ranked, { now, preferences: prefs, capacityMin: cap, completions })
    return { ...ranked, ...personal, adjusted: personal.delta !== 0 }
  })

  rows.sort((a, b) => b.adjustedScore - a.adjustedScore || b.score - a.score || String(a.item.id).localeCompare(String(b.item.id)))

  const nudged = rows.filter((r) => r.adjusted).length
  const reordered = rows.some((r, i) => base[i] && base[i].item.id !== r.item.id)
  return {
    rows: rows.slice(0, limit),
    enough: nudged > 0,
    nudged,
    reordered,
    authoritative: 'deterministic',
    reason: nudged
      ? `${nudged} of ${rows.length} ranked items were nudged by your own patterns, within ±${ADJUSTMENT_CAP}.`
      : 'Ranked by the deterministic engine alone — no personal pattern had enough evidence to change it.',
  }
}

/** Next Best Action with the personal nudge applied. Same shape as adaptive.js. */
export function personalizedNextBestAction(state, opts = {}) {
  const ranking = personalizedRanking(state, { ...opts, limit: 1 })
  const top = ranking.rows[0]
  if (!top) return null
  return {
    item: top.item,
    reason: top.reasons?.length ? `Consider this next because it is ${top.reasons.join(' and ')}.` : 'Consider this next based on your current open work.',
    urgency: top.risk?.id || null,
    estimatedMin: top.remainingMin,
    deadline: top.item.deadline || null,
    signals: top.signals,
    adjustments: top.adjustments,
    personalReason: top.adjusted ? top.adjustments.map((a) => a.reason).join(' ') : null,
  }
}

/* ------------------------------------------------------------
   11 · CONTEXT — time-of-day and load-aware framing

   Uses the clock, the real workload, and (when set) the user's own
   focus hours. Never claims to know how the user feels.
   ------------------------------------------------------------ */

export function contextualLens(state, { now = new Date(), preferences } = {}) {
  const prefs = preferences || preferencesOf(state)
  const part = partOfDay(now)
  const hour = (toLocalDate(now) || now).getHours()
  const today = dayStr(now)
  const series = workloadSeries(state, { from: today, days: 1, now })
  const committedMin = series.rows[0]?.minutes || 0
  const capacity = prefs.dailyCapacityMin
  const loaded = capacity != null && committedMin > capacity * 0.8

  const inFocusHours = prefs.focusStartHour != null && prefs.focusEndHour != null && (() => {
    const s = prefs.focusStartHour; const e = prefs.focusEndHour
    return s <= e ? hour >= s && hour < e : hour >= s || hour < e
  })()

  const id = loaded ? 'critical' : inFocusHours ? 'deep' : part === 'night' ? 'wind-down' : part === 'morning' ? 'deep' : 'steady'
  const REASONS = {
    critical: `About ${minutesLabel(committedMin)} is committed against a ${minutesLabel(capacity)} day.`,
    deep: inFocusHours ? 'You are inside the focus hours you set.' : 'Mornings are when deep work usually lands.',
    'wind-down': 'It is late; short, finishable work fits better now.',
    steady: 'No particular time pressure right now.',
  }

  return {
    id,
    part,
    hour,
    inFocusHours: Boolean(inFocusHours),
    committedMin,
    capacityMin: capacity,
    loaded: Boolean(loaded),
    prefers: id === 'critical' ? 'critical' : id === 'deep' ? 'long' : 'short',
    reason: REASONS[id],
    enough: capacity != null || committedMin > 0,
  }
}
