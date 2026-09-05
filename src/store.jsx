/* ============================================================
   STORE — single source of truth, persisted to localStorage.

   Schema v4 adds the WORK system (projects with dates, tasks with
   statuses/due dates, assignments with hour-precise deadlines) and
   routines (habit stacking). v3 and v2 data migrate honestly: no
   invented history, no fabricated deadlines, no fake progress.
   ============================================================ */
import { createContext, useContext, useEffect, useMemo, useReducer } from 'react'
import { todayStr, isoLocal, dayOf, isValidDayStr } from './lib/dates.js'
import { normalizeImport } from './lib/importExport.js'
import { projectProgress, assignmentProgress, allTasks } from './lib/work.js'

export const STORAGE_KEY = 'aaru.habits.v4'
const LEGACY_KEYS = ['aaru.habits.v3', 'aaru.habit-tracker.v2']

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-3)
export const newId = uid

export const emptyState = () => ({
  version: 4,
  profile: {
    name: '',
    onboarded: false,
    theme: 'midnight',
    lastBackupExport: null,
    lastBackupReminder: null,
    reminderNoteSeen: false,
    workReminders: true,
    workReminderHours: 24,
  },
  habits: [],
  checkins: {},
  routines: [],
  projects: [],
  assignments: [],
  moods: {},
})

/* ---------------- Migrations ---------------- */

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

  const moods = {}
  for (const [date, entry] of Object.entries(old.mood || {})) {
    if (!entry || typeof entry !== 'object') continue
    const v = Number.isFinite(entry.mood) ? entry.mood : null
    if (v == null) continue
    moods[date] = { score: Math.max(1, Math.min(5, Math.round(v / 2))) }
  }

  const projects = []
  for (const [hid, p] of Object.entries(old.projects || {})) {
    const habit = habits.find((x) => x.id === hid)
    if (!habit || !p || !Number.isFinite(p.percent)) continue
    projects.push({
      ...baseProject({ name: habit.name }),
      legacyPercent: Math.max(0, Math.min(100, Math.round(p.percent))),
      order: projects.length,
    })
  }

  const name = old.profile?.name && old.profile.name !== 'Aaru' ? String(old.profile.name).slice(0, 40) : ''
  return { ...base, profile: { ...base.profile, name, onboarded: true }, habits, checkins, projects, moods }
}

/** v3 → v4: keep everything, add the work fields we now track. */
function migrateV3(old) {
  const base = emptyState()
  if (!old || typeof old !== 'object') return base
  const projects = Array.isArray(old.projects)
    ? old.projects.map((p, i) => ({
        ...baseProject({ name: p?.name || 'Project' }),
        ...p,
        id: typeof p?.id === 'string' ? p.id : uid(),
        milestones: Array.isArray(p?.milestones) ? p.milestones.map((m) => ({
          id: typeof m?.id === 'string' ? m.id : uid(),
          name: String(m?.name || 'Milestone').slice(0, 80),
          due: isValidDayStr(m?.due) ? m.due : null,
          tasks: Array.isArray(m?.tasks) ? m.tasks.map((t, ti) => ({
            id: typeof t?.id === 'string' ? t.id : uid(),
            name: String(t?.name || 'Task').slice(0, 120),
            done: t?.done === true,
            status: t?.done ? 'done' : 'todo',
            completedAt: t?.done && t?.completedAt ? t.completedAt : t?.done ? null : null,
            due: isValidDayStr(t?.due) ? t.due : null,
            priority: ['low', 'normal', 'high'].includes(t?.priority) ? t.priority : 'normal',
            estimateMin: Number.isFinite(t?.estimateMin) ? t.estimateMin : null,
            actualMin: Number.isFinite(t?.actualMin) ? t.actualMin : null,
            notes: typeof t?.notes === 'string' ? t.notes.slice(0, 1000) : '',
            order: Number.isFinite(t?.order) ? t.order : ti,
          })) : [],
        })) : [],
        // A v3 project has no dates. Use its real creation day as the start
        // (that IS when work began) and leave the deadline unset rather than
        // inventing one.
        startDate: isValidDayStr(p?.startDate) ? p.startDate : (isValidDayStr(p?.createdAt) ? p.createdAt : null),
        deadline: p?.deadline || null,
        progressLog: Array.isArray(p?.progressLog) ? p.progressLog : [],
        order: Number.isFinite(p?.order) ? p.order : i,
      }))
    : []
  return {
    ...base,
    profile: { ...base.profile, ...(old.profile || {}) },
    habits: Array.isArray(old.habits) ? old.habits : [],
    checkins: old.checkins && typeof old.checkins === 'object' ? old.checkins : {},
    routines: Array.isArray(old.routines) ? old.routines : [],
    projects,
    assignments: Array.isArray(old.assignments) ? old.assignments : [],
    moods: old.moods && typeof old.moods === 'object' ? old.moods : {},
  }
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return normalizeImport(JSON.parse(raw))
  } catch { /* fall through to legacy */ }

  for (const key of LEGACY_KEYS) {
    try {
      const raw = localStorage.getItem(key)
      if (!raw) continue
      const parsed = JSON.parse(raw)
      const migrated = key === 'aaru.habits.v3' ? migrateV3(parsed) : migrateV2(parsed)
      const hasData = migrated.habits.length || migrated.projects.length || migrated.assignments.length || Object.keys(migrated.moods).length
      if (migrated.profile.onboarded || hasData) return migrated
    } catch { /* keep looking */ }
  }

  return emptyState()
}

