/* Step 4G-2C: Routines focused-editorial width + sequence polish.
   Layout-only assertions; reducers are covered by habits.test.jsx. */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within, cleanup } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { StoreProvider, STORAGE_KEY } from '../src/store.jsx'
import App from '../src/App.jsx'
import { todayStr, subDaysStr } from '../src/lib/dates.js'

const today = todayStr()
const ago = (n) => subDaysStr(today, n)
const dones = (ids, from, to) => {
  const out = {}
  for (const id of ids) {
    out[id] = {}
    for (let i = from; i >= to; i--) out[id][ago(i)] = { done: true, at: `${ago(i)}T07:30` }
  }
  return out
}
function seed() {
  return {
    version: 4,
    profile: { name: 'Aaru', onboarded: true, theme: 'midnight' },
    habits: [
      { id: 'h1', name: 'Drink water', category: 'health', schedule: { type: 'daily' }, reminder: '', notes: '', createdAt: ago(30), archived: false, pause: null, skips: [], order: 0 },
      { id: 'h2', name: 'Stretch', category: 'fitness', schedule: { type: 'daily' }, reminder: '', notes: '', createdAt: ago(30), archived: false, pause: null, skips: [], order: 1 },
      { id: 'h3', name: 'Journal', category: 'mind', schedule: { type: 'daily' }, reminder: '', notes: '', createdAt: ago(30), archived: false, pause: null, skips: [], order: 2 },
    ],
    routines: [
      { id: 'r-morning', name: 'Morning reset', kind: 'morning', habitIds: ['h1', 'h2', 'h3'], order: 0, active: true, createdAt: today },
    ],
    checkins: dones(['h1', 'h2', 'h3'], 5, 1),
    routines_done: {}, routinesOrder: ['r-morning'],
    projects: [], assignments: [], goals: [], moods: {}, notes: [], achievements: [],
    preferences: { weekStartsOn: 1 }, signals: [], focusLog: [],
  }
}
function mount() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(seed()))
  window.location.hash = '#/habits?view=routines'
  return render(<StoreProvider><App /></StoreProvider>)
}
beforeEach(() => { localStorage.clear(); window.location.hash = '' })
afterEach(cleanup)

describe('Step 4G-2C: Routines focused editorial layout', () => {
  it('routines shell is centered at <=720px max-width on desktop', async () => {
    mount()
    await screen.findByRole('heading', { level: 3, name: 'Morning reset' })
    const shell = document.querySelector('.rt-shell')
    expect(shell).toBeTruthy()
    const css = getCssText()
    expect(css).toMatch(/\.rt-shell\{max-width:720px;margin:0 auto/)
  })

  it('routine list is a vertical stack, NOT multi-column', async () => {
    mount()
    await screen.findByRole('heading', { level: 3, name: 'Morning reset' })
    const list = document.querySelector('.rt')
    expect(list).toBeTruthy()
    expect(getComputedStyleFix(list, 'display')).toBe('flex')
    expect(getComputedStyleFix(list, 'flex-direction')).toBe('column')
  })

  it('sequence is a semantic <ol> with three ordered steps', async () => {
    mount()
    const ol = await screen.findByRole('list', { name: /Morning reset steps/i })
    expect(ol.tagName.toLowerCase()).toBe('ol')
    const items = ol.querySelectorAll(':scope > li')
    expect(items.length).toBe(3)
    // Each step has a numeric marker
    items.forEach((li) => {
      expect(li.querySelector('.rt-step__num')).toBeTruthy()
      expect(li.querySelector('.rt-step__body')).toBeTruthy()
      expect(li.querySelector('.rt-step__action')).toBeTruthy()
    })
  })

  it('reorder IconButtons have >=44px hit area (::after inset -4px on 36px visual)', async () => {
    mount()
    await screen.findByRole('heading', { level: 3, name: 'Morning reset' })
    const css = getCssText()
    // Contract: 36px visual button with ::after inset:-4px → 44px hit target
    expect(css).toMatch(/\.rt-move\s*\.p-btn--icon\{[^}]*width:36px;height:36px/)
    expect(css).toMatch(/\.rt-move\s*\.p-btn--icon::after\{[^}]*inset:-4px\}/)
  })

  it('completing a step toggles aria-pressed (semantic action intact)', async () => {
    mount()
    const block = (await screen.findByRole('heading', { level: 3, name: 'Morning reset' })).closest('.rt-block')
    const btn = within(block).getByRole('button', { name: /Mark Drink water as complete in Morning reset/i })
    expect(btn.getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(btn)
    await waitFor(() => expect(btn.getAttribute('aria-pressed')).toBe('true'))
    fireEvent.click(within(block).getByRole('button', { name: /Mark Stretch as complete in Morning reset/i }))
    fireEvent.click(within(block).getByRole('button', { name: /Mark Journal as complete in Morning reset/i }))
    await waitFor(() => expect(block.querySelector('.rt-complete').textContent).toMatch(/All steps complete/))
  })

  it('footer actions are present (Edit, Archive) and secondary', async () => {
    mount()
    const foot = (await screen.findByRole('heading', { level: 3, name: 'Morning reset' })).closest('.rt-block').querySelector('.rt-foot')
    expect(foot).toBeTruthy()
    expect(screen.getByRole('button', { name: /Edit routine Morning reset/i })).toBeTruthy()
    expect(foot.textContent).toMatch(/Archive/)
  })

  it('mobile: rt-shell max-width becomes 100% (fits viewport)', () => {
    const css = getCssText()
    expect(css).toMatch(/@media\s*\(max-width:559px\)\{[\s\S]*?\.rt-shell\{max-width:100%\}/)
  })

  it('step rows have >=44px min-height (mobile target contract)', () => {
    const css = getCssText()
    // Desktop + mobile both guarantee 44+px min-height on the step row
    expect(css).toMatch(/\.rt-step\{[^}]*min-height:4[4-9]px/)
  })
})

function getCssText() {
  // Read CSS file directly since jsdom doesn't apply external stylesheets.
  return readFileSync('src/styles/habit-routines.css', 'utf8')
}
function getComputedStyleFix(el, prop) {
  // Naive CSS check against the stylesheet text, since jsdom doesn't apply external CSS.
  const css = getCssText()
  const cls = '.' + [...el.classList].join('.')
  const match = css.match(new RegExp(`${cls.replace(/\./g, '\\.')}\\{([^}]+)\\}`))
  if (!match) return ''
  const block = match[1]
  const m = block.match(new RegExp(`${prop}:([^;]+)`))
  return m ? m[1].trim() : ''
}
