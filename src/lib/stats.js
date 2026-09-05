/* ============================================================
   STATS — every number in the UI is derived here from real
   stored data. No fabrication, ever: functions return null /
   { enough: false } when data is insufficient.
   ============================================================ */
import { todayStr, dayStr, addDaysStr, subDaysStr, weekDays, isValidDayStr } from './dates.js'
import { isScheduled } from './schedule.js'

export const activeHabits = (state) =>
  (state.habits || []).filter((h) => !h.archived).sort((a, b) => (a.order ?? 0) - (b.order ?? 0))

export const checkinOf = (state, habitId, date) =>
  (state.checkins?.[habitId]?.[date]) || null

export const isDone = (state, habitId, date) =>
  checkinOf(state, habitId, date)?.done === true

/** A habit counts toward a date only if it existed, is active, and is scheduled that day.
 *  History starts at creation — nothing before it is counted or claimed. */
export const eligibleOn = (habit, date) =>
  !habit.archived && (!habit.createdAt || date >= habit.createdAt) && isScheduled(habit, date)

/** Can the user log this habit on this date in the UI? Same rule as eligibleOn. */
export const loggableOn = eligibleOn

/** Day roll-up over eligible habits. */
export function dayStats(state, date) {
  const habits = activeHabits(state).filter((h) => eligibleOn(h, date))
  let done = 0
  for (const h of habits) if (isDone(state, h.id, date)) done++
  const total = habits.length
  return { date, done, total, pct: total ? Math.round((done / total) * 100) : null }
}

/** Today snapshot. */
export const todayStats = (state) => dayStats(state, todayStr())

/**
 * Current streak: consecutive eligible days completed, counting back from
 * today. Today, if eligible and not yet done, is forgiven (streak still
 * alive from yesterday). Non-scheduled days are skipped, not counted.
 */
export function habitStreak(state, habit) {
  const cursor0 = todayStr()
  let cursor = cursor0
  let streak = 0
  if (!eligibleOn(habit, cursor) || !isDone(state, habit.id, cursor)) cursor = subDaysStr(cursor, 1)
  // guard: cap walk at 5 years
  for (let i = 0; i < 1825; i++) {
    if (!eligibleOn(habit, cursor)) {
      cursor = subDaysStr(cursor, 1)
      continue
    }
    if (isDone(state, habit.id, cursor)) {
      streak++
      cursor = subDaysStr(cursor, 1)
    } else break
  }
  return streak
}

/** Longest streak ever recorded for a habit (walks its real check-ins). */
export function habitBestStreak(state, habit) {
  const dates = Object.keys(state.checkins?.[habit.id] || {})
    .filter((d) => isValidDayStr(d) && isDone(state, habit.id, d) && eligibleOn(habit, d))
    .sort()
  let best = 0
  let run = 0
  let prev = null
  for (const d of dates) {
    if (prev && addDaysStr(prev, 1) === d) run++
    else run = 1
    if (run > best) best = run
    prev = d
  }
  return best
}

/** Completion rate for a habit across [from, to] (inclusive). Null when insufficient data. */
export function habitRate(state, habit, from, to) {
  let done = 0
  let eligible = 0
  let cursor = from
  while (cursor <= to) {
    if (eligibleOn(habit, cursor)) {
      eligible++
      if (isDone(state, habit.id, cursor)) done++
    }
    cursor = addDaysStr(cursor, 1)
  }
  return { done, eligible, rate: eligible ? done / eligible : null }
}

/** Highest current streak among active habits. */
export function topStreak(state) {
  let top = 0
  let habit = null
  for (const h of activeHabits(state)) {
    const s = habitStreak(state, h)
    if (s > top) { top = s; habit = h }
  }
  return { streak: top, habit }
}

/** Week roll-up (week = array of date strings from weekDays()). */
export function weekStats(state, week) {
  const perDay = week.map((d) => dayStats(state, d))
  let done = 0
  let total = 0
  for (const d of perDay) { done += d.done; total += d.total }
  return {
    perDay,
    done,
    total,
    pct: total ? Math.round((done / total) * 100) : null,
  }
}

/** Compare two weeks. Returns null delta when either week lacks data. */
export function weekDelta(state, thisWeek, lastWeek) {
  const a = weekStats(state, thisWeek)
  const b = weekStats(state, lastWeek)
  if (a.total === 0 || b.total === 0) return { a, b, delta: null }
  return { a, b, delta: a.pct - b.pct }
}

/** Rank habits by completion in a window. Only habits with ≥ minDays eligible days count. */
export function rankHabits(state, from, to, minDays = 3) {
  const ranked = []
  for (const h of activeHabits(state)) {
    const r = habitRate(state, h, from, to)
    if (r.eligible >= minDays && r.rate != null) ranked.push({ habit: h, ...r })
  }
  ranked.sort((x, y) => y.rate - x.rate)
  return ranked
}

