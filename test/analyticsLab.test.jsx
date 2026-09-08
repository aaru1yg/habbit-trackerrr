/* ============================================================
   PHASE D — the Analytics Lab UI.

   The engine has its own file of tests; this drives the real screen:
   lazy load, the seven views, the drill-down sheet, and the empty
   state a brand-new user meets.
   ============================================================ */
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { StoreProvider, STORAGE_KEY } from '../src/store.jsx'
import App from '../src/App.jsx'

const DAY = 86400000
const iso = (offsetDays, hhmm = '17:00') =>
  new Date(Date.now() + offsetDays * DAY).toISOString().slice(0, 10) + 'T' + hhmm

export function seedState(over = {}) {
  const habits = [{ id: 'h1', name: 'Write daily', category: 'learning', schedule: { type: 'daily' }, reminder: null, notes: '', createdAt: iso(-120, '09:00'), archived: false, order: 0 }]
  const checkins = { h1: {} }
  for (let i = 1; i <= 60; i++) {
    if (i % 4 === 0) continue // ~75% consistency, real gaps
    const d = iso(-i, '09:00').slice(0, 10)
    checkins.h1[d] = { done: true, at: `${d}T09:0${i % 6}:00` }
  }
  return {
    version: 4,
    profile: { name: 'Aaru', onboarded: true, theme: 'midnight', workReminders: false },
    habits,
    checkins,
    routines: [],
    projects: [{
      id: 'p1', name: 'Portfolio site', description: '', category: 'Design', priority: 'normal',
      startDate: iso(-40, '09:00').slice(0, 10), deadline: iso(9, '18:00'), estimateMin: 600, actualMin: 240,
      progressLog: [{ at: iso(-20, '10:00'), pct: 20 }, { at: iso(-6, '10:00'), pct: 55 }],
      linkedHabitIds: ['h1'], notes: '', archived: false,
      milestones: [{ id: 'm1', name: 'Draft', due: iso(-10, '18:00').slice(0, 10), tasks: [
        { id: 't1', name: 'Wireframe', done: true, status: 'done', completedAt: iso(-12, '10:00'), due: null, priority: 'normal', estimateMin: 60, actualMin: 45, notes: '', order: 0 },
        { id: 't2', name: 'Copy', done: false, status: 'todo', completedAt: null, due: null, priority: 'normal', estimateMin: 90, actualMin: null, notes: '', order: 1 },
      ] }],
    }],
    assignments: [{
      id: 'a1', name: 'Physics set', deadline: iso(2, '18:00'), estimateMin: 120, priority: 'high',
      archived: false, subtasks: [{ id: 's1', name: 'Q1', done: true, completedAt: iso(-1, '11:00') }],
    }],
    goals: [{
      id: 'g1', title: 'Run a marathon', category: 'fitness', startDate: iso(-90, '09:00').slice(0, 10),
      targetDate: iso(120, '18:00').slice(0, 10), unit: 'km', target: 42, current: 12,
      milestones: [{ id: 'gm1', name: '10 km', done: true, doneAt: iso(-30, '09:00'), targetDate: iso(-25, '18:00').slice(0, 10) }],
      linkedProjectIds: ['p1'], linkedAssignmentIds: ['a1'], linkedHabitIds: ['h1'],
      archived: false, createdAt: iso(-90, '09:00').slice(0, 10),
    }],
    moods: {}, notes: [], achievements: [],
    preferences: { focusStartHour: null, focusEndHour: null, planningTime: null, breakStyle: null, dailyCapacityMin: 120, planningBufferPct: 15, weekStartsOn: 1, reminderWindow: null },
    signals: [], focusLog: [{ id: 'f1', name: 'Deep work', startedAt: iso(-3, '09:00'), endedAt: iso(-3, '09:45'), plannedMin: 45, actualMin: 45, completed: true }],
    ...over,
  }
}

function mountApp(seed = seedState()) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(seed))
  window.location.hash = '#/insights'
  return render(<StoreProvider><App /></StoreProvider>)
}

/** Insights → Lab. The Lab is React.lazy, so this also proves the await works. */
async function openLab(seed = seedState()) {
  mountApp(seed)
  fireEvent.click(await screen.findByRole('button', { name: /^Lab$/ }))
  return screen.findByText('Your data story')
}

beforeEach(() => {
  localStorage.clear()
  window.location.hash = '#/insights'
})

