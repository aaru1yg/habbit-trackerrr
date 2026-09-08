/* ============================================================
   PHASE 5 — the Habits experience, driven through the real app.

   Covers the §39 matrix: canonical + legacy routes, the four
   workspace views, detail, completion, editing, pause/resume,
   archive, deletion, missed logging, filters, empty state, the
   mobile structure, accessible calendar cells, pattern display
   (with and without enough data) and Omni habit creation.

   Everything is mounted through <App/> with a persisted fixture,
   so the tests exercise the same reducers, engines and providers
   the shipped product uses.
   ============================================================ */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within, cleanup } from '@testing-library/react'
import { StoreProvider, STORAGE_KEY } from '../src/store.jsx'
import App from '../src/App.jsx'
import { todayStr, subDaysStr } from '../src/lib/dates.js'
import { describeHabit, matchesFilter, filterCounts, habitsSummary, recentMiss } from '../src/components/habits/habitRowModel.js'
import { patternCards, NOT_ENOUGH } from '../src/components/habits/habitPatternsView.js'
import { habitPatterns } from '../src/lib/habitPatterns.js'
import { canonicalParent, legacyRoute } from '../src/lib/router.jsx'

const today = todayStr()
const ago = (n) => subDaysStr(today, n)
const habit = (id, name, over = {}) => ({
  id, name, category: 'fitness', schedule: { type: 'daily' }, reminder: null, notes: '',
  createdAt: ago(90), archived: false, pause: null, skips: [], order: 0, ...over,
})
/** done on every day in [from..to] except those listed in `skip` */
const dones = (from, to, skip = []) => {
  const out = {}
  for (let i = from; i >= to; i--) if (!skip.includes(i)) out[ago(i)] = { done: true, at: `${ago(i)}T07:30` }
  return out
}

function seed(over = {}) {
  return {
    version: 4,
    profile: { name: 'Aaru', onboarded: true, theme: 'midnight' },
    habits: [
      habit('h-run', 'Morning run', { order: 0 }),
      habit('h-read', 'Read 20 pages', { order: 1, category: 'learning' }),
      habit('h-old', 'Cold shower', { order: 2, archived: true }),
    ],
    checkins: { 'h-run': dones(30, 1, [1]), 'h-read': dones(30, 1) },
    routines: [{ id: 'r1', name: 'Morning reset', kind: 'morning', habitIds: ['h-run', 'h-read'], active: true, order: 0 }],
    projects: [], assignments: [], goals: [], moods: {}, notes: [], achievements: [],
    preferences: { weekStartsOn: 1 }, signals: [], focusLog: [],
    ...over,
  }
}

const stored = () => JSON.parse(localStorage.getItem(STORAGE_KEY))

function mount(s = seed(), hash = '#/habits') {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
  window.location.hash = hash
  return render(<StoreProvider><App /></StoreProvider>)
}

const habitsList = async () => screen.findByRole('list', { name: 'Habits' })
const rowFor = async (name) => {
  const list = await habitsList()
  return within(list).getByText(name).closest('li')
}

beforeEach(() => {
  localStorage.clear()
  window.location.hash = ''
})
afterEach(() => cleanup())

/* ============================================================
   Routes
   ============================================================ */
