/* ============================================================
   WORK ENGINE TESTS — projects & assignments.
   The point of these tests is mathematical honesty:
   4 of 10 tasks is 40%, a passed deadline is OVERDUE, and a
   project 40% done with 75% of its time gone is BEHIND.
   ============================================================ */
import { describe, it, expect } from 'vitest'
import {
  projectProgress, projectPercent, assignmentProgress, projectStatus, assignmentStatus,
  milestoneTrack, progressSeries, velocitySeries, entityVelocity, burndown, timeVsWork,
  itemHistory, projectsSummary, assignmentsSummary, priorityWork, workloadSeries,
  workloadSummary, deadlineTimeline, projectCompletionTrend, weeklyCompletionSpeed,
  projectComparison, timeDistribution, matchesWorkFilter, matchesQuery, sortWorkRows,
  urgencyOf, deadlineFromPreset, PROGRESS_STEPS,
} from '../src/lib/work.js'
import { addDaysStr, subDaysStr, todayStr, isoLocal } from '../src/lib/dates.js'
import { checkWorkReminders, workAlertFired } from '../src/lib/reminders.js'

const NOW = new Date('2026-09-05T09:00:00') // Saturday
const TODAY = '2026-09-05'

const task = (name, done = false, over = {}) => ({
  id: name.toLowerCase().replace(/\W/g, ''), name, done,
  status: done ? 'done' : 'todo',
  completedAt: done ? '2026-09-03T10:00' : null, ...over,
})
const milestone = (name, tasks = [], over = {}) => ({ id: name.toLowerCase(), name, tasks, due: null, ...over })

const project = (over = {}) => ({
  id: 'p1', name: 'Portfolio site', description: '', category: 'Design', priority: 'normal',
  startDate: '2026-09-01', deadline: '2026-09-09', milestones: [], linkedHabitIds: [],
  notes: '', estimateMin: null, actualMin: null, manualPercent: null, legacyPercent: null,
  progressLog: [], createdAt: '2026-09-01T09:00', createdAtDay: '2026-09-01', updatedAt: null,
  completedAt: null, archived: false, order: 0, ...over,
})

const assignment = (over = {}) => ({
  id: 'a1', name: 'Submit DS assignment', subject: 'Data Structures', description: '',
  priority: 'high', assignedDate: '2026-09-01', deadline: '2026-09-07T23:59',
  progress: 40, progressMode: 'explicit', subtasks: [], projectId: null, notes: '',
  estimateMin: 120, actualMin: null, progressLog: [], createdAt: '2026-09-01T09:00',
  createdAtDay: '2026-09-01', updatedAt: null, completedAt: null, archived: false, order: 0, ...over,
})

const stateOf = (projects = [], assignments = [], habits = [], checkins = {}) => ({
  version: 4,
  profile: { name: 'Test', onboarded: true, theme: 'midnight' },
  habits, checkins, routines: [], projects, assignments, moods: {},
})

describe('project progress math', () => {
  it('4 of 10 tasks is exactly 40% (never 50%, never rounded up)', () => {
    const tasks = [
      ...Array.from({ length: 4 }, (_, i) => task(`done${i}`, true)),
      ...Array.from({ length: 6 }, (_, i) => task(`todo${i}`, false)),
    ]
    const p = project({ milestones: [milestone('All', tasks)] })
    const prog = projectProgress(p)
    expect(prog.pct).toBe(40)
    expect(prog.done).toBe(4)
    expect(prog.total).toBe(10)
    expect(prog.remaining).toBe(6)
    expect(100 - prog.pct).toBe(60)
    expect(projectPercent(p)).toBe(40)
  })

  it('rounds half-up: 1/3 → 33%, 2/3 → 67%', () => {
    expect(projectProgress(project({ milestones: [milestone('m', [task('a', true), task('b'), task('c')])] })).pct).toBe(33)
    expect(projectProgress(project({ milestones: [milestone('m', [task('a', true), task('b', true), task('c')])] })).pct).toBe(67)
  })

  it('tasks across several milestones are counted together', () => {
    const p = project({
      milestones: [
        milestone('Planning', [task('a', true), task('b', true)]),
        milestone('Build', [task('c', true), task('d'), task('e')]),
        milestone('Launch', [task('f'), task('g'), task('h'), task('i'), task('j')]),
      ],
    })
    expect(projectProgress(p).pct).toBe(30) // 3 / 10
  })

  it('falls back to an explicit percent when there are no tasks, and to legacy', () => {
    expect(projectProgress(project({ manualPercent: 70 })).pct).toBe(70)
    expect(projectProgress(project({ manualPercent: 70 })).mode).toBe('manual')
    expect(projectProgress(project({ legacyPercent: 25 })).pct).toBe(25)
    expect(projectProgress(project()).mode).toBe('none')
    expect(projectProgress(project()).pct).toBe(0)
    expect(projectProgress(null).pct).toBe(0)
  })

  it('clamps nonsense percentages', () => {
    expect(projectProgress(project({ manualPercent: 480 })).pct).toBe(100)
    expect(projectProgress(project({ manualPercent: -20 })).pct).toBe(0)
  })
})

