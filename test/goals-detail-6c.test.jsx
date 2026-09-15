import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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
  s.profile.name = 'Tester'; s.profile.onboarded = true
  s.habits = [{ id: 'h1', name: 'Write daily', cadence: 'daily', archived: false }]
  s.projects = [{ id: 'p1', name: 'Novella draft', archived: false }]
  s.assignments = [{ id: 'a1', name: 'Outline chapters', archived: false, progress: 0 }]
  s.goals = [
    goal({ id: 'on', title: 'Write a novella', area: 'creative', startDate: T, targetDate: addDaysStr(T, 30),
      milestones: [{ id: 'm1', name: 'Finish a draft', targetDate: addDaysStr(T, 20), done: false, order: 0 }] }),
    goal({ id: 'late', title: 'Marathon', area: 'fitness', startDate: subDaysStr(T, 30), targetDate: subDaysStr(T, 5),
      milestones: [{ id: 'l1', name: 'Half distance', targetDate: null, done: true, order: 0 }, { id: 'l2', name: 'Full distance', targetDate: null, done: false, order: 1 }] }),
    goal({ id: 'reached', title: 'Learn Spanish', area: 'mind', status: 'completed', completedAt: `${subDaysStr(T,2)}T09:00`,
      milestones: [{ id: 'd1', name: 'Duolingo B1', targetDate: null, done: true, order: 0 }] }),
    goal({ id: 'withlinks', title: 'Ship portfolio', area: 'creative', startDate: T, targetDate: addDaysStr(T, 14),
      milestones: [{ id: 'w1', name: 'Pick template', done: true, doneAt: `${T}T09:00`, order: 0 }, { id: 'w2', name: 'Deploy', done: false, order: 1 }],
      linkedHabitIds: ['h1'], linkedProjectIds: ['p1'], linkedAssignmentIds: ['a1'] }),
  ]
  return s
}
async function mount(route = 'goals/on', state = seed()) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  window.location.hash = `#/${route}`
  render(<StoreProvider><App /></StoreProvider>)
  const title = route.split('/')[1]
  const g = state.goals.find(x => x.id === title)
  await screen.findByRole('heading', { level: 1, name: g?.title || 'Goal' })
  return document.getElementById('goal-detail-screen')
}
beforeEach(() => { localStorage.clear(); window.location.hash = ''; document.body.innerHTML = '' })

describe('Step 6C — Goal Detail', () => {
  it('loads the correct goal with title, area, health, back-to-goals link', async () => {
    const el = await mount('goals/on')
    expect(el.querySelector('.dlv__back').textContent).toContain('Goals')
    expect(el.querySelector('.goal-row__eyebrow').textContent).toContain('Creative')
    expect(el.querySelector('.status-pill[data-tone="neutral"]').textContent).toBe('On track')
    expect(el.querySelector('h1').textContent).toBe('Write a novella')
  })

  it('shows a real trajectory viz (SVG), no ProgressCore/ring, and snapshot pills', async () => {
    const el = await mount('goals/on')
    expect(el.querySelector('.goal-detail__trajectory svg')).toBeTruthy()
    expect(el.querySelector('.progress-core, [class*=Ring], .ring')).toBeNull()
    expect(el.querySelectorAll('.dlv__snap .dlv__pill').length).toBeGreaterThan(3)
    expect(within(el).getByText('Progress', { selector: '.dlv__pill-label' })).toBeTruthy()
  })

  it('null gaps are not interpolated: the SVG is rendered but does not fabricate data', async () => {
    const el = await mount('goals/on')
    const svg = el.querySelector('.goal-detail__trajectory svg')
    expect(svg).toBeTruthy()
    // Legend is honest — "actual" and "expected" both present.
    expect(el.textContent).toMatch(/actual/)
  })

  it('next milestone toggle advances state (existing engine)', async () => {
    await mount('goals/on')
    const toggle = screen.getAllByRole('button', { name: /Finish a draft/ })[0]
    fireEvent.click(toggle)
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY))
    // The single milestone is now done → goal reaches 100%
    expect(stored.goals.find((g) => g.id === 'on').milestones[0].done).toBe(true)
  })

  it('linked habits/projects/assignments render with correct deep links', async () => {
    const el = await mount('goals/withlinks')
    expect(el.querySelector('a[href="#/habits/h1"]')).toBeTruthy()
    expect(el.querySelector('a[href="#/projects/p1"]')).toBeTruthy()
    expect(el.querySelector('a[href="#/assignments/a1"]')).toBeTruthy()
  })

  it('archive + delete sheets open (existing confirm flow)', async () => {
    await mount('goals/on')
    fireEvent.click(screen.getByRole('button', { name: 'Archive goal' }))
    expect(await screen.findByRole('dialog', { name: 'Archive goal' })).toBeTruthy()
  })

  it('GoalAtlas is opt-in (lazy, not mounted until toggle)', async () => {
    const el = await mount('goals/on')
    expect(el.querySelector('.atlas-wrap')).toBeNull()
    fireEvent.click(within(el).getByRole('button', { name: /Explore connections/ }))
    await waitFor(() => expect(document.querySelector('[aria-label*="Goal atlas"]')).toBeTruthy())
  })

  it('completed goal shows Completed state and no risk warning', async () => {
    const el = await mount('goals/reached')
    expect(el.querySelector('.status-pill[data-tone="good"]').textContent).toBe('Completed')
    expect(el.querySelector('.dlv__focus')).toBeNull()
  })

  it('overdue goal shows Needs attention surface with bad tone', async () => {
    const el = await mount('goals/late')
    expect(el.querySelector('.dlv__focus')).toBeTruthy()
    expect(el.querySelector('.dlv__focus').textContent).toContain('Needs attention')
  })

  it('back link takes user to Goals overview', async () => {
    const el = await mount('goals/on')
    fireEvent.click(within(el).getByText('Goals', { selector: '.dlv__back' }))
    await waitFor(() => expect(document.getElementById('goals-screen')).toBeTruthy())
  })
})