/* ---------------- Factories ---------------- */

export function baseProject(p = {}) {
  return {
    id: uid(),
    name: '',
    description: '',
    category: 'General',
    priority: 'normal',
    startDate: todayStr(),
    deadline: null,
    milestones: [],
    linkedHabitIds: [],
    notes: '',
    estimateMin: null,
    actualMin: null,
    manualPercent: null,
    legacyPercent: null,
    progressLog: [],
    createdAt: isoLocal(),
    createdAtDay: todayStr(),
    updatedAt: isoLocal(),
    completedAt: null,
    archived: false,
    order: 0,
    ...p,
  }
}

export function baseAssignment(a = {}) {
  return {
    id: uid(),
    name: '',
    subject: '',
    description: '',
    priority: 'normal',
    assignedDate: todayStr(),
    deadline: null,
    progress: 0,
    progressMode: 'explicit',
    subtasks: [],
    projectId: null,
    notes: '',
    estimateMin: null,
    actualMin: null,
    progressLog: [],
    createdAt: isoLocal(),
    createdAtDay: todayStr(),
    updatedAt: isoLocal(),
    completedAt: null,
    archived: false,
    order: 0,
    ...a,
  }
}

export function baseRoutine(r = {}) {
  return {
    id: uid(),
    name: '',
    kind: 'custom',
    habitIds: [],
    active: true,
    order: 0,
    createdAt: todayStr(),
    ...r,
  }
}

/* ---------------- Progress log helpers ---------------- */

const MAX_LOG = 400

/** Append a real progress point when the derived percent actually changed. */
function logProgress(item, pct, now = isoLocal()) {
  const log = Array.isArray(item.progressLog) ? item.progressLog : []
  const last = log[log.length - 1]
  if (last && last.pct === pct && dayOf(last.at) === dayOf(now)) return log
  return [...log, { at: now, pct }].slice(-MAX_LOG)
}

/** Recompute completion + log for a project after any mutation. */
function settleProject(project, now = isoLocal()) {
  const tasks = allTasks(project)
  const pct = tasks.length ? projectProgress(project).pct : (project.manualPercent ?? project.legacyPercent ?? 0)
  const complete = tasks.length > 0 && tasks.every((t) => t.done)
  return {
    ...project,
    updatedAt: now,
    completedAt: complete ? (project.completedAt || now) : null,
    progressLog: logProgress(project, Math.max(0, Math.min(100, Math.round(pct))), now),
  }
}

function settleAssignment(assignment, now = isoLocal()) {
  const { pct } = assignmentProgress(assignment)
  return {
    ...assignment,
    updatedAt: now,
    completedAt: pct >= 100 ? (assignment.completedAt || now) : null,
    progressLog: logProgress(assignment, pct, now),
  }
}

const mapProject = (state, id, fn) => ({
  ...state,
  projects: state.projects.map((p) => (p.id === id ? fn(p) : p)),
})
const mapAssignment = (state, id, fn) => ({
  ...state,
  assignments: state.assignments.map((a) => (a.id === id ? fn(a) : a)),
})
const inMilestone = (project, milestoneId, fn) => ({
  ...project,
  milestones: project.milestones.map((m) => (m.id === milestoneId ? fn(m) : m)),
})

