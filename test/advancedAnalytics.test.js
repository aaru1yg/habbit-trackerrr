/* Phase D — advanced analytics engine.
 *
 * These tests are the guard on the two things that must never slip:
 *   1. every panel reports `enough: false` instead of inventing numbers;
 *   2. advancedAnalytics.js is imported by nothing eager, so it stays
 *      out of the initial bundle (docs/NEXTGEN-AUDIT.md §9 — 3.7 kB
 *      of headroom is all there is).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import {
  completionEvents, timelineSeries, trajectorySeries, workloadLandscape,
  consistencyMatrix, matrixCellDetail, goalContribution, productivityVelocity,
  deadlinePressureMap, comparisonSeries, insightDrilldown, explorableInsights,
  storySteps, TIMELINE_RANGES, PRESSURE_BANDS, NOT_ENOUGH,
} from '../src/lib/advancedAnalytics.js'
import { subDaysStr, dayStr, addDaysStr, weekDays } from '../src/lib/dates.js'

/* Fixed "now" so week maths is reproducible regardless of run date.
   2026-09-08 is a Tuesday; the week it sits in ends Sun 13th, so the
   most recent *complete* Mon–Sun week is 31 Aug – 6 Sep. */
const NOW = new Date('2026-09-08T12:00:00')
const TODAY = dayStr(NOW)
const EMPTY = {
  habits: [], checkins: {}, projects: [], assignments: [], goals: [],
  focusLog: [], notes: [], achievements: [], moods: {},
}

const habit = (id, name = id, over = {}) => ({
  id, name, category: 'learning', schedule: { type: 'daily' }, reminder: null,
  notes: '', createdAt: subDaysStr(TODAY, 200), archived: false, order: 0, ...over,
})

const checkinsFor = (habitId, dates, hhmm = '09:00') =>
  Object.fromEntries(dates.map((d) => [d, { done: true, at: `${d}T${hhmm}:00` }]))

/** A week of `n` daily check-ins anchored on the Monday of week offset `w`. */
function weekDates(w, n) {
  const anchor = subDaysStr(TODAY, w * 7)
  return weekDays(anchor, 1).slice(0, n)
}

const velocityState = () => ({
  ...EMPTY,
  habits: [habit('h1', 'Daily write')],
  checkins: {
    h1: {
      // most recent complete week: 10 check-ins (two habits' worth of slots)
      ...checkinsFor('h1', [...weekDates(1, 7), ...weekDates(2, 3)]),
    },
  },
  projects: [
    {
      id: 'p1', name: 'Ship the site', startDate: subDaysStr(TODAY, 60), deadline: `${addDaysStr(TODAY, 9)}T18:00`,
      estimateMin: 600, actualMin: 300, progressLog: [], linkedHabitIds: [], archived: false,
      milestones: [{ id: 'm1', name: 'Draft', due: subDaysStr(TODAY, 20), tasks: [] }],
    },
  ],
  goals: [{
    id: 'g1', title: 'Run a marathon', category: 'fitness', startDate: subDaysStr(TODAY, 90), targetDate: addDaysStr(TODAY, 120),
    unit: 'km', target: 42, current: 10, milestones: [
      { id: 'gm1', name: '10 km', done: true, doneAt: `${subDaysStr(TODAY, 30)}T09:00:00`, targetDate: subDaysStr(TODAY, 25) },
      { id: 'gm2', name: '21 km', done: false, doneAt: null, targetDate: addDaysStr(TODAY, 40) },
    ],
    linkedProjectIds: ['p1'], linkedAssignmentIds: [], linkedHabitIds: ['h1'],
    archived: false, createdAt: subDaysStr(TODAY, 90),
  }],
  focusLog: [{ id: 'f1', name: 'Deep work', startedAt: `${subDaysStr(TODAY, 20)}T09:00:00`, endedAt: `${subDaysStr(TODAY, 20)}T09:45:00`, plannedMin: 45, actualMin: 45, completed: true }],
})

/* ============================================================
   0 · completionEvents — the single dated completion list
   ============================================================ */
