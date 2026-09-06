/* Today hero — the immersive command center renders honest data only. */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StoreProvider } from '../src/store.jsx'
import TodayHero from '../src/components/today/TodayHero.jsx'

const wrap = (ui) => render(<StoreProvider>{ui}</StoreProvider>)

const stats = (done, total, pct) => ({ done, total, pct })
const top = { streak: 6, habit: { id: 'h1', name: 'Drink water' } }
const week = {
  rows: [
    { day: '2026-08-31', label: 'Mon', pct: 66, done: 2, total: 3 },
    { day: '2026-09-01', label: 'Tue', pct: 100, done: 3, total: 3 },
    { day: '2026-09-02', label: 'Wed', pct: 0, done: 0, total: 3 },
  ],
  avg: 55,
  hasAny: true,
}

describe('TodayHero', () => {
  it('shows the completion summary and copy', () => {
    wrap(<TodayHero stats={stats(1, 3, 33)} top={top} copy="2 small finishes left." week={week} />)
    expect(screen.getByText('2 small finishes left.')).toBeTruthy()
    expect(screen.getByRole('img', { name: '33 percent complete today' })).toBeTruthy()
  })

  it('reports an empty day honestly', () => {
    wrap(<TodayHero stats={stats(0, 0, 0)} top={{ streak: 0, habit: null }} copy="No habits scheduled for today." week={{ rows: [], avg: 0, hasAny: false }} />)
    expect(screen.getByRole('img', { name: 'No habits yet' })).toBeTruthy()
    expect(screen.getByText('no check-ins yet')).toBeTruthy()
  })

  it('renders the 7-day rail from real rows', () => {
    wrap(<TodayHero stats={stats(1, 3, 33)} top={top} copy="x" week={week} />)
    expect(screen.getByText('55% avg')).toBeTruthy()
    expect(screen.getAllByTitle(/·/).length).toBe(3)
  })

  it('surfaces streak risk without inventing it', () => {
    wrap(<TodayHero stats={stats(0, 3, 0)} top={top} copy="x" week={week} atRisk={{ habit: { name: 'Drink water' }, streak: 6 }} />)
    expect(screen.getByText(/6-day streak on Drink water is at risk/)).toBeTruthy()
  })

  it('pulses the core once when a new completion lands', () => {
    const { rerender, container } = wrap(
      <TodayHero stats={stats(1, 3, 33)} top={top} copy="x" week={week} />,
    )
    expect(container.querySelector('.core-pulse')).toBeNull()
    rerender(
      <StoreProvider>
        <TodayHero stats={stats(2, 3, 66)} top={top} copy="x" week={week} />
      </StoreProvider>,
    )
    expect(container.querySelector('.core-pulse.go')).toBeTruthy()
  })
})