describe('habits routes', () => {
  it('#/habits is the canonical workspace with Active selected', async () => {
    mount()
    expect(await screen.findByRole('heading', { level: 1, name: 'Habits' })).toBeTruthy()
    const tabs = screen.getByRole('navigation', { name: 'Habit sections' })
    expect(within(tabs).getAllByRole('link').map((a) => a.textContent)).toEqual(['Active', 'Routines', 'Calendar', 'Week'])
    expect(within(tabs).getByRole('link', { name: 'Active' }).getAttribute('aria-current')).toBe('page')
    await habitsList()
  })

  it('the legacy library route still renders the workspace', async () => {
    mount(seed(), '#/library')
    expect(await screen.findByRole('heading', { level: 1, name: 'Habits' })).toBeTruthy()
    await habitsList()
    expect(canonicalParent('library')).toBe('habits')
    expect(legacyRoute('library')).toBe('habits')
  })

  it('#/habits?view=calendar and legacy #/calendar render the same matrix', async () => {
    const { unmount } = mount(seed(), '#/habits?view=calendar')
    expect(await screen.findByRole('heading', { level: 1, name: 'Calendar' })).toBeTruthy()
    await waitFor(() => expect(document.querySelector('#calendar-screen .cal-grid')).toBeTruthy())
    expect(screen.getByRole('link', { name: 'Calendar' }).getAttribute('aria-current')).toBe('page')
    unmount()
    mount(seed(), '#/calendar')
    expect(await screen.findByRole('heading', { level: 1, name: 'Calendar' })).toBeTruthy()
    await waitFor(() => expect(document.querySelector('#calendar-screen .cal-grid')).toBeTruthy())
  })

  it('#/habits?view=week and legacy #/week render the week review', async () => {
    const { unmount } = mount(seed(), '#/habits?view=week')
    expect(await screen.findByRole('heading', { level: 1, name: 'Week review' })).toBeTruthy()
    await screen.findByText(/By habit/)
    unmount()
    mount(seed(), '#/week')
    expect(await screen.findByRole('heading', { level: 1, name: 'Week review' })).toBeTruthy()
    await screen.findByText(/By habit/)
  })

  it('#/habits?view=routines shows routines with their stacked habits', async () => {
    mount(seed(), '#/habits?view=routines')
    const card = await screen.findByRole('article', { name: 'Routine Morning reset' })
    const steps = within(card).getByRole('list', { name: 'Morning reset habits' })
    expect(within(steps).getAllByRole('listitem')).toHaveLength(2)
    expect(screen.getByRole('link', { name: 'Routines' }).getAttribute('aria-current')).toBe('page')
  })

  it('#/habits/:id opens the detail page in the spec hierarchy', async () => {
    mount(seed(), '#/habits/h-run')
    expect(await screen.findByRole('heading', { level: 1, name: /Morning run/ })).toBeTruthy()
    const names = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)
    const order = ['Today', 'Consistency', 'History', 'Patterns', 'Schedule', 'Manage'].map((n) => names.indexOf(n))
    expect(order.every((i) => i >= 0)).toBe(true)
    expect([...order].sort((a, b) => a - b)).toEqual(order)
    expect(screen.getByRole('img', { name: 'Morning run consistency heatmap' })).toBeTruthy()
    expect(document.querySelector('.habit-facts')).toBeTruthy()
    expect(document.querySelector('.streak-list')).toBeTruthy()
  })
})

/* ============================================================
   Active view — rows, completion, filters, missed logging
   ============================================================ */
