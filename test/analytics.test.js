import { describe, it, expect } from 'vitest'
import { trendSeries, heatmapSeries, heatLevel, habitMatrix, weekComparison } from '../src/lib/stats.js'
import { todayStr, subDaysStr, addDaysStr, weekDays } from '../src/lib/dates.js'

const today = todayStr()
const mkHabit = (over = {}) => ({
  id: 'h1', name: 'Meditate', category: 'mind',
  schedule: { type: 'daily' }, reminder: null, notes: '',
  createdAt: subDaysStr(today, 60), archived: false, order: 0, ...over,
})

const mkState = (habits, checkins = {}) => ({
  version: 3,
  profile: { name: 'Test', onboarded: true, theme: 'midnight', lastBackupExport: null, lastBackupReminder: null, reminderNoteSeen: false },
  habits, checkins, projects: [], moods: {},
})

const mark = (state, habitId, dates) => {
  const days = { ...(state.checkins[habitId] || {}) }
  for (const d of dates) days[d] = { done: true }
  return { ...state, checkins: { ...state.checkins, [habitId]: days } }
}

describe('analytics chart data', () => {
  it('trendSeries returns oldest→newest with honest 0% vs null gaps', () => {
    const noData = trendSeries(mkState([]), 7)
    expect(noData[6].pct).toBeNull() // no eligible habits → null, not 0%
    const s = mkState([mkHabit()])
    const rows = trendSeries(s, 7)
    expect(rows).toHaveLength(7)
    expect(rows[0].date).toBe(subDaysStr(today, 6))
    expect(rows[6].date).toBe(today)
    expect(rows[6].pct).toBe(0) // eligible but nothing logged → honest 0%
    const s2 = mark(s, 'h1', [today])
    const r2 = trendSeries(s2, 7)
    expect(r2[6].pct).toBe(100)
    expect(r2[6].done).toBe(1)
  })

  it('heatmapSeries builds Sun-first weeks and flags future days', () => {
    const s = mkState([mkHabit()])
    const weeks = heatmapSeries(s, 4)
    expect(weeks.length).toBeGreaterThanOrEqual(4)
    expect(weeks[0]).toHaveLength(7)
    expect(new Date(`${weeks[0][0].date}T12:00:00`).getDay()).toBe(0) // starts Sunday
    // Every column is a full Sun→Sat week, so the last cell is a Saturday.
    const lastCol = weeks[weeks.length - 1]
    expect(new Date(`${lastCol[6].date}T12:00:00`).getDay()).toBe(6)
    // The grid always covers today, and anything after today is flagged future.
    expect(weeks.flat().some((c) => c.date === today)).toBe(true)
    const futureCells = weeks.flat().filter((c) => c.date > today)
    expect(futureCells.every((c) => c.future)).toBe(true)
    // Date-robust: future cells exist on every day except Saturday.
    const isSaturday = new Date(`${today}T12:00:00`).getDay() === 6
    if (!isSaturday) expect(futureCells.length).toBeGreaterThan(0)
    else expect(futureCells.length).toBe(0)
  })

  it('heatLevel buckets percentages GitHub-style', () => {
    expect(heatLevel(null)).toBe(0)
    expect(heatLevel(0)).toBe(0)
    expect(heatLevel(5)).toBe(1)
    expect(heatLevel(30)).toBe(2)
    expect(heatLevel(60)).toBe(3)
    expect(heatLevel(90)).toBe(4)
  })

  it('habitMatrix marks scheduled / done / future per cell', () => {
    let s = mkState([mkHabit()])
    s = mark(s, 'h1', [today])
    const days = [subDaysStr(today, 1), today, addDaysStr(today, 1)]
    const rows = habitMatrix(s, days)
    expect(rows).toHaveLength(1)
    const [yesterday, td, tomorrow] = rows[0].cells
    expect(yesterday.scheduled).toBe(true)
    expect(yesterday.done).toBe(false)
    expect(td.done).toBe(true)
    expect(tomorrow.future).toBe(true)
    expect(tomorrow.scheduled).toBe(false)
  })

  it('weekComparison computes a signed delta (and null without both sides)', () => {
    const thisW = weekDays(today)
    let s = mkState([mkHabit()])
    s = mark(s, 'h1', thisW)
    const cmp = weekComparison(s)
    expect(cmp.thisWeek.pct).toBe(100)
    expect(cmp.delta).toBe(100) // 100% this week vs an honest 0% last week
    const empty = weekComparison(mkState([]))
    expect(empty.delta).toBeNull()
  })
})
