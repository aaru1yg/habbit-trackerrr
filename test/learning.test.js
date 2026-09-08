import { describe, it, expect } from 'vitest'
import {
  NOT_ENOUGH,
  MIN_DELTA_MIN,
  isApplyable,
  applyEstimateAction,
  undoEstimateAction,
  estimateSuggestion,
} from '../src/lib/learning.js'
import { kindSuggestion } from '../src/lib/learningKinds.js'
import { dayStr } from '../src/lib/dates.js'

const NOW = new Date('2026-09-08T10:00:00.000Z')
const TODAY = dayStr(NOW)
const daysAgo = (n) => new Date(NOW.getTime() - n * 86400000).toISOString()

/** Completed work with a real estimate and a real actual — the evidence. */
const completedAssignment = (n, estimateMin, actualMin) => ({
  id: `done${n}`, name: `Finished ${n}`, estimateMin, actualMin,
  completedAt: daysAgo(n + 1), archived: false, progress: 100,
})

const baseState = (over = {}) => ({
  habits: [], checkins: {}, routines: [], projects: [], assignments: [],
  goals: [], focusLog: [], preferences: {}, profile: {}, signals: [],
  ...over,
})

/** Three comparable completed assignments, all 50% over estimate. */
const evidenceState = (over = {}) => baseState({
  assignments: [
    completedAssignment(1, 60, 90), completedAssignment(2, 60, 90), completedAssignment(3, 60, 90),
  ],
  ...over,
})

describe('applyEstimateAction — the only write path', () => {
  it('writes exactly the three kinds that store an estimate', () => {
    expect(applyEstimateAction('assignment', { id: 'a1' }, 45)).toEqual({
      type: 'UPDATE_ASSIGNMENT', id: 'a1', patch: { estimateMin: 45 },
    })
    expect(applyEstimateAction('project', { id: 'p1' }, 45)).toEqual({
      type: 'UPDATE_PROJECT', id: 'p1', patch: { estimateMin: 45 },
    })
    expect(applyEstimateAction('project-task', { id: 't1', projectId: 'p1', milestoneId: 'm1' }, 45)).toEqual({
      type: 'UPDATE_TASK', projectId: 'p1', milestoneId: 'm1', taskId: 't1', patch: { estimateMin: 45 },
    })
  })

  /* A habit record carries no estimateMin, so writing one would create a
     field nothing reads — the silent mutation #25 forbids. */
  it('refuses a habit, because a habit has no stored estimate', () => {
    expect(applyEstimateAction('habit', { id: 'h1' }, 45)).toBeNull()
    expect(isApplyable('habit')).toBe(false)
    expect(isApplyable('goal-milestone')).toBe(false)
  })

  it('refuses a non-positive or missing number', () => {
    expect(applyEstimateAction('assignment', { id: 'a1' }, 0)).toBeNull()
    expect(applyEstimateAction('assignment', { id: 'a1' }, -5)).toBeNull()
    expect(applyEstimateAction('assignment', { id: 'a1' }, null)).toBeNull()
    expect(applyEstimateAction('assignment', { id: 'a1' }, 'lots')).toBeNull()
  })

  it('refuses an item with no id', () => {
    expect(applyEstimateAction('assignment', {}, 45)).toBeNull()
  })

  it('rounds to whole minutes', () => {
    expect(applyEstimateAction('assignment', { id: 'a1' }, 44.6).patch.estimateMin).toBe(45)
  })

  it('undoes with the same action and the previous value', () => {
    expect(undoEstimateAction('assignment', { id: 'a1' }, 60)).toEqual({
      type: 'UPDATE_ASSIGNMENT', id: 'a1', patch: { estimateMin: 60 },
    })
  })
})

describe('estimateSuggestion — one item, one number', () => {
  it('says so when there is not enough comparable work', () => {
    const out = estimateSuggestion({ kind: 'assignment', id: 'a1', name: 'Physics set' }, baseState(), { now: NOW })
    expect(out.enough).toBe(false)
    expect(out.applyable).toBe(false)
    expect(out.action).toBeNull()
    expect(out.reason).toBe(NOT_ENOUGH)
  })

  it('suggests the measured mean and names the number on the button', () => {
    const state = evidenceState()
    const item = { kind: 'assignment', id: 'open1', name: 'Physics set', estimateMin: 60, deadline: TODAY }
    const out = estimateSuggestion(item, state, { now: NOW })

    expect(out.enough).toBe(true)
    expect(out.applyable).toBe(true)
    expect(out.suggestedMin).toBe(90)
    expect(out.currentMin).toBe(60)
    expect(out.deltaMin).toBe(30)
    expect(out.samples).toBe(3)
    expect(out.label).toBe('Plan 1h 30m instead')
    expect(out.text).toContain('Physics set')
    expect(out.text).toContain('1h 30m')
    /* The action is the real reducer action, not a description of one. */
    expect(out.action).toEqual({ type: 'UPDATE_ASSIGNMENT', id: 'open1', patch: { estimateMin: 90 } })
    expect(out.undo).toEqual({ type: 'UPDATE_ASSIGNMENT', id: 'open1', patch: { estimateMin: 60 } })
  })

  it('stays quiet when the stored estimate already matches the evidence', () => {
    const state = evidenceState()
    const item = { kind: 'assignment', id: 'open1', name: 'Physics set', estimateMin: 90 }
    const out = estimateSuggestion(item, state, { now: NOW })

    expect(out.enough).toBe(false)
    expect(out.action).toBeNull()
    expect(out.reason).toContain('already matches')
  })

  it('treats a difference under the floor as agreement', () => {
    expect(MIN_DELTA_MIN).toBe(5)
    const state = baseState({
      assignments: [
        completedAssignment(1, 60, 62), completedAssignment(2, 60, 62), completedAssignment(3, 60, 62),
      ],
    })
    const out = estimateSuggestion({ kind: 'assignment', id: 'a1', name: 'X', estimateMin: 60 }, state, { now: NOW })
    expect(out.enough).toBe(false)
  })

  it('explains rather than applies when the kind has no stored estimate', () => {
    const state = baseState({
      focusLog: [1, 2, 3].map((n) => ({
        id: `f${n}`, kind: 'habit', itemId: 'h1', name: 'Write daily',
        startedAt: daysAgo(n), endedAt: daysAgo(n), plannedMin: 30, actualMin: 55, completed: true,
      })),
    })
    const out = estimateSuggestion({ kind: 'habit', id: 'h1', name: 'Write daily' }, state, { now: NOW })

    expect(out.enough).toBe(true)
    expect(out.applyable).toBe(false)
    expect(out.action).toBeNull()
    expect(out.undo).toBeNull()
    expect(out.label).toBeNull()
    expect(out.blockedReason).toContain('no stored estimate')
    expect(out.suggestedMin).toBe(55)
  })

  it('offers an estimate for an item that has none yet', () => {
    const state = evidenceState()
    const out = estimateSuggestion({ kind: 'assignment', id: 'open1', name: 'New one', estimateMin: null }, state, { now: NOW })

    expect(out.enough).toBe(true)
    expect(out.currentMin).toBeNull()
    expect(out.deltaMin).toBeNull()
    expect(out.text).toContain('has no estimate yet')
    expect(out.action.patch.estimateMin).toBe(90)
    expect(out.undo).toBeNull()
  })
})

