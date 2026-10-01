/* ============================================================
   COMPUTE — every derived number in the app, in one place.

   Pure functions only: same input, same output, no clock reads
   except through an injected `ref` day. That is what makes the
   whole UI testable and what stops three screens from each
   inventing their own definition of "streak".
   ============================================================ */
import { today, shift, dow, lastDays, weekOf, between, daysUntil, msUntil, dayOf } from './date.js'

/* ============================================================
   HABITS
   ============================================================ */

/** Is this habit meant to be done on this day? */
export function scheduled(habit, d) {
  if (!habit) return false
  if (habit.archivedAt && d >= habit.archivedAt) return false
  if (habit.createdAt && d < habit.createdAt) return false
  const c = habit.cadence
  if (c.type === 'days') return c.days.includes(dow(d))
  return true // 'daily' and 'weekly' are both answerable every day
}

/** The raw logged value for a habit on a day. */
export const valueOn = (checkins, habitId, d) => checkins?.[habitId]?.[d]?.value ?? 0

/** Completion of one habit on one day, as a 0..1 ratio plus flags. */
export function progressOn(habit, checkins, d) {
  const goal = Math.max(1, habit.target.goal || 1)
  const value = valueOn(checkins, habit.id, d)
  return {
    value,
    goal,
    ratio: Math.min(1, value / goal),
    done: value >= goal,
    started: value > 0,
  }
}

/** Days this habit was actually due, from createdAt (or `window` days) to ref. */
function dueDays(habit, ref, window) {
  const start = habit.createdAt && habit.createdAt > shift(ref, -(window - 1))
    ? habit.createdAt
    : shift(ref, -(window - 1))
  const out = []
  let d = start
  while (d <= ref) {
    if (scheduled(habit, d)) out.push(d)
    d = shift(d, 1)
  }
  return out
}

/**
 * Current and best streak.
 *
 * Daily / specific-days habits count consecutive *scheduled* days.
 * A weekly habit ("3× per week") streaks in weeks, because counting
 * days would punish the user for a cadence they chose. Today never
 * breaks a streak until the day is over — it is simply not counted
 * yet, which is the honest reading.
 */
export function streak(habit, checkins, ref = today()) {
  if (habit.cadence.type === 'weekly') return weeklyStreak(habit, checkins, ref)

  const goal = Math.max(1, habit.target.goal || 1)
  const hit = (d) => valueOn(checkins, habit.id, d) >= goal
  const floor = habit.createdAt || shift(ref, -730)

  let current = 0
  let d = ref
  // Today in progress is neutral: skip it unless it is already done.
  if (scheduled(habit, d) && !hit(d)) d = shift(d, -1)
  while (d >= floor) {
    if (scheduled(habit, d)) {
      if (!hit(d)) break
      current++
    }
    d = shift(d, -1)
  }

  let best = 0
  let run = 0
  let cur = floor
  while (cur <= ref) {
    if (scheduled(habit, cur)) {
      if (hit(cur)) { run++; if (run > best) best = run } else run = 0
    }
    cur = shift(cur, 1)
  }

  return { current, best: Math.max(best, current), unit: 'day' }
}

function weeklyStreak(habit, checkins, ref) {
  const need = habit.cadence.perWeek || 3
  const goal = Math.max(1, habit.target.goal || 1)
  const hitsIn = (days) => days.filter((d) => valueOn(checkins, habit.id, d) >= goal).length

  let current = 0
  let anchor = ref
  for (let i = 0; i < 104; i++) {
    const days = weekOf(anchor)
    const isCurrentWeek = i === 0
    const hits = hitsIn(days.filter((d) => d <= ref))
    if (hits >= need) current++
    else if (!isCurrentWeek) break
    anchor = shift(days[0], -1)
  }

  let best = 0
  let run = 0
  const floor = habit.createdAt || shift(ref, -364)
  let cursor = weekOf(floor)[0]
  while (cursor <= ref) {
    const days = weekOf(cursor)
    if (hitsIn(days.filter((d) => d <= ref)) >= need) { run++; if (run > best) best = run }
    else run = 0
    cursor = shift(days[6], 1)
  }
  return { current, best: Math.max(best, current), unit: 'week' }
}

