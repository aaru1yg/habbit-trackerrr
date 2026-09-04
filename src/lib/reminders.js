/* Reminders — Web Notifications, permission asked only on explicit user intent.
   Notifications fire while the app is open (web platform limit, stated in UI). */

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
