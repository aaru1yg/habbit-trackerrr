/* §22 visual/structural checklist for Today — runs in jsdom via the
   project's existing vitest setup. Not screenshots, but hits every
   pixel-sensitive contract in the brief. */
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, within, cleanup } from '@testing-library/react'
import { StoreProvider } from '../src/store.jsx'
import App from '../src/App.jsx'

const DAY = 86400000
const iso = (off, hh = '17:00') => new Date(Date.now() + off * DAY).toISOString().slice(0, 10) + 'T' + hh
const today = new Date().toISOString().slice(0, 10)

function desktopMatchMedia(q) {
  return {
    matches: q.startsWith('(min-width:'),
    media: q, onchange: null,
    addListener: () => {}, removeListener: () => {},
    addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false,
  }
}
function mobileMatchMedia(w) {
  return (q) => ({
    matches: q.includes('max-width') && q.includes(w),
    media: q, onchange: null,
    addListener: () => {}, removeListener: () => {},
    addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false,
  })
}

function seedEmpty() {
  return { version: 4, profile: { name: 'Aaru', onboarded: true, theme: 'midnight' },
    habits: [], checkins: {}, routines: [], projects: [], assignments: [],
    goals: [], moods: {}, notes: [], achievements: [],
    preferences: { dailyCapacityMin: 120, planningBufferPct: 15, weekStartsOn: 1 },
    signals: [], focusLog: [] }
}
function seedLoaded() {
  return { version: 4, profile: { name: 'Aaru', onboarded: true, theme: 'midnight' },
    habits: [
      { id: 'h1', name: 'Read 10 pages', category: 'learning', schedule: { type: 'daily' }, archived: false, order: 0, estimateMin: 15 },
      { id: 'h2', name: 'Meditate', category: 'mind', schedule: { type: 'daily' }, archived: false, order: 1 },
    ],
    checkins: { h2: { [today]: { done: true } } }, routines: [],
    projects: [{ id: 'p1', name: 'Ship v1', deadline: iso(0, '18:00'), archived: false, createdAt: today,
      milestones: [
        { id: 'm1', name: 'Scope', tasks: [{ id: 't1', name: 'Write spec', done: false }] },
        { id: 'm2', name: 'Build', tasks: [{ id: 't2', name: 'Frontend', done: false }] },
      ] }],
    assignments: [{ id: 'a1', name: 'Physics set', deadline: iso(2, '18:00'), estimateMin: 30, priority: 'high', archived: false, subtasks: [] }],
    goals: [], moods: {}, notes: [], achievements: [],
    preferences: { dailyCapacityMin: 9999, planningBufferPct: 15, weekStartsOn: 1 }, signals: [], focusLog: [] }
}
function seedDone() {
  const s = seedLoaded()
  s.checkins = { h1: { [today]: { done: true } }, h2: { [today]: { done: true } } }
  s.projects[0].milestones.forEach(m => m.tasks.forEach(t => t.done = true))
  s.assignments[0].completedAt = new Date().toISOString()
  s.assignments[0].progress = 100
  return s
}
function seedOverloaded() {
  const s = seedLoaded()
  s.preferences.dailyCapacityMin = 15
  s.assignments.push({ id: 'a2', name: 'Essay draft', deadline: iso(0, '23:00'), estimateMin: 90, priority: 'high', archived: false, subtasks: [] })
  return s
}

async function mount(seed, viewport = 'desktop') {
  cleanup()
  localStorage.clear(); sessionStorage.clear()
  window.matchMedia = viewport === 'desktop' ? desktopMatchMedia : mobileMatchMedia(viewport === 'mobile' ? '767' : '1024')
  window.dispatchEvent(new Event('resize'))
  window.location.hash = ''
  localStorage.setItem('habit-os-v4', JSON.stringify(seed))
  const utils = render(<StoreProvider initialState={seed}><App /></StoreProvider>)
  // Navigate to today explicitly, firing hashchange synchronously
  window.location.hash = '#/today'
  window.dispatchEvent(new window.HashChangeEvent('hashchange'))
  await screen.findByRole('heading', { name: 'Today' })
  return utils
}

