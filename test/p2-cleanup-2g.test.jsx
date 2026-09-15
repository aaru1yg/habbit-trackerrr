import { describe, it, expect, beforeEach } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import fs from 'node:fs'
import { StoreProvider, STORAGE_KEY } from '../src/store.jsx'
import App from '../src/App.jsx'

/**
 * FINAL 2G — Remaining P2 cleanup items:
 *   #8  Record .rec-body wraps at 390px (no longer ellipsized)
 *   #9  AnalyticsLab tab strip horizontally scrolls (no wrapping)
 *   #11 /mind and /record legacy routes redirect to /insights?view=…
 *   #12 BootSequence exposes aria-label for its overlay while playing
 *
 * These are small, CSS/routing-only fixes; no visual redesign.
 */

function seed() {
  return {
    version: 4,
    profile: { name: 'Aaru', onboarded: true, theme: 'midnight', workReminders: false },
    habits: [{ id: 'h1', name: 'Write daily', category: 'learning', schedule: { type: 'daily' }, archived: false, order: 0, createdAt: '2024-01-01' }],
    checkins: { h1: {} },
    routines: [], projects: [], assignments: [], goals: [],
    moods: {}, notes: [], achievements: [],
    preferences: { focusStartHour: null, focusEndHour: null, planningTime: null, breakStyle: null, dailyCapacityMin: 120, planningBufferPct: 15, weekStartsOn: 1, reminderWindow: null },
    signals: [], focusLog: [],
  }
}

function mount(hash) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(seed()))
  sessionStorage.clear()
  window.location.hash = hash
  return render(<StoreProvider><App /></StoreProvider>)
}

describe('FINAL 2G — P2 cleanup', () => {
  beforeEach(() => {
    sessionStorage.clear()
    // Disable boot sequence so it doesn't block assertions.
    try { localStorage.setItem('aaru.boot', 'off') } catch (_err) { /* ignore */ }
  })

  it('/mind hash redirects to #/insights?view=mind (replaceState)', async () => {
    mount('#/mind')
    await waitFor(() => expect(window.location.hash).toBe('#/insights?view=mind'), { timeout: 10000 })
  })

  it('/record hash redirects to #/insights?view=record (replaceState)', async () => {
    mount('#/record')
    await waitFor(() => expect(window.location.hash).toBe('#/insights?view=record'), { timeout: 10000 })
  })

  it('.rec-body CSS wraps at narrow widths (display:block + overflow-wrap)', () => {
    const css = fs.readFileSync('src/styles/insights.css', 'utf8')
    expect(css).toMatch(/\.rec-item\s+\.rec-body\s*\{[^}]*display:\s*block[^}]*overflow-wrap:\s*anywhere/)
    expect(css).toMatch(/\.rec-item\s+\.tl-meta\s*\{[^}]*flex-wrap:\s*wrap/)
  })

  it('.lab-tabs has horizontal-scroll (overflow-x:auto) rule', () => {
    const css = fs.readFileSync('src/styles/adaptive.css', 'utf8')
    expect(css).toMatch(/\.lab-tabs\{[^}]*overflow-x:\s*auto/)
  })
})
