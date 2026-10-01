/* ============================================================
   STORE — one reducer, one persistence path, one API.

   Components never reach into state shape directly; they call
   actions. That is the "coordination" fix: checking off a habit,
   finishing a task and completing a goal all flow through here,
   so streaks, goal progress and milestones can never disagree.
   ============================================================ */
import { createContext, useContext, useEffect, useMemo, useReducer, useRef } from 'react'
import {
  STORAGE_KEY, LEGACY_KEYS, VERSION, emptyState, normalize, migrate,
  makeHabit, makeWork, makeSubtask, makeGoal, uid, pruneTombstones,
} from './schema.js'
import { today, now, moment } from './date.js'

/* ---------------- Load ------------------------------------ */

function load() {
  if (typeof localStorage === 'undefined') return emptyState()
  try {
    const current = localStorage.getItem(STORAGE_KEY)
    if (current) return normalize(JSON.parse(current))
    for (const key of LEGACY_KEYS) {
      const legacy = localStorage.getItem(key)
      if (legacy) {
        const migrated = migrate(JSON.parse(legacy))
        // Keep the old key untouched — if v5 ever disappoints, the
        // user's v4 data is still sitting there intact.
        return migrated
      }
    }
  } catch (err) {
    console.warn('[store] could not read saved data, starting fresh', err)
  }
  return emptyState()
}

/* ---------------- Reducer --------------------------------- */

const reorder = (list) => list.map((x, i) => ({ ...x, order: i }))

/* Every record edit carries the instant it happened. Cloud sync needs it to
   decide which of two divergent copies of the same row is the newer one; with
   no account it is simply an unread field. */
const stamp = () => new Date().toISOString()
const replace = (list, id, fn) =>
  list.map((x) => (x.id === id ? { ...fn(x), updatedAt: stamp() } : x))

/* Record a deletion so another device cannot resurrect the row on merge. */
const bury = (state, ...ids) => {
  const deleted = { ...state.deleted }
  const at = stamp()
  for (const id of ids) deleted[id] = at
  return pruneTombstones(deleted)
}

