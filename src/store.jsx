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

// v2: fresh, empty start — no fake / seeded data. (v1 only ever held demo data.)
const STORAGE_KEY = 'aaru.habbit-tracker.v2'

// ---------------------------------------------------------------------------
// Colors / palettes
// ---------------------------------------------------------------------------
export const PALETTE = [
  '#ff5d8f', '#ffb703', '#4ade80', '#38bdf8', '#a78bfa',
  '#fb7185', '#f97316', '#2dd4bf', '#e879f9', '#facc15',
  '#60a5fa', '#34d399', '#c084fc', '#fda4af', '#fbbf24',
]

export const EMOJI = ['🔥', '💪', '🧘', '📚', '💧', '💻', '🏃', '🥗', '🛌', '🧠', '🎯', '✍️', '🎸', '🌱', '☕', '🎨', '⏰', '🚿', '💰', '🚫', '📵', '🍎', '🧹', '📝']

// Week band colours for the monthly calendar (Week 1..6)
export const WEEK_COLORS = ['#6366f1', '#3b82f6', '#22d3ee', '#ec4899', '#34d399', '#f59e0b']

// Quick-pick presets so a brand-new user can add habits in one tap (no fake data is ever created).
export const PRESETS = [
  { name: 'Wake up at 05:00', emoji: '⏰', color: '#ffb703' },
  { name: 'Gym', emoji: '💪', color: '#ff5d8f' },
  { name: 'Work on Side Hustle', emoji: '💻', color: '#4ade80' },
  { name: 'Day Planning', emoji: '📝', color: '#38bdf8' },
  { name: 'Budget Tracking', emoji: '💰', color: '#facc15' },
  { name: 'Project Work', emoji: '🎯', color: '#a78bfa' },
  { name: 'No Alcohol', emoji: '🚫', color: '#fb7185' },
  { name: 'Social Media Detox', emoji: '📵', color: '#34d399' },
  { name: 'Goal Journaling', emoji: '✍️', color: '#e879f9' },
  { name: 'Cold Shower', emoji: '🚿', color: '#2dd4bf' },
  { name: 'Read', emoji: '📚', color: '#60a5fa' },
  { name: 'Meditate', emoji: '🧘', color: '#c084fc' },
  { name: 'Drink Water', emoji: '💧', color: '#22d3ee' },
]

export const emptyState = () => ({ habits: [], checkins: {}, projects: {}, mood: {}, profile: { name: 'Aaru' } })

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-3)

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed && Array.isArray(parsed.habits)) {
        return { ...emptyState(), ...parsed, mood: parsed.mood || {} }
      }
    }
  } catch (e) {
    /* ignore */
  }
  return emptyState()
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
    case 'SET_MOOD': {
      const mood = { ...(state.mood || {}) }
      const prev = mood[action.date] || {}
      mood[action.date] = { ...prev, ...action.patch }
      return { ...state, mood }
    }
    case 'RESET_ALL': {
      return emptyState()
    }
    case 'IMPORT_DATA': {
      return { ...emptyState(), ...action.data, mood: action.data.mood || {} }
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

// ---------------------------------------------------------------------------
// Auto calendar helpers (monthly habit grid, weekly bands, analysis)
// ---------------------------------------------------------------------------
export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
export const WD_SHORT = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

// Days of a month, auto-grouped into "Week 1..N" bands of 7 days starting on the 1st.
export function buildMonthDays(year, month /* 0-based */) {
  const count = new Date(year, month + 1, 0).getDate()
  const days = []
  for (let d = 1; d <= count; d++) {
    const date = new Date(year, month, d)
    days.push({
      day: d,
      date: dayStr(date),
      weekday: date.getDay(),
      week: Math.floor((d - 1) / 7), // 0-based week band
    })
  }
  return days
}

export function buildMonthWeeks(days) {
  const weeks = []
  for (const d of days) {
    if (!weeks[d.week]) weeks[d.week] = { index: d.week, label: `Week ${d.week + 1}`, days: [] }
    weeks[d.week].days.push(d)
  }
  return weeks
}

// Is this daily habit scheduled/active on this date?
export function habitActiveOn(habit, date) {
  if (!habit.isDaily) return false
  if (habit.startDate && date < habit.startDate) return false
  if (habit.endDate && date > habit.endDate) return false
  return true
}

// Per-day roll-up across active daily habits (done / total / percent)
export function dayRollup(state, date) {
  const daily = state.habits.filter((h) => habitActiveOn(h, date))
  let done = 0
  for (const h of daily) if (getHabitCheck(state, h.id, date).done) done++
  const total = daily.length
  return { done, notDone: total - done, total, percent: total ? Math.round((done / total) * 100) : 0 }
}

// Per-habit stats for a month: done count / elapsed days (only counts days up to today)
export function habitMonthStats(state, habit, days) {
  const today = todayStr()
  let done = 0
  let elapsed = 0
  for (const d of days) {
    if (d.date > today || !habitActiveOn(habit, d.date)) continue
    elapsed++
    if (getHabitCheck(state, habit.id, d.date).done) done++
  }
  return { done, elapsed, percent: elapsed ? Math.round((done / elapsed) * 1000) / 10 : 0 }
}

// Whole-month overview ("Number of habits / Completed habits / Progress %")
export function monthOverview(state, days) {
  const daily = state.habits.filter((h) => h.isDaily)
  const today = todayStr()
  let completed = 0
  let possible = 0
  for (const d of days) {
    if (d.date > today) continue
    for (const h of daily) {
      if (!habitActiveOn(h, d.date)) continue
      possible++
      if (getHabitCheck(state, h.id, d.date).done) completed++
    }
  }
  return { habits: daily.length, completed, possible, percent: possible ? Math.round((completed / possible) * 1000) / 10 : 0 }
}

// Mood / motivation (1..10) per day -> mindset score
export function getMood(state, date) {
  return (state.mood && state.mood[date]) || {}
}

export function mindsetScore(entry) {
  const { mood, motivation } = entry || {}
  if (mood == null && motivation == null) return null
  const vals = [mood, motivation].filter((v) => v != null)
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10)
}

export function weekMindset(state, week) {
  const today = todayStr()
  let sum = 0, n = 0
  for (const d of week.days) {
    if (d.date > today) continue
    const s = mindsetScore(getMood(state, d.date))
    if (s != null) { sum += s; n++ }
  }
  return n ? Math.round((sum / n) * 100) / 100 : 0
}
