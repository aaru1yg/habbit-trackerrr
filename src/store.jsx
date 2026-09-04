import { createContext, useContext, useEffect, useReducer } from 'react'
import { format, addDays, subDays, startOfWeek, endOfWeek, eachDayOfInterval, parseISO } from 'date-fns'

export const todayStr = () => format(new Date(), 'yyyy-MM-dd')
export const dayStr = (d) => format(d, 'yyyy-MM-dd')
export const toDate = (s) => parseISO(s)
export const addDaysStr = (s, n) => dayStr(addDays(parseISO(s), n))
export const hashColor = (str) => {
  let h = 0
  for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h)
  const hue = Math.abs(h) % 360
  return `hsl(${hue} 85% 60%)`
}

const STORAGE_KEY = 'aaru.habbit-tracker.v1'

// ---------------------------------------------------------------------------
// Colors / palettes
// ---------------------------------------------------------------------------
export const PALETTE = [
  '#ff5d8f', '#ffb703', '#4ade80', '#38bdf8', '#a78bfa',
  '#fb7185', '#f97316', '#2dd4bf', '#e879f9', '#facc15',
  '#60a5fa', '#34d399', '#c084fc', '#fda4af', '#fbbf24',
]

export const EMOJI = ['🔥', '💪', '🧘', '📚', '💧', '💻', '🏃', '🥗', '🛌', '🧠', '🎯', '✍️', '🎸', '🌱', '☕', '🎨']

// ---------------------------------------------------------------------------
// Seed a rich starter dataset so the dashboard is alive on first load.
// ---------------------------------------------------------------------------
function buildSeed() {
  const now = new Date()
  const today = dayStr(now)
  const uid = () => Math.random().toString(36).slice(2, 10)

  const daily = [
    { name: 'Workout', emoji: '💪', color: '#ff5d8f', targetValue: 1, targetUnit: 'times', startDate: subDays(now, 40) },
    { name: 'Meditate', emoji: '🧘', color: '#a78bfa', targetValue: 10, targetUnit: 'minutes', startDate: subDays(now, 40) },
    { name: 'Read', emoji: '📚', color: '#38bdf8', targetValue: 3, targetUnit: 'pages', startDate: subDays(now, 40) },
    { name: 'Drink Water', emoji: '💧', color: '#2dd4bf', targetValue: 8, targetUnit: 'glasses', startDate: subDays(now, 34) },
    { name: 'Code', emoji: '💻', color: '#4ade80', targetValue: 60, targetUnit: 'minutes', startDate: subDays(now, 40) },
  ]

  const projects = [
    { name: 'Build Portfolio Site', emoji: '🚀', color: '#f97316', durationType: 'range', startDate: subDays(now, 20), endDate: addDays(now, 40) },
    { name: 'Learn React', emoji: '⚛️', color: '#60a5fa', durationType: 'range', startDate: subDays(now, 15), endDate: addDays(now, 50) },
    { name: 'Launch Side Project', emoji: '🎯', color: '#c084fc', durationType: 'range', startDate: subDays(now, 12), endDate: addDays(now, 25) },
  ]

  const habits = [
    ...daily.map((h) => ({
      id: uid(),
      name: h.name,
      emoji: h.emoji,
      color: h.color,
      isDaily: true,
      durationType: 'forever',
      startDate: dayStr(h.startDate),
      endDate: null,
      targetValue: h.targetValue,
      targetUnit: h.targetUnit,
      note: '',
    })),
    ...projects.map((h) => ({
      id: uid(),
      name: h.name,
      emoji: h.emoji,
      color: h.color,
      isDaily: false,
      durationType: h.durationType,
      startDate: dayStr(h.startDate),
      endDate: dayStr(h.endDate),
      targetValue: 100,
      targetUnit: 'percent',
      note: '',
    })),
  ]

  const checkins = {}
  for (const h of habits) {
    if (!h.isDaily) continue
    checkins[h.id] = {}
    const start = parseISO(h.startDate)
    const days = eachDayOfInterval({ start, end: now })
    for (let i = 0; i < days.length; i++) {
      const d = days[i]
      const key = dayStr(d)
      // ramp up probability slightly over time for a nicer trend
      const trending = (i / days.length) * 0.35
      const done = Math.random() < 0.68 + trending + getHabitBias(h.color)
      if (done) {
        checkins[h.id][key] = { value: h.targetValue, done: true }
      } else {
        checkins[h.id][key] = { value: 0, done: false }
      }
    }
  }

  const projectsState = {}
  for (const h of projects) {
    const start = parseISO(dayStr(h.startDate))
    const elapsed = Math.max(0, diffDays(start, now))
    const total = diffDays(start, parseISO(dayStr(h.endDate))) || 1
    const pct = Math.min(100, Math.round((elapsed / total) * 100 * getHabitBias(h.color) + 10))
    projectsState[h.id] = {
      percent: Math.min(100, Math.max(5, pct)),
      updatedAt: today,
      milestones: buildMilestones(start, now, total),
    }
  }

  return { habits, checkins, projects: projectsState, profile: { name: 'Aaru' } }
}