describe('active habits', () => {
  it('a row reads name → status → schedule → streak → actions', async () => {
    mount()
    const row = await rowFor('Read 20 pages')
    expect(within(row).getByRole('link', { name: 'Open Read 20 pages' })).toBeTruthy()
    expect(row.getAttribute('data-status')).toBe('today')
    expect(within(row).getByText('Today')).toBeTruthy()
    expect(within(row).getByText(/Every day/)).toBeTruthy()
    expect(row.querySelector('.hrow-streak').textContent).toMatch(/^\s*\d+d streak/)
    expect(within(row).getByRole('button', { name: 'Mark Read 20 pages complete' })).toBeTruthy()
    expect(within(row).getByRole('button', { name: 'More actions for Read 20 pages' })).toBeTruthy()
  })

  it('Complete toggles the same check-in Today uses and reports COMPLETED', async () => {
    mount()
    const row = await rowFor('Read 20 pages')
    fireEvent.click(within(row).getByRole('button', { name: 'Mark Read 20 pages complete' }))
    await waitFor(() => expect(stored().checkins['h-read'][today]?.done).toBe(true))
    const done = await rowFor('Read 20 pages')
    expect(done.getAttribute('data-status')).toBe('completed')
    const btn = within(done).getByRole('button', { name: 'Mark Read 20 pages not done' })
    expect(btn.getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(btn)
    // un-completing removes the empty check-in entirely (existing reducer behaviour)
    await waitFor(() => expect(stored().checkins['h-read'][today]?.done).toBeFalsy())
    expect((await rowFor('Read 20 pages')).getAttribute('data-status')).toBe('today')
  })

  it('a recent miss is logged inline instead of on a separate card', async () => {
    mount()
    const row = await rowFor('Morning run')
    expect(within(row).getByText(/^Missed /)).toBeTruthy()
    fireEvent.click(within(row).getAllByRole('button', { name: /^Log Morning run for/ })[0])
    await waitFor(() => expect(stored().checkins['h-run'][ago(1)]?.done).toBe(true))
    expect(within(await rowFor('Morning run')).queryByText(/^Missed /)).toBeNull()
  })

  it('filters: All / Today / Needs attention / Active / Paused / Archived', async () => {
    mount(seed({ habits: [...seed().habits, habit('h-p', 'Stretch', { order: 3, pause: { from: ago(1), until: ago(-6) } })] }))
    await habitsList()
    const filters = screen.getByRole('group', { name: 'Habit filters' })
    const pressed = (label) => within(filters).getByRole('button', { name: new RegExp(`^${label}`) })
    expect(within(filters).getAllByRole('button').map((b) => b.textContent.replace(/\d+$/, ''))).toEqual(['All', 'Today', 'Needs attention', 'Active', 'Paused', 'Archived'])

    fireEvent.click(pressed('Archived'))
    expect(within(await habitsList()).getAllByRole('listitem').map((li) => li.dataset.habit)).toEqual(['h-old'])
    fireEvent.click(pressed('Paused'))
    expect(within(await habitsList()).getAllByRole('listitem').map((li) => li.dataset.habit)).toEqual(['h-p'])
    // missed yesterday (h-run) + a 30-day streak still open today (h-read)
    fireEvent.click(pressed('Needs attention'))
    expect(within(await habitsList()).getAllByRole('listitem').map((li) => li.dataset.habit)).toEqual(['h-run', 'h-read'])
    fireEvent.click(within(await habitsList()).getByRole('button', { name: 'Mark Read 20 pages complete' }))
    await waitFor(() => expect(within(screen.getByRole('list', { name: 'Habits' })).getAllByRole('listitem').map((li) => li.dataset.habit)).toEqual(['h-run']))
    fireEvent.click(pressed('Active'))
    expect(within(await habitsList()).getAllByRole('listitem').map((li) => li.dataset.habit)).toEqual(['h-run', 'h-read'])
    fireEvent.click(pressed('All'))
    expect(within(await habitsList()).getAllByRole('listitem')).toHaveLength(3)
  })

  it('paused habits are quieter and resume in one tap', async () => {
    mount(seed({ habits: [habit('h-p', 'Stretch', { pause: { from: ago(1), until: ago(-6) } })], checkins: {}, routines: [] }))
    const row = await rowFor('Stretch')
    expect(row.getAttribute('data-status')).toBe('paused')
    expect(row.classList.contains('is-paused')).toBe(true)
    expect(within(row).queryByRole('button', { name: /Mark Stretch/ })).toBeNull()
    fireEvent.click(within(row).getByRole('button', { name: 'Resume Stretch' }))
    await waitFor(() => expect(stored().habits.find((h) => h.id === 'h-p').pause).toBeNull())
    expect((await rowFor('Stretch')).getAttribute('data-status')).toBe('today')
  })

  it('the "⋯" sheet pauses, archives and deletes (delete is confirmed, then undoable)', async () => {
    mount()
    let row = await rowFor('Read 20 pages')
    fireEvent.click(within(row).getByRole('button', { name: 'More actions for Read 20 pages' }))
    let sheet = await screen.findByRole('dialog', { name: 'Read 20 pages' })
    fireEvent.click(within(sheet).getByRole('button', { name: /Pause for a week/ }))
    await waitFor(() => expect(stored().habits.find((h) => h.id === 'h-read').pause?.from).toBe(today))

    row = await rowFor('Read 20 pages')
    fireEvent.click(within(row).getByRole('button', { name: 'More actions for Read 20 pages' }))
    sheet = await screen.findByRole('dialog', { name: 'Read 20 pages' })
    fireEvent.click(within(sheet).getByRole('button', { name: 'Archive' }))
    await waitFor(() => expect(stored().habits.find((h) => h.id === 'h-read').archived).toBe(true))
    await waitFor(() => expect(within(screen.getByRole('list', { name: 'Habits' })).queryByText('Read 20 pages')).toBeNull())

    row = await rowFor('Morning run')
    fireEvent.click(within(row).getByRole('button', { name: 'More actions for Morning run' }))
    sheet = await screen.findByRole('dialog', { name: 'Morning run' })
    fireEvent.click(within(sheet).getByRole('button', { name: 'Delete' }))
    expect(stored().habits.some((h) => h.id === 'h-run')).toBe(true) // not yet
    expect(within(sheet).getByRole('alert')).toBeTruthy()
    fireEvent.click(within(sheet).getByRole('button', { name: 'Confirm delete' }))
    await waitFor(() => expect(stored().habits.some((h) => h.id === 'h-run')).toBe(false))
    expect(stored().checkins['h-run']).toBeUndefined()
    fireEvent.click(await screen.findByRole('button', { name: 'Undo' }))
    await waitFor(() => expect(stored().habits.some((h) => h.id === 'h-run')).toBe(true))
    expect(Object.keys(stored().checkins['h-run']).length).toBeGreaterThan(20)
  })

  it('New habit opens the shared HabitForm and editing preserves schedule + reminder', async () => {
    mount()
    await habitsList()
    fireEvent.click(screen.getByRole('button', { name: 'New habit' }))
    const form = await screen.findByRole('dialog', { name: 'New habit' })
    fireEvent.change(within(form).getByLabelText(/^Name/i), { target: { value: 'Journal' } })
    fireEvent.click(within(form).getByRole('button', { name: /Add habit/i }))
    await waitFor(() => expect(stored().habits.some((h) => h.name === 'Journal')).toBe(true))
    await rowFor('Journal')

    const row = await rowFor('Journal')
    fireEvent.click(within(row).getByRole('button', { name: 'More actions for Journal' }))
    fireEvent.click(within(await screen.findByRole('dialog', { name: 'Journal' })).getByRole('button', { name: 'Edit' }))
    const edit = await screen.findByRole('dialog', { name: 'Edit habit' })
    fireEvent.change(within(edit).getByLabelText(/^Name/i), { target: { value: 'Evening journal' } })
    fireEvent.click(within(edit).getByRole('button', { name: /Specific days/i }))
    fireEvent.change(within(edit).getByLabelText(/Reminder/i), { target: { value: '21:00' } })
    fireEvent.click(within(edit).getByRole('button', { name: /Save changes|Save/i }))
    await waitFor(() => {
      const h = stored().habits.find((x) => x.name === 'Evening journal')
      expect(h).toBeTruthy()
      expect(h.schedule.type).toBe('weekdays')
      expect(h.reminder).toBe('21:00')
    })
    expect(within(await rowFor('Evening journal')).getByText(/21:00/)).toBeTruthy()
  })

  it('the empty state offers exactly one way in and no charts', async () => {
    mount(seed({ habits: [], checkins: {}, routines: [] }))
    expect(await screen.findByText("You don't have any habits yet.")).toBeTruthy()
    expect(screen.getByText('No habits yet')).toBeTruthy()
    expect(screen.queryByRole('group', { name: 'Habit filters' })).toBeNull()
    expect(document.querySelector('.heatmap, .cal-grid, svg.chart')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Create habit/ }))
    await screen.findByRole('dialog', { name: 'New habit' })
  })
})

