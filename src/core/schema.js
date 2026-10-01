/* ============================================================
   SCHEMA v5 — the model, deliberately small.

   v4 had five parallel entity systems (habits, projects,
   assignments, routines, goals) plus three behavioural logs that
   nothing read. v5 keeps four nouns:

     habit   — something you repeat
     work    — something you finish  (projects AND one-off tasks,
               one entity, one card, one detail screen)
     goal    — the outcome that habits + work ladder up to
     mood    — one daily reading of how it actually felt

   Migration from v4 is lossless for everything that was real and
   silently drops the things that were only ever scaffolding.
   ============================================================ */
import { isDay, dayOf, now, today } from './date.js'

export const VERSION = 5
export const STORAGE_KEY = 'aaru.os.v5'
export const LEGACY_KEYS = ['aaru.habits.v4', 'aaru.habits.v3', 'aaru.habit-tracker.v2']

export const uid = () =>
  Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)

/* ---- Enumerations ---------------------------------------- */

export const CATEGORIES = [
  { id: 'body',   label: 'Body',   icon: '💪' },
  { id: 'mind',   label: 'Mind',   icon: '🧠' },
  { id: 'craft',  label: 'Craft',  icon: '🛠' },
  { id: 'care',   label: 'Care',   icon: '🌿' },
  { id: 'social', label: 'Social', icon: '🤝' },
]
const CATEGORY_IDS = CATEGORIES.map((c) => c.id)

export const TARGET_TYPES = ['done', 'count', 'minutes']
export const CADENCE_TYPES = ['daily', 'days', 'weekly']
export const WORK_KINDS = ['project', 'task']

/* ---- Coercion helpers ------------------------------------ */

const str = (v, max = 120, fallback = '') => {
  const s = typeof v === 'string' ? v.trim() : ''
  return s ? s.slice(0, max) : fallback
}
const int = (v, min, max, fallback) => {
  const n = Math.round(Number(v))
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback
}
const bool = (v) => v === true
const dayOrNull = (v) => (isDay(v) ? v : null)
const momentOrNull = (v) => {
  if (typeof v !== 'string' || !v) return null
  if (isDay(v)) return v
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v) ? v.slice(0, 16) : null
}

/* ---- Factories ------------------------------------------- */

export function makeHabit(p = {}) {
  const type = TARGET_TYPES.includes(p.target?.type) ? p.target.type : 'done'
  return {
    id: str(p.id, 24) || uid(),
    name: str(p.name, 80, 'Untitled habit'),
    icon: str(p.icon, 4, '✦'),
    category: CATEGORY_IDS.includes(p.category) ? p.category : 'mind',
    target: {
      type,
      goal: type === 'done' ? 1 : int(p.target?.goal, 1, 9999, type === 'minutes' ? 30 : 8),
      unit: type === 'count' ? str(p.target?.unit, 16, 'times') : type === 'minutes' ? 'min' : '',
    },
    cadence: makeCadence(p.cadence),
    cue: str(p.cue, 90),
    notes: str(p.notes, 600),
    createdAt: dayOrNull(p.createdAt),
    archivedAt: dayOrNull(p.archivedAt),
    order: int(p.order, 0, 9999, 0),
  }
}

function makeCadence(c) {
  const type = CADENCE_TYPES.includes(c?.type) ? c.type : 'daily'
  if (type === 'days') {
    const days = Array.isArray(c.days)
      ? [...new Set(c.days.map((d) => int(d, 0, 6, null)).filter((d) => d != null))].sort()
      : []
    return days.length ? { type: 'days', days } : { type: 'daily' }
  }
  if (type === 'weekly') return { type: 'weekly', perWeek: int(c.perWeek, 1, 7, 3) }
  return { type: 'daily' }
}

export function makeWork(p = {}) {
  const kind = WORK_KINDS.includes(p.kind) ? p.kind : 'task'
  return {
    id: str(p.id, 24) || uid(),
    kind,
    title: str(p.title, 120, 'Untitled'),
    notes: str(p.notes, 2000),
    deadline: momentOrNull(p.deadline),
    startedAt: dayOrNull(p.startedAt),
    tasks: kind === 'project' && Array.isArray(p.tasks) ? p.tasks.map(makeSubtask).slice(0, 200) : [],
    manual: p.manual == null ? null : int(p.manual, 0, 100, null),
    goalId: str(p.goalId, 24) || null,
    log: Array.isArray(p.log) ? p.log.map(makeEntry).filter(Boolean).slice(-400) : [],
    createdAt: dayOrNull(p.createdAt),
    doneAt: momentOrNull(p.doneAt),
    archivedAt: dayOrNull(p.archivedAt),
    order: int(p.order, 0, 9999, 0),
  }
}

