/* Phase 7 — deadline lanes + calendar density contracts. */
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'

const rectAt = (top, height = 400) => vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect')
  .mockReturnValue({ width: 800, height, top, left: 0, bottom: top + height, right: 800, x: 0, y: top, toJSON: () => {} })

import { deadlineLanes } from '../src/lib/work.js'
import { dayDensity } from '../src/lib/stats.js'
import DeadlineLanes from '../src/components/work/DeadlineLanes.jsx'

const day = (offset) => {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return d.toISOString().slice(0, 10)
}

const state = {
  habits: [],
  checkins: {},
  moods: {},
  projects: [
    {
      id: 'p1', name: 'Inside window', startDate: day(-4), deadline: `${day(3)}T18:00`,
      milestones: [{ id: 'm1', name: 'M', tasks: [{ id: 't1', name: 'T', done: true }, { id: 't2', name: 'U', done: false }] }],
      createdAtDay: day(-4), completedAt: null,
    },
    {
      id: 'p2', name: 'Deadline beyond window', startDate: day(-2), deadline: `${day(40)}T18:00`,
      milestones: [], createdAtDay: day(-2), completedAt: null,
    },
    {
      id: 'p3', name: 'No deadline', startDate: day(-2), deadline: null,
      milestones: [], createdAtDay: day(-2), completedAt: null,
    },
  ],
  assignments: [
    { id: 'a1', name: 'Due tomorrow', due: `${day(1)}T23:59`, subject: 'S', subtasks: [], createdAtDay: day(-1) },
    { id: 'a2', name: 'Already passed', due: `${day(-3)}T23:59`, subject: 'S', subtasks: [], createdAtDay: day(-9) },
  ],
}

describe('deadlineLanes', () => {
  it('draws only dated work that touches the window', () => {
    const m = deadlineLanes(state, { from: day(0), days: 14 })
    const names = m.lanes.map((l) => l.name)
    expect(names).toContain('Inside window')
    expect(names).toContain('Due tomorrow')
    expect(names).not.toContain('No deadline')
    // beyond-window deadline still touches the window via its start → clipped
    const far = m.lanes.find((l) => l.name === 'Deadline beyond window')
    expect(far?.clipped).toBe(true)
    expect(names).not.toContain('Already passed')
  })

  it('orders lanes by what lands first and carries real progress', () => {
    const m = deadlineLanes(state, { from: day(0), days: 14 })
    const ends = m.lanes.map((l) => l.end)
    expect([...ends].sort()).toEqual(ends)
    const inside = m.lanes.find((l) => l.name === 'Inside window')
    expect(inside.progress).toBe(50) // 1 of 2 tasks done
  })
})

describe('dayDensity', () => {
  it('treats unscheduled days as hollow, not zero', () => {
    const st = {
      habits: [{ id: 'h1', archived: false, schedule: { type: 'daily' }, createdAt: day(-2) }],
      checkins: { h1: { [day(-1)]: { done: true } } },
    }
    const rows = dayDensity(st, [day(-3), day(-1), day(0)])
    expect(rows[0].pct).toBeNull()      // before the habit existed
    expect(rows[1].pct).toBe(100)
    expect(rows[2].pct).toBe(0)         // scheduled today, nothing done yet
  })
})

describe('DeadlineLanes (component)', () => {
  it('renders one accessible lane per drawn item plus a today line', () => {
    rectAt(0)
    const m = deadlineLanes(state, { from: day(0), days: 14 })
    const { container } = render(<DeadlineLanes model={m} />)
    expect(container.querySelectorAll('.lane-row')).toHaveLength(m.lanes.length)
    expect(container.querySelector('.lanes-today')).not.toBeNull()
    const label = container.querySelector('.lane-row').getAttribute('aria-label')
    expect(label).toMatch(/percent done/)
  })

  it('says plainly when the window holds no dated work', () => {
    rectAt(0)
    const m = deadlineLanes({ ...state, projects: [], assignments: [] }, { from: day(0), days: 14 })
    const { container } = render(<DeadlineLanes model={m} />)
    expect(container.textContent).toMatch(/Nothing with a deadline lands in this window/)
  })
})