describe('kindSuggestion — a kind-level drift resolved to one record', () => {
  const weekly = (over = {}) => ({
    id: 'assignment-estimate', kind: 'assignment', samples: 4,
    meanPlannedMin: 30, meanActualMin: 45, drift: 50, tone: 'warn',
    title: 'assignment sessions run long', text: 'Your last 4 ran 45m against 30m planned.',
    ...over,
  })

  it('names the single record it would change', () => {
    const state = baseState({
      assignments: [
        ...[1, 2, 3].map((n) => completedAssignment(n, 30, 45)),
        { id: 'open1', name: 'Physics set', estimateMin: 30, deadline: TODAY, archived: false },
      ],
    })
    const out = kindSuggestion(weekly(), state, { now: NOW })

    expect(out.enough).toBe(true)
    expect(out.applyable).toBe(true)
    expect(out.targetName).toBe('Physics set')
    expect(out.reason).toContain('The next one is Physics set.')
    expect(out.action).toEqual({ type: 'UPDATE_ASSIGNMENT', id: 'open1', patch: { estimateMin: 45 } })
  })

  it('picks the earliest deadline, deterministically', () => {
    const state = baseState({
      assignments: [
        ...[1, 2, 3].map((n) => completedAssignment(n, 30, 45)),
        { id: 'later', name: 'Later one', estimateMin: 30, deadline: '2026-12-01', archived: false },
        { id: 'sooner', name: 'Sooner one', estimateMin: 30, deadline: '2026-09-10', archived: false },
      ],
    })
    expect(kindSuggestion(weekly(), state, { now: NOW }).targetName).toBe('Sooner one')
  })

  it('never applies to archived or finished work', () => {
    const state = baseState({
      assignments: [
        ...[1, 2, 3].map((n) => completedAssignment(n, 30, 45)),
        { id: 'arch', name: 'Archived', estimateMin: 30, archived: true, deadline: TODAY },
        { id: 'fin', name: 'Finished', estimateMin: 30, completedAt: daysAgo(1), archived: false },
      ],
    })
    const out = kindSuggestion(weekly(), state, { now: NOW })
    expect(out.applyable).toBe(false)
    expect(out.action).toBeNull()
    expect(out.blockedReason).toContain('Nothing open')
  })

  it('explains a habit drift instead of writing a field nothing reads', () => {
    const state = baseState()
    const out = kindSuggestion(weekly({ kind: 'habit', id: 'habit-estimate' }), state, { now: NOW })

    expect(out.applyable).toBe(false)
    expect(out.action).toBeNull()
    expect(out.blockedReason).toContain('no stored estimate')
  })

  it('resolves project tasks through their parent ids', () => {
    const state = baseState({
      projects: [{
        id: 'p1', name: 'Thesis', archived: false, deadline: '2026-10-01',
        milestones: [{ id: 'm1', name: 'Draft', tasks: [
          { id: 't1', name: 'Wireframe', done: true, estimateMin: 30, actualMin: 45, completedAt: daysAgo(4) },
          { id: 't2', name: 'Outline', done: true, estimateMin: 30, actualMin: 45, completedAt: daysAgo(3) },
          { id: 't3', name: 'Intro', done: true, estimateMin: 30, actualMin: 45, completedAt: daysAgo(2) },
          { id: 't4', name: 'Copy', done: false, estimateMin: 30 },
        ] }],
      }],
    })
    const out = kindSuggestion(weekly({ kind: 'project-task', id: 'project-task-estimate' }), state, { now: NOW })

    expect(out.applyable).toBe(true)
    expect(out.targetName).toBe('Copy')
    expect(out.action).toEqual({
      type: 'UPDATE_TASK', projectId: 'p1', milestoneId: 'm1', taskId: 't4', patch: { estimateMin: 45 },
    })
  })

  it('handles a missing suggestion without throwing', () => {
    const out = kindSuggestion(null, baseState(), { now: NOW })
    expect(out.enough).toBe(false)
    expect(out.reason).toBe(NOT_ENOUGH)
  })
})
