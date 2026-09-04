import { monthLabel } from '../../lib/dates.js'

/**
 * Compact month heatmap for the yearly overview.
 * cells: [{date, day, pct(0..100|null), future}] from stats.monthLevels.
 */
export default function MiniMonth({ year, month, cells, onSelect, interactive = true }) {
  const firstWeekday = new Date(year, month, 1).getDay()
  return (
    <button
      type="button"
      className="mini-month"
      onClick={interactive ? () => onSelect?.(year, month) : undefined}
      disabled={!interactive}
      aria-label={`${monthLabel(year, month)} — open in calendar`}
      style={{
        display: 'flex', flexDirection: 'column', gap: 6,
        padding: '9px 8px 8px', borderRadius: 14,
        background: 'var(--surface-2)', border: '1px solid var(--border)',
        cursor: interactive ? 'pointer' : 'default',
        textAlign: 'left',
      }}
    >
      <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--text-2)' }}>
        {new Date(year, month, 1).toLocaleDateString('en-US', { month: 'short' })}
      </span>
      <span style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 2 }}>
        {/* leading blanks so the 1st lands on its weekday (Sun-first) */}
        {Array.from({ length: firstWeekday }).map((_, i) => <i key={`b${i}`} style={{ aspectRatio: '1' }} />)}
        {cells.map((c) => (
          <i
            key={c.date}
            title={`${c.date}${c.pct != null ? ` — ${c.pct}%` : ''}`}
            className={`hm-cell ${c.future ? 'empty' : levelClass(c.pct)}`}
            style={{ borderRadius: 2.5 }}
          />
        ))}
      </span>
    </button>
  )
}

function levelClass(pct) {
  if (pct == null) return ''
  if (pct >= 90) return 'l4'
  if (pct >= 60) return 'l3'
  if (pct >= 30) return 'l2'
  if (pct > 0) return 'l1'
  return ''
}