describe('assignment progress math', () => {
  it('uses the explicit percentage by default', () => {
    const a = assignment({ progress: 40 })
    expect(assignmentProgress(a).pct).toBe(40)
    expect(assignmentProgress(a).mode).toBe('explicit')
  })
  it('derives from subtasks when asked (3/5 = 60%)', () => {
    const a = assignment({
      progress: 10, progressMode: 'subtasks',
      subtasks: [task('a', true), task('b', true), task('c', true), task('d'), task('e')],
    })
    expect(assignmentProgress(a).pct).toBe(60)
    expect(assignmentProgress(a).mode).toBe('subtasks')
    expect(assignmentProgress(a).remaining).toBe(2)
  })
  it('only exposes the 10-point quick steps the UI offers', () => {
    expect(PROGRESS_STEPS).toEqual([0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100])
  })
})

describe('project status engine (§58, §85)', () => {
  it('COMPLETED at 100%', () => {
    const st = projectStatus(project({ milestones: [milestone('m', [task('a', true)])] }), NOW)
    expect(st.id).toBe('completed')
    expect(st.label).toBe('Completed')
    expect(st.tone).toBe('good')
    expect(st.pct).toBe(100)
  })

  it('OVERDUE once the deadline has passed and work is unfinished', () => {
    const st = projectStatus(project({ deadline: '2026-09-03', milestones: [milestone('m', [task('a', true), task('b')])] }), NOW)
    expect(st.id).toBe('overdue')
    expect(st.pct).toBe(50)
    expect(st.passed).toBe(true)
    expect(st.dueText).toBe('Overdue')
  })

  it('AT RISK when 75% of the time has gone but only 40% is done', () => {
    // start Sep 1, deadline Sep 5 23:59 → ~90% elapsed at 09:00 on Sep 5
    const p = project({
      startDate: '2026-09-01', deadline: '2026-09-05',
      milestones: [milestone('m', [task('a', true), task('b', true), task('c'), task('d'), task('e')])], // 40%
    })
    const st = projectStatus(p, NOW)
    expect(st.pct).toBe(40)
    expect(st.elapsedPct).toBeGreaterThanOrEqual(75)
    expect(st.behind).toBeGreaterThan(15)
    expect(st.id).toBe('atRisk')
    expect(st.label).toBe('At risk')
  })

  it('ON TRACK when progress is ahead of the pace line', () => {
    const p = project({
      startDate: '2026-09-01', deadline: '2026-09-20',
      milestones: [milestone('m', [task('a', true), task('b')])], // 50% with 20% of time gone
    })
    const st = projectStatus(p, NOW)
    expect(st.id).toBe('onTrack')
    expect(st.behind).toBeLessThan(0)
    expect(st.daysLeft).toBe(15)
  })

  it('NO DEADLINE is its own honest state', () => {
    const st = projectStatus(project({ deadline: null }), NOW)
    expect(st.id).toBe('noDeadline')
    expect(st.hasDeadline).toBe(false)
    expect(st.dueText).toBe('No deadline')
  })

  it('duration and remaining days are computed, not typed in', () => {
    const st = projectStatus(project({ startDate: '2026-09-05', deadline: '2026-09-08' }), NOW)
    expect(st.durationDays).toBe(3)
    expect(st.daysLeft).toBe(3)
    expect(st.countdown).toMatch(/3d/)
  })
})

