/* Goal analytics — every derived number must come from real evidence. */
import { describe, it, expect } from 'vitest'
import {
  goalProgressAt, goalActualSeries, goalExpectedSeries, goalVelocity,
  goalProjection, goalConsistency, goalAnalytics,
} from '../src/lib/goalAnalytics.js'
import { todayStr, subDaysStr, addDaysStr, isoLocal } from '../src/lib/dates.js'

const at = (dayOffset, time = '09:00') => `${subDaysStr(todayStr(), -dayOffset)}T${time}:00`
const day = (offset) => (offset === 0 ? todayStr() : subDaysStr(todayStr(), -offset))

const base = () => ({ habits: [], checkins: {}, routines: [], projects: [], assignments: [], goals: [], moods: {} })

describe('goalProgressAt — milestones', () => {
  const goal = {
    id: 'g1',
    milestones: [
      { id: 'm1', name: 'a', done: true, doneAt: at(-10), targetDate: day(-12), order: 0 },
      { id: 'm2', name: 'b', done: true, doneAt: at(-2), targetDate: day(-1), order: 1 },
      { id: 'm3', name: 'c', done: false, doneAt: null, targetDate: day(5), order: 2 },
    ],
  }
  const state = base()

  it('is 0% before any milestone was reached', () => {
    expect(goalProgressAt(state, goal, day(-20))).toBe(0)
  })
  it('steps up exactly when a milestone was reached', () => {
    expect(goalProgressAt(state, goal, day(-10))).toBe(33)
    expect(goalProgressAt(state, goal, day(-3))).toBe(33)
    expect(goalProgressAt(state, goal, day(-2))).toBe(67)
    expect(goalProgressAt(state, goal, day(0))).toBe(67)
  })
  it('reports consistency from on-time milestones', () => {
    const c = goalConsistency(state, goal)
    expect(c.source).toBe('milestones')
    expect(c.pct).toBe(50) // m1 late (done -10 vs target -12? no: -10 is after -12 => late), m2 late too? see below
  })
})

describe('goalProgressAt — linked projects', () => {
  const project = {
    id: 'p1',
    name: 'Ship it',
    createdAtDay: day(-20),
    completedAt: null,
    archived: false,
    manualPercent: 70,
    milestones: [],
    progressLog: [
      { at: at(-20), pct: 0 },
      { at: at(-14), pct: 20 },
      { at: at(-7), pct: 55 },
      { at: at(-1), pct: 70 },
    ],
  }
  const goal = { id: 'g2', milestones: [], linkedProjectIds: ['p1'] }
  const state = { ...base(), projects: [project] }

  it('follows the project log through time', () => {
    expect(goalProgressAt(state, goal, day(-19))).toBe(0)
    expect(goalProgressAt(state, goal, day(-10))).toBe(20)
    expect(goalProgressAt(state, goal, day(-3))).toBe(55)
    expect(goalProgressAt(state, goal, day(0))).toBe(70)
  })
  it('has no value before the project existed', () => {
    expect(goalProgressAt(state, goal, day(-25))).toBeNull()
  })
  it('measures a positive velocity and projects a completion date', () => {
    const v = goalVelocity(state, goal, { days: 14 })
    expect(v).not.toBeNull()
    expect(v.perWeek).toBeGreaterThan(0)
    const p = goalProjection(state, goal)
    expect(p.reason).toBe('projected')
    expect(p.day).toBeTruthy()
    // 30% left at ~ (70-20)/13 days => under two weeks
    const span = p.day >= addDaysStr(todayStr(), 1)
    expect(span).toBe(true)
  })
  it('says work-linked goals have no cadence score', () => {
    expect(goalConsistency(state, goal).pct).toBeNull()
  })
})

describe('goalProgressAt — linked habits', () => {
  const habit = {
    id: 'h1', name: 'Run', category: 'fitness', schedule: { type: 'daily' },
    createdAt: day(-30), archived: false, skips: [], pause: null,
  }
  const checkins = {}
  const days = {}
  for (let i = 0; i <= 20; i += 1) days[day(-i)] = { done: i % 2 === 0 }
  checkins.h1 = days
  const goal = { id: 'g3', milestones: [], linkedHabitIds: ['h1'] }
  const state = { ...base(), habits: [habit], checkins }

  it('derives a trailing-window rate, not a single day', () => {
    const pct = goalProgressAt(state, goal, day(0))
    expect(pct).toBeGreaterThan(30)
    expect(pct).toBeLessThan(70)
  })
  it('consistency equals scheduled days completed', () => {
    const c = goalConsistency(state, goal, { days: 7 })
    expect(c.source).toBe('habits')
    expect(c.pct).toBeGreaterThan(0)
  })
})

describe('honest gaps', () => {
  it('manual-only goals have no history', () => {
    const state = base()
    const goal = { id: 'g4', milestones: [], manualPercent: 40 }
    expect(goalProgressAt(state, goal, day(-5))).toBeNull()
    const series = goalActualSeries(state, goal, { days: 7 })
    expect(series.every((r) => r.pct === null)).toBe(true)
    expect(goalVelocity(state, goal)).toBeNull()
    expect(goalProjection(state, goal).reason).toBe('insufficient')
  })

  it('no expected line without a start+target window', () => {
    expect(goalExpectedSeries(base(), { id: 'g5', startDate: todayStr(), targetDate: null })).toBeNull()
  })

  it('expected line is linear across the goal window', () => {
    const goal = { id: 'g6', startDate: subDaysStr(todayStr(), 10), targetDate: addDaysStr(todayStr(), 10) }
    const rows = goalExpectedSeries(base(), goal, { days: 21 })
    expect(rows[0].pct).toBe(0) // before the window opens
    // today sits at the middle of a -10..+10 window
    const now = rows[rows.length - 1].pct
    expect(now).toBeGreaterThan(45)
    expect(now).toBeLessThan(55)
    // monotonic, never backwards
    for (let i = 1; i < rows.length; i += 1) expect(rows[i].pct).toBeGreaterThanOrEqual(rows[i - 1].pct)
  })
})

describe('goalAnalytics roll-up', () => {
  it('bundles series, velocity, projection and consistency', () => {
    const project = {
      id: 'p9', name: 'P', createdAtDay: day(-16), completedAt: at(-1), archived: false,
      manualPercent: 100,
      milestones: [], progressLog: [{ at: at(-16), pct: 0 }, { at: at(-8), pct: 50 }, { at: at(-1), pct: 100 }],
    }
    const goal = { id: 'g9', milestones: [], linkedProjectIds: ['p9'] }
    const state = { ...base(), projects: [project] }
    const a = goalAnalytics(state, goal, { days: 30 })
    expect(a.actual.length).toBe(30)
    expect(a.expected).toBeNull()
    expect(a.projection.reason).toBe('complete')
    expect(a.consistency.pct).toBeNull()
  })
})

describe('isoLocal sanity', () => {
  it('produces parseable timestamps used by logs', () => {
    expect(isoLocal()).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/)
  })
})
