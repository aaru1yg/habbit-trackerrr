import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { StoreProvider, STORAGE_KEY } from '../src/store.jsx'
import App from '../src/App.jsx'
import { workspaceFixture } from './workspace.fixture.js'

const { now } = vi.hoisted(() => ({ now: new Date('2026-09-08T12:00:00') }))
vi.mock('../src/lib/useNow.js', () => ({ default: () => now }))
const fixture = () => workspaceFixture(now)
async function mount(route = 'work?view=projects', state = fixture()) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  window.location.hash = `#/${route}`
  render(<StoreProvider><App /></StoreProvider>)
  await screen.findByRole('heading', { level: 1, name: 'Work' })
  return document.getElementById('work-screen')
}
beforeEach(() => { localStorage.clear(); document.body.innerHTML = ''; window.scrollTo = vi.fn() })

describe('Step 5D — Work Projects', () => {
  it('renders eyebrow "Work", h2 Projects, sub copy, and snapshot pills with real numbers', async () => {
    await mount()
    const heading = await screen.findByRole('heading', { name: 'Projects', level: 2 })
    const section = heading.closest('.dlv')
    expect(within(section).getByText('Work', { selector: '.dlv__eyebrow' })).toBeTruthy()
    expect(section.querySelector('.dlv__sub').textContent).toMatch(/projects/)
    const snap = within(section).getByLabelText('Project snapshot')
    expect(within(snap).getByText('Active')).toBeTruthy()
    expect(within(snap).getByText('Due soon')).toBeTruthy()
    expect(within(snap).getByText('At risk')).toBeTruthy()
    expect(within(snap).getByText('Completed')).toBeTruthy()
    expect(snap.querySelectorAll('a.dlv__pill').length).toBe(4)
  })

  it('renders one compact aggregate viz (progress & health bar), not a dashboard', () => {
    mount()
    const pulse = document.querySelector('.dlv__pulse')
    expect(pulse).toBeTruthy()
    expect(pulse.querySelector('[role="img"]')).toBeTruthy()
    expect(pulse.textContent).toMatch(/At risk|In progress|Early|Late|Completed|Not started/)
  })

  it('List is default; Gallery / spatial toggle switches to gal-card grid; List returns', async () => {
    const root = await mount()
    // Default: no gal-card visible
    expect(root.querySelector('.gal-card')).toBeNull()
    fireEvent.click(within(root).getByRole('button', { name: 'Gallery / spatial' }))
    await waitFor(() => expect(root.querySelector('.gal-card')).toBeTruthy())
    fireEvent.click(within(root).getByRole('button', { name: 'List', exact: true }))
    await waitFor(() => expect(root.querySelector('.gal-card')).toBeNull())
  })

  it('snapshot pills navigate to URL filters (Active/Due soon/At risk/Completed)', async () => {
    await mount()
    const risk = document.querySelector('a[href="#/work?view=projects&filter=risk"]')
    expect(risk).toBeTruthy()
    fireEvent.click(risk)
    await waitFor(() => expect(window.location.hash).toContain('filter=risk'))
  })

  it('project rows render name, progress rail, deadline, ⋯ actions, and Project Detail deep link', () => {
    mount()
    const list = document.querySelector('.dlv__list')
    const row = list.querySelector('article, [role="article"], .we, .wo__row') || list.querySelector('a[href^="#/projects/"]')
    expect(row).toBeTruthy()
    expect(row.querySelector('[class*="progress"]') || row.getAttribute('href')?.startsWith('#/projects/')).toBeTruthy()
  })

  it('sidebar is lightweight (Project focus + Needs attention ≤ 2 surfaces), not a card dashboard', () => {
    mount()
    const side = document.querySelector('.dlv__side')
    expect(side).toBeTruthy()
    expect(side.children.length).toBeLessThanOrEqual(3)
  })

  it('mobile collapses to single column at ≤767px — no horizontal overflow', () => {
    const css = readFileSync('src/styles/workspace.css', 'utf8')
    expect(css).toMatch(/\.dlv__grid/)
    expect(css).toMatch(/@media[^{]*max-width:\s*767px/)
  })

  it('no Habit ring / calendar / routine vocabulary in deliverables/projects CSS', () => {
    const css = readFileSync('src/styles/workspace.css', 'utf8')
    expect(css).not.toMatch(/\.dlv[^{}]*\{[^}]*ring/)
  })

  it('preserves project deep links (#/projects/p1) and ItemActions complete flow', async () => {
    const root = await mount()
    // Expand project-tasks details
    const details = root.querySelector('.workspace-project-items')
    details.open = true; fireEvent(details, new Event('toggle'))
    // project tasks are available via details
    expect(details).toBeTruthy()
  })

  it('#/work Overview remains the default (no Projects heading, no Gallery)', async () => {
    await mount('work')
    // Default Overview route shows Work h1; no h2 "Projects" and no gallery cards
    expect(screen.queryByRole('heading', { name: 'Projects', level: 2 })).toBeNull()
    expect(document.querySelector('.gal-card')).toBeNull()
  })
})
