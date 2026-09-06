/* V3 work layer — phase, pace and pressure are derived, never guessed. */
import { describe, it, expect } from 'vitest'
import {
  projectPhase, phaseTone, PROJECT_PHASES, projectPace, assignmentPressure,
} from '../src/lib/work.js'
import { todayStr, subDaysStr } from '../src/lib/dates.js'

const day = (offset) => (offset === 0 ? todayStr() : subDaysStr(todayStr(), -offset))
const at = (offset, time = '09:00') => `${day(offset)}T${time}:00`

const project = (over = {}) => ({
  id: 'p', name: 'P', startDate: day(-20), deadline: `${day(10)}T18:00:00`,
  milestones: [], progressLog: [], archived: false, completedAt: null, ...over,
})

describe('projectPhase', () => {
  it('names the four life states', () => {
    expect(PROJECT_PHASES.map((p) => p.id)).toEqual(['planned', 'active', 'at-risk', 'completed'])
  })
  it('planned before the start date', () => {
    expect(projectPhase(project({ startDate: day(3) }))).toBe('planned')
  })
  it('active while healthy', () => {
    const p = project({
      milestones: [{ id: 'm', name: 'm', tasks: Array.from({ length: 10 }, (_, i) => ({ id: `t${i}`, done: i < 8, status: i < 8 ? 'done' : 'todo' })) }],
    })
    expect(projectPhase(p)).toBe('active')
  })
  it('at risk when behind the pace line', () => {
    // 30-day window, 2/3 of the time gone, 10% done
    const p = project({
      startDate: day(-20), deadline: `${day(10)}T18:00:00`,
      milestones: [{ id: 'm', name: 'm', tasks: [{ id: 't', done: false, status: 'todo' }, { id: 't2', done: true, status: 'done' }] }],
    })
    expect(projectPhase(p)).toBe('at-risk')
  })
  it('completed once done', () => {
    const p = project({
      completedAt: at(-1),
      milestones: [{ id: 'm', name: 'm', tasks: [{ id: 't', done: true, status: 'done' }] }],
    })
    expect(projectPhase(p)).toBe('completed')
  })
  it('maps phases to tones', () => {
    expect(phaseTone('completed')).toBe('good')
    expect(phaseTone('at-risk')).toBe('warn')
    expect(phaseTone('planned')).toBe('neutral')
    expect(phaseTone('active')).toBe('info')
  })
})

describe('projectPace', () => {
  it('carries the real log forward day by day', () => {
    const p = project({ progressLog: [{ at: at(-10), pct: 30 }, { at: at(-3), pct: 60 }] })
    const { actual } = projectPace(p, { days: 14 })
    // before the first real log entry there is no recorded progress: a gap, not a zero
    expect(actual[0].pct).toBeNull()
    expect(actual[3].pct).toBe(30) // day -10
    expect(actual[actual.length - 1].pct).toBe(60)
  })
  it('has no expected line without a deadline', () => {
    expect(projectPace(project({ deadline: null })).expected).toBeNull()
  })
  it('expected line runs 0→100 across the window', () => {
    const { expected } = projectPace(project(), { days: 31 })
    const today = expected[expected.length - 1]
    expect(today.pct).toBeGreaterThan(55)
    expect(today.pct).toBeLessThan(75) // 20 of ~30 days elapsed
  })
})

describe('assignmentPressure', () => {
  const assignment = (over = {}) => ({
    id: 'a', name: 'A', assignedDate: day(-10), deadline: `${day(10)}T09:00:00`,
    progress: 0, progressMode: 'explicit', subtasks: [], archived: false, completedAt: null, ...over,
  })

  it('drains with the window', () => {
    const half = assignmentPressure(assignment())
    expect(half.segments).toBe(5) // half of a 20-day window left
    const fresh = assignmentPressure(assignment({ assignedDate: day(-1), deadline: `${day(9)}T09:00:00` }))
    expect(fresh.segments).toBeGreaterThan(half.segments)
    const late = assignmentPressure(assignment({ assignedDate: day(-19), deadline: `${day(1)}T09:00:00` }))
    expect(late.segments).toBeLessThan(half.segments)
  })
  it('empty window once the deadline passes', () => {
    const p = assignmentPressure(assignment({ deadline: `${day(-2)}T09:00:00` }))
    expect(p.segments).toBe(0)
    expect(p.tone).toBe('bad')
  })
  it('completed assignments read as relief, not pressure', () => {
    const p = assignmentPressure(assignment({ progress: 100, completedAt: at(-1) }))
    expect(p.segments).toBe(10)
    expect(p.tone).toBe('good')
  })
  it('no deadline means no invented pressure', () => {
    const p = assignmentPressure(assignment({ deadline: null }))
    expect(p.segments).toBeNull()
    expect(p.ratio).toBeNull()
  })
})
