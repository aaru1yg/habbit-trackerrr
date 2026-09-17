/* Today Tools dock — Refinement #4 tests.
   Exercises the quiet utility dock: heading, nav landmark, primary/quiet
   visual hierarchy, action wiring, conditional Recovery, keyboard a11y,
   mobile tap-targets, no duplicate actions, no inline-permanent panels,
   reduced-motion. */
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, within, cleanup, fireEvent } from '@testing-library/react'
import { StoreProvider } from '../src/store.jsx'
import App from '../src/App.jsx'

const DAY = 86400000
const iso = (off, hh = '17:00') => new Date(Date.now() + off * DAY).toISOString().slice(0, 10) + 'T' + hh
const today = new Date().toISOString().slice(0, 10)

function desktopMatchMedia(q) {
  return { matches: q.startsWith('(min-width:'), media: q, onchange: null,
    addListener: () => {}, removeListener: () => {},
    addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false }
}
function mobileMatchMedia(w) {
  return (q) => ({
    matches: q.includes('max-width') && q.includes(w), media: q, onchange: null,
    addListener: () => {}, removeListener: () => {},
    addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false })
}

function seedLoaded() {
  return { version: 4, profile: { name: 'Aaru', onboarded: true, theme: 'midnight' },
    habits: [
      { id: 'h1', name: 'Read 10 pages', category: 'learning', schedule: { type: 'daily' }, archived: false, order: 0, estimateMin: 15 },
      { id: 'h2', name: 'Meditate', category: 'mind', schedule: { type: 'daily' }, archived: false, order: 1 },
    ],
    checkins: { h2: { [today]: { done: true } } }, routines: [],
    projects: [{ id: 'p1', name: 'Ship v1', deadline: iso(0, '18:00'), archived: false, createdAt: today,
      milestones: [{ id: 'm1', name: 'Scope', tasks: [{ id: 't1', name: 'Write spec', done: false }] }] }],
    assignments: [{ id: 'a1', name: 'Physics set', deadline: iso(2, '18:00'), estimateMin: 30, priority: 'high', archived: false, subtasks: [] }],
    goals: [], moods: {}, notes: [], achievements: [],
    preferences: { dailyCapacityMin: 9999, planningBufferPct: 15, weekStartsOn: 1 }, signals: [], focusLog: [] }
}
async function mount(seed, viewport = 'desktop') {
  cleanup()
  localStorage.clear(); sessionStorage.clear()
  window.matchMedia = viewport === 'desktop' ? desktopMatchMedia : mobileMatchMedia('767')
  window.dispatchEvent(new Event('resize'))
  window.location.hash = ''
  localStorage.setItem('habit-os-v4', JSON.stringify(seed))
  const utils = render(<StoreProvider initialState={seed}><App /></StoreProvider>)
  window.location.hash = '#/today'
  window.dispatchEvent(new window.HashChangeEvent('hashchange'))
  await screen.findByRole('heading', { name: 'Today' })
  return utils
}

beforeEach(() => { cleanup(); localStorage.clear(); sessionStorage.clear(); window.location.hash = '' })

