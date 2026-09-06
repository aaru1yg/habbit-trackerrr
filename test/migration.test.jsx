/* Migration prompt behavior — the "dialog reappears on every refresh" contract.
 *
 * Simulates the real lifecycle with a fake Supabase client: a signed-in
 * session restored on mount (exactly what happens on page refresh), app state
 * persisted in localStorage, and a cloud doc served by the fake server.
 * Unmount + mount again == F5.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import AuthProvider from '../src/lib/cloud/AuthProvider.jsx'
import SyncProvider, { useSync } from '../src/lib/cloud/SyncProvider.jsx'
import { StoreProvider, useStore, STORAGE_KEY } from '../src/store.jsx'
import MigrationDialog from '../src/components/auth/MigrationDialog.jsx'
import { readMigrationChoice, writeMigrationChoice, canonicalJson } from '../src/lib/cloud/migrationState.js'
import { normalizeImport } from '../src/lib/importExport.js'

/* ---------------- fake Supabase ---------------- */

const cloud = vi.hoisted(() => ({
  session: null,
  doc: null,
  revision: 3,
  updatedAt: '2026-09-01T00:00:00.000Z',
  pushes: [],
  emit: null,
}))

vi.mock('../src/lib/cloud/supabase.js', async () => {
  const maybeSingle = async () => ({
    data: cloud.doc
      ? { doc: cloud.doc, revision: cloud.revision, updated_at: cloud.updatedAt }
      : null,
    error: null,
  })
  return {
    cloudConfigured: true,
    redirectTo: () => 'http://localhost/',
    supabase: {
      auth: {
        getSession: async () => ({ data: { session: cloud.session } }),
        onAuthStateChange: (cb) => {
          cloud.emit = cb
          return { data: { subscription: { unsubscribe: () => {} } } }
        },
        signOut: async () => { cloud.session = null; cloud.emit?.('SIGNED_OUT', null) },
      },
      from: (table) => {
        if (table !== 'user_state') throw new Error('unexpected table ' + table)
        return {
          select: () => ({ eq: () => ({ maybeSingle }) }),
          upsert: (row) => ({
            select: () => ({
              single: async () => {
                cloud.revision += 1
                cloud.doc = row.doc
                cloud.updatedAt = new Date().toISOString()
                cloud.pushes.push(row.doc)
                return { data: { revision: cloud.revision, updated_at: cloud.updatedAt }, error: null }
              },
            }),
          }),
        }
      },
    },
  }
})

/* ---------------- harness ---------------- */

const USER_A = { id: 'user-a', email: 'aaru@example.com' }
const USER_B = { id: 'user-b', email: 'b@example.com' }
const MIGRATION_KEY = 'aaru.habits.migration.v1'

function Probe() {
  const sync = useSync()
  const { state } = useStore()
  window.__probe = { sync, state }
  return null
}

const mount = () =>
  render(
    <AuthProvider>
      <StoreProvider>
        <SyncProvider>
          <Probe />
          <MigrationDialog />
        </SyncProvider>
      </StoreProvider>
    </AuthProvider>,
  )

const habit = (id, name) => ({ id, name, createdAt: '2026-08-01T00:00:00.000Z' })
const doc = (habits) => ({
  version: 4,
  profile: {
    name: 'Aaru', onboarded: true, theme: 'midnight', lastBackupExport: null,
    lastBackupReminder: null, reminderNoteSeen: false, workReminders: true, workReminderHours: 24,
  },
  habits,
  checkins: {},
  routines: [],
  projects: [],
  assignments: [],
  moods: {},
})
const seedLocal = (d) => localStorage.setItem(STORAGE_KEY, JSON.stringify(d))
/** A cloud doc as the app would really have pushed it: fully normalised. */
const cloudDoc = (habits) => normalizeImport(doc(habits))
const seedChoice = (userId, choice) =>
  localStorage.setItem(MIGRATION_KEY, JSON.stringify({ [userId]: choice }))

const dialog = () => screen.queryByText('Existing data found')
const dialogGone = () => expect(dialog()).toBeNull()
const synced = () => waitFor(() => expect(window.__probe.sync.status).toBe('synced'))
const settleDebounce = () => new Promise((r) => setTimeout(r, 1500))

beforeEach(() => {
  localStorage.clear()
  cloud.session = null
  cloud.doc = null
  cloud.revision = 3
  cloud.updatedAt = '2026-09-01T00:00:00.000Z'
  cloud.pushes = []
  cloud.emit = null
  window.__probe = null
})