function diffDays(a, b) {
  return Math.round((b - a) / 86400000)
}

function getHabitBias(hex) {
  // deterministic small bias per habit so data looks organic
  const n = parseInt(hex.slice(1), 16)
  return (n % 20) / 100 - 0.07
}

function buildMilestones(start, now, totalDays) {
  const milestones = []
  const steps = 12
  for (let i = 0; i <= steps; i++) {
    const d = addDays(start, Math.round((i / steps) * totalDays))
    if (d > now) break
    milestones.push({
      date: dayStr(d),
      percent: Math.min(100, Math.round((i / steps) * 100)),
    })
  }
  milestones.push({ date: dayStr(now), percent: Math.min(100, Math.round(((now - start) / 86400000 / (totalDays || 1)) * 100)) })
  return milestones
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed && parsed.habits) return parsed
    }
  } catch (e) {
    /* ignore */
  }
  return buildSeed()
}

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------
function reducer(state, action) {
  switch (action.type) {
    case 'ADD_HABIT': {
      return { ...state, habits: [...state.habits, action.habit] }
    }
    case 'DELETE_HABIT': {
      const habits = state.habits.filter((h) => h.id !== action.id)
      const checkins = { ...state.checkins }
      delete checkins[action.id]
      const projects = { ...state.projects }
      delete projects[action.id]
      return { ...state, habits, checkins, projects }
    }
    case 'UPDATE_HABIT': {
      return {
        ...state,
        habits: state.habits.map((h) => (h.id === action.id ? { ...h, ...action.patch } : h)),
      }
    }
    case 'SET_CHECKIN': {
      const habit = state.habits.find((h) => h.id === action.habitId)
      const target = habit ? habit.targetValue : 1
      const checkins = { ...state.checkins }
      const habitCheck = { ...(checkins[action.habitId] || {}) }
      const prev = habitCheck[action.date] || { value: 0, done: false }
      const nextDone = !prev.done
      habitCheck[action.date] = { value: nextDone ? target : 0, done: nextDone }
      checkins[action.habitId] = habitCheck
      return { ...state, checkins }
    }
    case 'SET_CHECKIN_VALUE': {
      const habit = state.habits.find((h) => h.id === action.habitId)
      const target = habit ? habit.targetValue : 1
      const value = Math.max(0, action.value)
      const checkins = { ...state.checkins }
      const habitCheck = { ...(checkins[action.habitId] || {}) }
      const prev = habitCheck[action.date] || { value: 0, done: false }
      habitCheck[action.date] = { value, done: value >= target }
      checkins[action.habitId] = habitCheck
      return { ...state, checkins }
    }
    case 'SET_PROJECT_PERCENT': {
      const projects = { ...state.projects }
      const prev = projects[action.habitId] || { percent: 0, milestones: [], updatedAt: '' }
      const milestones = prev.milestones ? [...prev.milestones] : []
      const now = todayStr()
      if (!milestones.length || milestones[milestones.length - 1].date !== now) {
        milestones.push({ date: now, percent: action.percent })
      } else {
        milestones[milestones.length - 1] = { date: now, percent: action.percent }
      }
      projects[action.habitId] = { ...prev, percent: action.percent, updatedAt: now, milestones }
      return { ...state, projects }
    }
    case 'SET_PROFILE': {
      return { ...state, profile: { ...state.profile, ...action.patch } }
    }
    case 'RESET_ALL': {
      return buildSeed()
    }
    case 'IMPORT_DATA': {
      return action.data
    }
    default:
      return state
  }
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------
const StoreContext = createContext(null)

export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadState)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch (e) {
      /* ignore quota errors */
    }
  }, [state])

  return <StoreContext.Provider value={{ state, dispatch }}>{children}</StoreContext.Provider>
}

