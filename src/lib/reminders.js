/* Reminders — Web Notifications, permission asked only on explicit user intent.
   Notifications fire while the app is open (web platform limit, stated in UI). */
import { projectStatus, assignmentStatus } from './work.js'

export const notificationsSupported = () => typeof window !== 'undefined' && 'Notification' in window

export const notificationState = () => {
  if (!notificationsSupported()) return 'unsupported'
  return Notification.permission // 'granted' | 'denied' | 'default'
}

/** Ask only in response to an explicit user action (e.g. saving a reminder). */
export async function requestNotificationPermission() {
  if (!notificationsSupported()) return 'unsupported'
  try {
    return await Notification.requestPermission()
  } catch {
    return 'denied'
  }
}

const FIRED_KEY = 'aaru.reminders.fired'

function firedToday() {
  try {
    const map = JSON.parse(localStorage.getItem(FIRED_KEY) || '{}')
    return map
  } catch {
    return {}
  }
}

function markFired(date, habitId) {
  try {
    const map = firedToday()
    // keep map small: only current date
    const next = { [date]: [...new Set([...(map[date] || []), habitId])] }
    localStorage.setItem(FIRED_KEY, JSON.stringify(next))
  } catch { /* non-fatal */ }
}

export function alreadyFired(date, habitId) {
  return (firedToday()[date] || []).includes(habitId)
}

export function notify(habit) {
  try {
    const n = new Notification(`${habit.name}`, {
      body: 'Scheduled for now — a tap in the app marks it done.',
      tag: `aaru-habit-${habit.id}`,
      icon: './icon-192.png',
    })
    n.onclick = () => { window.focus(); n.close() }
    return true
  } catch {
    return false
  }
}

/**
 * Called on a 30s interval by the app. Returns habits that fired, so the
 * shell can show a toast fallback when notifications are unavailable.
 */
export function checkReminders(state, nowTime, todayDate) {
  const due = []
  for (const h of state.habits || []) {
    if (h.archived || !h.reminder || h.reminder !== nowTime) continue
    if (alreadyFired(todayDate, h.id)) continue
    const sched = h.schedule || { type: 'daily' }
    if (sched.type === 'weekdays' && !(sched.days || []).includes(new Date(`${todayDate}T12:00:00`).getDay())) continue
    const done = state.checkins?.[h.id]?.[todayDate]?.done === true
    if (done) continue
    due.push(h)
    markFired(todayDate, h.id)
  }
  return due
}

/* ------------------------------------------------------------
   WORK DEADLINE ALERTS
   Only real deadlines on open items. Once per item per day.
   ------------------------------------------------------------ */

const WORK_FIRED_KEY = 'aaru.work.alerts'

function workFiredMap() {
  try {
    return JSON.parse(localStorage.getItem(WORK_FIRED_KEY) || '{}')
  } catch {
    return {}
  }
}

function markWorkFired(date, key) {
  try {
    const map = workFiredMap()
    localStorage.setItem(WORK_FIRED_KEY, JSON.stringify({ [date]: [...new Set([...(map[date] || []), key])] }))
  } catch { /* non-fatal */ }
}

export function workAlertFired(date, key) {
  return (workFiredMap()[date] || []).includes(key)
}

export function notifyWork(kind, item, status) {
  try {
    const n = new Notification(`${item.name} — ${status.dueText || 'deadline approaching'}`, {
      body: `${kind === 'project' ? 'Project' : 'Assignment'} is at ${status.pct}%.`,
      tag: `aaru-${kind}-${item.id}`,
      icon: './icon-192.png',
    })
    n.onclick = () => {
      window.focus()
      window.location.hash = `#/${kind}s/${item.id}`
      n.close()
    }
    return true
  } catch {
    return false
  }
}

/**
 * Open projects/assignments whose deadline lands within `thresholdHours`
 * (overdue items always qualify). Each one alerts once per day.
 * @returns {{kind:string,item:object,status:object}[]}
 */
export function checkWorkReminders(state, { now = new Date(), thresholdHours = 24 } = {}) {
  const day = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const out = []
  const consider = (kind, item, status) => {
    if (!item || !item.deadline || status.complete || !status.hasDeadline) return
    if (status.hoursLeft == null) return
    if (status.hoursLeft > thresholdHours) return
    const key = `${kind}:${item.id}`
    if (workAlertFired(day, key)) return
    markWorkFired(day, key)
    out.push({ kind, item, status })
  }
  for (const p of state.projects || []) {
    if (p.completedAt || p.archived) continue
    consider('project', p, projectStatus(p, now))
  }
  for (const a of state.assignments || []) {
    if (a.completedAt || a.archived) continue
    consider('assignment', a, assignmentStatus(a, now))
  }
  return out
}
