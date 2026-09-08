/* ============================================================
   PHASE E — command registry, universal actions and NL filters.

   These protect three promises:
     1. no command is offered that cannot be performed;
     2. "What should I do next?" is the existing engine, not a rival;
     3. a filter with insufficient data says so instead of showing
        an empty list that looks like an answer.
   ============================================================ */
import { describe, it, expect } from 'vitest'
import {
  COMMANDS, availableCommands, matchCommands, executeCommand,
  nextActionResult, itemActions, resolveItem, UNIVERSAL_ACTIONS,
} from '../src/lib/commandActions.js'
import { QUERY_FILTERS, matchQuery, runQuery, answerQuery } from '../src/lib/queryParser.js'
import { getNextBestAction } from '../src/lib/adaptive.js'

const NOON = (s) => new Date(`${s}T12:00:00`)
const NOW = NOON('2026-09-08')
const TODAY = '2026-09-08' // NOW's local day

const state = {
  habits: [
    { id: 'h1', name: 'Morning run', schedule: { type: 'daily' }, archived: false, createdAt: '2026-01-01' },
    { id: 'h2', name: 'Read', schedule: { type: 'weekdays', days: [1, 2, 3, 4, 5] }, archived: false, createdAt: '2026-01-01' },
  ],
  checkins: { h1: { [TODAY]: { done: true, at: `${TODAY}T07:00:00` } } },
  projects: [{
    id: 'p1', name: 'Habit OS', archived: false, startDate: '2026-06-01', deadline: '2026-09-10T18:00',
    estimateMin: 600, progressLog: [], manualPercent: 10, milestones: [
      { id: 'm1', name: 'Ship', due: '2026-09-10', tasks: [{ id: 't1', name: 'Deploy', done: false, status: 'todo', milestoneId: 'm1', projectId: 'p1' }] },
    ],
  }],
  assignments: [
    { id: 'a1', name: 'Physics set', archived: false, deadline: '2026-09-09T18:00', progress: 0, subtasks: [], estimateMin: 120 },
    { id: 'a2', name: 'Essay', archived: false, deadline: '2026-08-01T18:00', progress: 20, subtasks: [], estimateMin: 240 },
  ],
  goals: [{
    id: 'g1', title: 'Run a marathon', archived: false, startDate: '2026-06-01', targetDate: '2026-12-01',
    unit: 'km', target: 42, current: 5, milestones: [{ id: 'gm1', name: '10 km', done: false, goalId: 'g1' }],
  }],
  preferences: { dailyCapacityMin: 120, weekStartsOn: 1 },
  focusLog: [], moods: {},
}

/* ============================================================
   E10 · registry
   ============================================================ */
describe('command registry', () => {
  it('offers every command the brief lists', () => {
    const ids = availableCommands().map((c) => c.id)
    for (const expected of [
      'capture', 'add-habit', 'create-goal', 'create-project', 'create-assignment',
      'add-project-task', 'start-focus', 'plan-day', 'plan-week', 'view-at-risk',
      'view-workload', 'view-insights', 'open-analytics', 'open-achievements', 'search',
    ]) expect(ids).toContain(expected)
  })

  it('never offers a command it cannot run', () => {
    for (const c of availableCommands()) {
      const r = executeCommand(c.id, state, { now: NOW })
      expect(r.ok).toBe(true)
      expect(r.descriptor).toBeTruthy()
    }
  })

  it('refuses an unknown command honestly', () => {
    const r = executeCommand('launch-missiles', state, { now: NOW })
    expect(r.ok).toBe(false)
    expect(r.reason).toMatch(/does not exist/)
  })

  it('puts every command in a group', () => {
    for (const c of COMMANDS) expect(['Create', 'Focus', 'Review', 'Open']).toContain(c.group)
  })
})

describe('matchCommands', () => {
  it('ranks an exact label match first', () => {
    expect(matchCommands('Plan my day')[0].id).toBe('plan-day')
  })

  it('finds commands by keyword, not just label', () => {
    expect(matchCommands('deep work').map((c) => c.id)).toContain('start-focus')
    expect(matchCommands('homework').map((c) => c.id)).toContain('create-assignment')
    expect(matchCommands('at risk').map((c) => c.id)).toContain('view-at-risk')
  })

  it('returns nothing for empty input rather than the whole list', () => {
    expect(matchCommands('')).toEqual([])
    expect(matchCommands('   ')).toEqual([])
  })

  it('is deterministic — same input, same order', () => {
    const a = matchCommands('plan').map((c) => c.id)
    const b = matchCommands('plan').map((c) => c.id)
    expect(a).toEqual(b)
  })

  it('returns nothing when nothing matches', () => {
    expect(matchCommands('qqqqzzz')).toEqual([])
  })
})

