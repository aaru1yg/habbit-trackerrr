/* Shared, explicit fixtures. Nothing random: a test that passes
   only sometimes is worse than no test. */
import { emptyState, makeHabit, makeWork, makeGoal } from '../src/core/schema.js'
import { today, shift } from '../src/core/date.js'

export const D = today()
export const ago = (n) => shift(D, -n)
export const ahead = (n) => shift(D, n)

export function habit(over = {}) {
  return makeHabit({ id: 'h1', name: 'Read', createdAt: ago(60), ...over })
}

export function work(over = {}) {
  return makeWork({ id: 'w1', kind: 'task', title: 'Thing', createdAt: ago(10), startedAt: ago(10), ...over })
}

export function goal(over = {}) {
  return makeGoal({ id: 'g1', title: 'Outcome', createdAt: ago(30), ...over })
}

/** Check-ins for a habit on the given days, all at full value. */
export function hits(habitId, days, value = 1) {
  return { [habitId]: Object.fromEntries(days.map((d) => [d, { value, at: `${d}T09:00` }])) }
}

export function state(over = {}) {
  return { ...emptyState(), ...over }
}
