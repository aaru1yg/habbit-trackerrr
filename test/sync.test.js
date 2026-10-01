/* ============================================================
   SYNC — merge rules and the compare-and-swap engine.

   These are the paths where a bug costs somebody their data
   rather than their patience, so they are tested on behaviour
   ("the deleted habit stays deleted") rather than on shape.
   ============================================================ */
import { describe, it, expect, beforeEach } from 'vitest'
import { emptyState, normalize, pruneTombstones, TOMBSTONE_TTL_DAYS } from '../src/core/schema.js'
import { reducer } from '../src/core/store.jsx'
import {
  mergeDocs, mergeDayMap, mergeTombstones, summarise, hasData, docKey, comparableDoc,
} from '../src/cloud/merge.js'
import { pull, push, clearCloud } from '../src/cloud/syncEngine.js'
import { __setSupabaseForTests } from '../src/cloud/client.js'
import { friendlyError } from '../src/cloud/errors.js'
import { habit, goal, work, state as mkState, D } from './fixtures.js'

/* Relative to now, because tombstones are pruned after TOMBSTONE_TTL_DAYS and
   fixed dates would silently age out of the window and stop being tested. */
const iso = (daysAgo) => new Date(Date.now() - daysAgo * 86400000).toISOString()
const EARLY = iso(30)
const LATE = iso(1)

/* ============================================================
   Merge rules
   ============================================================ */

describe('merge — collections', () => {
  it('keeps records that exist on only one side', () => {
    const local = mkState({ habits: [habit({ id: 'a', name: 'Local only' })] })
    const cloud = mkState({ habits: [habit({ id: 'b', name: 'Cloud only' })] })
    const out = mergeDocs(local, cloud)
    expect(out.habits.map((h) => h.name).sort()).toEqual(['Cloud only', 'Local only'])
  })

  it('resolves the same record by which copy was edited last', () => {
    const local = mkState({ habits: [habit({ id: 'a', name: 'Newer name', updatedAt: LATE })] })
    const cloud = mkState({ habits: [habit({ id: 'a', name: 'Older name', updatedAt: EARLY })] })
    expect(mergeDocs(local, cloud).habits[0].name).toBe('Newer name')
    // ...and symmetrically, with the sides swapped.
    expect(mergeDocs(cloud, local).habits[0].name).toBe('Newer name')
  })

  it('gives ties to the cloud, so every device lands on the same answer', () => {
    const local = mkState({ habits: [habit({ id: 'a', name: 'Local', updatedAt: LATE })] })
    const cloud = mkState({ habits: [habit({ id: 'a', name: 'Cloud', updatedAt: LATE })] })
    // The cloud is the shared truth: when neither edit is newer, it wins, so
    // two devices resolving the same tie against it agree with each other.
    expect(mergeDocs(local, cloud).habits[0].name).toBe('Cloud')
    const other = mkState({ habits: [habit({ id: 'a', name: 'Other device', updatedAt: LATE })] })
    expect(mergeDocs(other, cloud).habits[0].name).toBe('Cloud')
  })

  it('is deterministic: merging twice changes nothing further', () => {
    const local = mkState({ habits: [habit({ id: 'a', name: 'One', updatedAt: LATE })] })
    const cloud = mkState({ habits: [habit({ id: 'b', name: 'Two', updatedAt: EARLY })] })
    const once = mergeDocs(local, cloud)
    expect(docKey(mergeDocs(once, cloud))).toBe(docKey(once))
  })

  it('renumbers order so the merged list has no duplicate positions', () => {
    const local = mkState({ habits: [habit({ id: 'a', order: 0 }), habit({ id: 'b', order: 1 })] })
    const cloud = mkState({ habits: [habit({ id: 'c', order: 0 }), habit({ id: 'd', order: 1 })] })
    const orders = mergeDocs(local, cloud).habits.map((h) => h.order)
    expect(orders).toEqual([0, 1, 2, 3])
  })
})

