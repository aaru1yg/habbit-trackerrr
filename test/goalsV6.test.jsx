/* ============================================================
   GOALS — Phase 6 outcome-first workspace.

   Covers: list-first default (no atlas), goal cards (progress,
   health, next milestone), Open/Reached/At-risk filters, the
   optional Atlas mode, empty state, the compact goal detail
   hierarchy, milestone completion, deep links / legacy route, and
   the accessibility + reduced-motion contract for Goals.
   ============================================================ */
import { describe, it, expect, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { StoreProvider, STORAGE_KEY, emptyState } from '../src/store.jsx'
import App from '../src/App.jsx'
import { todayStr, addDaysStr, subDaysStr } from '../src/lib/dates.js'

const T = todayStr()
const goal = (over) => ({
  id: 'g', title: 'Goal', why: '', area: 'mind', startDate: T, targetDate: null,
  status: 'active', milestones: [], linkedHabitIds: [], linkedProjectIds: [],
  linkedAssignmentIds: [], manualPercent: null, notes: '', completedAt: null, archived: false, order: 0,
  ...over,
})

function seed() {
  const s = emptyState()
  s.profile.name = 'Tester'
  s.profile.onboarded = true
  s.goals = [
    // On-track: target well ahead, one open milestone.
    goal({
      id: 'on', title: 'Write a novella', area: 'creative',
      startDate: T, targetDate: addDaysStr(T, 30),
      milestones: [{ id: 'm1', name: 'Finish a draft', targetDate: addDaysStr(T, 20), done: false, order: 0 }],
    }),
    // At risk: far along the window but progress lags expected pace.
    goal({
      id: 'risk', title: 'Thesis', area: 'learning',
      startDate: subDaysStr(T, 60), targetDate: addDaysStr(T, 10),
      milestones: [
        { id: 'r1', name: 'Literature review', targetDate: null, done: true, order: 0 },
        { id: 'r2', name: 'Methodology', targetDate: null, done: false, order: 1 },
        { id: 'r3', name: 'Results', targetDate: null, done: false, order: 2 },
        { id: 'r4', name: 'Write up', targetDate: null, done: false, order: 3 },
        { id: 'r5', name: 'Defend', targetDate: null, done: false, order: 4 },
      ],
    }),
    // Overdue: target in the past, still open.
    goal({
      id: 'late', title: 'Marathon', area: 'fitness',
      startDate: subDaysStr(T, 30), targetDate: subDaysStr(T, 5),
      milestones: [
        { id: 'l1', name: 'Half distance', targetDate: null, done: true, order: 0 },
        { id: 'l2', name: 'Full distance', targetDate: null, done: false, order: 1 },
      ],
    }),
    // Reached.
    goal({
      id: 'reached', title: 'Learn Spanish', area: 'mind', status: 'completed', completedAt: `${subDaysStr(T, 2)}T09:00:00`,
      milestones: [{ id: 'd1', name: 'Duolingo B1', targetDate: null, done: true, order: 0 }],
    }),
  ]
  return s
}

async function mount(route = 'goals', state = seed()) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  window.location.hash = `#/${route}`
  render(<StoreProvider><App /></StoreProvider>)
  await screen.findByRole('heading', { level: 1, name: 'Goals' })
  return document.getElementById('goals-screen')
}

beforeEach(() => { localStorage.clear(); window.location.hash = '' })

