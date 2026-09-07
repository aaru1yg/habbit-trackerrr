/* ============================================================
   DATASETS A–H — requirement #35.

   Eight realistic user shapes, each built to stress a different part of
   the adaptive layer. They are deliberately ordinary: real habits with
   real gaps, real deadlines, real projects. Nothing here is synthetic
   noise, because the whole point is to catch engines that manufacture
   confidence from data that is not there.

   Every engine in the product must either produce evidence-backed
   output for these, or say it has nothing. #37: no fake intelligence.
   ============================================================ */

const DAY = 86400000

/** Local ISO timestamp offset from now, so nothing depends on the wall clock. */
export const iso = (offsetDays, hhmm = '09:00') =>
  new Date(Date.now() + offsetDays * DAY).toISOString().slice(0, 10) + 'T' + hhmm

export const day = (offsetDays) => iso(offsetDays).slice(0, 10)

const habit = (id, name, schedule, over = {}) => ({
  id, name, category: 'learning', schedule, reminder: null, notes: '',
  createdAt: day(-120), archived: false, pause: null, skips: [], order: 0, ...over,
})

const DAILY = { type: 'daily' }
const WEEKDAYS = { type: 'weekdays', days: [1, 2, 3, 4, 5] }

/** Check-ins at a given rate, with real gaps rather than a perfect run. */
function checkinsFor(habitIds, { days = 90, rate = 0.8, seed = 1 } = {}) {
  const out = {}
  for (const id of habitIds) {
    const map = {}
    for (let i = 1; i <= days; i++) {
      /* A cheap deterministic pseudo-random so runs differ but repeat. */
      seed = (seed * 1103515245 + 12345) % 2147483648
      if (seed / 2147483648 < rate) map[day(-i)] = { done: true, at: `${day(-i)}T09:10:00` }
    }
    out[id] = map
  }
  return out
}

const assignment = (id, name, over = {}) => ({
  id, name, subject: '', description: '', priority: 'normal', assignedDate: day(-10),
  deadline: day(3), progress: 0, progressMode: 'explicit', subtasks: [], projectId: null,
  notes: '', estimateMin: 60, actualMin: null, progressLog: [], createdAt: iso(-10),
  createdAtDay: day(-10), updatedAt: iso(-10), completedAt: null, archived: false, order: 0,
  ...over,
})

const project = (id, name, over = {}) => ({
  id, name, description: '', category: 'General', priority: 'normal', startDate: day(-30),
  deadline: day(14), milestones: [], linkedHabitIds: [], notes: '', estimateMin: 300,
  actualMin: null, manualPercent: null, legacyPercent: null, progressLog: [],
  createdAt: iso(-30), createdAtDay: day(-30), updatedAt: iso(-1), completedAt: null,
  archived: false, order: 0, ...over,
})

const goal = (id, title, over = {}) => ({
  id, title, category: 'fitness', startDate: day(-90), targetDate: day(90), unit: 'km',
  target: 100, current: 40, milestones: [], linkedProjectIds: [], linkedAssignmentIds: [],
  linkedHabitIds: [], archived: false, createdAt: day(-90), ...over,
})

/** Completed focus sessions: the only real actual-duration evidence there is. */
function focusSessions(count, { kind = 'assignment', itemId = 'a1', name = 'Physics set', plannedMin = 45, actualMin = 60, spread = 5 } = {}) {
  return Array.from({ length: count }, (_, i) => ({
    id: `f${i + 1}`, kind, itemId, name,
    startedAt: iso(-(i + 1), '09:00'), endedAt: iso(-(i + 1), '10:00'),
    plannedMin, actualMin: actualMin + ((i % spread) - 2), completed: true, interrupted: false,
  }))
}

const prefs = (over = {}) => ({
  focusStartHour: null, focusEndHour: null, planningTime: null, breakStyle: null,
  dailyCapacityMin: 240, planningBufferPct: 15, weekStartsOn: 1, reminderWindow: null,
  ...over,
})

