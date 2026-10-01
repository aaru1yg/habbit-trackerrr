/* ============================================================
   UI KIT — the complete component vocabulary of the app.
   If a screen needs a control that is not in here, the control
   gets added here rather than hand-rolled in the screen.
   ============================================================ */
import {
  createContext, useContext, useState, useRef, useEffect,
  useMemo, useCallback, useLayoutEffect, cloneElement, forwardRef,
} from 'react'
import { createPortal } from 'react-dom'
import { IconCheck, IconX, IconPlus, IconMinus } from './icons.jsx'
import { dow } from '../core/date.js'

const cx = (...a) => a.filter(Boolean).join(' ')

/* ============================================================
   Hooks
   ============================================================ */

/** Pointer-tracked sheen. Attach the returned props to any .sheen. */
export function useSheen() {
  const ref = useRef(null)
  const onPointerMove = useCallback((e) => {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    el.style.setProperty('--mx', `${((e.clientX - r.left) / r.width) * 100}%`)
    el.style.setProperty('--my', `${((e.clientY - r.top) / r.height) * 100}%`)
  }, [])
  return { ref, onPointerMove }
}

/** Esc-to-close + focus trap + scroll lock for overlays. */
function useOverlay(onClose) {
  const ref = useRef(null)
  useEffect(() => {
    const prev = document.activeElement
    const { _overflow } = document.body.style
    document.body.style.overflow = 'hidden'
    const onKey = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose?.() }
      if (e.key !== 'Tab' || !ref.current) return
      const f = ref.current.querySelectorAll(
        'a[href],button:not([disabled]),textarea,input,select,[tabindex]:not([tabindex="-1"])'
      )
      if (!f.length) return
      const first = f[0]
      const last = f[f.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKey, true)
    const t = setTimeout(() => {
      const el = ref.current?.querySelector('[data-autofocus]') || ref.current?.querySelector('input,textarea,button')
      el?.focus()
    }, 60)
    return () => {
      clearTimeout(t)
      document.removeEventListener('keydown', onKey, true)
      document.body.style.overflow = prev
      if (prev instanceof HTMLElement) prev.focus?.()
    }
  }, [onClose])
  return ref
}

/** Counts a number up when it changes. Respects reduced motion. */
export function useCountUp(value, ms = 620) {
  const [shown, setShown] = useState(value)
  const from = useRef(value)
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { setShown(value); return }
    const start = performance.now()
    const a = from.current
    let raf
    const tick = (t) => {
      const p = Math.min(1, (t - start) / ms)
      const e = 1 - (1 - p) ** 3
      setShown(a + (value - a) * e)
      if (p < 1) raf = requestAnimationFrame(tick)
      else from.current = value
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, ms])
  return shown
}

/* ============================================================
   Surfaces
   ============================================================ */

/* forwardRef because overlays need a real node to trap focus in,
   and the sheen hook needs one to measure. Both refs are merged so
   a caller's ref never silently loses to the internal one. */
export const Surface = forwardRef(function Surface(
  { as: As = 'div', variant, lift, sheen, depth, className, children, ...rest },
  ref
) {
  const s = useSheen()
  const setRef = useCallback(
    (node) => {
      if (sheen) s.ref.current = node
      if (typeof ref === 'function') ref(node)
      else if (ref) ref.current = node
    },
    [ref, sheen, s.ref]
  )
  return (
    <As
      ref={setRef}
      onPointerMove={sheen ? s.onPointerMove : undefined}
      className={cx('surface', variant && `surface--${variant}`, lift && 'lift', sheen && 'sheen', depth && `d${depth}`, className)}
      {...rest}
    >
      {children}
    </As>
  )
})

export function Panel({ title, sub, action, pad = 'var(--s5)', className, children, ...rest }) {
  return (
    <Surface className={className} {...rest}>
      <div style={{ padding: pad }}>
        {(title || action) && (
          <div className="sechead">
            <div className="sechead__t">
              {title && <h3>{title}</h3>}
              {sub && <span className="sechead__sub">{sub}</span>}
            </div>
            {action && <div className="sechead__a">{action}</div>}
          </div>
        )}
        {children}
      </div>
    </Surface>
  )
}

