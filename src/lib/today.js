/* ============================================================
   TODAY PLAN — the intelligence behind the command center.
   Pure functions over stored state. Everything returned here is
   derived from data the user actually entered; when there is
   nothing to say, the functions return empty arrays rather than
   inventing a suggestion.
   ============================================================ */
import { dayStr, prettyTime, minutesLabel } from './dates.js'
import { activeHabits, isDone, eligibleOn, habitStreak } from './stats.js'
import { assignmentStatus, projectStatus, projectProgress, assignmentProgress } from './work.js'
import { isScheduled } from './schedule.js'

const PRIORITY_RANK = { high: 0, normal: 1, low: 2 }

/**
 * Today's priorities: what genuinely matters today, in the order a
 * person would want to see it.
 *
 * 1. anything already overdue (a real cost, not a preference)
 * 2. anything due today
 * 3. the highest-priority habit still undone
 *
 * Each row carries an honest reason string.
 */
export function todayPriorities(state, { now = new Date(), limit = 4 } = {}) {
  const today = dayStr(now)
  const rows = []

  for (const a of state.assignments || []) {
    if (a.archived || a.completedAt) continue
    const st = assignmentStatus(a, now)
    if (st.complete) continue
    const overdue = st.passed === true
    const dueToday = st.daysLeft === 0 && !overdue
    if (overdue || dueToday) {
      rows.push({
        kind: 'assignment',
        id: a.id,
        name: a.name,
        href: `assignments/${a.id}`,
        tone: overdue ? 'bad' : 'warn',
        pct: assignmentProgress(a).pct,
        reason: st.dueText || (overdue ? 'Overdue' : 'Due today'),
        urgency: overdue ? 0 : 2,
        weight: PRIORITY_RANK[a.priority] ?? 1,
      })
    }
  }

  for (const p of state.projects || []) {
    if (p.archived || p.completedAt) continue
    const st = projectStatus(p, now)
    if (st.complete) continue
    const overdue = st.passed === true
    const dueToday = st.daysLeft === 0 && !overdue
    if (overdue || dueToday) {
      rows.push({
        kind: 'project',
        id: p.id,
        name: p.name,
        href: `projects/${p.id}`,
        tone: overdue ? 'bad' : 'warn',
        pct: projectProgress(p).pct,
        reason: st.dueText || (overdue ? 'Overdue' : 'Due today'),
        urgency: overdue ? 0 : 2,
        weight: PRIORITY_RANK[p.priority] ?? 1,
      })
    }
    // tasks due today inside an open project
    for (const m of p.milestones || []) {
      for (const t of m.tasks || []) {
        if (t.done || !t.due || t.due !== today) continue
        rows.push({
          kind: 'task',
          id: `${p.id}:${t.id}`,
          name: t.name,
          href: `projects/${p.id}`,
          tone: 'warn',
          pct: 0,
          reason: `Task in ${p.name} · due today`,
          urgency: 2,
          weight: PRIORITY_RANK[t.priority] ?? 1,
        })
      }
    }
  }

  // Undone habits scheduled today — the backbone of the day
  for (const h of activeHabits(state)) {
    if (!isScheduled(h, today) || !eligibleOn(h, today)) continue
    if (isDone(state, h.id, today)) continue
    const streak = habitStreak(state, h)
    rows.push({
      kind: 'habit',
      id: h.id,
      name: h.name,
      href: `habits/${h.id}`,
      tone: streak >= 7 ? 'warn' : 'neutral',
      pct: 0,
      reason: streak >= 7 ? `${streak}-day streak at risk` : 'Scheduled today',
      urgency: streak >= 7 ? 1 : 3,
      weight: PRIORITY_RANK[h.priority] ?? 1,
    })
  }

  rows.sort((a, b) => a.urgency - b.urgency || a.weight - b.weight || a.name.localeCompare(b.name))
  return rows.slice(0, limit)
}

/**
 * A day timeline built from real times only:
 *  - habit reminders the user actually set
 *  - deadlines that fall on this exact day
 * Habits without a reminder are listed last as "any time" — the app never
 * guesses a time for them.
 */
