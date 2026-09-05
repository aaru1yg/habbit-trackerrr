/* ============================================================
   ANALYTICS — the deeper layer of the habit system.
   Every function returns honest nulls / `enough: false` when the
   user has not generated the data yet. We never manufacture a
   statistic to fill a card.
   ============================================================ */
import {
  todayStr, dayStr, addDaysStr, subDaysStr, weekDays, isValidDayStr,
  prettyTime, partOfDay, PARTS_OF_DAY, shortDate, dayOf, minutesLabel,
} from './dates.js'
import {
  activeHabits, dayStats, eligibleOn, isDone, habitRate, habitStreak, habitBestStreak,
  achievements, BADGES, activeRoutines,
} from './stats.js'
import { WEEKDAY_NAMES, WEEKDAY_SHORT, weekdayOf } from './schedule.js'
import {
  projectStatus, assignmentStatus, projectProgress, assignmentProgress, allTasks,
} from './work.js'

const MIN_SAMPLES = 3

/* ------------------------------------------------------------
   A. WEEKDAY PERFORMANCE
   ------------------------------------------------------------ */

export function weekdayPerformance(state, weeks = 12) {
  const today = todayStr()
  const from = subDaysStr(today, weeks * 7 - 1)
  const rows = Array.from({ length: 7 }, (_, weekday) => ({
    weekday, label: WEEKDAY_SHORT[weekday], name: WEEKDAY_NAMES[weekday], done: 0, total: 0, rate: null, samples: 0,
  }))
  let cursor = from
  while (cursor <= today) {
    const s = dayStats(state, cursor)
    if (s.total > 0) {
      const r = rows[weekdayOf(cursor)]
      r.done += s.done
      r.total += s.total
      r.samples += 1
    }
    cursor = addDaysStr(cursor, 1)
  }
  for (const r of rows) r.rate = r.total >= MIN_SAMPLES * 2 ? r.done / r.total : null
  const ranked = rows.filter((r) => r.rate != null).sort((a, b) => b.rate - a.rate)
  return {
    rows,
    best: ranked[0] || null,
    worst: ranked.length > 1 ? ranked[ranked.length - 1] : null,
    enough: ranked.length >= 2,
    windowWeeks: weeks,
  }
}

/** Weekday vs weekend split (needs both sides to have real data). */
export function weekdayVsWeekend(state, weeks = 12) {
  const perf = weekdayPerformance(state, weeks)
  const wd = perf.rows.filter((r) => r.weekday >= 1 && r.weekday <= 5)
  const we = perf.rows.filter((r) => r.weekday === 0 || r.weekday === 6)
  const sum = (rows) => ({ done: rows.reduce((n, r) => n + r.done, 0), total: rows.reduce((n, r) => n + r.total, 0) })
  const a = sum(wd)
  const b = sum(we)
  if (a.total < 5 || b.total < 5) return null
  return {
    weekdayPct: Math.round((a.done / a.total) * 100),
    weekendPct: Math.round((b.done / b.total) * 100),
    delta: Math.round((a.done / a.total) * 100) - Math.round((b.done / b.total) * 100),
  }
}

/* ------------------------------------------------------------
   B. CONSISTENCY SCORE
   70% completion rate + 30% longest unbroken run inside the window.
   Rewards rhythm, not just volume — and the UI explains exactly that.
   ------------------------------------------------------------ */

export function consistencyScore(state, habit, days = 90) {
  const today = todayStr()
  const from = subDaysStr(today, days - 1)
  const { done, eligible, rate } = habitRate(state, habit, from, today)
  if (eligible < MIN_SAMPLES || rate == null) return { score: null, rate: null, bestRun: 0, eligible, done, enough: false, days }

  // longest unbroken run of scheduled+completed days inside the window
  let bestRun = 0
  let run = 0
  let cursor = from
  while (cursor <= today) {
    if (eligibleOn(habit, cursor)) {
      if (isDone(state, habit.id, cursor)) { run++; bestRun = Math.max(bestRun, run) } else run = 0
    }
    cursor = addDaysStr(cursor, 1)
  }
  const runRatio = eligible ? bestRun / eligible : 0
  const score = Math.round((rate * 0.7 + Math.min(1, runRatio) * 0.3) * 100)
  return { score, rate, bestRun, eligible, done, enough: true, days }
}

export const consistencyLabel = (score) => {
  if (score == null) return 'Not enough data'
  if (score >= 85) return 'Rock solid'
  if (score >= 70) return 'Strong'
  if (score >= 50) return 'Building'
  if (score >= 30) return 'Uneven'
  return 'Fragile'
}

