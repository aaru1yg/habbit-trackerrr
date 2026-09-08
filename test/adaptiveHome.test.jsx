/* ============================================================
   PHASE C — Adaptive Home, Preferences and the learning record.

   These drive real components, not the pure engine: the Settings
   editor, the emphasis panel on Today, the quick actions, and the
   focus session that has to be written down before anything can
   claim to learn from it.
   ============================================================ */
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { StoreProvider, useStore, STORAGE_KEY } from '../src/store.jsx'
import App from '../src/App.jsx'

const DAY = 86400000
const iso = (offsetDays, hhmm = '17:00') =>
  new Date(Date.now() + offsetDays * DAY).toISOString().slice(0, 10) + 'T' + hhmm

let captured = null
function Probe() { captured = useStore(); return null }

/** Seed a signed-in, onboarded account and mount the whole app. */
function mountApp(seed = {}) {
  const state = {
    version: 4,
    profile: { name: 'Aaru', onboarded: true, theme: 'midnight', workReminders: false },
    habits: [], checkins: {}, routines: [], projects: [], assignments: [], goals: [], moods: {},
    preferences: { focusStartHour: null, focusEndHour: null, planningTime: null, breakStyle: null, dailyCapacityMin: null, planningBufferPct: 15, weekStartsOn: 1, reminderWindow: null },
    signals: [], focusLog: [],
    ...seed,
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  window.location.hash = '#/today'
  return render(<StoreProvider><Probe /><App /></StoreProvider>)
}

const stored = () => JSON.parse(localStorage.getItem(STORAGE_KEY))
const goto = (route) => { window.location.hash = `#/${route}` }

beforeEach(() => {
  localStorage.clear()
  captured = null
  window.location.hash = '#/today'
})

/* ------------------------------------------------------------ */
describe('preferences editor (Settings → How you work)', () => {
  it('renders the editor and starts with nothing set', async () => {
    mountApp()
    goto('settings')
    await screen.findByText('How you work')
    expect(screen.getByText('nothing set')).toBeTruthy()
    expect(screen.getByLabelText('Daily capacity').value).toBe('')
    expect(screen.getByLabelText('Focus hours start').value).toBe('')
  })

  it('saves a daily capacity and counts it as set', async () => {
    mountApp()
    goto('settings')
    await screen.findByText('How you work')
    fireEvent.change(screen.getByLabelText('Daily capacity'), { target: { value: '240' } })
    await waitFor(() => expect(captured.state.preferences.dailyCapacityMin).toBe(240))
    expect(screen.getByText('1 set')).toBeTruthy()
    // and it survives to storage, which is what sync and reload read
    expect(stored().preferences.dailyCapacityMin).toBe(240)
  })

  it('clears everything back to unset', async () => {
    mountApp({ preferences: { focusStartHour: 9, focusEndHour: 12, planningTime: null, breakStyle: null, dailyCapacityMin: 240, planningBufferPct: 15, weekStartsOn: 1, reminderWindow: null } })
    goto('settings')
    await screen.findByText('How you work')
    fireEvent.click(screen.getByRole('button', { name: /clear all preferences/i }))
    await waitFor(() => expect(captured.state.preferences.dailyCapacityMin).toBeNull())
    expect(captured.state.preferences.focusStartHour).toBeNull()
  })

  it('feeds Plan My Day, which was dead before capacity could be set', async () => {
    mountApp({
      preferences: { focusStartHour: null, focusEndHour: null, planningTime: null, breakStyle: null, dailyCapacityMin: 60, planningBufferPct: 15, weekStartsOn: 1, reminderWindow: null },
      assignments: [{ id: 'a1', name: 'Essay', priority: 'high', progress: 0, estimateMin: 120, deadline: iso(1), subtasks: [], progressLog: [], milestones: [] }],
    })
    fireEvent.click(await screen.findByRole('button', { name: /build my day/i }))
    // 120 min of work against 60 min of capacity is an overload, not a mystery
    await waitFor(() => expect(screen.getByText('OVERLOADED')).toBeTruthy())
  })

  it('shows the observed profile honestly when there is no history', async () => {
    mountApp()
    goto('settings')
    await screen.findByText('What Habit OS has observed')
    expect(screen.getByText('Not enough data yet.')).toBeTruthy()
  })
})

/* ------------------------------------------------------------ */
describe('adaptive home emphasis (Today)', () => {
  it('leans on deadlines and says exactly why', async () => {
    mountApp({
      assignments: [{ id: 'a1', name: 'Overdue essay', priority: 'high', progress: 20, estimateMin: 60, deadline: iso(-2), subtasks: [], progressLog: [] }],
    })
    const badge = await screen.findByText('Deadlines', { selector: '.emphasis-badge' })
    expect(badge).toBeTruthy()
    expect(screen.getByText(/item is past a deadline|items are past a deadline/)).toBeTruthy()
    expect(screen.getByText('1', { selector: '.emphasis-evidence b' })).toBeTruthy()
  })

  it('keeps every section present — emphasis never changes structure', async () => {
    mountApp({ habits: [{ id: 'h1', name: 'Run', category: 'mind', schedule: { type: 'daily' }, createdAt: '2026-01-01', archived: false, skips: [] }] })
    await screen.findByText('Today’s emphasis')
    const stage = document.querySelector('.today-stage')
    expect(stage).toBeTruthy()
    // all four weights are published, whatever the emphasis
    for (const v of ['--emph-deadline', '--emph-work', '--emph-habit', '--emph-goal']) {
      expect(stage.style.getPropertyValue(v), `${v} missing`).not.toBe('')
    }
    // and the sections that were there before are still there
    expect(screen.getByText('Plan my day')).toBeTruthy()
    expect(screen.getByText('Focus mode')).toBeTruthy()
  })

  it('publishes a weight range that cannot destroy the hierarchy', async () => {
    mountApp()
    await screen.findByText('Today’s emphasis')
    const stage = document.querySelector('.today-stage')
    for (const v of ['--emph-deadline', '--emph-work', '--emph-habit', '--emph-goal']) {
      const n = Number(stage.style.getPropertyValue(v))
      expect(n).toBeGreaterThanOrEqual(0.85)
      expect(n).toBeLessThanOrEqual(1.35)
    }
  })
})

/* ------------------------------------------------------------ */
describe('quick actions', () => {
  it('falls back to the default order and admits it has not learned', async () => {
    mountApp()
    await screen.findByText('Quick actions')
    expect(screen.getByText('default order')).toBeTruthy()
    expect(screen.getByText(/Default order/)).toBeTruthy()
  })

  it('promotes what the user actually does', async () => {
    const now = Date.now()
    const sig = (type, target, i) => ({ id: `s${i}`, type, at: new Date(now - i * 3600000).toISOString(), target, note: null })
    mountApp({
      signals: [
        sig('focus-start', 'x', 0), sig('focus-start', 'x', 1), sig('focus-start', 'x', 2),
        sig('habit-add', null, 3), sig('screen-visit', 'today', 4),
      ],
    })
    await screen.findByText('Quick actions')
    expect(screen.getByText('from your recent actions')).toBeTruthy()
    const row = document.querySelector('.quick-action-row')
    expect(within(row).getAllByRole('button')[0].textContent).toMatch(/Start focus/)
  })

  it('never shares an accessible name with the form it opens', async () => {
    /* A quick action *opens* a form; the form's own button *commits* it. When
       both read "Add habit" nothing can tell them apart — not a screen reader,
       and not anything that drives the UI by name. The shortcut says "New …". */
    mountApp()
    await screen.findByText('Quick actions')
    fireEvent.click(within(document.querySelector('.quick-action-row')).getByText('New habit'))
    const dialog = await screen.findByRole('dialog')
    const named = [...document.querySelectorAll('button')]
      .filter((b) => b.textContent.trim() === 'Add habit' || b.getAttribute('aria-label') === 'Add habit')
    expect(named.length).toBe(1)
    expect(within(dialog).getByText('Add habit')).toBeTruthy()
  })

  it('opens focus mode from a quick action', async () => {
    mountApp({
      signals: [
        { id: 'a', type: 'focus-start', at: new Date().toISOString(), target: 'x', note: null },
        { id: 'b', type: 'focus-start', at: new Date().toISOString(), target: 'x', note: null },
        { id: 'c', type: 'focus-start', at: new Date().toISOString(), target: 'x', note: null },
        { id: 'd', type: 'focus-start', at: new Date().toISOString(), target: 'x', note: null },
        { id: 'e', type: 'focus-start', at: new Date().toISOString(), target: 'x', note: null },
      ],
      assignments: [{ id: 'a1', name: 'Essay', priority: 'high', progress: 0, estimateMin: 45, deadline: iso(1), subtasks: [], progressLog: [] }],
    })
    await screen.findByText('Quick actions')
    fireEvent.click(within(document.querySelector('.quick-action-row')).getAllByRole('button')[0])
    await waitFor(() => expect(screen.getByRole('timer')).toBeTruthy())
  })

  it('navigates to workload from a quick action', async () => {
    const sig = (type, target, i) => ({ id: `s${i}`, type, at: new Date().toISOString(), target, note: null })
    mountApp({
      signals: [sig('screen-visit', 'workload', 0), sig('screen-visit', 'workload', 1), sig('screen-visit', 'workload', 2), sig('screen-visit', 'workload', 3), sig('screen-visit', 'workload', 4)],
    })
    await screen.findByText('Quick actions')
    const buttons = within(document.querySelector('.quick-action-row')).getAllByRole('button')
    fireEvent.click(buttons[0])
    await waitFor(() => expect(window.location.hash).toBe('#/workload'))
  })
})

/* ------------------------------------------------------------ */
describe('behaviour recording', () => {
  it('records a screen the user actually visits, once', async () => {
    mountApp()
    await screen.findByText('Today’s emphasis')
    const visits = () => captured.state.signals.filter((s) => s.type === 'screen-visit')
    await waitFor(() => expect(visits().length).toBeGreaterThanOrEqual(1))
    expect(visits()[0].target).toBe('today')
    const before = visits().length
    goto('settings')
    await screen.findByText('How you work')
    await waitFor(() => expect(visits().length).toBe(before + 1))
    expect(visits().at(-1).target).toBe('settings')
  })

  it('records a habit completion from the real reducer', async () => {
    mountApp({ habits: [{ id: 'h1', name: 'Run', category: 'mind', schedule: { type: 'daily' }, createdAt: '2026-01-01', archived: false, skips: [] }] })
    await screen.findByText('Today’s emphasis')
    captured.dispatch({ type: 'TOGGLE_CHECKIN', habitId: 'h1', date: new Date().toISOString().slice(0, 10) })
    await waitFor(() => expect(captured.state.signals.some((s) => s.type === 'habit-complete')).toBe(true))
    // un-completing is not behaviour worth learning from
    const count = captured.state.signals.filter((s) => s.type === 'habit-complete').length
    captured.dispatch({ type: 'TOGGLE_CHECKIN', habitId: 'h1', date: new Date().toISOString().slice(0, 10) })
    expect(captured.state.signals.filter((s) => s.type === 'habit-complete').length).toBe(count)
  })

  it('records project and assignment creation under one signal, distinguished by target', async () => {
    mountApp()
    await screen.findByText('Today’s emphasis')
    captured.dispatch({ type: 'ADD_PROJECT', project: { name: 'Site' } })
    captured.dispatch({ type: 'ADD_ASSIGNMENT', assignment: { name: 'Essay' } })
    await waitFor(() => expect(captured.state.signals.filter((s) => s.type === 'work-add').length).toBe(2))
    const targets = captured.state.signals.filter((s) => s.type === 'work-add').map((s) => s.target).sort()
    expect(targets).toEqual(['assignment', 'project'])
  })

  it('records a plan build when the user asks for one', async () => {
    mountApp()
    fireEvent.click(await screen.findByRole('button', { name: /build my day/i }))
    await waitFor(() => expect(captured.state.signals.some((s) => s.type === 'plan-build')).toBe(true))
  })
})

/* ------------------------------------------------------------ */
describe('focus session record — the source of actuals', () => {
  const withWork = () => mountApp({
    assignments: [{ id: 'a1', name: 'Essay', priority: 'high', progress: 0, estimateMin: 45, deadline: iso(1), subtasks: [], progressLog: [] }],
  })

  /* AdaptiveCommandCenter also has a Complete button, so every query below is
     scoped to the focus card rather than the page. */
  const focusCard = () => within(document.querySelector('.focus-mode'))
  const openFocus = async () => {
    fireEvent.click(await screen.findByRole('button', { name: /^focus mode$/i }))
    await waitFor(() => expect(document.querySelector('.focus-mode .focus-timer')).toBeTruthy())
  }

  it('saves a completed session with its real duration', async () => {
    withWork()
    await openFocus()
    fireEvent.click(focusCard().getByRole('button', { name: /^start$/i }))
    fireEvent.click(focusCard().getByRole('button', { name: /^complete$/i }))
    await waitFor(() => expect(captured.state.focusLog).toHaveLength(1))
    const s = captured.state.focusLog[0]
    expect(s).toMatchObject({ kind: 'assignment', itemId: 'a1', plannedMin: 25, completed: true })
    expect(s.startedAt).toBeTruthy()
    expect(s.endedAt).toBeTruthy()
    expect(Number.isFinite(s.actualMin)).toBe(true)
    expect(captured.state.signals.some((x) => x.type === 'focus-complete')).toBe(true)
  })

  it('cannot complete or skip before the timer has started', async () => {
    withWork()
    await openFocus()
    expect(focusCard().getByRole('button', { name: /^complete$/i }).disabled).toBe(true)
    expect(focusCard().getByRole('button', { name: /^skip$/i }).disabled).toBe(true)
    expect(captured.state.focusLog).toEqual([])
  })

  it('records an abandoned session as interrupted, not completed', async () => {
    withWork()
    await openFocus()
    fireEvent.click(focusCard().getByRole('button', { name: /^start$/i }))
    fireEvent.click(focusCard().getByRole('button', { name: /^skip$/i }))
    await waitFor(() => expect(captured.state.focusLog).toHaveLength(1))
    expect(captured.state.focusLog[0]).toMatchObject({ completed: false, interrupted: true })
    expect(captured.state.signals.some((x) => x.type === 'focus-complete')).toBe(false)
  })

  it('persists the session so a reload can learn from it', async () => {
    withWork()
    await openFocus()
    fireEvent.click(focusCard().getByRole('button', { name: /^start$/i }))
    fireEvent.click(focusCard().getByRole('button', { name: /^complete$/i }))
    await waitFor(() => expect(stored().focusLog).toHaveLength(1))
  })
})
