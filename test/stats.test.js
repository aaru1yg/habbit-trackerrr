import { describe, it, expect } from 'vitest'
import { isScheduled, scheduleLabel } from '../src/lib/schedule.js'
import {
  dayStats, habitStreak, habitBestStreak, habitRate, weekStats, weekDelta,
  rankHabits, weakestWeekday, dailyInsight, weeklyReview, achievements,
  moodStats, moodHabitLink, projectProgress, todayStats, activeHabits,
} from '../src/lib/stats.js'
import { todayStr, addDaysStr, subDaysStr, weekDays, monthDays, monthWeekBands, isValidDayStr } from '../src/lib/dates.js'
import { normalizeImport, exportPayload } from '../src/lib/importExport.js'

const today = todayStr()
const mkHabit = (over = {}) => ({
  id: 'h1', name: 'Meditate', category: 'mind',
  schedule: { type: 'daily' }, reminder: null, notes: '',
  createdAt: subDaysStr(today, 60), archived: false, order: 0, ...over,
})

const mkState = (habits, checkins = {}, extra = {}) => ({
  version: 3,
  profile: { name: 'Test', onboarded: true, theme: 'midnight', lastBackupExport: null, lastBackupReminder: null, reminderNoteSeen: false },
  habits, checkins, projects: [], moods: {}, ...extra,
})

const mark = (state, habitId, dates) => {
  const days = { ...(state.checkins[habitId] || {}) }
  for (const d of dates) days[d] = { done: true }
  return { ...state, checkins: { ...state.checkins, [habitId]: days } }
}

describe('schedule', () => {
  const monWedFri = mkHabit({ schedule: { type: 'weekdays', days: [1, 3, 5] } })
  it('is scheduled only on picked weekdays', () => {
    // find a known Monday
    let d = today
    while (new Date(`${d}T12:00:00`).getDay() !== 1) d = addDaysStr(d, 1)
    expect(isScheduled(monWedFri, d)).toBe(true)        // Mon
    expect(isScheduled(monWedFri, addDaysStr(d, 1))).toBe(false) // Tue
    expect(isScheduled(monWedFri, addDaysStr(d, 2))).toBe(true)  // Wed
  })
  it('daily habits are scheduled every day; archived never', () => {
    expect(isScheduled(mkHabit(), today)).toBe(true)
    expect(isScheduled(mkHabit({ archived: true }), today)).toBe(false)
  })
  it('labels common patterns', () => {
    expect(scheduleLabel(mkHabit())).toBe('Every day')
    expect(scheduleLabel(mkHabit({ schedule: { type: 'weekdays', days: [1, 2, 3, 4, 5] } }))).toBe('Weekdays')
    expect(scheduleLabel(mkHabit({ schedule: { type: 'weekdays', days: [0, 6] } }))).toBe('Weekends')
    expect(scheduleLabel(monWedFri)).toBe('Mon · Wed · Fri')
  })
})

describe('streaks', () => {
  it('counts consecutive days ending today', () => {
    let s = mkState([mkHabit()])
    s = mark(s, 'h1', [today, subDaysStr(today, 1), subDaysStr(today, 2)])
    expect(habitStreak(s, s.habits[0])).toBe(3)
  })

  it('forgives today if not yet done', () => {
    let s = mkState([mkHabit()])
    s = mark(s, 'h1', [subDaysStr(today, 1), subDaysStr(today, 2)])
    expect(habitStreak(s, s.habits[0])).toBe(2)
  })

  it('breaks on a missed eligible day', () => {
    let s = mkState([mkHabit()])
    s = mark(s, 'h1', [today, subDaysStr(today, 1), subDaysStr(today, 3)])
    expect(habitStreak(s, s.habits[0])).toBe(2)
  })

  it('skips non-scheduled days without breaking (Mon/Wed/Fri habit)', () => {
    const habit = mkHabit({ id: 'mwf', schedule: { type: 'weekdays', days: [1, 3, 5] } })
    let s = mkState([habit])
    // complete the 8 most recent scheduled days (up to today)
    const done = []
    let cursor = today
    while (done.length < 8) {
      if (isScheduled(habit, cursor)) done.push(cursor)
      cursor = subDaysStr(cursor, 1)
    }
    s = mark(s, 'mwf', done)
    expect(habitStreak(s, habit)).toBe(8)
  })

  it('best streak survives gaps in history', () => {
    let s = mkState([mkHabit()])
    s = mark(s, 'h1', [subDaysStr(today, 40), subDaysStr(today, 41), subDaysStr(today, 42), today])
    expect(habitBestStreak(s, s.habits[0])).toBe(3)
  })
})

