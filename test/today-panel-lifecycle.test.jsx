/* Refinement #5 — post-dismiss lifecycle regression tests.
   Verifies that Plan and Focus panels (a) don't render inline on initial load,
   (b) appear when their tool is activated, (c) fully unmount when dismissed,
   (d) can be re-opened, (e) Escape works, and (f) no ghost "Focus mode" button
   or "Plan my day / Build my day" idle card returns. */
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, within, cleanup, fireEvent } from '@testing-library/react'
import { StoreProvider } from '../src/store.jsx'
import App from '../src/App.jsx'

const DAY = 86400000
const iso = (off, hh = '17:00') => new Date(Date.now() + off * DAY).toISOString().slice(0, 10) + 'T' + hh
const today = new Date().toISOString().slice(0, 10)

function desktopMatchMedia(q) {
  return { matches: q.startsWith('(min-width:'), media: q, onchange: null,
    addListener: () => {}, removeListener: () => {},
    addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false }
}

function seedLoaded() {
  return { version: 4, profile: { name: 'Aaru', onboarded: true, theme: 'midnight' },
    habits: [
      { id: 'h1', name: 'Read 10 pages', category: 'learning', schedule: { type: 'daily' }, archived: false, order: 0, estimateMin: 15 },
      { id: 'h2', name: 'Meditate', category: 'mind', schedule: { type: 'daily' }, archived: false, order: 1 },
    ],
    checkins: { h2: { [today]: { done: true } } }, routines: [],
    projects: [{ id: 'p1', name: 'Ship v1', deadline: iso(0, '18:00'), archived: false, createdAt: today,
      milestones: [{ id: 'm1', name: 'Scope', tasks: [{ id: 't1', name: 'Write spec', done: false }] }] }],
    assignments: [{ id: 'a1', name: 'Physics set', deadline: iso(2, '18:00'), estimateMin: 30, priority: 'high', archived: false, subtasks: [] }],
    goals: [], moods: {}, notes: [], achievements: [],
    preferences: { dailyCapacityMin: 9999, planningBufferPct: 15, weekStartsOn: 1 }, signals: [], focusLog: [] }
}

async function mount() {
  cleanup()
  localStorage.clear(); sessionStorage.clear()
  window.matchMedia = desktopMatchMedia
  window.dispatchEvent(new Event('resize'))
  window.location.hash = ''
  localStorage.setItem('habit-os-v4', JSON.stringify(seedLoaded()))
  const utils = render(<StoreProvider initialState={seedLoaded()}><App /></StoreProvider>)
  window.location.hash = '#/today'
  window.dispatchEvent(new window.HashChangeEvent('hashchange'))
  await screen.findByRole('heading', { name: 'Today' })
  return utils
}

function tools() { return document.querySelector('.today-tools') }
function planningPanel() { return document.querySelector('.planning-panel') }
function focusPanel() { return document.querySelector('.focus-mode') }
function focusGhost() { return document.querySelector('.focus-launch') }

beforeEach(() => { cleanup(); localStorage.clear(); sessionStorage.clear(); window.location.hash = '' })

