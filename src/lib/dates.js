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

/* ============================================================
   TIME / DEADLINE HELPERS
   Assignments can be due in hours, projects in days. Everything
   here is explicit about local time — never UTC-parsed 'yyyy-MM-dd'.
   ============================================================ */

/** Local Date from either 'yyyy-MM-dd' (end-of-day when eod) or an ISO-ish local string. */
export function toLocalDate(value, { endOfDay = false } = {}) {
  if (value instanceof Date) return value
  if (typeof value !== 'string' || !value) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-').map(Number)
    return new Date(y, m - 1, d, endOfDay ? 23 : 12, endOfDay ? 59 : 0, endOfDay ? 59 : 0)
  }
  // 'yyyy-MM-ddTHH:mm[:ss]' — treated as LOCAL (no Z, no offset)
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/)
  if (m) {
    const [, y, mo, d, h, mi, s] = m
    return new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s || 0))
  }
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

/** 'yyyy-MM-dd' portion of any supported date value. */
export function dayOf(value) {
  const d = toLocalDate(value, { endOfDay: true })
  return d ? dayStr(d) : null
}

/** Local ISO-ish string with minute precision: 'yyyy-MM-ddTHH:mm'. */
export function isoLocal(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

export const nowIsoLocal = () => isoLocal(new Date())

/** Milliseconds from now until `value` (negative when past). */
export function msUntil(value, now = new Date()) {
  const target = toLocalDate(value, { endOfDay: true })
  if (!target) return null
  return target.getTime() - now.getTime()
}

/** Whole calendar days from today's date until the date part of `value`. */
export function daysUntil(value, now = new Date()) {
  const day = dayOf(value)
  if (!day) return null
  return differenceInCalendarDays(toLocalDate(day, { endOfDay: true }), dayStr(now))
}

export function hoursUntil(value, now = new Date()) {
  const ms = msUntil(value, now)
  return ms == null ? null : ms / 3600000
}

/** 0..1 of the way through [start, deadline]; null when the window is invalid. */
export function elapsedFraction(start, deadline, now = new Date()) {
  const s = toLocalDate(start, { endOfDay: false })
  const e = toLocalDate(deadline, { endOfDay: true })
  if (!s || !e) return null
  const total = e.getTime() - s.getTime()
  if (total <= 0) return null
  return Math.max(0, Math.min(1, (now.getTime() - s.getTime()) / total))
}

/** Compact, human countdown: '6h', '2d 4h', '3d', 'overdue by 2d'. */
export function countdownLabel(value, now = new Date()) {
  const ms = msUntil(value, now)
  if (ms == null) return null
  const abs = Math.abs(ms)
  const mins = Math.round(abs / 60000)
  const hrs = Math.floor(mins / 60)
  const days = Math.floor(hrs / 24)
  let core
  if (mins < 1) core = 'now'
  else if (mins < 60) core = `${mins}m`
  else if (hrs < 24) core = hrs < 48 ? `${hrs}h ${mins % 60}m` : `${hrs}h`
  else if (days < 14) core = hrs % 24 ? `${days}d ${hrs % 24}h` : `${days}d`
  else core = `${days}d`
  return ms < 0 ? `${core} overdue` : core
}

/** 'Due today' / 'Due tomorrow' / '3 days left' / 'Overdue' / 'Completed'. */
export function dueLabel(value, { completed = false } = {}, now = new Date()) {
  if (completed) return 'Completed'
  const d = daysUntil(value, now)
  if (d == null) return 'No deadline'
  const ms = msUntil(value, now)
  if (ms < 0) return 'Overdue'
  if (d === 0) return 'Due today'
  if (d === 1) return 'Due tomorrow'
  return `${d} days left`
}

/** Day header for timeline grouping: 'Today' / 'Tomorrow' / 'Yesterday' / 'Sep 8'. */
export function relativeDayLabel(day, now = new Date()) {
  const diff = differenceInCalendarDays(toLocalDate(day, { endOfDay: true }), dayStr(now))
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  if (diff === -1) return 'Yesterday'
  if (diff < -1) return `${Math.abs(diff)} days ago`
  if (diff <= 6) return `${diff} days`
  return shortDate(day)
}

/** '7:05 PM' from an ISO timestamp or 'HH:mm'. */
export function prettyTime(value) {
  const d = toLocalDate(value)
  if (!d) return ''
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

/** 'Sep 5, 7:00 PM' — used for assignment deadlines with hour precision. */
export function prettyDateTime(value) {
  const d = toLocalDate(value, { endOfDay: true })
  if (!d) return ''
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ', ' +
    d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

/** Whole minutes between two values (≥0). */
export function minutesBetween(a, b) {
  const x = toLocalDate(a)
  const y = toLocalDate(b)
  if (!x || !y) return null
  return Math.round(Math.abs(y.getTime() - x.getTime()) / 60000)
}

/** Bucket a timestamp into a part of day (real data only). */
export function partOfDay(value) {
  const d = toLocalDate(value)
  if (!d) return null
  const h = d.getHours()
  if (h < 5) return 'night'
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  if (h < 21) return 'evening'
  return 'night'
}

export const PARTS_OF_DAY = ['morning', 'afternoon', 'evening', 'night']

/** Add hours to a local date value → 'yyyy-MM-ddTHH:mm'. */
export function addHoursIso(value, hours, now = new Date()) {
  const base = value ? toLocalDate(value) : now
  const d = new Date((base || now).getTime() + hours * 3600000)
  return isoLocal(d)
}

/** Add days to a local date value → 'yyyy-MM-dd'. */
export function addDaysTo(value, days) {
  const base = toLocalDate(value, { endOfDay: true }) || new Date()
  return dayStr(addDays(base, days))
}

/** Duration presets used by the deadline pickers (hours). */
export const DEADLINE_PRESETS = [
  { id: '2h', label: '2 hours', hours: 2 },
  { id: '6h', label: '6 hours', hours: 6 },
  { id: '12h', label: '12 hours', hours: 12 },
  { id: '1d', label: '1 day', hours: 24 },
  { id: '2d', label: '2 days', hours: 48 },
  { id: '3d', label: '3 days', hours: 72 },
  { id: '5d', label: '5 days', hours: 120 },
  { id: '7d', label: '7 days', hours: 168 },
  { id: '14d', label: '14 days', hours: 336 },
  { id: '30d', label: '30 days', hours: 720 },
  { id: '60d', label: '60 days', hours: 1440 },
]

/** Human duration: 95 → '1h 35m'; 45 → '45m'; 300 → '5h'. */
export function minutesLabel(mins) {
  const m = Math.max(0, Math.round(Number(mins) || 0))
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  return m % 60 ? `${h}h ${m % 60}m` : `${h}h`
}
