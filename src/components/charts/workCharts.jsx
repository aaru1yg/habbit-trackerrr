/* ============================================================
   WORK CHARTS — the visualization kit for projects, assignments
   and workload. Same design language as the habit chart kit:
   responsive SVG (viewBox + width:100%), no chart junk, real
   labels, tap/hover tooltips, readable at 320px.
   ============================================================ */
import { useId, useMemo, useState } from 'react'
import { shortDate, weekdayShort } from '../../lib/dates.js'

const TNUM = { fontVariantNumeric: 'tabular-nums' }
const uid = () => useId().replace(/:/g, '')

/* ------------------------------------------------------------
   LineSeries — 1..n lines over dates. Values 0..100 (or auto).
   ------------------------------------------------------------ */
export function LineSeries({ series, height = 200, unit = '%', domain = [0, 100], ariaLabel, showPoints = true, xCount = 4 }) {
  const gid = uid()
  const [sel, setSel] = useState(null)
  const W = 640
  const H = height
  const L = 38
  const R = 12
  const T = 12
  const B = 24

  const dates = series[0]?.points.map((p) => p.date) || []
  const n = dates.length

  const geom = useMemo(() => {
    const x = (i) => (n <= 1 ? (L + W - R) / 2 : L + (i / (n - 1)) * (W - L - R))
    const y = (v) => T + (1 - (v - domain[0]) / (domain[1] - domain[0])) * (H - T - B)
    return {
      x, y,
      lines: series.map((s) => {
        const pts = s.points.map((p, i) => ({ ...p, i, x: x(i), y: p.value == null ? null : y(p.value) }))
        const solid = pts.filter((p) => p.y != null)
        let d = ''
        solid.forEach((p, k) => { d += (k === 0 ? 'M' : 'L') + p.x.toFixed(1) + ' ' + p.y.toFixed(1) })
        return { ...s, pts, d, solid }
      }),
    }
  }, [series, n, domain, H])

  const ticks = [domain[0], Math.round((domain[0] + domain[1]) / 2), domain[1]]
  const xIdx = n <= 4 ? dates.map((_, i) => i)
    : Array.from({ length: xCount }, (_, k) => Math.round((k * (n - 1)) / (xCount - 1)))
  const label = ariaLabel || series.map((s) => `${s.label}: ${s.points.map((p) => `${shortDate(p.date)} ${p.value == null ? 'no data' : p.value + unit}`).join(', ')}`).join(' | ')

  const selPoint = sel != null ? dates[sel] : null

  return (
    <div className="trend-chart">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={label} onMouseLeave={() => setSel(null)}>
        {ticks.map((v) => (
          <g key={v}>
            <line x1={L} y1={geom.y(v)} x2={W - R} y2={geom.y(v)} stroke="var(--border)" strokeWidth="1" />
            <text x={L - 6} y={geom.y(v) + 3} textAnchor="end" fontSize="10" fill="var(--text-3)" style={TNUM}>{v}</text>
          </g>
        ))}
        {xIdx.filter((i) => dates[i]).map((i) => (
          <text key={i} x={geom.x(i)} y={H - 6} textAnchor="middle" fontSize="10" fill="var(--text-3)">{shortDate(dates[i])}</text>
        ))}
        {selPoint && (
          <line x1={geom.x(sel)} y1={T} x2={geom.x(sel)} y2={H - B} stroke="var(--border-2)" strokeWidth="1" strokeDasharray="3 3" />
        )}
        {geom.lines.map((s) => (
          <g key={s.id || s.label}>
            {s.d && (
              <path d={s.d} fill="none" stroke={s.color || 'var(--accent-2)'} strokeWidth={s.width || 2}
                strokeLinejoin="round" strokeLinecap="round" strokeDasharray={s.dash || undefined} opacity={s.opacity ?? 1} />
            )}
            {showPoints && s.solid.map((p) => (
              <circle key={p.i} cx={p.x} cy={p.y} r={sel === p.i ? 4 : 2.2}
                fill={sel === p.i ? (s.color || 'var(--accent-2)') : 'var(--surface-solid)'}
                stroke={s.color || 'var(--accent-2)'} strokeWidth="1.6" />
            ))}
          </g>
        ))}
        {/* hit areas */}
        {dates.map((d, i) => (
          <rect key={d} x={geom.x(i) - (W - L - R) / Math.max(1, n) / 2} y={T} width={(W - L - R) / Math.max(1, n)} height={H - T - B}
            fill="transparent" onPointerEnter={() => setSel(i)} onClick={() => setSel(sel === i ? null : i)} />
        ))}
        {selPoint && (
          <g pointerEvents="none" transform={`translate(${Math.min(Math.max(geom.x(sel), L + 8), W - R - 150)}, ${T + 2})`}>
            <rect width="150" height={16 + series.length * 14} rx="9" fill="var(--surface-solid)" stroke="var(--border-2)" />
            <text x="9" y="14" fontSize="10.5" fontWeight="700" fill="var(--text)">{shortDate(selPoint)}</text>
            {series.map((s, k) => {
              const v = s.points[sel]?.value
              return (
                <text key={s.id || s.label} x="9" y={28 + k * 14} fontSize="10.5" fill="var(--text-2)" style={TNUM}>
                  {s.label}: {v == null ? '—' : `${v}${unit}`}
                </text>
              )
            })}
          </g>
        )}
      </svg>
    </div>
  )
}