describe('assignment status engine (§68)', () => {
  it('URGENT under 24 hours', () => {
    const st = assignmentStatus(assignment({ deadline: '2026-09-05T20:00', progress: 20 }), NOW)
    expect(st.id).toBe('urgent')
    expect(st.hoursLeft).toBeLessThan(24)
    expect(st.label).toBe('Urgent')
    expect(st.tone).toBe('bad')
  })
  it('DUE TODAY label for a same-day deadline', () => {
    const st = assignmentStatus(assignment({ deadline: '2026-09-05T23:59' }), NOW)
    expect(st.dueText).toBe('Due today')
    expect(st.daysLeft).toBe(0)
  })
  it('2 DAYS LEFT label', () => {
    const st = assignmentStatus(assignment({ deadline: '2026-09-07T23:59' }), NOW)
    expect(st.dueText).toBe('2 days left')
  })
  it('OVERDUE once past the deadline and incomplete', () => {
    const st = assignmentStatus(assignment({ deadline: '2026-09-04T18:00', progress: 60 }), NOW)
    expect(st.id).toBe('overdue')
    expect(st.countdown).toMatch(/overdue/)
  })
  it('COMPLETED at 100%', () => {
    const st = assignmentStatus(assignment({ progress: 100, completedAt: '2026-09-04T18:00' }), NOW)
    expect(st.id).toBe('completed')
    expect(st.dueText).toBe('Completed')
  })
  it('ON TRACK when ahead of pace', () => {
    const st = assignmentStatus(assignment({ assignedDate: '2026-09-01', deadline: '2026-09-20T23:59', progress: 70 }), NOW)
    expect(st.id).toBe('onTrack')
  })
})

describe('urgency ordering', () => {
  it('ranks overdue before urgent before comfortable', () => {
    const overdue = assignmentStatus(assignment({ deadline: '2026-09-01T12:00', progress: 20 }), NOW)
    const urgent = assignmentStatus(assignment({ deadline: '2026-09-05T20:00', progress: 20 }), NOW)
    const chill = assignmentStatus(assignment({ deadline: '2026-09-30T20:00', progress: 20 }), NOW)
    expect(urgencyOf(overdue)).toBeGreaterThan(urgencyOf(urgent))
    expect(urgencyOf(urgent)).toBeGreaterThan(urgencyOf(chill))
    expect(urgencyOf(assignmentStatus(assignment({ progress: 100, completedAt: isoLocal(NOW) }), NOW))).toBe(-1)
  })
})

describe('milestones (§59)', () => {
  it('anchors milestones evenly across 0→100', () => {
    const p = project({
      milestones: ['Planning', 'Wireframes', 'Frontend', 'Backend', 'Testing'].map((n) => milestone(n, [])),
    })
    const track = milestoneTrack(p)
    expect(track.map((m) => m.anchor)).toEqual([20, 40, 60, 80, 100])
  })
  it('marks a milestone reached only when its tasks are all done', () => {
    const p = project({
      milestones: [
        milestone('Planning', [task('a', true), task('b', true)]),
        milestone('Build', [task('c', true), task('d')]),
      ],
    })
    const track = milestoneTrack(p)
    expect(track[0].reached).toBe(true)
    expect(track[1].reached).toBe(false)
    expect(track[1].partial).toBe(true)
    expect(track[1].own).toBe(50)
  })
})