export function dayTimeline(state, { now = new Date(), date = dayStr(now) } = {}) {
  const entries = []

  for (const h of activeHabits(state)) {
    if (!isScheduled(h, date) || !eligibleOn(h, date)) continue
    const done = isDone(state, h.id, date)
    if (h.reminder && /^\d{2}:\d{2}$/.test(h.reminder)) {
      entries.push({
        time: h.reminder,
        sort: h.reminder,
        label: h.name,
        kind: 'habit',
        done,
        href: `habits/${h.id}`,
        note: 'Reminder',
      })
    } else {
      entries.push({
        time: null,
        sort: '99:99',
        label: h.name,
        kind: 'habit',
        done,
        href: `habits/${h.id}`,
        note: 'Any time',
      })
    }
  }

  const dueThisDay = (value) => value && String(value).slice(0, 10) === date
  const timeOf = (value) => String(value).slice(11, 16) || null

  for (const a of state.assignments || []) {
    if (a.archived || !dueThisDay(a.deadline)) continue
    entries.push({
      time: timeOf(a.deadline),
      sort: timeOf(a.deadline) || '99:99',
      label: a.name,
      kind: 'assignment',
      done: Boolean(a.completedAt),
      href: `assignments/${a.id}`,
      note: 'Deadline',
      tone: a.completedAt ? 'good' : 'warn',
    })
  }

  for (const p of state.projects || []) {
    if (p.archived || !dueThisDay(p.deadline)) continue
    entries.push({
      time: timeOf(p.deadline),
      sort: timeOf(p.deadline) || '99:99',
      label: p.name,
      kind: 'project',
      done: Boolean(p.completedAt),
      href: `projects/${p.id}`,
      note: 'Due today',
      tone: p.completedAt ? 'good' : 'warn',
    })
  }

  entries.sort((a, b) => a.sort.localeCompare(b.sort) || a.label.localeCompare(b.label))
  return entries
}

/**
 * Open goals — outcomes with a deadline, ordered by how close they are.
 * (Goals are currently expressed as projects; this keeps the Today view
 * honest about that rather than inventing a second, empty concept.)
 */
export function todayGoals(state, { now = new Date(), limit = 3 } = {}) {
  const rows = []
  for (const p of state.projects || []) {
    if (p.archived || p.completedAt) continue
    const st = projectStatus(p, now)
    const { pct } = projectProgress(p)
    if (st.complete) continue
    // Share the deadline engine's local/end-of-day semantics with Work.
    const dueIn = st.daysLeft
    const hoursLeft = st.hoursLeft
    const expected = st.elapsedPct
    rows.push({
      id: p.id,
      name: p.name,
      href: `projects/${p.id}`,
      pct,
      expected,
      tone: st.tone,
      dueIn,
      dueText: st.dueText,
      hoursLeft,
      behind: expected != null ? Math.round(expected - pct) : null,
      estimatedMin: Number.isFinite(p.estimateMin) ? p.estimateMin : null,
      actualMin: Number.isFinite(p.actualMin) ? p.actualMin : null,
    })
  }
  rows.sort((a, b) => (a.dueIn ?? 1e9) - (b.dueIn ?? 1e9) || b.pct - a.pct)
  return rows.slice(0, limit)
}

/** The one line Today shows under the priorities heading. */
export function todayHeadline(state, { now = new Date() } = {}) {
  const priorities = todayPriorities(state, { now, limit: 99 })
  const overdue = priorities.filter((p) => p.tone === 'bad').length
  const dueToday = priorities.filter((p) => p.tone === 'warn' && p.kind !== 'habit').length

  if (overdue > 0) {
    return { tone: 'bad', text: `${overdue} item${overdue === 1 ? '' : 's'} already overdue. Start there.` }
  }
  if (dueToday > 0) {
    return { tone: 'warn', text: `${dueToday} thing${dueToday === 1 ? '' : 's'} due today.` }
  }
  if (priorities.length === 0) {
    return { tone: 'good', text: 'Nothing overdue and nothing due today.' }
  }
  return {
    tone: 'neutral',
    text: `It is ${prettyTime(now)}. ${priorities.length} thing${priorities.length === 1 ? '' : 's'} on the list.`,
  }
}

export { minutesLabel }