/* ---------------- Reducer ---------------- */

function reducer(state, action) {
  switch (action.type) {
    /* ---- habits ---- */
    case 'ADD_HABIT': {
      const habit = {
        id: uid(),
        category: 'mind',
        schedule: { type: 'daily' },
        reminder: null,
        notes: '',
        createdAt: todayStr(),
        archived: false,
        pause: null,
        skips: [],
        order: state.habits.length,
        ...action.habit,
      }
      return { ...state, habits: [...state.habits, habit] }
    }
    case 'UPDATE_HABIT':
      return { ...state, habits: state.habits.map((h) => (h.id === action.id ? { ...h, ...action.patch } : h)) }
    case 'DELETE_HABIT': {
      const habits = state.habits.filter((h) => h.id !== action.id)
      const checkins = { ...state.checkins }
      delete checkins[action.id]
      const routines = state.routines.map((r) => ({ ...r, habitIds: r.habitIds.filter((id) => id !== action.id) }))
      const projects = state.projects.map((p) => ({ ...p, linkedHabitIds: (p.linkedHabitIds || []).filter((id) => id !== action.id) }))
      return { ...state, habits, checkins, routines, projects }
    }
    case 'RESTORE_HABIT':
      return {
        ...state,
        habits: [...state.habits, action.habit],
        checkins: { ...state.checkins, [action.habit.id]: action.checkins || {} },
      }
    case 'REORDER_HABITS': {
      const pos = new Map(action.order.map((id, i) => [id, i]))
      const habits = [...state.habits].sort((a, b) => (pos.get(a.id) ?? a.order ?? 0) - (pos.get(b.id) ?? b.order ?? 0))
      return { ...state, habits: habits.map((h, i) => ({ ...h, order: i })) }
    }
    case 'PAUSE_HABIT': {
      // action.until: 'yyyy-MM-dd' | null (null = pause indefinitely)
      const patch = action.from ? { pause: { from: action.from, until: action.until || null } } : { pause: null }
      return { ...state, habits: state.habits.map((h) => (h.id === action.id ? { ...h, ...patch } : h)) }
    }
    case 'SKIP_DAY': {
      return {
        ...state,
        habits: state.habits.map((h) => {
          if (h.id !== action.id) return h
          const skips = h.skips || []
          const next = skips.includes(action.date) ? skips.filter((d) => d !== action.date) : [...skips, action.date]
          return { ...h, skips: next }
        }),
      }
    }
    case 'TOGGLE_CHECKIN': {
      const days = { ...(state.checkins[action.habitId] || {}) }
      const prev = days[action.date] || {}
      const done = !prev.done
      const next = { ...prev, done }
      // Real completion time is only knowable when it happens today.
      if (done && action.date === todayStr() && !prev.at) next.at = isoLocal()
      if (!done) delete next.at
      if (!next.done && !next.note) delete days[action.date]
      else days[action.date] = next
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

    /* ---- routines (habit stacking) ---- */
    case 'ADD_ROUTINE':
      return { ...state, routines: [...state.routines, baseRoutine({ order: state.routines.length, ...action.routine })] }
    case 'UPDATE_ROUTINE':
      return { ...state, routines: state.routines.map((r) => (r.id === action.id ? { ...r, ...action.patch } : r)) }
    case 'DELETE_ROUTINE':
      return { ...state, routines: state.routines.filter((r) => r.id !== action.id) }
    case 'RESTORE_ROUTINE':
      return { ...state, routines: [...state.routines, action.routine] }
    case 'REORDER_ROUTINES': {
      const pos = new Map(action.order.map((id, i) => [id, i]))
      const routines = [...state.routines].sort((a, b) => (pos.get(a.id) ?? a.order ?? 0) - (pos.get(b.id) ?? b.order ?? 0))
      return { ...state, routines: routines.map((r, i) => ({ ...r, order: i })) }
    }

    /* ---- projects ---- */
    case 'ADD_PROJECT': {
      const project = baseProject({ order: state.projects.length, ...action.project })
      return { ...state, projects: [...state.projects, settleProject(project)] }
    }
    case 'UPDATE_PROJECT':
      return mapProject(state, action.id, (p) => settleProject({ ...p, ...action.patch }))
    case 'DELETE_PROJECT':
      return {
        ...state,
        projects: state.projects.filter((p) => p.id !== action.id),
        // assignments may point at a project — never leave a dangling link
        assignments: state.assignments.map((a) => (a.projectId === action.id ? { ...a, projectId: null } : a)),
      }
    case 'RESTORE_PROJECT':
      return { ...state, projects: [...state.projects, action.project] }
    case 'REORDER_PROJECTS': {
      const pos = new Map(action.order.map((id, i) => [id, i]))
      const projects = [...state.projects].sort((a, b) => (pos.get(a.id) ?? a.order ?? 0) - (pos.get(b.id) ?? b.order ?? 0))
      return { ...state, projects: projects.map((p, i) => ({ ...p, order: i })) }
    }
    case 'ADD_MILESTONE':
      return mapProject(state, action.projectId, (p) => settleProject({
        ...p,
        milestones: [...p.milestones, { id: uid(), name: action.name, due: action.due || null, tasks: [] }],
      }))
    case 'UPDATE_MILESTONE':
      return mapProject(state, action.projectId, (p) => settleProject(
        inMilestone(p, action.milestoneId, (m) => ({ ...m, ...action.patch }))
      ))
    case 'DELETE_MILESTONE':
      return mapProject(state, action.projectId, (p) => settleProject({
        ...p,
        milestones: p.milestones.filter((m) => m.id !== action.milestoneId),
      }))
    case 'REORDER_MILESTONES':
      return mapProject(state, action.projectId, (p) => {
        const pos = new Map(action.order.map((id, i) => [id, i]))
        const milestones = [...p.milestones].sort((a, b) => (pos.get(a.id) ?? 0) - (pos.get(b.id) ?? 0))
        return settleProject({ ...p, milestones: milestones.map((m) => ({ ...m, order: pos.get(m.id) ?? 0 })) })
      })
    case 'ADD_TASK':
      return mapProject(state, action.projectId, (p) => settleProject(
        inMilestone(p, action.milestoneId, (m) => ({
          ...m,
          tasks: [...m.tasks, {
            id: uid(),
            name: action.name,
            done: false,
            status: 'todo',
            due: action.due || null,
            priority: action.priority || 'normal',
            estimateMin: action.estimateMin ?? null,
            notes: '',
            order: m.tasks.length,
          }],
        }))
      ))
    case 'UPDATE_TASK':
      return mapProject(state, action.projectId, (p) => settleProject(
        inMilestone(p, action.milestoneId, (m) => ({
          ...m,
          tasks: m.tasks.map((t) => {
            if (t.id !== action.taskId) return t
            const next = { ...t, ...action.patch }
            if ('done' in (action.patch || {})) {
              next.status = next.done ? 'done' : (next.status === 'done' ? 'todo' : next.status)
              next.completedAt = next.done ? (t.completedAt || isoLocal()) : null
            }
            return next
          }),
        }))
      ))
    case 'TOGGLE_TASK':
      return mapProject(state, action.projectId, (p) => settleProject(
        inMilestone(p, action.milestoneId, (m) => ({
          ...m,
          tasks: m.tasks.map((t) => (t.id === action.taskId
            ? { ...t, done: !t.done, status: !t.done ? 'done' : 'todo', completedAt: !t.done ? (t.completedAt || isoLocal()) : null }
            : t)),
        }))
      ))
    case 'DELETE_TASK':
      return mapProject(state, action.projectId, (p) => settleProject(
        inMilestone(p, action.milestoneId, (m) => ({ ...m, tasks: m.tasks.filter((t) => t.id !== action.taskId) }))
      ))
    case 'RESTORE_TASK':
      return mapProject(state, action.projectId, (p) => settleProject(
        inMilestone(p, action.milestoneId, (m) => {
          const tasks = [...m.tasks]
          const at = Math.max(0, Math.min(tasks.length, action.index ?? tasks.length))
          tasks.splice(at, 0, action.task)
          return { ...m, tasks }
        })
      ))
    case 'REORDER_TASKS':
      return mapProject(state, action.projectId, (p) => settleProject(
        inMilestone(p, action.milestoneId, (m) => {
          const pos = new Map(action.order.map((id, i) => [id, i]))
          const tasks = [...m.tasks].sort((a, b) => (pos.get(a.id) ?? a.order ?? 0) - (pos.get(b.id) ?? b.order ?? 0))
          return { ...m, tasks: tasks.map((t, i) => ({ ...t, order: i })) }
        })
      ))

    /* ---- assignments ---- */
    case 'ADD_ASSIGNMENT': {
      const assignment = baseAssignment({ order: state.assignments.length, ...action.assignment })
      return { ...state, assignments: [...state.assignments, settleAssignment(assignment)] }
    }
    case 'UPDATE_ASSIGNMENT':
      return mapAssignment(state, action.id, (a) => settleAssignment({ ...a, ...action.patch }))
    case 'SET_ASSIGNMENT_PROGRESS':
      return mapAssignment(state, action.id, (a) => settleAssignment({
        ...a,
        progress: Math.max(0, Math.min(100, Math.round(action.pct))),
        progressMode: 'explicit',
      }))
    case 'DELETE_ASSIGNMENT':
      return { ...state, assignments: state.assignments.filter((a) => a.id !== action.id) }
    case 'RESTORE_ASSIGNMENT':
      return { ...state, assignments: [...state.assignments, action.assignment] }
    case 'REORDER_ASSIGNMENTS': {
      const pos = new Map(action.order.map((id, i) => [id, i]))
      const assignments = [...state.assignments].sort((a, b) => (pos.get(a.id) ?? a.order ?? 0) - (pos.get(b.id) ?? b.order ?? 0))
      return { ...state, assignments: assignments.map((a, i) => ({ ...a, order: i })) }
    }
    case 'ADD_SUBTASK':
      return mapAssignment(state, action.id, (a) => settleAssignment({
        ...a,
        subtasks: [...(a.subtasks || []), { id: uid(), name: action.name, done: false, completedAt: null, order: (a.subtasks || []).length }],
      }))
    case 'TOGGLE_SUBTASK':
      return mapAssignment(state, action.id, (a) => settleAssignment({
        ...a,
        subtasks: (a.subtasks || []).map((s) => (s.id === action.subtaskId
          ? { ...s, done: !s.done, completedAt: !s.done ? isoLocal() : null }
          : s)),
      }))
    case 'UPDATE_SUBTASK':
      return mapAssignment(state, action.id, (a) => settleAssignment({
        ...a,
        subtasks: (a.subtasks || []).map((s) => (s.id === action.subtaskId ? { ...s, ...action.patch } : s)),
      }))
    case 'DELETE_SUBTASK':
      return mapAssignment(state, action.id, (a) => settleAssignment({
        ...a,
        subtasks: (a.subtasks || []).filter((s) => s.id !== action.subtaskId),
      }))
    case 'RESTORE_SUBTASK':
      return mapAssignment(state, action.id, (a) => {
        const subtasks = [...(a.subtasks || [])]
        const at = Math.max(0, Math.min(subtasks.length, action.index ?? subtasks.length))
        subtasks.splice(at, 0, action.subtask)
        return settleAssignment({ ...a, subtasks })
      })
    case 'REORDER_SUBTASKS':
      return mapAssignment(state, action.id, (a) => {
        const pos = new Map(action.order.map((id, i) => [id, i]))
        const subtasks = [...(a.subtasks || [])].sort((x, y) => (pos.get(x.id) ?? x.order ?? 0) - (pos.get(y.id) ?? y.order ?? 0))
        return settleAssignment({ ...a, subtasks: subtasks.map((s, i) => ({ ...s, order: i })) })
      })

    /* ---- mind ---- */
    case 'SET_MOOD': {
      const moods = { ...state.moods }
      if (action.patch == null) delete moods[action.date]
      else {
        const next = { ...moods[action.date], ...action.patch }
        const hasValue = ['score', 'energy', 'focus', 'motivation'].some((k) => Number.isFinite(next[k]))
        if (!hasValue && !next.note && !next.wentWell && !next.difficult) delete moods[action.date]
        else moods[action.date] = next
      }
      return { ...state, moods }
    }

    /* ---- profile / data ---- */
    case 'SET_PROFILE':
      return { ...state, profile: { ...state.profile, ...action.patch } }
    case 'IMPORT_DATA': {
      const incoming = action.data
      const profile = {
        ...state.profile,
        ...incoming.profile,
        onboarded: incoming.profile?.onboarded === true || state.profile.onboarded,
        name: incoming.profile?.name || state.profile.name,
      }
      return { ...emptyState(), ...incoming, profile }
    }
    case 'RESET_ALL':
      return { ...emptyState(), profile: { ...emptyState().profile, name: state.profile.name } }
    default:
      return state
  }
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
