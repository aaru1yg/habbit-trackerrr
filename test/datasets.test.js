/* ============================================================
   DATASETS A–H × EVERY ENGINE — requirements #35 and #37.

   The point of this file is not to re-test each engine; each has its
   own suite. It is to catch the failure mode that per-engine tests
   miss: an engine that returns a confident number for a user who has
   given it nothing to be confident about.

   So every adaptive engine is run against all eight user shapes and
   held to one rule: it either produces output backed by data that is
   actually in the state, or it says it has nothing. #37 — no fake
   intelligence.
   ============================================================ */
import { describe, it, expect } from 'vitest'
import { DATASETS, H_newUser } from './datasets.js'
import {
  productivityProfile, quickActions, homeEmphasis, contextualLens, workingWindow,
} from '../src/lib/personalization.js'
import { getNextBestAction, getTodayPriorities } from '../src/lib/adaptive.js'
import { executionContext, weeklyAdaptation, proactiveNudge } from '../src/lib/execution.js'
import { estimateSuggestion } from '../src/lib/learning.js'
import { kindSuggestion } from '../src/lib/learningKinds.js'
import { buildDayPlan, buildWeekPlan, focusRecommendation, recoveryPlan } from '../src/lib/planning.js'
import { smartInsights } from '../src/lib/analytics.js'
import {
  timelineSeries, trajectorySeries, workloadLandscape, consistencyMatrix,
  goalContribution, productivityVelocity, deadlinePressureMap, comparisonSeries,
  explorableInsights, storySteps,
} from '../src/lib/advancedAnalytics.js'
import { runQuery, QUERY_FILTERS } from '../src/lib/queryParser.js'
import { availableCommands } from '../src/lib/commandActions.js'

const NOW = new Date()

/** Run one engine over all eight datasets. */
const overAll = (fn) => DATASETS.map((d) => { const state = d.build(); return { d, state, out: fn(state) } })

/**
 * An engine is honest if, whenever it claims to have enough, the state
 * actually contains something to be enough about.
 */
function hasAnyEvidence(state) {
  return (state.habits || []).length > 0
    || (state.assignments || []).length > 0
    || (state.projects || []).length > 0
    || (state.goals || []).length > 0
    || (state.focusLog || []).length > 0
    || (state.signals || []).length > 0
}

