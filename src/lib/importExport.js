/* ============================================================
   IMPORT / EXPORT — v4.
   Defensive by design: a malformed, foreign, or older file must
   never wipe real data or crash the app. Unknown fields are
   dropped, invalid ones fall back to honest defaults.
   ============================================================ */
import { isValidDayStr, isoLocal, todayStr } from './dates.js'

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-3)

const HABIT_CATEGORIES = ['fitness', 'mind', 'learning', 'health', 'creative', 'social']
const ROUTINE_KINDS = ['morning', 'workout', 'study', 'night', 'custom']
const PRIORITIES = ['low', 'normal', 'high']
const TASK_STATUSES = ['todo', 'doing', 'blocked', 'done']
const THEMES = ['midnight', 'ember', 'verdant', 'daylight']

const isStr = (v) => typeof v === 'string' && v.trim().length > 0
const isHHMM = (v) => typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v)
const str = (v, max, fallback = '') => (isStr(v) ? v.trim().slice(0, max) : fallback)
const int = (v, min, max, fallback = null) => (Number.isFinite(v) ? Math.max(min, Math.min(max, Math.round(v))) : fallback)
const pctInt = (v, fallback = 0) => int(v, 0, 100, fallback)
const priority = (v) => (PRIORITIES.includes(v) ? v : 'normal')
const day = (v) => (isValidDayStr(v) ? v : null)
/** Accepts 'yyyy-MM-dd' or a local 'yyyy-MM-ddTHH:mm[:ss]' datetime. */
function deadline(v) {
  if (typeof v !== 'string') return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(v) && isValidDayStr(v)) return v
  if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2})?$/.test(v)) return v.replace(' ', 'T').slice(0, 16)
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? null : isoLocal(d)
}

/* ---------------- Habits ---------------- */

function coerceSchedule(raw, createdAt) {
  if (!raw || typeof raw !== 'object') return { type: 'daily' }
  if (raw.type === 'weekdays' && Array.isArray(raw.days)) {
    const days = [...new Set(raw.days.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))]
    if (days.length) return { type: 'weekdays', days }
  }
  if (raw.type === 'interval') {
    const every = int(raw.every, 1, 90, 1)
    const anchor = day(raw.anchor) || createdAt
    return anchor ? { type: 'interval', every, anchor } : { type: 'daily' }
  }
  if (raw.type === 'dates' && Array.isArray(raw.dates)) {
    const dates = [...new Set(raw.dates.filter(isValidDayStr))].slice(0, 400)
    if (dates.length) return { type: 'dates', dates }
  }
  return { type: 'daily' }
}

function coerceHabit(raw, index) {
  if (!raw || typeof raw !== 'object') return null
  const name = str(raw.name, 80)
  if (!name) return null
  const createdAt = day(raw.createdAt)
  const pause = raw.pause && typeof raw.pause === 'object' && day(raw.pause.from)
    ? { from: day(raw.pause.from), until: day(raw.pause.until) }
    : null
  return {
    id: isStr(raw.id) ? raw.id : uid(),
    name,
    category: HABIT_CATEGORIES.includes(raw.category) ? raw.category : 'mind',
    schedule: coerceSchedule(raw.schedule, createdAt),
    reminder: isHHMM(raw.reminder) ? raw.reminder : null,
    notes: typeof raw.notes === 'string' ? raw.notes.slice(0, 2000) : '',
    createdAt,
    archived: raw.archived === true,
    pause,
    skips: Array.isArray(raw.skips) ? [...new Set(raw.skips.filter(isValidDayStr))].slice(0, 400) : [],
    order: int(raw.order, 0, 9999, index),
  }
}

function coerceCheckins(raw) {
  const out = {}
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out
  for (const [habitId, days] of Object.entries(raw)) {
    if (typeof habitId !== 'string' || !days || typeof days !== 'object' || Array.isArray(days)) continue
    const clean = {}
    for (const [date, entry] of Object.entries(days)) {
      if (!isValidDayStr(date) || !entry || typeof entry !== 'object') continue
      const next = { done: entry.done === true }
      if (typeof entry.note === 'string' && entry.note.trim()) next.note = entry.note.slice(0, 500)
      if (typeof entry.at === 'string' && !Number.isNaN(new Date(entry.at).getTime())) next.at = entry.at
      clean[date] = next
    }
    if (Object.keys(clean).length) out[habitId] = clean
  }
  return out
}

