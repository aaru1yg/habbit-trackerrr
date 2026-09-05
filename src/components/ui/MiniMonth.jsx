import { monthLabel } from '../../lib/dates.js'

/**
 * Compact month heatmap for the yearly overview.
 * cells: [{date, day, pct(0..100|null), future, noData}] from stats.monthLevels.
 * No-data and future are intentionally different states: an empty history is
 * not a zero score, and a date that has not happened is not a missing record.
 */
export default function MiniMonth({ year, month, cells, onSelect, interactive = true }) {
  const firstWeekday = new Date(year, month, 1).getDay()
  const hasObservedDay = cells.some((c) => !c.future)
  const hasRealData = cells.some((c) => !c.future && !c.noData)
  const status = !hasObservedDay ? 'UPCOMING' : !hasRealData ? 'NO DATA' : null
  return (
    <button
      type="button"
      className="mini-month"
      onClick={interactive ? () => onSelect?.(year, month) : undefined}
      disabled={!interactive}
      aria-label={`${monthLabel(year, month)} — ${status ? status.toLowerCase() : 'open in calendar'}`}
    >
      <span className="mini-month-head">
        <span className="mini-month-name">{new Date(year, month, 1).toLocaleDateString('en-US', { month: 'short' })}</span>
        {status && <span className="mini-month-state">{status}</span>}
      </span>
      <span className="mini-month-grid">
        {/* leading blanks so the 1st lands on its weekday (Sun-first) */}
        {Array.from({ length: firstWeekday }).map((_, i) => <i key={`b${i}`} className="mini-month-blank" />)}
        {cells.map((c) => (
          <i
            key={c.date}
            title={`${c.date} — ${c.future ? 'future' : c.noData ? 'NO DATA' : c.pct == null ? 'NO DATA' : `${c.pct}%`}`}
            className={`hm-cell ${c.future ? 'future' : c.noData ? 'no-data' : levelClass(c.pct)}`}
          />
        ))}
      </span>
    </button>
  )
}

function levelClass(pct) {
  if (pct == null) return 'no-data'
  if (pct >= 90) return 'l4'
  if (pct >= 60) return 'l3'
  if (pct >= 30) return 'l2'
  if (pct > 0) return 'l1'
  return 'zero'
}