/** Ranked consistency across active habits. */
export function consistencyRanking(state, days = 90) {
  const rows = activeHabits(state)
    .map((habit) => ({ habit, ...consistencyScore(state, habit, days) }))
    .filter((r) => r.enough)
    .sort((a, b) => b.score - a.score)
  return rows
}

/* ------------------------------------------------------------
   C. STREAK HISTORY
   ------------------------------------------------------------ */

export function streakHistory(state, habit, limit = 6) {
  const today = todayStr()
  const dates = Object.keys(state.checkins?.[habit.id] || {})
    .filter((d) => isValidDayStr(d) && d <= today && isDone(state, habit.id, d) && eligibleOn(habit, d))
    .sort()
  const runs = []
  let run = null
  for (const d of dates) {
    if (run && addDaysStr(run.end, 1) === d) run = { ...run, end: d, length: run.length + 1 }
    else { if (run) runs.push(run); run = { start: d, end: d, length: 1 } }
  }
  if (run) runs.push(run)
  runs.sort((a, b) => b.length - a.length || b.end.localeCompare(a.end))
  const current = habitStreak(state, habit)
  const longest = runs[0]?.length || 0
  // interruptions = gaps between runs of length ≥ 2 (a real break, not a single day)
  const meaningful = runs.filter((r) => r.length >= 2).sort((a, b) => a.start.localeCompare(b.start))
  const interruptions = Math.max(0, meaningful.length - 1)
  return { runs: runs.slice(0, limit), current, longest, interruptions, totalRuns: runs.length, enough: runs.length > 0 }
}

/* ------------------------------------------------------------
   D. COMPLETION DISTRIBUTION
   ------------------------------------------------------------ */

export const DISTRIBUTION_BUCKETS = [
  { id: 'low', label: '0–24%', min: 0, max: 24 },
  { id: 'mid', label: '25–49%', min: 25, max: 49 },
  { id: 'high', label: '50–74%', min: 50, max: 74 },
  { id: 'full', label: '75–100%', min: 75, max: 100 },
]

export function completionDistribution(state, days = 90) {
  const today = todayStr()
  const buckets = DISTRIBUTION_BUCKETS.map((b) => ({ ...b, count: 0 }))
  let sampled = 0
  let cursor = subDaysStr(today, days - 1)
  while (cursor <= today) {
    const s = dayStats(state, cursor)
    if (s.total > 0 && s.pct != null) {
      sampled++
      const b = buckets.find((x) => s.pct >= x.min && s.pct <= x.max)
      if (b) b.count++
    }
    cursor = addDaysStr(cursor, 1)
  }
  return {
    buckets: buckets.map((b) => ({ ...b, pct: sampled ? Math.round((b.count / sampled) * 100) : 0 })),
    sampled,
    enough: sampled >= 7,
    perfectDays: buckets[3].count,
  }
}

/* ------------------------------------------------------------
   E. TIME-OF-DAY PERFORMANCE (only when real timestamps exist)
   ------------------------------------------------------------ */

export function timeOfDayPerformance(state, days = 90) {
  const today = todayStr()
  const from = subDaysStr(today, days - 1)
  const counts = Object.fromEntries(PARTS_OF_DAY.map((p) => [p, 0]))
  let total = 0
  for (const [habitId, dayMap] of Object.entries(state.checkins || {})) {
    const habit = (state.habits || []).find((h) => h.id === habitId)
    if (!habit) continue
    for (const [date, entry] of Object.entries(dayMap || {})) {
      if (!entry?.done || !entry.at || date < from || date > today) continue
      const part = partOfDay(entry.at)
      if (part) { counts[part]++; total++ }
    }
  }
  if (total < 8) return { parts: [], total, enough: false }
  const peak = PARTS_OF_DAY.reduce((best, p) => (counts[p] > (counts[best] || 0) ? p : best), PARTS_OF_DAY[0])
  return {
    parts: PARTS_OF_DAY.map((p) => ({ id: p, label: p[0].toUpperCase() + p.slice(1), count: counts[p], pct: Math.round((counts[p] / total) * 100) })),
    total,
    peak,
    enough: true,
  }
}

/* ------------------------------------------------------------
   F. CORRELATIONS — co-occurrence, never causation
   ------------------------------------------------------------ */