/* ============================================================
   Routines
   ============================================================ */
describe('routines', () => {
  it('ticks a routine step through the ordinary check-in and shows grouped progress', async () => {
    mount(seed(), '#/habits?view=routines')
    const card = await screen.findByRole('article', { name: 'Routine Morning reset' })
    expect(within(card).getByText('0/2 today')).toBeTruthy()
    fireEvent.click(within(card).getByRole('button', { name: 'Mark Morning run done in Morning reset' }))
    await waitFor(() => expect(stored().checkins['h-run'][today]?.done).toBe(true))
    expect(within(card).getByText('1/2 today')).toBeTruthy()
    expect(within(card).getByRole('button', { name: 'Mark Morning run not done in Morning reset' }).getAttribute('aria-pressed')).toBe('true')
  })

  it('creates, reorders, edits, archives and deletes routines with the existing reducer', async () => {
    mount(seed(), '#/habits?view=routines')
    await screen.findByRole('article', { name: 'Routine Morning reset' })
    fireEvent.click(screen.getByRole('button', { name: 'New routine' }))
    const form = await screen.findByRole('dialog', { name: 'New routine' })
    fireEvent.change(within(form).getByLabelText('Routine name'), { target: { value: 'Wind down' } })
    fireEvent.click(within(form).getByRole('button', { name: 'Read 20 pages' }))
    fireEvent.click(within(form).getByRole('button', { name: 'Create routine' }))
    await waitFor(() => expect(stored().routines.map((r) => r.name)).toEqual(['Morning reset', 'Wind down']))

    const wind = await screen.findByRole('article', { name: 'Routine Wind down' })
    fireEvent.click(within(wind).getByRole('button', { name: 'Move Wind down up' }))
    await waitFor(() => expect(stored().routines.sort((a, b) => a.order - b.order).map((r) => r.name)).toEqual(['Wind down', 'Morning reset']))

    fireEvent.click(within(wind).getByRole('button', { name: 'Edit routine Wind down' }))
    const edit = await screen.findByRole('dialog', { name: 'Edit routine' })
    fireEvent.change(within(edit).getByLabelText('Routine name'), { target: { value: 'Night wind down' } })
    fireEvent.click(within(edit).getByRole('button', { name: 'Save routine' }))
    await waitFor(() => expect(stored().routines.some((r) => r.name === 'Night wind down')).toBe(true))

    const renamed = await screen.findByRole('article', { name: 'Routine Night wind down' })
    fireEvent.click(within(renamed).getByRole('button', { name: 'Archive' }))
    await waitFor(() => expect(stored().routines.find((r) => r.name === 'Night wind down').active).toBe(false))

    const morning = screen.getByRole('article', { name: 'Routine Morning reset' })
    fireEvent.click(within(morning).getByRole('button', { name: 'Delete routine Morning reset' }))
    await waitFor(() => expect(stored().routines.some((r) => r.name === 'Morning reset')).toBe(false))
    fireEvent.click(await screen.findByRole('button', { name: 'Undo' }))
    await waitFor(() => expect(stored().routines.some((r) => r.name === 'Morning reset')).toBe(true))
  })
})

