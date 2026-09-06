/* ============================================================
   CHART KIT — tiny, dependency-free SVG/HTML charts.
   Replaces recharts. Every chart scales to its container (no
   fixed widths), never overflows at 320px, and exposes text
   labels for screen readers.
   ============================================================ */
import { Fragment, useId, useMemo, useRef, useState } from 'react'
import { shortDate } from '../../lib/dates.js'

const TNUM = { fontVariantNumeric: 'tabular-nums' }

/* ---------------- Trend (line + area) ---------------- */

/**
 * TrendChart — a completion trend over time.
 * data: [{ date, pct (0..100 | null) }] oldest → newest.
 */
export function TrendChart({ data, className = '' }) {
  const gid = useId().replace(/:/g, '')
  const [sel, setSel] = useState(null) // index of tapped/hovered point

  const W = 640
  const H = 220
  const L = 40
  const R = 12
  const T = 14
  const B = 24

  const { points, line, area, labels } = useMemo(() => {
    const n = data.length
    const x = (i) => (n <= 1 ? (L + W - R) / 2 : L + (i / (n - 1)) * (W - L - R))
    const y = (v) => T + (1 - v / 100) * (H - T - B)
    const pts = data.map((d, i) => ({ ...d, i, x: x(i), y: d.pct == null ? null : y(d.pct) }))
    const solid = pts.filter((p) => p.y != null)
    let linePath = ''
    solid.forEach((p, i) => { linePath += (i === 0 ? 'M' : 'L') + p.x.toFixed(1) + ' ' + p.y.toFixed(1) })
    let areaPath = linePath
    if (solid.length) {
      areaPath += ` L${solid[solid.length - 1].x.toFixed(1)} ${H - B} L${solid[0].x.toFixed(1)} ${H - B} Z`
    }
    // a few evenly-spaced x labels
    const idxs = n <= 4 ? data.map((_, i) => i) : [0, Math.round((n - 1) / 3), Math.round(((n - 1) * 2) / 3), n - 1]
    const seen = new Set()
    const labs = idxs.filter((i) => i >= 0 && i < n && !seen.has(i) && seen.add(i)).map((i) => ({ i, x: x(i), label: data[i].date }))
    return { points: pts, line: linePath, area: areaPath, labels: labs }
  }, [data])

  const gridYs = [0, 25, 50, 75, 100].map((v) => ({ v, y: T + (1 - v / 100) * (H - T - B) }))

  const selP = sel != null ? points[sel] : null

  return (
    <div className={`trend-chart ${className}`.trim()}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        role="img"
        aria-label={`Completion trend. ${data.map((d) => `${shortDate(d.date)} ${d.pct == null ? 'no data' : d.pct + '%'}`).join(', ')}`}
        onMouseLeave={() => setSel(null)}
      >
        <defs>
          <linearGradient id={`t${gid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent-2)" stopOpacity="0.38" />
            <stop offset="100%" stopColor="var(--accent-2)" stopOpacity="0.02" />
          </linearGradient>
          <linearGradient id={`tline${gid}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--accent-1)" />
            <stop offset="52%" stopColor="var(--accent-2)" />
            <stop offset="100%" stopColor="var(--c5, var(--accent-1))" />
          </linearGradient>
        </defs>
        {/* grid + y labels */}
        {gridYs.map((g) => (
          <g key={g.v}>
            <line x1={L} y1={g.y} x2={W - R} y2={g.y} stroke="var(--grid)" strokeWidth="1" strokeDasharray="2 6" />
            <text x={L - 8} y={g.y + 3} textAnchor="end" fontSize="10" fontWeight="500" fill="var(--text-3)" style={TNUM}>{g.v}</text>
          </g>
        ))}
        {/* x labels */}
        {labels.map((lab) => (
          <text key={lab.i} x={lab.x} y={H - 7} textAnchor="middle" fontSize="10" fontWeight="500" fill="var(--text-3)">{shortDate(lab.label)}</text>
        ))}
        {/* area + line (a soft glow underlay gives the trend presence) */}
        {area && <path d={area} fill={`url(#t${gid})`} />}
        {line && <path d={line} fill="none" stroke="var(--accent-2)" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" opacity="0.12" />}
        {line && <path d={line} fill="none" stroke={`url(#tline${gid})`} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />}
        {/* interactive points */}
        {points.map((p) => (
          <g key={p.i}>
            <circle
              cx={p.x}
              cy={p.y ?? (H - B)}
              r={p.y == null ? 0 : 12}
              fill="transparent"
              onPointerEnter={() => setSel(p.i)}
              onClick={() => setSel(sel === p.i ? null : p.i)}
            />
            {p.y != null && <circle cx={p.x} cy={p.y} r={sel === p.i ? 4.5 : 2.5} fill={sel === p.i ? 'var(--accent-2)' : 'var(--accent-1)'} stroke="var(--surface-solid)" strokeWidth="1.5" />}
          </g>
        ))}
        {selP && selP.y != null && (
          <g pointerEvents="none">
            <line x1={selP.x} y1={T} x2={selP.x} y2={H - B} stroke="var(--border-2)" strokeWidth="1" strokeDasharray="3 3" />
            <g transform={`translate(${Math.min(Math.max(selP.x, L + 34), W - R - 66)}, ${Math.max(T, selP.y - 40)})`}>
              <rect width="116" height="28" rx="9" fill="var(--surface-solid)" stroke="var(--border-2)" />
              <circle cx="13" cy="14" r="4" fill="var(--accent-2)" />
              <text x="25" y="18" fontSize="11" fontWeight="700" fill="var(--text)">{shortDate(selP.date)}</text>
              <text x="108" y="18" fontSize="11" fontWeight="700" fill="var(--accent-2)" textAnchor="end">{selP.pct}%</text>
            </g>
          </g>
        )}
      </svg>
    </div>
  )
}

/* ---------------- Weekly bars ---------------- */

export function WeekBars({ data, highlightLast = true }) {
  const gid = useId().replace(/:/g, '')
  const W = 640
  const H = 180
  const B = 22
  const T = 12
  const n = data.length
  const slot = (W - 24) / n
  const bw = Math.min(26, slot * 0.62)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img"
      aria-label={data.map((d) => `${d.label}: ${d.pct == null ? 'no data' : d.pct + '%'}`).join(', ')}>
      <defs>
        <linearGradient id={`w${gid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent-2)" />
          <stop offset="100%" stopColor="var(--accent-1)" />
        </linearGradient>
      </defs>
      <line x1="12" y1={H - B} x2={W - 12} y2={H - B} stroke="var(--border)" />
      {data.map((d, i) => {
        const x = 12 + slot * i + (slot - bw) / 2
        const h = d.pct == null ? 0 : (d.pct / 100) * (H - B - T - 6)
        const y = H - B - h
        const last = highlightLast && i === n - 1
        return (
          <g key={i}>
            {d.pct != null && (
              <rect x={x} y={y} width={bw} height={h} rx={4}
                fill={last ? `url(#w${gid})` : 'var(--accent-1)'} opacity={last ? 1 : 0.75} />
            )}
            {d.pct == null && <rect x={x} y={H - B - 3} width={bw} height={3} rx={1.5} fill="var(--track)" />}
            <text x={x + bw / 2} y={H - 6} textAnchor="middle" fontSize="10" fill="var(--text-3)">{d.label}</text>
            <title>{`${d.label}: ${d.pct == null ? 'no data' : d.pct + '%'}`}</title>
          </g>
        )
      })}
    </svg>
  )
}

