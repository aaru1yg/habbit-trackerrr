/* Step 5B: Work Overview focused tests. */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { StoreProvider, STORAGE_KEY } from '../src/store.jsx'
import App from '../src/App.jsx'
import { workspaceFixture } from './workspace.fixture.js'

const { now } = vi.hoisted(() => ({ now: new Date('2026-09-08T12:00:00') }))
vi.mock('../src/lib/useNow.js', () => ({ default: () => now }))
const fixture = () => workspaceFixture(now)
async function mount(route = 'work', state = fixture()) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  window.location.hash = `#/${route}`
  render(<StoreProvider><App /></StoreProvider>)
  await screen.findByRole('heading', { level: 1, name: 'Work' })
  return document.getElementById('work-screen')
}
beforeEach(() => { localStorage.clear(); window.scrollTo = vi.fn() })

describe('Step 5B: Work Overview composition', () => {
  it('renders snapshot, active, attention, coming up, and workload tile', async () => {
    const root = await mount()
    expect(within(root).getByLabelText('Work summary')).toBeTruthy()
    expect(within(root).getByRole('heading', { name: 'Active work', level: 2 })).toBeTruthy()
    expect(within(root).getByRole('heading', { name: 'Needs attention', level: 2 })).toBeTruthy()
    expect(within(root).getByRole('heading', { name: 'Coming up', level: 2 })).toBeTruthy()
    expect(within(root).getByRole('heading', { name: 'Workload snapshot', level: 2 })).toBeTruthy()
  })

  it('snapshot is compact inline pills, not four metric cards', async () => {
    const root = await mount()
    const snap = within(root).getByLabelText('Work summary')
    expect(snap.querySelectorAll('a').length).toBeGreaterThanOrEqual(3)
    expect(root.querySelector('.workspace-summary .card')).toBeNull()
  })

  it('Active Work uses canonical WorkEntity rows, not UniversalWorkRow cards, no gallery default', async () => {
    const root = await mount()
    const active = within(root).getByRole('heading', { name: 'Active work' }).closest('section')
    expect(active.querySelectorAll('.we').length).toBeGreaterThan(0)
    expect(active.querySelectorAll('.workspace-row').length).toBe(0)
    expect(root.querySelector('.gal-grid')).toBeNull()
    expect(root.querySelector('.gal-card')).toBeNull()
  })

  it('contextual tabs expose Overview/Deliverables/Projects/Workload/Deadlines', async () => {
    await mount()
    const nav = screen.getByRole('navigation', { name: 'Work sections' })
    for (const label of ['Overview', 'Deliverables', 'Projects', 'Workload', 'Deadlines']) {
      expect(within(nav).getByRole('link', { name: label })).toBeTruthy()
    }
  })

  it('Needs attention is a single list with semantic risk, no red card banners', async () => {
    const root = await mount()
    const attention = within(root).getByRole('heading', { name: 'Needs attention' }).closest('section')
    expect(attention.querySelectorAll('.we').length).toBeGreaterThan(0)
    expect(attention.querySelectorAll('.workspace-overload').length).toBe(0)
    expect(attention.querySelectorAll('[data-tone=bad], [data-tone=warn]').length).toBeGreaterThan(0)
  })

  it('Coming up is compact horizon counts, not the full Deadlines timeline', async () => {
    const root = await mount()
    const coming = within(root).getByRole('heading', { name: 'Coming up' }).closest('section')
    expect(coming.querySelectorAll('.workspace-deadline-group').length).toBe(0)
    expect(coming.querySelectorAll('.wo__group').length).toBeGreaterThan(0)
    expect(within(coming).getByRole('link', { name: /View deadlines/ })).toBeTruthy()
  })

  it('projects view keeps Gallery behind a toggle (list default); gallery absent on overview', async () => {
    await mount()
    expect(screen.queryByRole('button', { name: 'Gallery / spatial' })).toBeNull()
    fireEvent.click(screen.getByRole('link', { name: 'Projects' }))
    const listBtn = await screen.findByRole('button', { name: 'List' })
    expect(listBtn.getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: 'Gallery / spatial' }).getAttribute('aria-pressed')).toBe('false')
  })

  it('mobile CSS collapses to single column; tabs keep 44px targets', () => {
    const css = readFileSync('src/styles/workspace.css', 'utf8')
    expect(css).toMatch(/@media\s*\(max-width:\s*767px\)/)
    const mobileBlock = css.match(/@media\s*\(max-width:\s*767px\)\s*\{([\s\S]*?)\n\}/)?.[1] || ''
    expect(mobileBlock).toMatch(/grid-template-columns:\s*1fr/)
    expect(css).toMatch(/\.workspace-tabs\s+a\s*\{[^}]*min-height:\s*44px/)
  })

  it('WorkEntity progress uses 3px thin rails; no circular rings on overview', async () => {
    const root = await mount()
    expect(root.querySelectorAll('.p-progress--thin').length).toBeGreaterThan(0)
    expect(root.querySelector('.progress-ring, .ring, .habit-ring')).toBeNull()
  })

  it('empty state shows title + Create work and hides snapshot/side sections', async () => {
    await mount('work', { ...fixture(), projects: [], assignments: [] })
    expect(screen.getByRole('heading', { name: 'Your work starts here.' })).toBeTruthy()
    expect(screen.queryByText('Workload snapshot')).toBeNull()
    expect(screen.queryByLabelText('Work summary')).toBeNull()
    expect(screen.getAllByRole('button', { name: 'Create work' }).length).toBeGreaterThan(0)
  })

  it('work route uses PageContainer size="workspace"', async () => {
    await mount()
    expect(document.querySelector('.app-page--workspace')).toBeTruthy()
  })
})
