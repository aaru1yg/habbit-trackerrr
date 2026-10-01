import { describe, it, expect } from 'vitest'
import { reducer } from '../src/core/store.jsx'
import { emptyState, normalize, migrate, importState, exportState, VERSION } from '../src/core/schema.js'
import { today } from '../src/core/date.js'

const run = (state, ...actions) => actions.reduce(reducer, state)
const D = today()

describe('reducer — habits', () => {
  it('adds a habit with today as its creation date', () => {
    const s = run(emptyState(), { type: 'habit/add', habit: { name: 'Read' } })
    expect(s.habits).toHaveLength(1)
    expect(s.habits[0].createdAt).toBe(D)
    expect(s.habits[0].name).toBe('Read')
  })

  it('deleting a habit removes its check-ins and unlinks it from goals', () => {
    let s = run(
      emptyState(),
      { type: 'habit/add', habit: { name: 'Read' } },
      { type: 'goal/add', goal: { title: 'Outcome' } },
    )
    const hid = s.habits[0].id
    const gid = s.goals[0].id
    s = run(s,
      { type: 'checkin/set', habitId: hid, day: D, value: 1 },
      { type: 'goal/link', id: gid, habitId: hid },
    )
    expect(s.checkins[hid]).toBeTruthy()
    expect(s.goals[0].habitIds).toContain(hid)

    s = reducer(s, { type: 'habit/remove', id: hid })
    expect(s.habits).toHaveLength(0)
    expect(s.checkins[hid]).toBeUndefined()
    expect(s.goals[0].habitIds).toHaveLength(0)
  })

  it('archiving toggles rather than destroys', () => {
    let s = run(emptyState(), { type: 'habit/add', habit: { name: 'Read' } })
    const id = s.habits[0].id
    s = reducer(s, { type: 'habit/archive', id })
    expect(s.habits[0].archivedAt).toBe(D)
    s = reducer(s, { type: 'habit/archive', id })
    expect(s.habits[0].archivedAt).toBeNull()
  })
})

describe('reducer — check-ins', () => {
  it('setting a value to zero deletes the entry instead of storing a zero', () => {
    let s = run(emptyState(), { type: 'habit/add', habit: { name: 'Read' } })
    const id = s.habits[0].id
    s = reducer(s, { type: 'checkin/set', habitId: id, day: D, value: 3 })
    expect(s.checkins[id][D].value).toBe(3)
    s = reducer(s, { type: 'checkin/set', habitId: id, day: D, value: 0 })
    expect(s.checkins[id]).toBeUndefined()
  })

  it('ignores check-ins for habits that do not exist', () => {
    const s = reducer(emptyState(), { type: 'checkin/set', habitId: 'ghost', day: D, value: 1 })
    expect(s.checkins).toEqual({})
  })
})

describe('reducer — work', () => {
  it('ticking the last task completes the project, unticking reopens it', () => {
    let s = run(emptyState(), { type: 'work/add', work: { kind: 'project', title: 'P' } })
    const id = s.work[0].id
    s = run(s, { type: 'task/add', workId: id, title: 'only task' })
    const tid = s.work[0].tasks[0].id

    s = reducer(s, { type: 'task/toggle', workId: id, taskId: tid })
    expect(s.work[0].doneAt).toBeTruthy()

    s = reducer(s, { type: 'task/toggle', workId: id, taskId: tid })
    expect(s.work[0].doneAt).toBeNull()
  })

  it('adding a task clears the manual dial so progress has one source', () => {
    let s = run(emptyState(), { type: 'work/add', work: { kind: 'project', title: 'P', manual: 70 } })
    const id = s.work[0].id
    s = reducer(s, { type: 'task/add', workId: id, title: 'a' })
    expect(s.work[0].manual).toBeNull()
  })

  it('completing a project marks every task done', () => {
    let s = run(emptyState(), { type: 'work/add', work: { kind: 'project', title: 'P' } })
    const id = s.work[0].id
    s = run(s, { type: 'task/add', workId: id, title: 'a' }, { type: 'task/add', workId: id, title: 'b' })
    s = reducer(s, { type: 'work/complete', id })
    expect(s.work[0].tasks.every((t) => t.done)).toBe(true)
  })

  it('a log entry with neither minutes nor percent is rejected', () => {
    let s = run(emptyState(), { type: 'work/add', work: { title: 'T' } })
    const id = s.work[0].id
    s = reducer(s, { type: 'work/log', id, percent: null, minutes: null })
    expect(s.work[0].log).toHaveLength(0)
  })

  it('deleting a goal unlinks its work rather than deleting it', () => {
    let s = run(
      emptyState(),
      { type: 'goal/add', goal: { title: 'G' } },
      { type: 'work/add', work: { title: 'W' } },
    )
    const gid = s.goals[0].id
    const wid = s.work[0].id
    s = reducer(s, { type: 'goal/link', id: gid, workId: wid })
    expect(s.work[0].goalId).toBe(gid)
    s = reducer(s, { type: 'goal/remove', id: gid })
    expect(s.work).toHaveLength(1)
    expect(s.work[0].goalId).toBeNull()
  })
})

