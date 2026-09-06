/* ============================================================
   ACHIEVEMENTS — a rule-based reward layer.
   Everything here is derived from data the user actually
   recorded. No achievement can be earned by assumption, and
   every locked one shows real progress toward the goal or
   says plainly that it is not started.

   Pure functions only: (state) => data. Nothing reads the DOM,
   the clock is always passed in, so results are testable.
   ============================================================ */
import { todayStr, addDaysStr, subDaysStr, weekDays, isValidDayStr, toLocalDate } from './dates.js'
import {
  habitBestStreak, habitRate, dayStats, weekStats,
  eligibleOn, isDone, activeHabits,
} from './stats.js'
import { consistencyScore } from './analytics.js'

/** Every check-in date that exists, ascending. One flat list. */
export function allCheckinDates(state) {
  const set = new Set()
  for (const days of Object.values(state.checkins || {})) {
    for (const [date, c] of Object.entries(days || {})) {
      if (c && c.done === true && isValidDayStr(date)) set.add(date)
    }
  }
  return [...set].sort()
}

/** Every (habitId, date) pair, ascending by date — the true check-in count. */
export function checkinCount(state) {
  let n = 0
  for (const days of Object.values(state.checkins || {})) {
    for (const c of Object.values(days || {})) if (c && c.done === true) n++
  }
  return n
}

/** Best streak across every habit, plus the day it was reached. */
export function bestStreakEver(state) {
  let best = 0
  let habit = null
  let reachedOn = null
  for (const h of activeHabits(state)) {
    const dates = Object.keys(state.checkins?.[h.id] || {})
      .filter((d) => isValidDayStr(d) && isDone(state, h.id, d) && eligibleOn(h, d))
      .sort()
    let run = 0
    let runEnd = null
    let prev = null
    for (const d of dates) {
      if (prev && addDaysStr(prev, 1) === d) {
        run++
      } else {
        run = 1
      }
      runEnd = d
      if (run > best) {
        best = run
        habit = h
        reachedOn = runEnd
      }
      prev = d
    }
  }
  return { best, habit, reachedOn }
}

/** A week where every eligible habit was completed, at least minSlots of them. */
export function perfectWeeks(state, { weeks = 52, minSlots = 5 } = {}) {
  const today = todayStr()
  const out = []
  // walk back week by week from the current week
  for (let i = 0; i < weeks; i++) {
    const anchor = subDaysStr(today, i * 7)
    const week = weekDays(anchor)
    // A partial week is progress, never an earned full-week badge.
    if (week[6] > today) continue
    const stats = weekStats(state, week)
    if (stats.total < minSlots) continue
    if (stats.done === stats.total) out.push({ start: week[0], end: week[6], done: stats.done, total: stats.total })
  }
  return out
}

export const completedProjects = (state) =>
  (state.projects || []).filter((p) => p.completedAt)

export const completedAssignments = (state) =>
  (state.assignments || []).filter((a) => a.completedAt)

/** Assignments finished on or before their deadline (real, not assumed). */
export function onTimeAssignments(state) {
  return completedAssignments(state).filter((a) => {
    if (!a.deadline) return false
    const completed = toLocalDate(a.completedAt)
    const deadline = toLocalDate(a.deadline, { endOfDay: true })
    return completed != null && deadline != null && completed <= deadline
  })
}

/**
 * A comeback: a habit that missed at least `gap` consecutive eligible days
 * and then ran `resume` eligible days in a row afterwards.
 */