/* ------------------------------------------------------------
   BurndownChart — ideal pace vs real remaining work.
   rows: [{ date, ideal, actual (null = future), future }]
   ------------------------------------------------------------ */
export function BurndownChart({ rows, today }) {
  const gid = uid()
  const W = 640
  const H = 210
  const L = 38
  const R = 12
  const T = 12
  const B = 24
  const n = rows.length

  const x = (i) => (n <= 1 ? (L + W - R) / 2 : L + (i / (n - 1)) * (W - L - R))
  const y = (v) => T + (1 - v / 100) * (H - T - B)

  const idealPath = rows.map((r, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)} ${y(r.ideal).toFixed(1)}`).join(' ')
  const actualPts = rows.filter((r) => r.actual != null)
  const actualPath = actualPts.map((r, i) => `${i === 0 ? 'M' : 'L'}${x(rows.indexOf(r)).toFixed(1)} ${y(r.actual).toFixed(1)}`).join(' ')
  const todayIdx = rows.findIndex((r) => r.date === today)
  const xIdx = n <= 4 ? rows.map((_, i) => i) : [0, Math.round((n - 1) / 2), n - 1]

  return (
    <div className="trend-chart">
      <div className="burndown-legend" aria-hidden="true">
        <span><i style={{ background: 'var(--text-3)' }} /> Ideal pace</span>
        <span><i style={{ background: 'var(--accent-2)' }} /> Remaining work</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img"
        aria-label={`Deadline burndown. ${rows.map((r) => `${shortDate(r.date)}: ideal ${r.ideal}% remaining${r.actual == null ? '' : `, actual ${r.actual}% remaining`}`).join('. ')}`}>
        <defs>
          <linearGradient id={`bd${gid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent-2)" stopOpacity="0.26" />
            <stop offset="100%" stopColor="var(--accent-2)" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {[0, 50, 100].map((v) => (
          <g key={v}>
            <line x1={L} y1={y(v)} x2={W - R} y2={y(v)} stroke="var(--border)" />
            <text x={L - 6} y={y(v) + 3} textAnchor="end" fontSize="10" fill="var(--text-3)" style={TNUM}>{v}</text>
          </g>
        ))}
        {xIdx.map((i) => rows[i] && (
          <text key={i} x={x(i)} y={H - 6} textAnchor="middle" fontSize="10" fill="var(--text-3)">{shortDate(rows[i].date)}</text>
        ))}
        {actualPts.length > 1 && (
          <path d={`${actualPath} L${x(rows.indexOf(actualPts[actualPts.length - 1])).toFixed(1)} ${y(0)} L${x(rows.indexOf(actualPts[0])).toFixed(1)} ${y(0)} Z`}
            fill={`url(#bd${gid})`} />
        )}
        <path d={idealPath} fill="none" stroke="var(--text-3)" strokeWidth="1.6" strokeDasharray="5 4" opacity="0.85" />
        {actualPath && <path d={actualPath} fill="none" stroke="var(--accent-2)" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />}
        {todayIdx >= 0 && (
          <g>
            <line x1={x(todayIdx)} y1={T} x2={x(todayIdx)} y2={H - B} stroke="var(--accent-1)" strokeWidth="1.2" opacity="0.7" />
            <text x={x(todayIdx) + 4} y={T + 9} fontSize="9.5" fill="var(--accent-1)" fontWeight="700">today</text>
          </g>
        )}
        {actualPts.map((r) => (
          <circle key={r.date} cx={x(rows.indexOf(r))} cy={y(r.actual)} r="2.4" fill="var(--surface-solid)" stroke="var(--accent-2)" strokeWidth="1.6">
            <title>{`${shortDate(r.date)} — ${r.actual}% remaining (ideal ${r.ideal}%)`}</title>
          </circle>
        ))}
      </svg>
    </div>
  )
}