function coOccurrence(state, a, b, days) {
  const today = todayStr()
  const from = subDaysStr(today, days - 1)
  let withDone = 0, withTotal = 0, withoutDone = 0, withoutTotal = 0
  let cursor = from
  while (cursor <= today) {
    if (!eligibleOn(a, cursor) || !eligibleOn(b, cursor)) { cursor = addDaysStr(cursor, 1); continue }
    const aDone = isDone(state, a.id, cursor)
    if (aDone) { withTotal++; if (isDone(state, b.id, cursor)) withDone++ }
    else { withoutTotal++; if (isDone(state, b.id, cursor)) withoutDone++ }
    cursor = addDaysStr(cursor, 1)
  }
  if (withTotal < 4 || withoutTotal < 4) return null
  const withRate = withDone / withTotal
  const withoutRate = withoutDone / withoutTotal
  const delta = Math.round((withRate - withoutRate) * 100)
  if (Math.abs(delta) < 15) return null
  return { withRate: Math.round(withRate * 100), withoutRate: Math.round(withoutRate * 100), delta, withTotal, withoutTotal }
}

export function habitCorrelations(state, days = 60, limit = 4) {
  const habits = activeHabits(state).filter((h) => habitRate(state, h, subDaysStr(todayStr(), days - 1), todayStr()).eligible >= 8)
  const out = []
  for (let i = 0; i < habits.length; i++) {
    for (let j = i + 1; j < habits.length; j++) {
      const c = coOccurrence(state, habits[i], habits[j], days)
      if (c) out.push({ a: habits[i], b: habits[j], ...c })
    }
  }
  out.sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta))
  return { pairs: out.slice(0, limit), enough: out.length > 0 }
}

/** Habit vs mood / energy / focus (only where both sides have real entries). */
export function moodCorrelations(state, days = 60) {
  const today = todayStr()
  const from = subDaysStr(today, days - 1)
  const dims = ['score', 'energy', 'focus', 'motivation']
  const habits = activeHabits(state).filter((h) => habitRate(state, h, from, today).eligible >= 8)
  const out = []
  for (const dim of dims) {
    let highDone = 0, highTotal = 0, lowDone = 0, lowTotal = 0
    let cursor = from
    while (cursor <= today) {
      const m = state.moods?.[cursor]
      const s = dayStats(state, cursor)
      if (m && Number.isFinite(m[dim]) && s.total > 0) {
        if (m[dim] >= 4) { highDone += s.done; highTotal += s.total }
        else if (m[dim] <= 2) { lowDone += s.done; lowTotal += s.total }
      }
      cursor = addDaysStr(cursor, 1)
    }
    if (highTotal < 4 || lowTotal < 4) continue
    const highPct = Math.round((highDone / highTotal) * 100)
    const lowPct = Math.round((lowDone / lowTotal) * 100)
    if (Math.abs(highPct - lowPct) < 10) continue
    out.push({ dim, highPct, lowPct, delta: highPct - lowPct, highTotal, lowTotal })
  }
  return { rows: out, enough: out.length > 0 }
}

/* ------------------------------------------------------------
   G. MONTHLY PULSE
   ------------------------------------------------------------ */

export function monthlyPulse(state, year = new Date().getFullYear()) {
  const today = todayStr()
  const months = []
  for (let m = 0; m < 12; m++) {
    const count = new Date(year, m + 1, 0).getDate()
    const from = `${year}-${String(m + 1).padStart(2, '0')}-01`
    const to = `${year}-${String(m + 1).padStart(2, '0')}-${String(count).padStart(2, '0')}`
    if (from > today) { months.push({ month: m, label: shortDate(from).replace(/ \d+/, ''), pct: null, done: 0, total: 0, days: 0, future: true }); continue }
    const end = to > today ? today : to
    let done = 0, total = 0, days = 0, perfect = 0
    let cursor = from
    while (cursor <= end) {
      const s = dayStats(state, cursor)
      if (s.total > 0) { days++; done += s.done; total += s.total; if (s.done === s.total) perfect++ }
      cursor = addDaysStr(cursor, 1)
    }
    months.push({
      month: m,
      label: new Date(year, m, 1).toLocaleDateString('en-US', { month: 'short' }),
      pct: total ? Math.round((done / total) * 100) : null,
      done, total, days, perfect,
      future: false,
    })
  }
  return { months, enough: months.some((m) => m.pct != null) }
}

/* ------------------------------------------------------------
   H. PERSONAL BESTS
   ------------------------------------------------------------ */

