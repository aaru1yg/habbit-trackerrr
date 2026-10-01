import { describe, it, expect } from 'vitest'
import {
  scheduled, progressOn, streak, consistency, dayScore,
  workProgress, workStatus, pace, sortByUrgency, dueByDay,
  goalProgress, moodCorrelation, lifetime, earnedMilestones, nextUp,
} from '../src/core/compute.js'
import { habit, work, goal, hits, state, D, ago, ahead } from './fixtures.js'
import { dow, shift } from '../src/core/date.js'

describe('scheduled', () => {
  it('a daily habit is due every day', () => {
    expect(scheduled(habit(), D)).toBe(true)
  })

  it('a specific-days habit is only due on those weekdays', () => {
    const h = habit({ cadence: { type: 'days', days: [dow(D)] } })
    expect(scheduled(h, D)).toBe(true)
    expect(scheduled(h, shift(D, 1))).toBe(dow(shift(D, 1)) === dow(D))
  })

  it('is never due before it was created or after it was archived', () => {
    const h = habit({ createdAt: ago(3), archivedAt: D })
    expect(scheduled(h, ago(4))).toBe(false)
    expect(scheduled(h, ago(2))).toBe(true)
    expect(scheduled(h, D)).toBe(false)
  })
})

describe('progressOn', () => {
  it('treats a counted habit as done only at its goal', () => {
    const h = habit({ target: { type: 'count', goal: 8, unit: 'glasses' } })
    const c = hits('h1', [D], 7)
    expect(progressOn(h, c, D).done).toBe(false)
    expect(progressOn(h, c, D).started).toBe(true)
    expect(progressOn(h, hits('h1', [D], 8), D).done).toBe(true)
  })

  it('never reports a ratio above 1', () => {
    const h = habit({ target: { type: 'count', goal: 2, unit: 'x' } })
    expect(progressOn(h, hits('h1', [D], 99), D).ratio).toBe(1)
  })
})

describe('streak', () => {
  it('counts consecutive completed days', () => {
    const c = hits('h1', [D, ago(1), ago(2), ago(3)])
    expect(streak(habit(), c, D).current).toBe(4)
  })

  it('does not break on an unfinished today — the day is not over', () => {
    const c = hits('h1', [ago(1), ago(2), ago(3)])
    expect(streak(habit(), c, D).current).toBe(3)
  })

  it('breaks on a genuinely missed past day', () => {
    const c = hits('h1', [ago(1), ago(3), ago(4)])
    expect(streak(habit(), c, D).current).toBe(1)
  })

  it('remembers the best streak even after it is broken', () => {
    const c = hits('h1', [ago(10), ago(9), ago(8), ago(7), ago(6), ago(1)])
    const s = streak(habit(), c, D)
    expect(s.best).toBe(5)
    expect(s.current).toBe(1)
  })

  it('counts a weekly habit in weeks, not days', () => {
    const h = habit({ cadence: { type: 'weekly', perWeek: 2 } })
    const s = streak(h, hits('h1', [D, ago(1)]), D)
    expect(s.unit).toBe('week')
    expect(s.current).toBeGreaterThanOrEqual(1)
  })

  it('ignores days the habit was not scheduled for', () => {
    const target = dow(D)
    const h = habit({ cadence: { type: 'days', days: [target] } })
    const weeks = [D, ago(7), ago(14)]
    expect(streak(h, hits('h1', weeks), D).current).toBe(3)
  })
})

describe('consistency', () => {
  it('only counts days the habit was actually due', () => {
    const target = dow(D)
    const h = habit({ cadence: { type: 'days', days: [target] } })
    const c = consistency(h, hits('h1', [D, ago(7)]), 14, D)
    expect(c.due).toBe(2)
    expect(c.hit).toBe(2)
    expect(c.rate).toBe(1)
  })

  it('never counts days before the habit existed', () => {
    const h = habit({ createdAt: ago(2) })
    expect(consistency(h, {}, 30, D).due).toBe(3)
  })
})