/* ============================================================
   E14 · next best action
   ============================================================ */
describe('nextActionResult', () => {
  it('is the existing engine, not a second implementation', () => {
    const mine = nextActionResult(state, { now: NOW })
    const theirs = getNextBestAction(state, { now: NOW, capacityMin: 120 })
    expect(mine.name).toBe(theirs.item.label || theirs.item.name)
    expect(mine.reason).toBe(theirs.reason)
    expect(mine.risk).toBe(theirs.urgency)
  })

  it('returns the fields the brief asks for', () => {
    const r = nextActionResult(state, { now: NOW })
    expect(r.enough).toBe(true)
    expect(r).toHaveProperty('item')
    expect(r).toHaveProperty('reason')
    expect(r).toHaveProperty('risk')
    expect(r).toHaveProperty('estimatedMin')
    expect(r).toHaveProperty('deadline')
  })

  it('admits when there is nothing to suggest', () => {
    const empty = { habits: [], checkins: {}, projects: [], assignments: [], goals: [] }
    const r = nextActionResult(empty, { now: NOW })
    expect(r.enough).toBe(false)
    expect(r.reason).toMatch(/Nothing open/)
  })
})

/* ============================================================
   E15 · universal action model
   ============================================================ */
describe('itemActions', () => {
  it('gives a habit Complete and View, but never Focus or Move', () => {
    const ids = itemActions('habit', { id: 'h1', name: 'Run', doneToday: false }).map((a) => a.id)
    expect(ids).toContain('view')
    expect(ids).toContain('complete')
    expect(ids).not.toContain('focus')
    expect(ids).not.toContain('move')
  })

  it('gives an assignment Focus, Complete, Move and Delete', () => {
    const ids = itemActions('assignment', state.assignments[0]).map((a) => a.id)
    expect(ids).toEqual(expect.arrayContaining(['view', 'focus', 'complete', 'move', 'delete']))
  })

  it('gives a project Add task and Link, but not Complete', () => {
    const ids = itemActions('project', state.projects[0]).map((a) => a.id)
    expect(ids).toContain('add-task')
    expect(ids).toContain('link')
    expect(ids).not.toContain('complete')
  })

  it('gives a goal Add milestone and Link', () => {
    const ids = itemActions('goal', state.goals[0]).map((a) => a.id)
    expect(ids).toEqual(expect.arrayContaining(['view', 'add-milestone', 'link']))
  })

  it('marks destructive actions so the UI must confirm them', () => {
    const destructive = itemActions('assignment', state.assignments[0]).filter((a) => a.destructive)
    expect(destructive.length).toBeGreaterThan(0)
    expect(destructive.map((a) => a.id)).toEqual(expect.arrayContaining(['delete']))
  })

  it('attaches an undo action to every hard delete', () => {
    for (const a of itemActions('assignment', state.assignments[0])) {
      if (a.id === 'delete') expect(a.undo).toBeTruthy()
    }
  })

  it('every action names a real handler', () => {
    for (const kind of ['habit', 'assignment', 'project', 'goal']) {
      for (const a of itemActions(kind, { id: 'x', name: 'X', goalId: 'g', projectId: 'p', milestoneId: 'm' })) {
        expect(a.dispatch || a.href || a.form || a.focus || a.link || a.reschedule).toBeTruthy()
      }
    }
  })

  it('only ever exposes actions from the universal vocabulary', () => {
    const allowed = [...UNIVERSAL_ACTIONS, 'add-task', 'add-milestone']
    for (const kind of ['habit', 'assignment', 'project', 'goal', 'project-task', 'goal-milestone']) {
      for (const a of itemActions(kind, { id: 'x', name: 'X', goalId: 'g', projectId: 'p', milestoneId: 'm' })) {
        expect(allowed).toContain(a.id)
      }
    }
  })

  it('returns nothing for a missing entity', () => {
    expect(itemActions('habit', null)).toEqual([])
  })

  it('labels a completed habit Undo rather than Complete', () => {
    const done = itemActions('habit', { id: 'h1', name: 'Run', doneToday: true }).find((a) => a.id === 'complete')
    expect(done.label).toBe('Undo')
  })
})

describe('resolveItem', () => {
  it('finds a habit and reports whether it is done today', () => {
    const r = resolveItem(state, 'habit', 'h1', { now: NOW })
    expect(r.entity.doneToday).toBe(true)
    expect(resolveItem(state, 'habit', 'h2', { now: NOW }).entity.doneToday).toBe(false)
  })

  it('returns null for something that does not exist', () => {
    expect(resolveItem(state, 'habit', 'nope', { now: NOW })).toBeNull()
    expect(resolveItem(state, 'spaceship', 'x', { now: NOW })).toBeNull()
  })
})