/* ---------------- Routines ---------------- */

function coerceRoutine(raw, index, habitIds) {
  if (!raw || typeof raw !== 'object') return null
  const name = str(raw.name, 60)
  if (!name) return null
  const habitList = Array.isArray(raw.habitIds) ? raw.habitIds.filter((id) => habitIds.has(id)) : []
  return {
    id: isStr(raw.id) ? raw.id : uid(),
    name,
    kind: ROUTINE_KINDS.includes(raw.kind) ? raw.kind : 'custom',
    habitIds: habitList,
    active: raw.active !== false,
    order: int(raw.order, 0, 9999, index),
    createdAt: day(raw.createdAt),
  }
}

/* ---------------- Projects ---------------- */

function coerceTask(raw, index) {
  if (!raw || typeof raw !== 'object') return null
  const name = str(raw.name, 120)
  if (!name) return null
  const done = raw.done === true
  return {
    id: isStr(raw.id) ? raw.id : uid(),
    name,
    done,
    status: done ? 'done' : (TASK_STATUSES.includes(raw.status) ? raw.status : 'todo'),
    completedAt: done && typeof raw.completedAt === 'string' ? raw.completedAt : (done ? null : null),
    due: day(raw.due),
    priority: priority(raw.priority),
    estimateMin: int(raw.estimateMin, 1, 100000, null),
    actualMin: int(raw.actualMin, 0, 100000, null),
    category: str(raw.category, 40, null),
    notes: typeof raw.notes === 'string' ? raw.notes.slice(0, 1000) : '',
    order: int(raw.order, 0, 9999, index),
  }
}

function coerceMilestone(raw, index) {
  if (!raw || typeof raw !== 'object') return null
  const name = str(raw.name, 80, 'Milestone')
  return {
    id: isStr(raw.id) ? raw.id : uid(),
    name,
    due: day(raw.due),
    tasks: Array.isArray(raw.tasks) ? raw.tasks.map(coerceTask).filter(Boolean).slice(0, 200) : [],
    order: int(raw.order, 0, 9999, index),
  }
}

function coerceProgressLog(raw) {
  if (!Array.isArray(raw)) return []
  const out = []
  for (const e of raw.slice(-400)) {
    const at = typeof e?.at === 'string' ? e.at : (isValidDayStr(e?.date) ? e.date : null)
    const pctv = int(e?.pct, 0, 100, null)
    if (!at || pctv == null) continue
    out.push({ at, pct: pctv })
  }
  return out.sort((a, b) => String(a.at).localeCompare(String(b.at)))
}

function coerceProject(raw, index, habitIds) {
  if (!raw || typeof raw !== 'object') return null
  const name = str(raw.name, 90)
  if (!name) return null
  const createdAtDay = day(raw.createdAt) || day(raw.createdAtDay)
  const startDate = day(raw.startDate) || createdAtDay
  const milestones = Array.isArray(raw.milestones) ? raw.milestones.map(coerceMilestone).filter(Boolean).slice(0, 60) : []
  const tasks = milestones.flatMap((m) => m.tasks)
  const allDone = tasks.length > 0 && tasks.every((t) => t.done)
  return {
    id: isStr(raw.id) ? raw.id : uid(),
    name,
    description: str(raw.description, 600),
    category: str(raw.category, 40, 'General'),
    priority: priority(raw.priority),
    startDate,
    deadline: deadline(raw.deadline),
    milestones,
    linkedHabitIds: Array.isArray(raw.linkedHabitIds) ? raw.linkedHabitIds.filter((id) => habitIds.has(id)) : [],
    notes: typeof raw.notes === 'string' ? raw.notes.slice(0, 4000) : '',
    estimateMin: int(raw.estimateMin, 1, 1000000, null),
    actualMin: int(raw.actualMin, 0, 1000000, null),
    manualPercent: tasks.length ? null : int(raw.manualPercent, 0, 100, null),
    legacyPercent: int(raw.legacyPercent, 0, 100, null),
    progressLog: coerceProgressLog(raw.progressLog),
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : (createdAtDay || null),
    createdAtDay,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : isoLocal(),
    completedAt: allDone || typeof raw.completedAt === 'string' ? raw.completedAt : null,
    archived: raw.archived === true,
    order: int(raw.order, 0, 9999, index),
  }
}

