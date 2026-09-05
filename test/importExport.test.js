/* ============================================================
   IMPORT / EXPORT — defensive normalisation.
   Regression cover for cross-links: a payload with projects that
   link habits, assignments that belong to projects, and routines
   that stack habits must survive a round trip without crashing
   and without keeping dangling references.
   ============================================================ */
import { describe, it, expect } from 'vitest'
import { normalizeImport, exportPayload } from '../src/lib/importExport.js'

const habit = (id, name, over = {}) => ({
  id, name, category: 'health', schedule: { type: 'daily' }, reminder: null, notes: '',
  createdAt: '2026-08-01', archived: false, order: 0, ...over,
})

const payload = () => ({
  app: 'aaru-habits',
  version: 4,
  data: {
    profile: { name: 'Aaru', onboarded: true, theme: 'verdant', workReminders: false, workReminderHours: 48 },
    habits: [habit('h1', 'Run'), habit('h2', 'Read')],
    checkins: { h1: { '2026-09-01': { done: true } }, ghost: { '2026-09-01': { done: true } } },
    routines: [{ id: 'r1', name: 'Morning reset', kind: 'morning', habitIds: ['h1', 'ghost'], active: true }],
    projects: [{
      id: 'p1', name: 'Portfolio', startDate: '2026-08-10', deadline: '2026-09-20T18:00',
      linkedHabitIds: ['h2', 'ghost'], category: 'Design', priority: 'high',
      milestones: [{ id: 'm1', name: 'Build', tasks: [{ id: 't1', name: 'Repo', done: true }, { id: 't2', name: 'Deploy', done: false }] }],
      progressLog: [{ at: '2026-09-01T10:00', pct: 50 }],
      estimateMin: 600,
    }],
    assignments: [
      { id: 'a1', name: 'DS Lab', subject: 'Data Structures', deadline: '2026-09-10T23:59', progress: 40, projectId: 'p1', subtasks: [{ id: 's1', name: 'Brief', done: true }, { id: 's2', name: 'Tests', done: false }] },
      { id: 'a2', name: 'Orphan', deadline: '2026-09-11T23:59', progressMode: 'subtasks', projectId: 'nope', subtasks: [{ id: 's3', name: 'Draft', done: true }, { id: 's4', name: 'References', done: false }] },
    ],
    moods: { '2026-09-01': { score: 4, energy: 3, focus: 5, motivation: 2, note: 'Good day', wentWell: 'Shipped', difficult: 'Late start' }, '2026-09-02': { score: 99, energy: 0 } },
  },
})

describe('normalizeImport', () => {
  it('keeps real cross-links and drops dangling ones', () => {
    const out = normalizeImport(payload())

    expect(out.version).toBe(4)
    expect(out.habits.map((h) => h.id)).toEqual(['h1', 'h2'])

    // project → habit links: 'ghost' does not exist
    expect(out.projects[0].linkedHabitIds).toEqual(['h2'])
    // routine → habit stacking
    expect(out.routines[0].habitIds).toEqual(['h1'])
    // assignment → project
    expect(out.assignments[0].projectId).toBe('p1')
    expect(out.assignments[1].projectId).toBeNull()
    // check-ins for unknown habits are dropped, real ones kept
    expect(Object.keys(out.checkins)).toEqual(['h1'])
  })

  it('preserves task math inputs and mind dimensions', () => {
    const out = normalizeImport(payload())
    const tasks = out.projects[0].milestones[0].tasks
    expect(tasks.map((t) => t.done)).toEqual([true, false])
    expect(out.projects[0].milestones[0].tasks.length).toBe(2)

    // subtask-mode assignment derives its percent from real subtasks (1 of 2 = 50%)
    expect(out.assignments[1].progressMode).toBe('subtasks')
    expect(out.assignments[1].progress).toBe(50)

    const good = out.moods['2026-09-01']
    expect(good).toMatchObject({ score: 4, energy: 3, focus: 5, motivation: 2, note: 'Good day', wentWell: 'Shipped', difficult: 'Late start' })
    // out-of-range values are dropped rather than clamped into a lie
    expect(out.moods['2026-09-02']).toBeUndefined()

    expect(out.profile).toMatchObject({ theme: 'verdant', workReminders: false, workReminderHours: 48 })
  })

  it('round-trips an exported payload without losing anything', () => {
    const state = normalizeImport(payload())
    const exported = exportPayload(state)
    const again = normalizeImport(exported)

    expect(again.habits.length).toBe(state.habits.length)
    expect(again.projects[0].linkedHabitIds).toEqual(state.projects[0].linkedHabitIds)
    expect(again.assignments.map((a) => a.projectId)).toEqual(state.assignments.map((a) => a.projectId))
    expect(again.routines[0].habitIds).toEqual(state.routines[0].habitIds)
    expect(again.moods['2026-09-01']).toEqual(state.moods['2026-09-01'])
    expect(exported.counts.habits).toBe(2)
    expect(exported.counts.projects).toBe(1)
    expect(exported.counts.assignments).toBe(2)
  })

  it('rejects payloads with nothing recognisable in them', () => {
    expect(() => normalizeImport({ hello: 'world' })).toThrow(/No habits, projects, assignments, or moods/)
    expect(() => normalizeImport('nope')).toThrow(/not valid JSON data/)
    // an explicitly empty but well-formed backup is valid (post-reset export)
    const empty = normalizeImport({ habits: [], projects: [], assignments: [], moods: {} })
    expect(empty.habits).toEqual([])
  })
})
