/* ============================================================
   STORE — single source of truth, persisted to localStorage.
   Schema v3: categories, weekday schedules, reminders, notes,
   archive, projects (milestones → tasks), moods, themes.
   Migrates v2 data honestly (no invented history).
   ============================================================ */
import { createContext, useContext, useEffect, useMemo, useReducer } from 'react'
import { todayStr } from './lib/dates.js'
import { normalizeImport } from './lib/importExport.js'

const STORAGE_KEY = 'aaru.habits.v3'
const LEGACY_KEY_V2 = 'aaru.habit-tracker.v2'

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-3)

export const emptyState = () => ({
  version: 3,
  profile: {
    name: '',
    onboarded: false,
    theme: 'midnight',
    lastBackupExport: null,
    lastBackupReminder: null,
    reminderNoteSeen: false,
  },
  habits: [],
  checkins: {},
  projects: [],
  moods: {},
})

/* ---------------- Migration (v2 → v3) ---------------- */

function migrateV2(old) {
  const base = emptyState()
  if (!old || typeof old !== 'object' || !Array.isArray(old.habits)) return base

  const habits = []
  const checkins = {}
  for (const h of old.habits) {
    if (!h || typeof h !== 'object' || !h.name) continue
    const id = typeof h.id === 'string' ? h.id : uid()
    habits.push({
      id,
      name: String(h.name).slice(0, 80),
      category: 'mind',
      schedule: { type: 'daily' },
      reminder: null,
      notes: '',
      createdAt: null,
      archived: false,
      order: habits.length,
    })
    const days = old.checkins?.[id]
    if (days && typeof days === 'object') {
      const clean = {}
      for (const [date, c] of Object.entries(days)) {
        if (c && typeof c === 'object' && c.done === true) clean[date] = { done: true }
      }
      if (Object.keys(clean).length) checkins[id] = clean
    }
  }

  // v2 moods were { date: { mood: 1-10, motivation: 1-10 } } → map to 1..5
  const moods = {}
  const oldMood = old.mood || {}
  for (const [date, entry] of Object.entries(oldMood)) {
    if (!entry || typeof entry !== 'object') continue
    const v = Number.isFinite(entry.mood) ? entry.mood : null
    if (v == null) continue
    const score = Math.max(1, Math.min(5, Math.round(v / 2)))
    moods[date] = { score }
  }

  // v2 projects: { habitId: { percent } } → legacy progress projects
  const projects = []
  const oldProjects = old.projects || {}
  for (const [hid, p] of Object.entries(oldProjects)) {
    const habit = habits.find((x) => x.id === hid)
    if (!habit || !p || !Number.isFinite(p.percent)) continue
    projects.push({
      id: uid(),
      name: habit.name,
      milestones: [],
      legacyPercent: Math.max(0, Math.min(100, Math.round(p.percent))),
      createdAt: null,
      completedAt: null,
      order: projects.length,
    })
  }

  const name = old.profile?.name && old.profile.name !== 'Aaru' ? String(old.profile.name).slice(0, 40) : ''
  return {
    ...base,
    profile: { ...base.profile, name, onboarded: true },
    habits,
    checkins,
    projects,
    moods,
  }
}

/* ---------------- Load ---------------- */

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      const clean = normalizeImport(parsed)
      // preserve onboarding state for existing users
      return clean
    }
  } catch { /* fall through to legacy */ }

  try {
    const legacy = localStorage.getItem(LEGACY_KEY_V2)
    if (legacy) {
      const migrated = migrateV2(JSON.parse(legacy))
      if (migrated.habits.length || migrated.projects.length) return migrated
    }
  } catch { /* ignore */ }

  return emptyState()
}

/* ---------------- Reducer ---------------- */

