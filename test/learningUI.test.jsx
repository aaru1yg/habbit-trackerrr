/* ============================================================
   PHASE G — the accept path.

   The engine has its own file of tests (test/learning.test.js). This
   drives the real screens, because the defect Phase G fixes was a UI
   one: a panel that promised "Nothing changes unless you accept it"
   and had no accept control at all.
   ============================================================ */
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { StoreProvider, STORAGE_KEY } from '../src/store.jsx'
import App from '../src/App.jsx'
import { seedState } from './analyticsLab.test.jsx'

const DAY = 86400000
const iso = (offsetDays, hhmm = '17:00') =>
  new Date(Date.now() + offsetDays * DAY).toISOString().slice(0, 10) + 'T' + hhmm

/** Focus sessions all running 50% over plan — the weekly panel's evidence. */
function longRunningLog() {
  return [1, 2, 3, 4].map((n) => ({
    id: `f${n}`, kind: 'assignment', itemId: 'a1', name: 'Physics set',
    startedAt: iso(-n, '09:00'), endedAt: iso(-n, '09:45'),
    plannedMin: 30, actualMin: 45, completed: true, interrupted: false,
  }))
}

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
  it('offers a button that names the number it will write', async () => {
    mountToday(seedState({ focusLog: longRunningLog() }))
    const panel = await screen.findByLabelText('Weekly adaptation')

    const accept = await waitFor(() => {
      const btn = within(panel).getByRole('button', { name: /Plan .* instead/ })
      return btn
    })
    /* The label states the figure, so accepting is never a blind write. */
    expect(accept.textContent).toMatch(/Plan \d/)
  })

  it('writes the estimate, says so, and offers undo', async () => {
    mountToday(seedState({ focusLog: longRunningLog() }))
    const panel = await screen.findByLabelText('Weekly adaptation')
    const accept = await waitFor(() => within(panel).getByRole('button', { name: /Plan .* instead/ }))

    fireEvent.click(accept)

    await waitFor(() => expect(document.querySelector('.toast-region')?.textContent).toMatch(/now planned at 45 min/))
    expect(within(document.querySelector('.toast-region')).getByRole('button', { name: 'Undo' })).toBeTruthy()
    /* The suggestion is derived from state, so it resolves itself once the
       estimate matches the evidence — no stale "Applied" flag to go wrong. */
    await waitFor(() => expect(within(panel).queryByRole('button', { name: /Plan .* instead/ })).toBeNull())
    expect(panel.textContent).toContain('already planned near that')
  })

  it('actually persists the change to the record', async () => {
    mountToday(seedState({ focusLog: longRunningLog() }))
    const panel = await screen.findByLabelText('Weekly adaptation')
    const accept = await waitFor(() => within(panel).getByRole('button', { name: /Plan .* instead/ }))
    fireEvent.click(accept)

    await waitFor(() => {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY))
      expect(saved.assignments.find((a) => a.id === 'a1').estimateMin).toBe(45)
    })
    /* Acceptance is recorded, so the product can tell acted-on from ignored. */
    await waitFor(() => {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY))
      expect(saved.signals.some((s) => s.type === 'estimate-accept')).toBe(true)
    })
  })

  it('undo restores the previous estimate', async () => {
    mountToday(seedState({ focusLog: longRunningLog() }))
    const panel = await screen.findByLabelText('Weekly adaptation')
    fireEvent.click(await waitFor(() => within(panel).getByRole('button', { name: /Plan .* instead/ })))

    const undo = await waitFor(() =>
      within(document.querySelector('.toast-region')).getByRole('button', { name: 'Undo' }))
    fireEvent.click(undo)

    await waitFor(() => {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY))
      expect(saved.assignments.find((a) => a.id === 'a1').estimateMin).toBe(120)
    })
  })

  it('never offers a bulk rewrite', async () => {
    mountToday(seedState({ focusLog: longRunningLog() }))
    const panel = await screen.findByLabelText('Weekly adaptation')
    await waitFor(() => within(panel).getByRole('button', { name: /Plan .* instead/ }))

    /* One suggestion, one record. No "fix everything" control exists. */
    expect(within(panel).getAllByRole('button', { name: /Plan .* instead/ })).toHaveLength(1)
    expect(within(panel).queryByRole('button', { name: /all/i })).toBeNull()
  })
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
    fireEvent.click(await screen.findByRole('button', { name: 'Focus mode' }))
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
    fireEvent.click(await screen.findByRole('button', { name: 'Focus mode' }))
    const mode = await screen.findByLabelText('Focus mode')

    await waitFor(() => expect(mode.textContent).toContain('no stored estimate'))
    expect(within(mode).queryByRole('button', { name: /Plan .* instead/ })).toBeNull()
  })
})
