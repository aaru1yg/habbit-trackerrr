/* ============================================================
   GOALS — the outcome layer above habits, projects and
   assignments.

   A goal is an outcome with a target date. It links downward to the
   things that produce it: milestones, habits, projects, assignments.
   Progress is always derived from real data, in this order of
   authority:

     1. milestones            (explicit, user-owned)
     2. linked assignments    (their own subtask progress)
     3. linked projects       (their own task progress)
     4. linked habits         (their 30-day completion rate)
     5. manualPercent         (only if the user set one)

   If none of those exist the goal reports 0% and says so. It never
   guesses.
   ============================================================ */
import { todayStr, daysUntil, isValidDayStr, prettyDate } from './dates.js'
import { habitRate, isDone, eligibleOn } from './stats.js'
import { projectProgress, assignmentProgress } from './work.js'

export const GOAL_AREAS = [
  { id: 'fitness', label: 'Fitness', cssVar: '--cat-fitness' },
  { id: 'health', label: 'Health', cssVar: '--cat-health' },
  { id: 'mind', label: 'Mind', cssVar: '--cat-mind' },
  { id: 'learning', label: 'Learning', cssVar: '--cat-learning' },
  { id: 'creative', label: 'Creative', cssVar: '--cat-creative' },
  { id: 'social', label: 'Social', cssVar: '--cat-social' },
  { id: 'finance', label: 'Finance', cssVar: '--cat-finance' },
  { id: 'productivity', label: 'Productivity', cssVar: '--cat-productivity' },
]

export const areaOf = (id) => GOAL_AREAS.find((a) => a.id === id) || GOAL_AREAS[2]

export const activeGoals = (state) =>
  (state.goals || []).filter((g) => !g.archived && g.status !== 'archived')

/**
 * Goals still in flight: not explicitly completed, and not already at 100%
 * because its milestones or linked work finished.
 */
export const openGoals = (state, { now = new Date() } = {}) =>
  activeGoals(state).filter((g) => g.status !== 'completed' && goalProgress(state, g, { now }).pct < 100)

/**
 * Progress for one goal.
 * @returns {{pct:number, source:string, done:number, total:number, detail:string}}
 */
export function goalProgress(state, goal, { now = new Date(), windowDays = 30 } = {}) {
  if (!goal) return { pct: 0, source: 'none', done: 0, total: 0, detail: 'No goal.' }

  // 1 · milestones
  const ms = goal.milestones || []
  if (ms.length > 0) {
    const done = ms.filter((m) => m.done).length
    return {
      pct: Math.round((done / ms.length) * 100),
      source: 'milestones',
      done,
      total: ms.length,
      detail: `${done} of ${ms.length} milestone${ms.length === 1 ? '' : 's'} reached`,
    }
  }

  // 2 · linked assignments
  const asg = (goal.linkedAssignmentIds || [])
    .map((id) => (state.assignments || []).find((a) => a.id === id))
    .filter(Boolean)
  if (asg.length > 0) {
    const total = asg.reduce((n, a) => n + assignmentProgress(a).pct, 0)
    const pct = Math.round(total / asg.length)
    return {
      pct,
      source: 'assignments',
      done: asg.filter((a) => assignmentProgress(a).pct >= 100).length,
      total: asg.length,
      detail: `Average progress across ${asg.length} assignment${asg.length === 1 ? '' : 's'}`,
    }
  }

  // 3 · linked projects
  const proj = (goal.linkedProjectIds || [])
    .map((id) => (state.projects || []).find((p) => p.id === id))
    .filter(Boolean)
  if (proj.length > 0) {
    const total = proj.reduce((n, p) => n + projectProgress(p).pct, 0)
    const pct = Math.round(total / proj.length)
    return {
      pct,
      source: 'projects',
      done: proj.filter((p) => projectProgress(p).pct >= 100).length,
      total: proj.length,
      detail: `Average progress across ${proj.length} project${proj.length === 1 ? '' : 's'}`,
    }
  }

  // 4 · linked habits — real completion over the window
  const habits = (goal.linkedHabitIds || [])
    .map((id) => (state.habits || []).find((h) => h.id === id))
    .filter((h) => h && !h.archived)
  if (habits.length > 0) {
    const from = new Date(now.getTime() - (windowDays - 1) * 86400000)
      .toISOString().slice(0, 10)
    const to = todayStr()
    let eligible = 0
    let done = 0
    for (const h of habits) {
      const r = habitRate(state, h, from, to)
      eligible += r.eligible
      done += r.done
    }
    if (eligible > 0) {
      return {
        pct: Math.round((done / eligible) * 100),
        source: 'habits',
        done,
        total: eligible,
        detail: `${done} of ${eligible} scheduled habit days in the last ${windowDays} days`,
      }
    }
    return {
      pct: 0,
      source: 'habits',
      done: 0,
      total: 0,
      detail: `Linked habits have no scheduled days in the last ${windowDays} days yet`,
    }
  }

  // 5 · manual
  if (Number.isFinite(goal.manualPercent)) {
    return {
      pct: Math.max(0, Math.min(100, Math.round(goal.manualPercent))),
      source: 'manual',
      done: 0,
      total: 0,
      detail: 'Set by you',
    }
  }

  return {
    pct: 0,
    source: 'none',
    done: 0,
    total: 0,
    detail: 'Nothing linked yet — add a milestone, habit, project or assignment',
  }
}

