import { useMemo, useState } from 'react'
import { LineSeries } from '../charts/workCharts.jsx'
import { shortDate } from '../../lib/dates.js'

const SERIES = [
  { id: 'available', label: 'Available', color: 'var(--c6)' },
  { id: 'committed', label: 'Committed', color: 'var(--c4)' },
  { id: 'remaining', label: 'Remaining', color: 'var(--c3)' },
]

const valueOf = (row, id) => id === 'available' ? row.availableMin : id === 'committed' ? row.committedMin : row.remainingMin

/**
 * Work's honest capacity picture. It is a view over workloadByDay output;
 * toggling a line only changes emphasis and never changes the underlying
 * capacity model.
 */
export default function WorkCapacitySeries({ rows = [], compact = false }) {
  const [visible, setVisible] = useState(() => new Set(SERIES.map((s) => s.id)))

  const hasData = rows.some((row) => row.items?.length > 0 || SERIES.some((s) => valueOf(row, s.id) != null))
  const chart = useMemo(() => {
    const active = SERIES.filter((s) => visible.has(s.id))
    const values = active.flatMap((s) => rows.map((row) => valueOf(row, s.id))).filter((value) => Number.isFinite(value))
    const max = Math.max(1, ...values.map((value) => Math.abs(value)))
    return {
      active,
      domain: [-max, max],
      series: active.map((s) => ({
        ...s,
        points: rows.map((row) => ({ date: row.date, value: valueOf(row, s.id) })),
      })),
    }
  }, [rows, visible])

  if (!hasData) return null

  const toggle = (id) => {
    setVisible((current) => {
      if (current.has(id) && current.size === 1) return current
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const summary = rows.map((row) => {
    const values = chart.active.map((s) => `${s.label.toLowerCase()} ${valueOf(row, s.id) == null ? 'not set' : `${Math.round(valueOf(row, s.id))} minutes`}`)
    return `${shortDate(row.date)}: ${values.join(', ')}`
  }).join('. ')

  return (
    <section className={`work-capacity-visual card pad${compact ? ' is-compact' : ''}`} aria-labelledby="work-capacity-chart-title">
      <div className="work-capacity-head">
        <div>
          <p className="eyebrow">Capacity signal</p>
          <h3 id="work-capacity-chart-title">Available vs committed</h3>
          <p className="tiny muted">Deadline-based estimates · minutes</p>
        </div>
        <div className="chart-series-toggle" role="group" aria-label="Capacity series">
          {SERIES.map((series) => {
            const active = visible.has(series.id)
            return (
              <button
                key={series.id}
                type="button"
                className={`chart-series-button${active ? ' is-active' : ''}`}
                aria-pressed={active}
                onClick={() => toggle(series.id)}
              >
                <i style={{ background: series.color }} aria-hidden="true" />
                {series.label}
              </button>
            )
          })}
        </div>
      </div>
      <LineSeries
        series={chart.series}
        domain={chart.domain}
        unit="m"
        height={compact ? 170 : 205}
        ariaLabel={`Work capacity series. ${summary}`}
      />
      <p className="chart-summary">{summary}</p>
    </section>
  )
}
