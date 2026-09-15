import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen, within, fireEvent, waitFor } from '@testing-library/react'
import { StoreProvider, STORAGE_KEY, emptyState } from '../src/store.jsx'
import App from '../src/App.jsx'
import { todayStr, subDaysStr } from '../src/lib/dates.js'

const T = todayStr()

function habit(id, name, category, createdOffset = -30) {
  return {
    id, name, category,
    createdAt: subDaysStr(T, Math.abs(createdOffset)),
    archived: false, order: 0,
    cadence: 'daily',
  }
}

function seed() {
  const s = emptyState()
  s.profile.name = 'Tester'; s.profile.onboarded = true
  s.habits = [
    habit('h1', 'Meditate', 'mind'),
    habit('h2', 'Read', 'learning'),
    habit('h3', 'Run', 'fitness'),
  ]
  s.checkins = {}
  // 25 days of mixed completions
  for (let i = 24; i >= 0; i--) {
    const d = subDaysStr(T, i)
    s.checkins.h1 ??= {}; s.checkins.h2 ??= {}; s.checkins.h3 ??= {}
    const dow = new Date(`${d}T12:00:00`).getDay()
    const base = (dow === 0 || dow === 6) ? 0.5 : 0.8 // weekends weaker
    s.checkins.h1[d] = { done: Math.random() < base + 0.1, at: `${d}T08:00` }
    s.checkins.h2[d] = { done: Math.random() < base, at: `${d}T20:00` }
    s.checkins.h3[d] = { done: Math.random() < base - 0.1, at: `${d}T07:00` }
  }
  return s
}

async function mount(route = 'insights', state = seed()) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  window.location.hash = `#/${route}`
  const r = render(<StoreProvider><App /></StoreProvider>)
  await waitFor(() => expect(screen.getByRole('heading', { name: 'Insights' })).toBeTruthy())
  return r
}

describe('Insights Overview (Step 7B)', () => {
  beforeEach(() => { localStorage.clear(); window.location.hash = ''; document.body.innerHTML = '' })

  it('renders the four signal tiles (Completion/This week/Current streak/Total)', async () => {
    await mount()
    const strip = screen.getByLabelText('Current signals')
    expect(within(strip).getByText('Completion')).toBeTruthy()
    expect(within(strip).getByText('This week')).toBeTruthy()
    expect(within(strip).getByText('Current streak')).toBeTruthy()
    expect(within(strip).getByText('Total')).toBeTruthy()
  })

  it('renders the primary multi-series chart with a real-data aria label', async () => {
    await mount()
    const card = screen.getByText('What changed').closest('.ins-surface')
    const svg = card.querySelector('svg')
    expect(svg).not.toBeNull()
    expect(svg.getAttribute('role')).toBe('img')
    expect(svg.getAttribute('aria-label')).toMatch(/Completion trend over the last/)
  })

  it('chart legend lists Aggregate, 7-day average and per-habit entries', async () => {
    await mount()
    const legend = document.querySelector('.ins-legend')
    expect(legend.textContent).toMatch(/Aggregate/)
    expect(legend.textContent).toMatch(/7-day average/)
    // At least one habit is shown
    expect(legend.textContent).toMatch(/Meditate|Read|Run/)
  })

  it('range switch toggles 14D / 30D / 90D with aria-pressed semantics', async () => {
    await mount()
    const group = screen.getByRole('group', { name: 'Trend range' })
    const btns = within(group).getAllByRole('button')
    expect(btns.map((b) => b.textContent)).toEqual(['14D', '30D', '90D'])
    expect(btns.filter((b) => b.getAttribute('aria-pressed') === 'true').length).toBe(1)
    fireEvent.click(btns[0])
    expect(btns[0].getAttribute('aria-pressed')).toBe('true')
  })

  it('no insight card contains the unsupported "Pairing it with" copy', async () => {
    await mount()
    document.querySelectorAll('.ins-insight').forEach((card) => {
      expect(card.textContent).not.toMatch(/Pairing it with/)
      expect(card.textContent).not.toMatch(/Great job!|You're doing amazing/i)
    })
  })

  it('the four pillar destinations (Mind/Record/Achievements/Advanced) exist', async () => {
    await mount()
    expect(screen.getByText('Mind', { selector: '.ins-pillar-label' })).toBeTruthy()
    expect(screen.getByText('Record', { selector: '.ins-pillar-label' })).toBeTruthy()
    expect(screen.getByText('Achievements', { selector: '.ins-pillar-label' })).toBeTruthy()
    expect(screen.getByText('Advanced', { selector: '.ins-pillar-label' })).toBeTruthy()
  })

  it('empty state renders honestly when there are no habits', async () => {
    const s = emptyState()
    s.profile.onboarded = true
    await mount('insights', s)
    expect(await screen.findByText(/Nothing to analyze yet/)).toBeTruthy()
  })

  it('habit series swatches use category color variables, not semantic tones', async () => {
    await mount()
    const swatches = document.querySelectorAll('.ins-legend i')
    swatches.forEach((i) => {
      const bg = (i.getAttribute('style') || '')
      if (i.classList.contains('is-dash')) return
      expect(bg).not.toMatch(/--(good|bad|warn)/)
    })
  })

  it('Advanced is an in-page lazy toggle (Lab stays double-lazy behind it)', async () => {
    await mount()
    // 7B renamed the old "Lab" button to "Advanced" and made it an in-page toggle,
    // so the Lab chunk stays double-lazy (App -> InsightsScreen lazy-imports AnalyticsLab).
    expect(screen.queryByText('Your data story')).toBeNull() // lazy — not loaded yet
    fireEvent.click(screen.getByRole('button', { name: 'Advanced' }))
    await screen.findByText('Your data story')
  })

  it('Lab deep links (?view=advanced and legacy /analytics-lab) land on the Lab', async () => {
    // Release contract: Advanced is deep-linkable. ?view=advanced initializes the
    // in-page Lab view; the legacy /analytics-lab hash renders the same surface.
    const first = await mount('insights?view=advanced')
    await screen.findByText('Your data story')
    first.unmount()
    await mount('analytics-lab')
    await screen.findByText('Your data story')
  })

  it('Deep dive toggle still renders Deep dive content', async () => {
    await mount()
    fireEvent.click(screen.getByRole('button', { name: 'Deep dive' }))
    expect(screen.getByText(/What your data says/i)).toBeTruthy()
  })
})