function reducer(state, action) {
  switch (action.type) {
    /* ---- lifecycle ---- */
    case 'hydrate': return action.state
    case 'reset':   return emptyState()

    case 'profile':
      return { ...state, profile: { ...state.profile, ...action.patch, updatedAt: stamp() } }

    /* ---- habits ---- */
    case 'habit/add': {
      const habit = makeHabit({ ...action.habit, createdAt: today(), updatedAt: stamp(), order: state.habits.length })
      return { ...state, habits: [...state.habits, habit] }
    }
    case 'habit/update':
      return { ...state, habits: replace(state.habits, action.id, (h) => makeHabit({ ...h, ...action.patch, id: h.id })) }

    case 'habit/archive':
      return { ...state, habits: replace(state.habits, action.id, (h) => ({ ...h, archivedAt: h.archivedAt ? null : today() })) }

    case 'habit/remove': {
      const checkins = { ...state.checkins }
      delete checkins[action.id]
      return {
        ...state,
        habits: reorder(state.habits.filter((h) => h.id !== action.id)),
        checkins,
        goals: state.goals.map((g) =>
          g.habitIds.includes(action.id)
            ? { ...g, habitIds: g.habitIds.filter((x) => x !== action.id), updatedAt: stamp() }
            : g
        ),
        deleted: bury(state, action.id),
      }
    }
    case 'habit/move': {
      const list = [...state.habits]
      const from = list.findIndex((h) => h.id === action.id)
      if (from < 0) return state
      const to = Math.max(0, Math.min(list.length - 1, from + action.by))
      list.splice(to, 0, list.splice(from, 1)[0])
      const at = stamp()
      const lo = Math.min(from, to); const hi = Math.max(from, to)
      return {
        ...state,
        habits: reorder(list).map((h, i) => (i >= lo && i <= hi ? { ...h, updatedAt: at } : h)),
      }
    }

    /* ---- check-ins: one entry point for every way to log ---- */
    case 'checkin/set': {
      const { habitId, day, value } = action
      const habit = state.habits.find((h) => h.id === habitId)
      if (!habit) return state
      const days = { ...(state.checkins[habitId] || {}) }
      const v = Math.max(0, Math.round(value))
      if (v <= 0) delete days[day]
      else days[day] = { value: v, at: days[day]?.at || (day === today() ? now() : `${day}T12:00`), updatedAt: stamp() }
      const checkins = { ...state.checkins }
      if (Object.keys(days).length) checkins[habitId] = days
      else delete checkins[habitId]
      return { ...state, checkins }
    }

    /* ---- work ---- */
    case 'work/add': {
      const item = makeWork({ ...action.work, createdAt: today(), startedAt: today(), updatedAt: stamp(), order: state.work.length })
      return { ...state, work: [...state.work, item] }
    }
    case 'work/update':
      return { ...state, work: replace(state.work, action.id, (w) => makeWork({ ...w, ...action.patch, id: w.id })) }

    case 'work/complete':
      return {
        ...state,
        work: replace(state.work, action.id, (w) => ({
          ...w,
          doneAt: w.doneAt ? null : now(),
          tasks: w.doneAt ? w.tasks : w.tasks.map((t) => (t.done ? t : { ...t, done: true, doneAt: now() })),
        })),
      }

    case 'work/archive':
      return { ...state, work: replace(state.work, action.id, (w) => ({ ...w, archivedAt: w.archivedAt ? null : today() })) }

    case 'work/remove':
      return {
        ...state,
        work: reorder(state.work.filter((w) => w.id !== action.id)),
        deleted: bury(state, action.id),
      }

    /* ---- subtasks ---- */
    case 'task/add':
      return {
        ...state,
        work: replace(state.work, action.workId, (w) => ({
          ...w,
          manual: null, // tasks are the truth once they exist
          tasks: [...w.tasks, makeSubtask({ title: action.title, due: action.due })],
        })),
      }
    case 'task/toggle':
      return {
        ...state,
        work: replace(state.work, action.workId, (w) => {
          const tasks = w.tasks.map((t) =>
            t.id === action.taskId ? { ...t, done: !t.done, doneAt: t.done ? null : now() } : t
          )
          const all = tasks.length > 0 && tasks.every((t) => t.done)
          return { ...w, tasks, doneAt: all ? w.doneAt || now() : null }
        }),
      }
    case 'task/update':
      return {
        ...state,
        work: replace(state.work, action.workId, (w) => ({
          ...w,
          tasks: w.tasks.map((t) => (t.id === action.taskId ? makeSubtask({ ...t, ...action.patch, id: t.id }) : t)),
        })),
      }
    case 'task/remove':
      return {
        ...state,
        work: replace(state.work, action.workId, (w) => ({ ...w, tasks: w.tasks.filter((t) => t.id !== action.taskId) })),
      }

    /* ---- progress log ---- */
    case 'work/log': {
      const entry = {
        at: now(),
        percent: action.percent == null ? null : Math.max(0, Math.min(100, Math.round(action.percent))),
        minutes: action.minutes == null ? null : Math.max(0, Math.round(action.minutes)),
        note: (action.note || '').slice(0, 160),
      }
      if (entry.percent == null && entry.minutes == null) return state
      return {
        ...state,
        work: replace(state.work, action.id, (w) => ({
          ...w,
          log: [...w.log, entry].slice(-400),
          manual: w.tasks.length ? w.manual : entry.percent ?? w.manual,
          doneAt: entry.percent === 100 && !w.tasks.length ? w.doneAt || now() : w.doneAt,
        })),
      }
    }

    /* ---- goals ---- */
    case 'goal/add':
      return { ...state, goals: [...state.goals, makeGoal({ ...action.goal, createdAt: today(), updatedAt: stamp(), order: state.goals.length })] }
    case 'goal/update':
      return { ...state, goals: replace(state.goals, action.id, (g) => makeGoal({ ...g, ...action.patch, id: g.id })) }
    case 'goal/complete':
      return { ...state, goals: replace(state.goals, action.id, (g) => ({ ...g, doneAt: g.doneAt ? null : today() })) }
    case 'goal/remove':
      return {
        ...state,
        goals: reorder(state.goals.filter((g) => g.id !== action.id)),
        work: state.work.map((w) =>
          w.goalId === action.id ? { ...w, goalId: null, updatedAt: stamp() } : w
        ),
        deleted: bury(state, action.id),
      }
    case 'goal/link': {
      // One action links a habit OR a work item, so the two sides
      // can never drift apart.
      if (action.habitId) {
        return {
          ...state,
          goals: replace(state.goals, action.id, (g) => ({
            ...g,
            habitIds: g.habitIds.includes(action.habitId)
              ? g.habitIds.filter((x) => x !== action.habitId)
              : [...g.habitIds, action.habitId],
          })),
        }
      }
      if (action.workId) {
        return {
          ...state,
          work: replace(state.work, action.workId, (w) => ({ ...w, goalId: w.goalId === action.id ? null : action.id })),
        }
      }
      return state
    }

    /* ---- mood ---- */
    case 'mood/set': {
      const moods = { ...state.moods }
      const { day, mood, energy, note } = action
      const prev = moods[day] || {}
      const next = {
        mood: mood === undefined ? prev.mood ?? null : mood,
        energy: energy === undefined ? prev.energy ?? null : energy,
        note: note === undefined ? prev.note || '' : String(note).slice(0, 200),
        updatedAt: stamp(),
      }
      if (next.mood == null && next.energy == null && !next.note) delete moods[day]
      else moods[day] = next
      return { ...state, moods }
    }

    default:
      return state
  }
}