afterEach(() => { window.__probe = null })

/* ---------------- the bug report, as a contract ---------------- */

describe('migration prompt (refresh / re-login stability)', () => {
  it('merges goal-only devices without overwriting the cloud as if it were empty', async () => {
    cloud.session = { user: USER_A }
    seedLocal(normalizeImport({ ...doc([]), goals: [{ id: 'local-goal', title: 'Local goal' }] }))
    cloud.doc = normalizeImport({ ...doc([]), goals: [{ id: 'cloud-goal', title: 'Cloud goal' }] })
    let u = mount()
    await screen.findByText('Existing data found')
    expect(screen.getAllByText('goals').length).toBe(2)
    fireEvent.click(screen.getByRole('button', { name: 'Merge both' }))
    await waitFor(dialogGone)
    await synced()
    expect(cloud.pushes.at(-1).goals.map((g) => g.id).sort()).toEqual(['cloud-goal', 'local-goal'])
    u.unmount()
    u = mount()
    await synced()
    dialogGone()
    expect(window.__probe.state.goals).toHaveLength(2)
    u.unmount()
  })

  it('prompts exactly once for a genuine first link, then never again across 10 refreshes', async () => {
    cloud.session = { user: USER_A }
    seedLocal(doc([habit('h-local', 'Morning run')]))
    cloud.doc = doc([habit('h-cloud', 'Read pages')])

    let u = mount()
    expect(await screen.findByText('Existing data found')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Merge both' }))
    await waitFor(dialogGone)
    await synced()
    // merged doc pushed: both sides' habits present
    const pushed = cloud.pushes.at(-1)
    const pushedIds = pushed.habits.map((h) => h.id).sort()
    expect(pushedIds).toEqual(['h-cloud', 'h-local'])
    // decision remembered
    expect(readMigrationChoice('user-a')).toBe('merge')
    u.unmount()

    for (let i = 0; i < 10; i++) {
      u = mount()
      await synced()
      dialogGone() // must NOT reappear on any refresh
      u.unmount()
    }
    // converged documents are not re-pushed
    await settleDebounce()
    expect(cloud.pushes.length).toBe(1)
  })

  it('does not reappear after sign-out and sign-in as the same user', async () => {
    cloud.session = { user: USER_A }
    seedLocal(doc([habit('h-local', 'Morning run')]))
    cloud.doc = cloudDoc([habit('h-cloud', 'Read pages')])

    const u = mount()
    await screen.findByText('Existing data found')
    fireEvent.click(screen.getByRole('button', { name: /keep my local data/i }))
    await waitFor(dialogGone)
    await synced()
    expect(readMigrationChoice('user-a')).toBe('local')

    cloud.emit('SIGNED_OUT', null)
    await waitFor(() => expect(window.__probe.sync.status).toBe('local'))
    cloud.session = { user: USER_A }
    cloud.emit('SIGNED_IN', cloud.session)

    await synced()
    dialogGone()
    u.unmount()
  })

  it('fresh device adopting the cloud never prompts on later refreshes (identical docs are reconciled)', async () => {
    cloud.session = { user: USER_A }
    cloud.doc = cloudDoc([habit('h1', 'Meditate')])

    let u = mount()
    await synced()
    dialogGone()
    expect(window.__probe.state.habits.some((h) => h.id === 'h1')).toBe(true)
    u.unmount()

    for (let i = 0; i < 3; i++) {
      u = mount()
      await synced()
      dialogGone()
      u.unmount()
    }
    await settleDebounce()
    expect(cloud.pushes.length).toBe(0) // nothing was ever written
  })

  it('honours a remembered merge choice silently when docs genuinely diverge', async () => {
    cloud.session = { user: USER_A }
    seedLocal(doc([habit('h-local', 'Local only')]))
    cloud.doc = doc([habit('h-cloud', 'Cloud only')])
    seedChoice('user-a', 'merge')

    const u = mount()
    await synced()
    dialogGone()
    // diverged: the merged result must be pushed and adopted
    const pushed = cloud.pushes.at(-1)
    expect(pushed.habits.map((h) => h.id).sort()).toEqual(['h-cloud', 'h-local'])
    expect(window.__probe.state.habits.some((h) => h.id === 'h-cloud')).toBe(true)
    u.unmount()
  })

  it("honours a remembered 'use cloud data' choice silently", async () => {
    cloud.session = { user: USER_A }
    seedLocal(doc([habit('h-local', 'Local only')]))
    cloud.doc = doc([habit('h-cloud', 'Cloud only')])
    seedChoice('user-a', 'cloud')

    const u = mount()
    await synced()
    dialogGone()
    expect(cloud.pushes.length).toBe(0) // cloud already holds the truth
    expect(window.__probe.state.habits.some((h) => h.id === 'h-local')).toBe(false)
    expect(window.__probe.state.habits.some((h) => h.id === 'h-cloud')).toBe(true)
    u.unmount()
  })

  it("honours a remembered 'keep local data' choice silently", async () => {
    cloud.session = { user: USER_A }
    const localDoc = doc([habit('h-local', 'Local only')])
    seedLocal(localDoc)
    cloud.doc = doc([habit('h-cloud', 'Cloud only')])
    seedChoice('user-a', 'local')

    const u = mount()
    await synced()
    dialogGone()
    const pushed = cloud.pushes.at(-1)
    expect(pushed.habits.map((h) => h.id)).toEqual(['h-local'])
    expect(window.__probe.state.habits.some((h) => h.id === 'h-cloud')).toBe(false)
    u.unmount()
  })

  it('cancel does not record a choice, so a genuine decision can still be made later', async () => {
    cloud.session = { user: USER_A }
    seedLocal(doc([habit('h-local', 'Local only')]))
    cloud.doc = doc([habit('h-cloud', 'Cloud only')])

    let u = mount()
    expect(await screen.findByText('Existing data found')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    await waitFor(dialogGone)
    expect(window.__probe.sync.error).toMatch(/sync paused/i)
    expect(readMigrationChoice('user-a')).toBeNull()
    u.unmount()

    u = mount() // still unresolved — asking again is legitimate
    expect(await screen.findByText('Existing data found')).toBeTruthy()
    u.unmount()
  })

  it('user B is independently scoped: A’s remembered choice never applies to B', async () => {
    cloud.session = { user: USER_B }
    seedLocal(doc([habit('h-local', 'A was here')]))
    cloud.doc = doc([habit('h-cloud', 'B cloud data')])
    seedChoice('user-a', 'merge') // A resolved on this shared device

    const u = mount()
    // B faces a genuine first-link decision — the prompt is correct here
    expect(await screen.findByText('Existing data found')).toBeTruthy()
    expect(readMigrationChoice('user-b')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /use cloud data/i }))
    await waitFor(dialogGone)
    await synced()
    // B adopted only B’s cloud data
    expect(window.__probe.state.habits.map((h) => h.id)).toEqual(['h-cloud'])
    expect(readMigrationChoice('user-b')).toBe('cloud')
    expect(readMigrationChoice('user-a')).toBe('merge') // A untouched
    u.unmount()
  })

  it('cloud-only data still adopts silently (unchanged first-login path)', async () => {
    cloud.session = { user: USER_A }
    cloud.doc = cloudDoc([habit('h1', 'Meditate')])

    const u = mount()
    await synced()
    dialogGone()
    expect(window.__probe.state.habits.some((h) => h.id === 'h1')).toBe(true)
    u.unmount()
  })
})