/* ============================================================
   Calendar + week
   ============================================================ */
describe('calendar and week review', () => {
  it('calendar cells are labelled buttons with pressed state; a past tap logs the day', async () => {
    mount(seed(), '#/habits?view=calendar')
    await screen.findByRole('heading', { level: 1, name: 'Calendar' })
    const d = new Date(); d.setDate(d.getDate() - 1)
    const label = `Mark done: Morning run, ${d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}`
    const cell = await screen.findByRole('button', { name: label })
    expect(cell.getAttribute('aria-pressed')).toBe('false')
    expect(cell.classList.contains('missed')).toBe(true)
    fireEvent.click(cell)
    await waitFor(() => expect(stored().checkins['h-run'][ago(1)]?.done).toBe(true))
    expect(screen.getByRole('button', { name: label.replace('Mark done', 'Mark not done') }).getAttribute('aria-pressed')).toBe('true')
    // no work deadlines in the habit calendar
    expect(document.querySelector('.cal-marks')).toBeNull()
    expect(screen.queryByText(/Deadlines in this view/)).toBeNull()
    // range modes + navigation preserved
    expect(document.querySelectorAll('#calendar-screen .seg-btn')).toHaveLength(3)
    expect(screen.getByRole('button', { name: 'Previous range' })).toBeTruthy()
  })

  it('week review shows completion, delta, strongest/weakest and logs a missed day', async () => {
    mount(seed(), '#/habits?view=week')
    await screen.findByText(/By habit/)
    const p = screen.getByText((_, e) => e?.tagName === 'P' && /^\d+ of \d+ check-ins$/.test(e.textContent || ''))
    expect(p).toBeTruthy()
    expect(document.body.textContent).toMatch(/previous week/i)
    expect(screen.queryByText(/Due this week|Deadlines that week/)).toBeNull()
    const missed = screen.queryByRole('list', { name: 'Missed days you can still log' })
    if (missed) {
      const before = Object.values(stored().checkins['h-run']).filter((c) => c.done).length
      fireEvent.click(within(missed).getAllByRole('button')[0])
      await waitFor(() => expect(Object.values(stored().checkins['h-run']).filter((c) => c.done).length).toBe(before + 1))
    }
  })
})

