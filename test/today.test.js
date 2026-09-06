import { describe, it, expect } from 'vitest'
import {
  todayPriorities, dayTimeline, todayGoals, todayHeadline,
} from '../src/lib/today.js'
import { todayStr, subDaysStr, addDaysStr } from '../src/lib/dates.js'

// Fixed midday avoids making the due-today assertion depend on the CI start hour.
const NOW = new Date()
NOW.setHours(12, 0, 0, 0)

const base = (over = {}) => ({
  version: 4,
  profile: { name: 'T', onboarded: true, theme: 'midnight' },
  habits: [],
  checkins: {},
  routines: [],
  projects: [],
  assignments: [],
  moods: {},
  ...over,
})

const isoToday = (hhmm = '12:00') => `${todayStr()}T${hhmm}`
const isoIn = (days, hhmm = '12:00') => `${addDaysStr(todayStr(), days)}T${hhmm}`

const habit = (id, over = {}) => ({
  id, name: id, category: 'mind', schedule: { type: 'daily' },
  reminder: null, createdAt: subDaysStr(todayStr(), 60), archived: false, priority: 'normal', ...over,
})

describe('today plan', () => {
  it('returns nothing invented for an empty state', () => {
    expect(todayPriorities(base())).toEqual([])
    expect(dayTimeline(base())).toEqual([])
    expect(todayGoals(base())).toEqual([])
    const head = todayHeadline(base(), { now: NOW })
    expect(head.text).toMatch(/Nothing overdue/)
  })

  it('ranks overdue work above work due today above habits', () => {
    const s = base({
      habits: [habit('h1'), habit('h2')],
      assignments: [
        { id: 'late', name: 'Late essay', deadline: isoIn(-2), subtasks: [], priority: 'high' },
        { id: 'today', name: 'Due today set', deadline: isoToday('18:00'), subtasks: [], priority: 'normal' },
      ],
    })
    const rows = todayPriorities(s, { now: NOW, limit: 99 })
    expect(rows[0].id).toBe('late')
    expect(rows[0].tone).toBe('bad')
    expect(rows[0].reason).toMatch(/Overdue/)
    expect(rows.find((r) => r.id === 'today').tone).toBe('warn')
    // habits land last
    expect(rows.slice(-2).every((r) => r.kind === 'habit')).toBe(true)
  })

  it('does not list already-completed work', () => {
    const s = base({
      assignments: [
        { id: 'done', name: 'Finished', deadline: isoIn(-3), completedAt: isoIn(-4), subtasks: [] },
      ],
    })
    expect(todayPriorities(s, { now: NOW, limit: 99 }).map((r) => r.id)).not.toContain('done')
  })

  it('drops a habit once it is checked off today', () => {
    const s = base({
      habits: [habit('a'), habit('b')],
      checkins: { a: { [todayStr()]: { done: true } } },
    })
    const rows = todayPriorities(s, { now: NOW, limit: 99 })
    expect(rows.map((r) => r.id)).toEqual(['b'])
  })

  it('flags a long streak as at risk so the reason is honest', () => {
    const days = {}
    for (let i = 1; i <= 9; i++) days[subDaysStr(todayStr(), i)] = { done: true }
    const s = base({ habits: [habit('streaky')], checkins: { streaky: days } })
    const row = todayPriorities(s, { now: NOW, limit: 99 }).find((r) => r.id === 'streaky')
    expect(row.reason).toMatch(/streak at risk/)
    expect(row.tone).toBe('warn')
  })

  it('includes tasks due today from inside an open project', () => {
    const s = base({
      projects: [{
        id: 'p1', name: 'Thesis', deadline: isoIn(30), priority: 'normal',
        milestones: [{ id: 'm1', name: 'Draft', tasks: [{ id: 't1', name: 'Chapter 3', due: todayStr(), done: false }] }],
      }],
    })
    const rows = todayPriorities(s, { now: NOW, limit: 99 })
    const task = rows.find((r) => r.kind === 'task')
    expect(task).toBeTruthy()
    expect(task.name).toBe('Chapter 3')
    expect(task.reason).toMatch(/Thesis/)
  })

  it('timeline orders reminders by time and puts untimed habits last', () => {
    const s = base({
      habits: [
        habit('morning', { reminder: '07:30' }),
        habit('anytime'),
        habit('evening', { reminder: '21:00' }),
      ],
    })
    const tl = dayTimeline(s, { now: NOW })
    expect(tl.map((e) => e.label)).toEqual(['morning', 'evening', 'anytime'])
    expect(tl[2].note).toBe('Any time')
    expect(tl[2].time).toBe(null)
  })

  it('timeline includes only deadlines that fall on this exact day', () => {
    const s = base({
      projects: [
        { id: 'today', name: 'Today thing', deadline: isoToday('17:00'), milestones: [] },
        { id: 'later', name: 'Later thing', deadline: isoIn(3), milestones: [] },
      ],
    })
    const tl = dayTimeline(s, { now: NOW })
    expect(tl.map((e) => e.label)).toContain('Today thing')
    expect(tl.map((e) => e.label)).not.toContain('Later thing')
  })

  it('honours the habit limit and respects the page limit', () => {
    const s = base({
      habits: ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => habit(id)),
    })
    expect(todayPriorities(s, { now: NOW, limit: 2 }).length).toBe(2)
  })

  it('goals: sorts by closeness of deadline and reports pace honestly', () => {
    const s = base({
      projects: [
        { id: 'far', name: 'Far', deadline: isoIn(40), startDate: subDaysStr(todayStr(), 5), milestones: [] },
        { id: 'near', name: 'Near', deadline: isoIn(2), startDate: subDaysStr(todayStr(), 5), milestones: [] },
        { id: 'done', name: 'Done', deadline: isoIn(2), completedAt: isoIn(-1), milestones: [] },
      ],
    })
    const goals = todayGoals(s, { now: NOW, limit: 5 })
    expect(goals.map((g) => g.id)).toEqual(['near', 'far'])
    for (const g of goals) {
      expect(g.expected).toBeGreaterThanOrEqual(0)
      expect(typeof g.behind).toBe('number')
    }
  })

  it('headline counts overdue items and says so', () => {
    const s = base({
      assignments: [
        { id: 'a', name: 'A', deadline: isoIn(-1), subtasks: [] },
        { id: 'b', name: 'B', deadline: isoIn(-5), subtasks: [] },
      ],
    })
    const head = todayHeadline(s, { now: NOW })
    expect(head.tone).toBe('bad')
    expect(head.text).toMatch(/2 items already overdue/)
  })
})