/* ---------------- migrationState unit tests ---------------- */

describe('migrationState storage', () => {
  it('round-trips a choice per user', () => {
    writeMigrationChoice('u1', 'merge')
    writeMigrationChoice('u2', 'cloud')
    expect(readMigrationChoice('u1')).toBe('merge')
    expect(readMigrationChoice('u2')).toBe('cloud')
    expect(readMigrationChoice('u3')).toBeNull()
  })

  it('ignores corrupt storage instead of crashing', () => {
    localStorage.setItem(MIGRATION_KEY, '{not json')
    expect(readMigrationChoice('u1')).toBeNull()
    expect(() => writeMigrationChoice('u1', 'merge')).not.toThrow()
    expect(readMigrationChoice('u1')).toBe('merge')
  })

  it('rejects invalid choices', () => {
    writeMigrationChoice('u1', 'cancel')
    expect(readMigrationChoice('u1')).toBeNull()
    expect(readMigrationChoice(undefined)).toBeNull()
  })

  it('canonicalJson is key-order insensitive (jsonb round-trip safe)', () => {
    const a = canonicalJson({ b: 2, a: { y: [1, { d: 4, c: 3 }], x: 1 } })
    const b = canonicalJson({ a: { x: 1, y: [1, { c: 3, d: 4 }] }, b: 2 })
    expect(a).toBe(b)
    expect(canonicalJson({ a: 1 })).not.toBe(canonicalJson({ a: 2 }))
    expect(canonicalJson(null)).toBe('null')
  })
})
