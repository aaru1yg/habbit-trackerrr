/* Insights viz 2.0 — honest scatter maths + the three new viz contracts. */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

const rectAt = (top, height = 400) => vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect')
  .mockReturnValue({ width: 800, height, top, left: 0, bottom: top + height, right: 800, x: 0, y: top, toJSON: () => {} })

import { moodScatter, scatterTrend } from '../src/lib/analytics.js'
import DayClock from '../src/components/charts/DayClock.jsx'
import PulseRibbon from '../src/components/charts/PulseRibbon.jsx'
import MoodScatter from '../src/components/charts/MoodScatter.jsx'

/* ---- fixtures ---- */
const day = (offset) => {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return d.toISOString().slice(0, 10)
}
// 10 days: mood score rises 1..5 twice, completion rises with it → strong +r
const paired = Array.from({ length: 10 }, (_, i) => ({
  date: day(-i), mood: 1 + (i % 5), pct: 20 + (i % 5) * 18,
}))
const stateWith = (points) => ({
  habits: [{ id: 'h1', name: 'Run', archived: false, schedule: { type: 'daily' } }],
  checkins: {
    h1: Object.fromEntries(points.map((p) => [p.date, { done: p.pct >= 50, at: `${p.date}T08:00:00` }])),
  },
  moods: Object.fromEntries(points.map((p) => [p.date, { score: p.mood, energy: 3, focus: 3, motivation: 3 }])),
})

describe('moodScatter (lib)', () => {
  it('stays hidden below eight paired days', () => {
    const sc = moodScatter(stateWith(paired.slice(0, 5)))
    expect(sc.enough).toBe(false)
    expect(sc.r).toBeNull()
    expect(sc.points).toHaveLength(5)
  })

  it('computes Pearson r over real paired days only', () => {
    const sc = moodScatter(stateWith(paired))
    expect(sc.enough).toBe(true)
    expect(sc.n).toBe(10)
    // one scheduled habit binarises each day to 0/100, so r is high but not 1
    expect(sc.r).toBeGreaterThan(0.8)
  })

  it('ignores days without scheduled checks or without mood', () => {
    const st = stateWith(paired)
    st.moods[day(-1)] = null
    const sc = moodScatter(st)
    expect(sc.points.some((p) => p.date === day(-1))).toBe(false)
  })
})

describe('scatterTrend (lib)', () => {
  it('refuses to draw a line under |r| < 0.3', () => {
    const noisy = paired.map((p, i) => ({ ...p, pct: i % 2 ? 50 : 52, mood: 1 + (i % 5) }))
    const sc = moodScatter(stateWith(noisy))
    expect(sc.enough).toBe(true)
    expect(scatterTrend(sc)).toBeNull()
  })

  it('labels a clearing signal with its strength and direction', () => {
    const t = scatterTrend(moodScatter(stateWith(paired)))
    expect(t).not.toBeNull()
    expect(t.slope).toBeGreaterThan(0)
    expect(['weak', 'moderate']).toContain(t.strength)
  })
})

describe('DayClock', () => {
  it('renders nothing without enough timestamped check-ins', () => {
    const { container } = render(<DayClock data={{ enough: false, parts: [], total: 3 }} />)
    expect(container.firstChild).toBeNull()
  })

  it('draws four clock quadrants and marks the peak band', () => {
    rectAt(0)
    const data = {
      enough: true,
      total: 40,
      peak: 'morning',
      parts: [
        { id: 'morning', label: 'Morning', count: 20, pct: 50 },
        { id: 'afternoon', label: 'Afternoon', count: 10, pct: 25 },
        { id: 'evening', label: 'Evening', count: 10, pct: 25 },
        { id: 'night', label: 'Night', count: 0, pct: 0 },
      ],
    }
    const { container } = render(<DayClock data={data} />)
    expect(container.querySelectorAll('.dayclock-arc')).toHaveLength(4)
    expect(container.querySelectorAll('.dayclock-legend li')).toHaveLength(4)
    expect(container.querySelector('.dayclock-legend i.peak')).not.toBeNull()
    // zero band stays a hairline track, never invisible
    const widths = [...container.querySelectorAll('.dayclock-arc')].map((a) => Number(a.getAttribute('stroke-width')))
    expect(Math.min(...widths)).toBeLessThan(Math.max(...widths))
    expect(container.querySelector('svg').getAttribute('aria-label')).toMatch(/night 0%/)
  })
})

describe('PulseRibbon', () => {
  const months = Array.from({ length: 12 }, (_, m) => ({
    month: m,
    label: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m],
    pct: m < 8 ? (m + 1) * 8 : null,
    future: m > 8,
  }))

  it('renders twelve cells with honest future/empty states', () => {
    rectAt(0)
    const { container } = render(<PulseRibbon months={months} year={2026} />)
    expect(container.querySelectorAll('.ribbon-cell')).toHaveLength(12)
    expect(container.querySelectorAll('.ribbon-cell.is-future')).toHaveLength(3)
    // September (index 8) has no data and is not future → hollow
    expect(container.querySelectorAll('.ribbon-cell')[8].classList.contains('is-empty')).toBe(true)
  })

  it('puts every month value in the accessible summary', () => {
    rectAt(0)
    render(<PulseRibbon months={months} year={2026} />)
    const strip = screen.getByRole('img')
    expect(strip.getAttribute('aria-label')).toMatch(/Jan 8%/)
    expect(strip.getAttribute('aria-label')).toMatch(/Oct ahead/)
  })
})

describe('MoodScatter', () => {
  it('renders nothing until eight paired days exist', () => {
    const { container } = render(<MoodScatter data={{ enough: false, points: [], n: 4, r: null }} />)
    expect(container.firstChild).toBeNull()
  })

  it('draws one dot per real day and says association, not causation', () => {
    rectAt(0)
    const sc = moodScatter(stateWith(paired))
    const { container } = render(<MoodScatter data={sc} dimLabel="mood" />)
    expect(container.querySelectorAll('.scatter-dot')).toHaveLength(10)
    expect(container.textContent).toMatch(/association, not causation/)
  })

  it('adds a trend line only when the signal clears the gate', () => {
    rectAt(0)
    const strong = moodScatter(stateWith(paired))
    const { container } = render(<MoodScatter data={strong} />)
    expect(container.querySelector('.scatter-trend')).not.toBeNull()

    const noisy = paired.map((p, i) => ({ ...p, pct: i % 2 ? 50 : 52 }))
    const weak = moodScatter(stateWith(noisy))
    const { container: c2 } = render(<MoodScatter data={weak} />)
    expect(c2.querySelector('.scatter-trend')).toBeNull()
    expect(c2.textContent).toMatch(/too weak to draw a trend line/)
  })
})
