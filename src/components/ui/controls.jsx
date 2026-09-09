/* ============================================================
   CONTROLS — Button / IconButton / SegControl / Tabs (V5).

   One interaction language: every control resolves to component
   tokens, hits the touch floor on coarse pointers, shows a visible
   focus ring, and collapses cleanly under reduced motion.
   ============================================================ */
import { useRef } from 'react'

/* ---------------- Button ---------------- */

export function Button({
  variant = 'primary', // primary | subtle | ghost | danger | success
  size = 'md',         // sm | md | lg
  loading = false,
  fullWidth = false,
  icon = null,
  children,
  ...rest
}) {
  return (
    <button
      type={rest.type || 'button'}
      className={`vbtn${fullWidth ? ' vbtn-block' : ''}${loading ? ' is-loading' : ''}`}
      data-variant={variant}
      data-size={size}
      aria-busy={loading || undefined}
      disabled={loading || rest.disabled}
      {...rest}
    >
      {loading && <span className="vbtn-spin" aria-hidden="true" />}
      {icon && <span className="vbtn-icon" aria-hidden="true">{icon}</span>}
      <span className="vbtn-label">{children}</span>
    </button>
  )
}

/* ---------------- IconButton ---------------- */

export function IconButton({ label, size = 18, children, ...rest }) {
  return (
    <button type="button" className="viconbtn" aria-label={label} {...rest}>
      {children}
    </button>
  )
}

/* ---------------- SegControl (single-select) ---------------- */

export function SegControl({ label, options, value, onChange, size = 'md' }) {
  return (
    <div className="vseg" role="radiogroup" aria-label={label} data-size={size}>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={value === o.id}
          className={`vseg-btn${value === o.id ? ' active' : ''}`}
          onClick={() => onChange(o.id)}
        >
          {o.icon && <span className="vseg-icon" aria-hidden="true">{o.icon}</span>}
          {o.label}
        </button>
      ))}
    </div>
  )
}

/* ---------------- Tabs (full tablist keyboard contract) ---------------- */

export function Tabs({ label, tabs, value, onChange }) {
  const refs = useRef([])
  const ids = tabs.map((t) => t.id)
  const onKeyDown = (e) => {
    const i = ids.indexOf(value)
    let next = null
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (i + 1) % ids.length
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (i - 1 + ids.length) % ids.length
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = ids.length - 1
    if (next != null) {
      e.preventDefault()
      onChange(ids[next])
      refs.current[next]?.focus()
    }
  }
  return (
    <div className="vtabs" role="tablist" aria-label={label} onKeyDown={onKeyDown}>
      {tabs.map((t, i) => (
        <button
          key={t.id}
          ref={(el) => { refs.current[i] = el }}
          type="button"
          role="tab"
          id={`vtab-${t.id}`}
          aria-selected={value === t.id}
          aria-controls={t.panelId}
          tabIndex={value === t.id ? 0 : -1}
          className={`vtab${value === t.id ? ' active' : ''}`}
          onClick={() => onChange(t.id)}
        >
          {t.icon && <span className="vtab-icon" aria-hidden="true">{t.icon}</span>}
          {t.label}
          {t.count != null && <span className="vtab-count tnum">{t.count}</span>}
        </button>
      ))}
    </div>
  )
}
