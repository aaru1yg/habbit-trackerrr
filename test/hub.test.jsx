/* ============================================================
   HABIT OS V4 — hub tests: per-habit identity (colour + priority),
   master graph, focus rings, day sheet, priority-sorted Today plan.
   Every case uses real stored data; nothing is fabricated.
   ============================================================ */
import { describe, it, expect, afterEach } from 'vitest'
import { useEffect, useRef } from 'react'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { StoreProvider, useStore } from '../src/store.jsx'
import { habitColorHex, habitPriority, HABIT_COLOR_PALETTE } from '../src/lib/habitIdentity.js'
import { runEndingOn } from '../src/lib/stats.js'
import MasterGraph from '../src/components/charts/MasterGraph.jsx'
import DaySheet from '../src/components/today/DaySheet.jsx'
import { FocusRings } from '../src/components/today/HubZones.jsx'
import { todayPriorities } from '../src/lib/today.js'
import { todayStr, subDaysStr } from '../src/lib/dates.js'

afterEach(() => { cleanup(); localStorage.clear(); window.location.hash = '' })

const wrap = (ui) => render(<StoreProvider>{ui}</StoreProvider>)

/** Seed real habits + real check-ins through the store, then mount ui. */
function Seed({ children, habitPatch = {}, checkinDays = [], second = {} }) {
  const { dispatch } = useStore()
  const ran = useRef(false)
  useEffect(() => {
    if (ran.current) return
    ran.current = true
    dispatch({ type: 'ADD_HABIT', habit: { id: 'h-run', name: 'Run', category: 'fitness', ...habitPatch } })
    for (const d of checkinDays) dispatch({ type: 'TOGGLE_CHECKIN', habitId: 'h-run', date: d })
    dispatch({ type: 'ADD_HABIT', habit: { id: 'h-read', name: 'Reading', category: 'mind', color: 'violet', priority: 2, ...second } })
    const today = todayStr()
    for (let i = 0; i < 3; i++) {
      dispatch({ type: 'TOGGLE_CHECKIN', habitId: 'h-read', date: subDaysStr(today, i + 2) })
    }
    // one-time mount seeding: dispatch is stable; props are read only on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch])
  return children || null
}

/** MasterGraph driven by the real store list (as TodayScreen does). */
function StoreGraph() {
  const { state } = useStore()
  const habits = (state.habits || []).filter((h) => !h.archived)
  return <MasterGraph habits={habits} onOpenDay={() => {}} />
}

/** Renders the stored identity of the first habit so tests can assert persistence. */
function IdentityProbe() {
  const { state } = useStore()
  const h = (state.habits || [])[0]
  if (!h) return null
  return (
    <span
      data-testid="identity"
      data-color={habitColorHex(h)}
      data-prio={habitPriority(h)}
    />
  )
}

describe('habit identity (unit)', () => {
  it('resolves a stored palette id, a custom hex, and a category fallback', () => {
    expect(habitColorHex({ color: 'pink' })).toBe(HABIT_COLOR_PALETTE.find((c) => c.id === 'pink').hex)
    expect(habitColorHex({ color: '#a1c4fd' })).toBe('#a1c4fd')
    expect(habitColorHex({ category: 'mind', color: null })).toMatch(/^#/)
    expect(habitColorHex({ category: 'mind', color: 'unknown' })).toBe(habitColorHex({ category: 'mind' }))
    expect(habitColorHex(null)).toBe(HABIT_COLOR_PALETTE.find((c) => c.id === 'violet').hex)
  })

  it('defaults habits to Normal priority and never clamps outside 1–5', () => {
    expect(habitPriority({})).toBe(2)
    expect(habitPriority({ priority: 9 })).toBe(2)
    expect(habitPriority({ priority: 5 })).toBe(5)
    expect(habitPriority({ priority: 'high' })).toBe(2)
  })

  it('runEndingOn counts the honest run ending on a given day', () => {
    // Fixed literal days keep the test immune to clock/time-zone drift.
    const h = { id: 'h', createdAt: '2026-08-28', schedule: { type: 'daily' } }
    const state = {
      habits: [h],
      checkins: {
        h: {
          '2026-09-06': { done: true },
          '2026-09-05': { done: true },
          '2026-09-04': { done: true },
          // a gap on 2026-09-03 stops the run
          '2026-09-02': { done: true },
        },
      },
    }
    expect(runEndingOn(state, h, '2026-09-06')).toBe(3) // 06 · 05 · 04
    expect(runEndingOn(state, h, '2026-09-04')).toBe(1) // 03 is a gap
    expect(runEndingOn(state, h, '2026-09-02')).toBe(1) // nothing on 09-01
    expect(runEndingOn(state, h, '2026-09-03')).toBe(0) // gap day itself
  })
})

describe('store persistence of identity', () => {
  it('ADD_HABIT stores colour + priority on the habit (read back through helpers)', async () => {
    wrap(<Seed habitPatch={{ color: 'pink', priority: 5 }}><IdentityProbe /></Seed>)
    const el = await screen.findByTestId('identity')
    expect(el.getAttribute('data-prio')).toBe('5')
    expect(el.getAttribute('data-color')).toBe(HABIT_COLOR_PALETTE.find((c) => c.id === 'pink').hex)
  })
})

describe('master habit graph', () => {
  it('renders one toggleable chip per habit with range switches', async () => {
    wrap(
      <Seed checkinDays={[todayStr(), subDaysStr(todayStr(), 1), subDaysStr(todayStr(), 2)]}>
        <StoreGraph />
      </Seed>,
    )
    const runChip = await screen.findByRole('button', { name: /^Run/ })
    expect(runChip).toBeTruthy()
    expect(runChip.getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(runChip)
    expect(runChip.getAttribute('aria-pressed')).toBe('false')
    const seven = screen.getByRole('button', { name: '7D' })
    fireEvent.click(seven)
    expect(seven.getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: /All/ })).toBeTruthy()
  })

  it('gives the svg an accessible summary that names the visible habits', async () => {
    wrap(
      <Seed checkinDays={[todayStr()]}>
        <StoreGraph />
      </Seed>,
    )
    await screen.findByRole('button', { name: /^Run/ })
    const svg = document.querySelector('.master-graph svg')
    const label = svg?.getAttribute('aria-label') || ''
    expect(label).toMatch(/Run/i)
    expect(label).toMatch(/of 2 habits/i)
  })

  it('renders nothing when no habits exist', () => {
    const { container } = wrap(<StoreGraph />)
    expect(container.querySelector('.master-graph')).toBeNull()
  })
})

describe('focus rings', () => {
  it('shows rings only for high-priority habits with an honest no-data state', async () => {
    wrap(
      <Seed habitPatch={{ priority: 5, color: 'pink' }} checkinDays={[todayStr()]}>
        <FocusRings />
      </Seed>,
    )
    const runLink = await screen.findByRole('link', { name: /^Run/ })
    expect(runLink).toBeTruthy()
    expect(runLink.textContent).toMatch(/not enough data yet/i)
    // Reading is priority 2 → no ring for it
    expect(screen.queryByText('Reading')).toBeNull()
  })

  it('renders nothing when no habit is high priority', () => {
    const { container } = wrap(<Seed habitPatch={{ priority: 2 }}><FocusRings /></Seed>)
    expect(container.querySelector('.focus-rings')).toBeNull()
  })
})

describe('day sheet', () => {
  it('lists every scheduled habit and logs a past-day completion', async () => {
    wrap(
      <Seed checkinDays={[todayStr()]}>
        <DaySheet date={todayStr()} onClose={() => {}} />
      </Seed>,
    )
    const runRow = await screen.findByRole('button', { name: /Run.*completed/ })
    expect(runRow.getAttribute('aria-pressed')).toBe('true')
    const readingRow = screen.getByRole('button', { name: /Reading/ })
    expect(readingRow.getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(readingRow)
    await waitFor(() => expect(readingRow.getAttribute('aria-pressed')).toBe('true'))
  })
})

describe('today priorities respect habit priority', () => {
  it('puts critical undone habits ahead of normal ones', () => {
    const today = todayStr()
    const state = {
      habits: [
        { id: 'a', name: 'Normal habit', category: 'mind', priority: 2, createdAt: today, schedule: { type: 'daily' } },
        { id: 'b', name: 'Critical habit', category: 'health', priority: 5, createdAt: today, schedule: { type: 'daily' } },
      ],
      checkins: {},
      assignments: [],
      projects: [],
      goals: [],
      routines: [],
    }
    const rows = todayPriorities(state, { now: new Date(`${today}T10:00:00`) })
    expect(rows[0].id).toBe('b')
    expect(rows[1].id).toBe('a')
  })
})