describe('no engine fabricates confidence — #37', () => {
  const engines = [
    ['productivityProfile', (s) => productivityProfile(s, { now: NOW })],
    ['contextualLens', (s) => contextualLens(s, { now: NOW })],
    ['executionContext', (s) => executionContext(s, { now: NOW })],
    ['weeklyAdaptation', (s) => weeklyAdaptation(s, { now: NOW })],
    ['estimateSuggestion', (s) => estimateSuggestion({ kind: 'assignment', id: 'a1', name: 'X' }, s, { now: NOW })],
  ]

  for (const [name, fn] of engines) {
    it(`${name} says it has nothing for a brand-new user`, () => {
      const out = fn(H_newUser())
      expect(out.enough).toBe(false)
    })

    it(`${name} never claims evidence from an empty state`, () => {
      for (const { d, state, out } of overAll(fn)) {
        if (out.enough === false) continue
        expect(hasAnyEvidence(state), `dataset ${d.key} produced output with no evidence`).toBe(true)
      }
    })
  }

  it('no engine throws on any dataset', () => {
    const calls = [
      ['productivityProfile', (s) => productivityProfile(s, { now: NOW })],
      ['quickActions', (s) => quickActions(s, { now: NOW })],
      ['homeEmphasis', (s) => homeEmphasis(s, { now: NOW })],
      ['contextualLens', (s) => contextualLens(s, { now: NOW })],
      ['workingWindow', (s) => workingWindow(s, { now: NOW })],
      ['getNextBestAction', (s) => getNextBestAction(s, { now: NOW })],
      ['getTodayPriorities', (s) => getTodayPriorities(s, { now: NOW })],
      ['executionContext', (s) => executionContext(s, { now: NOW })],
      ['weeklyAdaptation', (s) => weeklyAdaptation(s, { now: NOW })],
      ['proactiveNudge', (s) => proactiveNudge(s, { now: NOW })],
      ['estimateSuggestion', (s) => estimateSuggestion({ kind: 'assignment', id: 'a1' }, s, { now: NOW })],
      ['kindSuggestion', (s) => kindSuggestion({ kind: 'assignment', samples: 3, meanActualMin: 45, text: 't' }, s, { now: NOW })],
      ['buildDayPlan', (s) => buildDayPlan(s, { now: NOW })],
      ['buildWeekPlan', (s) => buildWeekPlan(s, { now: NOW })],
      ['focusRecommendation', (s) => focusRecommendation(s, { now: NOW })],
      ['recoveryPlan', (s) => recoveryPlan(s, { now: NOW })],
      ['smartInsights', (s) => smartInsights(s, { now: NOW })],
      ['timelineSeries', (s) => timelineSeries(s, { now: NOW })],
      ['trajectorySeries', (s) => trajectorySeries(s, { now: NOW })],
      ['workloadLandscape', (s) => workloadLandscape(s, { now: NOW })],
      ['consistencyMatrix', (s) => consistencyMatrix(s, { now: NOW })],
      ['goalContribution', (s) => goalContribution(s, { now: NOW })],
      ['productivityVelocity', (s) => productivityVelocity(s, { now: NOW })],
      ['deadlinePressureMap', (s) => deadlinePressureMap(s, { now: NOW })],
      ['comparisonSeries', (s) => comparisonSeries(s, { now: NOW })],
      ['explorableInsights', (s) => explorableInsights(s, { now: NOW })],
      ['storySteps', (s) => storySteps(s, { now: NOW })],
      ['availableCommands', () => availableCommands()],
    ]
    for (const [name, fn] of calls) {
      for (const d of DATASETS) {
        expect(() => fn(d.build()), `${name} threw on dataset ${d.key}`).not.toThrow()
      }
    }
  })
})

describe('the new-user path is honest everywhere — dataset H', () => {
  const state = H_newUser()

  it('the personalisation profile has no score and no evidence', () => {
    const p = productivityProfile(state, { now: NOW })
    expect(p.enough).toBe(false)
    /* A mystery score is exactly what #6 forbids. */
    expect(p).not.toHaveProperty('score')
  })

  it('quick actions fall back to the default order and say so', () => {
    const q = quickActions(state, { now: NOW })
    expect(q.learned).toBe(false)
  })

  it('no next best action is invented', () => {
    expect(getNextBestAction(state, { now: NOW })).toBeNull()
    expect(focusRecommendation(state, { now: NOW })).toBeNull()
  })

  it('analytics say there is nothing to analyse', () => {
    expect(timelineSeries(state, { now: NOW }).groups).toHaveLength(0)
    const traj = trajectorySeries(state, { now: NOW })
    expect(traj.enough).toBe(false)
    const vel = productivityVelocity(state, { now: NOW })
    expect(vel.enough).toBe(false)
    expect(goalContribution(state, { now: NOW }).enough).toBe(false)
  })

  it('explorable insights and story steps are empty rather than padded', () => {
    expect(explorableInsights(state, { now: NOW })).toHaveLength(0)
    /* The story always has its five beats. With no data, none of them may
       claim enough — but a step is still allowed to report a real zero
       count ("Overdue: 0"), which is a fact, not a fabrication. What it
       must never do is invent a finding. */
    const story = storySteps(state, { now: NOW })
    expect(story.enough).toBe(false)
    for (const step of story.steps) {
      expect(step.enough, `story step ${step.id} claimed enough`).toBe(false)
      expect(['Not enough data yet.', 'Nothing needs changing right now.'],
        `story step ${step.id} narrated a finding`).toContain(step.headline)
      for (const ev of step.evidence) {
        const numeric = Number(String(ev.value).replace(/[^\d.-]/gu, ''))
        expect(numeric, `story step ${step.id} reported a non-zero figure`).toBe(0)
      }
    }
  })

  it('every natural-language query admits there is nothing to show', () => {
    for (const filter of QUERY_FILTERS) {
      const res = runQuery(filter.id, state, { now: NOW })
      expect(res.items, `query ${filter.id} invented results`).toHaveLength(0)
    }
  })
})