export function personalBests(state) {
  const today = todayStr()
  const out = {}

  // best week (last 52 weeks, needs ≥5 scheduled completions)
  let bestWeek = null
  for (let w = 0; w < 52; w++) {
    const anchor = subDaysStr(today, w * 7)
    const days = weekDays(anchor).filter((d) => d <= today)
    let done = 0, total = 0
    for (const d of days) { const s = dayStats(state, d); done += s.done; total += s.total }
    if (total < 5) continue
    const pct = Math.round((done / total) * 100)
    if (!bestWeek || pct > bestWeek.pct) bestWeek = { pct, done, total, start: weekDays(anchor)[0], end: weekDays(anchor)[6] }
  }
  out.bestWeek = bestWeek

  // best month (this year + last year)
  let bestMonth = null
  for (const year of [new Date().getFullYear(), new Date().getFullYear() - 1]) {
    const pulse = monthlyPulse(state, year)
    for (const m of pulse.months) {
      if (m.pct == null || m.total < 10) continue
      if (!bestMonth || m.pct > bestMonth.pct) {
        bestMonth = { pct: m.pct, done: m.done, total: m.total, year, month: m.month, label: `${new Date(year, m.month, 1).toLocaleDateString('en-US', { month: 'long' })} ${year}` }
      }
    }
  }
  out.bestMonth = bestMonth

  // longest streak (across habits, incl. archived history)
  let longest = null
  for (const h of state.habits || []) {
    const b = habitBestStreak(state, h)
    if (b > 0 && (!longest || b > longest.days)) longest = { days: b, habit: h }
  }
  out.longestStreak = longest

  // highest single day
  let bestDay = null
  let cursor = subDaysStr(today, 364)
  while (cursor <= today) {
    const s = dayStats(state, cursor)
    if (s.total >= 3 && s.pct != null && (!bestDay || s.pct > bestDay.pct)) bestDay = { pct: s.pct, date: cursor, done: s.done, total: s.total }
    cursor = addDaysStr(cursor, 1)
  }
  out.bestDay = bestDay

  // most consistent habit (90d)
  const ranked = consistencyRanking(state, 90)
  out.mostConsistent = ranked.length ? { habit: ranked[0].habit, score: ranked[0].score, rate: ranked[0].rate } : null

  // biggest improvement: last 30 days vs the 30 before
  let improvement = null
  for (const h of activeHabits(state)) {
    const recent = habitRate(state, h, subDaysStr(today, 29), today)
    const prior = habitRate(state, h, subDaysStr(today, 59), subDaysStr(today, 30))
    if (recent.eligible < 8 || prior.eligible < 8 || recent.rate == null || prior.rate == null) continue
    const delta = Math.round((recent.rate - prior.rate) * 100)
    if (delta >= 10 && (!improvement || delta > improvement.delta)) improvement = { habit: h, delta, recent: Math.round(recent.rate * 100), prior: Math.round(prior.rate * 100) }
  }
  out.improvement = improvement

  out.totalCheckins = Object.values(state.checkins || {}).reduce(
    (n, days) => n + Object.values(days || {}).filter((c) => c?.done).length, 0)
  out.enough = !!(bestWeek || longest || bestDay)
  return out
}

/* ------------------------------------------------------------
   SMART INSIGHTS (§19) — data-gated, plain language, no causation
   ------------------------------------------------------------ */

