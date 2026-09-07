import { describe, expect, it } from 'vitest'
import { deadlineRisk, scorePriority, workloadCapacity, getNextBestAction, projectForecast, assignmentPace, rescheduleSuggestions, goalForecast, goalContributors } from '../src/lib/adaptive.js'

const now = new Date('2026-09-07T12:00:00')

describe('adaptive intelligence primitives', () => {
  it('returns honest insufficient data for undated work', () => expect(deadlineRisk({ progress: 20 })).toMatchObject({ id: 'SAFE', enough: false }))
  it('marks work overdue and explains it', () => expect(deadlineRisk({ deadline: '2026-09-06T12:00:00', progress: 80, now })).toMatchObject({ id: 'OVERDUE', enough: true }))
  it('detects capacity risk from remaining effort', () => expect(deadlineRisk({ deadline: '2026-09-08T12:00:00', progress: 60, remainingMin: 150, capacityMin: 60, now }).id).toBe('AT RISK'))
  it('exposes explainable signals and reasons', () => {
    const result = scorePriority({ kind: 'assignment', priority: 'high', progress: 30, estimateMin: 90, deadline: '2026-09-08T12:00:00' }, { now })
    expect(result.signals).toHaveProperty('deadlineScore')
    expect(result.reasons.length).toBeGreaterThan(0)
  })
  it('reports overload without changing input', () => expect(workloadCapacity({ availableMin: 180, items: [{ estimateMin: 120 }, { estimateMin: 90 }] })).toMatchObject({ committedMin: 210, remainingMin: -30, overloaded: true }))
  it('selects a deterministic next action from real open data', () => {
    const result = getNextBestAction({ assignments: [{ id: 'a', name: 'Due soon', priority: 'high', progress: 10, estimateMin: 45, deadline: '2026-09-08T12:00:00' }], projects: [], habits: [], checkins: {} }, { now })
    expect(result.item.id).toBe('a')
    expect(result.reason).toMatch(/due within a day|high priority/)
  })
  it('does not invent a forecast velocity', () => expect(projectForecast({ milestones: [], manualPercent: 50 }, { now })).toMatchObject({ velocityMinPerDay: null, projectedCompletion: null, enough: false }))
  it('calculates assignment expected versus actual pace', () => expect(assignmentPace({ assignedDate: '2026-09-05', deadline: '2026-09-09', progress: 20, estimateMin: 120 }, { now })).toMatchObject({ enough: true, expectedPct: 63, actualPct: 20, gap: -43 }))
  it('only suggests moving non-high priority work and requires confirmation', () => expect(rescheduleSuggestions({ overloaded: true, remainingMin: -60, items: [{ name: 'Reading', priority: 'normal' }] })[0]).toMatchObject({ requiresConfirmation: true }))
  it('does not forecast a goal without a real pace history', () => expect(goalForecast({ assignments: [], projects: [], habits: [] }, { startDate: '2026-09-01', targetDate: '2026-09-15', milestones: [] }, { now })).toMatchObject({ enough: false, reason: 'Not enough history to forecast.' }))
  it('returns honest contributor data without inventing habit percentages', () => expect(goalContributors({ projects: [{ id: 'p', name: 'Build', manualPercent: 50 }], assignments: [], habits: [] }, { linkedProjectIds: ['p'], linkedHabitIds: [] })).toMatchObject({ enough: true, rows: [{ contribution: 100 }] }))
})