describe('day / week stats', () => {
  it('dayStats counts only eligible habits', () => {
    const habits = [
      mkHabit({ id: 'a' }),
      mkHabit({ id: 'b', archived: true }),
      mkHabit({ id: 'c', createdAt: today }), // new today
    ]
    let s = mkState(habits)
    s = mark(s, 'a', [today])
    const d = dayStats(s, today)
    expect(d.total).toBe(2) // a + c (b archived)
    expect(d.done).toBe(1)
    expect(d.pct).toBe(50)
  })

  it('dayStats excludes habits created after the date', () => {
    const habits = [mkHabit({ id: 'a', createdAt: today })]
    const s = mkState(habits)
    const d = dayStats(s, subDaysStr(today, 1))
    expect(d.total).toBe(0)
    expect(d.pct).toBeNull()
  })

  it('weekStats aggregates; delta compares (0% last week is real data, not "no data")', () => {
    const thisW = weekDays(today)
    const lastW = weekDays(subDaysStr(today, 7))
    let s = mkState([mkHabit({ id: 'a' })])
    s = mark(s, 'a', thisW.slice(0, 3))
    const delta = weekDelta(s, thisW, lastW)
    expect(delta.a.done).toBe(3)
    // habit existed + was scheduled all last week with zero done → honest 0%
    expect(delta.delta).toBe(delta.a.pct - 0)
    // but with NO habits at all, there is nothing to compare
    const empty = weekDelta(mkState([]), thisW, lastW)
    expect(empty.delta).toBeNull()
    let s2 = mark(s, 'a', lastW.slice(0, 7))
    const delta2 = weekDelta(s2, thisW, lastW)
    expect(delta2.a.pct).toBeLessThan(delta2.b.pct)
    expect(delta2.delta).toBe(delta2.a.pct - delta2.b.pct)
  })
})

describe('honest analytics', () => {
  it('dailyInsight is null with no habits; honest with no check-ins', () => {
    expect(dailyInsight(mkState([]))).toBeNull()
    const s = mkState([mkHabit()])
    const ins = dailyInsight(s)
    expect(ins).toBeTruthy()
    expect(ins.text).toMatch(/first check-in|check-ins/i)
  })

  it('weeklyReview says so when there is nothing to review', () => {
    const r = weeklyReview(mkState([mkHabit()]))
    expect(r.enough).toBe(false)
    expect(r.headline).toMatch(/nothing to review yet/i)
  })

  it('rankHabits excludes brand-new habits (fewer than minDays eligible)', () => {
    let s = mkState([
      mkHabit({ id: 'new', createdAt: subDaysStr(today, 1) }), // 2 eligible days
      mkHabit({ id: 'old', createdAt: subDaysStr(today, 60) }),
    ])
    s = mark(s, 'old', [today])
    const ranked = rankHabits(s, subDaysStr(today, 6), today, 3)
    expect(ranked.map((r) => r.habit.id)).toEqual(['old'])
  })

  it('weakestWeekday needs ≥2 scheduled instances of a weekday', () => {
    // habit created yesterday → at most 1 instance per weekday → null
    expect(weakestWeekday(mkState([mkHabit({ createdAt: subDaysStr(today, 1) })]), 8)).toBeNull()
    // habit existed 60 days, zero done → 0% is real, reportable data
    const w = weakestWeekday(mkState([mkHabit()]), 8)
    expect(w).toBeTruthy()
    expect(w.rate).toBe(0)
  })

  it('achievements only from real streaks', () => {
    let s = mkState([mkHabit()])
    s = mark(s, 'h1', [subDaysStr(today, 1), subDaysStr(today, 2), subDaysStr(today, 3)])
    const a = achievements(s)
    expect(a.badges.find((b) => b.id === 'bronze').earned).toBe(true)
    expect(a.badges.find((b) => b.id === 'silver').earned).toBe(false)
    expect(a.next.id).toBe('silver')
  })

  it('moodHabitLink returns null without both mood sides', () => {
    let s = mkState([mkHabit()])
    s = mark(s, 'h1', [today])
    s = { ...s, moods: { [today]: { score: 4 } } }
    expect(moodHabitLink(s, 30)).toBeNull()
  })

  it('moodStats averages only logged days', () => {
    const s = { ...mkState([]), moods: { [today]: { score: 4 }, [subDaysStr(today, 1)]: { score: 2 } } }
    const m = moodStats(s, 30)
    expect(m.count).toBe(2)
    expect(m.avg).toBe(3)
  })
})