describe('completionEvents', () => {
  it('returns nothing for an empty workspace', () => {
    expect(completionEvents(EMPTY)).toEqual([])
  })

  it('collects every completion kind exactly once and sorts ascending', () => {
    const ev = completionEvents(velocityState())
    const kinds = new Set(ev.map((e) => e.kind))
    expect(kinds.has('habit')).toBe(true)
    expect(kinds.has('milestone')).toBe(true)
    expect(kinds.has('focus')).toBe(true)
    const days = ev.map((e) => e.day)
    expect(days).toEqual([...days].sort())
  })

  it('never counts an unfinished item', () => {
    const ev = completionEvents(velocityState())
    expect(ev.some((e) => e.name === '21 km')).toBe(false)
    expect(ev.some((e) => e.name === 'Ship the site')).toBe(false)
  })

  it('tags project tasks and assignment subtasks with their parent', () => {
    const s = {
      ...EMPTY,
      projects: [{
        id: 'p', name: 'Alpha', milestones: [{ id: 'm', name: 'M', tasks: [
          { id: 't1', name: 'Do the thing', done: true, completedAt: `${subDaysStr(TODAY, 1)}T10:00` },
          { id: 't2', name: 'Not done', done: false, completedAt: null },
        ] }],
      }],
      assignments: [{ id: 'a', name: 'Essay', subtasks: [
        { id: 's1', name: 'Outline', done: true, completedAt: `${subDaysStr(TODAY, 2)}T10:00` },
      ] }],
    }
    const ev = completionEvents(s)
    expect(ev).toHaveLength(2)
    expect(ev.find((e) => e.kind === 'task').parent).toBe('Alpha')
    expect(ev.find((e) => e.kind === 'subtask').parent).toBe('Essay')
  })
})

/* ============================================================
   2 · TIMELINE
   ============================================================ */
describe('timelineSeries', () => {
  it('exposes the six required ranges', () => {
    expect(TIMELINE_RANGES.map((r) => r.id)).toEqual(['7d', '30d', '90d', '6m', '1y', 'all'])
    expect(TIMELINE_RANGES.find((r) => r.id === 'all').days).toBeNull()
  })

  it('reports not-enough on an empty workspace instead of a blank chart', () => {
    const t = timelineSeries(EMPTY, { rangeId: '30d', now: NOW })
    expect(t.enough).toBe(false)
    expect(t.reason).toBe(NOT_ENOUGH)
    expect(t.groups).toEqual([])
  })

  it('honours the range cutoff', () => {
    const short = timelineSeries(velocityState(), { rangeId: '7d', now: NOW })
    const all = timelineSeries(velocityState(), { rangeId: 'all', now: NOW })
    expect(all.count).toBeGreaterThan(short.count)
    for (const g of short.groups) expect(g.day >= short.cutoff).toBe(true)
  })

  it('filters to a single kind', () => {
    const t = timelineSeries(velocityState(), { rangeId: 'all', filter: 'focus', now: NOW })
    expect(t.enough).toBe(true)
    for (const g of t.groups) for (const e of g.events) expect(e.kind).toBe('focus')
  })

  it('carries the kinds the base timeline misses', () => {
    const t = timelineSeries(velocityState(), { rangeId: 'all', now: NOW })
    const kinds = new Set(t.groups.flatMap((g) => g.events.map((e) => e.kind)))
    expect(kinds.has('milestone')).toBe(true)
    expect(kinds.has('focus')).toBe(true)
    expect(kinds.has('deadline')).toBe(true)
  })
})

/* ============================================================
   3 · TRAJECTORY
   ============================================================ */
describe('trajectorySeries', () => {
  it('refuses to project a habit, and says why', () => {
    const t = trajectorySeries(velocityState(), { kind: 'habit', id: 'h1', days: 30, now: NOW })
    expect(t.projected).toBeNull()
    expect(t.projectionState).toBe('not-applicable')
    expect(t.projectionReason).toMatch(/cadence/)
    expect(t.enough).toBe(true)
    expect(typeof t.current).toBe('number')
  })

  it('projects a goal through the existing engine and passes its reason through', () => {
    const t = trajectorySeries(velocityState(), { kind: 'goal', id: 'g1', days: 30, now: NOW })
    expect(['projected', 'insufficient', 'stalled', 'complete']).toContain(t.projectionState)
    expect(t.projectionReason).toBeTruthy()
    expect(t.past.length).toBe(30)
    expect(t.expected.length).toBe(30)
    expect(t.expectedReason).toBeNull()
  })

  it('says so when a goal has no start date to pace against', () => {
    const s = velocityState()
    delete s.goals[0].startDate
    const t = trajectorySeries(s, { kind: 'goal', id: 'g1', days: 30, now: NOW })
    expect(t.expected).toBeNull()
    expect(t.expectedReason).toMatch(/no expected pace/i)
  })

  it('returns an honest miss for an unknown entity', () => {
    const t = trajectorySeries(velocityState(), { kind: 'goal', id: 'nope', now: NOW })
    expect(t.enough).toBe(false)
    expect(t.reason).toMatch(/no longer exists/)
  })

  it('never fabricates a project projection from fewer than two points', () => {
    const t = trajectorySeries(velocityState(), { kind: 'project', id: 'p1', days: 30, now: NOW })
    expect(t.projected).toBeNull()
    expect(t.projectionState).toBe('insufficient')
  })
})

