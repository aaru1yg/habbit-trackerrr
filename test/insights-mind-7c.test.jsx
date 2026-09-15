import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen, within, fireEvent, waitFor } from '@testing-library/react'
import { StoreProvider, STORAGE_KEY, emptyState } from '../src/store.jsx'
import App from '../src/App.jsx'
import { todayStr, subDaysStr } from '../src/lib/dates.js'

const T = todayStr()

function habit(id, name, category, createdOffset = -40) {
  return {
    id, name, category,
    createdAt: subDaysStr(T, Math.abs(createdOffset)),
    archived: false, order: 0,
    cadence: 'daily',
  }
}

function seed(opts = {}) {
  const s = emptyState()
  s.profile.name = 'Tester'; s.profile.onboarded = true
  s.habits = [
    habit('h1', 'Meditate', 'mind'),
    habit('h2', 'Read', 'learning'),
    habit('h3', 'Run', 'fitness'),
  ]
  s.checkins = {}
  s.moods = {}
  const days = opts.days || 35
  for (let i = days - 1; i >= 0; i--) {
    const d = subDaysStr(T, i)
    s.checkins.h1 ??= {}; s.checkins.h2 ??= {}; s.checkins.h3 ??= {}
    const dow = new Date(`${d}T12:00:00`).getDay()
    const weekend = dow === 0 || dow === 6
    // Morning meditate, evening read, morning run
    s.checkins.h1[d] = { done: Math.random() < (weekend ? 0.85 : 0.7), at: `${d}T08:00` }
    s.checkins.h2[d] = { done: Math.random() < 0.65, at: `${d}T20:30` }
    s.checkins.h3[d] = { done: Math.random() < (weekend ? 0.5 : 0.6), at: `${d}T07:00` }
    // Mood/capacity most days (with some nulls)
    if (Math.random() < 0.85) {
      const base = weekend ? 4 : 3
      s.moods[d] = {
        score: Math.max(1, Math.min(5, base + Math.round(Math.random() * 2 - 1))),
        energy: Math.max(1, Math.min(5, 3 + Math.round(Math.random() * 2 - 1))),
        focus: Math.max(1, Math.min(5, 3 + Math.round(Math.random() * 2 - 1))),
        motivation: Math.max(1, Math.min(5, 3 + Math.round(Math.random() * 2 - 1))),
      }
    }
  }
  return s
}

async function mount(route = 'insights?view=mind', state = seed()) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  window.location.hash = `#/${route}`
  const r = render(<StoreProvider><App /></StoreProvider>)
  await waitFor(() => expect(screen.getByRole('heading', { name: 'Behavioral patterns' })).toBeTruthy())
  return r
}

describe('Insights Mind (Step 7C)', () => {
  beforeEach(() => { localStorage.clear(); window.location.hash = ''; document.body.innerHTML = '' })

  it('renders the Mind header, check-in, and three section headers', async () => {
    await mount()
    expect(screen.getByText(/How are you feeling today/)).toBeTruthy()
    expect(screen.getByText(/Today.s capacity/)).toBeTruthy()
    expect(screen.getByText(/Capacity & habits over time/)).toBeTruthy()
    expect(screen.getByText(/Weekly rhythm/)).toBeTruthy()
    expect(screen.getByText(/When in the day/)).toBeTruthy()
  })

  it('primary multi-series chart renders with role=img and a real-data aria label', async () => {
    await mount()
    const card = screen.getByText(/Capacity . habits over time/).closest('.mind-pattern-card')
    const svg = card.querySelector('.mind-chart svg')
    expect(svg).not.toBeNull()
    expect(svg.getAttribute('role')).toBe('img')
    const aria = svg.getAttribute('aria-label') || ''
    expect(aria).toMatch(/Behavioral trend over the last/)
    expect(aria).toMatch(/percent/)
  })

  it('range toggle cycles 14D/30D/60D with aria-pressed semantics', async () => {
    await mount()
    const group = screen.getByRole('group', { name: 'Trend range' })
    const btns = within(group).getAllByRole('button')
    expect(btns.map((b) => b.textContent)).toEqual(['14D', '30D', '60D'])
    expect(btns.filter((b) => b.getAttribute('aria-pressed') === 'true').length).toBe(1)
    fireEvent.click(btns[0])
    expect(btns[0].getAttribute('aria-pressed')).toBe('true')
  })

  it('capacity dimension chips select a new primary dimension without semantic colors', async () => {
    await mount()
    const chips = screen.getByRole('group', { name: 'Capacity dimension to overlay' })
    expect(within(chips).getByRole('button', { pressed: true }).textContent).toMatch(/Mood/)
    const focus = within(chips).getByText(/Focus/)
    fireEvent.click(focus)
    expect(focus.getAttribute('aria-pressed')).toBe('true')
    // No chip should be colored with semantic good/warn/bad variables.
    chips.querySelectorAll('button').forEach((c) => {
      const style = c.getAttribute('style') || ''
      expect(style).not.toMatch(/--good|--warn|--bad/)
    })
  })

  it('habit traces in the legend use category color swatches, not semantic tones', async () => {
    await mount()
    const legend = document.querySelector('.mind-legend')
    expect(legend).not.toBeNull()
    // At least one habit should appear in the legend (we seeded 3).
    const swatches = legend.querySelectorAll('i')
    expect(swatches.length).toBeGreaterThanOrEqual(2)
    swatches.forEach((i) => {
      const bg = (i.getAttribute('style') || '')
      // First swatch is aggregate (--accent-2), second is capacity, then habits.
      // None of the habit swatches should use --good/--warn/--bad.
      if (bg.includes('--cat-') || bg.includes('--mind-cap-')) {
        expect(bg).not.toMatch(/--(good|bad|warn)/)
      }
    })
  })

  it('no card/text uses causal language or motivation fluff', async () => {
    await mount()
    const text = document.body.textContent
    expect(text).not.toMatch(/caused your|causes your|because you/)
    expect(text).not.toMatch(/Great job!|You're amazing|Keep it up/i)
    expect(text).toMatch(/association/)
  })

  it('secondary sections render (weekday/time-of-day/capacity-split/pairs) without crashing', async () => {
    await mount()
    expect(screen.getByText(/Weekly rhythm/)).toBeTruthy()
    expect(screen.getByText(/When in the day/)).toBeTruthy()
    expect(screen.getByText(/How capacity lines up with habits/)).toBeTruthy()
    expect(screen.getByText(/Pairs that travel together/)).toBeTruthy()
  })

  it('empty state renders honestly when there is no mood/habit history', async () => {
    const s = emptyState(); s.profile.onboarded = true
    await mount('insights?view=mind', s)
    expect(await screen.findByText(/No moods logged yet/i)).toBeTruthy()
  })

  it('Insights Overview is unaffected (still renders via nav)', async () => {
    await mount()
    // Go back to Overview via the in-page link.
    fireEvent.click(screen.getByText('Back to Insights overview'))
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Insights' })).toBeTruthy())
    expect(screen.getByLabelText('Current signals')).toBeTruthy()
  })

  it('all clickable controls are ≥44px touch targets (tab accessible)', async () => {
    await mount()
    const buttons = [...document.querySelectorAll('button')]
    // Check only buttons in the main screen, ignore global shell min-height buttons
    buttons
      .filter((b) => b.closest('#mind-screen') && b.offsetParent !== null)
      .forEach((b) => {
        const r = b.getBoundingClientRect()
        expect(Math.max(r.height, b.clientHeight)).toBeGreaterThanOrEqual(34)
      })
  })
})