describe('dayScore', () => {
  it('weights every due habit equally and reports partials', () => {
    const a = habit({ id: 'h1' })
    const b = habit({ id: 'h2', target: { type: 'count', goal: 10, unit: 'x' } })
    const c = { ...hits('h1', [D]), ...hits('h2', [D], 5) }
    const s = dayScore([a, b], c, D)
    expect(s.due).toBe(2)
    expect(s.done).toBe(1)
    expect(s.partial).toBe(1)
    expect(s.ratio).toBeCloseTo(0.75)
  })

  it('is zero, not NaN, when nothing is due', () => {
    expect(dayScore([], {}, D)).toEqual({ ratio: 0, done: 0, due: 0, partial: 0 })
  })
})

describe('workProgress', () => {
  it('derives from tasks when tasks exist', () => {
    const w = work({ kind: 'project', tasks: [{ title: 'a', done: true }, { title: 'b', done: false }] })
    expect(workProgress(w)).toBe(50)
  })

  it('falls back to the manual dial when there are no tasks', () => {
    expect(workProgress(work({ manual: 30 }))).toBe(30)
  })

  it('is 100 once completed, whatever the tasks say', () => {
    expect(workProgress(work({ doneAt: `${D}T10:00`, manual: 10 }))).toBe(100)
  })
})

describe('workStatus', () => {
  it('is open when there is no deadline to be late for', () => {
    expect(workStatus(work({ deadline: null })).id).toBe('open')
  })

  it('is overdue past the deadline', () => {
    expect(workStatus(work({ deadline: `${ago(1)}T09:00` })).id).toBe('overdue')
  })

  it('is urgent inside 24 hours', () => {
    const soon = new Date(Date.now() + 3 * 3600_000)
    const pad = (n) => String(n).padStart(2, '0')
    const stamp = `${soon.getFullYear()}-${pad(soon.getMonth() + 1)}-${pad(soon.getDate())}T${pad(soon.getHours())}:${pad(soon.getMinutes())}`
    expect(workStatus(work({ deadline: stamp })).id).toBe('urgent')
  })

  it('is at risk when progress trails the clock', () => {
    const w = work({ startedAt: ago(10), createdAt: ago(10), deadline: `${ahead(10)}T18:00`, manual: 5 })
    expect(workStatus(w).id).toBe('atRisk')
  })

  it('is on track when progress keeps up', () => {
    const w = work({ startedAt: ago(10), createdAt: ago(10), deadline: `${ahead(10)}T18:00`, manual: 60 })
    expect(workStatus(w).id).toBe('onTrack')
  })

  it('is done once completed, even when overdue', () => {
    expect(workStatus(work({ deadline: `${ago(5)}T09:00`, doneAt: `${ago(4)}T09:00` })).id).toBe('done')
  })
})

describe('pace', () => {
  it('reports the gap against an even burn', () => {
    const w = work({ startedAt: ago(10), createdAt: ago(10), deadline: `${ahead(10)}T18:00`, manual: 20 })
    const p = pace(w, D)
    expect(p.expected).toBe(50)
    expect(p.delta).toBe(-30)
  })

  it('is null without both a start and a deadline', () => {
    expect(pace(work({ deadline: null }), D)).toBeNull()
  })
})

describe('sortByUrgency', () => {
  it('puts overdue first and undated last', () => {
    const items = [
      work({ id: 'none', deadline: null }),
      work({ id: 'late', deadline: `${ago(2)}T09:00` }),
      work({ id: 'later', deadline: `${ahead(20)}T09:00` }),
    ]
    expect(sortByUrgency(items).map((w) => w.id)).toEqual(['late', 'later', 'none'])
  })
})

