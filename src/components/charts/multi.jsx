/* ============================================================
   MULTI-SERIES CHARTS — lines, grouped bars, bullets (V5).

   Dependency-free SVG, viewBox-scaled (readable at 320px), nulls
   break lines / hollow bars (gaps render as gaps), every chart
   carries a full text equivalent. Focus dims siblings, never hides.
   Caps: 6 series per chart (skill: chart domain).
   ============================================================ */
import { useId, useMemo, useState } from 'react'
import { shortDate } from '../../lib/dates.js'
import { seriesStyle } from '../../lib/chartPalette.js'

const TNUM = { fontVariantNumeric: 'tabular-nums' }
const W = 640

function PointShape({ shape, x, y, r, fill, stroke }) {
  if (shape === 'square') return <rect x={x - r} y={y - r} width={r * 2} height={r * 2} fill={fill} stroke={stroke} strokeWidth="1.6" />
  if (shape === 'triangle') return <path d={`M${x} ${y - r - 1} L${x + r + 1} ${y + r} L${x - r - 1} ${y + r} Z`} fill={fill} stroke={stroke} strokeWidth="1.4" strokeLinejoin="round" />
  if (shape === 'diamond') return <path d={`M${x} ${y - r - 1} L${x + r + 1} ${y} L${x} ${y + r + 1} L${x - r - 1} ${y} Z`} fill={fill} stroke={stroke} strokeWidth="1.4" strokeLinejoin="round" />
  return <circle cx={x} cy={y} r={r} fill={fill} stroke={stroke} strokeWidth="1.6" />
}

/* ------------------------------------------------------------
   MultiSeriesChart — 1..6 lines over shared dates.
   series: [{ id, label, accent?, points: [{ date, value|null }] }]
   ------------------------------------------------------------ */
