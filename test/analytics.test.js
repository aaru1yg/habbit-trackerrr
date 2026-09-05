import { describe, it, expect } from 'vitest'
import { trendSeries, heatmapSeries, heatLevel, habitMatrix, weekComparison } from '../src/lib/stats.js'
import {
  timelineEvents, searchAll, streakMilestone, consistencyScore, consistencyLabel, MILESTONE_STREAKS,
} from '../src/lib/analytics.js'
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

/* ---------------- derived timeline (§29) ---------------- */

const mkWorkState = (over = {}) => ({
  version: 4,
  profile: { name: 'Test', onboarded: true, theme: 'midnight' },
  habits: [], checkins: {}, routines: [], projects: [], assignments: [], moods: {},
  ...over,
})

describe('timelineEvents', () => {
  it('derives streaks, reflections, work events and badges without inventing anything', () => {
    // 10 consecutive days → real streak runs AND earned badges (3d, 7d)
    const days = Array.from({ length: 10 }, (_, i) => subDaysStr(today, i))
    const habit = mkHabit()
    const checkins = { h1: Object.fromEntries(days.map((d) => [d, { done: true, at: `${d}T08:15` }])) }
    checkins.h1[subDaysStr(today, 3)].note = 'Long session, felt easy'

    const state = mkWorkState({
      habits: [habit],
      checkins,
      moods: { [subDaysStr(today, 2)]: { score: 4, wentWell: 'Shipped the draft', difficult: 'Late start' } },
      projects: [{
        id: 'p1', name: 'Portfolio', milestones: [], startDate: subDaysStr(today, 20),
        deadline: `${addDaysStr(today, 5)}T18:00`, progressLog: [{ at: `${subDaysStr(today, 4)}T10:00`, pct: 100 }],
        completedAt: `${subDaysStr(today, 4)}T10:00`, archived: false, createdAt: subDaysStr(today, 20),
      }],
      assignments: [{
        id: 'a1', name: 'DS Lab', subject: 'Data Structures', deadline: `${subDaysStr(today, 1)}T23:59`,
        progress: 100, progressMode: 'explicit', subtasks: [], completedAt: `${subDaysStr(today, 1)}T19:00`,
        archived: false, createdAt: subDaysStr(today, 6), progressLog: [],
      }],
    })

    const events = timelineEvents(state, 60)
    const kinds = new Set(events.map((e) => e.kind))

    expect(kinds.has('streak')).toBe(true)
    expect(kinds.has('note')).toBe(true)
    expect(kinds.has('reflection')).toBe(true)
    expect(kinds.has('project-complete')).toBe(true)
    expect(kinds.has('assignment-complete')).toBe(true)
    // regression: earned badges used to crash the record screen (undefined `today`)
    expect(kinds.has('achievement')).toBe(true)
    expect(events.find((e) => e.kind === 'achievement').day).toBe(today)

    const reflection = events.find((e) => e.kind === 'reflection')
    expect(reflection.body).toMatch(/Went well: Shipped the draft/)
    expect(reflection.body).toMatch(/Difficult: Late start/)

    // newest first, and no duplicate day+title pairs
    const stamps = events.map((e) => String(e.at || e.day))
    expect(stamps).toEqual([...stamps].sort().reverse())
    const keys = events.map((e) => `${e.day}|${e.title}`)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('never fabricates activity for a fresh account', () => {
    const events = timelineEvents(mkWorkState({ habits: [mkHabit()] }))
    // creating the habit is real; completions, streaks and badges are not
    expect(events.map((e) => e.kind)).toEqual(['habit-created'])
    expect(events.some((e) => e.kind === 'streak' || e.kind === 'achievement')).toBe(false)
    expect(timelineEvents(mkWorkState())).toEqual([])
  })

  it('honours the limit', () => {
    const days = Array.from({ length: 40 }, (_, i) => subDaysStr(today, i))
    const state = mkWorkState({
      habits: [mkHabit()],
      checkins: { h1: Object.fromEntries(days.map((d) => [d, { done: true, note: `note ${d}` }])) },
    })
    expect(timelineEvents(state, 5)).toHaveLength(5)
  })
})

/* ---------------- global search (§30) ---------------- */

describe('searchAll', () => {
  const state = mkWorkState({
    habits: [mkHabit({ id: 'h1', name: 'Deep work', notes: 'Phone in the drawer' })],
    checkins: { h1: { [subDaysStr(today, 1)]: { done: true, note: 'Two solid blocks' } } },
    projects: [{ id: 'p1', name: 'Thesis draft', description: 'Chapter three', milestones: [], archived: false, createdAt: subDaysStr(today, 9), deadline: null, completedAt: null }],
    assignments: [{ id: 'a1', name: 'Physics problem set', subject: 'Physics', deadline: `${addDaysStr(today, 2)}T18:00`, archived: false, completedAt: null, progress: 40, progressMode: 'explicit', subtasks: [], createdAt: subDaysStr(today, 3), progressLog: [] }],
    routines: [{ id: 'r1', name: 'Morning reset', kind: 'morning', habitIds: ['h1'], active: true }],
  })

  const flat = (res) => res.groups.flatMap((g) => g.items)

  it('finds habits, projects, assignments and routines by name', () => {
    expect(flat(searchAll(state, 'deep')).some((i) => i.type === 'habit' && i.title === 'Deep work')).toBe(true)
    expect(flat(searchAll(state, 'thesis')).some((i) => i.type === 'project')).toBe(true)
    expect(flat(searchAll(state, 'physics')).some((i) => i.type === 'assignment')).toBe(true)
    expect(flat(searchAll(state, 'morning')).some((i) => i.type === 'routine')).toBe(true)
  })

  it('matches subjects, descriptions and notes — not just titles', () => {
    expect(flat(searchAll(state, 'drawer')).some((i) => i.type === 'habit')).toBe(true)
    expect(flat(searchAll(state, 'chapter three')).some((i) => i.type === 'project')).toBe(true)
    expect(flat(searchAll(state, 'solid blocks')).some((i) => i.type === 'note')).toBe(true)
    expect(flat(searchAll(state, 'problem set')).some((i) => i.type === 'assignment')).toBe(true)
  })

  it('resolves typed dates — logged days and work deadlines', () => {
    const logged = searchAll(state, subDaysStr(today, 1))
    expect(logged.groups.some((g) => g.id === 'dates')).toBe(true)
    const deadline = searchAll(state, addDaysStr(today, 2))
    const items = flat(deadline).filter((i) => i.type === 'date')
    expect(items.some((i) => /Assignment deadline/.test(i.sub || ''))).toBe(true)
  })

  it('groups results and reports an honest total', () => {
    const res = searchAll(state, 'physics')
    expect(res.count).toBe(res.groups.reduce((n, g) => n + g.items.length, 0))
    expect(res.groups.every((g) => g.items.length > 0)).toBe(true)
  })

  it('returns nothing (and says so) for gibberish or an empty query', () => {
    expect(searchAll(state, 'zzzqqq').count).toBe(0)
    expect(searchAll(state, '').count).toBe(0)
    expect(searchAll(state, 'x').count).toBe(0) // below the 2-char threshold
  })
})

/* ---------------- today intelligence (§28) ---------------- */

describe('streak milestones', () => {
  it('reports the next real milestone and how far away it is', () => {
    const days = Array.from({ length: 5 }, (_, i) => subDaysStr(today, i))
    const state = mkWorkState({
      habits: [mkHabit()],
      checkins: { h1: Object.fromEntries(days.map((d) => [d, { done: true }])) },
    })
    const m = streakMilestone(state, state.habits[0])
    expect(m.current).toBe(5)
    expect(m.target).toBe(7)
    expect(m.away).toBe(2)
    expect(MILESTONE_STREAKS).toContain(m.target)
  })

  it('returns null past the last milestone instead of inventing one', () => {
    const days = Array.from({ length: 120 }, (_, i) => subDaysStr(today, i))
    const state = mkWorkState({
      habits: [mkHabit({ createdAt: subDaysStr(today, 200) })],
      checkins: { h1: Object.fromEntries(days.map((d) => [d, { done: true }])) },
    })
    expect(streakMilestone(state, state.habits[0])).toBeNull()
    expect(streakMilestone(state, null)).toBeNull()
  })
})

/* ---------------- consistency (§18) ---------------- */

describe('consistency', () => {
  it('refuses to score a habit without real history', () => {
    const brandNew = mkHabit({ createdAt: today })
    const c = consistencyScore(mkWorkState({ habits: [brandNew] }), brandNew, 90)
    expect(c.enough).toBe(false)
    expect(c.score).toBeNull()
    expect(consistencyLabel(null)).toBe('Not enough data')
  })

  it('scores an untouched habit as an honest zero, not as "no data"', () => {
    const habit = mkHabit()
    const c = consistencyScore(mkWorkState({ habits: [habit] }), habit, 90)
    expect(c.enough).toBe(true)
    expect(c.score).toBe(0)
    expect(c.bestRun).toBe(0)
  })

  it('scores a steady habit above an erratic one with the same volume', () => {
    const habit = mkHabit()
    const steady = Array.from({ length: 60 }, (_, i) => subDaysStr(today, i))
    const erratic = []
    for (let w = 0; w < 6; w++) {
      // bursts of 5 days, then 2 days off — same order of magnitude, worse rhythm
      for (let d = 0; d < 5; d++) erratic.push(subDaysStr(today, w * 7 + d))
    }
    const sSteady = mkWorkState({ habits: [habit], checkins: { h1: Object.fromEntries(steady.map((d) => [d, { done: true }])) } })
    const sErratic = mkWorkState({ habits: [habit], checkins: { h1: Object.fromEntries(erratic.map((d) => [d, { done: true }])) } })
    const a = consistencyScore(sSteady, habit, 90)
    const b = consistencyScore(sErratic, habit, 90)
    expect(a.enough && b.enough).toBe(true)
    expect(a.score).toBeGreaterThan(b.score)
    expect(a.bestRun).toBeGreaterThan(b.bestRun)
    expect(consistencyLabel(a.score)).toMatch(/Rock solid|Strong/)
  })
})
