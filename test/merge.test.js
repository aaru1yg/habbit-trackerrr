import { describe, it, expect } from 'vitest'
import { mergeById, mergeMap, mergeDocs, summarise, hasData } from '../src/lib/cloud/merge.js'
import { friendlyError } from '../src/lib/cloud/errors.js'

const T0 = '2026-01-01T00:00:00.000Z'
const T1 = '2026-02-01T00:00:00.000Z'

describe('mergeById', () => {
  it('unions rows that exist on only one side', () => {
    const out = mergeById([{ id: 'a', order: 0 }], [{ id: 'b', order: 1 }])
    expect(out.map((r) => r.id)).toEqual(['a', 'b'])
  })

  it('keeps the newer record when both sides have the same id', () => {
    const out = mergeById(
      [{ id: 'a', name: 'local', updatedAt: T1 }],
      [{ id: 'a', name: 'cloud', updatedAt: T0 }]
    )
    expect(out[0].name).toBe('local')
  })

  it('prefers cloud on an exact tie (shared truth wins)', () => {
    const out = mergeById(
      [{ id: 'a', name: 'local', updatedAt: T0 }],
      [{ id: 'a', name: 'cloud', updatedAt: T0 }]
    )
    expect(out[0].name).toBe('cloud')
  })

  it('honours a newer tombstone instead of resurrecting the row', () => {
    const out = mergeById(
      [{ id: 'a', name: 'stale', updatedAt: T0 }],
      [{ id: 'a', deletedAt: T1 }]
    )
    expect(out).toHaveLength(0)
  })

  it('does not let a stale delete remove a newer edit', () => {
    const out = mergeById(
      [{ id: 'a', name: 'edited', updatedAt: T1 }],
      [{ id: 'a', deletedAt: T0 }]
    )
    expect(out).toHaveLength(1)
    expect(out[0].name).toBe('edited')
  })
})

describe('mergeMap', () => {
  it('unions check-ins across devices without losing either', () => {
    const out = mergeMap(
      { h1: { '2026-01-01': { done: true } } },
      { h1: { '2026-01-02': { done: true } } }
    )
    expect(Object.keys(out.h1).sort()).toEqual(['2026-01-01', '2026-01-02'])
  })

  it('keeps unrelated habits from both sides', () => {
    const out = mergeMap({ a: { d: { done: true } } }, { b: { d: { done: true } } })
    expect(Object.keys(out).sort()).toEqual(['a', 'b'])
  })
})

describe('mergeDocs', () => {
  it('merges every owned collection', () => {
    const local = { version: 4, habits: [{ id: 'h1', order: 0 }], projects: [], assignments: [], routines: [], checkins: {}, moods: {}, profile: {} }
    const cloud = { version: 4, habits: [{ id: 'h2', order: 1 }], projects: [{ id: 'p1' }], assignments: [], routines: [], checkins: {}, moods: {}, profile: {} }
    const out = mergeDocs(local, cloud)
    expect(out.habits.map((h) => h.id)).toEqual(['h1', 'h2'])
    expect(out.projects.map((p) => p.id)).toEqual(['p1'])
  })

  it('merges goals by id without losing either device and respects newer edits', () => {
    const local = { goals: [{ id: 'local', title: 'Local' }, { id: 'shared', title: 'Newer', updatedAt: T1 }] }
    const cloud = { goals: [{ id: 'cloud', title: 'Cloud' }, { id: 'shared', title: 'Older', updatedAt: T0 }] }
    const merged = mergeDocs(local, cloud)
    expect(merged.goals.map((g) => g.id).sort()).toEqual(['cloud', 'local', 'shared'])
    expect(merged.goals.find((g) => g.id === 'shared').title).toBe('Newer')
    expect(mergeDocs(merged, cloud).goals).toEqual(merged.goals)
  })

  it('returns the other side when one is missing', () => {
    const doc = { habits: [{ id: 'x' }] }
    expect(mergeDocs(doc, null)).toBe(doc)
    expect(mergeDocs(null, doc)).toBe(doc)
  })

  it('is idempotent — merging twice changes nothing', () => {
    const local = { habits: [{ id: 'h1', updatedAt: T1 }], checkins: {}, moods: {} }
    const cloud = { habits: [{ id: 'h1', updatedAt: T0 }], checkins: {}, moods: {} }
    const once = mergeDocs(local, cloud)
    const twice = mergeDocs(once, cloud)
    expect(twice.habits).toEqual(once.habits)
  })
})

describe('summarise / hasData', () => {
  it('counts only live rows, ignoring tombstones', () => {
    const s = summarise({ habits: [{ id: 'a' }, { id: 'b', deletedAt: T1 }], checkins: { a: { d1: {}, d2: {} } } })
    expect(s.habits).toBe(1)
    expect(s.checkins).toBe(2)
  })

  it('a goal-only document is real migration data, not an empty account', () => {
    const doc = { goals: [{ id: 'g', title: 'Keep this' }] }
    expect(summarise(doc).goals).toBe(1)
    expect(hasData(doc)).toBe(true)
    expect(hasData({ goals: [{ id: 'g', deletedAt: T1 }] })).toBe(false)
  })

  it('reports an empty document as having no data', () => {
    expect(hasData({ habits: [], projects: [], checkins: {}, moods: {} })).toBe(false)
    expect(hasData({ habits: [{ id: 'a' }] })).toBe(true)
  })
})

describe('friendlyError', () => {
  it('never leaks raw technical strings', () => {
    const raw = 'AuthApiError: Invalid login credentials'
    expect(friendlyError(raw)).toBe('That email and password don’t match. Check them and try again.')
  })

  it('maps the states the product promises to handle', () => {
    expect(friendlyError('Email not confirmed')).toMatch(/confirm your email/i)
    expect(friendlyError('User already registered')).toMatch(/already exists/i)
    expect(friendlyError('Password should be at least 6 characters')).toMatch(/longer password/i)
    expect(friendlyError('Token has expired')).toMatch(/expired/i)
    expect(friendlyError('Failed to fetch')).toMatch(/can’t reach the server/i)
  })

  it('falls back to a safe generic message for unknown errors', () => {
    expect(friendlyError(new Error('kaboom 0x9f'))).toBe('Something went wrong. Please try again.')
  })
})