export const SectionHead = ({ eyebrow, title, sub, action }) => (
  <div className="sechead">
    <div className="sechead__t">
      {eyebrow && <span className="eyebrow">{eyebrow}</span>}
      {title && <h2>{title}</h2>}
      {sub && <span className="sechead__sub">{sub}</span>}
    </div>
    {action && <div className="sechead__a">{action}</div>}
  </div>
)

/* ============================================================
   Buttons
   ============================================================ */

export function Button({ variant, size, block, icon, iconOnly, className, children, ...rest }) {
  return (
    <button
      type="button"
      className={cx('btn', variant && `btn--${variant}`, size && `btn--${size}`, block && 'btn--block', iconOnly && 'btn--icon', className)}
      {...rest}
    >
      {icon}
      {!iconOnly && children}
    </button>
  )
}

export const IconButton = ({ label, size = 'sm', ...rest }) => (
  <Button iconOnly size={size} variant="ghost" aria-label={label} title={label} {...rest} />
)

export function Chip({ on, className, children, ...rest }) {
  const Tag = rest.onClick ? 'button' : 'span'
  return (
    <Tag type={rest.onClick ? 'button' : undefined} className={cx('chip', className)} aria-pressed={rest.onClick ? !!on : undefined} {...rest}>
      {children}
    </Tag>
  )
}

export const Badge = ({ tone = 'neutral', children, ...rest }) => (
  <span className={cx('badge', `badge--${tone}`)} {...rest}>{children}</span>
)

/* ---- Segmented control with a sliding pill ---------------- */
export function Segmented({ options, value, onChange, label }) {
  const ref = useRef(null)
  const [pill, setPill] = useState(null)

  useLayoutEffect(() => {
    const el = ref.current?.querySelector(`[data-v="${CSS.escape(String(value))}"]`)
    if (!el || !ref.current) return
    const r = ref.current.getBoundingClientRect()
    const b = el.getBoundingClientRect()
    setPill({ left: b.left - r.left, width: b.width })
  }, [value, options])

  return (
    <div className="seg" ref={ref} role="tablist" aria-label={label}>
      {pill && <span className="seg__pill" style={{ left: pill.left, width: pill.width }} aria-hidden="true" />}
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          data-v={o.value}
          aria-selected={o.value === value}
          className="seg__btn"
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/* ============================================================
   Form controls
   ============================================================ */

let fieldSeq = 0
export function Field({ label, hint, error, children }) {
  const id = useMemo(() => `f${++fieldSeq}`, [])
  return (
    <div className="field">
      {label && <label className="field__label" htmlFor={id}>{label}</label>}
      {cloneElement(children, { id, 'aria-invalid': error ? 'true' : undefined })}
      {error ? <span className="field__err">{error}</span> : hint ? <span className="field__hint">{hint}</span> : null}
    </div>
  )
}

export const Input    = (p) => <input className={cx('input', p.className)} {...p} />
export const Textarea = (p) => <textarea className={cx('input', p.className)} {...p} />
export const Select   = ({ children, ...p }) => <select className={cx('input', p.className)} {...p}>{children}</select>

export const Switch = ({ checked, onChange, label }) => (
  <button
    type="button" role="switch" aria-checked={!!checked} aria-label={label}
    className="switch" onClick={() => onChange(!checked)}
  />
)

export const SwitchRow = ({ label, hint, checked, onChange }) => (
  <div className="switchrow">
    <div>
      <div className="strong" style={{ fontSize: 'var(--fs-sm)' }}>{label}</div>
      {hint && <div className="tiny dim">{hint}</div>}
    </div>
    <Switch checked={checked} onChange={onChange} label={label} />
  </div>
)

export function Stepper({ value, onChange, min = 0, max = 9999, step = 1, suffix }) {
  return (
    <div className="stepper">
      <button type="button" className="stepper__btn" onClick={() => onChange(Math.max(min, value - step))} disabled={value <= min} aria-label="Decrease">
        <IconMinus size={14} />
      </button>
      <span className="stepper__v num">{value}{suffix ? ` ${suffix}` : ''}</span>
      <button type="button" className="stepper__btn" onClick={() => onChange(Math.min(max, value + step))} disabled={value >= max} aria-label="Increase">
        <IconPlus size={14} />
      </button>
    </div>
  )
}

/* ---- The habit tick --------------------------------------- */
export function Check({ checked, onChange, label, partial = 0 }) {
  const [pop, setPop] = useState(0)
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={!!checked}
      aria-label={label}
      className="check"
      data-pop={pop ? '1' : '0'}
      style={!checked && partial > 0 ? { borderColor: `rgb(var(--accent-rgb) / ${0.3 + partial * 0.5})` } : undefined}
      onClick={() => { if (!checked) setPop((n) => n + 1); onChange(!checked) }}
      onAnimationEnd={() => setPop(0)}
    >
      <span className="check__pop" key={pop} aria-hidden="true" />
      <IconCheck size={17} />
    </button>
  )
}

/* ============================================================
   Data display
   ============================================================ */

export const Bar = ({ value, tone, thin, thick, className }) => (
  <div className={cx('bar', thin && 'bar--thin', thick && 'bar--thick', className)} role="presentation">
    <div className={cx('bar__fill', tone && `bar__fill--${tone}`)} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
  </div>
)

export function Ring({ value, size = 120, stroke = 9, children, label, tone }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const v = useCountUp(Math.max(0, Math.min(100, value)))
  const toneColor = tone && { good: '#2fd6a6', warn: '#ffd24c', risk: '#ff8a4c', bad: '#ff5a72' }[tone]
  return (
    <div className="ring" style={{ width: size, height: size }} role="img" aria-label={label || `${Math.round(value)} percent`}>
      <svg width={size} height={size}>
        <circle className="ring__track" cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} />
        <circle
          className="ring__fill" cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke}
          strokeDasharray={c} strokeDashoffset={c - (v / 100) * c}
          style={toneColor ? { stroke: toneColor, filter: `drop-shadow(0 0 7px ${toneColor}aa)` } : undefined}
        />
      </svg>
      {children && <div className="ring__label">{children}</div>}
    </div>
  )
}