describe('series from real timestamps', () => {
  it('progressSeries carries the last logged percent forward per day', () => {
    const p = project({
      progressLog: [
        { at: '2026-09-01T10:00', pct: 10 },
        { at: '2026-09-03T18:30', pct: 35 },
      ],
    })
    const rows = progressSeries(p, '2026-09-01', '2026-09-05')
    expect(rows.map((r) => r.pct)).toEqual([10, 10, 35, 35, 35])
    expect(rows.map((r) => r.date)).toEqual(['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-09-05'])
  })

  it('velocitySeries counts completions per day from completedAt only', () => {
    const tasks = [
      task('a', true, { completedAt: '2026-09-03T08:00' }),
      task('b', true, { completedAt: '2026-09-03T20:00' }),
      task('c', true, { completedAt: '2026-09-05T07:15' }),
      task('d', true, { completedAt: null }), // done, but no timestamp → not counted
    ]
    const rows = velocitySeries([{ tasks }], 3, NOW)
    expect(rows).toHaveLength(3)
    expect(rows.map((r) => r.count)).toEqual([2, 0, 1])
    expect(entityVelocity(project({ milestones: [milestone('m', tasks)] }), 3, NOW).map((r) => r.count)).toEqual([2, 0, 1])
  })

  it('burndown draws the ideal line and the real remaining line', () => {
    const p = project({
      startDate: '2026-09-01', deadline: '2026-09-05',
      progressLog: [{ at: '2026-09-02T12:00', pct: 20 }],
    })
    const b = burndown(p, NOW)
    expect(b.rows).toHaveLength(5)
    expect(b.rows.map((r) => r.ideal)).toEqual([100, 75, 50, 25, 0])
    expect(b.rows[0].actual).toBe(100) // nothing logged yet → nothing done
    expect(b.rows[1].actual).toBe(80)  // 20% done logged on Sep 2
    expect(b.rows[2].actual).toBe(80)  // carried forward
    expect(b.rows[4].future).toBe(false)
    expect(b.todayGap).toBeLessThan(0) // behind the ideal line
  })

  it('burndown is null without both dates (never guesses)', () => {
    expect(burndown(project({ deadline: null }), NOW)).toBeNull()
    expect(burndown(project({ startDate: null, createdAtDay: null }), NOW)).toBeNull()
  })
})

describe('time vs work (§69F)', () => {
  it('flags BEHIND SCHEDULE when elapsed time outruns completed work', () => {
    const p = project({
      startDate: '2026-09-01', deadline: '2026-09-05',
      milestones: [milestone('m', [task('a', true), task('b', true), task('c'), task('d'), task('e')])],
    })
    const t = timeVsWork(p, 'project', NOW)
    expect(t.workPct).toBe(40)
    expect(t.elapsedPct).toBeGreaterThanOrEqual(75)
    expect(t.behind).toBe(true)
    expect(t.remainingWork).toBe(60)
  })
  it('is null when there is no deadline window', () => {
    expect(timeVsWork(project({ deadline: null }), 'project', NOW)).toBeNull()
  })
})

describe('completion history (§69G)', () => {
  it('reports start, completion, duration and estimate variance', () => {
    const a = assignment({
      assignedDate: '2026-09-01', deadline: '2026-09-07T23:59', progress: 100,
      completedAt: '2026-09-05T14:30', estimateMin: 120, actualMin: 180,
    })
    const h = itemHistory(a, 'assignment', NOW)
    expect(h.start).toBe('2026-09-01')
    expect(h.completedDay).toBe('2026-09-05')
    expect(h.durationDays).toBe(4)
    expect(h.estimated).toBe('2h')
    expect(h.actual).toBe('3h')
    expect(h.varianceMin).toBe(60)
    expect(h.finalPct).toBe(100)
    expect(h.early).toBe(true)
  })
  it('is null while the item is still open', () => {
    expect(itemHistory(assignment(), 'assignment', NOW)).toBeNull()
  })
})