/* ---------------- GitHub-style heatmap (tap tooltips) ---------------- */

const WD_LABELS = ['', 'Mon', '', 'Wed', '', 'Fri', '']

export function Heatmap({ weeks, onDayTap, ariaLabel = 'Completion heatmap' }) {
  const [tip, setTip] = useState(null) // { date, pct, x, y }
  const innerRef = useRef(null)

  const months = useMemo(() => {
    const out = []
    let prev = null
    weeks.forEach((col, colIdx) => {
      col.forEach((cell) => {
        const m = cell.date.slice(0, 7)
        if (m !== prev) {
          out.push({ key: m, col: colIdx, label: shortDate(cell.date).replace(/\d+/, '').trim() })
          prev = m
        }
      })
    })
    return out
  }, [weeks])

  const tap = (date, pct, rect) => {
    if (tip && tip.date === date) {
      setTip(null)
      return
    }
    const wrap = innerRef.current?.getBoundingClientRect()
    const x = rect.left - (wrap?.left || 0) + rect.width / 2
    const y = rect.top - (wrap?.top || 0)
    setTip({ date, pct, x, y })
    onDayTap?.({ date, pct })
  }

  const onGridClick = (e) => {
    const cellEl = e.target.closest('.hm-day')
    if (!cellEl) return
    const date = cellEl.dataset.date
    if (cellEl.classList.contains('future')) return
    const pct = cellEl.dataset.pct === '' ? null : Number(cellEl.dataset.pct)
    tap(date, pct, cellEl.getBoundingClientRect())
  }

  return (
    <div className="heatmap" role="img" aria-label={ariaLabel}>
      <div className="heatmap-inner" ref={innerRef} onClick={onGridClick}>
        {/* weekday gutter */}
        <div className="hm-gutter" aria-hidden="true">
          {WD_LABELS.map((l, i) => <span key={i}>{l}</span>)}
        </div>
        <div className="hm-scroll">
          <div className="hm-months" aria-hidden="true" style={{ gridTemplateColumns: `repeat(${weeks.length}, 11px)` }}>
            {months.map((m) => <span key={m.key} style={{ gridColumnStart: m.col + 1 }}>{m.label}</span>)}
          </div>
          <div className="hm-grid">
            {weeks.map((col, ci) => (
              <div key={ci} className="hm-col">
                {col.map((cell) => (
                  <span
                    key={cell.date}
                    className={`hm-day l${cell.level}${cell.future ? ' future' : ''}${tip?.date === cell.date ? ' sel' : ''}`}
                    data-date={cell.date}
                    data-pct={cell.pct == null ? '' : cell.pct}
                    title={`${cell.date}${cell.pct != null ? ` — ${cell.pct}% complete` : ' — no data'}`}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
        {/* tooltip */}
        {tip && (
          <div
            className="heatmap-tip"
            style={{ left: Math.max(0, Math.min(tip.x - 55, (innerRef.current?.clientWidth || 320) - 120)), top: Math.max(0, tip.y - 46) }}
            role="status"
          >
            <span className="heatmap-tip-date">{tip.date}</span>
            <span className="heatmap-tip-val">{tip.pct == null ? 'No data' : `${tip.pct}% done`}</span>
          </div>
        )}
      </div>
      <div className="hm-legend" aria-hidden="true">
        <span>Less</span>
        {[0, 1, 2, 3, 4].map((l) => <i key={l} className={`hm-day l${l}`} />)}
        <span>More</span>
      </div>
    </div>
  )
}

/* ---------------- Habit × day matrix (sticky names) ---------------- */

export function HabitMatrix({ rows, days, weekLabels }) {
  return (
    <div className="habit-matrix" role="img" aria-label="Habit by day matrix">
      <div className="hmx-scroll">
        <div className="hmx-grid" style={{ gridTemplateColumns: `132px repeat(${days.length}, 22px)` }}>
          <div className="hmx-corner" />
          {weekLabels.map((w, i) => (
            <div key={i} className="hmx-weekband" style={{ gridColumn: `span ${w.span}` }}>{w.label}</div>
          ))}
          {rows.map((row) => (
            <Fragment key={row.habit.id}>
              <div className="hmx-name" title={row.habit.name}>
                <span className="hmx-name-text">{row.habit.name}</span>
              </div>
              {row.cells.map((c) => (
                <span
                  key={c.date}
                  className={`hmx-cell ${c.done ? 'done' : ''} ${c.scheduled ? 'sched' : ''} ${c.future ? 'future' : ''}`}
                  title={`${row.habit.name} · ${c.date}${c.done ? ' · done' : c.scheduled ? ' · not done' : ' · not scheduled'}`}
                  aria-hidden="true"
                />
              ))}
            </Fragment>
          ))}
        </div>
      </div>
    </div>
  )
}