export function comebacks(state, { gap = 7, resume = 3 } = {}) {
  const out = []
  for (const h of activeHabits(state)) {
    const dates = Object.keys(state.checkins?.[h.id] || {})
      .filter((d) => isValidDayStr(d) && isDone(state, h.id, d) && eligibleOn(h, d))
      .sort()
    const set = new Set(dates)
    for (let i = 1; i < dates.length; i++) {
      const prev = dates[i - 1]
      const cur = dates[i]
      const missing = []
      let cursor = addDaysStr(prev, 1)
      while (cursor < cur && missing.length < 400) {
        if (eligibleOn(h, cursor)) missing.push(cursor)
        cursor = addDaysStr(cursor, 1)
      }
      if (missing.length < gap) continue
      // did they string `resume` eligible days together from `cur`?
      let run = 0
      let c = cur
      while (set.has(c) && run < resume) {
        run++
        c = addDaysStr(c, 1)
        // skip non-eligible days without breaking the run
        let guard = 0
        while (!eligibleOn(h, c) && guard++ < 10) c = addDaysStr(c, 1)
      }
      if (run >= resume) {
        out.push({ habit: h, gapDays: missing.length, resumedOn: cur, run })
        break
      }
    }
  }
  return out
}

const TIERS = {
  bronze: { label: 'Bronze', art: 'badge-bronze' },
  silver: { label: 'Silver', art: 'badge-silver' },
  gold: { label: 'Gold', art: 'badge-gold' },
  diamond: { label: 'Diamond', art: 'badge-diamond' },
}

const pct = (n, d) => (d > 0 ? Math.min(1, n / d) : 0)

/**
 * The full achievement set.
 * Each entry: { id, title, blurb, tier, progress (0..1), earned, earnedOn, detail }
 * `detail` is the honest sentence shown under a locked achievement — never a
 * fabricated number, and 'Not started yet' when there is nothing to report.
 */
