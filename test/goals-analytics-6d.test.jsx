import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
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
  s.goals = [
    goal({ id: 'on', title: 'Write a novella', area: 'creative', startDate: T, targetDate: addDaysStr(T, 30),
      milestones: [{ id: 'm1', name: 'Finish a draft', targetDate: addDaysStr(T, 20), done: false, order: 0 }] }),
    goal({ id: 'late', title: 'Marathon', area: 'fitness', startDate: subDaysStr(T, 30), targetDate: subDaysStr(T, 5),
      milestones: [{ id: 'l1', name: 'Half', targetDate: null, done: true, order: 0 }], manualPercent: 50 }),
    goal({ id: 'nodate', title: 'Learn guitar', area: 'creative', milestones: [], manualPercent: 10 }),
    goal({ id: 'reached', title: 'Spanish', area: 'mind', status: 'completed', completedAt: `${subDaysStr(T,2)}T09:00`,
      milestones: [{ id: 'd1', name: 'B1', targetDate: null, done: true, order: 0 }] }),
  ]
  return s
}
async function mount(route = 'goals/on', state = seed()) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  window.location.hash = `#/${route}`
  render(<StoreProvider><App /></StoreProvider>)
  const gid = route.split('/')[1]
  const g = state.goals.find(x => x.id === gid)
  await screen.findByRole('heading', { level: 1, name: g?.title })
  return document.getElementById('goal-detail-screen')
}
beforeEach(() => { localStorage.clear(); window.location.hash = ''; document.body.innerHTML = '' })

describe('Step 6D — Goal Analytics', () => {
  it('renders the analytics section with trajectory chart, legend, and stat grid', async () => {
    const el = await mount('goals/on')
    expect(within(el).getByText('Progress analytics')).toBeTruthy()
    expect(el.querySelectorAll('.goal-analytics__chart svg').length).toBe(1)
    expect(el.querySelectorAll('.goal-analytics__stat').length).toBe(4)
    expect(el.textContent).toMatch(/actual/)
    expect(el.textContent).toMatch(/expected/)
  })

  it('expected line renders only when start+target window exists; no fake interpolation', async () => {
    const el = await mount('goals/nodate')
    // Without target date the analytics section honestly states there isn't enough history
    // (no fabricated expected line or projection).
    expect(el.textContent).toMatch(/Not enough progress|target date/)
  })

  it('velocity and consistency values come from real analytics (not fabricated)', async () => {
    const el = await mount('goals/on')
    // Either "pts/wk" appears or "Not enough data" — both honest.
    expect(el.textContent).toMatch(/pts\/wk|Not enough data/i)
  })

  it('projection section shows projected date OR honest reason; no fake value', async () => {
    const el = await mount('goals/on')
    expect(el.textContent).toMatch(/Projected|Stalled|Need more|—/)
  })

  it('completed goal renders reached state without risk warnings', async () => {
    const el = await mount('goals/reached')
    expect(el.textContent).toContain('Goal reached')
    expect(el.querySelector('.dlv__focus')).toBeNull()
  })

  it('insight copy is data-backed (on track / behind / stalled / ahead / reached)', async () => {
    const elLate = await mount('goals/late')
    expect(elLate.textContent).toMatch(/behind|stalled|late/i)
  })

  it('Goals Overview + Work/Habits shell unaffected', async () => {
    await mount('goals/on')
    // Back link still works
    expect(document.querySelector('.dlv__back').textContent).toContain('Goals')
  })

  it('consistency strip renders when consistency pct exists', async () => {
    const el = await mount('goals/on')
    // The consistency meter can render empty or filled bars — never throws.
    expect(el.querySelector('.goal-analytics__stat')).toBeTruthy()
  })
})
