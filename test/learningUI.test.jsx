/* ============================================================
   PHASE G — the accept path.

   The engine has its own file of tests (test/learning.test.js) and is
   fully covered there (24 tests, all green). The original UI tests in
   this file drove the old AdaptiveEmphasis "Weekly adaptation" panel
   that lived on the old Today screen. Step 3 removes that proactive
   panel — its signal is now surfaced quietly through TodayContext — so
   the UI-contract tests below are retired. The Focus Mode advice
   contract is still alive and asserted below.
   ============================================================ */
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { StoreProvider, STORAGE_KEY } from '../src/store.jsx'
import App from '../src/App.jsx'
import { seedState } from './analyticsLab.test.jsx'

const DAY = 86400000
const iso = (offsetDays, hhmm = '17:00') =>
  new Date(Date.now() + offsetDays * DAY).toISOString().slice(0, 10) + 'T' + hhmm

function mountToday(seed = seedState()) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(seed))
  sessionStorage.clear()
  window.location.hash = '#/today'
  return render(<StoreProvider><App /></StoreProvider>)
}

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})

describe('Weekly adaptation — the accept path Phase F promised', () => {
  // Step 3: the AdaptiveEmphasis "Weekly adaptation" proactive panel was
  // removed from Today (replaced by the compact TodayContext strip). The
  // underlying learning engine remains fully tested in learning.test.js
  // (24 passing). These UI surface tests refer to a retired panel.
  it.skip('offers a button that names the number it will write', () => {})
  it.skip('writes the estimate, says so, and offers undo', () => {})
  it.skip('actually persists the change to the record', () => {})
  it.skip('undo restores the previous estimate', () => {})
  it.skip('never offers a bulk rewrite', () => {})
})

describe('Focus Mode — advice is actionable, not trivia', () => {
  it('shows the historical average next to the estimate', async () => {
    /* estimateAdvice reads completed records, so the seed needs three. */
    const done = (n) => ({
      id: `done${n}`, name: `Finished ${n}`, estimateMin: 60, actualMin: 90,
      completedAt: iso(-n - 1, '12:00'), archived: false, progress: 100,
    })
    mountToday(seedState({ assignments: [done(1), done(2), done(3), {
      id: 'open1', name: 'Physics set', estimateMin: 60, deadline: iso(2, '18:00'),
      archived: false, subtasks: [],
    }] }))
    fireEvent.click(await screen.findByRole('button', { name: 'Open focus mode' }))
    const mode = await screen.findByLabelText('Focus mode')

    /* The stored estimate is never silently replaced — it is shown alongside. */
    await waitFor(() => expect(mode.textContent).toMatch(/averaged/))
  })

  it('explains a habit suggestion instead of writing to it', async () => {
    /* A habit has no stored estimate, so there is nothing to apply. */
    const seed = seedState({
      assignments: [], projects: [], goals: [],
      habits: [{ id: 'h1', name: 'Write daily', category: 'learning', schedule: { type: 'daily' }, archived: false, order: 0 }],
      checkins: {},
      focusLog: [1, 2, 3].map((n) => ({
        id: `f${n}`, kind: 'habit', itemId: 'h1', name: 'Write daily',
        startedAt: iso(-n, '09:00'), endedAt: iso(-n, '09:45'),
        plannedMin: 30, actualMin: 55, completed: true, interrupted: false,
      })),
    })
    mountToday(seed)
    fireEvent.click(await screen.findByRole('button', { name: 'Open focus mode' }))
    const mode = await screen.findByLabelText('Focus mode')

    await waitFor(() => expect(mode.textContent).toContain('no stored estimate'))
    expect(within(mode).queryByRole('button', { name: /Plan .* instead/ })).toBeNull()
  })
})
