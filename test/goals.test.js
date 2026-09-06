import { describe, it, expect } from 'vitest'
import {
  goalProgress, goalPace, goalHealth, goalSummary, nextMilestone,
  goalTodayActions, openGoals, activeGoals, areaOf,
} from '../src/lib/goals.js'
import { todayStr, subDaysStr, addDaysStr } from '../src/lib/dates.js'
import { normalizeImport, exportPayload } from '../src/lib/importExport.js'

const NOW = new Date()
const base = (over = {}) => ({
  version: 4,
  profile: { name: 'T', onboarded: true, theme: 'midnight' },
  habits: [], checkins: {}, routines: [], projects: [], assignments: [], goals: [], moods: {},
  ...over,
})

const habit = (id, over = {}) => ({
  id, name: id, category: 'mind', schedule: { type: 'daily' },
  reminder: null, createdAt: subDaysStr(todayStr(), 60), archived: false, ...over,
})
const goal = (over = {}) => ({
  id: 'g1', title: 'Run a half marathon', why: '', area: 'fitness',
  startDate: subDaysStr(todayStr(), 10), targetDate: addDaysStr(todayStr(), 10),
  status: 'active', milestones: [], linkedHabitIds: [], linkedProjectIds: [],
  linkedAssignmentIds: [], manualPercent: null, notes: '', archived: false, order: 0, ...over,
})

const mark = (state, habitId, dates) => {
  state.checkins[habitId] = {}
  for (const d of dates) state.checkins[habitId][d] = { done: true }
  return state
}
const range = (from, n) => {
  const out = []
  let c = from
  for (let i = 0; i < n; i++) { out.push(c); c = addDaysStr(c, 1) }
  return out
}

describe('goal progress', () => {
  it('reports 0% and says why when nothing is linked', () => {
    const p = goalProgress(base(), goal())
    expect(p.pct).toBe(0)
    expect(p.source).toBe('none')
    expect(p.detail).toMatch(/Nothing linked/)
  })

  it('prefers milestones when they exist', () => {
    const g = goal({ milestones: [
      { id: 'm1', name: 'A', done: true }, { id: 'm2', name: 'B', done: false },
      { id: 'm3', name: 'C', done: false },
    ] })
    const p = goalProgress(base(), g)
    expect(p.pct).toBe(33)
    expect(p.source).toBe('milestones')
    expect(p.done).toBe(1)
    expect(p.total).toBe(3)
  })

  it('falls back to linked habits and uses their real 30-day rate', () => {
    let s = base({ habits: [habit('run')] })
    s = mark(s, 'run', range(subDaysStr(todayStr(), 29), 30)) // every day in the window
    const p = goalProgress(s, goal({ linkedHabitIds: ['run'] }))
    expect(p.source).toBe('habits')
    expect(p.pct).toBe(100)
    expect(p.detail).toMatch(/scheduled habit days/)
  })

  it('counts only the days actually done, not the whole window', () => {
    let s = base({ habits: [habit('run')] })
    s = mark(s, 'run', range(subDaysStr(todayStr(), 29), 10)) // 10 of 30 eligible
    const p = goalProgress(s, goal({ linkedHabitIds: ['run'] }))
    expect(p.pct).toBe(33)
    expect(p.done).toBe(10)
    expect(p.total).toBe(30)
  })

  it('says so, rather than guessing, when a linked habit has no completions', () => {
    const s = base({ habits: [habit('run')] })
    const p = goalProgress(s, goal({ linkedHabitIds: ['run'] }))
    expect(p.pct).toBe(0)
    expect(p.detail).toMatch(/0 of 30 scheduled habit days/)
  })

  it('averages linked projects when there are no habits', () => {
    const s = base({
      projects: [
        { id: 'p1', name: 'P1', milestones: [{ id: 'm', name: 'M', tasks: [{ id: 't', name: 'T', done: true }, { id: 'u', name: 'U', done: false }] }] },
      ],
    })
    const p = goalProgress(s, goal({ linkedProjectIds: ['p1'] }))
    expect(p.source).toBe('projects')
    expect(p.pct).toBe(50)
  })

  it('uses manualPercent only as a last resort', () => {
    const p = goalProgress(base(), goal({ manualPercent: 70 }))
    expect(p.pct).toBe(70)
    expect(p.source).toBe('manual')
  })
})

describe('goal pace and health', () => {
  it('pace is null without both dates, and never claims otherwise', () => {
    expect(goalPace(goal({ startDate: null }))).toBe(null)
    expect(goalPace(goal({ targetDate: null }))).toBe(null)
  })

  it('halfway through the window the pace line sits near 50%', () => {
    const pace = goalPace(goal({
      startDate: subDaysStr(todayStr(), 10),
      targetDate: addDaysStr(todayStr(), 10),
    }), { now: NOW })
    expect(pace.expected).toBeGreaterThanOrEqual(48)
    expect(pace.expected).toBeLessThanOrEqual(52)
  })

  it('a goal at 0% halfway through is behind, not "on track"', () => {
    const h = goalHealth(base(), goal({ milestones: [{ id: 'm', name: 'A', done: false }] }), { now: NOW })
    expect(h.tone).toBe('warn')
    expect(h.label).toBe('Behind pace')
    expect(h.note).toMatch(/behind/)
  })

  it('a past target date is called out honestly', () => {
    const h = goalHealth(base(), goal({
      targetDate: subDaysStr(todayStr(), 3),
      milestones: [{ id: 'm', name: 'A', done: false }],
    }), { now: NOW })
    expect(h.tone).toBe('bad')
    expect(h.label).toBe('Past target')
  })

  it('a completed goal reads as reached', () => {
    const h = goalHealth(base(), goal({
      milestones: [{ id: 'm', name: 'A', done: true }],
    }), { now: NOW })
    expect(h.tone).toBe('good')
    expect(h.label).toBe('Reached')
  })

  it('no target date means no pace judgement', () => {
    const h = goalHealth(base(), goal({ targetDate: null, milestones: [{ id: 'm', name: 'A', done: false }] }), { now: NOW })
    expect(h.tone).toBe('neutral')
    expect(h.pace).toBe(null)
  })
})