export function smartInsights(state, limit = 6) {
  const today = todayStr()
  const habits = activeHabits(state)
  const out = []
  if (!habits.length) return out

  const totalCheckins = personalBests(state).totalCheckins
  if (totalCheckins === 0) return out

  // 1 · strongest weekday
  const wd = weekdayPerformance(state, 12)
  if (wd.enough && wd.best) {
    out.push({
      id: 'weekday-best', tone: 'good', title: 'Strongest weekday',
      text: `Your strongest weekday is ${wd.best.name} (${Math.round(wd.best.rate * 100)}% over ${wd.windowWeeks} weeks).`,
      metric: `${Math.round(wd.best.rate * 100)}%`,
    })
  }
  if (wd.enough && wd.worst && wd.best && wd.worst.weekday !== wd.best.weekday && wd.best.rate - wd.worst.rate >= 0.12) {
    out.push({
      id: 'weekday-worst', tone: 'warn', title: 'Hardest weekday',
      text: `${wd.worst.name}s drop to ${Math.round(wd.worst.rate * 100)}% — ${Math.round((wd.best.rate - wd.worst.rate) * 100)} points below ${wd.best.name}.`,
      metric: `${Math.round(wd.worst.rate * 100)}%`,
    })
  }

  // 2 · weekend split
  const split = weekdayVsWeekend(state, 12)
  if (split && Math.abs(split.delta) >= 10) {
    out.push({
      id: 'weekend-split', tone: split.delta > 0 ? 'neutral' : 'warn', title: 'Weekday vs weekend',
      text: `You complete ${split.weekdayPct}% on weekdays and ${split.weekendPct}% at weekends (${split.delta > 0 ? '+' : ''}${split.delta} points).`,
      metric: `${split.delta > 0 ? '+' : ''}${split.delta}%`,
    })
  }

  // 3 · improvement
  const bests = personalBests(state)
  if (bests.improvement) {
    out.push({
      id: 'improvement', tone: 'good', title: 'Biggest improvement',
      text: `${bests.improvement.habit.name} is up ${bests.improvement.delta} points over the last 30 days (${bests.improvement.prior}% → ${bests.improvement.recent}%).`,
      metric: `+${bests.improvement.delta}%`,
    })
  }

  // 4 · streak milestone proximity
  for (const h of habits) {
    const s = habitStreak(state, h)
    const nextMilestone = [7, 14, 30, 60, 100, 180, 365].find((m) => m > s && m - s <= 3)
    if (s >= 3 && nextMilestone) {
      out.push({
        id: `streak-${h.id}`, tone: 'good', title: 'Streak within reach',
        text: `You're ${nextMilestone - s} completion${nextMilestone - s === 1 ? '' : 's'} away from a ${nextMilestone}-day streak on ${h.name}.`,
        metric: `${s}d`,
      })
      break
    }
  }

  // 5 · strongest habit
  const ranked = consistencyRanking(state, 90)
  if (ranked.length && ranked[0].score >= 75) {
    out.push({
      id: 'most-consistent', tone: 'good', title: 'Most consistent',
      text: `${ranked[0].habit.name} is your most consistent habit — ${ranked[0].score}/100 over 90 days, with a ${ranked[0].bestRun}-day run.`,
      metric: `${ranked[0].score}`,
    })
  }
  if (ranked.length >= 2) {
    const last = ranked[ranked.length - 1]
    if (last.score <= 45) {
      out.push({
        id: 'least-consistent', tone: 'warn', title: 'Needs support',
        text: `${last.habit.name} scores ${last.score}/100 for consistency. Pairing it with ${ranked[0].habit.name} may make it easier to keep.`,
        metric: `${last.score}`,
      })
    }
  }

  // 6 · time of day
  const tod = timeOfDayPerformance(state, 90)
  if (tod.enough) {
    const peak = tod.parts.find((p) => p.id === tod.peak)
    out.push({
      id: 'time-of-day', tone: 'neutral', title: 'When you check in',
      text: `${peak.pct}% of your check-ins happen in the ${peak.label.toLowerCase()} (${tod.total} logged times).`,
      metric: `${peak.pct}%`,
    })
  }

  // 7 · distribution shape
  const dist = completionDistribution(state, 90)
  if (dist.enough) {
    const full = dist.buckets[3]
    const low = dist.buckets[0]
    if (full.pct >= 40) {
      out.push({ id: 'dist-full', tone: 'good', title: 'High-quality days', text: `${full.pct}% of your tracked days land at 75% completion or better.`, metric: `${full.pct}%` })
    } else if (low.pct >= 40) {
      out.push({ id: 'dist-low', tone: 'warn', title: 'All-or-nothing pattern', text: `${low.pct}% of your tracked days finish under 25%. A smaller daily target may help.`, metric: `${low.pct}%` })
    }
  }

  // 8 · correlations
  const corr = habitCorrelations(state, 60, 1)
  if (corr.enough) {
    const p = corr.pairs[0]
    out.push({
      id: 'correlation', tone: 'neutral', title: 'Patterns that travel together',
      text: `On days you complete ${p.a.name}, ${p.b.name} happens ${p.withRate}% of the time — versus ${p.withoutRate}% on days you don't. These patterns often appear together.`,
      metric: `${p.delta > 0 ? '+' : ''}${p.delta}%`,
    })
  }
  const moodCorr = moodCorrelations(state, 60)
  if (moodCorr.enough) {
    const r = moodCorr.rows[0]
    const dimLabel = { score: 'mood', energy: 'energy', focus: 'focus', motivation: 'motivation' }[r.dim]
    out.push({
      id: `mood-${r.dim}`, tone: 'neutral', title: `Habits and ${dimLabel}`,
      text: `When your ${dimLabel} is high you complete ${r.highPct}% of scheduled habits; when it's low, ${r.lowPct}%. Correlation, not cause.`,
      metric: `${r.delta > 0 ? '+' : ''}${r.delta}%`,
    })
  }

  return out.slice(0, limit)
}