export function makeSubtask(p = {}) {
  return {
    id: str(p.id, 24) || uid(),
    title: str(p.title, 140, 'Task'),
    done: bool(p.done),
    due: dayOrNull(p.due),
    doneAt: momentOrNull(p.doneAt),
  }
}

function makeEntry(p = {}) {
  const at = momentOrNull(p.at)
  if (!at) return null
  const minutes = p.minutes == null ? null : int(p.minutes, 0, 1440, null)
  const percent = p.percent == null ? null : int(p.percent, 0, 100, null)
  if (minutes == null && percent == null) return null
  return { at, minutes, percent, note: str(p.note, 160) }
}

export function makeGoal(p = {}) {
  return {
    id: str(p.id, 24) || uid(),
    title: str(p.title, 100, 'Untitled goal'),
    why: str(p.why, 400),
    due: dayOrNull(p.due),
    habitIds: Array.isArray(p.habitIds) ? [...new Set(p.habitIds.filter((x) => typeof x === 'string'))].slice(0, 30) : [],
    createdAt: dayOrNull(p.createdAt),
    doneAt: dayOrNull(p.doneAt),
    order: int(p.order, 0, 9999, 0),
  }
}

export const DEFAULT_PROFILE = {
  name: '',
  onboarded: false,
  theme: 'midnight',
  motion: 'full',       // 'full' | 'calm'
  weekStart: 1,
  lastExport: null,
}

export function makeProfile(p = {}) {
  return {
    ...DEFAULT_PROFILE,
    name: str(p.name, 40),
    onboarded: bool(p.onboarded),
    theme: p.theme === 'daylight' ? 'daylight' : 'midnight',
    motion: p.motion === 'calm' ? 'calm' : 'full',
    weekStart: int(p.weekStart, 0, 1, 1),
    lastExport: momentOrNull(p.lastExport),
  }
}

export const emptyState = () => ({
  version: VERSION,
  profile: { ...DEFAULT_PROFILE },
  habits: [],
  checkins: {},   // habitId -> day -> { value, at }
  work: [],
  goals: [],
  moods: {},      // day -> { mood, energy, note }
})

/* ---- Normalisation (every load passes through here) ------ */

export function normalize(raw) {
  const base = emptyState()
  if (!raw || typeof raw !== 'object') return base

  const habits = Array.isArray(raw.habits) ? raw.habits.map(makeHabit) : []
  const habitIds = new Set(habits.map((h) => h.id))

  const checkins = {}
  if (raw.checkins && typeof raw.checkins === 'object') {
    for (const [hid, days] of Object.entries(raw.checkins)) {
      if (!habitIds.has(hid) || !days || typeof days !== 'object') continue
      const clean = {}
      for (const [d, c] of Object.entries(days)) {
        if (!isDay(d)) continue
        const value = int(c?.value ?? (c?.done ? 1 : 0), 0, 99999, 0)
        if (value <= 0) continue
        clean[d] = { value, at: momentOrNull(c?.at) }
      }
      if (Object.keys(clean).length) checkins[hid] = clean
    }
  }

  const goals = Array.isArray(raw.goals) ? raw.goals.map(makeGoal) : []
  const goalIds = new Set(goals.map((g) => g.id))
  for (const g of goals) g.habitIds = g.habitIds.filter((id) => habitIds.has(id))

  const work = (Array.isArray(raw.work) ? raw.work : []).map(makeWork)
  for (const w of work) if (w.goalId && !goalIds.has(w.goalId)) w.goalId = null

  const moods = {}
  if (raw.moods && typeof raw.moods === 'object') {
    for (const [d, m] of Object.entries(raw.moods)) {
      if (!isDay(d) || !m || typeof m !== 'object') continue
      const mood = int(m.mood, 1, 5, null)
      const energy = int(m.energy, 1, 5, null)
      if (mood == null && energy == null) continue
      moods[d] = { mood, energy, note: str(m.note, 200) }
    }
  }

  return {
    version: VERSION,
    profile: makeProfile(raw.profile),
    habits: reorder(habits),
    checkins,
    work: reorder(work),
    goals: reorder(goals),
    moods,
  }
}

