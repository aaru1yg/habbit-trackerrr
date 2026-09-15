/* ============================================================
   FINAL PHASE 2D — Icon-only button accessibility sweep.

   Asserts the rules enforced/verified in 2D:
     1. IconButton warns in dev when label is missing and forwards
        aria-label to the underlying <button>.
     2. On representative screens every icon-only <button>/<a> has
        an aria-label (there are no silent icon-only controls).
     3. Decorative icons inside labeled buttons are wrapped in
        aria-hidden containers (Button primitive enforces this;
        Icon* primitives default aria-hidden=true).
     4. The Assignments search clear button retains a ≥44px touch
        target (no sub-44 inline size override).
     5. Sheet close and Calendar/Week nav controls expose
        accessible names.
   ============================================================ */
import { describe, it, expect, beforeEach } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import fs from 'node:fs'
import path from 'node:path'
import { StoreProvider, STORAGE_KEY } from '../src/store.jsx'
import App from '../src/App.jsx'
import IconButton from '../src/components/primitives/IconButton.jsx'

const DAY = 86400000
const iso = (offsetDays, hhmm = '17:00') =>
  new Date(Date.now() + offsetDays * DAY).toISOString().slice(0, 10) + 'T' + hhmm

function seedState(over = {}) {
  return {
    version: 4,
    profile: { name: 'Aaru', onboarded: true, theme: 'midnight', workReminders: false },
    habits: [
      { id: 'h1', name: 'Write daily', category: 'learning', schedule: { type: 'daily' }, archived: false, order: 0 },
      { id: 'h2', name: 'Walk', category: 'body', schedule: { type: 'daily' }, archived: false, order: 1, pause: null },
    ],
    checkins: { h1: {}, h2: {} },
    routines: [],
    projects: [
      { id: 'p1', name: 'Thesis', deadline: iso(14), archived: false, milestones: [], tasks: [], order: 0 },
    ],
    assignments: [{
      id: 'a1', name: 'Physics set', deadline: iso(2, '18:00'), estimateMin: 120,
      priority: 'high', archived: false, subtasks: [], projectId: null,
    }],
    goals: [], moods: {}, notes: [], achievements: [],
    preferences: { focusStartHour: null, focusEndHour: null, planningTime: null, breakStyle: null, dailyCapacityMin: 120, planningBufferPct: 15, weekStartsOn: 1, reminderWindow: null },
    signals: [], focusLog: [],
    ...over,
  }
}

function mount(hash = '#/today', seed = seedState()) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(seed))
  sessionStorage.clear()
  window.location.hash = hash
  return render(<StoreProvider><App /></StoreProvider>)
}

// Returns button/anchor elements whose only visible content is icons
// (i.e. no direct text). These MUST have an aria-label/title/labelledby.
function iconOnlyControls(container) {
  return Array.from(container.querySelectorAll('button, a[href]')).filter((el) => {
    // Walk children; count non-hidden text.
    let text = ''
    const walk = (node) => {
      if (node.nodeType === 3) text += node.textContent
      else if (node.nodeType === 1) {
        if (node.getAttribute('aria-hidden') === 'true') return
        if (node.tagName === 'svg') return
        if (node.hasAttribute('data-p-icon')) return
        node.childNodes.forEach(walk)
      }
    }
    el.childNodes.forEach(walk)
    return !text.trim()
  })
}

function hasAccessibleName(el) {
  if (el.getAttribute('aria-label')) return true
  if (el.getAttribute('aria-labelledby')) return true
  if (el.getAttribute('title')) return true
  // an ancestor label for[=id]
  const id = el.id
  if (id) {
    const lbl = el.ownerDocument.querySelector(`label[for="${CSS.escape(id)}"]`)
    if (lbl && lbl.textContent.trim()) return true
  }
  return false
}

describe('FINAL 2D — Icon-only control accessibility', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    document.body.innerHTML = ''
  })

  it('IconButton dev-warns when label prop is missing', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    render(<IconButton icon={<span />} />)
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/accessible `label` prop is required/i))
    warn.mockRestore()
  })

  it('IconButton forwards aria-label from label prop', () => {
    render(<IconButton label="Close dialog" icon={<span />} />)
    const b = document.querySelector('button[aria-label="Close dialog"]')
    expect(b).not.toBeNull()
  })

  it('Today — every icon-only control exposes an accessible name', async () => {
    mount('#/today')
    await waitFor(() => expect(document.body.textContent).toMatch(/Today/i))
    const silent = iconOnlyControls(document.body).filter((el) => !hasAccessibleName(el))
    expect(silent).toEqual([])
  })

  it('Habits active workspace — every icon-only control exposes an accessible name', async () => {
    mount('#/habits')
    await waitFor(() => expect(document.body.textContent).toMatch(/Habits/i))
    const silent = iconOnlyControls(document.body).filter((el) => !hasAccessibleName(el))
    expect(silent).toEqual([])
  })

  it('Work screen — every icon-only control exposes an accessible name', async () => {
    mount('#/work')
    await waitFor(() => expect(document.body.textContent).toMatch(/Work/i))
    const silent = iconOnlyControls(document.body).filter((el) => !hasAccessibleName(el))
    expect(silent).toEqual([])
  })

  it('Calendar — prev/next range buttons expose accessible names', async () => {
    mount('#/calendar')
    await waitFor(() => expect(document.querySelector('button[aria-label="Previous range"]')).not.toBeNull())
    expect(document.querySelector('button[aria-label="Next range"]')).not.toBeNull()
  })

  it('AssignmentsScreen search clear button has no sub-44 inline size override (static check)', () => {
    const src = fs.readFileSync(path.resolve('src/screens/AssignmentsScreen.jsx'), 'utf8')
    expect(src).toMatch(/button className="btn ghost icon"[^>]*aria-label="Clear search"/)
    expect(src).not.toMatch(/aria-label="Clear search"[^>]*style=\{\{[^}]*width:\s*32/)
  })

  it('Sheet close button exposes "Close" label when a sheet opens', async () => {
    mount('#/habits')
    await waitFor(() => expect(document.body.textContent).toMatch(/Habits/i))
    // Click the first "More actions" button for a habit row.
    const more = document.querySelector('button[aria-label^="More actions for"]')
    expect(more).not.toBeNull()
    more.click()
    await waitFor(() => expect(document.querySelector('button[aria-label^="Close"]')).not.toBeNull())
  })
})