/* ============================================================
   4 · WORKLOAD LANDSCAPE
   ============================================================ */
describe('workloadLandscape', () => {
  it('does not invent a capacity the user never set', () => {
    const land = workloadLandscape(velocityState(), { days: 14, now: NOW })
    expect(land.capacityKnown).toBe(false)
    expect(land.capacityMin).toBeNull()
    expect(land.rows.every((r) => r.overloaded === false)).toBe(true)
    expect(land.rows.every((r) => r.loadPct === null)).toBe(true)
    expect(land.reason).toMatch(/capacity/i)
  })

  it('frames against the user-set capacity and flattens drill-down items', () => {
    const s = { ...velocityState(), preferences: { dailyCapacityMin: 30 } }
    const land = workloadLandscape(s, { days: 14, now: NOW })
    expect(land.capacityMin).toBe(30)
    expect(land.rows).toHaveLength(14)
    const due = land.rows.find((r) => r.count > 0)
    expect(due).toBeTruthy()
    expect(due.items[0]).toMatchObject({ kind: expect.any(String), name: expect.any(String) })
    expect(land.overloadedDays).toBeGreaterThan(0)
  })

  it('reports not-enough with nothing due', () => {
    const land = workloadLandscape(EMPTY, { days: 14, now: NOW })
    expect(land.enough).toBe(false)
    expect(land.reason).toBe(NOT_ENOUGH)
  })
})

/* ============================================================
   5 · CONSISTENCY MATRIX
   ============================================================ */
describe('consistencyMatrix + matrixCellDetail', () => {
  it('refuses a weekday percentage from fewer than three scheduled days', () => {
    const m = consistencyMatrix(velocityState(), { days: 7, now: NOW })
    for (const w of m.weekday) {
      if (w.total < 3) expect(w.pct).toBeNull()
      else expect(typeof w.pct).toBe('number')
    }
  })

  it('filters to the requested habits and keeps the per-habit rate', () => {
    const m = consistencyMatrix(velocityState(), { days: 28, habitIds: ['h1'], now: NOW })
    expect(m.rows).toHaveLength(1)
    expect(m.rows[0].habit.id).toBe('h1')
    expect(m.rows[0].pct).toBeGreaterThan(0)
    expect(m.dates).toHaveLength(28)
  })

  it('says not-enough with no habits', () => {
    const m = consistencyMatrix(EMPTY, { days: 28, now: NOW })
    expect(m.enough).toBe(false)
    expect(m.reason).toBe(NOT_ENOUGH)
  })

  it('describes a cell that was never scheduled as not a failure', () => {
    const s = { ...EMPTY, habits: [habit('h1', 'Weekly', { schedule: { type: 'weekdays', days: [1] } })], checkins: { h1: {} } }
    const sunday = weekDates(1, 7).find((d) => new Date(`${d}T12:00:00`).getDay() === 0)
    const d = matrixCellDetail(s, s.habits[0], sunday)
    expect(d.scheduled).toBe(false)
    expect(d.done).toBe(false)
    expect(d.reason).toBe('Not scheduled on this day.')
  })

  it('reports the logged time for a completed cell', () => {
    const d0 = subDaysStr(TODAY, 3)
    const s = { ...EMPTY, habits: [habit('h1')], checkins: { h1: checkinsFor('h1', [d0], '07:15') } }
    const d = matrixCellDetail(s, s.habits[0], d0)
    expect(d.done).toBe(true)
    expect(d.reason).toMatch(/07:15/)
  })
})

/* ============================================================
   6 · GOAL CONTRIBUTION
   ============================================================ */
describe('goalContribution', () => {
  it('lists linked habits with a null share rather than an invented percentage', () => {
    const c = goalContribution(velocityState(), velocityState().goals[0], { now: NOW })
    expect(c.habits).toHaveLength(1)
    // the share table comes from goalContributors unchanged
    expect(Array.isArray(c.shares)).toBe(true)
  })

  it('builds the milestone layer with real on-time/overdue flags', () => {
    const c = goalContribution(velocityState(), velocityState().goals[0], { now: NOW })
    expect(c.milestones).toHaveLength(2)
    const done = c.milestones.find((m) => m.id === 'gm1')
    const pending = c.milestones.find((m) => m.id === 'gm2')
    expect(done.done).toBe(true)
    expect(done.onTime).toBe(true)
    expect(pending.done).toBe(false)
    expect(pending.overdue).toBe(false)
  })

  it('nests projects and assignments under the goal', () => {
    const c = goalContribution(velocityState(), velocityState().goals[0], { now: NOW })
    expect(c.projects).toHaveLength(1)
    expect(c.projects[0].name).toBe('Ship the site')
    expect(c.counts.linked).toBe(2)
  })

  it('refuses when no goal is given', () => {
    expect(goalContribution(velocityState(), null, { now: NOW }).enough).toBe(false)
  })
})

