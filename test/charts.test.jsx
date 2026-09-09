import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useChartSeries, ChartLegend, ChartCard, summarizeSeries } from '../src/components/charts/system.jsx'
import { MultiSeriesChart, GroupedBars, BulletRow } from '../src/components/charts/multi.jsx'

const SERIES = [
  { id: 'study', label: 'Study', points: [
    { date: '2026-09-01', value: 80 }, { date: '2026-09-02', value: null }, { date: '2026-09-03', value: 100 },
  ] },
  { id: 'gym', label: 'Exercise', accent: '#34d399', points: [
    { date: '2026-09-01', value: 50 }, { date: '2026-09-02', value: 60 }, { date: '2026-09-03', value: 70 },
  ] },
]

function Harness({ series = SERIES }) {
  const { styles, focusId, toggleFocus } = useChartSeries(series)
  return (
    <>
      <ChartLegend series={series} styles={styles} focusId={focusId} onToggle={toggleFocus} />
      <MultiSeriesChart series={series} styles={styles} focusId={focusId} />
    </>
  )
}

describe('chart system', () => {
  it('summarizes series honestly, including gaps', () => {
    expect(summarizeSeries([])).toBe('No data yet.')
    const s = summarizeSeries(SERIES)
    expect(s).toContain('Study: average 90%')
    expect(s).toContain('over 2 points with data') // the null is excluded, not zeroed
    expect(s).toContain('Exercise: average 60%')
  })

  it('renders lines with a full text equivalent', () => {
    render(<MultiSeriesChart series={SERIES} />)
    const img = screen.getByRole('img')
    expect(img.getAttribute('aria-label')).toContain('Study')
    expect(img.getAttribute('aria-label')).toContain('no data') // the gap is announced
  })

  it('legend focus dims siblings without removing data', () => {
    const { container } = render(<Harness />)
    const groups = () => [...container.querySelectorAll('.vchart svg > g')].filter((g) => g.hasAttribute('opacity'))
    expect(groups().every((g) => g.getAttribute('opacity') === '1')).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Focus Study' }))
    const after = groups()
    expect(after.map((g) => g.getAttribute('opacity'))).toEqual(['1', '0.22'])
    expect(screen.getByRole('button', { name: 'Show all' })).toBeTruthy()
    // both series still in the DOM — focus never deletes
    expect(container.querySelectorAll('.vchart svg path').length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('button', { name: 'Show all' }))
    expect(groups().every((g) => g.getAttribute('opacity') === '1')).toBe(true)
  })

  it('honors custom accents through the palette', () => {
    const { container } = render(<Harness />)
    const paths = [...container.querySelectorAll('.vchart svg path')]
    expect(paths.some((p) => p.getAttribute('stroke') === '#34d399')).toBe(true)
  })

  it('ChartCard gates on enough with an honest empty state', () => {
    const { rerender } = render(
      <ChartCard title="Trend" enough={false} emptyHint="Check in for a few days first."><p>chart</p></ChartCard>
    )
    expect(screen.getByText('Not enough data yet.')).toBeTruthy()
    expect(screen.queryByText('chart')).toBeNull()
    rerender(
      <ChartCard title="Trend" enough summary="Study averaged 90%"><p>chart</p></ChartCard>
    )
    expect(screen.getByText('chart')).toBeTruthy()
    expect(screen.getByText('Study averaged 90%')).toBeTruthy()
  })

  it('GroupedBars renders values, hollows nulls, labels everything', () => {
    render(
      <GroupedBars
        series={[{ id: 'a', label: 'Actual' }, { id: 'e', label: 'Expected' }]}
        groups={[{ label: 'Mon', values: { a: 40, e: null } }]}
      />
    )
    const img = screen.getByRole('img')
    expect(img.getAttribute('aria-label')).toContain('Mon: Actual 40%, Expected no data')
  })

  it('BulletRow shows value vs target with a text equivalent', () => {
    render(<BulletRow label="Completion" value={72} target={80} />)
    expect(screen.getByRole('img', { name: 'Completion: 72%, target 80%' })).toBeTruthy()
    expect(screen.getByText('target 80%')).toBeTruthy()
  })

  it('caps at 6 series', () => {
    const many = Array.from({ length: 9 }, (_, i) => ({
      id: `s${i}`, label: `S${i}`, points: [{ date: '2026-09-01', value: 10 }],
    }))
    const { container } = render(<MultiSeriesChart series={many} />)
    const groups = [...container.querySelectorAll('.vchart svg > g')].filter((g) => g.hasAttribute('opacity'))
    expect(groups).toHaveLength(6)
  })
})
