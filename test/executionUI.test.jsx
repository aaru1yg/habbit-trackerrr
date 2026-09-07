/* ============================================================
   PHASE F — the execution flow UI.

   The engine has its own file of tests (test/execution.test.js); this
   drives the real screens: Focus Mode's honest completion, the lazy
   universal action sheet on Today's priority rows, and the contextual /
   weekly panels that must stay silent without evidence.
   ============================================================ */
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { StoreProvider, STORAGE_KEY } from '../src/store.jsx'
import App from '../src/App.jsx'
import { seedState } from './analyticsLab.test.jsx'

const DAY = 86400000
const iso = (offsetDays, hhmm = '17:00') =>
  new Date(Date.now() + offsetDays * DAY).toISOString().slice(0, 10) + 'T' + hhmm

/** Four measured sessions, all running 50% over plan — enough for #28. */
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

describe('Focus Mode — #23, honest completion', () => {
  it('offers Complete for an assignment and records the real duration', async () => {
    mountToday()
    fireEvent.click(await screen.findByRole('button', { name: 'Focus mode' }))

    const mode = await screen.findByLabelText('Focus mode')
    fireEvent.click(within(mode).getByRole('button', { name: 'Start' }))

    const complete = within(mode).getByRole('button', { name: 'Complete' })
    expect(complete.disabled).toBe(false)
    fireEvent.click(complete)

    await waitFor(() => expect(within(mode).getByText('Session complete')).toBeTruthy())
    expect(within(mode).getByText(/saved with its real duration/)).toBeTruthy()
  })

  /* The defect Phase F fixes: a project used to show Complete, record a
     finished session, and change nothing at all. */
  it('does not offer a one-tap Complete for a project, and says why', async () => {
    const seed = seedState({ assignments: [], goals: [], habits: [], checkins: {} })
    mountToday(seed)
    fireEvent.click(await screen.findByRole('button', { name: 'Focus mode' }))

    const mode = await screen.findByLabelText('Focus mode')
    expect(within(mode).queryByRole('button', { name: 'Complete' })).toBeNull()
    expect(within(mode).getByText(/A project is finished by finishing its work/)).toBeTruthy()
  })
})

describe('Today priority rows — #19/#22, act without navigating', () => {
  it('opens the universal action sheet lazily from a priority row', async () => {
    mountToday()
    await screen.findByText("Today's priorities")
    await waitFor(() => expect(document.querySelector('.priority-list')).toBeTruthy())

    const trigger = document.querySelector('.priority-actions')
    expect(trigger).toBeTruthy()
    fireEvent.click(trigger)

    const dialog = await screen.findByRole('dialog')
    /* itemActions() resolved for this item, not an empty shell. */
    await waitFor(() => expect(dialog.querySelectorAll('.item-action').length).toBeGreaterThan(0))
  })

  it('gives every action button an accessible name', async () => {
    mountToday()
    await screen.findByText("Today's priorities")
    const triggers = Array.from(document.querySelectorAll('.priority-actions'))
    expect(triggers.length).toBeGreaterThan(0)
    for (const t of triggers) {
      expect(t.getAttribute('aria-label')).toMatch(/^Actions for .+/u)
    }
  })
})

describe('Execution panels — #26/#27/#28', () => {
  it('stays completely silent for a brand-new user', async () => {
    mountToday(seedState({
      habits: [], checkins: {}, projects: [], assignments: [], goals: [],
      focusLog: [], signals: [],
    }))
    /* The real empty-state copy — a new user has nothing scheduled. */
    await screen.findByText('No habits scheduled for today.')
    expect(document.querySelector('.exec-context')).toBeNull()
    expect(document.querySelector('.weekly-adapt')).toBeNull()
  })

  it('shows the contextual reading when there is work to do', async () => {
    mountToday()
    const ctx = await screen.findByLabelText('Right now')
    /* The lens reason and the joined sentence both come from the engines. */
    expect(ctx.textContent.length).toBeGreaterThan(0)
    expect(ctx.textContent).toMatch(/Estimated/)
  })

  it('shows planned vs actual once there are enough real sessions', async () => {
    mountToday(seedState({ focusLog: longRunningLog() }))
    const panel = await screen.findByLabelText('Weekly adaptation')

    expect(panel.textContent).toContain('4 sessions')
    expect(panel.textContent).toContain('run long')
    /* The honesty line: a suggestion never edits a stored estimate. */
    expect(panel.textContent).toContain('Nothing changes unless you accept it.')
  })

  it('says nothing about the week when sessions are too few to compare', async () => {
    mountToday(seedState({ focusLog: longRunningLog().slice(0, 2) }))
    await screen.findByText("Today's priorities")
    expect(document.querySelector('.weekly-adapt')).toBeNull()
  })

  it('raises one nudge and stops nagging once dismissed', async () => {
    mountToday(seedState({ focusLog: longRunningLog() }))
    const nudge = await screen.findByLabelText('Suggestion')
    expect(nudge.textContent).toContain('run long')

    fireEvent.click(within(nudge).getByRole('button', { name: 'Dismiss' }))

    await waitFor(() => expect(document.querySelector('.nudge')).toBeNull())
    /* The dismissal outlives the component, so a reload does not re-nag. */
    expect(JSON.parse(sessionStorage.getItem('aaru.nudges.dismissed'))).toContain('estimate:assignment-estimate:4')
  })
})