describe('dashboards', () => {
  const pDone = project({ id: 'p2', name: 'Shipped', milestones: [milestone('m', [task('a', true)])], completedAt: '2026-08-20T10:00' })
  const pRisk = project({ id: 'p3', name: 'Semester project', deadline: '2026-09-06', startDate: '2026-08-25', milestones: [milestone('m', [task('a', true), task('b'), task('c')])] })
  const pChill = project({ id: 'p4', name: 'Club event', deadline: '2026-09-20', startDate: '2026-09-01', milestones: [milestone('m', [task('a', true), task('b')])] })

  it('counts active / completed / at risk / due this week', () => {
    const s = projectsSummary(stateOf([project(), pDone, pRisk, pChill]), NOW)
    expect(s.total).toBe(4)
    expect(s.completed).toBe(1)
    expect(s.active).toBe(3)
    expect(s.dueThisWeek).toBeGreaterThanOrEqual(2)
    expect(s.rows.find((r) => r.project.id === 'p3').status.id).toMatch(/atRisk|overdue/)
  })

  it('assignment summary buckets today / this week / soon / overdue / completed', () => {
    const items = [
      assignment({ id: 'a1', deadline: '2026-09-05T18:00', progress: 20 }),   // due today + urgent
      assignment({ id: 'a2', deadline: '2026-09-06T18:00', progress: 60 }),   // due soon
      assignment({ id: 'a3', deadline: '2026-09-01T18:00', progress: 40 }),   // overdue
      assignment({ id: 'a4', deadline: '2026-09-30T18:00', progress: 100, completedAt: '2026-09-02T10:00' }), // completed
    ]
    const s = assignmentsSummary(stateOf([], items), NOW)
    expect(s.dueToday).toBe(1)
    expect(s.dueSoon).toBe(2)
    expect(s.overdue).toBe(1)
    expect(s.completed).toBe(1)
    expect(s.open).toHaveLength(3)
    expect(s.dueThisWeek).toBe(2)
  })

  it('priority work puts overdue first, then today, then upcoming', () => {
    const items = [
      assignment({ id: 'a-later', deadline: '2026-09-20T18:00', progress: 10 }),
      assignment({ id: 'a-today', deadline: '2026-09-05T18:00', progress: 30 }),
      assignment({ id: 'a-over', deadline: '2026-09-02T18:00', progress: 30 }),
    ]
    const pw = priorityWork(stateOf([], items), NOW, 3)
    expect(pw.overdue.map((x) => x.item.id)).toEqual(['a-over'])
    expect(pw.dueToday.map((x) => x.item.id)).toEqual(['a-today'])
    expect(pw.all[0].item.id).toBe('a-over')
  })
})

describe('workload (§73)', () => {
  it('counts what lands on each day and sums real estimates', () => {
    const p = project({
      id: 'p1', deadline: '2026-09-08', estimateMin: 60,
      milestones: [milestone('m', [task('a', false, { due: '2026-09-06', estimateMin: 45 }), task('b', true, { due: '2026-09-06' })])],
    })
    const a = assignment({ id: 'a1', deadline: '2026-09-06T18:00', estimateMin: 120 })
    const w = workloadSeries(stateOf([p], [a]), { from: '2026-09-05', days: 7, now: NOW })
    const day6 = w.rows.find((r) => r.date === '2026-09-06')
    expect(day6.count).toBe(2) // assignment deadline + one open task
    expect(day6.minutes).toBe(165) // 120 + 45 (done task excluded)
    const day8 = w.rows.find((r) => r.date === '2026-09-08')
    expect(day8.projects).toHaveLength(1)
    expect(w.rows[0].past).toBe(false)
  })

  it('summary rolls up open work and remaining estimate', () => {
    const p = project({ id: 'p1', deadline: '2026-09-08', milestones: [milestone('m', [task('a', false, { estimateMin: 90 })])] })
    const a = assignment({ id: 'a1', deadline: '2026-09-05T18:00', progress: 50, estimateMin: 120 })
    const s = workloadSummary(stateOf([p], [a]), NOW)
    expect(s.activeProjects).toBe(1)
    expect(s.activeAssignments).toBe(1)
    expect(s.openTasks).toBe(1)
    // 90 (task) + 60 (half of the assignment's 120 estimate is left)
    expect(s.estimatedMinutes).toBe(150)
    expect(s.estimatedLabel).toBe('2h 30m')
  })
})

describe('deadline timeline (§72)', () => {
  const items = () => [
    project({ id: 'p1', name: 'Club website', deadline: '2026-09-08' }),
    assignment({ id: 'a1', name: 'DS assignment', deadline: '2026-09-05T23:00' }),
    assignment({ id: 'a2', name: 'Presentation', deadline: '2026-09-01T23:00', progress: 60 }),
    assignment({ id: 'a3', name: 'Done thing', deadline: '2026-09-03T23:00', progress: 100, completedAt: '2026-09-02T10:00' }),
  ]

  it('groups chronologically by day with a relative label', () => {
    const t = deadlineTimeline(stateOf([items()[0]], items().slice(1)), { now: NOW })
    expect(t.groups.map((g) => g.day)).toEqual(['2026-09-01', '2026-09-03', '2026-09-05', '2026-09-08'])
    expect(t.groups[0].label).toMatch(/days ago/)
    expect(t.groups.find((g) => g.day === '2026-09-05').label).toBe('Today')
    expect(t.count).toBe(4)
  })

  it('filters to overdue / due soon / completed / one kind', () => {
    const st = () => stateOf([items()[0]], items().slice(1))
    expect(deadlineTimeline(st(), { filter: 'overdue', now: NOW }).groups.flatMap((g) => g.entries.map((e) => e.item.name)))
      .toEqual(['Presentation'])
    expect(deadlineTimeline(st(), { filter: 'soon', now: NOW }).groups.flatMap((g) => g.entries.map((e) => e.item.name)))
      .toEqual(['DS assignment'])
    expect(deadlineTimeline(st(), { filter: 'completed', now: NOW }).groups.flatMap((g) => g.entries.map((e) => e.item.name)))
      .toEqual(['Done thing'])
    expect(deadlineTimeline(st(), { filter: 'projects', now: NOW }).groups.flatMap((g) => g.entries.map((e) => e.item.name)))
      .toEqual(['Club website'])
    expect(deadlineTimeline(st(), { filter: 'assignments', now: NOW }).count).toBe(3)
  })
})