export function MultiSeriesChart({
  series, unit = '%', domain = [0, 100], height = 220,
  styles = null, focusId = null, showPoints = true, xCount = 4, ariaLabel,
}) {
  const [sel, setSel] = useState(null)
  const H = height
  const L = 40
  const R = 12
  const T = 12
  const B = 26

  const list = (series || []).slice(0, 6)
  const dates = list[0]?.points.map((p) => p.date) || []
  const n = dates.length
  const st = styles || list.map((_, i) => seriesStyle(i))

  const geom = useMemo(() => {
    const x = (i) => (n <= 1 ? (L + W - R) / 2 : L + (i / (n - 1)) * (W - L - R))
    const y = (v) => T + (1 - (v - domain[0]) / (domain[1] - domain[0])) * (H - T - B)
    return {
      x, y,
      lines: list.map((s) => {
        const pts = s.points.map((p, i) => ({ ...p, i, x: x(i), y: p.value == null ? null : y(p.value) }))
        const solid = pts.filter((p) => p.y != null)
        let d = ''
        solid.forEach((p, k) => { d += (k === 0 ? 'M' : 'L') + p.x.toFixed(1) + ' ' + p.y.toFixed(1) })
        return { ...s, pts, d, solid }
      }),
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(list.map((s) => [s.id, s.points.map((p) => p.value)])), n, domain.join(','), H])

  const ticks = [domain[0], Math.round((domain[0] + domain[1]) / 2), domain[1]]
  const xIdx = n <= 4 ? dates.map((_, i) => i)
    : Array.from({ length: xCount }, (_, k) => Math.round((k * (n - 1)) / (xCount - 1)))
  const label = ariaLabel || list.map((s) =>
    `${s.label}: ${s.points.map((p) => `${shortDate(p.date)} ${p.value == null ? 'no data' : p.value + unit}`).join(', ')}`
  ).join(' | ')
  const dim = (id) => (focusId && focusId !== id ? 0.22 : 1)

  return (
    <div className="vchart">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={label || 'Chart'}
        onMouseLeave={() => setSel(null)}>
        {ticks.map((v) => (
          <g key={v}>
            <line x1={L} y1={geom.y(v)} x2={W - R} y2={geom.y(v)} stroke="var(--grid)" strokeWidth="1" strokeDasharray="2 6" />
            <text x={L - 8} y={geom.y(v) + 3} textAnchor="end" fontSize="10" fontWeight="500" fill="var(--text-3)" style={TNUM}>{v}</text>
          </g>
        ))}
        {xIdx.filter((i) => dates[i]).map((i) => (
          <text key={i} x={geom.x(i)} y={H - 8} textAnchor="middle" fontSize="10" fontWeight="500" fill="var(--text-3)">{shortDate(dates[i])}</text>
        ))}
        {sel != null && (
          <line x1={geom.x(sel)} y1={T} x2={geom.x(sel)} y2={H - B} stroke="var(--border-2)" strokeWidth="1" strokeDasharray="3 3" />
        )}
        {geom.lines.map((s, k) => {
          const c = st[k]?.color || 'var(--accent-2)'
          return (
            <g key={s.id} opacity={dim(s.id)}>
              {s.d && (
                <path d={s.d} fill="none" stroke={c} strokeWidth={focusId === s.id ? 3 : 2.25}
                  strokeLinejoin="round" strokeLinecap="round" strokeDasharray={st[k]?.dash || undefined} />
              )}
              {showPoints && s.solid.map((p) => (
                <PointShape key={p.i} shape={st[k]?.shape || 'circle'} x={p.x} y={p.y}
                  r={sel === p.i ? 4.5 : 2.6}
                  fill={sel === p.i ? c : 'var(--surface-solid)'} stroke={c} />
              ))}
            </g>
          )
        })}
        {dates.map((d, i) => (
          <g key={d}>
            <title>{`${shortDate(d)}: ${list.map((s) => `${s.label} ${s.points[i]?.value == null ? 'no data' : s.points[i].value + unit}`).join(' · ')}`}</title>
            <rect x={geom.x(i) - (W - L - R) / Math.max(1, n) / 2} y={T}
              width={(W - L - R) / Math.max(1, n)} height={H - T - B}
              fill="transparent" onPointerEnter={() => setSel(i)} onClick={() => setSel(sel === i ? null : i)} />
          </g>
        ))}
        {sel != null && (
          <g pointerEvents="none" transform={`translate(${Math.min(Math.max(geom.x(sel), L + 8), W - R - 170)}, ${T + 2})`}>
            <rect width="170" height={20 + list.length * 15} rx="9" fill="var(--surface-solid)" stroke="var(--border-2)" />
            <text x="10" y="15" fontSize="10.5" fontWeight="700" fill="var(--text)">{shortDate(dates[sel])}</text>
            {list.map((s, k) => {
              const v = s.points[sel]?.value
              return (
                <g key={s.id}>
                  <circle cx="14" cy={26 + k * 15} r="3.5" fill={st[k]?.color || 'var(--text-3)'} />
                  <text x="22" y={30 + k * 15} fontSize="10.5" fill="var(--text-2)" style={TNUM}>
                    {s.label}: {v == null ? '—' : `${v}${unit}`}
                  </text>
                </g>
              )
            })}
          </g>
        )}
      </svg>
    </div>
  )
}

/* ------------------------------------------------------------
   GroupedBars — compare series across groups.
   groups: [{ label, values: { [seriesId]: number|null } }]
   series: [{ id, label }]
   ------------------------------------------------------------ */
export function GroupedBars({ groups, series, unit = '%', domain = [0, 100], height = 200, styles = null, focusId = null }) {
  const H = height
  const L = 40
  const R = 12
  const T = 12
  const B = 26
  const list = (series || []).slice(0, 6)
  const st = styles || list.map((_, i) => seriesStyle(i))
  const n = groups.length
  const slot = n ? (W - L - R) / n : 0
  const bw = Math.max(4, Math.min(22, (slot / Math.max(1, list.length)) * 0.62))
  const y = (v) => T + (1 - (v - domain[0]) / (domain[1] - domain[0])) * (H - T - B)
  const dim = (id) => (focusId && focusId !== id ? 0.22 : 1)
  const label = groups.map((g) =>
    `${g.label}: ${list.map((s) => `${s.label} ${g.values?.[s.id] == null ? 'no data' : g.values[s.id] + unit}`).join(', ')}`
  ).join(' | ')

  return (
    <div className="vchart">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={label || 'Chart'}>
        {[domain[0], Math.round((domain[0] + domain[1]) / 2), domain[1]].map((v) => (
          <g key={v}>
            <line x1={L} y1={y(v)} x2={W - R} y2={y(v)} stroke="var(--grid)" strokeWidth="1" strokeDasharray="2 6" />
            <text x={L - 8} y={y(v) + 3} textAnchor="end" fontSize="10" fontWeight="500" fill="var(--text-3)" style={TNUM}>{v}</text>
          </g>
        ))}
        {groups.map((g, gi) => {
          const gx = L + slot * gi
          const inner = list.length * bw + (list.length - 1) * 4
          const x0 = gx + (slot - inner) / 2
          return (
            <g key={`${g.label}-${gi}`}>
              {list.map((s, si) => {
                const v = g.values?.[s.id]
                const x = x0 + si * (bw + 4)
                if (v == null) {
                  return <rect key={s.id} x={x} y={H - B - 3} width={bw} height={3} rx={1.5} fill="var(--track)" opacity={dim(s.id)} />
                }
                const h = Math.max(2, ((v - domain[0]) / (domain[1] - domain[0])) * (H - T - B))
                return (
                  <g key={s.id} opacity={dim(s.id)}>
                    <title>{`${g.label} · ${s.label}: ${v}${unit}`}</title>
                    <rect x={x} y={H - B - h} width={bw} height={h} rx={3} fill={st[si]?.color || 'var(--accent-1)'} />
                  </g>
                )
              })}
              <text x={gx + slot / 2} y={H - 8} textAnchor="middle" fontSize="10" fontWeight="500" fill="var(--text-3)">{g.label}</text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

/* ------------------------------------------------------------
   BulletRow — compact KPI: value vs target on qualitative bands.
   ranges: [lo, hi] splits the 0..max scale into bad/ok/good thirds.
   ------------------------------------------------------------ */
export function BulletRow({ label, value, target = null, max = 100, unit = '%', ranges = null }) {
  const gid = useId().replace(/:/g, '')
  const bands = ranges || [max * 0.5, max * 0.8]
  const pct = (v) => Math.max(0, Math.min(100, (v / max) * 100))
  const summary = `${label}: ${value}${unit}${target != null ? `, target ${target}${unit}` : ''}`
  return (
    <div className="vbullet" role="img" aria-label={summary}>
      <div className="vbullet-head">
        <span className="vbullet-label">{label}</span>
        <span className="vbullet-value tnum">{value}{unit}</span>
      </div>
      <svg viewBox="0 0 100 14" width="100%" height="14" aria-hidden="true" focusable="false" preserveAspectRatio="none">
        <rect x="0" y="3" width={pct(bands[0])} height="8" rx="2" fill="var(--bad-soft)" />
        <rect x={pct(bands[0])} y="3" width={pct(bands[1]) - pct(bands[0])} height="8" fill="var(--warn-soft)" />
        <rect x={pct(bands[1])} y="3" width={100 - pct(bands[1])} height="8" rx="2" fill="var(--good-soft)" />
        <rect x="0" y="5" width={pct(value)} height="4" rx="2" fill={`url(#vb${gid})`} />
        <defs>
          <linearGradient id={`vb${gid}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--accent-1)" />
            <stop offset="100%" stopColor="var(--accent-2)" />
          </linearGradient>
        </defs>
        {target != null && (
          <rect x={pct(target)} y="1" width="1.2" height="12" rx="0.6" fill="var(--text)" />
        )}
      </svg>
      {target != null && <span className="vbullet-target tnum">target {target}{unit}</span>}
    </div>
  )
}
