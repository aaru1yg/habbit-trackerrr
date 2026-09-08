import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  completionAction,
  isCompletable,
  hrefFor,
} from '../src/lib/completion.js'
import {
  NOT_ENOUGH,
  executionContext,
  weeklyAdaptation,
  proactiveNudge,
  dismissNudge,
  isNudgeDismissed,
  dismissedNudges,
} from '../src/lib/execution.js'
import { dayStr, addDaysStr } from '../src/lib/dates.js'

/* A fixed "now" so nothing here depends on the wall clock. The sandbox runs
   UTC while real users do not, so every date is derived from this anchor. */
const NOW = new Date('2026-09-08T10:00:00.000Z')
const TODAY = dayStr(NOW)

const session = (over = {}) => ({
  id: 's',
  kind: 'assignment',
  itemId: 'a1',
  name: 'Physics set',
  startedAt: '2026-09-07T09:00:00.000Z',
  endedAt: '2026-09-07T10:00:00.000Z',
  plannedMin: 30,
  actualMin: 45,
  completed: true,
  interrupted: false,
  ...over,
})

const baseState = (over = {}) => ({
  habits: [],
  checkins: {},
  routines: [],
  projects: [],
  assignments: [],
  goals: [],
  focusLog: [],
  preferences: {},
  profile: {},
  ...over,
})

beforeEach(() => {
  sessionStorage.clear()
})

describe('completionAction — the honest one-tap mapping', () => {
  it('toggles a habit check-in on the local day, not UTC', () => {
    expect(completionAction('habit', { id: 'h1' }, { today: TODAY })).toEqual({
      type: 'TOGGLE_CHECKIN', habitId: 'h1', date: TODAY,
    })
  })

  it('defaults the day to the local today when none is given', () => {
    const act = completionAction('habit', { id: 'h1' })
    expect(act.date).toBe(dayStr(new Date()))
  })

  it('sets an assignment to 100%', () => {
    expect(completionAction('assignment', { id: 'a1' })).toEqual({
      type: 'SET_ASSIGNMENT_PROGRESS', id: 'a1', pct: 100,
    })
  })

  it('carries the parent ids a task toggle needs', () => {
    expect(completionAction('project-task', { id: 't1', projectId: 'p1', milestoneId: 'm1' })).toEqual({
      type: 'TOGGLE_TASK', projectId: 'p1', milestoneId: 'm1', taskId: 't1',
    })
  })

  it('toggles a goal milestone through its goal id', () => {
    expect(completionAction('goal-milestone', { id: 'm1', goalId: 'g1' })).toEqual({
      type: 'TOGGLE_GOAL_MILESTONE', id: 'g1', milestoneId: 'm1',
    })
  })

  /* This is the defect Phase F fixes: a project used to fall through the
     switch, record a finished focus session and change nothing. */
  it('returns null for a project — there is no honest one-tap completion', () => {
    expect(completionAction('project', { id: 'p1' })).toBeNull()
    expect(isCompletable('project')).toBe(false)
  })

  it('is completable for exactly the four kinds that have a real action', () => {
    expect(['habit', 'assignment', 'project-task', 'goal-milestone'].map(isCompletable)).toEqual([true, true, true, true])
    expect(isCompletable('nope')).toBe(false)
  })
})

describe('hrefFor — where the record lives', () => {
  it('routes each kind to its own detail screen', () => {
    expect(hrefFor('assignment', { id: 'a1' })).toBe('assignments/a1')
    expect(hrefFor('habit', { id: 'h1' })).toBe('habits/h1')
    expect(hrefFor('goal-milestone', { id: 'm1', goalId: 'g1' })).toBe('goals/g1')
    expect(hrefFor('project-task', { id: 't1', projectId: 'p1' })).toBe('projects/p1')
    expect(hrefFor('project', { id: 'p1' })).toBe('projects/p1')
  })

  it('falls back to Today rather than a dead link', () => {
    expect(hrefFor('mystery', { id: 'x' })).toBe('today')
  })
})