describe('project analytics (§60)', () => {
  it('completion trend averages the real logs per day', () => {
    const p1 = project({ id: 'p1', progressLog: [{ at: '2026-09-03T10:00', pct: 20 }] })
    const p2 = project({ id: 'p2', progressLog: [{ at: '2026-09-03T11:00', pct: 60 }] })
    const t = projectCompletionTrend(stateOf([p1, p2]), 5, NOW)
    expect(t.enough).toBe(true)
    expect(t.rows.at(-1).pct).toBe(40)
    expect(t.rows.at(-1).count).toBe(2)
  })
  it('is honest when nothing has been logged', () => {
    expect(projectCompletionTrend(stateOf([project()]), 5, NOW).enough).toBe(false)
  })

  it('weekly completion speed counts real task completions', () => {
    const p = project({
      id: 'p1',
      milestones: [milestone('m', [
        task('a', true, { completedAt: `${TODAY}T08:00` }),
        task('b', true, { completedAt: `${subDaysStr(TODAY, 8)}T08:00` }),
      ])],
    })
    const rows = weeklyCompletionSpeed(stateOf([p]), 3, NOW)
    expect(rows.at(-1).count).toBe(1)
    expect(rows.at(-2).count).toBeGreaterThanOrEqual(1)
  })

  it('compares projects on completion, days left and speed', () => {
    const a = project({ id: 'p1', name: 'A', deadline: '2026-09-20', progressLog: [{ at: '2026-09-01T10:00', pct: 10 }, { at: '2026-09-03T10:00', pct: 50 }] })
    const b = project({ id: 'p2', name: 'B', deadline: '2026-09-06', progressLog: [{ at: '2026-09-04T10:00', pct: 20 }] })
    const c = projectComparison(stateOf([a, b]), NOW)
    expect(c.enough).toBe(true)
    expect(c.rows[0].project.name).toBe('A')
    expect(c.rows[0].speed).toBeGreaterThan(0)
    expect(c.rows[1].overdue).toBe(false)
  })

  it('time distribution only uses real estimates', () => {
    const p = project({
      id: 'p1', category: 'Design',
      milestones: [milestone('m', [task('a', false, { estimateMin: 60, category: 'Design' }), task('b', false, { estimateMin: 120, category: 'Development' })])],
    })
    const t = timeDistribution(stateOf([p]))
    expect(t.enough).toBe(true)
    expect(t.rows[0]).toMatchObject({ label: 'Development', minutes: 120, text: '2h' })
    expect(t.total).toBe(180)
    expect(timeDistribution(stateOf([project()])).enough).toBe(false)
  })
})

