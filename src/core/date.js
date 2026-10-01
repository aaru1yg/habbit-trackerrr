/* ============================================================
   DATE — timezone-safe local-day helpers.

   One rule, applied everywhere: a *day* is the string 'yyyy-MM-dd'
   in the user's local zone, and a *moment* is 'yyyy-MM-ddTHH:mm'
   (also local). Nothing is ever parsed as UTC, so a check-in at
   11pm never lands on tomorrow.
   ============================================================ */
import {
  format, parseISO, addDays, startOfWeek, endOfWeek,
  eachDayOfInterval, differenceInCalendarDays,
} from 'date-fns'

export const WEEK_STARTS_ON = 1 // Monday

export const day = (d) => format(d, 'yyyy-MM-dd')
export const today = () => day(new Date())
export const parse = (s) => parseISO(s)

export const isDay = (s) =>
  typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(parseISO(s).getTime())

export const shift = (s, n) => day(addDays(parseISO(s), n))

/** Inclusive run of days ending at `end` (default today), length `n`. */
export function lastDays(n, end = today()) {
  const out = []
  for (let i = n - 1; i >= 0; i--) out.push(shift(end, -i))
  return out
}

export function weekOf(anchor = today()) {
  const a = typeof anchor === 'string' ? parseISO(anchor) : anchor
  return eachDayOfInterval({
    start: startOfWeek(a, { weekStartsOn: WEEK_STARTS_ON }),
    end: endOfWeek(a, { weekStartsOn: WEEK_STARTS_ON }),
  }).map(day)
}

/** Every day of a calendar month, 0-based month. */
export function monthOf(year, month) {
  const count = new Date(year, month + 1, 0).getDate()
  const out = []
  for (let d = 1; d <= count; d++) {
    const date = new Date(year, month, d)
    out.push({ n: d, date: day(date), weekday: date.getDay() })
  }
  return out
}

export const dow = (s) => parseISO(s).getDay() // 0 = Sunday

export const between = (a, b) => differenceInCalendarDays(parseISO(b), parseISO(a))

export const isToday = (s) => s === today()
export const isPast = (s) => between(s, today()) > 0
export const isFuture = (s) => between(today(), s) > 0

/* ---- Moments (date + time) ------------------------------- */

/** Local Date from a day string, a moment string, or a Date. */
export function toDate(value, { endOfDay = false } = {}) {
  if (value instanceof Date) return value
  if (typeof value !== 'string' || !value) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-').map(Number)
    return endOfDay ? new Date(y, m - 1, d, 23, 59, 59) : new Date(y, m - 1, d, 12, 0, 0)
  }
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/)
  if (m) return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], 0)
  const p = new Date(value)
  return Number.isNaN(p.getTime()) ? null : p
}

export function moment(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}
export const now = () => moment(new Date())

/** Day part of any supported value. */
export function dayOf(value) {
  const d = toDate(value, { endOfDay: true })
  return d ? day(d) : null
}

export function msUntil(value, from = new Date()) {
  const t = toDate(value, { endOfDay: true })
  return t ? t.getTime() - from.getTime() : null
}

export function daysUntil(value, from = new Date()) {
  const d = dayOf(value)
  return d == null ? null : between(day(from), d)
}

/* ---- Formatting ------------------------------------------ */

const fmt = (s, opts) => parseISO(s).toLocaleDateString(undefined, opts)

export const fmtShort   = (s) => fmt(s, { month: 'short', day: 'numeric' })
export const fmtLong    = (s) => fmt(s, { weekday: 'long', month: 'long', day: 'numeric' })
export const fmtWeekday = (s) => fmt(s, { weekday: 'short' })
export const fmtInitial = (s) => fmt(s, { weekday: 'narrow' })
export const fmtMonth   = (y, m) => new Date(y, m, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })

export function fmtMoment(value) {
  const d = toDate(value, { endOfDay: true })
  if (!d) return ''
  const sameYear = d.getFullYear() === new Date().getFullYear()
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }) })
    + ', ' + d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

/** 'Today' / 'Tomorrow' / 'in 4 days' / '2 days ago' / 'Sep 8'. */
export function fmtRelative(value, from = new Date()) {
  const d = daysUntil(value, from)
  if (d == null) return ''
  if (d === 0) return 'Today'
  if (d === 1) return 'Tomorrow'
  if (d === -1) return 'Yesterday'
  if (d > 1 && d <= 6) return `in ${d} days`
  if (d < -1 && d >= -6) return `${-d} days ago`
  return fmtShort(dayOf(value))
}

/** Compact countdown: '42m', '6h 10m', '3d', '2d overdue'. */
export function countdown(value, from = new Date()) {
  const ms = msUntil(value, from)
  if (ms == null) return null
  const abs = Math.abs(ms)
  const mins = Math.round(abs / 60000)
  const hrs = Math.floor(mins / 60)
  const days = Math.floor(hrs / 24)
  let core
  if (mins < 1) core = 'now'
  else if (mins < 60) core = `${mins}m`
  else if (hrs < 24) core = `${hrs}h ${mins % 60}m`
  else if (days < 14) core = hrs % 24 ? `${days}d ${hrs % 24}h` : `${days}d`
  else core = `${days}d`
  return ms < 0 ? `${core} overdue` : core
}

/** 95 → '1h 35m'. */
export function fmtMins(mins) {
  const m = Math.max(0, Math.round(Number(mins) || 0))
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  return m % 60 ? `${h}h ${m % 60}m` : `${h}h`
}

export function greeting(name = '') {
  const h = new Date().getHours()
  const part = h < 5 ? 'Still up' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
  return name ? `${part}, ${name}` : part
}

export const partOfDay = (d = new Date()) => {
  const h = d.getHours()
  return h < 5 ? 'night' : h < 12 ? 'morning' : h < 17 ? 'afternoon' : h < 21 ? 'evening' : 'night'
}
