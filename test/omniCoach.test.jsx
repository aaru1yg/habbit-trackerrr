/* ============================================================
   V5 OMNI — the Coach tab answers the query deterministically.
   Mounted through the real app: ⌘K, click Coach, type a question.
   ============================================================ */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { StoreProvider, STORAGE_KEY } from '../src/store.jsx'
import App from '../src/App.jsx'

const DAY = 86400000
const iso = (offsetDays, hhmm = '17:00') =>
  new Date(Date.now() + offsetDays * DAY).toISOString().slice(0, 10) + 'T' + hhmm
const day = (offsetDays) => new Date(Date.now() + offsetDays * DAY).toISOString().slice(0, 10)

function seed(over = {}) {
  return {
    version: 4,
    profile: { name: 'Aaru', onboarded: true, theme: 'midnight', workReminders: false },
    habits: [],
    checkins: {},
    routines: [],
    projects: [{
      id: 'p1', name: 'Habit OS', description: '', category: 'Build', priority: 'normal',
      startDate: day(-30), deadline: iso(10), estimateMin: 600, actualMin: 0, progressLog: [],
      linkedHabitIds: [], notes: '', archived: false, milestones: [],
    }],
    assignments: [{
      id: 'a1', name: 'DSA Chapter 4', subject: 'DSA', deadline: iso(3),
      estimateMin: 120, actualMin: 0, progress: 0, subtasks: [], notes: '',
      status: 'active', archived: false,
    }],
    goals: [], moods: {}, notes: [], achievements: [],
    preferences: { focusStartHour: null, focusEndHour: null, planningTime: null, breakStyle: null, dailyCapacityMin: 120, planningBufferPct: 15, weekStartsOn: 1, reminderWindow: null },
    signals: [], focusLog: [],
    ...over,
  }
}

function mount(s = seed()) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
  window.location.hash = '#/today'
  return render(<StoreProvider><App /></StoreProvider>)
}

async function openPalette() {
  fireEvent.keyDown(window, { key: 'k', metaKey: true })
  return screen.findByLabelText('What do you need to do?')
}

const palette = () => within(document.querySelector('[role="dialog"]'))

beforeEach(() => {
  localStorage.clear()
  window.location.hash = '#/today'
  vi.stubGlobal('matchMedia', window.matchMedia || ((q) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} })))
})

describe('omni coach mode', () => {
  it('offers a Coach tab with guidance + examples when the query is empty', async () => {
    mount()
    await openPalette()
    fireEvent.click(palette().getByRole('tab', { name: 'Coach' }))
    expect(palette().getByRole('tabpanel', { name: 'Coach' })).toBeTruthy()
    expect(palette().getByText(/Try asking about your priorities/)).toBeTruthy()
    expect(palette().getByRole('button', { name: 'How is my workload?' })).toBeTruthy()
  })

  it('answers a workload question from real state and never flips to search', async () => {
    mount()
    await openPalette()
    fireEvent.click(palette().getByRole('tab', { name: 'Coach' }))
    fireEvent.change(screen.getByLabelText('What do you need to do?'), { target: { value: 'How is my workload?' } })
    const panel = palette().getByRole('tabpanel', { name: 'Coach' })
    expect(within(panel).getByText(/estimated remaining/)).toBeTruthy()
    expect(within(panel).getByText('1 open assignments')).toBeTruthy()
    expect(within(panel).getByText('1 active projects')).toBeTruthy()
    // No search-results listbox hijacks the coach answer.
    expect(palette().queryByRole('listbox', { name: 'Search results' })).toBeNull()
  })

  it('moves between tabs with the arrow keys (roving tabindex)', async () => {
    mount()
    await openPalette()
    const coach = palette().getByRole('tab', { name: 'Coach' })
    fireEvent.click(coach)
    fireEvent.keyDown(coach, { key: 'ArrowRight' })
    // Coach is last: ArrowRight wraps to Commands and moves focus with it.
    const commands = palette().getByRole('tab', { name: 'Commands' })
    expect(commands.getAttribute('aria-selected')).toBe('true')
    expect(document.activeElement).toBe(commands)
  })

  it('opens coach mode through the Ask Habit OS Coach command', async () => {
    mount()
    await openPalette()
    fireEvent.change(screen.getByLabelText('What do you need to do?'), { target: { value: 'coach' } })
    fireEvent.click(await palette().findByRole('option', { name: /Ask Habit OS Coach/ }))
    expect(palette().getByRole('tabpanel', { name: 'Coach' })).toBeTruthy()
    expect(palette().getByRole('tab', { name: 'Coach' }).getAttribute('aria-selected')).toBe('true')
  })
})

describe('app shell', () => {
  it('renders a skip link targeting the main landmark', () => {
    mount()
    const skip = screen.getByRole('link', { name: 'Skip to content' })
    expect(skip.getAttribute('href')).toBe('#content')
    expect(document.getElementById('content')?.tagName).toBe('MAIN')
  })
})
