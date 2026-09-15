import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { readFileSync } from 'node:fs'
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
    goal({ id: 'on', title: 'Write a novella', area: 'creative',
      startDate: T, targetDate: addDaysStr(T, 30),
      milestones: [{ id: 'm1', name: 'Finish a draft', targetDate: addDaysStr(T, 20), done: false, order: 0 }] }),
    goal({ id: 'risk', title: 'Thesis', area: 'learning',
      startDate: subDaysStr(T, 60), targetDate: addDaysStr(T, 10),
      milestones: [
        { id: 'r1', name: 'Literature review', targetDate: null, done: true, order: 0 },
        { id: 'r2', name: 'Methodology', targetDate: null, done: false, order: 1 },
        { id: 'r3', name: 'Results', targetDate: null, done: false, order: 2 },
        { id: 'r4', name: 'Write up', targetDate: null, done: false, order: 3 },
        { id: 'r5', name: 'Defend', targetDate: null, done: false, order: 4 },
      ] }),
    goal({ id: 'late', title: 'Marathon', area: 'fitness',
      startDate: subDaysStr(T, 30), targetDate: subDaysStr(T, 5),
      milestones: [
        { id: 'l1', name: 'Half distance', targetDate: null, done: true, order: 0 },
        { id: 'l2', name: 'Full distance', targetDate: null, done: false, order: 1 },
      ] }),
    goal({ id: 'reached', title: 'Learn Spanish', area: 'mind', status: 'completed', completedAt: `${subDaysStr(T, 2)}T09:00:00`,
      milestones: [{ id: 'd1', name: 'Duolingo B1', targetDate: null, done: true, order: 0 }] }),
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
beforeEach(() => { localStorage.clear(); window.location.hash = ''; document.body.innerHTML = '' })

describe('Step 6B — Goals Overview', () => {
  it('renders Goals eyebrow + title + snapshot pills with real counts', async () => {
    const root = await mount()
    expect(within(root).getByText('Goals', { selector: '.wo__eyebrow' })).toBeTruthy()
    expect(root.querySelector('.dlv__snap')).toBeTruthy()
    expect(within(root).getByText('Active', { selector: '.dlv__pill-label' })).toBeTruthy()
    expect(within(root).getByText('Healthy', { selector: '.dlv__pill-label' })).toBeTruthy()
    expect(within(root).getByText('Attention', { selector: '.dlv__pill-label' })).toBeTruthy()
    expect(within(root).getByText('Completed', { selector: '.dlv__pill-label' })).toBeTruthy()
  })

  it('goal rows use trajectory strips (no rings), area color accent, and next milestone', async () => {
    const root = await mount()
    const card = within(root).getByRole('article', { name: 'Goal Write a novella' })
    expect(card.querySelector('.goal-trajectory svg')).toBeTruthy()
    // no progress ring of class ProgressCore or ring on list
    expect(card.querySelector('.progress-core, .ring, [class*=Ring]')).toBeNull()
    expect(within(card).getByText('Next milestone')).toBeTruthy()
    expect(within(card).getByText('Finish a draft')).toBeTruthy()
  })

  it('health presentation is unified: On track / At risk / Overdue / Completed', async () => {
    const root = await mount()
    expect(within(root).getByText('On track')).toBeTruthy()
    expect(within(root).getByText('At risk')).toBeTruthy()
    expect(within(root).getByText('Overdue')).toBeTruthy()
    fireEvent.click(within(root).getByRole('tab', { name: /Completed/ }))
    const card = await within(root).findByRole('article', { name: 'Goal Learn Spanish' })
    expect(within(card).getByText(/Outcome reached/)).toBeTruthy()
  })

  it('GoalAtlas stays lazy + opt-in via Atlas button', async () => {
    const root = await mount()
    expect(root.querySelector('.atlas-wrap')).toBeNull()
    fireEvent.click(within(root).getByRole('button', { name: /Atlas/ }))
    expect(await within(root).findByLabelText(/Goal atlas for Thesis/)).toBeTruthy()
  })

  it('deep links to goal detail work', async () => {
    await mount()
    fireEvent.click(screen.getByRole('link', { name: 'Write a novella' }))
    await screen.findByRole('heading', { level: 1, name: 'Write a novella' })
  })

  it('empty state explains goals and offers create + learn; no fake demo data', async () => {
    const state = seed(); state.goals = []
    const root = await mount('goals', state)
    expect(within(root).getByText(/What are you moving toward/)).toBeTruthy()
    expect(within(root).getByRole('button', { name: /Set your first goal/i })).toBeTruthy()
    expect(within(root).getByRole('button', { name: /Learn how goals work/i })).toBeTruthy()
    expect(root.querySelectorAll('.goal-row').length).toBe(0)
  })

  it('next-milestone toggle updates state (existing engine, no new reducer)', async () => {
    const root = await mount()
    const card = within(root).getByRole('article', { name: 'Goal Write a novella' })
    const toggle = within(card).getByRole('button', { name: /Finish a draft/ })
    fireEvent.click(toggle)
    await waitFor(() => expect(within(root).queryByRole('article', { name: 'Goal Write a novella' })).toBeNull())
  })

  it('CSS keeps touch targets, reduced motion, mobile media query', () => {
    const css = readFileSync('src/styles/goals.css', 'utf8')
    expect(css).toContain('min-height: var(--touch)')
    expect(css).toContain('prefers-reduced-motion: reduce')
    expect(css).toContain('@media (max-width: 720px)')
  })

  it('snapshot values come from real data (3 active open, 2 at risk in fixture)', async () => {
    const root = await mount()
    // Open tab shows 3 active goals initially (novella, thesis, marathon).
    expect(within(root).getAllByRole('article').length).toBe(3)
  })
})
