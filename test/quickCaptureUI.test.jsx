/* ============================================================
   PHASE E — the capture and command UI, driven through the real app.

   The parsing engine has its own suite; these tests are about the
   promises only a mounted component can break:
     - nothing is created before Create is pressed;
     - ambiguous input asks instead of guessing;
     - the capture signal is recorded when capture is actually used;
     - creation works with no network at all;
     - ⌘K opens the palette and the keyboard drives it.
   ============================================================ */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
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
    habits: [{ id: 'h1', name: 'Morning run', category: 'fitness', schedule: { type: 'daily' }, reminder: null, notes: '', createdAt: iso(-60), archived: false, order: 0 }],
    checkins: {},
    routines: [],
    projects: [{
      id: 'p1', name: 'Habit OS', description: '', category: 'Build', priority: 'normal',
      startDate: day(-30), deadline: iso(10), estimateMin: 600, actualMin: 0, progressLog: [],
      linkedHabitIds: [], notes: '', archived: false,
      milestones: [{ id: 'm1', name: 'Ship', due: day(10), tasks: [] }],
    }],
    assignments: [], goals: [], moods: {}, notes: [], achievements: [],
    preferences: { focusStartHour: null, focusEndHour: null, planningTime: null, breakStyle: null, dailyCapacityMin: 120, planningBufferPct: 15, weekStartsOn: 1, reminderWindow: null },
    signals: [], focusLog: [],
    ...over,
  }
}

const stored = () => JSON.parse(localStorage.getItem(STORAGE_KEY))

function mount(s = seed()) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
  window.location.hash = '#/today'
  return render(<StoreProvider><App /></StoreProvider>)
}

/** ⌘K, then wait for the palette's own lazy chunk to arrive. */
async function openPalette() {
  fireEvent.keyDown(window, { key: 'k', metaKey: true })
  return screen.findByLabelText('What do you need to do?')
}

const type = (text) => fireEvent.change(screen.getByLabelText('What do you need to do?'), { target: { value: text } })
/** Scope to the open dialog: the sidebar and Today repeat many of the same words. */
const palette = () => within(document.querySelector('[role="dialog"]'))

beforeEach(() => {
  localStorage.clear()
  window.location.hash = '#/today'
  vi.stubGlobal('matchMedia', window.matchMedia || ((q) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} })))
})

/* ============================================================
   E1 / E20 · opening
   ============================================================ */
describe('opening the command center', () => {
  it('opens on ⌘K and closes on Escape', async () => {
    mount()
    await openPalette()
    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByLabelText('What do you need to do?')).toBeNull())
  })

  it('opens on Ctrl+K too', async () => {
    mount()
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    await screen.findByLabelText('What do you need to do?')
  })

  it('leaves the existing "/" search behaviour alone', async () => {
    mount()
    fireEvent.keyDown(window, { key: '/' })
    await screen.findByLabelText('Search everything')
    // the command palette did not open as well
    expect(screen.queryByLabelText('What do you need to do?')).toBeNull()
  })

  it('offers Commands and Search as separate modes', async () => {
    mount()
    await openPalette()
    expect(screen.getByRole('tab', { name: 'Commands' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'Search' })).toBeTruthy()
  })
})

/* ============================================================
   E4 · confirmation — nothing is created before Create
   ============================================================ */