describe('executionContext — #26, contextual recommendations', () => {
  it('says so when there is nothing open to work on', () => {
    const ctx = executionContext(baseState(), { now: NOW })
    expect(ctx.enough).toBe(false)
    expect(ctx.reason).toBe('Nothing open to work on right now.')
    expect(ctx.item).toBeNull()
  })

  it('names the next action and the window it was chosen in', () => {
    const state = baseState({
      assignments: [{
        id: 'a1', name: 'Physics set', deadline: TODAY, estimateMin: 30,
        progress: 0, completedAt: null, archived: false, createdAtDay: addDaysStr(TODAY, -2),
      }],
      preferences: { dailyCapacityMin: 120 },
    })
    const ctx = executionContext(state, { now: NOW })

    expect(ctx.enough).toBe(true)
    expect(ctx.name).toBe('Physics set')
    expect(ctx.kind).toBe('assignment')
    expect(ctx.href).toBe('assignments/a1')
    expect(ctx.completable).toBe(true)
    expect(ctx.minutes).toBe(30)
    /* The lens reading is joined to the reason; both come from the engines. */
    expect(typeof ctx.context).toBe('string')
    expect(ctx.context.length).toBeGreaterThan(0)
    expect(ctx.lens).toBeTruthy()
  })

  it('marks a project as not completable so the UI can explain instead of lie', () => {
    const state = baseState({
      projects: [{
        id: 'p1', name: 'Thesis', status: 'active', archived: false,
        milestones: [], startDate: addDaysStr(TODAY, -5),
      }],
      preferences: { dailyCapacityMin: 120 },
    })
    const ctx = executionContext(state, { now: NOW })
    if (ctx.enough) {
      expect(ctx.completable).toBe(isCompletable(ctx.kind))
    }
  })
})

describe('weeklyAdaptation — #28, planned vs actual', () => {
  it('refuses to compare when there is no focus history', () => {
    const out = weeklyAdaptation(baseState(), { now: NOW })
    expect(out.enough).toBe(false)
    expect(out.reason).toBe(NOT_ENOUGH)
    expect(out.suggestions).toEqual([])
  })

  it('refuses below three measured sessions and says how many it has', () => {
    const out = weeklyAdaptation(baseState({
      focusLog: [session({ id: 's1' }), session({ id: 's2' })],
    }), { now: NOW })
    expect(out.enough).toBe(false)
    expect(out.sessions).toBe(2)
    expect(out.needed).toBe(3)
    expect(out.reason).toContain('2 finished sessions')
  })

  it('ignores sessions that were abandoned or never measured', () => {
    const out = weeklyAdaptation(baseState({
      focusLog: [
        session({ id: 's1', completed: false }),
        session({ id: 's2', actualMin: null }),
        session({ id: 's3', plannedMin: 0 }),
        session({ id: 's4' }),
      ],
    }), { now: NOW })
    expect(out.enough).toBe(false)
    expect(out.sessions).toBe(1)
  })

  it('ignores history older than the window', () => {
    const out = weeklyAdaptation(baseState({
      focusLog: [
        session({ id: 's1', endedAt: '2026-01-01T10:00:00.000Z' }),
        session({ id: 's2', endedAt: '2026-01-02T10:00:00.000Z' }),
        session({ id: 's3', endedAt: '2026-01-03T10:00:00.000Z' }),
      ],
    }), { now: NOW, days: 28 })
    expect(out.enough).toBe(false)
    expect(out.sessions).toBe(0)
  })

  it('reports the overrun and suggests a kind that runs long', () => {
    const out = weeklyAdaptation(baseState({
      focusLog: [
        session({ id: 's1' }), session({ id: 's2' }),
        session({ id: 's3' }), session({ id: 's4' }),
      ],
    }), { now: NOW })

    expect(out.enough).toBe(true)
    expect(out.sessions).toBe(4)
    expect(out.plannedTotalMin).toBe(120)
    expect(out.actualTotalMin).toBe(180)
    expect(out.ratio).toBe(1.5)
    expect(out.summary).toContain('longer than planned')

    expect(out.suggestions).toHaveLength(1)
    const sug = out.suggestions[0]
    expect(sug.id).toBe('assignment-estimate')
    expect(sug.samples).toBe(4)
    expect(sug.drift).toBe(50)
    expect(sug.tone).toBe('warn')
    /* The suggestion states the measured figure; it is not an order. */
    expect(sug.text).toContain('45m')
    expect(out.reason).toContain('Nothing here changes a stored estimate')
  })

  it('reports a kind that finishes early as good news, not a warning', () => {
    const out = weeklyAdaptation(baseState({
      focusLog: [
        session({ id: 's1', plannedMin: 60, actualMin: 30 }),
        session({ id: 's2', plannedMin: 60, actualMin: 30 }),
        session({ id: 's3', plannedMin: 60, actualMin: 30 }),
      ],
    }), { now: NOW })

    expect(out.enough).toBe(true)
    expect(out.suggestions[0].tone).toBe('good')
    expect(out.suggestions[0].title).toContain('finish early')
    expect(out.summary).toContain('sooner than planned')
  })

  it('says nothing needs to change when plans match reality', () => {
    const out = weeklyAdaptation(baseState({
      focusLog: [
        session({ id: 's1', plannedMin: 45, actualMin: 47 }),
        session({ id: 's2', plannedMin: 45, actualMin: 47 }),
        session({ id: 's3', plannedMin: 45, actualMin: 47 }),
      ],
    }), { now: NOW })

    expect(out.enough).toBe(true)
    expect(out.suggestions).toEqual([])
    expect(out.summary).toContain('Nothing to change.')
  })

  it('needs two samples in a bucket before naming that kind', () => {
    const out = weeklyAdaptation(baseState({
      focusLog: [
        session({ id: 's1', kind: 'habit' }),
        session({ id: 's2', kind: 'assignment' }),
        session({ id: 's3', kind: 'assignment' }),
      ],
    }), { now: NOW })

    expect(out.enough).toBe(true)
    expect(out.suggestions.map((s) => s.kind)).toEqual(['assignment'])
  })

  it('separates kinds so a good habit does not mask a slow assignment', () => {
    const out = weeklyAdaptation(baseState({
      focusLog: [
        session({ id: 's1', kind: 'habit', plannedMin: 30, actualMin: 31 }),
        session({ id: 's2', kind: 'habit', plannedMin: 30, actualMin: 31 }),
        session({ id: 's3', kind: 'assignment', plannedMin: 30, actualMin: 90 }),
        session({ id: 's4', kind: 'assignment', plannedMin: 30, actualMin: 90 }),
      ],
    }), { now: NOW })

    expect(out.suggestions).toHaveLength(1)
    expect(out.suggestions[0].kind).toBe('assignment')
    expect(out.suggestions[0].drift).toBe(200)
  })
})

