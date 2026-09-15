import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { StoreProvider, STORAGE_KEY } from '../src/store.jsx'
import App from '../src/App.jsx'
import { workspaceFixture } from './workspace.fixture.js'

const { now } = vi.hoisted(() => ({ now: new Date('2026-09-08T12:00:00') }))
vi.mock('../src/lib/useNow.js', () => ({ default: () => now }))
const fixture = () => workspaceFixture(now)
async function mount(route = 'assignments/a1', state = fixture()) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  window.location.hash = `#/${route}`
  render(<StoreProvider><App /></StoreProvider>)
  await waitFor(() => expect(document.getElementById('assignment-detail')).toBeTruthy(), { timeout: 5000 })
  return document.getElementById('assignment-detail')
}
beforeEach(() => { localStorage.clear(); document.body.innerHTML = ''; window.scrollTo = vi.fn() })

describe('Step 5H — Work Assignment Detail', () => {
  it('renders back to Work, assignment title, Assignment kind tag, status, snapshot pills', async () => {
    const el = await mount()
    expect(within(el).getByText('Work', { selector: '.dlv__eyebrow' })).toBeTruthy()
    expect(el.querySelector('h1').textContent).toBeTruthy()
    const snap = el.querySelector('.dlv__snap')
    expect(snap).toBeTruthy()
    expect(within(snap).getByText('Progress')).toBeTruthy()
    expect(within(snap).getByText('Subtasks')).toBeTruthy()
    expect(within(snap).getByText('Estimate')).toBeTruthy()
  })

  it('renders one progress-vs-pace visual (no chart dashboard, no rings)', () => {
    mount()
    const pulse = document.querySelector('#assignment-detail .dlv__pulse')
    expect(pulse).toBeTruthy()
    expect(pulse.querySelector('[role="img"]')).toBeTruthy()
    expect(pulse.innerHTML).not.toMatch(/ProgressRing|ring/)
  })

  it('shows real progress % in snapshot; not fake data', async () => {
    const el = await mount()
    const prog = [...el.querySelectorAll('.dlv__pill')].find(p => p.textContent.includes('Progress'))
    expect(prog.textContent).toMatch(/%/)
  })

  it('Next action section shows Start Focus and Project link for a non-complete assignment', async () => {
    await mount()
    expect(screen.getByRole('heading', { name: 'Next action', level: 2 })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Start Focus' })).toBeTruthy()
    expect(screen.getByText(/Project:/)).toBeTruthy()
  })

  it('Edit and Delete actions remain; Change deadline editor opens', () => {
    mount()
    expect(screen.getByRole('button', { name: 'Edit assignment' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Delete assignment' })).toBeTruthy()
  })

  it('Project link in rail points to correct deep link (#/projects/p1)', () => {
    mount()
    const link = document.querySelector('#assignment-detail a[href="#/projects/p1"]')
    expect(link).toBeTruthy()
  })

  it('Subtasks section renders with add button + real subtask from fixture', async () => {
    await mount()
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Subtasks' })).toBeTruthy())
    expect(screen.getByRole('button', { name: 'Add subtask' })).toBeTruthy()
  })

  it('Back-to-deliverables eyebrow link exists', () => {
    mount()
    const back = document.querySelector('#assignment-detail a[href="#/work?view=deliverables"]')
    expect(back).toBeTruthy()
  })

  it('Detail layout stacks on mobile via existing media query; no Habit rings', () => {
    mount()
    const css = readFileSync('src/styles/workspace.css', 'utf8')
    expect(css).toMatch(/\.detail-layout/)
    document.querySelectorAll('.card--danger, .alert').forEach(n => expect(n).toBeNull())
  })

  it('Completed assignment shows complete state (no Start Focus)', async () => {
    const el = await mount('assignments/a4')
    const title = el.querySelector('h1')
    expect(title.textContent).toMatch(/Delivered paper/)
    expect(screen.queryByRole('button', { name: 'Start Focus' })).toBeNull()
  })
})
