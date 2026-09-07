import { describe, expect, it } from 'vitest'
import { buildDayPlan, buildWeekPlan, validatePlan, recoveryPlan, focusRecommendation, focusSessionSummary } from '../src/lib/planning.js'
const now = new Date('2026-09-07T08:00:00')
const state = { preferences: { dailyCapacityMin: 120 }, assignments: [{ id: 'a', name: 'Urgent', priority: 'high', progress: 0, estimateMin: 90, deadline: '2026-09-08T12:00:00' }], projects: [], goals: [], habits: [], checkins: {} }
describe('adaptive planning', () => {
 it('builds a non-overlapping day plan from real estimates', () => { const p = buildDayPlan(state, { now }); expect(p.blocks[0].item.id).toBe('a'); expect(p.validation.valid).toBe(true) })
 it('does not fabricate capacity', () => expect(buildDayPlan({ ...state, preferences: {} }, { now }).fit).toBe('INSUFFICIENT DATA'))
 it('flags overload instead of pretending it fits', () => expect(buildDayPlan({ ...state, preferences: { dailyCapacityMin: 60 } }, { now }).fit).toBe('OVERLOADED'))
 it('validates collisions deterministically', () => expect(validatePlan([{ start: '2026-09-07T09:00:00Z', end: '2026-09-07T10:00:00Z', durationMin: 60 }, { start: '2026-09-07T09:30:00Z', end: '2026-09-07T10:30:00Z', durationMin: 60 }]).valid).toBe(false))
 it('allocates a proposed week and reports its gap', () => expect(buildWeekPlan(state, { now, days: 2 }).requiredMin).toBe(90))
 it('uses one next-best-action source for focus', () => expect(focusRecommendation(state, { now }).item.id).toBe('a'))
 it('records focus actuals without changing estimates', () => expect(focusSessionSummary({ plannedMin: 45, startedAt: '2026-09-07T09:00:00Z', endedAt: '2026-09-07T10:02:00Z', completed: true }).actualMin).toBe(62))
 it('returns a user-controlled recovery classification', () => expect(recoveryPlan(state, { now }).validation).toHaveProperty('reason'))
})