/* ------------------------------------------------------------
   LoadBars — workload per day (horizontal, label + bar + count)
   ------------------------------------------------------------ */
export function LoadBars({ rows, onSelect, today }) {
  const max = Math.max(1, ...rows.map((r) => r.count))
  return (
    <div className="load-bars"
      aria-label={`Workload by day. ${rows.map((r) => `${r.label}: ${r.count} item${r.count === 1 ? '' : 's'}`).join(', ')}`}>
      {rows.map((r) => {
        const level = r.count === 0 ? 0 : r.count >= max * 0.85 && r.count >= 3 ? 3 : r.count >= max * 0.5 && r.count >= 2 ? 2 : 1
        const label = `${r.label}: ${r.count} item${r.count === 1 ? '' : 's'} due${onSelect ? ' — open' : ''}`
        // The whole row is the control: a full-width 44px target instead of a
        // 17px number tucked in the corner.
        const Row = onSelect ? 'button' : 'div'
        return (
          <Row
            className={`lb-row${r.date === today ? ' is-today' : ''}`}
            key={r.date}
            {...(onSelect ? { type: 'button', onClick: () => onSelect(r), 'aria-label': label } : {})}
          >
            <span className="lb-day">{weekdayShort(r.date).slice(0, 3)} {r.date.slice(8)}</span>
            <span className="lb-track">
              <i className="lb-fill" data-level={level} style={{ width: `${(r.count / max) * 100}%` }} />
            </span>
            <span className="lb-n" aria-hidden={onSelect ? 'true' : undefined}>{r.count || '—'}</span>
          </Row>
        )
      })}
    </div>
  )
}

/* ------------------------------------------------------------
   LoadColumns — compact vertical workload (fits narrow cards)
   ------------------------------------------------------------ */