function reducer(state, action) {
  switch (action.type) {
    case 'ADD_HABIT': {
      const habit = {
        id: uid(),
        category: 'mind',
        schedule: { type: 'daily' },
        reminder: null,
        notes: '',
        createdAt: todayStr(),
        archived: false,
        order: state.habits.length,
        ...action.habit,
      }
      return { ...state, habits: [...state.habits, habit] }
    }
    case 'UPDATE_HABIT':
      return {
        ...state,
        habits: state.habits.map((h) => (h.id === action.id ? { ...h, ...action.patch } : h)),
      }
    case 'DELETE_HABIT': {
      const habits = state.habits.filter((h) => h.id !== action.id)
      const checkins = { ...state.checkins }
      delete checkins[action.id]
      return { ...state, habits, checkins }
    }
    case 'RESTORE_HABIT': {
      // undo support — puts habit + its checkins back
      return {
        ...state,
        habits: [...state.habits, action.habit],
        checkins: { ...state.checkins, [action.habit.id]: action.checkins || {} },
      }
    }
    case 'REORDER_HABITS': {
      // action.order = array of habit ids in their new sequence
      const pos = new Map(action.order.map((id, i) => [id, i]))
      const habits = [...state.habits].sort(
        (a, b) => (pos.get(a.id) ?? a.order ?? 0) - (pos.get(b.id) ?? b.order ?? 0)
      )
      return { ...state, habits: habits.map((h, i) => ({ ...h, order: i })) }
    }
    case 'TOGGLE_CHECKIN': {
      const days = { ...(state.checkins[action.habitId] || {}) }
      const prev = days[action.date] || {}
      days[action.date] = { ...prev, done: !prev.done }
      if (!days[action.date].done && !days[action.date].note) delete days[action.date]
      return { ...state, checkins: { ...state.checkins, [action.habitId]: days } }
    }
    case 'SET_CHECKIN_NOTE': {
      const days = { ...(state.checkins[action.habitId] || {}) }
      const prev = days[action.date] || {}
      const next = { ...prev, note: action.note }
      if (!next.done && !next.note) delete days[action.date]
      else days[action.date] = next
      return { ...state, checkins: { ...state.checkins, [action.habitId]: days } }
    }
    case 'ADD_PROJECT': {
      const project = {
        id: uid(),
        milestones: [],
        createdAt: todayStr(),
        completedAt: null,
        legacyPercent: null,
        order: state.projects.length,
        ...action.project,
      }
      return { ...state, projects: [...state.projects, project] }
    }
    case 'UPDATE_PROJECT':
      return {
        ...state,
        projects: state.projects.map((p) => (p.id === action.id ? { ...p, ...action.patch } : p)),
      }
    case 'DELETE_PROJECT':
      return { ...state, projects: state.projects.filter((p) => p.id !== action.id) }
    case 'RESTORE_PROJECT':
      return { ...state, projects: [...state.projects, action.project] }
    case 'ADD_MILESTONE':
      return {
        ...state,
        projects: state.projects.map((p) =>
          p.id === action.projectId
            ? { ...p, milestones: [...p.milestones, { id: uid(), name: action.name, tasks: [] }] }
            : p
        ),
      }
    case 'UPDATE_MILESTONE':
      return {
        ...state,
        projects: state.projects.map((p) =>
          p.id === action.projectId
            ? { ...p, milestones: p.milestones.map((m) => (m.id === action.milestoneId ? { ...m, ...action.patch } : m)) }
            : p
        ),
      }
    case 'DELETE_MILESTONE':
      return {
        ...state,
        projects: state.projects.map((p) =>
          p.id === action.projectId ? { ...p, milestones: p.milestones.filter((m) => m.id !== action.milestoneId) } : p
        ),
      }
    case 'ADD_TASK':
      return {
        ...state,
        projects: state.projects.map((p) =>
          p.id === action.projectId
            ? {
                ...p,
                milestones: p.milestones.map((m) =>
                  m.id === action.milestoneId ? { ...m, tasks: [...m.tasks, { id: uid(), name: action.name, done: false }] } : m
                ),
              }
            : p
        ),
      }
    case 'TOGGLE_TASK':
      return {
        ...state,
        projects: state.projects.map((p) => {
          if (p.id !== action.projectId) return p
          let becameComplete = false
          const milestones = p.milestones.map((m) => {
            if (m.id !== action.milestoneId) return m
            return { ...m, tasks: m.tasks.map((t) => (t.id === action.taskId ? { ...t, done: !t.done } : t)) }
          })
          const total = milestones.reduce((n, m) => n + m.tasks.length, 0)
          const done = milestones.reduce((n, m) => n + m.tasks.filter((t) => t.done).length, 0)
          if (total > 0 && done === total && !p.completedAt) becameComplete = true
          return { ...p, milestones, completedAt: becameComplete ? new Date().toISOString() : p.completedAt ? checkStillComplete(milestones, p) : null }
        }),
      }
    case 'DELETE_TASK':
      return {
        ...state,
        projects: state.projects.map((p) =>
          p.id === action.projectId
            ? { ...p, milestones: p.milestones.map((m) => (m.id === action.milestoneId ? { ...m, tasks: m.tasks.filter((t) => t.id !== action.taskId) } : m)) }
            : p
        ),
      }
    case 'SET_MOOD': {
      const moods = { ...state.moods }
      if (action.patch == null) delete moods[action.date]
      else moods[action.date] = { ...moods[action.date], ...action.patch }
      return { ...state, moods }
    }
    case 'SET_PROFILE':
      return { ...state, profile: { ...state.profile, ...action.patch } }
    case 'IMPORT_DATA': {
      // A partial/raw import may lack profile info — keep the current
      // session's identity/onboarding state rather than kicking the user
      // back to onboarding mid-session.
      const incoming = action.data
      const profile = {
        ...state.profile,
        ...incoming.profile,
        onboarded: incoming.profile?.onboarded === true || state.profile.onboarded,
        name: incoming.profile?.name || state.profile.name,
      }
      return { ...incoming, profile }
    }
    case 'RESET_ALL':
      return { ...emptyState(), profile: { ...emptyState().profile, name: state.profile.name } }
    default:
      return state
  }
}

function checkStillComplete(milestones, project) {
  const total = milestones.reduce((n, m) => n + m.tasks.length, 0)
  const done = milestones.reduce((n, m) => n + m.tasks.filter((t) => t.done).length, 0)
  if (total > 0 && done === total) return project.completedAt
  return null
}

/* ---------------- Context ---------------- */

const StoreContext = createContext(null)

export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadState)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch { /* quota — non-fatal */ }
  }, [state])

  // Apply theme to <html> whenever it changes
  useEffect(() => {
    const theme = state.profile?.theme || 'midnight'
    document.documentElement.setAttribute('data-theme', theme)
    const meta = document.querySelector('meta[name="theme-color"]')
    const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim()
    if (meta && bg) meta.setAttribute('content', bg)
  }, [state.profile?.theme])

  const value = useMemo(() => ({ state, dispatch }), [state])
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used within StoreProvider')
  return ctx
}