describe('merge — tombstones', () => {
  it('does not resurrect a record the other device deleted', () => {
    const deletedAt = LATE
    const local = mkState({ habits: [], deleted: { a: deletedAt } })
    const cloud = mkState({ habits: [habit({ id: 'a', updatedAt: EARLY })] })
    expect(mergeDocs(local, cloud).habits).toHaveLength(0)
    expect(mergeDocs(cloud, local).habits).toHaveLength(0)
  })

  it('keeps an edit made after the deletion — the later action wins', () => {
    const local = mkState({ habits: [], deleted: { a: EARLY } })
    const cloud = mkState({ habits: [habit({ id: 'a', name: 'Revived', updatedAt: LATE })] })
    expect(mergeDocs(local, cloud).habits.map((h) => h.name)).toEqual(['Revived'])
  })

  it('propagates the tombstone itself, so a third device also honours it', () => {
    const local = mkState({ deleted: { a: LATE } })
    const cloud = mkState({ deleted: { b: EARLY } })
    const out = mergeDocs(local, cloud)
    expect(Object.keys(out.deleted).sort()).toEqual(['a', 'b'])
  })

  it('keeps the later of two deletions of the same id', () => {
    expect(mergeTombstones({ a: EARLY }, { a: LATE }).a).toBe(LATE)
    expect(mergeTombstones({ a: LATE }, { a: EARLY }).a).toBe(LATE)
  })

  it('takes a deleted habit\'s check-ins with it', () => {
    const local = mkState({ habits: [], deleted: { a: LATE } })
    const cloud = mkState({
      habits: [habit({ id: 'a', updatedAt: EARLY })],
      checkins: { a: { [D]: { value: 1, at: `${D}T09:00` } } },
    })
    expect(mergeDocs(local, cloud).checkins).toEqual({})
  })

  it('prunes tombstones past their useful life but keeps recent ones', () => {
    const now = Date.parse('2026-06-01T00:00:00.000Z')
    const recent = new Date(now - 10 * 86400000).toISOString()
    const ancient = new Date(now - (TOMBSTONE_TTL_DAYS + 5) * 86400000).toISOString()
    const out = pruneTombstones({ keep: recent, drop: ancient }, now)
    expect(Object.keys(out)).toEqual(['keep'])
  })
})

describe('merge — date-keyed history', () => {
  it('unions check-ins recorded on different days by different devices', () => {
    const local = mkState({
      habits: [habit({ id: 'a' })],
      checkins: { a: { '2026-05-01': { value: 1, at: '2026-05-01T09:00' } } },
    })
    const cloud = mkState({
      habits: [habit({ id: 'a' })],
      checkins: { a: { '2026-05-02': { value: 1, at: '2026-05-02T09:00' } } },
    })
    expect(Object.keys(mergeDocs(local, cloud).checkins.a).sort())
      .toEqual(['2026-05-01', '2026-05-02'])
  })

  it('takes the later edit when both devices logged the same day', () => {
    const a = { [D]: { value: 3, at: `${D}T09:00`, updatedAt: LATE } }
    const b = { [D]: { value: 9, at: `${D}T09:00`, updatedAt: EARLY } }
    expect(mergeDayMap(a, b)[D].value).toBe(3)
    expect(mergeDayMap(b, a)[D].value).toBe(3)
  })

  it('merges mood entries the same way', () => {
    const local = mkState({ moods: { '2026-05-01': { mood: 4, energy: 3, note: '' } } })
    const cloud = mkState({ moods: { '2026-05-02': { mood: 2, energy: 2, note: '' } } })
    expect(Object.keys(mergeDocs(local, cloud).moods).sort()).toEqual(['2026-05-01', '2026-05-02'])
  })
})

describe('merge — settings and links', () => {
  it('takes settings wholesale from the more recently edited profile', () => {
    const local = mkState({ profile: { ...emptyState().profile, theme: 'dark', updatedAt: LATE } })
    const cloud = mkState({ profile: { ...emptyState().profile, theme: 'light', updatedAt: EARLY } })
    expect(mergeDocs(local, cloud).profile.theme).toBe('dark')
    expect(mergeDocs(cloud, local).profile.theme).toBe('dark')
  })

  it('drops a goal link to a habit that lost the merge', () => {
    const local = mkState({
      habits: [], deleted: { h1: LATE },
      goals: [goal({ id: 'g1', habitIds: ['h1'] })],
    })
    const cloud = mkState({
      habits: [habit({ id: 'h1', updatedAt: EARLY })],
      goals: [goal({ id: 'g1', habitIds: ['h1'] })],
    })
    expect(mergeDocs(local, cloud).goals[0].habitIds).toEqual([])
  })

  it('clears a work item\'s goal link when that goal was deleted elsewhere', () => {
    const local = mkState({ goals: [], deleted: { g1: LATE }, work: [work({ id: 'w1', goalId: 'g1' })] })
    const cloud = mkState({ goals: [goal({ id: 'g1', updatedAt: EARLY })], work: [work({ id: 'w1', goalId: 'g1' })] })
    const out = mergeDocs(local, cloud)
    expect(out.goals).toHaveLength(0)
    expect(out.work[0].goalId).toBeNull()
    // The work item itself survives: deleting a goal never deletes work.
    expect(out.work).toHaveLength(1)
  })

  it('never invents or drops a whole side', () => {
    const local = mkState({ habits: [habit({ id: 'a' })], work: [work({ id: 'w' })] })
    expect(mergeDocs(local, null)).toBe(local)
    expect(mergeDocs(null, local)).toBe(local)
  })
})