/* ------------------------------------------------------------
   HABIT DETAIL — one call for the deep screen
   ------------------------------------------------------------ */

export function habitDetail(state, habit, days = 90) {
  if (!habit) return null
  const today = todayStr()
  const from = subDaysStr(today, days - 1)
  const rate = habitRate(state, habit, from, today)
  const prevRate = habitRate(state, habit, subDaysStr(today, days * 2 - 1), subDaysStr(today, days))
  const consistency = consistencyScore(state, habit, days)
  const streaks = streakHistory(state, habit)
  const perf = weekdayPerformanceForHabit(state, habit, 12)
  const trend = []
  for (let i = days - 1; i >= 0; i--) {
    const d = subDaysStr(today, i)
    const scheduled = eligibleOn(habit, d)
    trend.push({ date: d, pct: scheduled ? (isDone(state, habit.id, d) ? 100 : 0) : null, scheduled })
  }
  const notes = Object.entries(state.checkins?.[habit.id] || {})
    .filter(([, e]) => e?.note)
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, 12)
    .map(([date, e]) => ({ date, note: e.note }))
  const linkedProjects = (state.projects || []).filter((p) => (p.linkedHabitIds || []).includes(habit.id))
  return {
    habit,
    streak: habitStreak(state, habit),
    best: habitBestStreak(state, habit),
    rate,
    prevRate,
    delta: rate.rate != null && prevRate.rate != null ? Math.round((rate.rate - prevRate.rate) * 100) : null,
    consistency,
    streaks,
    weekdays: perf,
    trend,
    notes,
    linkedProjects,
    routines: activeRoutines(state).filter((r) => (r.habitIds || []).includes(habit.id)),
    times: timeOfDayForHabit(state, habit, days),
  }
}

function weekdayPerformanceForHabit(state, habit, weeks = 12) {
  const today = todayStr()
  const rows = Array.from({ length: 7 }, (_, weekday) => ({ weekday, label: WEEKDAY_SHORT[weekday], name: WEEKDAY_NAMES[weekday], done: 0, total: 0, rate: null }))
  let cursor = subDaysStr(today, weeks * 7 - 1)
  while (cursor <= today) {
    if (eligibleOn(habit, cursor)) {
      const r = rows[weekdayOf(cursor)]
      r.total++
      if (isDone(state, habit.id, cursor)) r.done++
    }
    cursor = addDaysStr(cursor, 1)
  }
  for (const r of rows) r.rate = r.total >= MIN_SAMPLES ? r.done / r.total : null
  return rows
}

function timeOfDayForHabit(state, habit, days = 90) {
  const from = subDaysStr(todayStr(), days - 1)
  const counts = Object.fromEntries(PARTS_OF_DAY.map((p) => [p, 0]))
  let total = 0
  for (const [date, entry] of Object.entries(state.checkins?.[habit.id] || {})) {
    if (!entry?.done || !entry.at || date < from) continue
    const p = partOfDay(entry.at)
    if (p) { counts[p]++; total++ }
  }
  if (total < 4) return null
  return { parts: PARTS_OF_DAY.map((p) => ({ id: p, label: p[0].toUpperCase() + p.slice(1), count: counts[p] })), total }
}

/* ------------------------------------------------------------
   STREAK MILESTONES — today intelligence (§28)
   ------------------------------------------------------------ */

export const MILESTONE_STREAKS = [3, 7, 14, 21, 30, 50, 100]

/**
 * Next meaningful streak milestone for a habit.
 * @returns {{current:number, target:number, away:number}|null}
 */
export function streakMilestone(state, habit) {
  if (!habit) return null
  const streak = habitStreak(state, habit.id)
  const target = MILESTONE_STREAKS.find((m) => m > streak)
  if (target == null) return null
  return { current: streak, target, away: target - streak }
}

/* ------------------------------------------------------------
   TIMELINE — the behavioural record, derived from real events
   ------------------------------------------------------------ */