export function achievementList(state, { now = todayStr() } = {}) {
  const habits = activeHabits(state)
  const checkins = checkinCount(state)
  const streak = bestStreakEver(state)
  const dates = allCheckinDates(state)
  const weeks = perfectWeeks(state)
  const projects = completedProjects(state)
  const assignments = completedAssignments(state)
  const onTime = onTimeAssignments(state)
  const comeback = comebacks(state)

  // 30-day consistency across every active habit
  const from = subDaysStr(now, 29)
  let eligible30 = 0
  let done30 = 0
  for (const h of habits) {
    const r = habitRate(state, h, from, now)
    eligible30 += r.eligible
    done30 += r.done
  }
  const rate30 = eligible30 ? done30 / eligible30 : null

  const bestConsistency = habits.length
    ? Math.max(...habits.map((h) => consistencyScore(state, h, 90).score ?? 0))
    : 0

  const moodDays = Object.keys(state.moods || {}).length
  const routines = (state.routines || []).length
  const categories = new Set(habits.map((h) => h.category).filter(Boolean))
  const today = dayStats(state, now)

  const items = [
    {
      id: 'first-step',
      title: 'First step',
      blurb: 'Log your first check-in.',
      tier: 'bronze',
      progress: pct(checkins, 1),
      earned: checkins >= 1,
      earnedOn: dates[0] || null,
      detail: checkins >= 1 ? 'Every streak starts with one.' : 'Nothing logged yet.',
    },
    {
      id: 'streak-7',
      title: 'First week',
      blurb: 'Reach a 7-day streak on any habit.',
      tier: 'bronze',
      progress: pct(streak.best, 7),
      earned: streak.best >= 7,
      earnedOn: streak.best >= 7 ? streak.reachedOn : null,
      detail: streak.best >= 7
        ? `Best streak: ${streak.best} days${streak.habit ? ` on ${streak.habit.name}` : ''}.`
        : streak.best > 0
          ? `${7 - streak.best} more day${7 - streak.best === 1 ? '' : 's'} to go.`
          : 'Not started yet.',
    },
    {
      id: 'streak-30',
      title: 'Thirty days',
      blurb: 'Hold a habit for 30 days straight.',
      tier: 'silver',
      progress: pct(streak.best, 30),
      earned: streak.best >= 30,
      earnedOn: streak.best >= 30 ? streak.reachedOn : null,
      detail: streak.best >= 30
        ? `Best streak: ${streak.best} days${streak.habit ? ` on ${streak.habit.name}` : ''}.`
        : streak.best > 0
          ? `${30 - streak.best} more day${30 - streak.best === 1 ? '' : 's'}.`
          : 'Not started yet.',
    },
    {
      id: 'streak-100',
      title: 'Hundred',
      blurb: 'One hundred consecutive days.',
      tier: 'gold',
      progress: pct(streak.best, 100),
      earned: streak.best >= 100,
      earnedOn: streak.best >= 100 ? streak.reachedOn : null,
      detail: streak.best >= 100
        ? `Best streak: ${streak.best} days.`
        : streak.best > 0
          ? `${100 - streak.best} more day${100 - streak.best === 1 ? '' : 's'}.`
          : 'Not started yet.',
    },
    {
      id: 'checkins-100',
      title: 'One hundred check-ins',
      blurb: 'Log 100 completions in total.',
      tier: 'silver',
      progress: pct(checkins, 100),
      earned: checkins >= 100,
      earnedOn: checkins >= 100 ? nthDayOfCheckins(state, 100) : null,
      detail: checkins >= 100 ? `${checkins} logged.` : `${checkins} of 100 logged.`,
    },
    {
      id: 'checkins-500',
      title: 'Five hundred',
      blurb: 'Log 500 completions in total.',
      tier: 'gold',
      progress: pct(checkins, 500),
      earned: checkins >= 500,
      earnedOn: checkins >= 500 ? nthDayOfCheckins(state, 500) : null,
      detail: checkins >= 500 ? `${checkins} logged.` : `${checkins} of 500 logged.`,
    },
    {
      id: 'perfect-week',
      title: 'Perfect week',
      blurb: 'Complete every scheduled habit for a whole week.',
      tier: 'gold',
      progress: weeks.length ? 1 : partialWeekProgress(state, now),
      earned: weeks.length > 0,
      earnedOn: weeks.length ? weeks[0].end : null,
      detail: weeks.length
        ? `${weeks.length} perfect week${weeks.length === 1 ? '' : 's'} recorded.`
        : 'No full week at 100% yet.',
    },
    {
      id: 'consistency-master',
      title: 'Consistency master',
      blurb: 'Hit 90% consistency over 30 days.',
      tier: 'diamond',
      progress: rate30 == null ? 0 : pct(rate30, 0.9),
      earned: rate30 != null && rate30 >= 0.9 && eligible30 >= 20,
      earnedOn: null,
      detail: rate30 == null
        ? 'Not enough data yet.'
        : `${Math.round(rate30 * 100)}% over the last 30 days (${done30} of ${eligible30}).`,
    },
    {
      id: 'sharp-habit',
      title: 'Dialled in',
      blurb: 'Take one habit above a 90 consistency score.',
      tier: 'gold',
      progress: pct(bestConsistency, 90),
      earned: bestConsistency >= 90,
      earnedOn: null,
      detail: habits.length
        ? `Best habit score: ${Math.round(bestConsistency)} of 100.`
        : 'Not enough data yet.',
    },
    {
      id: 'project-first',
      title: 'Finisher',
      blurb: 'Complete a project.',
      tier: 'silver',
      progress: pct(projects.length, 1),
      earned: projects.length >= 1,
      earnedOn: projects.length ? String(projects[0].completedAt).slice(0, 10) : null,
      detail: projects.length ? `${projects.length} project${projects.length === 1 ? '' : 's'} completed.` : 'No completed projects yet.',
    },
    {
      id: 'project-five',
      title: 'Shipping habit',
      blurb: 'Complete five projects.',
      tier: 'gold',
      progress: pct(projects.length, 5),
      earned: projects.length >= 5,
      earnedOn: null,
      detail: projects.length ? `${projects.length} of 5 completed.` : 'No completed projects yet.',
    },
    {
      id: 'on-time',
      title: 'Ahead of time',
      blurb: 'Finish an assignment on or before its deadline.',
      tier: 'silver',
      progress: pct(onTime.length, 1),
      earned: onTime.length >= 1,
      earnedOn: onTime.length ? String(onTime[0].completedAt).slice(0, 10) : null,
      detail: assignments.length
        ? `${onTime.length} of ${assignments.length} finished assignments beat the deadline.`
        : 'No completed assignments yet.',
    },
    {
      id: 'comeback',
      title: 'Comeback',
      blurb: 'Miss a week, then rebuild a 3-day streak.',
      tier: 'silver',
      progress: pct(comeback.length, 1),
      earned: comeback.length >= 1,
      earnedOn: comeback.length ? comeback[0].resumedOn : null,
      detail: comeback.length
        ? `${comeback[0].habit.name}: ${comeback[0].gapDays} days off, then ${comeback[0].run} straight.`
        : 'No comeback recorded yet — no gaps to recover from, or none rebuilt.',
    },
    {
      id: 'routine-builder',
      title: 'Routine builder',
      blurb: 'Build a routine that stacks your habits.',
      tier: 'bronze',
      progress: pct(routines, 1),
      earned: routines >= 1,
      earnedOn: null,
      detail: routines ? `${routines} routine${routines === 1 ? '' : 's'} saved.` : 'No routines yet.',
    },
    {
      id: 'self-aware',
      title: 'Self aware',
      blurb: 'Log how you feel on ten different days.',
      tier: 'bronze',
      progress: pct(moodDays, 10),
      earned: moodDays >= 10,
      earnedOn: null,
      detail: moodDays ? `${moodDays} of 10 days logged.` : 'No mindset entries yet.',
    },
    {
      id: 'well-rounded',
      title: 'Well rounded',
      blurb: 'Track habits across five different areas.',
      tier: 'silver',
      progress: pct(categories.size, 5),
      earned: categories.size >= 5,
      earnedOn: null,
      detail: categories.size ? `${categories.size} of 5 areas covered.` : 'No habits yet.',
    },
    {
      id: 'clean-sweep',
      title: 'Clean sweep',
      blurb: 'Finish every habit scheduled for the day.',
      tier: 'bronze',
      progress: today.total ? pct(today.done, today.total) : 0,
      earned: today.total > 0 && today.done === today.total,
      earnedOn: today.total > 0 && today.done === today.total ? now : null,
      detail: today.total ? `${today.done} of ${today.total} done today.` : 'Nothing scheduled today.',
    },
  ]

  return items
}