/**
 * Where the goal should be by now, based on its own calendar window.
 * Returns null when there is no honest way to compute it.
 */
export function goalPace(goal, { now = new Date() } = {}) {
  const start = isValidDayStr(goal?.startDate) ? goal.startDate : null
  const end = isValidDayStr(goal?.targetDate) ? goal.targetDate : null
  if (!start || !end) return null
  const t0 = new Date(`${start}T00:00:00`).getTime()
  const t1 = new Date(`${end}T23:59:59`).getTime()
  if (!(t1 > t0)) return null
  const expected = Math.max(0, Math.min(100, Math.round(((now.getTime() - t0) / (t1 - t0)) * 100)))
  return { expected, start, end }
}

/** Tone + one honest sentence about where this goal stands. */
export function goalHealth(state, goal, { now = new Date() } = {}) {
  const prog = goalProgress(state, goal, { now })
  const pace = goalPace(goal, { now })
  const daysLeft = isValidDayStr(goal?.targetDate) ? daysUntil(goal.targetDate, now) : null

  if (goal.status === 'completed' || prog.pct >= 100) {
    return { tone: 'good', label: 'Reached', prog, pace, daysLeft, note: 'Goal reached.' }
  }
  if (daysLeft != null && daysLeft < 0) {
    return {
      tone: 'bad',
      label: 'Past target',
      prog,
      pace,
      daysLeft,
      note: `Target date was ${prettyDate(goal.targetDate)}. ${prog.pct}% reached.`,
    }
  }
  const behind = pace ? pace.expected - prog.pct : null
  if (behind != null && behind > 15) {
    return {
      tone: 'warn',
      label: 'Behind pace',
      prog,
      pace,
      daysLeft,
      note: `${prog.pct}% done, ${pace.expected}% of the way through its window — ${behind} points behind.`,
    }
  }
  if (behind != null && behind < -15) {
    return {
      tone: 'good',
      label: 'Ahead of pace',
      prog,
      pace,
      daysLeft,
      note: `${Math.abs(behind)} points ahead of the pace line.`,
    }
  }
  return {
    tone: 'neutral',
    label: 'On pace',
    prog,
    pace,
    daysLeft,
    note: pace
      ? `${prog.pct}% done, ${pace.expected}% of its window elapsed.`
      : `${prog.pct}% done, no target date set.`,
  }
}

/** The next unfinished milestone, by target date then creation order. */
export function nextMilestone(goal) {
  const open = (goal?.milestones || []).filter((m) => !m.done)
  if (open.length === 0) return null
  return [...open].sort((a, b) => {
    const ad = isValidDayStr(a.targetDate) ? a.targetDate : '9999-99-99'
    const bd = isValidDayStr(b.targetDate) ? b.targetDate : '9999-99-99'
    return ad.localeCompare(bd) || (a.order ?? 0) - (b.order ?? 0)
  })[0]
}

/** Screen-ready roll-up. */
export function goalSummary(state, { now = new Date() } = {}) {
  const goals = openGoals(state)
  const completed = activeGoals(state).filter((g) => g.status === 'completed' || goalProgress(state, g, { now }).pct >= 100)
  const rows = goals.map((g) => ({ goal: g, ...goalHealth(state, g, { now }) }))
  const atRisk = rows.filter((r) => r.tone === 'bad' || r.tone === 'warn')
  const avg = rows.length
    ? Math.round(rows.reduce((n, r) => n + r.prog.pct, 0) / rows.length)
    : null
  const nextDeadline = rows
    .map((r) => r.daysLeft)
    .filter((d) => d != null)
    .sort((a, b) => a - b)[0] ?? null
  const upcoming = [...rows].sort((a, b) => (a.daysLeft ?? 1e9) - (b.daysLeft ?? 1e9))

  return {
    rows,
    open: goals.length,
    completed: completed.length,
    atRisk,
    avg,
    nextDeadline,
    upcoming,
    linkedHabits: new Set(goals.flatMap((g) => g.linkedHabitIds || [])).size,
  }
}

/**
 * Today's contribution to a goal: the linked habits still unchecked
 * today. This is what turns a goal into a daily action.
 */
export function goalTodayActions(state, goal, { date = todayStr() } = {}) {
  const out = []
  for (const id of goal.linkedHabitIds || []) {
    const h = (state.habits || []).find((x) => x.id === id)
    if (!h || h.archived) continue
    if (!eligibleOn(h, date)) continue
    out.push({ kind: 'habit', id, name: h.name, done: isDone(state, id, date) })
  }
  for (const id of goal.linkedProjectIds || []) {
    const p = (state.projects || []).find((x) => x.id === id)
    if (!p || p.archived || p.completedAt) continue
    for (const m of p.milestones || []) {
      for (const task of m.tasks || []) {
        if (task.done) continue
        if (task.due && task.due <= date) {
          out.push({ kind: 'task', id: task.id, name: `${task.name} · ${p.name}`, done: false })
        }
      }
    }
  }
  return out
}