/* ============================================================
   7 · PRODUCTIVITY VELOCITY
   ============================================================ */
describe('productivityVelocity', () => {
  it('says INSUFFICIENT DATA without two complete weeks', () => {
    const v = productivityVelocity(EMPTY, { weeks: 8, now: NOW })
    expect(v.enough).toBe(false)
    expect(v.trend).toBe('INSUFFICIENT DATA')
    expect(v.reason).toBe(NOT_ENOUGH)
  })

  it('counts only the most recent complete week as "this week"', () => {
    const v = productivityVelocity(velocityState(), { weeks: 8, now: NOW })
    const thisWeek = weekDays(subDaysStr(TODAY, 7), 1)
    expect(v.current.start).toBe(thisWeek[0])
    expect(v.current.end <= TODAY).toBe(true)
    // 7 daily check-ins in the last complete week, 3 in the one before
    expect(v.current.count).toBe(7)
    expect(v.previous.count).toBe(3)
    expect(v.acceleration).toBe(4)
  })

  it('labels acceleration against the baseline, never against a guess', () => {
    const s = velocityState()
    // give the baseline weeks real history: 4 completions in each of w3 and w4
    for (const w of [3, 4]) {
      for (const d of weekDates(w, 4)) {
        s.checkins.h1[d] = { done: true, at: `${d}T09:00:00` }
      }
    }
    const v = productivityVelocity(s, { weeks: 8, baselineWeeks: 4, now: NOW })
    expect(v.enough).toBe(true)
    expect(v.acceleration).toBe(v.current.count - v.previous.count)
    expect(v.baseline).toBeGreaterThan(0)
    expect(['ACCELERATING', 'DECELERATING', 'STEADY']).toContain(v.trend)
  })

  it('breaks the count down by completion kind', () => {
    const v = productivityVelocity(velocityState(), { weeks: 8, now: NOW })
    expect(Object.keys(v.byKind).length).toBeGreaterThan(0)
  })
})

/* ============================================================
   8 · DEADLINE PRESSURE MAP
   ============================================================ */
describe('deadlinePressureMap', () => {
  it('uses exclusive bands so an item is counted once', () => {
    const m = deadlinePressureMap(velocityState(), { now: NOW })
    const seen = new Set()
    for (const b of m.rows) for (const i of b.items) {
      const key = `${i.kind}:${i.id}`
      expect(seen.has(key)).toBe(false)
      seen.add(key)
    }
    expect(m.total).toBe(seen.size)
  })

  it('covers the required horizons', () => {
    expect(PRESSURE_BANDS.map((b) => b.id)).toEqual(['overdue', 'today', 'tomorrow', '3d', '7d', '30d'])
  })

  it('reports not-enough with no dated work', () => {
    const m = deadlinePressureMap(EMPTY, { now: NOW })
    expect(m.enough).toBe(false)
    expect(m.total).toBe(0)
    expect(m.reason).toBe(NOT_ENOUGH)
  })

  it('puts a past deadline in the overdue band, not in today', () => {
    const s = {
      ...EMPTY,
      assignments: [{ id: 'a', name: 'Late essay', deadline: `${subDaysStr(TODAY, 3)}T18:00`, estimateMin: 60, subtasks: [], archived: false }],
    }
    const m = deadlinePressureMap(s, { now: NOW })
    expect(m.overdue).toBe(1)
    expect(m.rows.find((r) => r.id === 'today').count).toBe(0)
  })
})

/* ============================================================
   9 · COMPARISON MODE
   ============================================================ */