export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used within StoreProvider')
  return ctx
}

// ---------------------------------------------------------------------------
// Derived data helpers (pure functions used across components)
// ---------------------------------------------------------------------------
export function getHabitCheckins(state, habitId) {
  return state.checkins[habitId] || {}
}

export function getHabitCheck(state, habitId, date) {
  return (getHabitCheckins(state, habitId)[date]) || { value: 0, done: false }
}

// Completion for a single habit on a given date (0..1)
export function habitCompletion(state, habit, date) {
  if (!habit.isDaily) return 0
  const check = getHabitCheck(state, habit.id, date)
  if (!habit.targetValue) return check.done ? 1 : 0
  return Math.min(1, check.value / habit.targetValue)
}

// Overall completion % for all daily habits on date (0..100)
export function overallCompletion(state, date) {
  const daily = state.habits.filter((h) => h.isDaily)
  if (!daily.length) return 0
  let sum = 0
  for (const h of daily) {
    if (h.startDate && date < h.startDate) continue
    sum += habitCompletion(state, h, date)
  }
  return Math.round((sum / daily.length) * 100)
}

export function habitStreak(state, habit) {
  let streak = 0
  let cursor = todayStr()
  const checked = getHabitCheckins(state, habit.id)
  // don't break streak if today isn't logged yet but is a valid day
  if (!checked[cursor] || !checked[cursor].done) {
    cursor = addDaysStr(cursor, -1)
  }
  while (checked[cursor] && checked[cursor].done) {
    streak++
    cursor = addDaysStr(cursor, -1)
  }
  return streak
}

export function bestStreak(state, habit) {
  const checked = getHabitCheckins(state, habit.id)
  const dates = Object.keys(checked).filter((d) => checked[d].done).sort()
  let best = 0
  let run = 0
  let prev = null
  for (const d of dates) {
    if (prev && addDaysStr(prev, 1) === d) run++
    else run = 1
    best = Math.max(best, run)
    prev = d
  }
  return best
}

// Build the time series for the master graph (habits vs time).
export function buildMasterSeries(state, rangeDays) {
  const end = new Date()
  const start = subDays(end, rangeDays)
  const data = []
  const daily = state.habits.filter((h) => h.isDaily)
  for (const d of eachDayOfInterval({ start, end })) {
    const key = dayStr(d)
    const row = { date: key, label: format(d, 'MMM d') }
    for (const h of daily) {
      row[h.id] = Math.round(habitCompletion(state, h, key) * 100)
    }
    row.Avg = overallCompletion(state, key)
    data.push(row)
  }
  return data
}

// Group recent daily completion into weeks for a heatmap (0-indexed rows x cols)
export function buildHeatmap(state, weeks = 16) {
  const today = new Date()
  const end = endOfWeek(today, { weekStartsOn: 0 })
  const start = startOfWeek(subDays(today, (weeks - 1) * 7), { weekStartsOn: 0 })
  const days = eachDayOfInterval({ start, end })
  const cells = days.map((d) => {
    const key = dayStr(d)
    const withinRange = key <= todayStr()
    return { date: key, level: withinRange ? Math.round(overallCompletion(state, key) / 25) : 0 }
  })
  // build column-major grid: 7 rows (Sun..Sat) x N cols
  const cols = weeks
  const grid = []
  const weeksChunks = []
  for (let c = 0; c < cols; c++) {
    weeksChunks.push(cells.slice(c * 7, c * 7 + 7))
  }
  for (let r = 0; r < 7; r++) {
    const row = []
    for (let c = 0; c < cols; c++) row.push(weeksChunks[c][r])
    grid.push(row)
  }
  return grid
}

export function lastNDays(n = 30) {
  const end = new Date()
  return eachDayOfInterval({ start: subDays(end, n), end })
}