describe('projects', () => {
  it('progress is task-based, legacy percent only as fallback', () => {
    const p = { id: 'p1', name: 'X', milestones: [{ id: 'm', name: 'M', tasks: [{ id: 't1', name: 'A', done: true }, { id: 't2', name: 'B', done: false }] }] }
    expect(projectProgress(p)).toBe(50)
    const legacy = { id: 'p2', name: 'Y', milestones: [], legacyPercent: 70 }
    expect(projectProgress(legacy)).toBe(70)
  })
})

describe('dates', () => {
  it('monthDays + week bands', () => {
    const days = monthDays(2026, 0) // Jan 2026 → 31 days
    expect(days).toHaveLength(31)
    expect(days[0].weekday).toBe(4) // Jan 1 2026 is a Thursday
    const bands = monthWeekBands(days)
    expect(bands).toHaveLength(5)
    expect(bands[0].days).toHaveLength(7)
  })
  it('validates yyyy-MM-dd', () => {
    expect(isValidDayStr('2026-01-05')).toBe(true)
    expect(isValidDayStr('2026-1-5')).toBe(false)
    expect(isValidDayStr('garbage')).toBe(false)
    expect(isValidDayStr(42)).toBe(false)
  })
})

describe('import / export', () => {
  it('export → import round-trips', () => {
    let s = mkState([mkHabit()])
    s = mark(s, 'h1', [today])
    const payload = exportPayload(s)
    const parsed = JSON.parse(JSON.stringify(payload))
    const back = normalizeImport(parsed)
    expect(back.habits[0].name).toBe('Meditate')
    expect(back.checkins.h1[today].done).toBe(true)
  })

  it('rejects malformed JSON payloads', () => {
    expect(() => normalizeImport(null)).toThrow()
    expect(() => normalizeImport('nope')).toThrow()
    expect(() => normalizeImport({ foo: 1 })).toThrow()
    expect(() => normalizeImport({ habits: 'not-an-array' })).toThrow()
  })

  it('accepts a well-formed empty state (no onboarding loop for habit-less users)', () => {
    const empty = {
      version: 3,
      profile: { name: 'Aaru', onboarded: true, theme: 'verdant' },
      habits: [], checkins: {}, projects: [], moods: {},
    }
    const clean = normalizeImport(empty)
    expect(clean.habits).toHaveLength(0)
    expect(clean.profile.onboarded).toBe(true)
    expect(clean.profile.name).toBe('Aaru')
    // still rejects an array of unparseable habits (junk, not empty)
    expect(() => normalizeImport({ habits: [{ name: 42 }] })).toThrow(/No habits, projects, assignments, or moods/i)
  })

  it('drops invalid entries but keeps valid ones', () => {
    const dirty = {
      habits: [{ id: 'good', name: 'Good' }, { noName: true }, 42, { name: '   ' }],
      checkins: {
        good: { '2026-13-99': { done: true }, '2026-01-05': { done: true }, '2026-01-06': 'junk' },
        ghost: { '2026-01-05': { done: true } }, // no matching habit → dropped
      },
      moods: { '2026-01-05': { score: 9 }, '2026-01-07': { score: 3 } },
    }
    const clean = normalizeImport(dirty)
    expect(clean.habits).toHaveLength(1)
    expect(Object.keys(clean.checkins.good)).toEqual(['2026-01-05'])
    expect(clean.checkins.ghost).toBeUndefined()
    expect(Object.keys(clean.moods)).toEqual(['2026-01-07'])
  })

  it('imports v2-era exports (raw state with legacy projects and moods)', () => {
    const v2 = {
      habits: [{ id: 'x1', name: 'Gym', isDaily: true, targetValue: 1 }],
      checkins: { x1: { [today]: { value: 1, done: true } } },
      projects: { x1: { percent: 60 } },
      mood: { [today]: { mood: 8, motivation: 6 } },
      profile: { name: 'Old' },
    }
    const clean = normalizeImport(v2)
    expect(clean.habits[0].name).toBe('Gym')
    expect(clean.projects[0].legacyPercent).toBe(60)
    expect(clean.moods[today].score).toBeGreaterThanOrEqual(1)
    expect(clean.moods[today].score).toBeLessThanOrEqual(5)
  })

  it('handles wrong-typed fields safely (throws only the friendly "empty" error)', () => {
    const weird = { habits: [{ name: 123 }], checkins: [], moods: [], projects: {} }
    expect(() => normalizeImport(weird)).toThrow(/No habits, projects, assignments, or moods found/i)
    // one valid habit amid junk survives
    const mixed = { habits: [{ name: 123 }, { name: 'Fine' }], checkins: [], moods: [], projects: {} }
    const clean = normalizeImport(mixed)
    expect(clean.habits.map((h) => h.name)).toEqual(['Fine'])
  })
})
