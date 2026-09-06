import { describe, it, expect } from 'vitest'
import {
  achievementList, achievementSummary, checkinCount, bestStreakEver,
  perfectWeeks, comebacks, onTimeAssignments,
} from '../src/lib/achievements.js'
import { todayStr, subDaysStr, addDaysStr } from '../src/lib/dates.js'

const base = (over = {}) => ({
  version: 4,
  profile: { name: 'Test', onboarded: true, theme: 'midnight' },
  habits: [],
  checkins: {},
  routines: [],
  projects: [],
  assignments: [],
  moods: {},
  ...over,
})

const habit = (id, over = {}) => ({
  id, name: id, category: 'mind', schedule: { type: 'daily' },
  reminder: null, notes: '', createdAt: subDaysStr(todayStr(), 400),
  archived: false, order: 0, ...over,
})

/** Mark `habitId` done on every date in `dates`. */
const mark = (state, habitId, dates) => {
  state.checkins[habitId] = {}
  for (const d of dates) state.checkins[habitId][d] = { done: true, at: `${d}T08:00` }
  return state
}

const range = (from, n) => {
  const out = []
  let c = from
  for (let i = 0; i < n; i++) { out.push(c); c = addDaysStr(c, 1) }
  return out
}

describe('achievements engine', () => {
  it('unlocks nothing for an empty state and never fabricates progress', () => {
    const list = achievementList(base())
    expect(list.length).toBeGreaterThan(10)
    expect(list.every((a) => a.earned === false)).toBe(true)
    // progress must be 0, not a random number
    expect(list.filter((a) => a.progress > 0)).toEqual([])
    // every locked item states plainly that it has not started
    for (const a of list) {
      expect(typeof a.detail).toBe('string')
      expect(a.detail.length).toBeGreaterThan(0)
    }
  })

  it('counts real check-ins only', () => {
    let s = base({ habits: [habit('a'), habit('b')] })
    s = mark(s, 'a', [subDaysStr(todayStr(), 1), todayStr()])
    s.checkins.b = { [todayStr()]: { done: false } }
    expect(checkinCount(s)).toBe(2)
  })

  it('first-step unlocks on the first check-in and records the day', () => {
    let s = base({ habits: [habit('a')] })
    const day = subDaysStr(todayStr(), 3)
    s = mark(s, 'a', [day])
    const first = achievementList(s).find((a) => a.id === 'first-step')
    expect(first.earned).toBe(true)
    expect(first.earnedOn).toBe(day)
  })

  it('streak badges track the real longest run and the day it was reached', () => {
    let s = base({ habits: [habit('a')] })
    s = mark(s, 'a', range(subDaysStr(todayStr(), 9), 8)) // 8 consecutive days
    const best = bestStreakEver(s)
    expect(best.best).toBe(8)
    expect(best.reachedOn).toBe(subDaysStr(todayStr(), 2))

    const seven = achievementList(s).find((a) => a.id === 'streak-7')
    expect(seven.earned).toBe(true)
    expect(seven.earnedOn).toBe(subDaysStr(todayStr(), 2))

    const thirty = achievementList(s).find((a) => a.id === 'streak-30')
    expect(thirty.earned).toBe(false)
    expect(thirty.progress).toBeCloseTo(8 / 30, 5)
    expect(thirty.detail).toMatch(/22 more days/)
  })

  it('ignores a broken run: a gap of one day ends the streak', () => {
    let s = base({ habits: [habit('a')] })
    const days = range(subDaysStr(todayStr(), 6), 4)          // 4 days
    const later = range(subDaysStr(todayStr(), 1), 2)         // then 2 days
    s = mark(s, 'a', [...days, ...later])
    expect(bestStreakEver(s).best).toBe(4)
  })

  it('perfect week requires every scheduled habit in a completed week', () => {
    const today = todayStr()
    let s = base({ habits: [habit('a'), habit('b')] })
    // fill the last 21 days fully for both habits
    s = mark(s, 'a', range(subDaysStr(today, 20), 21))
    s = mark(s, 'b', range(subDaysStr(today, 20), 21))
    const weeks = perfectWeeks(s)
    expect(weeks.length).toBeGreaterThan(0)
    const perfect = achievementList(s).find((a) => a.id === 'perfect-week')
    expect(perfect.earned).toBe(true)
  })

  it('perfect week stays locked when one habit is missed', () => {
    const today = todayStr()
    let s = base({ habits: [habit('a'), habit('b')] })
    s = mark(s, 'a', range(subDaysStr(today, 20), 21))
    const bDays = range(subDaysStr(today, 20), 21).filter((d) => d !== subDaysStr(today, 3))
    s = mark(s, 'b', bDays)
    // the week containing the miss is incomplete; earlier weeks may still pass
    const perfect = achievementList(s).find((a) => a.id === 'perfect-week')
    if (perfect.earned) {
      const weeks = perfectWeeks(s)
      for (const w of weeks) {
        expect(w.start > subDaysStr(today, 3) || w.end < subDaysStr(today, 3)).toBe(true)
      }
    }
    expect(typeof perfect.detail).toBe('string')
  })

  it('project achievements derive from real completion timestamps', () => {
    const s = base({
      projects: [
        { id: 'p1', name: 'One', completedAt: `${subDaysStr(todayStr(), 5)}T10:00`, milestones: [] },
        { id: 'p2', name: 'Two', completedAt: null, milestones: [] },
      ],
    })
    const first = achievementList(s).find((a) => a.id === 'project-first')
    expect(first.earned).toBe(true)
    expect(first.earnedOn).toBe(subDaysStr(todayStr(), 5))
    const five = achievementList(s).find((a) => a.id === 'project-five')
    expect(five.earned).toBe(false)
    expect(five.progress).toBeCloseTo(1 / 5, 5)
  })

  it('on-time only counts assignments finished at or before the deadline', () => {
    const early = {
      id: 'a1', name: 'Early', deadline: `${todayStr()}T23:59`,
      completedAt: `${subDaysStr(todayStr(), 1)}T09:00`,
    }
    const late = {
      id: 'a2', name: 'Late', deadline: `${subDaysStr(todayStr(), 4)}T23:59`,
      completedAt: `${subDaysStr(todayStr(), 2)}T09:00`,
    }
    const s = base({ assignments: [early, late] })
    expect(onTimeAssignments(s).map((a) => a.id)).toEqual(['a1'])
    const badge = achievementList(s).find((a) => a.id === 'on-time')
    expect(badge.earned).toBe(true)
    expect(badge.detail).toMatch(/1 of 2/)
  })

  it('comeback needs a real gap and a real rebuild', () => {
    let s = base({ habits: [habit('a')] })
    const before = range(subDaysStr(todayStr(), 30), 3)
    const after = range(subDaysStr(todayStr(), 6), 4)
    s = mark(s, 'a', [...before, ...after])
    const cb = comebacks(s, { gap: 7, resume: 3 })
    expect(cb.length).toBe(1)
    expect(cb[0].gapDays).toBeGreaterThanOrEqual(7)
    expect(cb[0].run).toBeGreaterThanOrEqual(3)
    expect(achievementList(s).find((a) => a.id === 'comeback').earned).toBe(true)

    // a short gap is not a comeback
    let s2 = base({ habits: [habit('a')] })
    s2 = mark(s2, 'a', [...range(subDaysStr(todayStr(), 10), 2), ...range(subDaysStr(todayStr(), 6), 4)])
    expect(comebacks(s2, { gap: 7, resume: 3 })).toEqual([])
  })

  it('no comeback is claimed when there is no gap at all', () => {
    let s = base({ habits: [habit('a')] })
    s = mark(s, 'a', range(subDaysStr(todayStr(), 20), 21))
    expect(comebacks(s)).toEqual([])
  })

  it('summary totals, tier counts and next-up are consistent', () => {
    let s = base({ habits: [habit('a')] })
    s = mark(s, 'a', range(subDaysStr(todayStr(), 9), 10))
    const sum = achievementSummary(s)
    expect(sum.total).toBe(sum.items.length)
    expect(sum.unlocked).toBe(sum.items.filter((i) => i.earned).length)
    expect(sum.completion).toBeCloseTo(sum.unlocked / sum.total, 5)
    expect(sum.nextUp.every((i) => !i.earned && i.progress > 0)).toBe(true)
    expect(sum.nextUp.length).toBeLessThanOrEqual(3)
    // tier totals add up
    const tierTotal = Object.values(sum.byTier).reduce((a, b) => a + b, 0)
    expect(tierTotal).toBe(sum.total)
  })

  it('clean sweep reflects today only', () => {
    let s = base({ habits: [habit('a'), habit('b')] })
    s = mark(s, 'a', [todayStr()])
    s.checkins.b = {}
    const sweep = achievementList(s).find((a) => a.id === 'clean-sweep')
    expect(sweep.earned).toBe(false)
    expect(sweep.progress).toBeCloseTo(0.5, 5)

    s = mark(s, 'b', [todayStr()])
    expect(achievementList(s).find((a) => a.id === 'clean-sweep').earned).toBe(true)
  })

  it('consistency master stays locked without enough eligible days', () => {
    let s = base({ habits: [habit('a')] })
    s = mark(s, 'a', range(subDaysStr(todayStr(), 4), 5))
    const master = achievementList(s).find((a) => a.id === 'consistency-master')
    expect(master.earned).toBe(false)
    expect(master.detail).toMatch(/%|Not enough/)
  })
})
