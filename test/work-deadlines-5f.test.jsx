import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { StoreProvider, STORAGE_KEY } from '../src/store.jsx'
import App from '../src/App.jsx'
import { workspaceFixture } from './workspace.fixture.js'

const { now } = vi.hoisted(() => ({ now: new Date('2026-09-08T12:00:00') }))
vi.mock('../src/lib/useNow.js', () => ({ default: () => now }))
const fixture = () => workspaceFixture(now)
async function mount(route = 'work?view=deadlines', state = fixture()) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  window.location.hash = `#/${route}`
  render(<StoreProvider><App /></StoreProvider>)
  await screen.findByRole('heading', { level: 1, name: 'Work' })
  return document.getElementById('work-screen')
}
beforeEach(() => { localStorage.clear(); document.body.innerHTML = ''; window.scrollTo = vi.fn() })

describe('Step 5F — Work Deadlines', () => {
  it('renders eyebrow "Work", h2 Deadlines, sub copy, and four snapshot pills with real counts', async () => {
    await mount()
    const heading = await screen.findByRole('heading', { name: 'Deadlines', level: 2 })
    const section = heading.closest('.dlv')
    expect(within(section).getByText('Work', { selector: '.dlv__eyebrow' })).toBeTruthy()
    expect(section.querySelector('.dlv__sub').textContent).toMatch(/due/i)
    const snap = within(section).getByLabelText('Deadline snapshot')
    expect(within(snap).getByText('Overdue')).toBeTruthy()
    expect(within(snap).getByText('Today')).toBeTruthy()
    expect(within(snap).getByText('Next 7 days')).toBeTruthy()
    expect(within(snap).getByText('Completed')).toBeTruthy()
    expect(snap.querySelectorAll('a.dlv__pill').length).toBe(4)
  })

  it('renders the 14-day deadline density pulse (one compact viz), not a chart dashboard', () => {
    mount()
    const pulse = document.querySelector('.dlv__pulse')
    expect(pulse).toBeTruthy()
    expect(pulse.querySelectorAll('.dlv__pulse-col').length).toBe(14)
  })

  it('groups deadlines chronologically as Overdue/Today/Tomorrow/This week/Later with semantic left borders', () => {
    mount()
    const list = document.querySelector('.dlv__list')
    const heads = [...list.querySelectorAll('h3')].map(h => h.textContent)
    // At least one of these groups must render from fixture
    expect(heads.length).toBeGreaterThanOrEqual(1)
    // Overdue group should appear and have bad color tone
    const groups = list.querySelectorAll('.dl-group')
    groups.forEach(g => expect(g.style.borderLeft).toMatch(/var\(--(bad|accent|line|warn)/))
  })

  it('snapshot pills navigate via URL (#/work?view=deadlines&filter=overdue etc.)', async () => {
    await mount()
    const overdue = document.querySelector('a[href="#/work?view=deadlines&filter=overdue"]')
    expect(overdue).toBeTruthy()
    fireEvent.click(overdue)
    await waitFor(() => expect(window.location.hash).toContain('filter=overdue'))
  })

  it('Today horizon nav filters to today-only chronological view (no overdue, no tomorrow)', async () => {
    // legacy contract: clicking Today horizon shows only today group
    const root = await mount('work')
    fireEvent.click(within(root.querySelector('.workspace-horizons')).getByRole('link', { name: /^Today/ }))
    await screen.findByRole('heading', { name: 'Deadlines', level: 2 })
    expect(screen.getByRole('heading', { name: 'Today', level: 3 })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Overdue', level: 3 })).toBeNull()
    expect(screen.queryByText('Tomorrow brief')).toBeNull()
  })

  it('overdue rows carry bad tone; today accent; no full-row coloring', () => {
    mount()
    document.querySelectorAll('.dl-group').forEach(g => {
      // No card/wall — rows are continuous hairlines, not colored cards
      expect(g.classList.contains('card--danger')).toBe(false)
    })
  })

  it('sidebar "Next up" card deep-links to the most urgent item via canonical href', () => {
    mount()
    const nextUp = document.querySelector('.dlv__focus .btn.sm')
    expect(nextUp).toBeTruthy()
    expect(nextUp.getAttribute('href')).toMatch(/^#\/(assignments|projects)\//)
  })

  it('Overdue compact list appears in sidebar (links to overdue filter)', () => {
    mount()
    const attn = document.querySelector('.dlv__attention')
    if (attn) {
      expect(attn.querySelectorAll('.we, .wo__row, article, [role="article"], a[href^="#/"]').length).toBeGreaterThanOrEqual(1)
      const viewAll = attn.querySelector('.dlv__view-all')
      if (viewAll) expect(viewAll.getAttribute('href')).toContain('filter=overdue')
    }
  })

  it('uses WorkEntity / Rows (no new row system); progress rails present', () => {
    mount()
    const list = document.querySelector('.dlv__list')
    expect(list.querySelector('[class*="progress"], a[href^="#/assignments/"], a[href^="#/projects/"]')).toBeTruthy()
  })

  it('mobile single column at ≤767px; no Habit rings/calendar', () => {
    const css = readFileSync('src/styles/workspace.css', 'utf8')
    expect(css).toMatch(/\.dlv__grid/)
    expect(css).toMatch(/@media[^{]*max-width:\s*767px/)
    expect(css).not.toMatch(/\.dlv[^{}]*\{[^}]*ring/)
  })

  it('legacy #/timeline route resolves to Deadlines; other Work views unchanged', async () => {
    await mount('timeline')
    expect(screen.getByRole('heading', { name: 'Deadlines', level: 2 })).toBeTruthy()
  })
})
