/* Import validation — defensive against malformed / foreign / older JSON. */
import { isValidDayStr } from './dates.js'

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-3)

const CATEGORIES = ['fitness', 'mind', 'learning', 'health', 'creative', 'social']
const isStr = (v) => typeof v === 'string' && v.trim().length > 0
const isHHMM = (v) => typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v)

function coerceHabit(raw, index) {
  if (!raw || typeof raw !== 'object') return null
  const name = isStr(raw.name) ? raw.name.trim().slice(0, 80) : null
  if (!name) return null
  const category = CATEGORIES.includes(raw.category) ? raw.category : 'mind'
  let schedule = { type: 'daily' }
  if (raw.schedule && raw.schedule.type === 'weekdays' && Array.isArray(raw.schedule.days)) {
    const days = [...new Set(raw.schedule.days.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))]
    if (days.length) schedule = { type: 'weekdays', days }
  }
  return {
    id: isStr(raw.id) ? raw.id : uid(),
    name,
    category,
    schedule,
    reminder: isHHMM(raw.reminder) ? raw.reminder : null,
    notes: typeof raw.notes === 'string' ? raw.notes.slice(0, 2000) : '',
    createdAt: isValidDayStr(raw.createdAt) ? raw.createdAt : null,
    archived: raw.archived === true,
    order: Number.isFinite(raw.order) ? raw.order : index,
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
      clean[date] = {
        done: entry.done === true,
        ...(typeof entry.note === 'string' && entry.note.trim() ? { note: entry.note.slice(0, 500) } : {}),
      }
    }
    if (Object.keys(clean).length) out[habitId] = clean
  }
  return out
}

function coerceProject(raw, index) {
  if (!raw || typeof raw !== 'object') return null
  const name = isStr(raw.name) ? raw.name.trim().slice(0, 80) : null
  if (!name) return null
  const milestones = Array.isArray(raw.milestones)
    ? raw.milestones.slice(0, 50).map((m) => ({
        id: isStr(m?.id) ? m.id : uid(),
        name: isStr(m?.name) ? m.name.trim().slice(0, 80) : 'Milestone',
        tasks: Array.isArray(m?.tasks)
          ? m.tasks.slice(0, 100).map((t) => ({
              id: isStr(t?.id) ? t.id : uid(),
              name: isStr(t?.name) ? t.name.trim().slice(0, 120) : 'Task',
              done: t?.done === true,
            }))
          : [],
      }))
    : []
  return {
    id: isStr(raw.id) ? raw.id : uid(),
    name,
    milestones,
    createdAt: isStr(raw.createdAt) ? raw.createdAt : null,
    completedAt: isStr(raw.completedAt) ? raw.completedAt : null,
    legacyPercent: Number.isFinite(raw.legacyPercent) ? Math.max(0, Math.min(100, Math.round(raw.legacyPercent))) : null,
    order: Number.isFinite(raw.order) ? raw.order : index,
  }
}

function coerceMoods(raw) {
  const out = {}
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out
  for (const [date, entry] of Object.entries(raw)) {
    if (!isValidDayStr(date) || !entry || typeof entry !== 'object') continue
    let score = Number.isInteger(entry.score) && entry.score >= 1 && entry.score <= 5 ? entry.score : null
    // v2 exports stored { mood: 1..10 } — map honestly to the 1..5 scale
    if (score == null && Number.isFinite(entry.mood)) {
      score = Math.max(1, Math.min(5, Math.round(entry.mood / 2)))
    }
    if (score == null) continue
    out[date] = { score, ...(typeof entry.note === 'string' && entry.note.trim() ? { note: entry.note.slice(0, 500) } : {}) }
  }
  return out
}

function coerceProfile(raw) {
  const p = raw && typeof raw === 'object' ? raw : {}
  return {
    name: isStr(p.name) ? p.name.trim().slice(0, 40) : '',
    onboarded: p.onboarded === true,
    theme: ['midnight', 'ember', 'verdant', 'daylight'].includes(p.theme) ? p.theme : 'midnight',
    lastBackupExport: isValidDayStr(p.lastBackupExport) ? p.lastBackupExport : null,
    lastBackupReminder: isValidDayStr(p.lastBackupReminder) ? p.lastBackupReminder : null,
    reminderNoteSeen: p.reminderNoteSeen === true,
  }
}

/**
 * Validate & normalize any parsed import payload.
 * Accepts: current export format { app, version, data } and raw state objects.
 * Throws Error with a human message when the file has no recognizable data.
 */
export function normalizeImport(parsed) {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('File is not valid JSON data.')
  }

  // Current export format
  const source = parsed.app === 'aaru-habits' && parsed.data && typeof parsed.data === 'object' ? parsed.data : parsed

  const habits = Array.isArray(source.habits) ? source.habits.map(coerceHabit) : []
  const validHabits = habits.filter(Boolean)
  const projectsRaw = Array.isArray(source.projects) ? source.projects : sourceProjectsFromLegacy(source)
  const projects = projectsRaw.map(coerceProject).filter(Boolean)
  const checkins = coerceCheckins(source.checkins)
  const moods = coerceMoods(source.moods ?? source.mood ?? {})
  const profile = coerceProfile(source.profile)

  // Drop checkins that reference no known habit (keep the rest intact)
  const ids = new Set(validHabits.map((h) => h.id))
  for (const key of Object.keys(checkins)) if (!ids.has(key)) delete checkins[key]

  // A well-formed but EMPTY state is valid — e.g. a fresh user who finished
  // onboarding without adding habits, or a post-reset backup re-imported.
  // Without this, loadState() would reject the stored state and kick that
  // user back into onboarding on every reload. Files with no recognizable
  // data at all still throw.
  const emptyButWellFormed = Array.isArray(source.habits) && source.habits.length === 0
  if (!emptyButWellFormed && !validHabits.length && !projects.length && !Object.keys(moods).length) {
    throw new Error('No habits, projects, or moods found in this file.')
  }

  return {
    version: 3,
    profile,
    habits: validHabits,
    checkins,
    projects,
    moods,
  }
}

/** Old v2 format stored projects as { habitId: { percent, milestones[] } }. */
function sourceProjectsFromLegacy(source) {
  const legacy = source?.projects
  if (!legacy || typeof legacy !== 'object' || Array.isArray(legacy)) return []
  const out = []
  for (const [hid, p] of Object.entries(legacy)) {
    if (!p || typeof p !== 'object') continue
    const habit = Array.isArray(source.habits) ? source.habits.find((h) => h && h.id === hid) : null
    const name = habit?.name || (typeof p.name === 'string' ? p.name : null)
    if (!name) continue
    out.push({ name, legacyPercent: Number.isFinite(p.percent) ? p.percent : 0, milestones: [] })
  }
  return out
}

export function exportPayload(state) {
  return {
    app: 'aaru-habits',
    version: 3,
    exportedAt: new Date().toISOString(),
    data: {
      version: 3,
      profile: state.profile,
      habits: state.habits,
      checkins: state.checkins,
      projects: state.projects,
      moods: state.moods,
    },
  }
}
