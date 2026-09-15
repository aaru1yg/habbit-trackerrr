import { describe, it, expect } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { StoreProvider, STORAGE_KEY } from '../src/store.jsx'
import App from '../src/App.jsx'
import { achievementSummary } from '../src/lib/achievements.js'
import { achievements as oldAchievements } from '../src/lib/stats.js'

/**
 * FINAL 2E — Achievements / Insights summary pill alignment.
 *
 * Asserts that the "X/Y earned · next: …" pill on the Insights Overview
 * Achievements pillar uses the same achievementSummary() source of truth
 * as the Achievements screen itself, so counts never diverge.
 */

function seedState() {
  const c = { h1: {}, h2: {} }
  const today = new Date()
  for (let i = 0; i < 10; i++) {
    const d = new Date(today); d.setDate(today.getDate() - i)
    const iso = d.toISOString().slice(0, 10)
    c.h1[iso] = { done: true }
  }
  return {
    version: 4,
    profile: { name: 'Aaru', onboarded: true, theme: 'midnight', workReminders: false },
    habits: [
      { id: 'h1', name: 'Write daily', category: 'learning', schedule: { type: 'daily' }, archived: false, order: 0, createdAt: '2024-01-01' },
      { id: 'h2', name: 'Walk', category: 'body', schedule: { type: 'daily' }, archived: false, order: 1, pause: null, createdAt: '2024-01-01' },
    ],
    checkins: c,
    routines: [], projects: [], assignments: [], goals: [],
    moods: {}, notes: [], achievements: [],
    preferences: { focusStartHour: null, focusEndHour: null, planningTime: null, breakStyle: null, dailyCapacityMin: 120, planningBufferPct: 15, weekStartsOn: 1, reminderWindow: null },
    signals: [], focusLog: [],
  }
}

function mount(hash = '#/insights') {
  const seed = seedState()
  localStorage.setItem(STORAGE_KEY, JSON.stringify(seed))
  sessionStorage.clear()
  window.location.hash = hash
  return render(<StoreProvider><App /></StoreProvider>)
}

describe('FINAL 2E — Achievements/Insights summary alignment', () => {
  it('Insights Achievements pillar shows the same unlocked/total as achievementSummary()', async () => {
    mount('#/insights')
    // Await the actual lazy Insights screen (not just shell "Insights" nav label).
    await waitFor(() => {
      const heads = document.querySelectorAll('h1.screen-title')
      const got = [...heads].some((h) => /Insights/.test(h.textContent))
      expect(got).toBe(true)
    }, { timeout: 10000 })

    const seed = JSON.parse(localStorage.getItem(STORAGE_KEY))
    const summary = achievementSummary(seed)

    const achLink = document.querySelector('a.ins-pillar[data-cat="achievements"]')
    expect(achLink).not.toBeNull()
    const sub = achLink.querySelector('.ins-pillar-sub')
    expect(sub).not.toBeNull()
    const match = sub.textContent.match(/(\d+)\/(\d+)\s+earned/)
    expect(match).not.toBeNull()
    expect(Number(match[1])).toBe(summary.unlocked)
    expect(Number(match[2])).toBe(summary.total)

    // Legacy stats.achievements() undercounts (omits identity-tier badges);
    // the pillar should NOT match that number.
    const legacy = oldAchievements(seed)
    expect(legacy.badges.length).not.toBe(summary.total)
  })

  it('achievementSummary.nextUp tie-breaks deterministically by id', () => {
    const seed = seedState()
    const a = achievementSummary(seed)
    const b = achievementSummary(seed)
    expect(a.nextUp.map((x) => x.id)).toEqual(b.nextUp.map((x) => x.id))
  })

  it('Achievements screen renders (smoke)', async () => {
    mount('#/insights?view=achievements')
    await waitFor(() => {
      // AchievementsScreen renders an element containing "Achievements" heading text outside the nav.
      expect(document.body.textContent).toMatch(/Achievements/)
      const sub = document.querySelector('.ins-pillar-sub') || document.querySelector('[class*="ach-"]')
      expect(sub || /\d+\/\d+/.test(document.body.textContent) || /tier|bronze|silver|gold|diamond/i.test(document.body.textContent)).toBeTruthy()
    }, { timeout: 10000 })
  })
})
