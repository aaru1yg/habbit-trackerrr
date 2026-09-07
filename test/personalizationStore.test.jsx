/* ============================================================
   STORE WIRING for the adaptive layer (Phase B).

   The engine itself is pure and covered in personalization.test.js.
   These tests drive the real reducer, so a broken dispatch, a lost
   key or a persistence gap cannot slip through.
   ============================================================ */
import { describe, it, expect, beforeEach } from 'vitest'
import { act, render, waitFor } from '@testing-library/react'
import { StoreProvider, useStore, STORAGE_KEY, emptyState } from '../src/store.jsx'
import { DEFAULT_PREFERENCES, MAX_SIGNALS } from '../src/lib/personalization.js'

let captured = null
function Probe() {
  captured = useStore()
  return null
}

const setup = (seed) => {
  if (seed) localStorage.setItem(STORAGE_KEY, JSON.stringify(seed))
  return render(<StoreProvider><Probe /></StoreProvider>)
}

const stored = () => JSON.parse(localStorage.getItem(STORAGE_KEY))

beforeEach(() => { localStorage.clear(); captured = null })

describe('adaptive layer in the store', () => {
  it('starts with no preferences, no signals and no sessions', () => {
    setup()
    const s = emptyState()
    expect(s.preferences).toEqual(DEFAULT_PREFERENCES)
    expect(s.signals).toEqual([])
    expect(s.focusLog).toEqual([])
  })

  it('SET_PREFERENCE writes a validated preference and stamps profile.updatedAt', async () => {
    setup()
    act(() => captured.dispatch({ type: 'SET_PREFERENCE', patch: { dailyCapacityMin: 240, focusStartHour: 9 } }))
    await waitFor(() => expect(captured.state.preferences.dailyCapacityMin).toBe(240))
    expect(captured.state.preferences.focusStartHour).toBe(9)
    expect(captured.state.profile.updatedAt).toBeTruthy()
  })

  it('SET_PREFERENCE refuses an impossible value instead of storing it', async () => {
    setup()
    act(() => captured.dispatch({ type: 'SET_PREFERENCE', patch: { focusStartHour: 42, dailyCapacityMin: 3 } }))
    await waitFor(() => expect(captured.state.preferences.focusStartHour).toBeNull())
    expect(captured.state.preferences.dailyCapacityMin).toBeNull()
  })

  it('SET_PROFILE stamps updatedAt so a sync conflict can be resolved by recency', async () => {
    setup()
    expect(captured.state.profile.updatedAt).toBeUndefined()
    act(() => captured.dispatch({ type: 'SET_PROFILE', patch: { theme: 'aurora' } }))
    await waitFor(() => expect(captured.state.profile.theme).toBe('aurora'))
    expect(Date.parse(captured.state.profile.updatedAt)).toBeTruthy()
  })

  it('RECORD_SIGNAL appends real behaviour and rejects unknown types', async () => {
    setup()
    act(() => captured.dispatch({ type: 'RECORD_SIGNAL', signal: 'focus-start', target: 'a1', at: '2026-09-07T09:00:00' }))
    await waitFor(() => expect(captured.state.signals).toHaveLength(1))
    expect(captured.state.signals[0]).toMatchObject({ type: 'focus-start', target: 'a1' })

    act(() => captured.dispatch({ type: 'RECORD_SIGNAL', signal: 'guessed-mood' }))
    expect(captured.state.signals).toHaveLength(1)
  })

  it('keeps the signal log capped as behaviour accumulates', async () => {
    setup()
    act(() => {
      for (let i = 0; i < MAX_SIGNALS + 30; i++) {
        captured.dispatch({ type: 'RECORD_SIGNAL', signal: 'screen-visit', target: `s${i}`, at: '2026-09-07T09:00:00' })
      }
    })
    await waitFor(() => expect(captured.state.signals).toHaveLength(MAX_SIGNALS))
  })

  it('PRUNE_SIGNALS drops stale behaviour', async () => {
    setup()
    act(() => {
      captured.dispatch({ type: 'RECORD_SIGNAL', signal: 'capture', at: '2026-01-01T09:00:00' })
      captured.dispatch({ type: 'RECORD_SIGNAL', signal: 'capture', at: '2026-09-07T09:00:00' })
    })
    await waitFor(() => expect(captured.state.signals).toHaveLength(2))
    act(() => captured.dispatch({ type: 'PRUNE_SIGNALS', days: 30, now: new Date('2026-09-07T12:00:00') }))
    await waitFor(() => expect(captured.state.signals).toHaveLength(1))
  })

  it('ADD_FOCUS_SESSION stores a finished session that learning can read', async () => {
    setup()
    act(() => captured.dispatch({
      type: 'ADD_FOCUS_SESSION',
      session: { kind: 'assignment', itemId: 'a1', name: 'Essay', startedAt: '2026-09-07T09:00:00', endedAt: '2026-09-07T09:52:00', plannedMin: 45, actualMin: 52, completed: true },
    }))
    await waitFor(() => expect(captured.state.focusLog).toHaveLength(1))
    expect(captured.state.focusLog[0]).toMatchObject({ actualMin: 52, completed: true })
  })

  it('ADD_FOCUS_SESSION ignores a session that never ended', async () => {
    setup()
    act(() => captured.dispatch({ type: 'ADD_FOCUS_SESSION', session: { kind: 'habit', startedAt: '2026-09-07T09:00:00' } }))
    expect(captured.state.focusLog).toEqual([])
  })

  it('persists all three to localStorage so they survive a reload', async () => {
    setup()
    act(() => {
      captured.dispatch({ type: 'SET_PREFERENCE', patch: { dailyCapacityMin: 180 } })
      captured.dispatch({ type: 'RECORD_SIGNAL', signal: 'plan-build', at: '2026-09-07T09:00:00' })
      captured.dispatch({ type: 'ADD_FOCUS_SESSION', session: { kind: 'habit', startedAt: '2026-09-07T09:00:00', endedAt: '2026-09-07T09:30:00', plannedMin: 30, actualMin: 30, completed: true } })
    })
    await waitFor(() => expect(stored().preferences.dailyCapacityMin).toBe(180))
    expect(stored().signals).toHaveLength(1)
    expect(stored().focusLog).toHaveLength(1)

    // and they come back intact after a remount
    const u = setup()
    u.unmount()
    setup()
    await waitFor(() => expect(captured.state.preferences.dailyCapacityMin).toBe(180))
    expect(captured.state.signals).toHaveLength(1)
    expect(captured.state.focusLog).toHaveLength(1)
  })

  it('RESET_ALL clears the adaptive layer with everything else', async () => {
    setup()
    act(() => {
      captured.dispatch({ type: 'SET_PREFERENCE', patch: { dailyCapacityMin: 180 } })
      captured.dispatch({ type: 'RECORD_SIGNAL', signal: 'capture', at: '2026-09-07T09:00:00' })
    })
    await waitFor(() => expect(captured.state.signals).toHaveLength(1))
    act(() => captured.dispatch({ type: 'RESET_ALL' }))
    await waitFor(() => expect(captured.state.signals).toEqual([]))
    expect(captured.state.preferences).toEqual(DEFAULT_PREFERENCES)
    expect(captured.state.focusLog).toEqual([])
  })

  it('adopts an older saved document without inventing an adaptive layer', () => {
    // A v4 document written before this release: no preferences/signals/focusLog.
    const legacy = {
      version: 4,
      profile: { name: 'Aaru', onboarded: true, theme: 'midnight' },
      habits: [{ id: 'h1', name: 'Run', createdAt: '2026-08-01' }],
      checkins: {}, routines: [], projects: [], assignments: [], goals: [], moods: {},
    }
    setup(legacy)
    expect(captured.state.preferences).toEqual(DEFAULT_PREFERENCES)
    expect(captured.state.signals).toEqual([])
    expect(captured.state.focusLog).toEqual([])
    expect(captured.state.habits).toHaveLength(1)
  })
})