describe('filters + search (§78)', () => {
  it('matches work filters against real deadlines', () => {
    const today = assignmentStatus(assignment({ deadline: `${TODAY}T23:00` }), NOW)
    const overdue = assignmentStatus(assignment({ deadline: '2026-09-01T23:00' }), NOW)
    const done = assignmentStatus(assignment({ progress: 100, completedAt: isoLocal(NOW) }), NOW)
    const later = assignmentStatus(assignment({ deadline: '2026-10-01T23:00' }), NOW)
    expect(matchesWorkFilter(today, 'today', NOW)).toBe(true)
    expect(matchesWorkFilter(today, 'week', NOW)).toBe(true)
    expect(matchesWorkFilter(later, 'week', NOW)).toBe(false)
    expect(matchesWorkFilter(overdue, 'overdue', NOW)).toBe(true)
    expect(matchesWorkFilter(done, 'done', NOW)).toBe(true)
    expect(matchesWorkFilter(done, 'open', NOW)).toBe(false)
    expect(matchesWorkFilter(overdue, 'risk', NOW)).toBe(false)
  })

  it('searches names, subjects, notes and task titles with every token', () => {
    const p = project({ id: 'p1', name: 'Portfolio website', description: 'Showcase work', milestones: [milestone('m', [task('Write case study')])] })
    const a = assignment({ id: 'a1', name: 'DS assignment', subject: 'Data Structures', notes: 'binary trees' })
    expect(matchesQuery(p, 'portfolio')).toBe(true)
    expect(matchesQuery(p, 'case study')).toBe(true)
    expect(matchesQuery(p, 'portfolio spreadsheet')).toBe(false)
    expect(matchesQuery(a, 'data structures')).toBe(true)
    expect(matchesQuery(a, 'trees')).toBe(true)
    expect(matchesQuery(a, '')).toBe(true)
  })

  it('sorts by urgency, deadline, progress and name', () => {
    const rows = [
      { assignment: assignment({ id: 'a1', name: 'B', deadline: '2026-09-20T12:00', progress: 10 }), status: assignmentStatus(assignment({ deadline: '2026-09-20T12:00', progress: 10 }), NOW) },
      { assignment: assignment({ id: 'a2', name: 'A', deadline: '2026-09-06T12:00', progress: 90 }), status: assignmentStatus(assignment({ deadline: '2026-09-06T12:00', progress: 90 }), NOW) },
    ]
    expect(sortWorkRows(rows, 'name').map((r) => r.assignment.name)).toEqual(['A', 'B'])
    expect(sortWorkRows(rows, 'deadline').map((r) => r.assignment.name)).toEqual(['A', 'B'])
    expect(sortWorkRows(rows, 'progress').map((r) => r.assignment.name)).toEqual(['A', 'B'])
    expect(sortWorkRows(rows, 'urgency').map((r) => r.assignment.name)).toEqual(['A', 'B'])
  })
})

describe('deadline presets', () => {
  it('turns a preset into a concrete local deadline', () => {
    expect(deadlineFromPreset('2h', NOW)).toBe('2026-09-05T11:00')
    expect(deadlineFromPreset('1d', NOW)).toBe('2026-09-06T09:00')
    expect(deadlineFromPreset('7d', NOW)).toBe('2026-09-12T09:00')
    expect(deadlineFromPreset('nope', NOW)).toBeNull()
  })
})

describe('deadline alerts', () => {
  it('flags open work inside the window, once per day, and never invents deadlines', () => {
    localStorage.clear()
    const state = stateOf(
      [
        project({ id: 'p-far', deadline: '2026-09-20T09:00' }),
        project({ id: 'p-soon', deadline: '2026-09-05T20:00' }),
        project({ id: 'p-done', deadline: '2026-09-05T20:00', completedAt: '2026-09-04T10:00' }),
        project({ id: 'p-none', deadline: null }),
      ],
      [
        assignment({ id: 'a-over', deadline: '2026-09-04T20:00' }),
        assignment({ id: 'a-none', deadline: null }),
      ],
    )

    const due = checkWorkReminders(state, { now: NOW, thresholdHours: 24 })
    expect(due.map((d) => `${d.kind}:${d.item.id}`).sort()).toEqual(['assignment:a-over', 'project:p-soon'])
    expect(workAlertFired('2026-09-05', 'project:p-soon')).toBe(true)

    // the 30s tick stays quiet — each item alerts once per day
    expect(checkWorkReminders(state, { now: NOW, thresholdHours: 24 })).toEqual([])

    // a wider window adds the far project, but already-alerted items stay quiet
    const wide = checkWorkReminders(state, { now: NOW, thresholdHours: 24 * 15 })
    expect(wide.map((d) => d.item.id)).toEqual(['p-far'])

    // the next day the window resets
    const nextDay = new Date('2026-09-06T09:00:00')
    const again = checkWorkReminders(state, { now: nextDay, thresholdHours: 24 })
    expect(again.map((d) => d.item.id).sort()).toEqual(['a-over', 'p-soon'])
  })
})
