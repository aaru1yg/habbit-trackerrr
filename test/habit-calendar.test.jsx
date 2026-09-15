/* ============================================================
   STEP 4D — Habit Calendar focused tests.
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
      habit('h-old', 'Cold shower', { order: 2, archived: true }),
    ],
    checkins: { 'h-run': dones(30, 1, [1]), 'h-read': dones(30, 1) },
    routines: [], projects: [], assignments: [], goals: [], moods: {}, notes: [], achievements: [],
    preferences: { weekStartsOn: 1 }, signals: [], focusLog: [],
    ...over,
  }
}
const stored = () => JSON.parse(localStorage.getItem(STORAGE_KEY))
function mount(s = seed(), hash = '#/habits?view=calendar') {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
  window.location.hash = hash
  return render(<StoreProvider><App /></StoreProvider>)
}

describe('habit calendar (Step 4D)', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    window.location.hash = ''
    window.matchMedia = (q) => ({
      matches: !q.includes('max-width'), media: q,
      addListener: () => {}, removeListener: () => {},
      addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false,
    })
    // jsdom getBoundingClientRect stub — ensure cells report ≥ 32px
    window.HTMLElement.prototype.getBoundingClientRect = () => ({
      width: 36, height: 36, top: 0, left: 0, bottom: 36, right: 36, x: 0, y: 0, toJSON: () => {},
    })
  })
  afterEach(() => cleanup())

  it('canonical route renders range selector, selected-day card, and grid', async () => {
    mount()
    expect(await screen.findByRole('heading', { level: 1, name: 'Calendar' })).toBeTruthy()
    expect(screen.getByRole('group', { name: 'Calendar range' })).toBeTruthy()
    expect(screen.getByRole('group', { name: 'Calendar controls' })).toBeTruthy()
    const range = screen.getByRole('group', { name: 'Calendar range' })
    expect(within(range).getAllByRole('button')).toHaveLength(3)
    expect(screen.getByRole('heading', { level: 3 })).toBeTruthy()
    expect(screen.getByRole('grid', { name: /habit activity/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Previous range' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Next range' })).toBeTruthy()
  })

  it('legacy #/calendar renders the same calendar', async () => {
    mount(seed(), '#/calendar')
    expect(await screen.findByRole('grid', { name: /habit activity/ })).toBeTruthy()
  })

  it('default mode is Month; switching to 90 days and Year updates the grid data-mode', async () => {
    mount()
    await screen.findByRole('grid', { name: /habit activity/ })
    const grid = () => screen.getByRole('grid', { name: /habit activity/ })
    expect(grid().getAttribute('data-mode')).toBe('month')
    fireEvent.click(within(screen.getByRole('group', { name: 'Calendar range' })).getByRole('button', { name: '90 days' }))
    await waitFor(() => expect(grid().getAttribute('data-mode')).toBe('90d'))
    fireEvent.click(within(screen.getByRole('group', { name: 'Calendar range' })).getByRole('button', { name: 'Year' }))
    await waitFor(() => expect(grid().getAttribute('data-mode')).toBe('year'))
  })

  it('ArrowLeft/ArrowRight navigate the range when not in a dialog', async () => {
    mount()
    await screen.findByRole('grid', { name: /habit activity/ })
    const title = () => document.querySelector('.hc-title').textContent
    const before = title()
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    await waitFor(() => expect(title()).not.toBe(before))
  })

  it('today has the is-today marker and is selected by default', async () => {
    mount()
    await screen.findByRole('grid', { name: /habit activity/ })
    const todayBtn = screen.getByRole('button', { name: /\(today\)/ })
    expect(todayBtn.classList.contains('is-today')).toBe(true)
    expect(todayBtn.getAttribute('aria-pressed')).toBe('true')
  })

  it('missed cells carry data-state="missed" and an is-missed class (not color-only)', async () => {
    mount()
    await screen.findByRole('grid', { name: /habit activity/ })
    const d = new Date(); d.setDate(d.getDate() - 1)
    const pretty = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
    const cell = await screen.findByRole('button', { name: new RegExp(`Mark Morning run as complete, ${pretty.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`) })
    expect(cell.getAttribute('data-state')).toBe('missed')
    expect(cell.classList.contains('is-missed')).toBe(true)
  })

  it('tapping a cell selects that day and toggles completion', async () => {
    mount()
    await screen.findByRole('grid', { name: /habit activity/ })
    // yesterday (ago(1)) was missed in seed; toggling it logs the day.
    const d = new Date(); d.setDate(d.getDate() - 1)
    const pretty = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
    const cell = await screen.findByRole('button', { name: new RegExp(`Mark Morning run as complete, ${pretty.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`) })
    fireEvent.click(cell)
    await waitFor(() => expect(cell.getAttribute('aria-pressed')).toBe('true'))
    expect(cell.classList.contains('is-done')).toBe(true)
    expect(screen.getByRole('heading', { level: 3 }).textContent).toMatch(new RegExp(pretty.split(',')[0]))
  })

  it('selected-day card lists scheduled habits with state and an action button', async () => {
    mount()
    await screen.findByRole('grid', { name: /habit activity/ })
    const card = document.querySelector('.hc-day')
    expect(card).toBeTruthy()
    const list = within(card).getByRole('list')
    expect(within(list).getAllByRole('listitem').length).toBeGreaterThan(0)
  })

  it('N key on a cell opens the note sheet; Save persists note', async () => {
    mount()
    await screen.findByRole('grid', { name: /habit activity/ })
    const d = new Date(); d.setDate(d.getDate() - 1)
    const pretty = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
    const cell = await screen.findByRole('button', { name: new RegExp(`Mark Morning run as complete, ${pretty.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`) })
    cell.focus()
    fireEvent.keyDown(cell, { key: 'n' })
    const sheet = await screen.findByRole('dialog', { name: /Note — Morning run/ })
    fireEvent.change(within(sheet).getByPlaceholderText(/How did it go/), { target: { value: 'Steady pace' } })
    fireEvent.click(within(sheet).getByRole('button', { name: 'Save note' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: /Note — Morning run/ })).toBeNull())
    await waitFor(() => expect(stored().checkins['h-run'][ago(1)]?.note).toBe('Steady pace'))
    expect(cell.getAttribute('aria-label')).toMatch(/note: Steady pace/)
  })

  it('interactive cells have at least 32px tap size', async () => {
    mount()
    await screen.findByRole('grid', { name: /habit activity/ })
    const cell = document.querySelector('.hc-grid .hc-cell.is-missed, .hc-grid .hc-cell.is-done, .hc-grid .hc-cell.is-today')
    expect(cell).toBeTruthy()
    const r = cell.getBoundingClientRect()
    expect(r.width).toBeGreaterThanOrEqual(32)
    expect(r.height).toBeGreaterThanOrEqual(32)
  })
})
