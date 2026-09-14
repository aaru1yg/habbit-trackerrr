import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { StoreProvider, STORAGE_KEY } from '../src/store.jsx'
import App from '../src/App.jsx'
import { todayStr, subDaysStr } from '../src/lib/dates.js'

const today = todayStr()
const ago = (n) => subDaysStr(today, n)
const habit = (id, name, over = {}) => ({
  id, name, category: 'learning', schedule: { type: 'daily' }, reminder: '21:00',
  notes: '', createdAt: ago(30), archived: false, pause: null, skips: [], order: 0, ...over,
})
const dones = (from, to, skip = []) => {
  const out = {}
  for (let i = from; i >= to; i--) if (!skip.includes(i)) out[ago(i)] = { done: true, at: `${ago(i)}T07:30` }
  return out
}
// Build checkins with a 30-day streak ending yesterday (today NOT done so primary action is Complete)
const streak30 = () => {
  const c = dones(30, 1) // days 1..30 ago (yesterday through 30 days back)
  // add ago(0) = today intentionally NOT done, so current streak is 30
  return c
}
function seed() {
  return {
    version: 4,
    profile: { name: 'Aaru', onboarded: true, theme: 'midnight' },
    habits: [
      habit('h-read', 'Read 20 pages'),
      habit('h-run', 'Morning run', { category: 'fitness', reminder: '' }),
    ],
    checkins: { 'h-read': dones(30, 1), 'h-run': streak30() },
    routines: [], projects: [], assignments: [], goals: [], moods: {}, notes: [], achievements: [],
    preferences: { weekStartsOn: 1 }, signals: [], focusLog: [],
  }
}
function mount(s = seed(), hash = '#/habits/h-read') {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
  window.location.hash = hash
  return render(<StoreProvider><App /></StoreProvider>)
}
const stored = () => JSON.parse(localStorage.getItem(STORAGE_KEY))

beforeEach(() => { localStorage.clear(); window.location.hash = '' })
afterEach(cleanup)

describe('Step 4G-2B: Habit Detail hero compact entity header', () => {
  it('shows habit name as h1, category eyebrow, schedule, reminder, and primary Complete action', async () => {
    mount()
    await screen.findByRole('heading', { level: 1, name: 'Read 20 pages' })
    const hero = document.querySelector('.hd-hero')
    expect(hero.textContent).toMatch(/Learning/)
    expect(hero.textContent).toMatch(/Every day/)
    expect(hero.textContent).toMatch(/9 PM/)
    const complete = screen.getByRole('button', { name: 'Mark Read 20 pages as complete' })
    expect(complete).toBeTruthy()
  })

  it('NO giant hero rings (no 64px/56px rings) — hero identity ring is compact ≤28px', async () => {
    mount()
    await screen.findByRole('heading', { level: 1, name: 'Read 20 pages' })
    // Hero has one ring, in the compact identity (not a big state-ring card)
    const hero = document.querySelector('.hd-hero')
    const ring = hero.querySelector('.hd-identity__ring')
    expect(ring).toBeTruthy()
    const ringSvgs = ring.querySelectorAll(':scope > svg') // direct child SVG (the ring itself), not nested IconCheck
    expect(ringSvgs.length).toBe(1)
    expect(Number(ringSvgs[0].getAttribute('width'))).toBeLessThanOrEqual(28)
    expect(Number(ringSvgs[0].getAttribute('height'))).toBeLessThanOrEqual(28)
    // No giant hd-state ring card
    expect(document.querySelector('.hd-state__ring')).toBeNull()
    expect(document.querySelector('.hd-state__track')).toBeNull()
    expect(document.querySelector('.hd-state__fill')).toBeNull()
    expect(document.querySelector('.hd-state__check')).toBeNull()
  })

  it('Complete toggles to Completed/Undo with canonical aria-pressed', async () => {
    mount()
    const btn = await screen.findByRole('button', { name: 'Mark Read 20 pages as complete' })
    expect(btn.getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(btn)
    await waitFor(() => expect(stored().checkins['h-read'][today]?.done).toBe(true))
    const pressed = await screen.findByRole('button', { name: 'Mark Read 20 pages as not complete' })
    expect(pressed.getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByText('Completed today.')).toBeTruthy()
  })

  it('shows streak when present in eyebrow', async () => {
    // h-run has a 30-day streak (dones(30,1))
    mount(seed(), '#/habits/h-run')
    await screen.findByRole('heading', { level: 1, name: 'Morning run' })
    const hero = document.querySelector('.hd-hero')
    expect(hero.textContent).toMatch(/streak/)
    expect(document.querySelector('.hd-hero__streak .tnum').textContent).toBe('30')
  })

  it('Paused state shows Resume primary in hero; no Complete', async () => {
    const s = seed()
    s.habits[0].pause = { from: today, until: null }
    mount(s, '#/habits/h-read')
    await screen.findByRole('heading', { level: 1, name: 'Read 20 pages' })
    const hero = document.querySelector('.hd-hero')
    expect(hero.textContent).toMatch(/Paused/)
    expect(hero.querySelector('button[aria-label="Mark Read 20 pages as complete"]')).toBeNull()
    // Primary CTA within hero is Resume (Manage section below may also expose Resume, that's fine)
    const primary = hero.querySelector('.hd-state__primary button')
    expect(primary.textContent.trim()).toBe('Resume')
  })

  it('back link navigates to habits; edit button exists with accessible name', async () => {
    mount()
    await screen.findByRole('heading', { level: 1, name: 'Read 20 pages' })
    const back = document.querySelector('.hd-back')
    expect(back).toBeTruthy()
    expect(back.textContent).toMatch(/Habits/)
    expect(screen.getByRole('button', { name: 'Edit Read 20 pages' })).toBeTruthy()
  })

  it('44px primary action on mobile viewport', async () => {
    mount()
    await screen.findByRole('button', { name: 'Mark Read 20 pages as complete' })
    // Read CSS to verify primary action min-height 44px (HabitObject primitive enforces it)
    const fs = require('fs')
    const css = fs.readFileSync('src/styles/habit-detail.css', 'utf8')
    expect(css).toMatch(/\.hd-state__primary\s*\{[^}]*min-height:\s*44px/)
  })
})