/* ---------------- Context --------------------------------- */

const StateCtx = createContext(null)
const ActionsCtx = createContext(null)

export function StoreProvider({ children, initial }) {
  const [state, dispatch] = useReducer(reducer, null, () => initial || load())
  const first = useRef(true)

  /* Persist, debounced. Writing on every keystroke of a notes
     field would hammer localStorage for no benefit. */
  useEffect(() => {
    if (first.current) { first.current = false; return }
    const t = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, version: VERSION }))
      } catch (err) {
        console.warn('[store] save failed', err)
      }
    }, 220)
    return () => clearTimeout(t)
  }, [state])

  /* Keep tabs in sync without a server. */
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key !== STORAGE_KEY || !e.newValue) return
      try { dispatch({ type: 'hydrate', state: normalize(JSON.parse(e.newValue)) }) } catch { /* ignore */ }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  /* Theme + motion live on <html> so CSS owns them. */
  useEffect(() => {
    document.documentElement.dataset.theme = state.profile.theme
    document.documentElement.dataset.motion = state.profile.motion
  }, [state.profile.theme, state.profile.motion])

  const actions = useMemo(() => bindActions(dispatch), [])

  return (
    <StateCtx.Provider value={state}>
      <ActionsCtx.Provider value={actions}>{children}</ActionsCtx.Provider>
    </StateCtx.Provider>
  )
}

function bindActions(dispatch) {
  return {
    dispatch,
    hydrate:       (state) => dispatch({ type: 'hydrate', state }),
    reset:         () => dispatch({ type: 'reset' }),
    setProfile:    (patch) => dispatch({ type: 'profile', patch }),

    addHabit:      (habit) => dispatch({ type: 'habit/add', habit }),
    updateHabit:   (id, patch) => dispatch({ type: 'habit/update', id, patch }),
    archiveHabit:  (id) => dispatch({ type: 'habit/archive', id }),
    removeHabit:   (id) => dispatch({ type: 'habit/remove', id }),
    moveHabit:     (id, by) => dispatch({ type: 'habit/move', id, by }),
    setCheckin:    (habitId, day, value) => dispatch({ type: 'checkin/set', habitId, day, value }),

    addWork:       (work) => dispatch({ type: 'work/add', work }),
    updateWork:    (id, patch) => dispatch({ type: 'work/update', id, patch }),
    completeWork:  (id) => dispatch({ type: 'work/complete', id }),
    archiveWork:   (id) => dispatch({ type: 'work/archive', id }),
    removeWork:    (id) => dispatch({ type: 'work/remove', id }),
    logWork:       (id, { percent, minutes, note }) => dispatch({ type: 'work/log', id, percent, minutes, note }),

    addTask:       (workId, title, due) => dispatch({ type: 'task/add', workId, title, due }),
    toggleTask:    (workId, taskId) => dispatch({ type: 'task/toggle', workId, taskId }),
    updateTask:    (workId, taskId, patch) => dispatch({ type: 'task/update', workId, taskId, patch }),
    removeTask:    (workId, taskId) => dispatch({ type: 'task/remove', workId, taskId }),

    addGoal:       (goal) => dispatch({ type: 'goal/add', goal }),
    updateGoal:    (id, patch) => dispatch({ type: 'goal/update', id, patch }),
    completeGoal:  (id) => dispatch({ type: 'goal/complete', id }),
    removeGoal:    (id) => dispatch({ type: 'goal/remove', id }),
    linkHabit:     (id, habitId) => dispatch({ type: 'goal/link', id, habitId }),
    linkWork:      (id, workId) => dispatch({ type: 'goal/link', id, workId }),

    setMood:       (day, patch) => dispatch({ type: 'mood/set', day, ...patch }),
  }
}

export const useStore = () => {
  const s = useContext(StateCtx)
  if (!s) throw new Error('useStore must be used inside <StoreProvider>')
  return s
}
export const useActions = () => {
  const a = useContext(ActionsCtx)
  if (!a) throw new Error('useActions must be used inside <StoreProvider>')
  return a
}

export { reducer, load, uid, moment }
