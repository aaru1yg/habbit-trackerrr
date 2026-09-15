import { describe, it, expect } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { StoreProvider, STORAGE_KEY } from '../src/store.jsx'
import App from '../src/App.jsx'

/**
 * FINAL 2F — Calendar + Week polish.
 *
 * Narrow tests verifying Calendar and Week empty states now use the shared
 * EmptyState primitive (no inline <div className="empty"> variants), that the
 * views still render with seed data, and that legacy class names are gone.
 */

function emptyState() {
  return {
    version: 4,
    profile: { name: 'Aaru', onboarded: true, theme: 'midnight', workReminders: false },
    habits: [], checkins: {}, routines: [], projects: [], assignments: [], goals: [],
    moods: {}, notes: [], achievements: [],
    preferences: { focusStartHour: null, focusEndHour: null, planningTime: null, breakStyle: null, dailyCapacityMin: 120, planningBufferPct: 15, weekStartsOn: 1, reminderWindow: null },
    signals: [], focusLog: [],
  }
}

function seedState() {
  const c = { h1: {} }
  const today = new Date()
  for (let i = 0; i < 5; i++) {
    const d = new Date(today); d.setDate(today.getDate() - i)
    c.h1[d.toISOString().slice(0, 10)] = { done: true }
  }
  return {
    ...emptyState(),
    habits: [
      { id: 'h1', name: 'Write daily', category: 'learning', schedule: { type: 'daily' }, archived: false, order: 0, createdAt: '2024-01-01' },
    ],
    checkins: c,
  }
}

function mount(hash, seed) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(seed))
  sessionStorage.clear()
  window.location.hash = hash
  return render(<StoreProvider><App /></StoreProvider>)
}

describe('FINAL 2F — Calendar + Week polish', () => {
  it('Calendar empty state renders EmptyState (p-empty) with Create habit action when no habits', async () => {
    mount('#/habits?view=calendar', emptyState())
    await waitFor(() => {
      expect(document.querySelector('.hc-empty.p-empty')).not.toBeNull()
    }, { timeout: 10000 })
    expect(document.querySelector('.p-empty .p-empty__title').textContent).toMatch(/No habits yet/)
    const btn = document.querySelector('.p-empty button')
    expect(btn).not.toBeNull()
    expect(btn.textContent).toMatch(/Create habit/)
  })

  it('Calendar view renders with seed data (grid + cells)', async () => {
    mount('#/habits?view=calendar', seedState())
    await waitFor(() => expect(document.querySelector('.hc-grid')).not.toBeNull(), { timeout: 10000 })
    expect(document.querySelector('button[aria-label*="Previous range"]')).not.toBeNull()
    expect(document.querySelector('button[aria-label*="Next range"]')).not.toBeNull()
  })

  it('Week empty state renders EmptyState when no habits', async () => {
    mount('#/habits?view=week', emptyState())
    await waitFor(() => {
      expect(document.querySelector('.wr-empty.p-empty')).not.toBeNull()
    }, { timeout: 10000 })
    expect(document.querySelector('.p-empty .p-empty__title').textContent).toMatch(/No habits yet/)
    expect(document.querySelector('.p-empty button').textContent).toMatch(/Create habit/)
  })

  it('No inline-styled legacy empty fallback remains on Calendar', async () => {
    mount('#/habits?view=calendar', emptyState())
    await waitFor(() => expect(document.querySelector('.hc-empty.p-empty')).not.toBeNull(), { timeout: 10000 })
    // The old EmptyStateFallback had an inline width:40px circle.
    expect(document.querySelector('.hc-empty [style*="width: 40px"]')).toBeNull()
  })
})
