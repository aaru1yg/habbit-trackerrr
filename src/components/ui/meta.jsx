/* ============================================================
   META — Badge / StatusPill / Metric / Dot (V5).

   Status is never color-only: pills always carry a text label (and
   usually an icon). Metrics use tabular numerals and expose a text
   summary for assistive tech.
   ============================================================ */

const TONES = ['neutral', 'good', 'warn', 'bad', 'info', 'accent']

export function Badge({ tone = 'neutral', icon = null, children }) {
  return (
    <span className="vbadge" data-tone={TONES.includes(tone) ? tone : 'neutral'}>
      {icon && <span className="vbadge-icon" aria-hidden="true">{icon}</span>}
      {children}
    </span>
  )
}

export function StatusPill({ tone = 'neutral', icon = null, children, label }) {
  return (
    <span className="vstatus" data-tone={TONES.includes(tone) ? tone : 'neutral'} aria-label={label}>
      {icon && <span className="vstatus-icon" aria-hidden="true">{icon}</span>}
      <span className="vstatus-dot" aria-hidden="true" />
      {children}
    </span>
  )
}

export function Dot({ color = 'var(--text-3)', label }) {
  return (
    <span
      className="vdot"
      style={{ background: color }}
      role={label ? 'img' : undefined}
      aria-label={label || undefined}
      aria-hidden={label ? undefined : 'true'}
    />
  )
}

/**
 * Metric — one labelled number. delta: { dir: 'up'|'down'|'flat', text }.
 * The whole figure is one group with a text summary for screen readers.
 */
export function Metric({ label, value, sub = null, delta = null, tone = 'neutral', align = 'start', style = null }) {
  const summary = `${label}: ${value}${sub ? `, ${sub}` : ''}${delta ? `, ${delta.text}` : ''}`
  return (
    <div className="vmetric" data-tone={TONES.includes(tone) ? tone : 'neutral'} data-align={align}
      role="group" aria-label={summary} style={style || undefined}>
      <span className="vmetric-label">{label}</span>
      <span className="vmetric-value tnum">{value}</span>
      {sub && <span className="vmetric-sub">{sub}</span>}
      {delta && (
        <span className="vmetric-delta" data-dir={delta.dir}>
          <span aria-hidden="true">{delta.dir === 'up' ? '▲' : delta.dir === 'down' ? '▼' : '●'}</span>
          {' '}{delta.text}
        </span>
      )}
    </div>
  )
}