/** Completion rate over the last `window` due days (0..1), plus the counts. */
export function consistency(habit, checkins, window = 30, ref = today()) {
  const days = dueDays(habit, ref, window)
  if (!days.length) return { rate: 0, hit: 0, due: 0 }
  const goal = Math.max(1, habit.target.goal || 1)
  const hit = days.filter((d) => valueOn(checkins, habit.id, d) >= goal).length
  return { rate: hit / days.length, hit, due: days.length }
}

/** Which weekday this habit is strongest/weakest on. Null until there's enough signal. */
export function weekdayProfile(habit, checkins, window = 84, ref = today()) {
  const goal = Math.max(1, habit.target.goal || 1)
  const buckets = Array.from({ length: 7 }, () => ({ due: 0, hit: 0 }))
  for (const d of dueDays(habit, ref, window)) {
    const b = buckets[dow(d)]
    b.due++
    if (valueOn(checkins, habit.id, d) >= goal) b.hit++
  }
  const rated = buckets.map((b, i) => ({ dow: i, ...b, rate: b.due ? b.hit / b.due : null }))
  const usable = rated.filter((r) => r.due >= 3)
  if (usable.length < 3) return { buckets: rated, best: null, worst: null }
  const sorted = [...usable].sort((a, b) => b.rate - a.rate)
  return { buckets: rated, best: sorted[0], worst: sorted[sorted.length - 1] }
}

/** A day's overall habit score: scheduled habits weighted equally. */
export function dayScore(habits, checkins, d) {
  const due = habits.filter((h) => scheduled(h, d))
  if (!due.length) return { ratio: 0, done: 0, due: 0, partial: 0 }
  let sum = 0
  let done = 0
  let partial = 0
  for (const h of due) {
    const p = progressOn(h, checkins, d)
    sum += p.ratio
    if (p.done) done++
    else if (p.started) partial++
  }
  return { ratio: sum / due.length, done, due: due.length, partial }
}

/** Day scores across a range — the series behind every chart. */
export const scoreSeries = (habits, checkins, days) =>
  days.map((d) => ({ day: d, ...dayScore(habits, checkins, d) }))

/* ============================================================
   WORK
   ============================================================ */

/** Honest progress: tasks when they exist, the manual dial otherwise. */
export function workProgress(w) {
  if (w.doneAt) return 100
  if (w.tasks?.length) {
    const done = w.tasks.filter((t) => t.done).length
    return Math.round((done / w.tasks.length) * 100)
  }
  if (w.manual != null) return w.manual
  const last = [...(w.log || [])].reverse().find((e) => e.percent != null)
  return last ? last.percent : 0
}

export const WORK_STATUS = {
  done:     { id: 'done',     label: 'Done',     tone: 'good',    rank: 5 },
  overdue:  { id: 'overdue',  label: 'Overdue',  tone: 'bad',     rank: 0 },
  urgent:   { id: 'urgent',   label: 'Urgent',   tone: 'risk',    rank: 1 },
  atRisk:   { id: 'atRisk',   label: 'At risk',  tone: 'warn',    rank: 2 },
  onTrack:  { id: 'onTrack',  label: 'On track', tone: 'accent',  rank: 3 },
  open:     { id: 'open',     label: 'Open',     tone: 'neutral', rank: 4 },
}

/**
 * Status from real progress vs real time left — never a label the
 * user typed. "At risk" means the clock has run further than the work.
 */
export function workStatus(w, ref = new Date()) {
  if (w.doneAt) return WORK_STATUS.done
  if (!w.deadline) return WORK_STATUS.open

  const ms = msUntil(w.deadline, ref)
  if (ms < 0) return WORK_STATUS.overdue

  const pct = workProgress(w)
  const hours = ms / 3600000
  if (hours <= 24 && pct < 100) return WORK_STATUS.urgent

  const start = w.startedAt || w.createdAt
  if (start) {
    const total = between(start, dayOf(w.deadline))
    if (total > 0) {
      const gone = between(start, dayOf(ref.toISOString().slice(0, 10)) || today())
      const expected = Math.min(100, Math.max(0, (gone / total) * 100))
      if (pct + 12 < expected) return WORK_STATUS.atRisk
    }
  }
  return WORK_STATUS.onTrack
}

