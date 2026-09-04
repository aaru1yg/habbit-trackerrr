/* Date helpers — thin, explicit, timezone-safe string handling (local dates as yyyy-MM-dd). */
import { format, parseISO, addDays, subDays, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, differenceInCalendarDays } from 'date-fns'

export const dayStr = (d) => format(d, 'yyyy-MM-dd')
export const todayStr = () => dayStr(new Date())
export const toDate = (s) => parseISO(s)
export const addDaysStr = (s, n) => dayStr(addDays(parseISO(s), n))
export const subDaysStr = (s, n) => dayStr(subDays(parseISO(s), n))

export const isValidDayStr = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(parseISO(s).getTime())

export const weekDays = (anchorOrStr, weekStartsOn = 1) => {
  const anchor = typeof anchorOrStr === 'string' ? parseISO(anchorOrStr) : anchorOrStr
  const start = startOfWeek(anchor, { weekStartsOn })
  return eachDayOfInterval({ start, end: endOfWeek(anchor, { weekStartsOn }) }).map(dayStr)
}

export const monthLabel = (year, month) =>
  new Date(year, month, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

export const prettyDate = (s) =>
  parseISO(s).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

export const shortDate = (s) =>
  parseISO(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

export const weekdayShort = (s) =>
  parseISO(s).toLocaleDateString('en-US', { weekday: 'short' })

export const weekdayInitial = (s) =>
  parseISO(s).toLocaleDateString('en-US', { weekday: 'narrow' })

export const dayNum = (s) => parseISO(s).getDate()

export const isToday = (s) => isSameDay(parseISO(s), new Date())
export const isFuture = (s) => differenceInCalendarDays(parseISO(s), new Date()) > 0

export const daysBetween = (a, b) => differenceInCalendarDays(parseISO(b), parseISO(a))

/** Days of a calendar month (with weekday info), 0-based month. */
export function monthDays(year, month) {
  const count = new Date(year, month + 1, 0).getDate()
  const out = []
  for (let d = 1; d <= count; d++) {
    const date = new Date(year, month, d)
    const s = dayStr(date)
    out.push({ day: d, date: s, weekday: date.getDay() })
  }
  return out
}

/** Group month days into rows of 7 (band per week of the month). */
export function monthWeekBands(days) {
  const bands = []
  for (const d of days) {
    const bi = Math.floor((d.day - 1) / 7)
    if (!bands[bi]) bands[bi] = { index: bi, label: `Week ${bi + 1}`, days: [] }
    bands[bi].days.push(d)
  }
  return bands
}

export const nowHHMM = () => {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export const greeting = (name = '') => {
  const h = new Date().getHours()
  const part = h < 5 ? 'Up late' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
  return name ? `${part}, ${name}` : part
}