describe('proactiveNudge — #27, proactive but not spammy', () => {
  const runningLong = () => baseState({
    focusLog: [
      session({ id: 's1' }), session({ id: 's2' }),
      session({ id: 's3' }), session({ id: 's4' }),
    ],
  })

  it('returns nothing at all when no engine produced anything', () => {
    expect(proactiveNudge(baseState(), { now: NOW })).toBeNull()
  })

  it('returns at most one nudge, keyed so it can be dismissed', () => {
    const nudge = proactiveNudge(runningLong(), { now: NOW })
    expect(nudge).toBeTruthy()
    expect(nudge.key).toBe('estimate:assignment-estimate:4')
    expect(nudge.tone).toBe('warn')
    expect(nudge.title).toContain('run long')
  })

  it('stays silent once dismissed, without touching user data', () => {
    const state = runningLong()
    const first = proactiveNudge(state, { now: NOW })
    dismissNudge(first.key)

    expect(isNudgeDismissed(first.key)).toBe(true)
    expect(proactiveNudge(state, { now: NOW })).toBeNull()
    /* A dismissal is session state, never part of the user's data. */
    expect(state.focusLog).toHaveLength(4)
  })

  it('re-raises the nudge when the evidence changes', () => {
    const state = runningLong()
    dismissNudge(proactiveNudge(state, { now: NOW }).key)
    expect(proactiveNudge(state, { now: NOW })).toBeNull()

    /* A fifth session changes the key, so the new evidence can be shown. */
    const grown = { ...state, focusLog: [...state.focusLog, session({ id: 's5' })] }
    const again = proactiveNudge(grown, { now: NOW })
    expect(again).toBeTruthy()
    expect(again.key).toBe('estimate:assignment-estimate:5')
  })

  it('never re-nags for the same key twice', () => {
    dismissNudge('estimate:assignment-estimate:4')
    dismissNudge('estimate:assignment-estimate:4')
    expect(dismissedNudges().filter((k) => k === 'estimate:assignment-estimate:4')).toHaveLength(1)
  })

  it('survives a hostile sessionStorage without breaking the screen', () => {
    /* jsdom's Storage is a Proxy, so spyOn on an instance method silently
       writes a storage key instead of overriding it. Stub the global. */
    const hostile = {
      getItem: () => { throw new Error('unavailable') },
      setItem: () => { throw new Error('quota') },
    }
    vi.stubGlobal('sessionStorage', hostile)
    try {
      expect(() => dismissNudge('any-key')).not.toThrow()
      /* Nothing was remembered, and the screen still renders. */
      expect(isNudgeDismissed('any-key')).toBe(false)
      expect(dismissedNudges()).toEqual([])
      expect(proactiveNudge(baseState(), { now: NOW })).toBeNull()
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