const base = (over = {}) => ({
  version: 4,
  profile: { name: 'Aaru', onboarded: true, theme: 'midnight', workReminders: false },
  habits: [], checkins: {}, routines: [], projects: [], assignments: [], goals: [],
  moods: {}, notes: [], achievements: [],
  preferences: prefs(), signals: [], focusLog: [],
  ...over,
})

/* ------------------------------------------------------------
   A · LIGHT — a couple of habits, no deadlines, little history.
   The engines must not invent a profile from this.
   ------------------------------------------------------------ */
export const A_light = () => {
  const habits = [habit('h1', 'Read 20 pages', DAILY), habit('h2', 'Stretch', WEEKDAYS)]
  return base({
    habits,
    checkins: checkinsFor(['h1', 'h2'], { days: 21, rate: 0.6 }),
    preferences: prefs({ dailyCapacityMin: null }),
  })
}

/* ------------------------------------------------------------
   B · HEAVY HABIT — many habits, deep history, no work items.
   ------------------------------------------------------------ */
export const B_heavyHabit = () => {
  const ids = Array.from({ length: 12 }, (_, i) => `h${i + 1}`)
  const names = ['Read', 'Run', 'Meditate', 'Journal', 'Study DSA', 'Practice guitar',
    'No sugar', 'Walk', 'Deep work', 'Review notes', 'Sleep by 11', 'Water']
  return base({
    habits: ids.map((id, i) => habit(id, names[i], i % 3 === 0 ? WEEKDAYS : DAILY, { order: i })),
    checkins: checkinsFor(ids, { days: 120, rate: 0.75 }),
  })
}

/* ------------------------------------------------------------
   C · DEADLINE HEAVY — a wall of near-term due dates.
   ------------------------------------------------------------ */
export const C_deadlineHeavy = () => {
  const habits = [habit('h1', 'Study daily', DAILY)]
  return base({
    habits,
    checkins: checkinsFor(['h1'], { days: 60, rate: 0.8 }),
    assignments: [
      assignment('a1', 'Physics set', { deadline: day(0), priority: 'high', estimateMin: 120 }),
      assignment('a2', 'Chemistry lab report', { deadline: day(1), estimateMin: 90 }),
      assignment('a3', 'History essay', { deadline: day(2), estimateMin: 150 }),
      assignment('a4', 'Maths problem set', { deadline: day(4), estimateMin: 80 }),
      assignment('a5', 'Literature reading', { deadline: day(6), estimateMin: 60 }),
      assignment('a6', 'Economics case', { deadline: day(9), estimateMin: 110 }),
      assignment('a7', 'Biology diagram set', { deadline: day(-1), priority: 'high', estimateMin: 70 }),
    ],
  })
}

/* ------------------------------------------------------------
   D · PROJECT HEAVY — milestones, tasks, and real progress history.
   ------------------------------------------------------------ */
export const D_projectHeavy = () => {
  const mk = (id, name, deadlineOffset, tasks) => project(id, name, {
    deadline: day(deadlineOffset),
    estimateMin: tasks.length * 90,
    progressLog: [
      { at: iso(-20, '10:00'), pct: 20 }, { at: iso(-8, '10:00'), pct: 55 },
    ],
    milestones: [{
      id: `${id}-m1`, name: 'Draft', due: day(deadlineOffset - 3),
      tasks: tasks.map((t, i) => ({
        id: `${id}-t${i + 1}`, name: t, done: i < Math.floor(tasks.length / 2),
        status: i < Math.floor(tasks.length / 2) ? 'done' : 'todo',
        completedAt: i < Math.floor(tasks.length / 2) ? iso(-(i + 5), '11:00') : null,
        due: null, priority: 'normal', estimateMin: 90,
        actualMin: i < Math.floor(tasks.length / 2) ? 110 : null, notes: '', order: i,
      })),
    }],
  })
  return base({
    habits: [habit('h1', 'Work on projects', WEEKDAYS)],
    checkins: checkinsFor(['h1'], { days: 60, rate: 0.7 }),
    projects: [
      mk('p1', 'Portfolio site', 12, ['Wireframe', 'Copy', 'Build', 'Deploy', 'Review']),
      mk('p2', 'Thesis chapter', 30, ['Outline', 'Research', 'Draft', 'Edit']),
      mk('p3', 'Open source PR', 5, ['Reproduce', 'Fix', 'Test', 'Document']),
    ],
  })
}