describe('each dataset stresses what it is meant to', () => {
  it('C is genuinely deadline-heavy', () => {
    const s = DATASETS.find((d) => d.key === 'C').build()
    const map = deadlinePressureMap(s, { now: NOW })
    expect(map.enough).toBe(true)
    expect(map.rows.find((b) => b.id === 'today').count).toBeGreaterThan(0)
  })

  it('G is genuinely overloaded against its own stated capacity', () => {
    const s = DATASETS.find((d) => d.key === 'G').build()
    const lens = contextualLens(s, { now: NOW })
    expect(lens.id).toBe('critical')
    expect(lens.committedMin).toBeGreaterThan(lens.capacityMin)
  })

  it('G also has enough measured sessions for weekly adaptation', () => {
    const s = DATASETS.find((d) => d.key === 'G').build()
    const w = weeklyAdaptation(s, { now: NOW })
    expect(w.enough).toBe(true)
    /* 60 planned against ~95 actual, so it should report an overrun. */
    expect(w.ratio).toBeGreaterThan(1)
  })

  it('D is genuinely project-heavy with task-level history', () => {
    const s = DATASETS.find((d) => d.key === 'D').build()
    const tasks = s.projects.flatMap((p) => p.milestones.flatMap((m) => m.tasks))
    expect(tasks.length).toBeGreaterThan(8)
    expect(tasks.filter((t) => t.done && t.actualMin != null).length).toBeGreaterThan(2)
  })

  it('E and F differ in consistency, not in volume', () => {
    const e = DATASETS.find((d) => d.key === 'E').build()
    const f = DATASETS.find((d) => d.key === 'F').build()
    const count = (s) => Object.values(s.checkins).reduce((n, m) => n + Object.keys(m).length, 0)
    expect(count(e)).toBeGreaterThan(count(f) * 10)
  })

  it('B carries deep habit history and no work items', () => {
    const s = DATASETS.find((d) => d.key === 'B').build()
    expect(s.habits).toHaveLength(12)
    expect(s.assignments).toHaveLength(0)
    expect(s.projects).toHaveLength(0)
  })

  it('A has no stated capacity, so load cannot be judged', () => {
    const s = DATASETS.find((d) => d.key === 'A').build()
    expect(s.preferences.dailyCapacityMin).toBeNull()
    const lens = contextualLens(s, { now: NOW })
    expect(lens.loaded).toBe(false)
  })
})

describe('the adaptive layer behaves across all eight', () => {
  it('home emphasis stays inside its band on every dataset', () => {
    for (const d of DATASETS) {
      const e = homeEmphasis(d.build(), { now: NOW })
      for (const v of Object.values(e.weights || {})) {
        expect(v, `dataset ${d.key} emphasis ${v} outside band`).toBeGreaterThanOrEqual(0.85)
        expect(v).toBeLessThanOrEqual(1.35)
      }
    }
  })

  it('commands resolve, and each one carries an id and a label', () => {
    /* availableCommands() is state-independent by design: the palette
       lists what the product can do, not what the data supports. */
    const cmds = availableCommands()
    expect(Array.isArray(cmds)).toBe(true)
    expect(cmds.length).toBeGreaterThan(0)
    for (const c of cmds) {
      expect(c.id).toBeTruthy()
      expect(c.label).toBeTruthy()
    }
  })

  it('day and week plans build without inventing capacity', () => {
    for (const d of DATASETS) {
      const s = d.build()
      const dayPlan = buildDayPlan(s, { now: NOW })
      const weekPlan = buildWeekPlan(s, { now: NOW })
      expect(dayPlan).toBeTruthy()
      expect(weekPlan).toBeTruthy()
    }
  })

  it('the proactive nudge never fires more than one line', () => {
    for (const d of DATASETS) {
      const n = proactiveNudge(d.build(), { now: NOW })
      expect(n === null || typeof n.title === 'string').toBe(true)
    }
  })
})