/** Points behind (positive) or ahead (negative) of an even pace. */
export function pace(w, ref = today()) {
  if (!w.deadline) return null
  const start = w.startedAt || w.createdAt
  if (!start) return null
  const total = between(start, dayOf(w.deadline))
  if (total <= 0) return null
  const gone = Math.max(0, Math.min(total, between(start, ref)))
  const expected = Math.round((gone / total) * 100)
  return { expected, actual: workProgress(w), delta: workProgress(w) - expected }
}

/** Sort key: what genuinely needs attention first. */
export function urgencyRank(w, ref = new Date()) {
  const s = workStatus(w, ref)
  const ms = msUntil(w.deadline, ref)
  return [s.rank, ms == null ? Number.MAX_SAFE_INTEGER : ms]
}

export function sortByUrgency(list, ref = new Date()) {
  return [...list].sort((a, b) => {
    const ra = urgencyRank(a, ref)
    const rb = urgencyRank(b, ref)
    return ra[0] - rb[0] || ra[1] - rb[1]
  })
}

/** Minutes logged against a work item inside a day range. */
export function minutesLogged(w, days) {
  const set = new Set(days)
  return (w.log || []).reduce((sum, e) => {
    const d = dayOf(e.at)
    return set.has(d) && e.minutes ? sum + e.minutes : sum
  }, 0)
}

/** Items due per day — the workload view, with no invented entries. */
export function dueByDay(work, days) {
  const map = Object.fromEntries(days.map((d) => [d, []]))
  for (const w of work) {
    if (w.doneAt || w.archivedAt || !w.deadline) continue
    const d = dayOf(w.deadline)
    if (d in map) map[d].push(w)
    for (const t of w.tasks || []) {
      if (!t.done && t.due && t.due in map) map[t.due].push({ ...w, _subtask: t })
    }
  }
  return days.map((d) => ({ day: d, items: map[d] }))
}

/* ============================================================
   GOALS
   ============================================================ */

/**
 * A goal's progress is the average of two honest signals, each
 * only counted when it exists: the 30-day consistency of its
 * habits, and the completion of its work items.
 */
export function goalProgress(goal, { habits, checkins, work }, ref = today()) {
  const parts = []

  const linkedHabits = habits.filter((h) => goal.habitIds.includes(h.id) && !h.archivedAt)
  if (linkedHabits.length) {
    const avg = linkedHabits.reduce((s, h) => s + consistency(h, checkins, 30, ref).rate, 0) / linkedHabits.length
    parts.push({ kind: 'habits', value: avg * 100, count: linkedHabits.length })
  }

  const linkedWork = work.filter((w) => w.goalId === goal.id && !w.archivedAt)
  if (linkedWork.length) {
    const avg = linkedWork.reduce((s, w) => s + workProgress(w), 0) / linkedWork.length
    parts.push({ kind: 'work', value: avg, count: linkedWork.length })
  }

  const percent = parts.length
    ? Math.round(parts.reduce((s, p) => s + p.value, 0) / parts.length)
    : 0

  return { percent, parts, linkedHabits, linkedWork, empty: parts.length === 0 }
}

/* ============================================================
   MOOD
   ============================================================ */

/**
 * Correlation between daily habit completion and mood, over days
 * where BOTH exist. Returns null below 8 paired days — a number
 * from five points would be decoration, not information.
 */
export function moodCorrelation(habits, checkins, moods, window = 60, ref = today()) {
  const pairs = []
  for (const d of lastDays(window, ref)) {
    const m = moods[d]?.mood
    if (m == null) continue
    const s = dayScore(habits, checkins, d)
    if (!s.due) continue
    pairs.push([s.ratio, m / 5])
  }
  if (pairs.length < 8) return { r: null, n: pairs.length, need: 8 }

  const n = pairs.length
  const mx = pairs.reduce((s, p) => s + p[0], 0) / n
  const my = pairs.reduce((s, p) => s + p[1], 0) / n
  let num = 0, dx = 0, dy = 0
  for (const [x, y] of pairs) {
    num += (x - mx) * (y - my)
    dx += (x - mx) ** 2
    dy += (y - my) ** 2
  }
  const den = Math.sqrt(dx * dy)
  return { r: den === 0 ? 0 : num / den, n, need: 8 }
}