/* ---------------- Assignments ---------------- */

function coerceSubtask(raw, index) {
  if (!raw || typeof raw !== 'object') return null
  const name = str(raw.name, 120)
  if (!name) return null
  const done = raw.done === true
  return {
    id: isStr(raw.id) ? raw.id : uid(),
    name,
    done,
    completedAt: done && typeof raw.completedAt === 'string' ? raw.completedAt : null,
    order: int(raw.order, 0, 9999, index),
  }
}

function coerceAssignment(raw, index, projectIds) {
  if (!raw || typeof raw !== 'object') return null
  const name = str(raw.name, 90)
  if (!name) return null
  const subtasks = Array.isArray(raw.subtasks) ? raw.subtasks.map(coerceSubtask).filter(Boolean).slice(0, 100) : []
  const progressMode = raw.progressMode === 'subtasks' && subtasks.length ? 'subtasks' : 'explicit'
  const derived = subtasks.length ? Math.round((subtasks.filter((s) => s.done).length / subtasks.length) * 100) : 0
  const pct = progressMode === 'subtasks' ? derived : pctInt(raw.progress, 0)
  return {
    id: isStr(raw.id) ? raw.id : uid(),
    name,
    subject: str(raw.subject, 60),
    description: str(raw.description, 600),
    priority: priority(raw.priority),
    assignedDate: day(raw.assignedDate) || day(raw.createdAt),
    deadline: deadline(raw.deadline),
    progress: pct,
    progressMode,
    subtasks,
    projectId: isStr(raw.projectId) && projectIds.has(raw.projectId) ? raw.projectId : null,
    notes: typeof raw.notes === 'string' ? raw.notes.slice(0, 4000) : '',
    estimateMin: int(raw.estimateMin, 1, 1000000, null),
    actualMin: int(raw.actualMin, 0, 1000000, null),
    progressLog: coerceProgressLog(raw.progressLog),
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : isoLocal(),
    createdAtDay: day(raw.createdAtDay) || day(raw.createdAt),
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : isoLocal(),
    completedAt: pct >= 100 ? (typeof raw.completedAt === 'string' ? raw.completedAt : isoLocal()) : null,
    archived: raw.archived === true,
    order: int(raw.order, 0, 9999, index),
  }
}

/* ---------------- Moods / profile ---------------- */

function coerceMoods(raw) {
  const out = {}
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out
  // Only a real 1..5 value is accepted; anything else is dropped rather than
  // silently rewritten into a number the user never chose.
  const scale = (v) => (Number.isInteger(v) && v >= 1 && v <= 5 ? v : null)
  for (const [date, entry] of Object.entries(raw)) {
    if (!isValidDayStr(date) || !entry || typeof entry !== 'object') continue
    let score = scale(entry.score)
    // v2 exports stored mood on a 1..10 scale — map honestly to 1..5
    if (score == null && Number.isFinite(entry.mood)) score = Math.max(1, Math.min(5, Math.round(entry.mood / 2)))
    const next = {}
    if (score != null) next.score = score
    for (const key of ['energy', 'focus', 'motivation']) {
      const v = scale(entry[key])
      if (v != null) next[key] = v
    }
    if (typeof entry.note === 'string' && entry.note.trim()) next.note = entry.note.slice(0, 500)
    if (typeof entry.wentWell === 'string' && entry.wentWell.trim()) next.wentWell = entry.wentWell.slice(0, 400)
    if (typeof entry.difficult === 'string' && entry.difficult.trim()) next.difficult = entry.difficult.slice(0, 400)
    if (Object.keys(next).length) out[date] = next
  }
  return out
}