const reorder = (list) =>
  [...list].sort((a, b) => a.order - b.order).map((x, i) => ({ ...x, order: i }))

/* ============================================================
   MIGRATION — v4 → v5.

   What carries over: habits (+ their real check-ins), projects,
   assignments, goals, moods, your name.
   What is dropped on purpose: routines (a wrapper around habits
   that added no data), signals/focusLog (behavioural telemetry
   nothing in the new UI reads), legacyPercent ghosts.
   ============================================================ */

export function migrate(raw) {
  if (!raw || typeof raw !== 'object') return emptyState()
  if (raw.version === VERSION) return normalize(raw)

  const out = emptyState()
  out.profile = makeProfile({
    name: raw.profile?.name,
    onboarded: raw.profile?.onboarded,
    theme: raw.profile?.theme === 'daylight' ? 'daylight' : 'midnight',
  })

  /* ---- Habits ---- */
  const legacyHabits = Array.isArray(raw.habits) ? raw.habits : []
  out.habits = legacyHabits.map((h, i) => {
    const t = h?.target
    const type = t?.type === 'count' || t?.unit === 'times' ? 'count'
      : t?.type === 'minutes' || t?.unit === 'min' ? 'minutes'
      : 'done'
    return makeHabit({
      id: h?.id,
      name: h?.name,
      icon: h?.icon || h?.emoji,
      category: mapCategory(h?.category),
      target: { type, goal: t?.goal ?? t?.target, unit: t?.unit },
      cadence: mapSchedule(h?.schedule),
      cue: h?.reminder?.time ? `at ${h.reminder.time}` : h?.cue,
      notes: h?.notes,
      createdAt: dayOrNull(h?.createdAt),
      archivedAt: h?.archived ? today() : null,
      order: i,
    })
  })

  const ids = new Set(out.habits.map((h) => h.id))
  if (raw.checkins && typeof raw.checkins === 'object') {
    for (const [hid, days] of Object.entries(raw.checkins)) {
      if (!ids.has(hid) || !days || typeof days !== 'object') continue
      const clean = {}
      for (const [d, c] of Object.entries(days)) {
        if (!isDay(d) || !c) continue
        const value = c.value != null ? int(c.value, 0, 99999, 0) : c.done === true ? 1 : 0
        if (value > 0) clean[d] = { value, at: momentOrNull(c.at) }
      }
      if (Object.keys(clean).length) out.checkins[hid] = clean
    }
  }

  /* ---- Goals (before work, so goalId links resolve) ---- */
  out.goals = (Array.isArray(raw.goals) ? raw.goals : []).map((g, i) =>
    makeGoal({
      id: g?.id,
      title: g?.title || g?.name,
      why: g?.why || g?.notes,
      due: dayOrNull(g?.due || g?.targetDate || g?.deadline),
      habitIds: (g?.habitIds || g?.habits || []).filter((x) => ids.has(x)),
      createdAt: dayOrNull(g?.createdAt),
      doneAt: dayOrNull(g?.completedAt || g?.doneAt),
      order: i,
    })
  )
  const goalIds = new Set(out.goals.map((g) => g.id))

  /* ---- Work: projects + assignments collapse into one list ---- */
  const work = []

  for (const p of Array.isArray(raw.projects) ? raw.projects : []) {
    if (!p || typeof p !== 'object') continue
    // v4 nested tasks under milestones; flatten, keeping the
    // milestone name as a prefix so no information is lost.
    const tasks = []
    for (const m of Array.isArray(p.milestones) ? p.milestones : []) {
      for (const t of Array.isArray(m?.tasks) ? m.tasks : []) {
        tasks.push(makeSubtask({
          id: t?.id,
          title: m?.name && String(m.name).toLowerCase() !== 'tasks' ? `${m.name} · ${t?.name || t?.title}` : (t?.name || t?.title),
          done: t?.done === true || t?.status === 'done',
          due: dayOrNull(t?.due),
        }))
      }
    }
    for (const t of Array.isArray(p.tasks) ? p.tasks : []) {
      tasks.push(makeSubtask({ id: t?.id, title: t?.name || t?.title, done: t?.done === true || t?.status === 'done', due: dayOrNull(t?.due) }))
    }
    work.push(makeWork({
      id: p.id,
      kind: 'project',
      title: p.name || p.title,
      notes: p.notes || p.description,
      deadline: momentOrNull(p.deadline || p.due || p.endDate),
      startedAt: dayOrNull(p.startDate || p.createdAt),
      tasks,
      manual: tasks.length ? null : int(p.legacyPercent ?? p.percent, 0, 100, null),
      goalId: goalIds.has(p.goalId) ? p.goalId : null,
      log: mapLog(p.entries || p.log),
      createdAt: dayOrNull(p.createdAt),
      doneAt: momentOrNull(p.completedAt || p.doneAt),
      order: work.length,
    }))
  }

  for (const a of Array.isArray(raw.assignments) ? raw.assignments : []) {
    if (!a || typeof a !== 'object') continue
    work.push(makeWork({
      id: a.id,
      kind: 'task',
      title: a.name || a.title,
      notes: a.notes || a.description,
      deadline: momentOrNull(a.deadline || a.due),
      startedAt: dayOrNull(a.createdAt),
      manual: int(a.percent ?? a.progress, 0, 100, null),
      goalId: goalIds.has(a.goalId) ? a.goalId : null,
      log: mapLog(a.entries || a.log),
      createdAt: dayOrNull(a.createdAt),
      doneAt: momentOrNull(a.completedAt || a.doneAt),
      order: work.length,
    }))
  }
  out.work = work

  /* ---- Moods: v4 stored 1–5 scores; energy is new and stays blank ---- */
  for (const [d, m] of Object.entries(raw.moods || {})) {
    if (!isDay(d) || !m) continue
    const mood = int(m.score ?? m.mood, 1, 5, null)
    const energy = int(m.energy ?? m.motivation, 1, 5, null)
    if (mood == null && energy == null) continue
    out.moods[d] = { mood, energy, note: str(m.note, 200) }
  }

  return normalize(out)
}