export function LoadColumns({ rows, today }) {
  const max = Math.max(1, ...rows.map((r) => r.count))
  return (
    <div className="load-columns" role="img"
      aria-label={`Workload by day. ${rows.map((r) => `${r.label}: ${r.count}`).join(', ')}`}>
      {rows.map((r) => (
        <div key={r.date}>
          <span className="lc-track">
            <i className="lc-fill" style={{ height: `${r.count ? Math.max(6, (r.count / max) * 100) : 0}%`, opacity: r.date === today ? 1 : 0.72 }} />
          </span>
          <span className="lc-label" style={r.date === today ? { color: 'var(--accent-2)' } : undefined}>
            {weekdayShort(r.date).slice(0, 1)}
          </span>
          <span className="lc-label" style={{ fontSize: '0.5625rem' }}>{r.count || ''}</span>
        </div>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------
   HBarList — ranked horizontal bars (weekday performance, habit
   ranking, project comparison). High data-to-ink, no gridlines.
   ------------------------------------------------------------ */
export function HBarList({ rows, max = 100, unit = '%', onSelect, emptyText = 'Not enough data yet.' }) {
  if (!rows.length) return <p className="empty-note">{emptyText}</p>
  return (
    <div className="dist" role={onSelect ? undefined : 'img'}
      aria-label={onSelect ? undefined : rows.map((r) => `${r.label}: ${r.value == null ? 'no data' : Math.round(r.value) + unit}`).join(', ')}>
      {rows.map((r, i) => {
        const pct = r.value == null ? 0 : Math.max(0, Math.min(100, (r.value / max) * 100))
        const Tag = onSelect ? 'button' : 'div'
        return (
          <Tag
            key={r.key || r.label || i}
            className="dist-row"
            style={onSelect ? { background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0, width: '100%' } : undefined}
            onClick={onSelect ? () => onSelect(r) : undefined}
            aria-label={onSelect ? `${r.label}: ${r.value == null ? 'no data' : Math.round(r.value) + unit}` : undefined}
          >
            <span className="dist-label">{r.label}</span>
            <span className="meter thin" data-tone={r.tone || undefined}>
              <i style={{ width: `${pct}%`, background: r.color || undefined }} />
            </span>
            <span className="dist-value">
              {r.value == null ? '—' : `${Math.round(r.value)}${unit}`}
              {r.sub ? <span className="muted"> {r.sub}</span> : null}
            </span>
          </Tag>
        )
      })}
    </div>
  )
}

/* ------------------------------------------------------------
   BucketColumns — completion distribution / counts per bucket
   ------------------------------------------------------------ */
export function BucketColumns({ rows, height = 110, unit = '' }) {
  const max = Math.max(1, ...rows.map((r) => r.value))
  return (
    <div className="load-columns" style={{ height }} role="img"
      aria-label={rows.map((r) => `${r.label}: ${r.value}${unit}`).join(', ')}>
      {rows.map((r) => (
        <div key={r.label}>
          <span className="lc-track">
            <i className="lc-fill" style={{ height: `${r.value ? Math.max(5, (r.value / max) * 100) : 0}%`, background: r.color || undefined }} />
          </span>
          <span className="lc-label" style={{ color: 'var(--text-2)', fontWeight: 700 }}>{r.value}{unit}</span>
          <span className="lc-label" style={{ fontSize: '0.5625rem', textAlign: 'center', lineHeight: 1.15 }}>{r.label}</span>
        </div>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------
   TimeVsWorkBars — % time elapsed vs % work completed (§69F)
   ------------------------------------------------------------ */
export function TimeVsWorkBars({ elapsedPct, workPct, behind, ahead }) {
  const elapsed = Math.max(0, Math.min(100, Math.round(elapsedPct ?? 0)))
  const work = Math.max(0, Math.min(100, Math.round(workPct ?? 0)))
  const delta = Math.abs(elapsed - work)
  const tone = behind ? 'bad' : ahead ? 'good' : 'neutral'
  return (
    <div className="time-vs-work" data-tone={tone} role="img" aria-label={`Time elapsed ${elapsed} percent. Work completed ${work} percent. ${behind ? 'Behind schedule' : ahead ? 'Ahead of schedule' : 'On pace'}`}>
      <div className="time-vs-work-metrics">
        <div>
          <span className="tvw-label">Time elapsed</span>
          <strong className="tvw-value" data-tone={behind ? 'bad' : undefined}>{elapsed}%</strong>
          <span className="tvw-bar"><i style={{ width: `${elapsed}%` }} /></span>
        </div>
        <div>
          <span className="tvw-label">Work complete</span>
          <strong className="tvw-value" data-tone={ahead ? 'good' : behind ? 'bad' : undefined}>{work}%</strong>
          <span className="tvw-bar"><i style={{ width: `${work}%`, background: behind ? 'var(--bad)' : 'var(--good)' }} /></span>
        </div>
      </div>
      <p className="tvw-callout" data-tone={tone}>
        {behind ? `→ BEHIND SCHEDULE · ${delta} points to catch up` : ahead ? `→ AHEAD OF SCHEDULE · ${delta} points ahead` : '→ ON PACE'}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------
   Sparkline — tiny trend for cards and rails
   ------------------------------------------------------------ */
export function Sparkline({ values, width = 96, height = 26, color = 'var(--accent-2)' }) {
  const pts = values.filter((v) => v != null)
  if (pts.length < 2) return <span className="tiny muted">—</span>
  const max = Math.max(...pts, 1)
  const min = Math.min(...pts, 0)
  const span = max - min || 1
  const d = values.map((v, i) => {
    if (v == null) return null
    const x = (i / (values.length - 1)) * width
    const y = height - ((v - min) / span) * (height - 3) - 1.5
    return `${x.toFixed(1)} ${y.toFixed(1)}`
  }).filter(Boolean)
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true" style={{ flex: 'none' }}>
      <polyline points={d.join(' ')} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/* ------------------------------------------------------------
   CompareBars — this week vs last week / two-value comparison
   ------------------------------------------------------------ */
export function CompareBars({ a, b, unit = '%' }) {
  const max = Math.max(1, a.value || 0, b.value || 0)
  const row = (r) => (
    <div className="dist-row" key={r.label}>
      <span className="dist-label">{r.label}</span>
      <span className="meter thin"><i style={{ width: `${((r.value || 0) / max) * 100}%`, background: r.color }} /></span>
      <span className="dist-value">{r.value == null ? '—' : `${Math.round(r.value)}${unit}`}</span>
    </div>
  )
  return <div className="dist">{row(a)}{row(b)}</div>
}

/* ------------------------------------------------------------
   DonutStat — compact ring with a caption (project analytics)
   ------------------------------------------------------------ */
export function DonutStat({ pct, label, sub, size = 108, tone }) {
  const gid = uid()
  const stroke = 9
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const clamped = Math.max(0, Math.min(100, pct ?? 0))
  const color = tone === 'bad' ? 'var(--bad)' : tone === 'warn' ? 'var(--warn)' : tone === 'good' ? 'var(--good)' : null
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
      <div className="ring-wrap" style={{ width: size, height: size, position: 'relative', flex: 'none' }} role="img"
        aria-label={label ? `${label}: ${Math.round(clamped)} percent` : `${Math.round(clamped)} percent`}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
          <defs>
            <linearGradient id={`donut-${gid}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={color || 'var(--accent-1)'} />
              <stop offset="100%" stopColor={tone === 'bad' ? 'var(--bad)' : tone === 'warn' ? 'var(--warn)' : tone === 'good' ? 'var(--good)' : 'var(--accent-2)'} />
            </linearGradient>
          </defs>
          <circle className="ring-track" cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} />
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={`url(#donut-${gid})`} strokeWidth={stroke} strokeLinecap="round"
            strokeDasharray={c} strokeDashoffset={c * (1 - clamped / 100)}
            style={{ transition: 'stroke-dashoffset 700ms cubic-bezier(0.22,1,0.36,1)' }} />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: size > 100 ? '1.35rem' : '1.05rem', fontVariantNumeric: 'tabular-nums' }}>
            {pct == null ? '—' : `${Math.round(pct)}%`}
          </span>
        </div>
      </div>
      <div style={{ minWidth: 0 }}>
        {label && <p style={{ fontWeight: 700, fontSize: 'var(--fs-sm)' }}>{label}</p>}
        {sub && <p className="tiny muted" style={{ marginTop: 3 }}>{sub}</p>}
      </div>
    </div>
  )
}
