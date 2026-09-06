import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { StoreProvider } from '../src/store.jsx'
import HabitDetailScreen from '../src/screens/HabitDetailScreen.jsx'
import { Sidebar } from '../src/components/layout/Navigation.jsx'
import { achievementList, achievementSummary, onTimeAssignments, perfectWeeks } from '../src/lib/achievements.js'
import { todayGoals, todayPriorities, dayTimeline } from '../src/lib/today.js'
import { projectStatus } from '../src/lib/work.js'
import { todayStr, subDaysStr, weekDays } from '../src/lib/dates.js'

const habit = (id) => ({ id, name: id, category: 'mind', schedule: { type: 'daily' }, createdAt: subDaysStr(todayStr(), 89) })
const state = (over = {}) => ({
  version: 4, profile: { name: 'Release QA', onboarded: true, theme: 'midnight' },
  habits: [], checkins: {}, routines: [], projects: [], assignments: [], moods: {}, ...over,
})
const doneDays = (n) => Object.fromEntries(Array.from({ length: n }, (_, i) => [subDaysStr(todayStr(), i), { done: true }]))
const mount = (doc, child) => {
  localStorage.setItem('aaru.habits.v4', JSON.stringify(doc))
  return render(<StoreProvider>{child}</StoreProvider>)
}

afterEach(() => { cleanup(); localStorage.clear(); vi.useRealTimers() })

describe('V2 shipping regressions', () => {
  it('habit detail heatmap contains only that habit, not the aggregate', () => {
    mount(state({ habits: [habit('A'), habit('B')], checkins: { A: doneDays(1) } }), <HabitDetailScreen id="A" />)
    const heatmap = screen.getByRole('img', { name: 'A consistency heatmap' })
    expect(heatmap.querySelector(`[data-date="${todayStr()}"]`).dataset.pct).toBe('100')
  })

  it('a missing habit has a usable recovery link and does not crash', () => {
    mount(state(), <HabitDetailScreen id="deleted" />)
    expect(screen.getByText('Habit not found')).toBeTruthy()
    expect(screen.getByRole('link', { name: /Back to habits/ }).getAttribute('href')).toBe('#/habits')
  })

  it('all achievement progress is finite, and Dialled in can actually unlock', () => {
    const items = achievementList(state({ habits: [habit('A')], checkins: { A: doneDays(90) } }))
    for (const item of items) {
      expect(Number.isFinite(item.progress), item.id).toBe(true)
      expect(item.progress).toBeGreaterThanOrEqual(0)
      expect(item.progress).toBeLessThanOrEqual(1)
      expect(item.detail).not.toMatch(/NaN|Infinity/)
    }
    expect(items.find((item) => item.id === 'sharp-habit').earned).toBe(true)
  })

  it('sidebar and achievement screen use the same rules even with no check-ins', () => {
    const doc = state({ routines: [{ id: 'r', name: 'Morning', habitIds: [], active: true }] })
    const expected = achievementSummary(doc).unlocked
    expect(expected).toBeGreaterThan(0)
    const { container } = mount(doc, <Sidebar route="achievements" name="QA" onSearch={() => {}} />)
    expect(container.querySelector('.sidebar-count')?.textContent).toBe(String(expected))
  })

  it('a same-day late assignment cannot earn the on-time achievement', () => {
    const doc = state({ assignments: [
      { id: 'late', deadline: `${todayStr()}T09:00`, completedAt: `${todayStr()}T10:00` },
      { id: 'exact', deadline: `${todayStr()}T10:00`, completedAt: `${todayStr()}T10:00` },
      { id: 'date-only', deadline: todayStr(), completedAt: `${todayStr()}T22:00` },
    ] })
    expect(onTimeAssignments(doc).map((a) => a.id)).toEqual(['exact', 'date-only'])
  })

  it('does not award a perfect week on Friday before the weekend is tracked', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 8, 4, 12))
    const doc = state({ habits: [habit('A')], checkins: { A: doneDays(5) } })
    expect(weekDays(todayStr())[6] > todayStr()).toBe(true)
    expect(perfectWeeks(doc)).toEqual([])
    expect(achievementList(doc).find((a) => a.id === 'perfect-week').earned).toBe(false)
  })

  it('Today goal pace and overdue wording agree with the work engine', () => {
    const now = new Date(2026, 8, 6, 15)
    const p = { id: 'p', name: 'Goal', startDate: '2026-09-01', deadline: '2026-09-05', milestones: [] }
    const goal = todayGoals(state({ projects: [p] }), { now })[0]
    const status = projectStatus(p, now)
    expect(goal.dueText).toBe('Overdue')
    expect(goal.expected).toBe(status.elapsedPct)
    expect(goal.behind).toBe(status.behind)
  })

  it('a date-only goal due today uses end-of-day pace, not midnight', () => {
    const now = new Date(2026, 8, 6, 1)
    const p = { id: 'p', name: 'Goal', startDate: '2026-09-01', deadline: '2026-09-06', milestones: [] }
    const goal = todayGoals(state({ projects: [p] }), { now })[0]
    expect(goal.dueText).toBe('Due today')
    expect(goal.expected).toBeLessThan(100)
    expect(goal.expected).toBe(projectStatus(p, now).elapsedPct)
  })

  it('fully completed work without a completion timestamp is not an urgent priority', () => {
    const p = { id: 'p', name: 'Done', deadline: subDaysStr(todayStr(), 1), milestones: [{ tasks: [{ done: true }] }] }
    const doc = state({ projects: [p] })
    expect(todayPriorities(doc)).toEqual([])
    expect(todayGoals(doc)).toEqual([])
  })

  it('untimed deadlines stay untimed and sort after real reminder times', () => {
    const now = new Date(2026, 8, 6, 12)
    const doc = state({ projects: [
      { id: 'untimed', name: 'Untimed', deadline: '2026-09-06' },
      { id: 'timed', name: 'Timed', deadline: '2026-09-06T17:00' },
    ] })
    const entries = dayTimeline(doc, { now })
    expect(entries.map((e) => e.label)).toEqual(['Timed', 'Untimed'])
    expect(entries[1].time).toBeNull()
  })
})