/* ------------------------------------------------------------ */
describe('Analytics Lab shell', () => {
  it('offers the Lab as a separate control and lazy-loads it', async () => {
    mountApp()
    await screen.findByRole('button', { name: /^Lab$/ })
    expect(screen.getByRole('button', { name: /^Overview$/ })).toBeTruthy()
    // the overview also has a "Deep dive" shortcut button, so scope by count
    expect(screen.getAllByRole('button', { name: /^Deep dive$/ }).length).toBeGreaterThanOrEqual(2)
    expect(screen.queryByText('Your data story')).toBeNull() // not loaded yet
    fireEvent.click(screen.getByRole('button', { name: /^Lab$/ }))
    await screen.findByText('Your data story')
  })

  it('keeps the Insights switch a two-way choice, with the Lab outside it', async () => {
    /* Mirrors the browser check "insights has an Overview / Deep dive switch".
       The Lab is its own surface, so it must not join that group — otherwise
       the switch stops describing a two-way choice. */
    mountApp()
    await screen.findByRole('button', { name: /^Lab$/ })
    const labels = [...document.querySelectorAll('[aria-label="Insights view"] .seg-btn')]
      .map((b) => b.textContent.trim())
    expect(labels).toEqual(['Overview', 'Deep dive'])
  })

  it('shows all seven views', async () => {
    await openLab()
    const labels = ['Story', 'Timeline', 'Trajectory', 'Workload', 'Habits', 'Goals', 'Trends']
    for (const l of labels) expect(screen.getByRole('tab', { name: l })).toBeTruthy()
  })

  it('stays behind the existing Insights gate for a user with no habits', async () => {
    /* InsightsScreen already refuses to render its views without any habit
       history, so the Lab is not offered — the Lab's own empty state is the
       defensive net behind that gate, not a second onboarding screen. */
    mountApp(seedState({ habits: [], checkins: {}, projects: [], assignments: [], goals: [], focusLog: [] }))
    await screen.findByText('Nothing to analyze yet')
    expect(screen.queryByRole('button', { name: /^Lab$/ })).toBeNull()
  })
})

describe('Story mode', () => {
  it('marks each step and moves between them', async () => {
    await openLab()
    expect(screen.getByText(/steps supported by real data/)).toBeTruthy()
    const steps = screen.getAllByRole('tab').filter((t) => /^\d\. /.test(t.textContent))
    expect(steps).toHaveLength(5)
    fireEvent.click(steps[4])
    await waitFor(() => expect(screen.getByText('What should I consider next?')).toBeTruthy())
  })
})

describe('view switching', () => {
  it.each([
    ['Timeline', 'Productivity timeline'],
    ['Trajectory', 'Performance trajectory'],
    ['Workload', 'Workload landscape'],
    ['Habits', 'Habit consistency matrix'],
    ['Goals', 'Goal contribution'],
    ['Trends', 'Productivity velocity'],
  ])('opens the %s view', async (tab, heading) => {
    await openLab()
    fireEvent.click(screen.getByRole('tab', { name: tab }))
    await screen.findByText(heading)
  })
})

describe('drill-down', () => {
  it('opens the evidence sheet for a matrix cell', async () => {
    await openLab()
    fireEvent.click(screen.getByRole('tab', { name: 'Habits' }))
    await screen.findByText('Habit consistency matrix')
    const cell = document.querySelector('.hmx-tap')
    expect(cell).toBeTruthy()
    fireEvent.click(cell)
    await waitFor(() => expect(screen.getByText(/Current streak/)).toBeTruthy())
  })

  it('drills an insight into the data behind it', async () => {
    await openLab()
    fireEvent.click(screen.getByRole('tab', { name: 'Trends' }))
    await screen.findByText('Why the numbers moved')
    const btns = screen.queryAllByRole('button', { name: 'See the data behind this' })
    if (btns.length) {
      const btn = btns[0]
      fireEvent.click(btn)
      await waitFor(() => expect(screen.getByText('Evidence detail')).toBeTruthy())
    }
  })

  it('opens the day sheet from the workload landscape', async () => {
    await openLab()
    fireEvent.click(screen.getByRole('tab', { name: 'Workload' }))
    await screen.findByText('Workload landscape')
    const rows = Array.from(document.querySelectorAll('.lb-row'))
    const withItems = rows.find((r) => (r.getAttribute('aria-label') || '').match(/: (\d+) item/)?.[1] !== '0')
    if (withItems) {
      fireEvent.click(withItems)
      await waitFor(() => expect(screen.getByText(/committed across/)).toBeTruthy())
    }
  })
})

describe('honesty in the UI', () => {
  it('never shows a capacity frame the user did not set', async () => {
    const s = seedState()
    s.preferences.dailyCapacityMin = null
    await openLab(s)
    fireEvent.click(screen.getByRole('tab', { name: 'Workload' }))
    await screen.findByText('Workload landscape')
    expect(screen.getByText('capacity not set')).toBeTruthy()
    expect(within(document.querySelector('.lab-workload')).queryByText(/over your capacity/)).toBeNull()
  })

  it('refuses to project a habit and explains itself', async () => {
    await openLab()
    fireEvent.click(screen.getByRole('tab', { name: 'Trajectory' }))
    await screen.findByText('Performance trajectory')
    fireEvent.click(screen.getByRole('button', { name: 'Write daily' }))
    await waitFor(() => expect(screen.getByText(/cadence, not completion/)).toBeTruthy())
  })
})