export function Stat({ value, label, sub, size }) {
  return (
    <div className={cx('stat', size === 'sm' && 'stat--sm')}>
      <span className="stat__v num">{value}</span>
      <span className="stat__k">{label}</span>
      {sub && <span className="stat__sub">{sub}</span>}
    </div>
  )
}

export const Tile = ({ value, label, sub, depth = 1, ...rest }) => (
  <Surface variant="flat" lift sheen depth={depth} className="tile" {...rest}>
    <Stat value={value} label={label} sub={sub} size="sm" />
  </Surface>
)

/** Animated number that counts to its target. */
/** "1 habit" / "2 habits". Pass `many` when it isn't just +s. */
export const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

export const Num = ({ value, decimals = 0, suffix = '' }) => {
  const v = useCountUp(Number(value) || 0)
  return <span className="num">{v.toFixed(decimals)}{suffix}</span>
}

/* ---- Charts: hand-rolled SVG, every pixel is real data ---- */

export function Spark({ points, height = 48, fill = true }) {
  const id = useMemo(() => `sg${Math.random().toString(36).slice(2, 8)}`, [])
  if (!points?.length) return null
  const n = points.length
  const max = Math.max(1, ...points)
  const x = (i) => (n === 1 ? 50 : (i / (n - 1)) * 100)
  const y = (v) => 100 - (v / max) * 92 - 4
  const d = points.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(2)},${y(v).toFixed(2)}`).join(' ')
  return (
    <svg className="spark" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ height }} aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgb(var(--accent-rgb))" stopOpacity=".34" />
          <stop offset="100%" stopColor="rgb(var(--accent-rgb))" stopOpacity="0" />
        </linearGradient>
      </defs>
      {fill && <path d={`${d} L100,100 L0,100 Z`} fill={`url(#${id})`} stroke="none" />}
      <path className="spark__line" d={d} vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

export function Columns({ data, height = 76, labels }) {
  const max = Math.max(1, ...data.map((d) => (typeof d === 'number' ? d : d.value)))
  return (
    <div>
      <div className="cols" style={{ height }}>
        {data.map((d, i) => {
          const v = typeof d === 'number' ? d : d.value
          return (
            <div
              key={i}
              className="cols__col"
              data-empty={v <= 0 ? '1' : '0'}
              style={{ '--i': i, height: `${Math.max(3, (v / max) * 100)}%` }}
              title={typeof d === 'object' ? d.title : undefined}
            />
          )
        })}
      </div>
      {labels && (
        <div className="row" style={{ marginTop: 6, gap: 4 }}>
          {labels.map((l, i) => (
            <span key={i} className="tiny faint" style={{ flex: 1, textAlign: 'center' }}>{l}</span>
          ))}
        </div>
      )}
    </div>
  )
}

export function Heatmap({ cells, today: todayKey }) {
  /* Each column must be a real calendar week, so the seven rows mean
     Sun..Sat rather than "whatever position in the list". Pad the first
     column with blanks until the range's first day sits on its weekday. */
  const lead = cells.length ? dow(cells[0].day) : 0
  const cols = Math.ceil((lead + cells.length) / 7)

  return (
    <div className="heat-wrap">
      <div className="heat-rows" aria-hidden="true">
        <span />
        <span>Mon</span>
        <span />
        <span>Wed</span>
        <span />
        <span>Fri</span>
        <span />
      </div>
      <div className="heat" role="img" aria-label="Consistency over time" style={{ '--cols': cols }}>
        {Array.from({ length: lead }, (_, i) => <div key={`pad${i}`} className="heat__cell heat__cell--pad" />)}
        {cells.map((c) => (
          <div
            key={c.day}
            className="heat__cell"
            data-lv={c.level}
            data-today={c.day === todayKey ? '1' : '0'}
            title={`${c.day} · ${c.title}`}
          />
        ))}
      </div>
    </div>
  )
}

/* ============================================================
   Overlays
   ============================================================ */

export function Sheet({ open, onClose, title, footer, wide, children }) {
  const ref = useOverlay(onClose)
  if (!open) return null
  return createPortal(
    <div className="scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <Surface
        as="div" variant="float" ref={ref}
        className={cx('sheet', wide && 'sheet--wide')}
        role="dialog" aria-modal="true" aria-label={title}
      >
        <div className="sheet__head">
          <span className="sheet__title">{title}</span>
          <span className="spacer" />
          <IconButton label="Close" icon={<IconX size={18} />} onClick={onClose} />
        </div>
        <div className="sheet__body">{children}</div>
        {footer && <div className="sheet__foot">{footer}</div>}
      </Surface>
    </div>,
    document.body
  )
}

export function Confirm({ open, title, body, confirmLabel = 'Delete', onConfirm, onClose, danger = true }) {
  return (
    <Sheet
      open={open} onClose={onClose} title={title}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={() => { onConfirm(); onClose() }} data-autofocus>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="muted small">{body}</p>
    </Sheet>
  )
}

export const Empty = ({ icon, title, body, action }) => (
  <div className="empty">
    {icon && <div className="empty__icon">{icon}</div>}
    <div className="empty__t">{title}</div>
    {body && <p className="empty__d">{body}</p>}
    {action}
  </div>
)

/* ============================================================
   Toasts
   ============================================================ */

const ToastCtx = createContext(() => {})
export const useToast = () => useContext(ToastCtx)

export function ToastHost({ children }) {
  const [items, setItems] = useState([])
  const push = useCallback((message, tone = 'info') => {
    const id = Math.random().toString(36).slice(2)
    setItems((xs) => [...xs.slice(-3), { id, message, tone }])
    setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), 3400)
  }, [])
  return (
    <ToastCtx.Provider value={push}>
      {children}
      {items.length > 0 && createPortal(
        <div className="toaster" role="status" aria-live="polite">
          {items.map((t) => (
            <div key={t.id} className={cx('toast', `toast--${t.tone}`)}>
              <span className="toast__dot" />
              <span>{t.message}</span>
            </div>
          ))}
        </div>,
        document.body
      )}
    </ToastCtx.Provider>
  )
}

export { cx }