function mapLog(entries) {
  if (!Array.isArray(entries)) return []
  return entries
    .map((e) => ({
      at: momentOrNull(e?.at || e?.date || e?.loggedAt),
      percent: e?.percent == null ? null : int(e.percent, 0, 100, null),
      minutes: e?.minutes == null ? null : int(e.minutes ?? e.time, 0, 1440, null),
      note: str(e?.note, 160),
    }))
    .filter((e) => e.at && (e.percent != null || e.minutes != null))
}

/* v4 stored half a dozen schedule shapes depending on which
   generation of the old UI wrote the record. Fold them all into
   the three cadences v5 understands, and fall back to daily — the
   only choice that can't silently hide a habit from the user. */
function mapSchedule(s) {
  if (!s || typeof s !== 'object') return { type: 'daily' }
  const kind = String(s.type || s.kind || '').toLowerCase()

  const days = (s.days || s.weekdays || s.on || [])
    .map((d) => (typeof d === 'number' ? d : WEEKDAY_NAMES.indexOf(String(d).slice(0, 3).toLowerCase())))
    .filter((d) => d >= 0 && d <= 6)

  if (kind === 'days' || kind === 'specific' || (kind === 'weekly' && days.length)) {
    return days.length ? { type: 'days', days: [...new Set(days)].sort() } : { type: 'daily' }
  }
  const per = s.perWeek ?? s.count ?? s.times ?? s.target
  if (kind === 'times' || kind === 'weekly' || kind === 'flexible' || per != null) {
    return { type: 'weekly', perWeek: int(per, 1, 7, 3) }
  }
  return { type: 'daily' }
}

const WEEKDAY_NAMES = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

function mapCategory(c) {
  const map = {
    fitness: 'body', health: 'body', body: 'body', sport: 'body',
    mind: 'mind', learning: 'mind', study: 'mind', focus: 'mind',
    creative: 'craft', work: 'craft', craft: 'craft',
    care: 'care', selfcare: 'care', wellness: 'care', sleep: 'care',
    social: 'social', relationships: 'social',
  }
  return map[String(c || '').toLowerCase()] || 'mind'
}

/* ---- Import / export ------------------------------------- */

export function exportState(state) {
  return JSON.stringify({ ...state, exportedAt: now(), app: 'aaru-os' }, null, 2)
}

export function importState(text) {
  let raw
  try { raw = JSON.parse(text) } catch { throw new Error('That file is not valid JSON.') }
  if (!raw || typeof raw !== 'object') throw new Error('That file does not contain a backup.')
  const next = raw.version === VERSION ? normalize(raw) : migrate(raw)
  if (!next.habits.length && !next.work.length && !next.goals.length && !Object.keys(next.moods).length) {
    throw new Error('That backup is empty — nothing to import.')
  }
  return next
}

export { dayOf }