describe('dueByDay', () => {
  it('buckets items and open subtasks onto their day', () => {
    const w = work({
      kind: 'project',
      deadline: `${ahead(1)}T18:00`,
      tasks: [{ title: 'sub', done: false, due: ahead(2) }],
    })
    const days = [D, ahead(1), ahead(2)]
    const out = dueByDay([w], days)
    expect(out[0].items).toHaveLength(0)
    expect(out[1].items).toHaveLength(1)
    expect(out[2].items).toHaveLength(1)
  })

  it('ignores finished work', () => {
    const w = work({ deadline: `${ahead(1)}T18:00`, doneAt: `${D}T10:00` })
    expect(dueByDay([w], [ahead(1)])[0].items).toHaveLength(0)
  })
})

describe('goalProgress', () => {
  it('is empty — not zero-with-confidence — when nothing is linked', () => {
    const g = goal()
    const p = goalProgress(g, state({ habits: [], work: [], checkins: {} }))
    expect(p.empty).toBe(true)
    expect(p.percent).toBe(0)
  })

  it('averages habit consistency and work completion', () => {
    const h = habit({ createdAt: ago(29) })
    const g = goal({ habitIds: ['h1'] })
    const w = work({ goalId: 'g1', manual: 50 })
    const s = state({ habits: [h], checkins: hits('h1', Array.from({ length: 30 }, (_, i) => ago(i))), work: [w], goals: [g] })
    const p = goalProgress(g, s)
    expect(p.parts).toHaveLength(2)
    expect(p.percent).toBe(75)
  })
})

describe('moodCorrelation', () => {
  it('refuses to report a correlation from too few pairs', () => {
    const r = moodCorrelation([habit()], hits('h1', [D]), { [D]: { mood: 5 } }, 30, D)
    expect(r.r).toBeNull()
    expect(r.need).toBe(8)
  })

  it('reports a positive correlation when the data really is aligned', () => {
    const h = habit({ createdAt: ago(20) })
    const days = Array.from({ length: 20 }, (_, i) => ago(i))
    const checkins = { h1: {} }
    const moods = {}
    days.forEach((d, i) => {
      const good = i % 2 === 0
      if (good) checkins.h1[d] = { value: 1, at: `${d}T09:00` }
      moods[d] = { mood: good ? 5 : 1 }
    })
    const r = moodCorrelation([h], checkins, moods, 20, D)
    expect(r.n).toBeGreaterThanOrEqual(8)
    expect(r.r).toBeGreaterThan(0.9)
  })
})

describe('lifetime + milestones', () => {
  it('earns nothing on an empty app', () => {
    const medals = earnedMilestones(lifetime(state(), D))
    expect(medals.every((m) => !m.earned)).toBe(true)
  })

  it('earns the first check-in and a perfect day from one real check-in', () => {
    const s = state({ habits: [habit()], checkins: hits('h1', [D]) })
    const medals = earnedMilestones(lifetime(s, D))
    expect(medals.find((m) => m.id === 'first').earned).toBe(true)
    expect(medals.find((m) => m.id === 'perfect').earned).toBe(true)
    expect(medals.find((m) => m.id === 'hundred').earned).toBe(false)
  })
})

describe('nextUp', () => {
  it('puts pressured work above habits', () => {
    const s = state({
      habits: [habit()],
      checkins: {},
      work: [work({ id: 'late', deadline: `${ago(1)}T09:00` })],
    })
    const q = nextUp(s, D)
    expect(q[0].type).toBe('work')
    expect(q.some((x) => x.type === 'habit')).toBe(true)
  })

  it('never lists a habit that is already done', () => {
    const s = state({ habits: [habit()], checkins: hits('h1', [D]) })
    expect(nextUp(s, D).some((x) => x.type === 'habit')).toBe(false)
  })

  it('leaves calm work out of the queue entirely', () => {
    const s = state({ work: [work({ deadline: null })] })
    expect(nextUp(s, D)).toHaveLength(0)
  })
})
