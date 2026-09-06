/* ============================================================
   WORK KIT — the shared building blocks for projects,
   assignments, workload and timelines. Small, composable, and
   consistent with the habit design system.
   ============================================================ */
import { motion, useReducedMotion } from 'framer-motion'
import { IconClock, IconAlert, IconCheck } from '../../lib/icons.jsx'
import { shortDate, prettyDateTime } from '../../lib/dates.js'

/* ---------------- Status pill ---------------- */

export function StatusPill({ status, className = '' }) {
  if (!status) return null
  return (
    <span className={`status-pill ${className}`.trim()} data-tone={status.tone}>
      {status.label}
    </span>
  )
}

export function KindTag({ kind, children }) {
  return <span className={`kind-tag ${kind}`}>{children || kind}</span>
}

/* ---------------- Countdown ---------------- */

/** The most important number on an assignment: how much time is left. */
export function DeadlineHero({ status, compact = false }) {
  if (!status?.hasDeadline) {
    return <span className="tiny muted">No deadline set</span>
  }
  if (status.complete) {
    return (
      <span className="deadline-hero" data-tone="good">
        <IconCheck size={18} />
        <span className="big">Done</span>
      </span>
    )
  }
  const hours = status.hoursLeft ?? 0
  const showHours = Math.abs(hours) < 48
  const value = status.passed
    ? (showHours ? `${Math.max(1, Math.round(Math.abs(hours)))}h` : `${Math.abs(status.daysLeft ?? 0)}d`)
    : (showHours ? `${Math.max(0, Math.round(hours))}h` : `${status.daysLeft ?? 0}d`)
  return (
    <span className="deadline-hero" data-tone={status.tone === 'neutral' ? 'good' : status.tone}>
      {status.passed || status.id === 'urgent' ? <IconAlert size={18} /> : <IconClock size={18} />}
      <span className="big" style={compact ? { fontSize: '1.125rem' } : undefined}>{value}</span>
      <span className="unit">{status.passed ? 'overdue' : showHours ? 'hours left' : 'days left'}</span>
    </span>
  )
}

export function CountdownChip({ status, prefix = 'Due' }) {
  if (!status?.hasDeadline) return <span className="count-chip">No deadline</span>
  return (
    <span className="count-chip" data-tone={status.tone === 'neutral' ? undefined : status.tone}>
      <IconClock size={12} />
      {status.complete ? 'Completed' : status.dueText}
      {status.deadline && !status.complete
        ? ` · ${String(status.deadline).length > 10 ? prettyDateTime(status.deadline) : shortDate(String(status.deadline).slice(0, 10))}`
        : ''}
    </span>
  )
}

/* ---------------- Progress meter ---------------- */

export function Meter({ pct, tone, pace = null, thick = false, thin = false, label }) {
  const reduced = useReducedMotion()
  const clamped = Math.max(0, Math.min(100, pct ?? 0))
  return (
    <span
      className={`meter${thick ? ' thick' : ''}${thin ? ' thin' : ''}${pace != null ? ' with-pace' : ''}`}
      data-tone={tone === 'neutral' ? undefined : tone}
      role={label ? 'img' : undefined}
      aria-label={label || (pace != null ? `${Math.round(clamped)}% complete, pace marker at ${Math.round(pace)}%` : undefined)}
    >
      <motion.i
        initial={false}
        animate={{ width: `${clamped}%` }}
        transition={reduced ? { duration: 0 } : { duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      />
      {pace != null && <u style={{ left: `${Math.max(0, Math.min(100, pace))}%` }} />}
    </span>
  )
}

export function MeterRow({ pct, tone, pace = null, sub }) {
  return (
    <div className="meter-row">
      <Meter pct={pct} tone={tone} pace={pace} label={`${Math.round(pct ?? 0)} percent complete`} />
      <span className="meter-pct" style={tone === 'bad' ? { color: 'var(--bad)' } : tone === 'warn' ? { color: 'var(--warn)' } : tone === 'good' ? { color: 'var(--good)' } : undefined}>
        {pct == null ? '—' : `${Math.round(pct)}%`}
      </span>
      {sub && <span className="tiny muted ellipsis">{sub}</span>}
    </div>
  )
}

/* ---------------- Quick progress control (§66) ---------------- */

const STEPS = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]

export function QuickProgress({ value, onChange, label = 'Progress' }) {
  return (
    <div>
      <div className="row-between" style={{ marginBottom: 8 }}>
        <span className="field-label" style={{ margin: 0 }}>{label}</span>
        <span className="meter-pct">{Math.round(value || 0)}%</span>
      </div>
      <div className="quick-pct" role="group" aria-label={`${label} in 10 percent steps`}>
        {STEPS.map((s) => (
          <button key={s} type="button" aria-pressed={Math.round(value || 0) === s} onClick={() => onChange(s)}>
            {s}
          </button>
        ))}
      </div>
      <label className="sr-only" htmlFor="progress-slider">Custom {label.toLowerCase()} percentage</label>
      <input
        id="progress-slider"
        type="range"
        min="0"
        max="100"
        step="5"
        value={Math.round(value || 0)}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: '100%', marginTop: 12, accentColor: 'var(--accent-1)' }}
      />
    </div>
  )
}