export const strongestHabit = (state, from, to) => rankHabits(state, from, to)[0] || null
export const weakestHabit = (state, from, to) => {
  const r = rankHabits(state, from, to)
  return r.length >= 2 ? r[r.length - 1] : null
}

/** Weakest weekday over a window (needs at least 2 samples per weekday). */
export function weakestWeekday(state, weeks = 8) {
  const today = todayStr()
  const from = subDaysStr(today, weeks * 7 - 1)
  const byWeekday = Array.from({ length: 7 }, () => ({ done: 0, total: 0 }))
  let cursor = from
  while (cursor <= today) {
    const s = dayStats(state, cursor)
    if (s.total > 0) {
      const wd = new Date(cursor + 'T12:00:00').getDay()
      byWeekday[wd].done += s.done
      byWeekday[wd].total += s.total
    }
    cursor = addDaysStr(cursor, 1)
  }
  let worst = null
  for (let wd = 0; wd < 7; wd++) {
    const { done, total } = byWeekday[wd]
    if (total < 2) continue // not enough samples
    const rate = done / total
    if (!worst || rate < worst.rate) worst = { weekday: wd, rate, total }
  }
  return worst
}

/** ONE insight for the Today screen — rule-ordered, real data only. */
export function dailyInsight(state) {
  const habits = activeHabits(state)
  if (!habits.length) return null

  const totalCheckins = Object.values(state.checkins || {}).reduce(
    (n, days) => n + Object.values(days || {}).filter((c) => c && c.done).length, 0
  )
  // brand-new user: no pattern claims until something is actually logged
  if (totalCheckins === 0) {
    return { tone: 'neutral', text: 'Your first check-in is the hardest. Tap a habit when it\u2019s done.' }
  }

  const today = todayStats(state)
  if (today.total > 0 && today.done === today.total) {
    return { tone: 'good', text: `All ${today.total} done today. Clean sweep.` }
  }

  // streak milestone
  for (const h of habits) {
    const s = habitStreak(state, h)
    if (s >= 7 && s % 7 === 0) return { tone: 'good', text: `${s}-day streak on ${h.name}. Keep it going.` }
  }

  // strongest habit this month
  const strong = strongestHabit(state, subDaysStr(todayStr(), 29), todayStr(), 5)
  if (strong && strong.rate >= 0.8) {
    return { tone: 'good', text: `${strong.habit.name} is your most consistent habit this month (${Math.round(strong.rate * 100)}%).` }
  }

  // weakest weekday pattern
  const weakDay = weakestWeekday(state, 8)
  if (weakDay && weakDay.rate < 0.6) {
    const names = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    return { tone: 'warn', text: `${names[weakDay.weekday]}s are your hardest day (${Math.round(weakDay.rate * 100)}% completion).` }
  }

  // momentum vs last week (need ≥3 days of data this week)
  const tw = weekDays(todayStr())
  const lw = weekDays(subDaysStr(todayStr(), 7))
  const a = weekStats(state, tw.filter((d) => d <= todayStr()))
  const b = weekStats(state, lw)
  if (a.total >= 3 && b.total >= 3 && a.pct !== b.pct) {
    const diff = a.pct - b.pct
    if (Math.abs(diff) >= 5) {
      return diff > 0
        ? { tone: 'good', text: `Up ${diff}% versus last week. Momentum is building.` }
        : { tone: 'warn', text: `Down ${Math.abs(diff)}% versus last week. A small win today helps.` }
    }
  }

  return { tone: 'neutral', text: `${totalCheckins} check-in${totalCheckins === 1 ? '' : 's'} so far. Every one counts.` }
}

/** Weekly review (Sunday card). Honest when data is thin. */
export function weeklyReview(state) {
  const today = todayStr()
  const thisWeek = weekDays(today)
  const lastWeek = weekDays(subDaysStr(today, 7))
  const d = weekDelta(state, thisWeek, lastWeek)
  const best = strongestHabit(state, subDaysStr(today, 6), today, 3)
  const weak = weakestHabit(state, subDaysStr(today, 6), today, 3)
  const weakDay = weakestWeekday(state, 4)

  const lines = []
  if (d.a.done === 0 && d.b.done === 0) {
    return { enough: false, headline: 'Nothing to review yet', text: 'Check off a few habits this week and a review will appear here.' }
  }
  if (d.delta == null) lines.push(`You completed ${d.a.done} of ${d.a.total} this week.`)
  else if (d.delta === 0) lines.push(`Even with last week: ${d.a.pct}% completion.`)
  else lines.push(`${d.delta > 0 ? 'Up' : 'Down'} ${Math.abs(d.delta)}% versus last week (${d.a.pct}% vs ${d.b.pct}%).`)

  if (best) lines.push(`Best habit: ${best.habit.name} (${Math.round(best.rate * 100)}%).`)
  if (weak && weak.habit.id !== best?.habit.id) lines.push(`Weakest: ${weak.habit.name} (${Math.round(weak.rate * 100)}%).`)

  let suggestion = null
  if (weakDay && weakDay.rate < 0.7) {
    const names = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    suggestion = `${names[weakDay.weekday]} was your weakest day. Try moving habits earlier and see if it sticks.`
  } else if (weak && weak.habit.id !== best?.habit.id) {
    suggestion = `Try pairing ${weak.habit.name} with a habit that\u2019s already working, like ${best?.habit.name || 'your morning routine'}.`
  } else if (best && d.delta != null && d.delta < 0) {
    suggestion = 'Pick one habit to protect this week — the rest can flex.'
  }

  return { enough: true, headline: 'Your week in review', lines, suggestion }
}