describe('reducer — mood', () => {
  it('clearing every field removes the day entirely', () => {
    let s = reducer(emptyState(), { type: 'mood/set', day: D, mood: 4 })
    expect(s.moods[D].mood).toBe(4)
    s = reducer(s, { type: 'mood/set', day: D, mood: null })
    expect(s.moods[D]).toBeUndefined()
  })

  it('patches one field without wiping the others', () => {
    let s = reducer(emptyState(), { type: 'mood/set', day: D, mood: 4 })
    s = reducer(s, { type: 'mood/set', day: D, energy: 2 })
    expect(s.moods[D]).toMatchObject({ mood: 4, energy: 2 })
  })
})

describe('normalize', () => {
  it('survives garbage without throwing', () => {
    expect(normalize(null).habits).toEqual([])
    expect(normalize({ habits: 'nope', checkins: 5 }).habits).toEqual([])
  })

  it('drops check-ins belonging to habits that no longer exist', () => {
    const s = normalize({ habits: [], checkins: { ghost: { [D]: { value: 1 } } } })
    expect(s.checkins).toEqual({})
  })

  it('clamps values instead of trusting them', () => {
    const s = normalize({ habits: [{ id: 'h', name: 'x', target: { type: 'count', goal: 99999999 } }] })
    expect(s.habits[0].target.goal).toBeLessThanOrEqual(9999)
  })
})

describe('migration v4 → v5', () => {
  const v4 = {
    version: 4,
    profile: { name: 'Aaru', onboarded: true, theme: 'midnight' },
    habits: [{ id: 'h1', name: 'Read', category: 'learning', schedule: { type: 'daily' }, archived: false }],
    checkins: { h1: { '2025-01-01': { done: true }, '2025-01-02': { done: false } } },
    routines: [{ id: 'r1', name: 'Morning', habitIds: ['h1'] }],
    projects: [{
      id: 'p1', name: 'Thesis', deadline: '2025-06-01',
      milestones: [{ name: 'Ch1', tasks: [{ id: 't1', name: 'Draft', done: true }] }],
    }],
    assignments: [{ id: 'a1', name: 'Essay', deadline: '2025-03-01T18:00', percent: 40 }],
    goals: [{ id: 'g1', title: 'Finish', habitIds: ['h1'] }],
    moods: { '2025-01-01': { score: 4 } },
    signals: [{ kind: 'noise' }],
    focusLog: [{ at: 'whenever' }],
  }

  it('keeps everything that was real', () => {
    const s = migrate(v4)
    expect(s.version).toBe(VERSION)
    expect(s.profile.name).toBe('Aaru')
    expect(s.habits).toHaveLength(1)
    expect(s.habits[0].category).toBe('mind') // 'learning' maps to mind
    expect(s.goals[0].habitIds).toContain('h1')
    expect(s.moods['2025-01-01'].mood).toBe(4)
  })

  it('keeps only true check-ins', () => {
    const s = migrate(v4)
    expect(Object.keys(s.checkins.h1)).toEqual(['2025-01-01'])
  })

  it('collapses projects and assignments into one work list', () => {
    const s = migrate(v4)
    expect(s.work).toHaveLength(2)
    expect(s.work.find((w) => w.kind === 'project').title).toBe('Thesis')
    expect(s.work.find((w) => w.kind === 'task').title).toBe('Essay')
  })

  it('flattens milestones into the checklist without losing their name', () => {
    const s = migrate(v4)
    const project = s.work.find((w) => w.kind === 'project')
    expect(project.tasks).toHaveLength(1)
    expect(project.tasks[0].title).toBe('Ch1 · Draft')
    expect(project.tasks[0].done).toBe(true)
  })

  it('drops the scaffolding that nothing reads', () => {
    const s = migrate(v4)
    expect(s.routines).toBeUndefined()
    expect(s.signals).toBeUndefined()
    expect(s.focusLog).toBeUndefined()
  })
})

describe('export / import', () => {
  it('round-trips', () => {
    let s = run(
      emptyState(),
      { type: 'habit/add', habit: { name: 'Read' } },
      { type: 'work/add', work: { title: 'Ship' } },
    )
    const restored = importState(exportState(s))
    expect(restored.habits[0].name).toBe('Read')
    expect(restored.work[0].title).toBe('Ship')
  })

  it('rejects junk with a message a human can act on', () => {
    expect(() => importState('not json')).toThrow(/valid JSON/)
    expect(() => importState('{}')).toThrow(/empty/)
  })

  it('imports a v4 backup by migrating it', () => {
    const restored = importState(JSON.stringify({ version: 4, habits: [{ id: 'h', name: 'Old' }] }))
    expect(restored.version).toBe(VERSION)
    expect(restored.habits[0].name).toBe('Old')
  })
})