/* ------------------------------------------------------------
   E · HIGHLY CONSISTENT — a long unbroken run.
   ------------------------------------------------------------ */
export const E_consistent = () => {
  const habits = [habit('h1', 'Write daily', DAILY), habit('h2', 'Morning run', DAILY)]
  const checkins = {}
  for (const id of ['h1', 'h2']) {
    const map = {}
    for (let i = 1; i <= 150; i++) map[day(-i)] = { done: true, at: `${day(-i)}T07:30:00` }
    checkins[id] = map
  }
  return base({ habits, checkins })
}

/* ------------------------------------------------------------
   F · HIGHLY INCONSISTENT — sporadic, with long gaps.
   ------------------------------------------------------------ */
export const F_inconsistent = () => {
  const habits = [habit('h1', 'Meditate', DAILY), habit('h2', 'Practice Spanish', DAILY)]
  const checkins = {}
  for (const id of ['h1', 'h2']) {
    const map = {}
    /* A burst, then nothing, then a single day — the shape that breaks
       naive streak maths. */
    for (const i of [1, 2, 40, 41, 42, 88]) map[day(-i)] = { done: true, at: `${day(-i)}T20:00:00` }
    checkins[id] = map
  }
  return base({ habits, checkins })
}

/* ------------------------------------------------------------
   G · OVERLOADED — far more committed work than the stated capacity.
   ------------------------------------------------------------ */
export const G_overloaded = () => {
  const habits = [habit('h1', 'Keep up', DAILY)]
  return base({
    habits,
    checkins: checkinsFor(['h1'], { days: 30, rate: 0.4 }),
    preferences: prefs({ dailyCapacityMin: 120 }),
    assignments: [
      assignment('a1', 'Physics set', { deadline: day(0), estimateMin: 180, priority: 'high' }),
      assignment('a2', 'Chemistry report', { deadline: day(0), estimateMin: 150 }),
      assignment('a3', 'History essay', { deadline: day(1), estimateMin: 200 }),
      assignment('a4', 'Maths set', { deadline: day(1), estimateMin: 120 }),
      assignment('a5', 'Literature', { deadline: day(2), estimateMin: 90 }),
    ],
    projects: [project('p1', 'Thesis chapter', { deadline: day(2), estimateMin: 600 })],
    focusLog: focusSessions(5, { plannedMin: 60, actualMin: 95 }),
  })
}

/* ------------------------------------------------------------
   H · NEW USER — onboarded, and nothing else.
   Every engine must say it has nothing to say.
   ------------------------------------------------------------ */
export const H_newUser = () => base({
  preferences: prefs({ dailyCapacityMin: null }),
})

/** The eight, in requirement order. */
export const DATASETS = [
  { key: 'A', name: 'light', build: A_light },
  { key: 'B', name: 'heavy-habit', build: B_heavyHabit },
  { key: 'C', name: 'deadline-heavy', build: C_deadlineHeavy },
  { key: 'D', name: 'project-heavy', build: D_projectHeavy },
  { key: 'E', name: 'highly consistent', build: E_consistent },
  { key: 'F', name: 'highly inconsistent', build: F_inconsistent },
  { key: 'G', name: 'overloaded', build: G_overloaded },
  { key: 'H', name: 'new user', build: H_newUser },
]

export { focusSessions, assignment, project, goal, habit, prefs, base, checkinsFor }