describe('goal milestones', () => {
  it('nextMilestone picks the earliest unfinished one', () => {
    const g = goal({ milestones: [
      { id: 'a', name: 'Later', done: false, targetDate: addDaysStr(todayStr(), 9), order: 0 },
      { id: 'b', name: 'Sooner', done: false, targetDate: addDaysStr(todayStr(), 2), order: 1 },
      { id: 'c', name: 'Done', done: true, targetDate: addDaysStr(todayStr(), 1), order: 2 },
    ] })
    expect(nextMilestone(g).name).toBe('Sooner')
  })

  it('returns null when everything is done', () => {
    expect(nextMilestone(goal({ milestones: [{ id: 'a', name: 'A', done: true }] }))).toBe(null)
  })
})

describe('goal today actions', () => {
  it('lists linked habits still unchecked today', () => {
    let s = base({ habits: [habit('a'), habit('b')] })
    s = mark(s, 'a', [todayStr()])
    const actions = goalTodayActions(s, goal({ linkedHabitIds: ['a', 'b'] }), { date: todayStr() })
    expect(actions.map((x) => x.id)).toEqual(['a', 'b'])
    expect(actions.find((x) => x.id === 'a').done).toBe(true)
    expect(actions.find((x) => x.id === 'b').done).toBe(false)
  })

  it('includes project tasks that are already due', () => {
    const s = base({
      projects: [{ id: 'p1', name: 'P', milestones: [{ id: 'm', name: 'M', tasks: [
        { id: 'due', name: 'Overdue task', done: false, due: subDaysStr(todayStr(), 1) },
        { id: 'later', name: 'Later task', done: false, due: addDaysStr(todayStr(), 5) },
        { id: 'done', name: 'Done task', done: true, due: subDaysStr(todayStr(), 1) },
      ] }] }],
    })
    const actions = goalTodayActions(s, goal({ linkedProjectIds: ['p1'] }), { date: todayStr() })
    expect(actions.map((x) => x.id)).toEqual(['due'])
  })
})

describe('goal summary', () => {
  it('summarises an empty state without inventing numbers', () => {
    const s = goalSummary(base(), { now: NOW })
    expect(s.open).toBe(0)
    expect(s.completed).toBe(0)
    expect(s.avg).toBe(null)
    expect(s.nextDeadline).toBe(null)
  })

  it('counts open, reached and at-risk goals', () => {
    const s = base({
      goals: [
        goal({ id: 'g1', milestones: [{ id: 'm', name: 'A', done: false }], targetDate: subDaysStr(todayStr(), 5) }),
        goal({ id: 'g2', milestones: [{ id: 'm', name: 'A', done: true }] }),
        goal({ id: 'g3', title: 'Archived', archived: true }),
      ],
    })
    const sum = goalSummary(s, { now: NOW })
    expect(sum.open).toBe(1)
    expect(sum.completed).toBe(1)
    expect(sum.atRisk.length).toBe(1)
    expect(activeGoals(s).map((g) => g.id)).toEqual(['g1', 'g2'])
    expect(openGoals(s).map((g) => g.id)).toEqual(['g1'])
  })
})

describe('goal persistence', () => {
  it('survives an export/import round-trip', () => {
    const s = base({
      habits: [habit('run')],
      goals: [goal({ id: 'keep', linkedHabitIds: ['run'], milestones: [{ id: 'm', name: 'A', done: false }] })],
    })
    const back = normalizeImport(JSON.parse(JSON.stringify(exportPayload(s))))
    expect(back.goals.length).toBe(1)
    expect(back.goals[0].id).toBe('keep')
    expect(back.goals[0].linkedHabitIds).toEqual(['run'])
    expect(back.goals[0].milestones[0].name).toBe('A')
  })

  it('drops links to habits that no longer exist', () => {
    const s = base({ goals: [goal({ linkedHabitIds: ['ghost'] })] })
    const back = normalizeImport(JSON.parse(JSON.stringify(exportPayload(s))))
    expect(back.goals[0].linkedHabitIds).toEqual([])
  })

  it('a document with no goals key imports cleanly as empty', () => {
    const back = normalizeImport({ version: 4, habits: [habit('a')], checkins: {} })
    expect(back.goals).toEqual([])
  })

  it('rejects a goal with no title', () => {
    const back = normalizeImport({ habits: [], goals: [{ id: 'x', why: 'no title' }] })
    expect(back.goals).toEqual([])
  })

  it('unknown areas fall back rather than breaking the doc', () => {
    const back = normalizeImport({ habits: [], goals: [{ id: 'g', title: 'T', area: 'not-a-real-area' }] })
    expect(back.goals[0].area).toBe('mind')
    expect(areaOf(back.goals[0].area).label).toBe('Mind')
  })
})