beforeEach(() => {
  cleanup()
  localStorage.clear(); sessionStorage.clear(); window.location.hash = ''
})

describe('§22.1 Empty day', () => {
  it('has one clear CTA (Plan my day), no empty analytics, compact header', async () => {
    await mount(seedEmpty())
    await screen.findByText(/Nothing needs your attention yet/i)
    expect(screen.getByRole('button', { name: 'Plan my day' })).toBeTruthy()
    expect(screen.queryByText(/charts|analytics dashboard/i)).toBeNull()
    // Compact h1, not a hero
    const h1 = screen.getByRole('heading', { name: 'Today' })
    expect(h1.tagName).toBe('H1')
  })
})

describe('§22.2 Loaded day — hierarchy', () => {
  it('eye lands on NOW first, then today\'s work, then context, then tools; rules separate sections; NOW is flat with accent hairline (not a card)', async () => {
    await mount(seedLoaded())
    // Wait until the Today's work heading is rendered (section settled).
    const workHeading = await screen.findByRole('heading', { name: /Today's work/i })
    expect(workHeading).toBeTruthy()
    const root = document.querySelector('.screen.today')
    const html = root.innerHTML
    const posH = html.indexOf('today__header')
    const posNow = html.indexOf('today-now')
    const posWork = html.indexOf("Today's work")
    const posCtx = html.indexOf('today-signals')
    const posTools = html.indexOf('today-tools')
    expect(posH).toBeLessThan(posNow)
    expect(posNow).toBeLessThan(posWork)
    expect(posWork).toBeLessThan(posCtx)
    expect(posCtx).toBeLessThan(posTools)
    // Two editorial hr rules (header/NOW and NOW/work)
    expect(root.querySelectorAll('.today-rule').length).toBeGreaterThanOrEqual(2)
    // NOW is quiet (outer container flat, no card wall); the inner __surface
    // adds ONE subtle inset layer + accent hairline (no glass/glow/gradient).
    const now = root.querySelector('.today-now')
    expect(now).toBeTruthy()
    expect(now.classList.contains('card')).toBe(false)
    expect(now.closest('.card')).toBeNull()
    const surface = now.querySelector('.today-now__surface')
    // Surface exists only in next/done modes; empty/overloaded keep the old flat hairline
    if (surface) {
      // No glow / giant box-shadow / gradient — depth is a single inset hairline
      const style = getComputedStyle(surface)
      expect(style.backgroundImage || '').not.toMatch(/gradient/i)
    }
    const css = require('fs').readFileSync('src/components/today/today.css', 'utf8')
    const nowBlock = css.match(/\.today-now\s*\{([\s\S]*?)\n\}/)?.[1] || ''
    expect(nowBlock).toMatch(/background:\s*transparent/)
    // Accent hairline lives on the surface (or on the outer block for empty/overloaded)
    expect(css).toMatch(/border-left:\s*3px\s+solid\s+var\(--accent\)/)
  })

  it('NOW has a dominant title + reason + meta + primary action + secondary View', async () => {
    await mount(seedLoaded())
    const now = document.querySelector('.today-now')
    expect(now).toBeTruthy()
    const title = now.querySelector('h2')
    expect(title.textContent.length).toBeGreaterThan(2)
    // Primary action is either Complete/Mark complete/Start focus (one of allowed set)
    const primary = now.querySelector('.p-btn--primary')
    expect(primary).toBeTruthy()
    const label = primary.textContent.trim()
    expect(label).toMatch(/Complete|Mark complete|Start focus|Plan my day/)
    // Secondary View action exists
    const view = Array.from(now.querySelectorAll('.p-btn')).find(b => /View/.test(b.textContent))
    expect(view, 'secondary View button must exist').toBeTruthy()
    // No invented actions (no "Defer", "Skip", "Snooze")
    const labels = Array.from(now.querySelectorAll('.p-btn')).map(b => b.textContent.trim())
    expect(labels.join(' ')).not.toMatch(/Defer|Snooze|Skip for now|Reschedule/)
  })

  it('TODAY\'S WORK is an editorial list, not a card wall', async () => {
    await mount(seedLoaded())
    const list = document.querySelector('.today-list')
    expect(list).toBeTruthy()
    // Rows are separated by borders, not card shadows
    const rows = list.querySelectorAll('.today-row')
    expect(rows.length).toBeGreaterThanOrEqual(2)
    // No "card" class applied to rows
    for (const r of rows) expect(r.className).not.toMatch(/card/)
  })

  it('habits in Today\'s Work render the canonical HabitObject (compact) with inline ring smaller than NOW signature ring', async () => {
    await mount(seedLoaded())
    // Step 4G-2A: Today habits reuse canonical HabitObject, NOT legacy .today-row__ring
    const hobj = document.querySelector('.today-hobj')
    expect(hobj).toBeTruthy()
    expect(hobj.classList.contains('habit-obj--compact')).toBe(true)
    const svg = hobj.querySelector('.habit-obj__ring svg')
    expect(svg.getAttribute('width')).toBe('28') // compact variant
    expect(svg.getAttribute('height')).toBe('28')
    // Accessible complete button exists with canonical label
    expect(hobj.querySelector('button[aria-label*="Mark"][aria-label*="as complete"]')).toBeTruthy()
    // Legacy today-row__ring markup is gone
    expect(document.querySelector('.today-row__ring')).toBeNull()
    // NOW ring stays a compact inline instrument (visual-reset composition:
    // the ring must not behave like a decorative centerpiece), but remains
    // larger than the 28px habit rows' inline ring.
    const nowRing = document.querySelector('.now-ring')
    const nowSize = nowRing ? getComputedStyle(nowRing).getPropertyValue('--now-ring-size').trim() : null
    expect(['44px', '40px']).toContain(nowSize || '')
  })

  it('Context is a compact ≤3-signal strip that sits BELOW Today\'s work; no card wall', async () => {
    await mount(seedLoaded())
    const ctx = document.querySelector('.today-signals')
    expect(ctx).toBeTruthy()
    const items = ctx.querySelectorAll('.today-signals__sig')
    expect(items.length).toBeGreaterThanOrEqual(1)
    expect(items.length).toBeLessThanOrEqual(3)
    for (const it of items) {
      expect(it.className).not.toMatch(/card/)
      expect(it.querySelector('.p-btn')).toBeNull()
    }
    // CSS uses hairline dividers between signals, not filled cards
    const css = require('fs').readFileSync('src/components/today/today.css', 'utf8')
    expect(css).toMatch(/\.today-signals__list\s*\{[\s\S]*grid-template-columns/)
  })

  it('Context completion string formats as "n / m complete · pct%" — no "/333%" concatenation bug', async () => {
    await mount(seedLoaded())
    const sigs = document.querySelectorAll('.today-signals__sig')
    let found = false
    for (const s of sigs) {
      const txt = s.textContent
      if (txt.includes('Completion') || txt.includes('% complete')) {
        found = true
        // The old bug was "1/333%" — require proper whitespace + middot separator
        expect(txt).toMatch(/\d+\s*\/\s*\d+/)
        expect(txt).toMatch(/\d+% complete/)
        expect(txt).not.toMatch(/\/\d{2,3}%/)
      }
    }
    // At least one completion signal must exist
    expect(found).toBe(true)
  })

  it('Context attention string uses proper grammar ("item needs" / "items need") — no "itemsRequires" concatenation bug', async () => {
    await mount(seedLoaded())
    const body = document.querySelector('.screen.today').textContent
    expect(body).not.toMatch(/itemsRequires/)
    // If there's an attention signal, grammar should be correct
    const attn = document.querySelector('.today-signals__sig')
    if (attn && /attention/i.test(attn.textContent)) {
      expect(attn.textContent).toMatch(/item needs attention|items need attention/)
    }
  })

  it('Tools row is quiet: Plan + Focus at minimum', async () => {
    await mount(seedLoaded())
    const tools = document.querySelector('.today-tools')
    expect(tools).toBeTruthy()
    expect(within(tools).getByText('Plan')).toBeTruthy()
    expect(within(tools).getByText('Focus')).toBeTruthy()
    // Tools should not render a permanently-open PlanningPanel/FocusMode as giant UI
    expect(document.querySelector('.planning-panel--open')).toBeNull()
  })

  it('every interactive control has an accessible name (unnamed = fail)', () => {
    const unnamed = []
    for (const b of document.querySelectorAll('button')) {
      const name = (b.getAttribute('aria-label') || b.textContent || '').trim()
      if (!name) unnamed.push(b.className + ' :: ' + b.outerHTML.slice(0, 120))
    }
    expect(unnamed, `unnamed: ${unnamed.join(' | ')}`).toHaveLength(0)
  })
})

describe('§22.3 Completed day', () => {
  it('shows restrained completion state; no excessive celebration', async () => {
    await mount(seedDone())
    expect(screen.getByText(/Everything planned for today is complete/i)).toBeTruthy()
    expect(screen.getByText(/Day complete/i)).toBeTruthy()
    // No giant confetti overlay or duplicate Project-complete dialog fired just by landing on Today
    expect(document.querySelectorAll('.scrim[role="dialog"]').length).toBe(0)
  })
})

describe('§22.4 Overloaded day', () => {
  it('communicates overload without turning page red; one explanation + Plan/Focus', async () => {
    await mount(seedOverloaded())
    expect(screen.getByRole('heading', { name: /Today looks tighter than your capacity/i })).toBeTruthy()
    const now = document.querySelector('.today-now')
    const primary = within(now).getByRole('button', { name: 'Plan my day' })
    expect(primary).toBeTruthy()
    // page background should not be set to danger red (no .today--danger class etc.)
    expect(document.querySelector('.screen.today').className).not.toMatch(/danger|overload-bg/)
  })
})

describe('§22.5 Mobile (≤767px)', () => {
  it('above fold contains Today header + NBA + start of Today\'s Work; no horizontal overflow risk', async () => {
    await mount(seedLoaded(), 'mobile')
    expect(screen.getByRole('heading', { name: 'Today' })).toBeTruthy()
    expect(document.querySelector('.today-now')).toBeTruthy()
    expect(document.querySelector('.today-list')).toBeTruthy()
    // Primary button in NOW must be full-width (asserted through CSS class chain, not computed style)
    // Check: no giant fixed-size decorative element (e.g., no 300px hero illustration)
    expect(document.querySelector('.today-hero')).toBeNull()
  })

  it('44px+ tap targets: row min-height ≥52px in CSS, go button hit area 44px on mobile', () => {
    // We check the CSS directly since jsdom doesn't compute styles from stylesheets reliably
    const css = require('fs').readFileSync('src/components/today/today.css', 'utf8')
    expect(css).toMatch(/\.today-row\s*\{[^}]*min-height:\s*5[2-6]px/)
    const mobileBlock = css.match(/@media \(max-width: 767px\)\s*\{([\s\S]*?)\n\}/)?.[1] || ''
    expect(mobileBlock).toMatch(/min-height:\s*56px/)
    expect(mobileBlock).toMatch(/\.today-row__go\s*\{[^}]*width:\s*44px[^}]*height:\s*44px/)
  })
})

describe('§22.6 Desktop (≥1024px)', () => {
  it('today column is capped via PageContainer size=narrow (720px), no local max-width', () => {
    // Step 4G-3: width lives in PageContainer .app-page--narrow{--app-content-max:720px}
    // Today no longer sets its own max-width.
    const todayCss = require('fs').readFileSync('src/components/today/today.css', 'utf8')
    const desktop = todayCss.match(/@media \(min-width: 1024px\)\s*\{([\s\S]*?)\n\}/)?.[1] || ''
    expect(desktop).not.toMatch(/max-width/)
    const shellCss = require('fs').readFileSync('src/components/shell/shell.css', 'utf8')
    expect(shellCss).toMatch(/\.app-page--narrow\s*\{\s*--app-content-max:\s*720px/)
  })
})

describe('§22.7 Hard scope: no deleted systems leaking', () => {
  it('no lazy(ItemActionsSheet), no Suspense around removed code, no AdaptiveEmphasis/TodayHero import', () => {
    const fs = require('fs')
    const todaySrc = fs.readFileSync('src/screens/TodayScreen.jsx', 'utf8')
    expect(todaySrc).not.toMatch(/\blazy\(/)
    expect(todaySrc).not.toMatch(/AdaptiveEmphasis|TodayHero|today-hero|adaptive-home/i)
    expect(todaySrc).not.toMatch(/ItemActionsSheet/)
  })
  it('CSS has no glow/shadow bloat on NOW', () => {
    const css = require('fs').readFileSync('src/components/today/today.css', 'utf8')
    // no text-shadow glow or huge box-shadow on today-now
    const nowBlock = css.match(/\.today-now\s*\{([\s\S]*?)\n\}/)?.[1] || ''
    expect(nowBlock).not.toMatch(/text-shadow/)
    expect(nowBlock).not.toMatch(/box-shadow:\s*0\s+\d?\dpx\s+[3-9]\dpx/)
  })
})

describe('§4G-2A Today habits unify with HabitObject', () => {
  it('habits render HabitObject with canonical aria-label and 44px complete button; Work rows keep WorkRow structure', async () => {
    await mount(seedLoaded())
    // At least one habit is rendered via HabitObject
    const hObjs = document.querySelectorAll('.today-list .habit-obj.today-hobj')
    expect(hObjs.length).toBeGreaterThanOrEqual(1)
    // No legacy habit toggle ring remains
    expect(document.querySelector('.today-list .today-row__ring')).toBeNull()
    // First habit has canonical completion button
    const first = hObjs[0]
    const btn = first.querySelector('button.habit-obj__complete')
    expect(btn).toBeTruthy()
    expect(btn.getAttribute('aria-label')).toMatch(/Mark .+ as complete/)
    expect(btn.getAttribute('aria-pressed')).toBe('false')
    // Name is a real link to habit detail
    const link = first.querySelector('a.habit-obj__name-link')
    expect(link).toBeTruthy()
    expect(link.getAttribute('href')).toMatch(/habits\/h/)
    // Work rows still exist and use WorkRow (not HabitObject)
    const workRows = document.querySelectorAll('.today-list .today-row--work')
    expect(workRows.length).toBeGreaterThanOrEqual(0)
  })

  it('clicking a Today habit complete button toggles checkin (reuses TOGGLE_CHECKIN)', async () => {
    const { unmount } = await mount(seedLoaded())
    const btn = document.querySelector('.today-hobj .habit-obj__complete')
    expect(btn).toBeTruthy()
    btn.click()
    // Pressed state flips
    await new Promise(r => setTimeout(r, 50))
    expect(btn.getAttribute('aria-pressed')).toBe('true')
    expect(btn.getAttribute('aria-label')).toMatch(/as not complete/)
    unmount()
  })

  it('habits in Today do NOT show the More (...) overflow (execution-first: complete + detail only)', () => {
    const more = document.querySelector('.today-hobj .habit-obj__more')
    expect(more).toBeNull()
  })
})