/* ============================================================
   MILESTONES — earned, never granted.
   ============================================================ */

export const MILESTONES = [
  { id: 'first',   label: 'First check-in',  icon: 'seed', test: (s) => s.totalCheckins >= 1 },
  { id: 'week',    label: '7-day streak',    icon: 'flame', test: (s) => s.bestStreak >= 7 },
  { id: 'month',   label: '30-day streak',   icon: 'bolt', test: (s) => s.bestStreak >= 30 },
  { id: 'hundred', label: '100 check-ins',   icon: 'grid', test: (s) => s.totalCheckins >= 100 },
  { id: 'perfect', label: 'A perfect day',   icon: 'target', test: (s) => s.perfectDays >= 1 },
  { id: 'five',    label: '5 perfect days',  icon: 'medal', test: (s) => s.perfectDays >= 5 },
  { id: 'ship',    label: 'Shipped work',    icon: 'ship', test: (s) => s.workDone >= 1 },
  { id: 'ship5',   label: 'Shipped 5',       icon: 'layers', test: (s) => s.workDone >= 5 },
  { id: 'goal',    label: 'Goal reached',    icon: 'trophy', test: (s) => s.goalsDone >= 1 },
]

export function lifetime(state, ref = today()) {
  const { habits, checkins, work, goals } = state
  let totalCheckins = 0
  for (const days of Object.values(checkins)) totalCheckins += Object.keys(days).length

  let bestStreak = 0
  for (const h of habits) bestStreak = Math.max(bestStreak, streak(h, checkins, ref).best)

  let perfectDays = 0
  const seen = new Set()
  for (const days of Object.values(checkins)) for (const d of Object.keys(days)) seen.add(d)
  for (const d of seen) {
    const s = dayScore(habits, checkins, d)
    if (s.due > 0 && s.done === s.due) perfectDays++
  }

  return {
    totalCheckins,
    bestStreak,
    perfectDays,
    workDone: work.filter((w) => w.doneAt).length,
    goalsDone: goals.filter((g) => g.doneAt).length,
    activeDays: seen.size,
  }
}

export const earnedMilestones = (stats) => MILESTONES.map((m) => ({ ...m, earned: m.test(stats) }))

/* ============================================================
   TODAY — the one function that decides what to show first.

   This replaces v4's four competing "what's next" engines
   (NextAction, AdaptiveHome, AiCoach, planning.js) with a single
   deterministic rule set the user can actually predict.
   ============================================================ */

export function nextUp(state, ref = today(), clock = new Date()) {
  const { habits, checkins, work } = state
  const out = []

  const openWork = work.filter((w) => !w.doneAt && !w.archivedAt)
  for (const w of sortByUrgency(openWork, clock).slice(0, 4)) {
    const s = workStatus(w, clock)
    if (s.rank > 2) break // only overdue / urgent / at-risk earn a slot here
    out.push({ type: 'work', id: w.id, item: w, status: s, reason: reasonFor(w, s) })
  }

  const dueHabits = habits
    .filter((h) => !h.archivedAt && scheduled(h, ref) && !progressOn(h, checkins, ref).done)
    .map((h) => ({ h, st: streak(h, checkins, ref) }))
    .sort((a, b) => b.st.current - a.st.current)

  for (const { h, st } of dueHabits.slice(0, 3)) {
    out.push({
      type: 'habit', id: h.id, item: h,
      reason: st.current >= 2 ? `${st.current}-${st.unit} streak on the line` : null,
    })
  }

  return out.slice(0, 5)
}

function reasonFor(w, s) {
  if (s.id === 'overdue') return 'Past its deadline'
  if (s.id === 'urgent') return 'Due within 24 hours'
  const p = pace(w)
  if (p && p.delta < 0) return `${Math.abs(p.delta)} points behind pace`
  return null
}

export { daysUntil }