/* ============================================================
   Detail — patterns
   ============================================================ */
describe('habit detail patterns', () => {
  it('renders Observation → Evidence → Implication from habitPatterns only', async () => {
    mount(seed(), '#/habits/h-read')
    await screen.findByRole('heading', { level: 2, name: 'Patterns' })
    const engine = habitPatterns(stored(), stored().habits.find((h) => h.id === 'h-read'))
    const cards = patternCards(engine, 'Read 20 pages')
    expect(cards.length).toBeGreaterThan(0)
    for (const c of cards) {
      const el = document.querySelector(`.pattern[data-pattern="${c.id}"]`)
      expect(el).toBeTruthy()
      expect(within(el).getByText('Evidence')).toBeTruthy()
      expect(within(el).getByText('Implication')).toBeTruthy()
      expect(el.textContent).toContain(c.evidence)
    }
    expect(screen.queryByText(new RegExp(NOT_ENOUGH))).toBeNull()
  })

  it('says "Not enough data yet." once when a habit is too young', async () => {
    mount(seed({ habits: [habit('h-new', 'Brand new', { createdAt: today })], checkins: {}, routines: [] }), '#/habits/h-new')
    await screen.findByRole('heading', { level: 2, name: 'Patterns' })
    expect(document.querySelectorAll('.pattern')).toHaveLength(0)
    expect(screen.getAllByText(new RegExp(NOT_ENOUGH))).toHaveLength(1)
  })

  it('detail exposes Complete, Pause and a confirmed Delete', async () => {
    mount(seed(), '#/habits/h-read')
    fireEvent.click(await screen.findByRole('button', { name: 'Mark Read 20 pages complete' }))
    await waitFor(() => expect(stored().checkins['h-read'][today]?.done).toBe(true))
    expect(screen.getByRole('button', { name: 'Mark Read 20 pages not done' }).getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: 'Pause for a week' }))
    await waitFor(() => expect(stored().habits.find((h) => h.id === 'h-read').pause?.from).toBe(today))
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Resume' }).length).toBeGreaterThan(0))
    fireEvent.click(screen.getByRole('button', { name: /^Delete$/ }))
    expect(stored().habits.some((h) => h.id === 'h-read')).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: /Delete for good/ }))
    await waitFor(() => expect(stored().habits.some((h) => h.id === 'h-read')).toBe(false))
    await waitFor(() => expect(window.location.hash).toBe('#/habits'))
  })
})

/* ============================================================
   Mobile structure + Omni creation
   ============================================================ */
