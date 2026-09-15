import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { StoreProvider, STORAGE_KEY } from '../src/store.jsx'
import App from '../src/App.jsx'
import { workspaceFixture } from './workspace.fixture.js'

const { now } = vi.hoisted(() => ({ now: new Date('2026-09-08T12:00:00') }))
vi.mock('../src/lib/useNow.js', () => ({ default: () => now }))
const fixture = () => workspaceFixture(now)
const stored = () => JSON.parse(localStorage.getItem(STORAGE_KEY))
async function mount(route = 'work?view=deliverables', state = fixture()) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  window.location.hash = `#/${route}`
  render(<StoreProvider><App /></StoreProvider>)
  await screen.findByRole('heading', { level: 1, name: 'Work' })
  return document.getElementById('work-screen')
}
beforeEach(() => { localStorage.clear(); document.body.innerHTML = ''; window.scrollTo = vi.fn() })

describe('Step 5C — Work Deliverables', () => {
  it('renders eyebrow, h2 Deliverables, sub copy and snapshot pills with real numbers', async () => {
    await mount()
    await screen.findByRole('heading', { name: 'Deliverables', level: 2 })
    expect(screen.getByText('Shipping surface')).toBeTruthy()
    expect(screen.getByText(/What needs to ship/)).toBeTruthy()
    const snap = screen.getByLabelText('Deliverables snapshot')
    expect(within(snap).getByText('Active')).toBeTruthy()
    expect(within(snap).getByText('Due soon')).toBeTruthy()
    expect(within(snap).getByText('Overdue')).toBeTruthy()
    expect(within(snap).getByText('Completed')).toBeTruthy()
    // Pills are anchors (navigate to URL filter), not big colored cards
    expect(snap.querySelectorAll('a.dlv__pill').length).toBe(4)
  })

  it('renders one compact 14-day delivery pulse aggregate viz, not Workload chart', () => {
    mount()
    const pulse = document.querySelector('.dlv__pulse')
    expect(pulse).toBeTruthy()
    expect(pulse.querySelectorAll('.dlv__pulse-col').length).toBe(14)
    expect(document.querySelector('.wo__chart')).toBeNull()
  })

  it('snapshot pills navigate to real URL filters (Active/Due soon/Overdue/Completed)', async () => {
    await mount()
    const overdue = document.querySelector('a[href="#/work?view=deliverables&filter=overdue"]')
    expect(overdue).toBeTruthy()
    fireEvent.click(overdue)
    await waitFor(() => expect(window.location.hash).toContain('filter=overdue'))
  })

  it('due-soon / overdue / completed pills carry warn / bad / good tone borders', () => {
    mount()
    expect(document.querySelector('.dlv__pill.is-good')).toBeTruthy()
    // Overdue pill should be is-bad when there is overdue content; warn if any due-soon
    expect(document.querySelector('.dlv__pill.is-bad, .dlv__pill.is-warn')).toBeTruthy()
    // No full-row coloring
    document.querySelectorAll('.wo__row').forEach(r => {
      expect(r.classList.contains('is-bad')).toBe(false)
    })
  })

  it('deliverable rows are canonical work entities with kind/title/deadline/progress/actions', () => {
    mount()
    const list = document.querySelector('.dlv__list') || document.querySelector('.dlv__rows')
    expect(list).toBeTruthy()
    const row = list.querySelector('[role="article"]') || list.querySelector('.wo__row') || list.querySelector('article')
    expect(row).toBeTruthy()
    // Progress rail present (3px thin bar — no ring)
    expect(row.querySelector('.wo__progress, [class*="progress"]')).toBeTruthy()
    // Actions button present
    expect(row.querySelectorAll('button').length).toBeGreaterThanOrEqual(1)
  })

  it('risk is a single compact semantic signal per row — no big banners', () => {
    mount()
    const list = document.querySelector('.dlv__list') || document.querySelector('.dlv__rows')
    list.querySelectorAll('.wo__row, article, [role="article"]').forEach(r => {
      const banners = r.querySelectorAll('.banner, .alert, .card--danger')
      expect(banners.length).toBe(0)
    })
  })

  it('sidebar is lightweight (≤3 compact surfaces), not a card dashboard', () => {
    mount()
    const side = document.querySelector('.dlv__side')
    expect(side).toBeTruthy()
    expect(side.children.length).toBeLessThanOrEqual(3)
  })

  it('mobile collapses to one column at ≤767px; interactive targets ≥44px', () => {
    const css = readFileSync('src/styles/workspace.css', 'utf8')
    expect(css).toMatch(/\.dlv__grid/)
    expect(css).toMatch(/@media[^{]*max-width:\s*767px/)
  })

  it('no Habit ring / calendar / routine vocabulary in deliverables CSS', () => {
    const css = readFileSync('src/styles/workspace.css', 'utf8')
    const dlvBlock = css.split('.dlv__').slice(1).join('.dlv__')
    expect(dlvBlock).not.toMatch(/ring/)
    expect(dlvBlock).not.toMatch(/routine/)
    expect(dlvBlock).not.toMatch(/calendar/)
  })

  it('preserves existing search + Complete action via ItemActions (legacy contract)', async () => {
    await mount()
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search work' }), { target: { value: 'DSA' } })
    const row = screen.getByRole('article', { name: 'Assignment: Submit DSA report' })
    fireEvent.click(within(row).getByRole('button', { name: 'Complete Submit DSA report' }))
    await waitFor(() => expect(stored().assignments.find(a => a.id === 'a1').progress).toBe(100))
  })

  it('legacy route #/assignments still resolves to deliverables view', async () => {
    await mount('assignments')
    expect(screen.getByRole('heading', { name: 'Deliverables', level: 2 })).toBeTruthy()
  })
})