/** The date the Nth check-in landed on (sorted by date, then habit id). */
function nthDayOfCheckins(state, n) {
  const pairs = []
  for (const [hid, days] of Object.entries(state.checkins || {})) {
    for (const [date, c] of Object.entries(days || {})) {
      if (c && c.done === true && isValidDayStr(date)) pairs.push({ date, hid })
    }
  }
  pairs.sort((a, b) => (a.date === b.date ? a.hid.localeCompare(b.hid) : a.date < b.date ? -1 : 1))
  return pairs[n - 1]?.date || null
}

/** How close the *current* week is to perfect (0..1), for progress display. */
function partialWeekProgress(state, now) {
  const week = weekDays(now)
  let done = 0
  let total = 0
  for (const d of week) {
    if (d > now) break
    const s = dayStats(state, d)
    done += s.done
    total += s.total
  }
  return total ? Math.min(0.99, done / total) : 0
}

/** Screen-ready summary. */
export function achievementSummary(state, opts = {}) {
  const items = achievementList(state, opts)
  const earned = items.filter((i) => i.earned)
  const byTier = {}
  for (const i of items) byTier[i.tier] = (byTier[i.tier] || 0) + 1
  const earnedByTier = {}
  for (const i of earned) earnedByTier[i.tier] = (earnedByTier[i.tier] || 0) + 1
  const recent = [...earned]
    .filter((i) => i.earnedOn)
    .sort((a, b) => String(b.earnedOn).localeCompare(String(a.earnedOn)))
    .slice(0, 3)
  const nextUp = items
    .filter((i) => !i.earned && i.progress > 0)
    .sort((a, b) => b.progress - a.progress)
    .slice(0, 3)
  return {
    items,
    earned,
    total: items.length,
    unlocked: earned.length,
    completion: items.length ? earned.length / items.length : 0,
    byTier,
    earnedByTier,
    recent,
    nextUp,
    tierArt: TIERS,
  }
}

export { TIERS }