describe('mobile structure and Omni', () => {
  it('above the fold: title, summary line, tabs, then rows with the primary action', async () => {
    mount()
    const screenEl = document.querySelector('#habits-screen')
    await habitsList()
    const kids = [...screenEl.children].map((el) => el.className.split(' ')[0])
    expect(kids.slice(0, 3)).toEqual(['screen-head', 'habit-tabs', 'habits-body'])
    expect(screenEl.querySelector('.screen-sub').textContent).toMatch(/^2 active habits · \d of 2 done today/)
    expect(document.querySelector('.hrow .hrow-complete')).toBeTruthy()
    // bottom nav still has the five pillars
    const nav = document.querySelector('.bottom-nav')
    expect(within(nav).getAllByRole('link')).toHaveLength(5)
  })

  it('Omni "Run every morning" is parsed as a habit, confirmed, then created once', async () => {
    mount(seed(), '#/today')
    fireEvent.keyDown(window, { key: 'k', metaKey: true })
    const input = await screen.findByLabelText('What do you need to do?')
    fireEvent.change(input, { target: { value: 'Run every morning' } })
    const palette = within(document.querySelector('[role="dialog"]'))
    await palette.findByText(/Detected: Habit/)
    const before = stored().habits.length
    fireEvent.click(screen.getByRole('button', { name: 'Review' }))
    await screen.findByRole('button', { name: /Create/ })
    expect(stored().habits.length).toBe(before)
    fireEvent.click(screen.getByRole('button', { name: /Create/ }))
    await waitFor(() => expect(stored().habits.length).toBe(before + 1))
    expect(stored().habits.at(-1).name).toBe('Run every morning')
  })
})

/* ============================================================
   Row model — pure
   ============================================================ */
describe('habit row model', () => {
  const s = seed()
  it('names the six states from existing engine facts', () => {
    const run = describeHabit(s, s.habits[0], today)
    expect(run.status.id).toBe('today')
    expect(run.miss?.date).toBe(ago(1))
    expect(describeHabit(s, s.habits[2], today).status.id).toBe('archived')
    const paused = describeHabit(s, habit('p', 'P', { pause: { from: ago(1), until: null } }), today)
    expect(paused.status.id).toBe('paused')
    const off = describeHabit({ ...s, checkins: {} }, habit('o', 'O', { schedule: { type: 'dates', dates: [ago(-3)] } }), today)
    expect(off.status.id).toBe('not-scheduled')
    const doneState = { ...s, checkins: { ...s.checkins, 'h-read': { ...s.checkins['h-read'], [today]: { done: true } } } }
    expect(describeHabit(doneState, s.habits[1], today).status.id).toBe('completed')
    const missedOnly = describeHabit({ ...s, checkins: {} }, habit('m', 'M', { schedule: { type: 'weekdays', days: [new Date(`${ago(1)}T12:00:00`).getDay()] } }), today)
    expect(['missed', 'today']).toContain(missedOnly.status.id)
  })

  it('skipped days are not misses', () => {
    const h = habit('k', 'K', { skips: [ago(1), ago(2), ago(3)] })
    expect(recentMiss({ checkins: {} }, h, today)).toBeNull()
  })

  it('filters and counts agree with the summary line', () => {
    const rows = s.habits.map((h) => describeHabit(s, h, today))
    const counts = filterCounts(rows)
    expect(counts.all).toBe(2)
    expect(counts.archived).toBe(1)
    expect(rows.filter((r) => matchesFilter(r, 'attention')).map((r) => r.habit.id)).toEqual(['h-run', 'h-read'])
    expect(rows[1].atRisk).toBe(true)
    expect(habitsSummary(rows)).toBe('2 active habits · 0 of 2 done today')
  })
})

/* ============================================================
   Insights pattern line — same habitPatterns contract as the detail page
   ============================================================ */
describe('insights habit patterns', () => {
  it('prints the previous-period rate as a number, never an object', async () => {
    // 60 days of history: 2 of every 3 days done → trend is comparable
    const ck = {}
    for (let i = 1; i <= 60; i++) if (i % 3) ck[ago(i)] = { done: true, at: `${ago(i)}T07:30` }
    mount(seed({ habits: [habit('h-long', 'Long habit')], checkins: { 'h-long': ck }, routines: [] }), '#/insights')
    await screen.findByRole('heading', { level: 1, name: 'Insights' })
    await waitFor(() => expect(document.querySelector('.habit-pattern-row')).toBeTruthy())
    const line = within(document.querySelector('.habit-pattern-row')).getByText(/previously/).textContent
    expect(line).toMatch(/^(improving|declining|stable) · \d+% vs \d+% previously$/)
    expect(document.body.textContent).not.toMatch(/\[object Object\]|NaN|undefined/)
  })
})