describe('merge — document identity', () => {
  it('treats a document missing the newer keys as equal to a default one', () => {
    const modern = emptyState()
    const legacy = { version: 5, profile: {}, habits: [], checkins: {}, work: [], goals: [], moods: {} }
    expect(docKey(legacy)).toBe(docKey(modern))
  })

  it('ignores key order, because Postgres jsonb does not preserve it', () => {
    const a = { version: 5, habits: [], profile: {} }
    const b = { profile: {}, habits: [], version: 5 }
    expect(docKey(a)).toBe(docKey(b))
  })

  it('fills absent collections rather than reporting them as different', () => {
    expect(comparableDoc({}).habits).toEqual([])
    expect(comparableDoc({}).deleted).toEqual({})
  })
})

describe('merge — counting for the prompt', () => {
  it('counts what is actually there, with no estimates', () => {
    const s = mkState({
      habits: [habit({ id: 'a' }), habit({ id: 'b' })],
      work: [work({ id: 'w' })],
      goals: [goal({ id: 'g' })],
      checkins: { a: { '2026-05-01': { value: 1 }, '2026-05-02': { value: 1 } } },
      moods: { '2026-05-01': { mood: 3, energy: 3, note: '' } },
    })
    expect(summarise(s)).toEqual({ habits: 2, work: 1, goals: 1, checkins: 2, moods: 1 })
  })

  it('an untouched install holds nothing worth migrating', () => {
    expect(hasData(emptyState())).toBe(false)
    expect(hasData(mkState({ habits: [habit()] }))).toBe(true)
  })
})

/* ============================================================
   The store's half of the contract
   ============================================================ */

