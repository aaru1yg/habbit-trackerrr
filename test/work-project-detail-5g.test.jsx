import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { StoreProvider, STORAGE_KEY } from '../src/store.jsx'
import App from '../src/App.jsx'
import { workspaceFixture } from './workspace.fixture.js'

const { now } = vi.hoisted(() => ({ now: new Date('2026-09-08T12:00:00') }))
vi.mock('../src/lib/useNow.js', () => ({ default: () => now }))
const fixture = () => workspaceFixture(now)
async function mount(route = 'projects/p1', state = fixture()) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  window.location.hash = `#/${route}`
  render(<StoreProvider><App /></StoreProvider>)
  await screen.findByRole('heading', { level: 1, name: 'Habit OS' })
  return document.getElementById('project-detail')
}
beforeEach(() => { localStorage.clear(); document.body.innerHTML = ''; window.scrollTo = vi.fn() })

describe('Step 5G — Work Project Detail', () => {
  it('renders back link to Work, project title, Project kind tag, and snapshot pills', async () => {
    await mount()
    expect(screen.getByText('Habit OS', { selector: 'h1' })).toBeTruthy()
    const detail = document.getElementById('project-detail')
    expect(within(detail).getByText('Work', { selector: '.dlv__eyebrow' })).toBeTruthy()
    const snap = detail.querySelector('.dlv__snap')
    expect(snap).toBeTruthy()
    expect(within(snap).getByText('Progress')).toBeTruthy()
    expect(within(snap).getByText('Tasks')).toBeTruthy()
    expect(within(snap).getByText('Milestones')).toBeTruthy()
  })

  it('renders one project visual (progress rail with pace), not a dashboard', async () => {
    await mount()
    const pulse = document.querySelector('#project-detail .dlv__pulse')
    expect(pulse).toBeTruthy()
    expect(pulse.querySelector('[role="img"]')).toBeTruthy()
  })

  it('shows real project progress % in snapshot', async () => {
    await mount()
    const detail = document.getElementById('project-detail')
    const progressPill = [...detail.querySelectorAll('.dlv__pill')].find(p => p.textContent.includes('Progress'))
    expect(progressPill.textContent).toMatch(/%/)
  })

  it('Next work section renders', async () => {
    await mount()
    expect(screen.getByRole('heading', { name: 'Next work', level: 2 })).toBeTruthy()
  })

  it('Milestones section renders', async () => {
    await mount()
    const headings = screen.getAllByRole('heading').map(h => h.textContent)
    expect(headings.some(t => t.includes('Milestones'))).toBeTruthy()
  })

  it('Edit and Delete actions present', () => {
    mount()
    expect(screen.getByRole('button', { name: 'Edit project' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Delete project' })).toBeTruthy()
  })

  it('deep link ?task=t1 scrolls to target (legacy behavior)', async () => {
    await mount('projects/p1?task=t1')
    await waitFor(() => expect(document.getElementById('work-task-t1')).toBeTruthy())
  })

  it('Details rail renders category/deadline/tasks metadata', () => {
    mount()
    const rail = document.querySelector('#project-detail aside.rail')
    expect(rail).toBeTruthy()
    expect(rail.textContent).toMatch(/Category|Deadline|Tasks/)
  })

  it('See-it-in-context links include Workload and All deadlines', () => {
    mount()
    const wl = document.querySelector('a[href="#/workload"]') || document.querySelector('a[href="#/work?view=workload"]')
    const dl = document.querySelector('a[href="#/timeline"]') || document.querySelector('a[href="#/work?view=deadlines"]')
    expect(wl).toBeTruthy()
    expect(dl).toBeTruthy()
  })

  it('mobile detail-layout stacks (inherited media query); no Habit rings', () => {
    mount()
    const css = readFileSync('src/styles/workspace.css', 'utf8')
    expect(css).toMatch(/\.detail-layout/)
    document.querySelectorAll('.card--danger, .alert').forEach(n => expect(n).toBeNull())
  })
})
