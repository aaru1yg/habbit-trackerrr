/* ============================================================
   STEP 4E — Week Review focused tests.
   ============================================================ */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within, cleanup } from '@testing-library/react'
import { StoreProvider, STORAGE_KEY } from '../src/store.jsx'
import App from '../src/App.jsx'
import { todayStr, subDaysStr } from '../src/lib/dates.js'

const today = todayStr()
const ago = (n) => subDaysStr(today, n)
const habit = (id, name, over = {}) => ({
  id, name, category: 'fitness', schedule: { type: 'daily' }, reminder: null, notes: '',
  createdAt: ago(90), archived: false, pause: null, skips: [], order: 0, ...over,
})
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
    ],
    checkins: { 'h-run': dones(30, 1, [1]), 'h-read': dones(30, 1) },
    routines: [], projects: [], assignments: [], goals: [], moods: {}, notes: [], achievements: [],
    preferences: { weekStartsOn: 1 }, signals: [], focusLog: [],
    ...over,
  }
}
const stored = () => JSON.parse(localStorage.getItem(STORAGE_KEY))
function mount(s = seed(), hash = '#/habits?view=week') {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
  window.location.hash = hash
  return render(<StoreProvider><App /></StoreProvider>)
}

describe('week review (Step 4E)', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    window.location.hash = ''
    window.matchMedia = (q) => ({
      matches: !q.includes('max-width'), media: q,
      addListener: () => {}, removeListener: () => {},
      addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false,
    })
  })
  afterEach(() => cleanup())

  it('canonical #/habits?view=week and legacy #/week both render the review', async () => {
    const { unmount } = mount(seed(), '#/habits?view=week')
    expect(await screen.findByRole('heading', { level: 1, name: 'Week review' })).toBeTruthy()
    expect(document.querySelector('#week-screen .wr-habits')).toBeTruthy()
    unmount()
    mount(seed(), '#/week')
    expect(await screen.findByRole('heading', { level: 1, name: 'Week review' })).toBeTruthy()
    expect(document.querySelector('#week-screen .wr-habits')).toBeTruthy()
  })

  it('shows percent, done/total, delta vs last week', async () => {
    mount()
    await screen.findByRole('heading', { level: 1, name: 'Week review' })
    // Big percent
    expect(document.querySelector('.wr-summary__pct').textContent).toMatch(/%/)
    // done/total line
    expect(screen.getByText(/check-ins completed/)).toBeTruthy()
    // Previous-week comparison
    expect(document.body.textContent).toMatch(/last week|previous week/)
  })

  it('7-day per-habit stripe shows a mark for each day and done/missed states', async () => {
    mount()
    await waitFor(() => expect(document.querySelectorAll('.wr-row').length).toBeGreaterThan(0))
    const firstRow = document.querySelectorAll('.wr-row')[0]
    expect(firstRow.querySelectorAll('.wr-mark').length).toBe(7)
    // Yesterday for h-run was missed (skip: [1])
    const missedMark = firstRow.querySelector('.wr-mark.missed')
    expect(missedMark).toBeTruthy()
  })

  it('patterns block surfaces strongest/weakest/streak or weakest-day observations when available', async () => {
    mount()
    await waitFor(() => expect(document.querySelector('.wr-block')).toBeTruthy())
    // Pattern list has at least one evidence-backed line on this seed
    const items = document.querySelectorAll('.wr-block__item')
    expect(items.length).toBeGreaterThan(0)
  })

  it('attention block lists missed habits with a Log button that records completion', async () => {
    mount()
    await waitFor(() => expect(document.querySelector('.wr-attention__list')).toBeTruthy())
    const logBtn = within(document.querySelector('.wr-attention__list')).getByRole('button', { name: /Log/ })
    expect(logBtn).toBeTruthy()
    const before = Object.values(stored().checkins['h-run'] || {}).filter((c) => c.done).length
    fireEvent.click(logBtn)
    await waitFor(() => {
      const after = Object.values(stored().checkins['h-run'] || {}).filter((c) => c.done).length
      expect(after).toBe(before + 1)
    })
  })

  it('previous/next week buttons navigate; this-week button appears when offset', async () => {
    mount()
    await screen.findByRole('heading', { level: 1, name: 'Week review' })
    expect(screen.queryByRole('button', { name: 'This week' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Previous week' }))
    const btn = await screen.findByRole('button', { name: 'This week' })
    expect(btn).toBeTruthy()
    fireEvent.click(btn)
    await waitFor(() => expect(screen.queryByRole('button', { name: 'This week' })).toBeNull())
  })

  it('empty state when no habits exist', async () => {
    mount(seed({ habits: [], checkins: {} }))
    await waitFor(() => expect(document.querySelector('.wr-empty')).toBeTruthy())
    expect(screen.getByText(/No habits yet/)).toBeTruthy()
  })

  it('semantic structure: nav, summary, habits, blocks all present', async () => {
    mount()
    await waitFor(() => expect(document.querySelector('#week-screen .wr-habits')).toBeTruthy())
    expect(screen.getByRole('navigation', { name: 'Week navigation' })).toBeTruthy()
    expect(document.querySelector('.wr-summary')).toBeTruthy()
    expect(document.querySelectorAll('.wr-block').length).toBeGreaterThanOrEqual(2)
    expect(screen.getByRole('heading', { level: 1, name: 'Week review' })).toBeTruthy()
  })
})