/* ---------------- Achievements (real streak thresholds) ---------------- */

export const BADGES = [
  { id: 'bronze', label: 'Bronze', threshold: 3, blurb: '3-day best streak' },
  { id: 'silver', label: 'Silver', threshold: 7, blurb: '7-day best streak' },
  { id: 'gold', label: 'Gold', threshold: 30, blurb: '30-day best streak' },
  { id: 'diamond', label: 'Diamond', threshold: 100, blurb: '100-day best streak' },
]

export function achievements(state) {
  const habits = activeHabits(state)
  let best = 0
  const perHabit = []
  for (const h of habits) {
    const b = habitBestStreak(state, h)
    perHabit.push({ habit: h, best: b })
    if (b > best) best = b
  }
  const badges = BADGES.map((b) => ({ ...b, earned: best >= b.threshold, progress: Math.min(1, best / b.threshold) }))
  const next = badges.find((b) => !b.earned) || null
  return { best, badges, next, perHabit: perHabit.sort((a, b) => b.best - a.best) }
}

/* ---------------- Year heatmap ---------------- */

export function monthLevels(state, year, month) {
  const count = new Date(year, month + 1, 0).getDate()
  const today = todayStr()
  const cells = []
  let anyEligible = false
  for (let d = 1; d <= count; d++) {
    const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    const future = date > today
    const s = future ? { pct: null, total: 0 } : dayStats(state, date)
    if (!future && s.total > 0) anyEligible = true
    cells.push({ date, day: d, pct: s.pct, future, noData: !future && s.total === 0 })
  }
  return { cells, anyEligible }
}

/** 12 mini-months for the year overview. */
export function yearOverview(state, year) {
  const months = []
  for (let m = 0; m < 12; m++) months.push({ month: m, ...monthLevels(state, year, m) })
  return months
}

/* ---------------- Mood ---------------- */

export const MOODS = [
  { score: 1, label: 'Rough', color: '#fb7185' },
  { score: 2, label: 'Low', color: '#fb923c' },
  { score: 3, label: 'Okay', color: '#facc15' },
  { score: 4, label: 'Good', color: '#4ade80' },
  { score: 5, label: 'Great', color: '#22d3ee' },
]

export const moodOf = (state, date) => state.moods?.[date] || null

export function moodStats(state, days = 30) {
  const today = todayStr()
  const entries = []
  for (let i = days - 1; i >= 0; i--) {
    const d = subDaysStr(today, i)
    const m = moodOf(state, d)
    if (m && m.score) entries.push({ date: d, ...m })
  }
  if (!entries.length) return { entries, avg: null, count: 0 }
  const avg = entries.reduce((s, e) => s + e.score, 0) / entries.length
  return { entries, avg: Math.round(avg * 10) / 10, count: entries.length }
}

/** Habit completion on days with mood ≥4 vs ≤2 — only when both sides have data. */
export function moodHabitLink(state, days = 30) {
  const today = todayStr()
  let goodDone = 0, goodTotal = 0, lowDone = 0, lowTotal = 0
  for (let i = 0; i < days; i++) {
    const d = subDaysStr(today, i)
    const m = moodOf(state, d)
    const s = dayStats(state, d)
    if (!m || !m.score || s.total === 0) continue
    if (m.score >= 4) { goodDone += s.done; goodTotal += s.total }
    else if (m.score <= 2) { lowDone += s.done; lowTotal += s.total }
  }
  if (goodTotal < 2 || lowTotal < 2) return null
  return {
    goodPct: Math.round((goodDone / goodTotal) * 100),
    lowPct: Math.round((lowDone / lowTotal) * 100),
  }
}

/* ---------------- Work (projects / assignments) ----------------
   The work engine lives in ./work.js — projects and assignments are a
   separate system with their own deadline math. Re-exported here so
   habit-side code has one import surface. */
export { projectPercent as projectProgress, projectProgress as projectProgressDetail, assignmentProgress } from './work.js'