/* ---------------- Milestone stepper (§59) ---------------- */

export function MilestoneStepper({ track, vertical = false, onSelect, pct = 0 }) {
  if (!track?.length) return null
  return (
    <div className={`stepper${vertical ? ' vertical' : ''}`} role="list" aria-label="Milestone progression">
      {track.map((m) => {
        const state = m.reached ? 'reached' : m.partial ? 'partial' : 'todo'
        const fill = m.reached ? '100%' : m.partial ? `${Math.max(8, m.own ?? 0)}%` : '0%'
        const Tag = onSelect ? 'button' : 'div'
        return (
          <Tag
            key={m.id}
            role="listitem"
            className="step"
            data-state={state}
            style={onSelect ? { background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: vertical ? '0 0 16px 0' : undefined } : undefined}
            onClick={onSelect ? () => onSelect(m) : undefined}
            aria-label={`Milestone ${m.index + 1} of ${track.length}: ${m.name}, ${m.reached ? 'reached' : m.partial ? 'in progress' : 'not started'}${m.total ? `, ${m.done} of ${m.total} tasks` : ''}`}
          >
            <span className="step-rail" style={{ '--fill': fill }} aria-hidden="true">
              <span className="step-dot">{m.reached ? <IconCheck size={11} /> : null}</span>
            </span>
            <span style={{ minWidth: 0 }}>
              <span className="step-name">{m.name}</span>
              <span className="step-pct">
                {m.total ? `${m.done}/${m.total}` : `${m.anchor}%`}
                {m.due ? ` · ${shortDate(m.due)}` : ''}
              </span>
            </span>
          </Tag>
        )
      })}
    </div>
  )
}

/* ---------------- Stat strip ---------------- */

export function StatStrip({ cells, className = '' }) {
  return (
    <div className={`stat-strip ${className}`.trim()}>
      {cells.map((c) => {
        const inner = (
          <>
            <span className="k">{c.label}</span>
            <span className={`v${c.small ? ' sm' : ''}`} data-tone={c.tone}>{c.value}</span>
            {c.note && <span className="n">{c.note}</span>}
          </>
        )
        return c.onClick ? (
          <button key={c.label} type="button" className="stat-cell is-button" onClick={c.onClick} data-tone={c.tone}
            aria-label={`${c.label}: ${c.value}${c.note ? `. ${c.note}` : ''}`}>
            {inner}
          </button>
        ) : (
          <div key={c.label} className="stat-cell" data-tone={c.tone}>{inner}</div>
        )
      })}
    </div>
  )
}

/* ---------------- Filter bar ---------------- */

export function FilterBar({ filters, value, onChange, counts = {}, ariaLabel = 'Filters' }) {
  return (
    <div className="filter-bar" role="group" aria-label={ariaLabel}>
      {filters.map((f) => (
        <button key={f.id} type="button" aria-pressed={value === f.id} onClick={() => onChange(f.id)}>
          {f.label}
          {counts[f.id] != null && <span className="count">{counts[f.id]}</span>}
        </button>
      ))}
    </div>
  )
}

/* ---------------- Card entrance ---------------- */

export function FadeIn({ children, delay = 0, as = 'div', ...rest }) {
  const reduced = useReducedMotion()
  const Tag = motion[as] || motion.div
  return (
    <Tag
      initial={reduced ? false : { opacity: 0, y: 10 }}
      animate={reduced ? undefined : { opacity: 1, y: 0 }}
      transition={{ duration: 0.36, delay, ease: [0.22, 1, 0.36, 1] }}
      {...rest}
    >
      {children}
    </Tag>
  )
}

/* ---------------- Empty ---------------- */

export function WorkEmpty({ art, icon, title, children, action }) {
  return (
    <div className="empty">
      {art ? (
        <img src={art} alt="" width={240} height={240} loading="lazy" decoding="async"
          onError={(e) => { e.currentTarget.style.display = 'none' }} />
      ) : (
        <div style={{ color: 'var(--text-3)', display: 'grid', placeItems: 'center', height: 72 }}>{icon}</div>
      )}
      <div className="empty-title">{title}</div>
      {children && <p className="empty-sub">{children}</p>}
      {action && <div className="empty-actions">{action}</div>}
    </div>
  )
}