/* ============================================================
   E13 · natural-language filters
   ============================================================ */
describe('matchQuery', () => {
  it.each([
    ['assignments due this week', 'due-this-week'],
    ['what is due by Friday', 'due-this-week'],
    ['projects at risk', 'at-risk'],
    ['anything overdue', 'at-risk'],
    ['habits I’m missing', 'missing-habits'],
    ["habits i'm missing", 'missing-habits'],
    ['overloaded days', 'overloaded-days'],
    ['goals behind pace', 'goals-behind'],
    ['what should I do today', 'today'],
    ['things I should do today', 'today'],
  ])('maps %j to %s', (text, id) => {
    expect(matchQuery(text)?.id).toBe(id)
  })

  it('returns null for an ordinary search so search stays search', () => {
    expect(matchQuery('DSA')).toBeNull()
    expect(matchQuery('Habit OS')).toBeNull()
    expect(matchQuery('')).toBeNull()
  })

  it('lists its supported filters', () => {
    expect(QUERY_FILTERS.map((f) => f.id)).toEqual([
      'due-this-week', 'at-risk', 'missing-habits', 'overloaded-days', 'goals-behind', 'today',
    ])
  })
})

describe('runQuery', () => {
  it('finds work due inside the current week only', () => {
    const r = runQuery(state, 'due-this-week', { now: NOW })
    expect(r.enough).toBe(true)
    expect(r.items.map((i) => i.id)).toContain('a1')
    expect(r.items.map((i) => i.id)).toContain('p1')
    // the overdue August essay is not "due this week"
    expect(r.items.map((i) => i.id)).not.toContain('a2')
  })

  it('flags the overdue assignment as at risk', () => {
    const r = runQuery(state, 'at-risk', { now: NOW })
    expect(r.enough).toBe(true)
    expect(r.items.map((i) => i.id)).toContain('a2')
  })

  it('lists habits scheduled today but not done', () => {
    const r = runQuery(state, 'missing-habits', { now: NOW })
    // h1 is done today; h2 is a weekday habit and Tuesday is scheduled
    expect(r.items.map((i) => i.id)).toEqual(['h2'])
  })

  it('says so honestly when capacity was never set', () => {
    const noCapacity = { ...state, preferences: { dailyCapacityMin: null, weekStartsOn: 1 } }
    const r = runQuery(noCapacity, 'overloaded-days', { now: NOW })
    expect(r.enough).toBe(false)
    expect(r.reason).toMatch(/Set a daily capacity/)
  })

  it('measures overload against the user’s own capacity', () => {
    const r = runQuery(state, 'overloaded-days', { now: NOW })
    // 120 (assignment) + 600 (project) land on 9 Sep → over a 120 min day
    expect(r.enough).toBe(true)
    expect(r.items[0].sub).toMatch(/over your/)
  })

  it('refuses to call a goal behind pace without a pace to compare', () => {
    const noPace = { ...state, goals: [{ ...state.goals[0], startDate: null }] }
    const r = runQuery(noPace, 'goals-behind', { now: NOW })
    expect(r.enough).toBe(false)
    expect(r.reason).toMatch(/no pace to compare/)
  })

  it('measures a goal against its real expected pace', () => {
    const r = runQuery(state, 'goals-behind', { now: NOW })
    expect(r.enough).toBe(true)
    // 5/42 km ≈ 12% done, well under the expected pace by September
    expect(r.items.map((i) => i.id)).toContain('g1')
  })

  it('delegates "what should I do today" to the priority engine', () => {
    const r = runQuery(state, 'today', { now: NOW })
    expect(r.enough).toBe(true)
    expect(r.reason).toMatch(/priority engine/)
    expect(r.items[0].sub).toMatch(/^#1/)
  })

  it('refuses an unknown filter rather than returning a misleading empty list', () => {
    const r = runQuery(state, 'nope', { now: NOW })
    expect(r.enough).toBe(false)
    expect(r.reason).toMatch(/does not exist/)
  })

  it('says "Not enough data yet." on an empty workspace', () => {
    const empty = { habits: [], checkins: {}, projects: [], assignments: [], goals: [], preferences: { dailyCapacityMin: 120, weekStartsOn: 1 } }
    for (const f of ['due-this-week', 'at-risk', 'missing-habits', 'today']) {
      expect(runQuery(empty, f, { now: NOW }).enough).toBe(false)
    }
  })
})

describe('answerQuery', () => {
  it('matches and runs in one step', () => {
    const r = answerQuery(state, 'projects at risk', { now: NOW })
    expect(r.id).toBe('at-risk')
    expect(r.items.length).toBeGreaterThan(0)
  })

  it('returns null for plain search text', () => {
    expect(answerQuery(state, 'DSA', { now: NOW })).toBeNull()
  })
})
