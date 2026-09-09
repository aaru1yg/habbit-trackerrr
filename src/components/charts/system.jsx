/* ============================================================
   CHART SYSTEM — shared shell, legend, hooks, summaries (V5).

   Every visualization answers one question and shares: axis rules,
   legend with focus (never delete), tooltip, deterministic colors,
   typography, responsive SVG, empty/insufficient states, and a text
   summary for assistive tech. Series identity (hue + dash + shape)
   comes from chartPalette.js — never hue alone.
   ============================================================ */
import { useMemo, useState } from 'react'
import SectionCard, { CardHead } from '../ui/SectionCard.jsx'
import { InlineEmpty } from '../ui/feedback.jsx'
import { assignSeriesColors } from '../../lib/chartPalette.js'

/* ---------------- hook: series styles + focus ---------------- */

/**
 * series: [{ id, label, accent? }]
 * Returns deterministic styles + a focus toggle. Focusing a series
 * emphasizes it and de-emphasizes the rest; data is never removed.
 */
export function useChartSeries(series) {
  const wants = (series || []).map((s) => s.accent || null)
  const key = wants.join('|')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const styles = useMemo(() => assignSeriesColors(wants), [key])
  const [focusId, setFocusId] = useState(null)
  const toggleFocus = (id) => setFocusId((f) => (f === id ? null : id))
  return { styles, focusId, toggleFocus, clearFocus: () => setFocusId(null) }
}

/* ---------------- legend ---------------- */

function Swatch({ color, dash, shape }) {
  return (
    <svg width="26" height="12" viewBox="0 0 26 12" aria-hidden="true" focusable="false">
      <line x1="1" y1="6" x2="25" y2="6" stroke={color} strokeWidth="2.5"
        strokeLinecap="round" strokeDasharray={dash || undefined} />
      {shape === 'circle' && <circle cx="13" cy="6" r="3" fill={color} />}
      {shape === 'square' && <rect x="10" y="3" width="6" height="6" fill={color} />}
      {shape === 'triangle' && <path d="M13 2.5 L16.5 9.5 L9.5 9.5 Z" fill={color} />}
      {shape === 'diamond' && <path d="M13 2.5 L16.5 6 L13 9.5 L9.5 6 Z" fill={color} />}
    </svg>
  )
}

/**
 * ChartLegend — series toggle. Activating a series focuses it (others
 * dim); activating again (or "Show all") restores everything.
 */
export function ChartLegend({ series, styles, focusId, onToggle, label = 'Chart series' }) {
  if (!series?.length) return null
  return (
    <div className="vlegend" role="group" aria-label={label}>
      {series.map((s, i) => {
        const st = styles[i] || {}
        const active = focusId === s.id
        return (
          <button
            key={s.id}
            type="button"
            className={`vlegend-item${active ? ' active' : ''}${focusId && !active ? ' dim' : ''}`}
            aria-pressed={active}
            aria-label={`${active ? 'Show all series' : `Focus ${s.label}`}`}
            onClick={() => onToggle(s.id)}
          >
            <Swatch color={st.color || 'var(--text-3)'} dash={st.dash} shape={st.shape} />
            <span className="vlegend-label">{s.label}</span>
          </button>
        )
      })}
      {focusId && (
        <button type="button" className="vlegend-reset" onClick={() => onToggle(focusId)}>
          Show all
        </button>
      )}
    </div>
  )
}

/* ---------------- text summaries (AT + honest captions) ---------------- */

/** "Study: avg 72%, range 40–100 over 12 days with data" per series. */
export function summarizeSeries(series, unit = '%') {
  if (!series?.length) return 'No data yet.'
  const parts = []
  for (const s of series) {
    const vals = (s.points || []).map((p) => p.value).filter((v) => v != null)
    if (!vals.length) {
      parts.push(`${s.label}: no data yet`)
      continue
    }
    const avg = Math.round(vals.reduce((n, v) => n + v, 0) / vals.length)
    const lo = Math.min(...vals)
    const hi = Math.max(...vals)
    parts.push(
      vals.length === 1
        ? `${s.label}: ${vals[0]}${unit}`
        : `${s.label}: average ${avg}${unit}, ranging ${lo} to ${hi}${unit} over ${vals.length} points with data`
    )
  }
  return parts.join('. ')
}

/* ---------------- ChartCard shell ---------------- */

export function ChartCard({
  title, sub = null, actions = null, legend = null,
  summary = null, enough = true,
  emptyTitle = 'Not enough data yet.', emptyHint = null, emptyAction = null,
  className = '', children,
}) {
  return (
    <SectionCard className={`pad vchart-card ${className}`.trim()}>
      <CardHead title={title}>
        {actions}
      </CardHead>
      {sub && <p className="vchart-sub">{sub}</p>}
      {legend}
      {!enough ? (
        <InlineEmpty title={emptyTitle} action={emptyAction}>{emptyHint}</InlineEmpty>
      ) : (
        <>
          {children}
          {summary && <p className="sr-only">{summary}</p>}
        </>
      )}
    </SectionCard>
  )
}