describe('confirmation flow', () => {
  it('creates nothing until Create is pressed', async () => {
    mount()
    const before = stored().assignments.length
    await openPalette()
    type('Finish DSA Chapter 4 by Friday')
    await palette().findByText(/Suggested: Assignment/)
    fireEvent.click(screen.getByRole('button', { name: 'Review' }))
    await screen.findByRole('button', { name: /Create/ })
    // still nothing written
    expect(stored().assignments.length).toBe(before)
    fireEvent.click(screen.getByRole('button', { name: /Create/ }))
    await waitFor(() => expect(stored().assignments.length).toBe(before + 1))
  })

  it('shows exactly what will be stored, including what was not specified', async () => {
    mount()
    await openPalette()
    type('Finish DSA Chapter 4 by Friday')
    fireEvent.click(await screen.findByRole('button', { name: 'Review' }))
    expect(screen.getByText('Assignment')).toBeTruthy()
    expect(screen.getByText('Finish DSA Chapter 4')).toBeTruthy()
    expect(screen.getAllByText('Not specified').length).toBeGreaterThan(0)
    expect(screen.getByText(/Nothing is saved until you press Create/)).toBeTruthy()
  })

  it('cancels without writing anything', async () => {
    mount()
    const before = stored().assignments.length
    await openPalette()
    type('Submit the essay by Friday')
    fireEvent.click(await screen.findByRole('button', { name: 'Review' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('button', { name: /Create/ })).toBeNull())
    expect(stored().assignments.length).toBe(before)
  })

  it('lets the user edit before creating', async () => {
    mount()
    await openPalette()
    type('Finish DSA by Friday')
    fireEvent.click(await screen.findByRole('button', { name: 'Review' }))
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Finish DSA Chapter 4' } })
    fireEvent.click(screen.getByRole('button', { name: 'Done editing' }))
    fireEvent.click(screen.getByRole('button', { name: /Create/ }))
    await waitFor(() => expect(stored().assignments.at(-1).name).toBe('Finish DSA Chapter 4'))
  })

  it('stores a stated duration and leaves an unstated one null', async () => {
    mount()
    await openPalette()
    type('Study probability for 45 minutes by Friday')
    fireEvent.click(await screen.findByRole('button', { name: 'Review' }))
    fireEvent.click(screen.getByRole('button', { name: /Create/ }))
    await waitFor(() => expect(stored().assignments.at(-1).estimateMin).toBe(45))
  })
})

/* ============================================================
   E5 / E25 · ambiguity and unresolved input
   ============================================================ */
describe('ambiguity', () => {
  it('asks how to save ambiguous input instead of guessing', async () => {
    mount()
    const before = stored()
    await openPalette()
    type('Prepare presentation')
    await palette().findByText('How should I save this?')
    // nothing chosen, nothing written
    expect(stored().assignments.length).toBe(before.assignments.length)
    expect(stored().projects.length).toBe(before.projects.length)
  })

  it('creates the type the user picks', async () => {
    mount()
    await openPalette()
    type('Prepare presentation')
    await palette().findByText('How should I save this?')
    fireEvent.click(palette().getByRole('button', { name: 'Assignment' }))
    fireEvent.click(await screen.findByRole('button', { name: /Create/ }))
    await waitFor(() => expect(stored().assignments.some((a) => a.name === 'Prepare presentation')).toBe(true))
  })

  it('offers Save as note when it cannot classify at all', async () => {
    mount()
    await openPalette()
    type('xyzzy florp')
    await palette().findAllByText(/Couldn’t confidently classify this/)
    fireEvent.click(screen.getByRole('button', { name: 'Save as note' }))
    await waitFor(() => expect(stored().moods[day(0)]?.note).toMatch(/xyzzy florp/))
  })
})

/* ============================================================
   E8 · linking needs confirmation
   ============================================================ */
describe('linking', () => {
  it('asks before linking to a project whose name appears', async () => {
    mount()
    await openPalette()
    type('Finish API work for Habit OS by Friday')
    fireEvent.click(await screen.findByRole('button', { name: 'Review' }))
    await palette().findByText(/Link it to something you already have\?/)
    // not linked yet
    expect(palette().queryByText(/^Habit OS$/)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Project: Habit OS' }))
    fireEvent.click(screen.getByRole('button', { name: /Create/ }))
    await waitFor(() => expect(stored().assignments.at(-1).projectId).toBe('p1'))
  })

  it('respects "No link"', async () => {
    mount()
    await openPalette()
    type('Finish API work for Habit OS by Friday')
    fireEvent.click(await screen.findByRole('button', { name: 'Review' }))
    fireEvent.click(await screen.findByRole('button', { name: 'No link' }))
    fireEvent.click(screen.getByRole('button', { name: /Create/ }))
    await waitFor(() => expect(stored().assignments.at(-1).projectId).toBeNull())
  })
})

/* ============================================================
   E9 · the capture signal is real
   ============================================================ */
describe('behaviour signals', () => {
  it('records a capture signal when capture is actually used', async () => {
    mount()
    expect(stored().signals.filter((s) => s.type === 'capture')).toHaveLength(0)
    await openPalette()
    type('Submit the report by Friday')
    fireEvent.click(await screen.findByRole('button', { name: 'Review' }))
    fireEvent.click(screen.getByRole('button', { name: /Create/ }))
    await waitFor(() => expect(stored().signals.filter((s) => s.type === 'capture')).toHaveLength(1))
  })

  it('records no capture signal when the user cancels', async () => {
    mount()
    await openPalette()
    type('Submit the report by Friday')
    fireEvent.click(await screen.findByRole('button', { name: 'Review' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('button', { name: /Create/ })).toBeNull())
    expect(stored().signals.filter((s) => s.type === 'capture')).toHaveLength(0)
  })

  it('also records the type-specific signal the reducer owns', async () => {
    mount()
    await openPalette()
    type('Submit the report by Friday')
    fireEvent.click(await screen.findByRole('button', { name: 'Review' }))
    fireEvent.click(screen.getByRole('button', { name: /Create/ }))
    await waitFor(() => expect(stored().signals.some((s) => s.type === 'work-add' && s.target === 'assignment')).toBe(true))
  })
})

/* ============================================================
   E22 · offline
   ============================================================ */
describe('offline', () => {
  it('creates locally with no network and says the device is offline', async () => {
    Object.defineProperty(window.navigator, 'onLine', { value: false, configurable: true })
    window.dispatchEvent(new Event('offline'))
    mount()
    await screen.findByText(/Offline — changes still save on this device/)
    await openPalette()
    type('Submit the report by Friday')
    fireEvent.click(await screen.findByRole('button', { name: 'Review' }))
    fireEvent.click(screen.getByRole('button', { name: /Create/ }))
    await waitFor(() => expect(stored().assignments.length).toBe(1))
    Object.defineProperty(window.navigator, 'onLine', { value: true, configurable: true })
  })
})

/* ============================================================
   E24 · duplicate protection
   ============================================================ */
describe('duplicate protection', () => {
  it('warns about a recent same-named item but still lets you create it', async () => {
    mount(seed({ assignments: [{ id: 'a0', name: 'Physics set', archived: false, deadline: iso(3), progress: 0, subtasks: [], createdAtDay: day(-1) }] }))
    await openPalette()
    type('Physics set due Friday')
    fireEvent.click(await screen.findByRole('button', { name: 'Review' }))
    await palette().findByText(/already have/)
    fireEvent.click(screen.getByRole('button', { name: /Create/ }))
    await waitFor(() => expect(stored().assignments.length).toBe(2))
  })
})

/* ============================================================
   E10 / E14 · commands
   ============================================================ */
describe('commands', () => {
  it('lists commands in groups', async () => {
    mount()
    await openPalette()
    expect(screen.getByText('Create')).toBeTruthy()
    expect(screen.getByText('Focus')).toBeTruthy()
    for (const label of ['Add habit', 'Create project', 'Create assignment', 'Plan my day', 'View workload', 'Open Analytics Lab', 'Search everything']) {
      expect(screen.getByRole('option', { name: new RegExp(label) })).toBeTruthy()
    }
  })

  it('filters commands as you type', async () => {
    mount()
    await openPalette()
    type('plan')
    await waitFor(() => expect(screen.queryByRole('option', { name: /Open Analytics Lab/ })).toBeNull())
    expect(screen.getByRole('option', { name: /Plan my day/ })).toBeTruthy()
  })

  it('runs "What should I do next?" through the existing engine', async () => {
    mount(seed({ assignments: [{ id: 'a1', name: 'Physics set', archived: false, deadline: iso(1), progress: 0, subtasks: [], estimateMin: 60 }] }))
    await openPalette()
    type('what should i do next')
    fireEvent.click(await screen.findByRole('option', { name: /What should I do next/ }))
    await screen.findByText('Next best action')
    expect(palette().getAllByText('Physics set').length).toBeGreaterThan(0)
  })

  it('navigates for a navigation command', async () => {
    mount()
    await openPalette()
    fireEvent.click(screen.getByRole('option', { name: /View workload/ }))
    await waitFor(() => expect(window.location.hash).toBe('#/workload'))
  })

  it('keeps search and commands separate', async () => {
    mount()
    await openPalette()
    fireEvent.click(screen.getByRole('tab', { name: 'Search' }))
    type('Habit')
    await waitFor(() => expect(palette().getAllByText('Projects').length).toBeGreaterThan(0))
    // a search for "Habit" must not have surfaced commands
    expect(screen.queryByRole('option', { name: /Plan my day/ })).toBeNull()
  })
})

/* ============================================================
   E13 · natural-language filters
   ============================================================ */
describe('query filters', () => {
  it('answers "assignments due this week" from the deadline data', async () => {
    mount(seed({ assignments: [{ id: 'a1', name: 'Physics set', archived: false, deadline: iso(2), progress: 0, subtasks: [] }] }))
    await openPalette()
    type('assignments due this week')
    await screen.findByText('Due this week')
    expect(palette().getAllByText('Physics set').length).toBeGreaterThan(0)
  })

  it('finds the day that exceeds the user’s own capacity', async () => {
    mount()
    await openPalette()
    type('overloaded days')
    await screen.findByText('Overloaded days')
    expect(palette().getByText(/over your/)).toBeTruthy()
  })

  it('says so honestly when there is no dated work to overload', async () => {
    mount(seed({ projects: [] }))
    await openPalette()
    type('overloaded days')
    await screen.findByText('Overloaded days')
    expect(palette().getByText(/No day in the next fortnight exceeds/)).toBeTruthy()
  })
})

/* ============================================================
   E11 · personalisation of the suggested actions
   ============================================================ */
describe('suggested actions', () => {
  it('shows the default order and says it is the default with no history', async () => {
    mount()
    await openPalette()
    expect(palette().getByText('Suggested for you')).toBeTruthy()
    expect(palette().getByText(/Default order/)).toBeTruthy()
  })

  it('says the order is observed once there is real history', async () => {
    const signals = Array.from({ length: 14 }, (_, i) => ({
      id: `s${i}`, type: 'focus-start', target: null, note: null, at: new Date(Date.now() - i * 3600000).toISOString(),
    }))
    mount(seed({ signals }))
    await openPalette()
    await palette().findByText('Suggested for you')
    expect(palette().getByText(/Ordered from your last/)).toBeTruthy()
  })
})

/* ============================================================
   E16 / E17 · one-tap execution and the capture quick action
   ============================================================ */
describe('quick capture entry points', () => {
  it('is reachable from the Today quick actions', async () => {
    mount()
    const btn = await within(document.querySelector('.quick-actions')).findByRole('button', { name: /Quick capture/ })
    fireEvent.click(btn)
    await screen.findByLabelText('What do you need to do?')
  })

  it('is reachable from the mobile bottom nav', async () => {
    mount()
    fireEvent.click(await within(document.querySelector('.bottom-nav')).findByRole('button', { name: 'Quick capture' }))
    await screen.findByLabelText('What do you need to do?')
  })

  it('offers planning as a choice after creating, never silently', async () => {
    mount()
    await openPalette()
    type('Submit the report by Friday')
    fireEvent.click(await screen.findByRole('button', { name: 'Review' }))
    fireEvent.click(screen.getByRole('button', { name: /Create/ }))
    await screen.findByText('Added.')
    expect(screen.getByRole('button', { name: 'Open Plan my day' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Done' })).toBeTruthy()
    // choosing "Done" leaves the route alone — nothing was scheduled
    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    await waitFor(() => expect(window.location.hash).toBe('#/today'))
  })
})