export function timelineEvents(state, limit = 60) {
  const events = []
  const habits = state.habits || []
  const habitName = (id) => habits.find((h) => h.id === id)?.name || 'Habit'

  for (const h of habits) {
    if (h.createdAt && isValidDayStr(h.createdAt)) {
      events.push({ at: h.createdAt, day: h.createdAt, kind: 'habit-created', title: `Started “${h.name}”`, tone: 'neutral' })
    }
    for (const [date, entry] of Object.entries(state.checkins?.[h.id] || {})) {
      if (entry?.note) {
        events.push({ at: entry.at || date, day: date, kind: 'note', title: `Note on ${h.name}`, body: entry.note, tone: 'neutral' })
      }
    }
    const runs = streakHistory(state, h).runs
    for (const r of runs) {
      if (r.length >= 7) {
        events.push({ at: r.end, day: r.end, kind: 'streak', title: `${r.length}-day streak on ${h.name}`, tone: 'good' })
      }
    }
  }

  for (const p of state.projects || []) {
    if (p.startDate) events.push({ at: p.startDate, day: dayOf(p.startDate) || p.startDate, kind: 'project-start', title: `Project started: ${p.name}`, tone: 'neutral' })
    for (const e of p.progressLog || []) {
      if (e.pct === 100) events.push({ at: e.at, day: dayOf(e.at), kind: 'project-progress', title: `${p.name} reached 100%`, tone: 'good' })
      else if (e.pct === 50) events.push({ at: e.at, day: dayOf(e.at), kind: 'project-progress', title: `${p.name} reached the halfway mark`, tone: 'neutral' })
    }
    if (p.completedAt) events.push({ at: p.completedAt, day: dayOf(p.completedAt), kind: 'project-complete', title: `Completed project “${p.name}”`, tone: 'good' })
  }

  for (const a of state.assignments || []) {
    if (a.completedAt) events.push({ at: a.completedAt, day: dayOf(a.completedAt), kind: 'assignment-complete', title: `Submitted “${a.name}”`, tone: 'good' })
    for (const e of a.progressLog || []) {
      if (e.pct === 100) events.push({ at: e.at, day: dayOf(e.at), kind: 'assignment-progress', title: `${a.name} reached 100%`, tone: 'good' })
    }
  }

  for (const [date, m] of Object.entries(state.moods || {})) {
    const bits = []
    if (m?.note) bits.push(m.note)
    if (m?.wentWell) bits.push(`Went well: ${m.wentWell}`)
    if (m?.difficult) bits.push(`Difficult: ${m.difficult}`)
    if (bits.length) events.push({ at: date, day: date, kind: 'reflection', title: 'Reflection', body: bits.join(' · '), tone: 'neutral' })
  }

  const best = achievements(state)
  for (const b of best.badges) {
    if (b.earned) {
      const habit = best.perHabit.find((p) => p.best >= b.threshold)
      events.push({ at: today, day: todayStr(), kind: 'achievement', title: `${b.label} badge · ${b.blurb}`, body: habit ? habit.habit.name : null, tone: 'good' })
    }
  }

  events.sort((a, b) => String(b.at || b.day).localeCompare(String(a.at || a.day)))
  // de-dupe identical day+title pairs
  const seen = new Set()
  const unique = events.filter((e) => {
    const k = `${e.day}|${e.title}`
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
  return unique.slice(0, limit)
}

/* ------------------------------------------------------------
   SEARCH (§30) — habits, work, notes, dates, achievements
   ------------------------------------------------------------ */

export function searchAll(state, query, limit = 24) {
  const q = String(query || '').trim().toLowerCase()
  if (q.length < 2) return { groups: [], count: 0 }
  const tokens = q.split(/\s+/)
  const hit = (str) => {
    const s = String(str || '').toLowerCase()
    return tokens.every((t) => s.includes(t))
  }
  const groups = []

  const habits = (state.habits || []).filter((h) => hit(h.name) || hit(h.notes))
  if (habits.length) groups.push({ id: 'habits', label: 'Habits', items: habits.slice(0, 8).map((h) => ({ id: h.id, type: 'habit', title: h.name, sub: h.archived ? 'Archived' : null, entity: h })) })

  const projects = (state.projects || []).filter((p) => hit(p.name) || hit(p.description) || hit(p.notes)
    || allTasks(p).some((t) => hit(t.name)))
  if (projects.length) {
    groups.push({
      id: 'projects', label: 'Projects',
      items: projects.slice(0, 8).map((p) => ({ id: p.id, type: 'project', title: p.name, sub: `${projectProgress(p).pct}% · ${projectStatus(p).label}`, entity: p })),
    })
  }

  const assignments = (state.assignments || []).filter((a) => hit(a.name) || hit(a.subject) || hit(a.description) || hit(a.notes)
    || (a.subtasks || []).some((s) => hit(s.name)))
  if (assignments.length) {
    groups.push({
      id: 'assignments', label: 'Assignments',
      items: assignments.slice(0, 8).map((a) => ({ id: a.id, type: 'assignment', title: a.name, sub: `${assignmentProgress(a).pct}% · ${assignmentStatus(a).label}`, entity: a })),
    })
  }

  const routines = (state.routines || []).filter((r) => hit(r.name))
  if (routines.length) groups.push({ id: 'routines', label: 'Routines', items: routines.map((r) => ({ id: r.id, type: 'routine', title: r.name, sub: `${r.habitIds.length} habits`, entity: r })) })

  // notes attached to specific days
  const notes = []
  for (const [habitId, days] of Object.entries(state.checkins || {})) {
    for (const [date, entry] of Object.entries(days || {})) {
      if (entry?.note && hit(entry.note)) notes.push({ id: `${habitId}-${date}`, type: 'note', title: `${shortDate(date)} · ${habitName(habitId)}`, sub: entry.note.slice(0, 90), date })
    }
  }
  for (const [date, m] of Object.entries(state.moods || {})) {
    for (const key of ['note', 'wentWell', 'difficult']) {
      if (m?.[key] && hit(m[key])) notes.push({ id: `mood-${date}-${key}`, type: 'note', title: `${shortDate(date)} · Reflection`, sub: String(m[key]).slice(0, 90), date })
    }
  }
  if (notes.length) groups.push({ id: 'notes', label: 'Notes', items: notes.slice(0, 8) })

  // dates: '2026-09-05', 'sep 5', 'september'
  const dateMatches = []
  for (const [habitId, days] of Object.entries(state.checkins || {})) {
    for (const [date, entry] of Object.entries(days || {})) {
      if (!entry?.done) continue
      if (hit(date) || hit(shortDate(date)) || hit(new Date(`${date}T12:00:00`).toLocaleDateString('en-US', { month: 'long', day: 'numeric' }))) {
        dateMatches.push({ id: `${habitId}-${date}`, type: 'date', title: `${shortDate(date)} · ${habitName(habitId)}`, sub: 'Completed', date })
      }
    }
  }
  if (dateMatches.length) groups.push({ id: 'dates', label: 'Dates', items: dateMatches.slice(0, 8) })

  const badges = achievements(state).badges.filter((b) => hit(b.label) || hit(b.blurb))
  if (badges.length) groups.push({ id: 'achievements', label: 'Achievements', items: badges.map((b) => ({ id: b.id, type: 'achievement', title: b.label, sub: b.blurb })) })

  return { groups, count: groups.reduce((n, g) => n + g.items.length, 0) }
}

/** Mood/energy/focus/motivation series for the Mind screen. */
export function mindSeries(state, days = 30) {
  const today = todayStr()
  const dims = ['score', 'energy', 'focus', 'motivation']
  const rows = []
  for (let i = days - 1; i >= 0; i--) {
    const d = subDaysStr(today, i)
    const m = state.moods?.[d]
    const s = dayStats(state, d)
    rows.push({
      date: d,
      score: m && Number.isFinite(m.score) ? m.score : null,
      energy: m && Number.isFinite(m.energy) ? m.energy : null,
      focus: m && Number.isFinite(m.focus) ? m.focus : null,
      motivation: m && Number.isFinite(m.motivation) ? m.motivation : null,
      completion: s.total ? s.pct : null,
      note: m?.note || null,
    })
  }
  const avg = (key) => {
    const vals = rows.map((r) => r[key]).filter((v) => v != null)
    return vals.length >= 2 ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 : null
  }
  return { rows, dims, averages: Object.fromEntries(dims.map((d) => [d, avg(d)])), entries: rows.filter((r) => r.score != null).length }
}

/** Compact workload-ish summary of the habit side for the Week screen. */
export function weekHabitTable(state, week) {
  const habits = activeHabits(state).filter((h) => week.some((d) => eligibleOn(h, d)))
  return habits.map((habit) => {
    let done = 0
    let total = 0
    const cells = week.map((d) => {
      const scheduled = eligibleOn(habit, d)
      const complete = scheduled && isDone(state, habit.id, d)
      if (scheduled) { total++; if (complete) done++ }
      return { date: d, scheduled, done: complete, future: d > todayStr() }
    })
    return { habit, cells, done, total, pct: total ? Math.round((done / total) * 100) : null }
  })
}

export { BADGES }