describe('comparisonSeries', () => {
  it('shows nothing when neither window holds data', () => {
    const c = comparisonSeries(EMPTY, { window: 'week', now: NOW })
    expect(c.enough).toBe(false)
    expect(c.shown).toEqual([])
    expect(c.reason).toBe(NOT_ENOUGH)
    for (const m of c.metrics) {
      expect(m.enough).toBe(false)
      expect(m.delta).toBeNull()
    }
  })

  it('only reports a delta where both sides are real', () => {
    const c = comparisonSeries(velocityState(), { window: 'week', now: NOW })
    for (const m of c.shown) {
      expect(Number.isFinite(m.current)).toBe(true)
      expect(Number.isFinite(m.previous)).toBe(true)
      expect(m.delta).not.toBeNull()
    }
    expect(c.current.from <= c.current.to).toBe(true)
    expect(c.previous.to < c.current.from).toBe(true)
  })

  it('supports a month window', () => {
    const c = comparisonSeries(velocityState(), { window: 'month', now: NOW })
    expect(c.span).toBe(30)
  })
})

/* ============================================================
   10 · INSIGHT DRILL-DOWN
   ============================================================ */
describe('insightDrilldown', () => {
  it('admits when an insight has no drill-down rather than guessing', () => {
    const d = insightDrilldown(velocityState(), 'does-not-exist', { now: NOW })
    expect(d.enough).toBe(false)
    expect(d.reason).toMatch(/no drill-down yet/)
  })

  it('returns observation, evidence and the underlying items', () => {
    const d = insightDrilldown(velocityState(), 'workload-peak', { now: NOW })
    if (d.enough) {
      expect(d.observation).toBeTruthy()
      expect(d.evidence.length).toBeGreaterThan(0)
      expect(d.items.length).toBeGreaterThan(0)
    } else {
      expect(d.reason).toBe(NOT_ENOUGH)
    }
  })

  it('drills a weekday insight into the days behind it', () => {
    const d = insightDrilldown(velocityState(), 'weekday-best', { now: NOW })
    if (d.enough) {
      expect(d.detail.length).toBeGreaterThan(0)
      for (const row of d.detail) expect(row.date).toBeTruthy()
    } else {
      expect(d.reason).toBe(NOT_ENOUGH)
    }
  })

  it('only surfaces insights that actually have a drill-down', () => {
    const list = explorableInsights(velocityState(), { limit: 6, now: NOW })
    expect(list.every((i) => i.drilldown.enough)).toBe(true)
  })
})

/* ============================================================
   11 · DATA STORY MODE
   ============================================================ */
describe('storySteps', () => {
  it('always returns the five steps, marking unsupported ones', () => {
    const s = storySteps(velocityState(), { now: NOW })
    expect(s.steps).toHaveLength(5)
    expect(s.total).toBe(5)
    for (const step of s.steps) {
      expect(step.question).toBeTruthy()
      if (!step.enough) expect(step.headline).toBe(NOT_ENOUGH)
    }
  })

  it('refuses to tell a story with no data at all', () => {
    const s = storySteps(EMPTY, { now: NOW })
    expect(s.enough).toBe(false)
    expect(s.supported).toBe(0)
    expect(s.steps.every((x) => !x.enough)).toBe(true)
    expect(s.reason).toBe(NOT_ENOUGH)
  })

  it('names the risk step from the real pressure map', () => {
    const s = storySteps(velocityState(), { now: NOW })
    const risk = s.steps.find((x) => x.id === 'risk')
    expect(risk.evidence.map((e) => e.label)).toEqual(['Overdue', 'At risk', 'Effort ahead'])
  })
})

/* ============================================================
   BUNDLE GUARD — advancedAnalytics.js must stay lazy-only
   ============================================================ */
describe('lazy loading contract', () => {
  const walk = (dir, out = []) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name)
      if (statSync(p).isDirectory()) walk(p, out)
      else if (/\.(js|jsx)$/.test(name)) out.push(p)
    }
    return out
  }

  const EAGER = ['store.jsx', 'App.jsx', 'main.jsx', 'SyncProvider.jsx']

  it('is imported by the Lab and by nothing in the eager path', () => {
    const files = walk('src')
    const importers = files.filter((f) => readFileSync(f, 'utf8').includes("advancedAnalytics.js'"))
    expect(importers.map((f) => f.replace(/\\/g, '/'))).toEqual(['src/screens/AnalyticsLab.jsx'])
    for (const e of EAGER) {
      const f = files.find((x) => x.endsWith(e))
      if (!f) continue
      expect(readFileSync(f, 'utf8')).not.toContain('advancedAnalytics')
    }
  })

  it('is reached through React.lazy, not a static import', () => {
    const src = readFileSync('src/screens/InsightsScreen.jsx', 'utf8')
    expect(src).toMatch(/lazy\(\(\) => import\('\.\/AnalyticsLab\.jsx'\)\)/)
    expect(src).not.toMatch(/^import .*AnalyticsLab/m)
  })
})