describe('store — what sync depends on', () => {
  const run = (state, ...actions) => actions.reduce(reducer, state)

  it('records a tombstone when a habit is deleted', () => {
    let s = run(emptyState(), { type: 'habit/add', habit: { name: 'Read' } })
    const id = s.habits[0].id
    s = run(s, { type: 'habit/remove', id })
    expect(s.habits).toHaveLength(0)
    expect(s.deleted[id]).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('records tombstones for work and goals too', () => {
    let s = run(emptyState(),
      { type: 'work/add', work: { title: 'Thing' } },
      { type: 'goal/add', goal: { title: 'Outcome' } })
    const wid = s.work[0].id
    const gid = s.goals[0].id
    s = run(s, { type: 'work/remove', id: wid }, { type: 'goal/remove', id: gid })
    expect(s.deleted[wid]).toBeTruthy()
    expect(s.deleted[gid]).toBeTruthy()
  })

  it('stamps updatedAt on edit, so the merge can tell copies apart', () => {
    let s = run(emptyState(), { type: 'habit/add', habit: { name: 'Read' } })
    const before = s.habits[0].updatedAt
    expect(before).toBeTruthy()
    s = run(s, { type: 'habit/update', id: s.habits[0].id, patch: { name: 'Read more' } })
    expect(Date.parse(s.habits[0].updatedAt)).toBeGreaterThanOrEqual(Date.parse(before))
  })

  it('stamps the profile, so settings merges have something to compare', () => {
    const s = run(emptyState(), { type: 'profile', patch: { theme: 'dark' } })
    expect(s.profile.updatedAt).toBeTruthy()
  })

  it('survives a round-trip through normalise with its sync fields intact', () => {
    let s = run(emptyState(), { type: 'habit/add', habit: { name: 'Read' } })
    const id = s.habits[0].id
    s = run(s, { type: 'checkin/set', habitId: id, day: D, value: 1 })
    s = run(s, { type: 'habit/add', habit: { name: 'Gone' } })
    s = run(s, { type: 'habit/remove', id: s.habits[1].id })
    const out = normalize(JSON.parse(JSON.stringify(s)))
    expect(out.habits[0].updatedAt).toBeTruthy()
    expect(out.checkins[id][D].updatedAt).toBeTruthy()
    expect(Object.keys(out.deleted)).toHaveLength(1)
  })
})

/* ============================================================
   Engine: compare-and-swap against a fake PostgREST
   ============================================================ */

/** Minimal stand-in for the one table the engine touches. */
function fakeDb() {
  const rows = new Map()
  const api = {
    calls: [],
    from() {
      let filters = {}
      let payload = null
      let op = null
      const builder = {
        select: () => builder,
        eq: (col, val) => { filters[col] = val; return builder },
        insert: (v) => { op = 'insert'; payload = v; return builder },
        update: (v) => { op = 'update'; payload = v; return builder },
        delete: () => { op = 'delete'; return builder },
        single: () => builder.run(true),
        maybeSingle: () => builder.run(false),
        then: (res, rej) => builder.run(false).then(res, rej),
        run: async (strict) => {
          api.calls.push({ op, filters, payload })
          if (op === 'insert') {
            if (rows.has(payload.user_id)) {
              return { data: null, error: { code: '23505', message: 'duplicate key value' } }
            }
            const row = { ...payload, updated_at: '2026-06-01T00:00:00.000Z' }
            rows.set(payload.user_id, row)
            return { data: { revision: row.revision, updated_at: row.updated_at }, error: null }
          }
          if (op === 'update') {
            const row = rows.get(filters.user_id)
            const stale = !row || (filters.revision !== undefined && row.revision !== filters.revision)
            if (stale) return strict ? { data: null, error: { code: 'PGRST116' } } : { data: null, error: null }
            Object.assign(row, payload, { updated_at: '2026-06-02T00:00:00.000Z' })
            return { data: { revision: row.revision, updated_at: row.updated_at }, error: null }
          }
          if (op === 'delete') { rows.delete(filters.user_id); return { data: null, error: null } }
          const row = rows.get(filters.user_id)
          if (!row) return { data: null, error: null }
          return { data: { doc: row.doc, revision: row.revision, updated_at: row.updated_at }, error: null }
        },
      }
      return builder
    },
  }
  api.rows = rows
  return api
}

describe('sync engine', () => {
  let db
  beforeEach(() => {
    db = fakeDb()
    __setSupabaseForTests(db)
  })

  it('reports an empty account as revision 0 rather than as an error', async () => {
    expect(await pull('u1')).toEqual({ doc: null, revision: 0, updatedAt: null })
  })

  it('inserts the first document and returns the server timestamp', async () => {
    const res = await push('u1', { version: 5 }, 0)
    expect(res.revision).toBe(1)
    expect(res.updatedAt).toBe('2026-06-01T00:00:00.000Z')
    expect((await pull('u1')).doc).toEqual({ version: 5 })
  })

  it('reports a conflict instead of overwriting when the row already exists', async () => {
    await push('u1', { a: 1 }, 0)
    expect(await push('u1', { b: 2 }, 0)).toEqual({ conflict: true })
    // The first write is still intact.
    expect((await pull('u1')).doc).toEqual({ a: 1 })
  })

  it('advances the revision on a write based on the current one', async () => {
    await push('u1', { n: 1 }, 0)
    const res = await push('u1', { n: 2 }, 1)
    expect(res.revision).toBe(2)
    expect((await pull('u1')).doc).toEqual({ n: 2 })
  })

  it('refuses a write based on a stale revision, leaving the row untouched', async () => {
    await push('u1', { n: 1 }, 0)
    await push('u1', { n: 2 }, 1)       // another device moved it to revision 2
    expect(await push('u1', { n: 99 }, 1)).toEqual({ conflict: true })
    expect((await pull('u1')).doc).toEqual({ n: 2 })
  })

  it('scopes every statement to one user id', async () => {
    await push('u1', { n: 1 }, 0)
    await pull('u1')
    expect(db.calls.every((c) => c.op === 'insert' || c.filters.user_id === 'u1')).toBe(true)
  })

  it('removes only the requested account\'s row', async () => {
    await push('u1', { n: 1 }, 0)
    await push('u2', { n: 2 }, 0)
    await clearCloud('u1')
    expect((await pull('u1')).doc).toBeNull()
    expect((await pull('u2')).doc).toEqual({ n: 2 })
  })

  it('refuses to pretend it can sync when the build has no config', async () => {
    __setSupabaseForTests(null)
    await expect(pull('u1')).rejects.toThrow(/not configured/i)
  })
})

describe('error messages', () => {
  it('turns backend strings into something a person can act on', () => {
    expect(friendlyError({ message: 'Invalid login credentials' })).toMatch(/don’t match/i)
    expect(friendlyError({ message: 'User already registered' })).toMatch(/already exists/i)
    expect(friendlyError({ message: 'Failed to fetch' })).toMatch(/connection/i)
  })

  it('never leaks a raw technical string', () => {
    const msg = friendlyError({ message: 'PGRST301 JWSError JWSInvalidSignature' })
    expect(msg).not.toMatch(/PGRST|JWS/)
    expect(msg).toBe('Something went wrong. Please try again.')
  })
})