export function projectStats(state) {
  const projects = (state.projects || []).filter((p) => !p.archived)
  const active = projects.filter((p) => !p.completedAt)
  const completed = projects.filter((p) => p.completedAt)
  return { active, completed, total: projects.length }
}

/* ---------------- Routines (habit stacking) ---------------- */

export const activeRoutines = (state) =>
  (state.routines || []).filter((r) => r.active !== false).sort((a, b) => (a.order ?? 0) - (b.order ?? 0))

/** Routine completion on a date: only counts habits that exist, are in the
 *  routine, and are scheduled that day. */
export function routineStats(state, routine, date = todayStr()) {
  const habits = (routine?.habitIds || [])
    .map((id) => (state.habits || []).find((h) => h.id === id))
    .filter((h) => h && !h.archived && eligibleOn(h, date))
  const done = habits.filter((h) => isDone(state, h.id, date)).length
  return { habits, done, total: habits.length, pct: habits.length ? Math.round((done / habits.length) * 100) : null }
}

/** How often a routine was fully completed over a window (real data only). */
export function routineRate(state, routine, from, to) {
  let days = 0
  let full = 0
  let done = 0
  let total = 0
  let cursor = from
  while (cursor <= to) {
    const s = routineStats(state, routine, cursor)
    if (s.total > 0) {
      days++
      done += s.done
      total += s.total
      if (s.done === s.total) full++
    }
    cursor = addDaysStr(cursor, 1)
  }
  return { days, full, done, total, rate: total ? done / total : null, fullRate: days ? full / days : null }
}

/* ============================================================
   ANALYTICS (chart kit data) — pure, testable derivations.
   Every series below is derived from real check-ins only.
   ============================================================ */

/** Daily completion series for the last `days` days (oldest → newest). */
export function trendSeries(state, days) {
  const today = todayStr()
  const rows = []
  for (let i = days - 1; i >= 0; i--) {
    const d = subDaysStr(today, i)
    const s = dayStats(state, d)
    rows.push({ date: d, pct: s.pct, done: s.done, total: s.total })
  }
  return rows
}

/** Heat level 0..4 for a completion percentage (GitHub-style). */
export const heatLevel = (pct) => {
  if (pct == null) return 0
  if (pct >= 90) return 4
  if (pct >= 60) return 3
  if (pct >= 30) return 2
  if (pct > 0) return 1
  return 0
}

/**
 * GitHub-style heatmap: an array of weeks (Sun-first), oldest → newest.
 * Each week is an array of 7 cells { date, weekday, pct, level, future }.
 * Covers the trailing `weeks` weeks ending today.
 */
export function heatmapSeries(state, weeks) {
  const today = todayStr()
  const endDate = new Date(`${today}T12:00:00`)
  // walk back to the most recent Sunday, then step forward by full weeks
  const start = new Date(`${subDaysStr(today, weeks * 7 - 1)}T12:00:00`)
  while (start.getDay() !== 0) start.setDate(start.getDate() - 1)
  const cols = []
  const cursor = new Date(start)
  while (cursor <= endDate) {
    const col = []
    for (let wd = 0; wd < 7; wd++) {
      const date = dayStr(cursor)
      const future = date > today
      const s = future ? { pct: null, total: 0 } : dayStats(state, date)
      col.push({ date, weekday: wd, pct: s.pct, level: heatLevel(s.pct), future: future || s.total === 0 })
      cursor.setDate(cursor.getDate() + 1)
    }
    cols.push(col)
  }
  return cols
}

/** Habit × day matrix: one row per active habit, one cell per day (oldest → newest). */
export function habitMatrix(state, days) {
  const today = todayStr()
  return activeHabits(state).map((habit) => ({
    habit,
    cells: days.map((d) => {
      const future = d > today
      const scheduled = eligibleOn(habit, d) && !future
      return { date: d, scheduled, done: !future && isDone(state, habit.id, d), future }
    }),
  }))
}

/** This week vs last week roll-up + signed delta (null when either side lacks data). */
export function weekComparison(state) {
  const today = todayStr()
  const thisWeek = weekStats(state, weekDays(today))
  const lastWeek = weekStats(state, weekDays(subDaysStr(today, 7)))
  const delta = thisWeek.total && lastWeek.total ? thisWeek.pct - lastWeek.pct : null
  return { thisWeek, lastWeek, delta }
}

/** Per-habit performance rows (30d rate + current streak + best streak). */
export function habitPerformance(state, from, to) {
  return activeHabits(state).map((habit) => {
    const r = habitRate(state, habit, from, to)
    return {
      habit,
      rate: r.rate,
      done: r.done,
      eligible: r.eligible,
      streak: habitStreak(state, habit),
      best: habitBestStreak(state, habit),
    }
  })
}