describe('§R5.1 PlanningPanel lifecycle on Today', () => {
  it('initial render has NO PlanningPanel (no idle "Plan my day / Build my day" card)', async () => {
    await mount()
    expect(planningPanel()).toBeNull()
    // No "Build my day" or "Plan my day" heading/card outside the Tools section
    expect(screen.queryByRole('heading', { name: /Plan my day/ })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Build my day' })).toBeNull()
  })

  it('clicking Plan mounts PlanningPanel as a dialog', async () => {
    await mount()
    fireEvent.click(within(tools()).getByRole('button', { name: /plan/i }))
    const panel = planningPanel()
    expect(panel).toBeTruthy()
    expect(panel.getAttribute('role')).toBe('dialog')
  })

  it('clicking Dismiss in PlanningPanel UNMOUNTS it completely (no closed card remains)', async () => {
    await mount()
    fireEvent.click(within(tools()).getByRole('button', { name: /plan/i }))
    expect(planningPanel()).toBeTruthy()
    fireEvent.click(within(planningPanel()).getByRole('button', { name: 'Dismiss' }))
    expect(planningPanel()).toBeNull()
    expect(screen.queryByRole('button', { name: 'Build my day' })).toBeNull()
  })

  it('pressing Escape while PlanningPanel is open UNMOUNTS it', async () => {
    await mount()
    fireEvent.click(within(tools()).getByRole('button', { name: /plan/i }))
    expect(planningPanel()).toBeTruthy()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(planningPanel()).toBeNull()
  })

  it('Plan can be opened again after dismissal (re-open still works)', async () => {
    await mount()
    fireEvent.click(within(tools()).getByRole('button', { name: /plan/i }))
    fireEvent.click(within(planningPanel()).getByRole('button', { name: 'Dismiss' }))
    expect(planningPanel()).toBeNull()
    fireEvent.click(within(tools()).getByRole('button', { name: /plan/i }))
    expect(planningPanel()).toBeTruthy()
  })
})

describe('§R5.2 FocusMode lifecycle on Today', () => {
  it('initial render has NO FocusMode and NO ghost "Focus mode" launch button', async () => {
    await mount()
    expect(focusPanel()).toBeNull()
    expect(focusGhost()).toBeNull()
    expect(screen.queryByRole('heading', { name: /^Focus mode$/ })).toBeNull()
  })

  it('clicking Focus mounts FocusMode as a dialog', async () => {
    await mount()
    fireEvent.click(within(tools()).getByRole('button', { name: /focus/i }))
    const panel = focusPanel()
    expect(panel).toBeTruthy()
    expect(panel.getAttribute('role')).toBe('dialog')
    // The panel exposes an "Focus mode" label via aria-label; the next-action
    // item (e.g. the overdue work) appears as the main h2 heading.
    expect(panel.getAttribute('aria-label')).toMatch(/Focus mode/)
    expect(within(panel).getByText(/Focus mode/)).toBeTruthy()
  })

  it('clicking Exit on the pre-start FocusMode UNMOUNTS it (no ghost button returns)', async () => {
    await mount()
    fireEvent.click(within(tools()).getByRole('button', { name: /focus/i }))
    expect(focusPanel()).toBeTruthy()
    fireEvent.click(within(focusPanel()).getByRole('button', { name: /exit/i }))
    expect(focusPanel()).toBeNull()
    expect(focusGhost()).toBeNull()
    expect(screen.queryByRole('button', { name: 'Focus mode' })).toBeNull()
  })

  it('pressing Escape while FocusMode is open UNMOUNTS it', async () => {
    await mount()
    fireEvent.click(within(tools()).getByRole('button', { name: /focus/i }))
    expect(focusPanel()).toBeTruthy()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(focusPanel()).toBeNull()
    expect(focusGhost()).toBeNull()
  })

  it('View link inside FocusMode unmounts the panel (navigates away from focus)', async () => {
    await mount()
    fireEvent.click(within(tools()).getByRole('button', { name: /focus/i }))
    expect(focusPanel()).toBeTruthy()
    // The "View" link navigates to the item; its onClick calls onClose
    const view = within(focusPanel()).getByRole('link', { name: 'View' })
    fireEvent.click(view)
    expect(focusPanel()).toBeNull()
  })

  it('Focus can be opened again after exit (re-open still works)', async () => {
    await mount()
    fireEvent.click(within(tools()).getByRole('button', { name: /focus/i }))
    fireEvent.click(within(focusPanel()).getByRole('button', { name: /exit/i }))
    expect(focusPanel()).toBeNull()
    fireEvent.click(within(tools()).getByRole('button', { name: /focus/i }))
    expect(focusPanel()).toBeTruthy()
  })
})

describe('§R5.3 No duplicates / no stale controls', () => {
  it('at most one PlanningPanel and one FocusMode in the DOM at a time', async () => {
    await mount()
    fireEvent.click(within(tools()).getByRole('button', { name: /plan/i }))
    fireEvent.click(within(tools()).getByRole('button', { name: /focus/i }))
    // Opening Focus after Plan: Plan is still mounted (it doesn't auto-close)
    // and there is exactly one of each.
    expect(document.querySelectorAll('.planning-panel').length).toBe(1)
    expect(document.querySelectorAll('.focus-mode').length).toBe(1)
    // No ghost launch buttons anywhere
    expect(document.querySelectorAll('.focus-launch').length).toBe(0)
  })

  it('after opening and dismissing BOTH panels, only the Tools buttons remain (clean composition)', async () => {
    await mount()
    fireEvent.click(within(tools()).getByRole('button', { name: /plan/i }))
    fireEvent.click(within(planningPanel()).getByRole('button', { name: 'Dismiss' }))
    fireEvent.click(within(tools()).getByRole('button', { name: /focus/i }))
    fireEvent.click(within(focusPanel()).getByRole('button', { name: /exit/i }))
    expect(planningPanel()).toBeNull()
    expect(focusPanel()).toBeNull()
    expect(focusGhost()).toBeNull()
    // The Tools dock still shows its 3-4 tools (Focus/Plan/Calendar + Recovery if present)
    const dockButtons = tools().querySelectorAll('.today-tool')
    expect(dockButtons.length).toBeGreaterThanOrEqual(3)
    expect(dockButtons.length).toBeLessThanOrEqual(4)
  })
})