function coerceProfile(raw) {
  const p = raw && typeof raw === 'object' ? raw : {}
  return {
    name: str(p.name, 40),
    onboarded: p.onboarded === true,
    theme: THEMES.includes(p.theme) ? p.theme : 'midnight',
    lastBackupExport: day(p.lastBackupExport),
    lastBackupReminder: day(p.lastBackupReminder),
    reminderNoteSeen: p.reminderNoteSeen === true,
    workReminders: p.workReminders !== false,
    workReminderHours: [12, 24, 48, 72].includes(Number(p.workReminderHours)) ? Number(p.workReminderHours) : 24,
  }
}

/* ---------------- Entry point ---------------- */

/** v2 stored projects as { habitId: { percent, milestones[] } }. */
function sourceProjectsFromLegacy(source, habits) {
  const legacy = source?.projects
  if (!legacy || typeof legacy !== 'object' || Array.isArray(legacy)) return []
  const out = []
  for (const [hid, p] of Object.entries(legacy)) {
    if (!p || typeof p !== 'object') continue
    const habit = habits.find((h) => h && h.id === hid)
    const name = habit?.name || (typeof p.name === 'string' ? p.name : null)
    if (!name) continue
    out.push({ name, legacyPercent: Number.isFinite(p.percent) ? p.percent : 0, milestones: [] })
  }
  return out
}

/**
 * Validate & normalize any parsed payload into the v4 shape.
 * Throws a human-readable Error when nothing recognizable is present.
 */
export function normalizeImport(parsed) {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('File is not valid JSON data.')
  }
  const source = parsed.app === 'aaru-habits' && parsed.data && typeof parsed.data === 'object' ? parsed.data : parsed

  const habits = (Array.isArray(source.habits) ? source.habits : []).map(coerceHabit).filter(Boolean)
  const habitIds = new Set(habits.map((h) => h.id))
  const projectsRaw = Array.isArray(source.projects) ? source.projects : sourceProjectsFromLegacy(source, habits)
  // NB: pass the id sets explicitly — Array#map would hand the coercers the
  // raw array as their third argument and cross-linking would crash.
  const projects = projectsRaw.map((raw, i) => coerceProject(raw, i, habitIds)).filter(Boolean)
  const projectIds = new Set(projects.map((p) => p.id))
  const assignments = (Array.isArray(source.assignments) ? source.assignments : [])
    .map((raw, i) => coerceAssignment(raw, i, projectIds))
    .filter(Boolean)
  const routines = (Array.isArray(source.routines) ? source.routines : []).map((r, i) => coerceRoutine(r, i, habitIds)).filter(Boolean)
  const checkins = coerceCheckins(source.checkins)
  const moods = coerceMoods(source.moods ?? source.mood ?? {})
  const profile = coerceProfile(source.profile)

  // Drop check-ins that reference an unknown habit; keep everything else intact.
  for (const key of Object.keys(checkins)) if (!habitIds.has(key)) delete checkins[key]

  // A well-formed but EMPTY state is valid (fresh user, or a post-reset backup).
  const emptyButWellFormed = Array.isArray(source.habits) && source.habits.length === 0
  if (!emptyButWellFormed && !habits.length && !projects.length && !assignments.length && !Object.keys(moods).length) {
    throw new Error('No habits, projects, assignments, or moods found in this file.')
  }

  return {
    version: 4,
    profile,
    habits,
    checkins,
    routines,
    projects: projects.map((p) => ({ ...p, linkedHabitIds: (p.linkedHabitIds || []).filter((id) => habitIds.has(id)) })),
    assignments: assignments.map((a) => ({ ...a, projectId: a.projectId && projectIds.has(a.projectId) ? a.projectId : null })),
    moods,
  }
}

export function exportPayload(state) {
  return {
    app: 'aaru-habits',
    version: 4,
    exportedAt: new Date().toISOString(),
    counts: {
      habits: (state.habits || []).length,
      projects: (state.projects || []).length,
      assignments: (state.assignments || []).length,
      routines: (state.routines || []).length,
      checkinDays: Object.values(state.checkins || {}).reduce((n, d) => n + Object.keys(d || {}).length, 0),
    },
    data: {
      version: 4,
      profile: state.profile,
      habits: state.habits,
      checkins: state.checkins,
      routines: state.routines,
      projects: state.projects,
      assignments: state.assignments,
      moods: state.moods,
    },
  }
}

export const EXPORT_VERSION = 4
export const todayStrRef = todayStr