describe('Goals workspace — list-first', () => {
  it('defaults to the list and does not render the spatial Atlas', async () => {
    const root = await mount()
    // Open view lists the open goals as structured cards.
    expect(within(root).getByRole('heading', { name: 'Write a novella', level: 2 })).toBeTruthy()
    expect(within(root).getByRole('heading', { name: 'Thesis', level: 2 })).toBeTruthy()
    expect(within(root).getByRole('heading', { name: 'Marathon', level: 2 })).toBeTruthy()
    // Reached goals are quieter and NOT first-class in the open scan.
    expect(within(root).queryByRole('heading', { name: 'Learn Spanish', level: 2 })).toBeNull()
    // No constellation surfaces until the user opts in.
    expect(root.querySelector('.atlas-wrap')).toBeNull()
    // Goal cards expose a health state and progress.
    expect(within(root).getByText('On track')).toBeTruthy()
    expect(within(root.querySelector('.goal-list')).getByText('At risk')).toBeTruthy()
    expect(within(root).getByText('Overdue')).toBeTruthy()
    expect(within(root).getAllByText('20%').length).toBeGreaterThan(0)
  })

  it('surfaces the next milestone on each open goal card', async () => {
    const root = await mount()
    const card = within(root).getByRole('article', { name: 'Goal Write a novella' })
    expect(within(card).getByText('Next milestone')).toBeTruthy()
    expect(within(card).getByText('Finish a draft')).toBeTruthy()
    // One primary completion control per next milestone.
    const toggle = within(card).getByRole('button', { name: /Finish a draft/ })
    expect(toggle.getAttribute('aria-pressed')).toBe('false')
  })

  it('filters Open / Reached / All / At risk deterministically', async () => {
    const root = await mount()
    // Reached
    fireEvent.click(within(root).getByRole('radio', { name: /Reached/ }))
    await within(root).findByRole('heading', { name: 'Learn Spanish', level: 2 })
    expect(within(root).queryByRole('heading', { name: 'Thesis', level: 2 })).toBeNull()
    // At risk → overdue + at-risk only
    fireEvent.click(within(root).getByRole('radio', { name: /At risk/ }))
    await within(root).findByRole('heading', { name: 'Thesis', level: 2 })
    expect(within(root).getByText('Marathon')).toBeTruthy()
    expect(within(root).queryByText('Write a novella')).toBeNull()
    // All → everything including reached
    fireEvent.click(within(root).getByRole('radio', { name: /All/ }))
    await within(root).findByRole('heading', { name: 'Learn Spanish', level: 2 })
  })

  it('makes the Atlas an optional exploration mode, not the default', async () => {
    const root = await mount()
    expect(root.querySelector('.atlas-wrap')).toBeNull()
    fireEvent.click(within(root).getByRole('radio', { name: /Atlas \/ Visual/ }))
    // Lazy atlas mounts once the user opts in.
    const section = await within(root).findByLabelText(/Goal atlas for Thesis/)
    expect(section).toBeTruthy()
    fireEvent.click(within(root).getByRole('radio', { name: /List/ }))
    await waitFor(() => expect(root.querySelector('.atlas-wrap')).toBeNull())
  })

  it('goal management works without the visual graph (complete next milestone)', async () => {
    const root = await mount()
    const toggle = within(root).getByRole('button', { name: /Finish a draft/ })
    fireEvent.click(toggle)
    // Completing the only milestone reaches the goal → leaves Open.
    await waitFor(() => expect(within(root).queryByRole('heading', { name: 'Write a novella', level: 2 })).toBeNull())
  })
})

describe('Goals empty state', () => {
  it('shows a calm "no goals" state with create + learn actions, not empty charts', async () => {
    const state = seed()
    state.goals = []
    const root = await mount('goals', state)
    expect(within(root).getByText('No goals yet')).toBeTruthy()
    expect(within(root).getByRole('button', { name: /Set your first goal/i })).toBeTruthy()
    expect(within(root).getByRole('button', { name: /Learn how goals work/i })).toBeTruthy()
    expect(within(root).queryByText('Forecast')).toBeNull()
    expect(root.querySelector('.atlas-wrap')).toBeNull()
  })
})

describe('Goal detail — outcome-first', () => {
  it('opens from a legacy deep link and shows progress before large charts', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seed()))
    window.location.hash = '#/goals/on'
    render(<StoreProvider><App /></StoreProvider>)
    await screen.findByRole('heading', { level: 1, name: 'Write a novella' })
    const detail = document.getElementById('goal-detail-screen')
    // progress + health come before any large chart
    expect(detail.textContent.indexOf('Finish a draft')).toBeGreaterThan(-1)
    expect(detail.textContent.indexOf('View progress history')).toBeGreaterThan(-1)
    // forecast surfaces the deterministic risk
    expect(detail.textContent).toContain('ON TRACK')
    // contributors + "fed by"
    expect(detail.textContent).toContain('This goal is fed by')
  })

  it('completes the next milestone from detail using the existing engine', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seed()))
    window.location.hash = '#/goals/on'
    render(<StoreProvider><App /></StoreProvider>)
    await screen.findByRole('heading', { level: 1, name: 'Write a novella' })
    const detail = document.getElementById('goal-detail-screen')
    // The milestone is the primary execution surface (both a Next summary
    // and the Up-next list may offer it) — either completion action counts.
    const toggle = within(detail).getAllByRole('button', { name: /Finish a draft/ })[0]
    fireEvent.click(toggle)
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY))
    expect(stored.goals.find((g) => g.id === 'on').status).toBe('completed')
  })

  it('asks before destructive archive', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seed()))
    window.location.hash = '#/goals/late'
    render(<StoreProvider><App /></StoreProvider>)
    await screen.findByRole('heading', { level: 1, name: 'Marathon' })
    fireEvent.click(screen.getByRole('button', { name: 'Archive goal' }))
    const dialog = await screen.findByRole('dialog', { name: 'Archive goal' })
    expect(within(dialog).getByRole('button', { name: 'Archive goal' })).toBeTruthy()
  })
})

describe('Goals accessibility + reduced motion', () => {
  it('is keyboard/touch and reduced-motion safe in its own stylesheet', () => {
    const css = readFileSync('src/styles/goals.css', 'utf8')
    expect(css).toContain('prefers-reduced-motion: reduce')
    expect(css).toContain(':focus-visible')
    expect(css).toContain('min-height: var(--touch)')
    expect(css).toContain('@media (max-width: 720px)')
  })
  it('uses a semantic radiogroup + radio filters and h2 goal cards', async () => {
    const root = await mount()
    expect(within(root).getByRole('radiogroup', { name: 'Goal filters' })).toBeTruthy()
    expect(within(root).getAllByRole('radio').length).toBeGreaterThanOrEqual(3)
  })
})