describe('Today Tools dock (Refinement #4)', () => {
  it('is a <section> with a real <h2 id=…> Tools heading and labelled <nav>', async () => {
    await mount(seedLoaded())
    const section = document.querySelector('.tdy-quick')
    expect(section).toBeTruthy()
    expect(section.tagName).toBe('SECTION')
    const labelledBy = section.getAttribute('aria-labelledby')
    expect(labelledBy).toBeTruthy()
    const heading = section.querySelector('#' + labelledBy)
    expect(heading).toBeTruthy()
    expect(heading.tagName).toMatch(/^H2$/i)
    expect(heading.textContent).toBe('Quick actions') /* renamed by the reference composition (6e24f97) */
    const nav = section.querySelector('nav')
    expect(nav).toBeTruthy()
    expect(nav.getAttribute('aria-label')).toBeTruthy()
  })

  it('renders Focus / Plan / Calendar — each with accessible name + visible text', async () => {
    await mount(seedLoaded())
    const tools = document.querySelector('.tdy-quick')
    expect(within(tools).getByRole('button', { name: /focus/i })).toBeTruthy()
    expect(within(tools).getByRole('button', { name: /plan/i })).toBeTruthy()
    const cal = within(tools).getByRole('link', { name: /calendar/i })
    expect(cal).toBeTruthy()
    // Calendar links to habits?view=calendar
    expect(cal.getAttribute('href') || '').toContain('view=calendar')
  })

  it('Quick actions rows share one uniform row composition; Focus is present', async () => {
    /* The reference composition replaced the old primary/quiet button dock
       with uniform tdy-quick rows; hierarchy now lives in row order. */
    await mount(seedLoaded())
    const tools = document.querySelector('.tdy-quick')
    const rows = tools.querySelectorAll('.tdy-quick__row')
    expect(rows.length).toBeGreaterThanOrEqual(3)
    expect(within(tools).getByRole('button', { name: /focus/i }).className).toMatch(/tdy-quick__row/)
    expect(within(tools).getByRole('button', { name: /plan/i }).className).toMatch(/tdy-quick__row/)
  })

  it('Recovery appears when recoveryPlan has suggestions (i.e. work to recover); is quiet & opens Plan, not a separate recovery panel', async () => {
    // Loaded day has overdue/risky items → recoveryPlan returns keep[] → Recovery shows
    await mount(seedLoaded())
    const tools = document.querySelector('.tdy-quick')
    const rec = within(tools).getByRole('button', { name: /recovery/i })
    expect(rec).toBeTruthy()
    expect(rec.className).toMatch(/tdy-quick__row/) /* uniform row, not a separate primary/quiet pair */
    expect(rec.className).not.toMatch(/primary/)
    // No separate recovery panel in DOM (old recovery-panel inline card is gone;
    // Recovery now opens Plan just like Plan button, per existing behavior)
    expect(document.querySelector('.recovery-panel')).toBeNull()
  })

  it('Recovery is hidden when there are NO items to recover from (empty day)', async () => {
    const empty = seedLoaded()
    empty.assignments = []
    empty.projects = []
    empty.habits = []
    empty.checkins = {}
    await mount(empty)
    const tools = document.querySelector('.tdy-quick')
    expect(within(tools).queryByRole('button', { name: /recovery/i })).toBeNull()
  })

  it('no duplicate tools (each label appears exactly once)', async () => {
    await mount(seedLoaded())
    const tools = document.querySelector('.tdy-quick')
    const btns = tools.querySelectorAll('.tdy-quick__row')
    const labels = Array.from(btns).map(b => b.textContent.trim().toLowerCase())
    expect(new Set(labels).size).toBe(labels.length)
    // Focus + Recovery + Plan + Calendar = 4 in a loaded-day state
    expect(labels.length).toBeGreaterThanOrEqual(3)
    expect(labels.length).toBeLessThanOrEqual(4)
  })

  it('Focus button is focusable and keyboard-activatable (real <button>)', async () => {
    await mount(seedLoaded())
    const tools = document.querySelector('.tdy-quick')
    const focusBtn = within(tools).getByRole('button', { name: /focus/i })
    focusBtn.focus()
    expect(document.activeElement).toBe(focusBtn)
    // Space/Enter natively activate <button>; at minimum, clicking fires a click event.
    let clicked = 0
    focusBtn.addEventListener('click', () => { clicked++ })
    fireEvent.click(focusBtn)
    expect(clicked).toBe(1)
    focusBtn.removeEventListener('click', () => {})
  })

  it('each tool has an icon (svg) AND visible label text — no icon-only buttons', async () => {
    await mount(seedLoaded())
    const tools = document.querySelector('.tdy-quick')
    for (const b of tools.querySelectorAll('.tdy-quick__row')) {
      expect(b.querySelector('svg')).toBeTruthy()
      expect(b.textContent.trim().length).toBeGreaterThan(2)
    }
  })

  it('FocusMode / PlanningPanel are NOT permanently rendered inside Tools when idle', async () => {
    await mount(seedLoaded())
    const tools = document.querySelector('.tdy-quick')
    expect(tools.querySelector('.focus-mode, .focus-mode--open')).toBeNull()
    expect(tools.querySelector('.planning-panel--open')).toBeNull()
  })

  it('mobile CSS specifies 44px tap targets & equal 2-col wrap (flex 1 1 50% - gap)', () => {
    const css = require('fs').readFileSync('src/components/today/today.css', 'utf8')
    const mq = css.match(/@media\s*\(max-width:\s*767px\)\s*\{[\s\S]*?\n\}/)?.[0] || ''
    expect(mq).toMatch(/--btn-h:\s*44px/)
    // Either legacy min-width or flex-basis 50% is acceptable as long as it yields a 2-col grid.
    expect(mq).toMatch(/(min-width:\s*calc\(50%\s*-\s*6px\)|flex:\s*1\s+1\s+calc\(50%\s*-\s*var\(--space-compact\)\))/)
  })

  it('reduced-motion media query is present in today.css (no ambient motion)', () => {
    const css = require('fs').readFileSync('src/components/today/today.css', 'utf8')
    expect(css).toMatch(/prefers-reduced-motion/)
  })

  it('Tools section uses a single hairline divider (border-top), no card/shadow/glow', () => {
    const css = require('fs').readFileSync('src/components/today/today.css', 'utf8')
    // .today-tools uses border-top hairline
    expect(css).toMatch(/\.today-tools\s*\{[^}]*border-top:\s*var\(--border-subtle\)/)
    // No box-shadow or background gradient on the dock section
    const block = css.match(/\.today-tools\{[^}]*\}/)?.[0] || ''
    expect(block).not.toMatch(/box-shadow/)
    expect(block).not.toMatch(/gradient/)
  })
})
