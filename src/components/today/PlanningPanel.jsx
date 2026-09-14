import { useCallback, useEffect, useMemo, useState } from 'react'
import { useStore } from '../../store.jsx'
import { CardHead } from '../ui/SectionCard.jsx'
import { buildDayPlan, buildWeekPlan } from '../../lib/planning.js'
import { preferencesOf } from '../../lib/personalization.js'
const time = (v) => new Date(v).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

/**
 * PlanningPanel — day/week planner.
 *
 * When embedded inside a Sheet (Work screen), `onClose` is NOT passed — the
 * parent Sheet owns Escape/close and this panel stays mounted while the Sheet
 * is open. The initial closed-state card ("Build my day" preview) is preserved
 * for that usage.
 *
 * When embedded directly on Today, `onClose` IS passed. When the user dismisses,
 * `onClose()` fires and Today unmounts this component entirely, so the idle
 * closed card never appears inline under Tools. Escape also closes it.
 */
export default function PlanningPanel({ state, now = new Date(), openTick = 0, defaultOpen = false, onClose }) {
  const { dispatch } = useStore()
  const [open, setOpen] = useState(defaultOpen)
  const [week, setWeek] = useState(false)
  const [accepted, setAccepted] = useState(false)
  const [revision, setRevision] = useState(0)
  const prefs = preferencesOf(state)
  const plan = useMemo(() => {
    void revision
    if (!open) return null
    return week ? buildWeekPlan(state, { now }) : buildDayPlan(state, { now })
  }, [state, now, open, week, revision])

  const close = useCallback(() => { setOpen(false); onClose?.() }, [onClose])

  // External open tick (from Today's Plan button or WorkPlanning) — reopen the panel.
  useEffect(() => { if (openTick > 0) { setWeek(false); setAccepted(false); setOpen(true) } }, [openTick])

  // Escape-to-close only when an onClose owner is provided (Today embedding).
  // When used inside Sheet (WorkPlanning), the Sheet handles Escape.
  useEffect(() => {
    if (!open || !onClose) return
    const onKey = (e) => { if (e.key === 'Escape') close() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose, close])

  const build = () => {
    setWeek(false); setOpen(true); setAccepted(false)
    dispatch({ type: 'RECORD_SIGNAL', signal: 'plan-build' })
  }

  // Today-embedding closed state: return null so the host unmounts us and the
  // idle "Plan my day" card never shows inline. When embedded inside a Sheet
  // the host doesn't pass onClose, so we fall through to the legacy closed card.
  if (!open) {
    return onClose ? null : (
      <section className="card pad planning-panel">
        <CardHead title="Plan my day">
          <button className="btn primary sm" onClick={build}>Build my day</button>
        </CardHead>
        <p className="card-blurb">
          {prefs.dailyCapacityMin == null
            ? 'A suggested schedule using your priorities, deadlines and estimates. Set a daily capacity in Settings → How you work to have the plan checked against it.'
            : 'A suggested schedule using your priorities, deadlines, estimates and capacity. Nothing moves without your approval.'}
        </p>
      </section>
    )
  }

  return (
    <section
      role="dialog"
      aria-modal={onClose ? 'true' : undefined}
      aria-label="Plan my day"
      className="card pad planning-panel"
    >
      <CardHead title="Plan my day">
        <button className="btn primary sm" onClick={build}>Build my day</button>
      </CardHead>

      {!week && (
        <>
          <div className="planning-fit">
            <strong>{plan.fit}</strong>
            <span>
              {plan.capacityMin == null
                ? 'Planning is limited because available capacity isn’t configured. Set a daily capacity in Settings → How you work.'
                : `${plan.requiredMin} min required · ${plan.usableCapacityMin} min usable capacity`}
            </span>
          </div>
          <ol className="plan-blocks">
            {plan.blocks.map((b) => (
              <li key={b.id} className={!b.fits ? 'plan-over' : ''}>
                <span>{time(b.start)}–{time(b.end)}</span>
                <strong>{b.item.label || b.item.name}</strong>
                <small>{b.durationMin} min · {b.reason}</small>
              </li>
            ))}
          </ol>
          <div className="planning-actions">
            <button className="btn primary sm" onClick={() => { setAccepted(true); setTimeout(close, 800) }}>
              {accepted ? 'Plan accepted' : 'Accept plan'}
            </button>
            <button className="btn ghost sm" onClick={() => setRevision((v) => v + 1)}>Regenerate</button>
            <button className="btn ghost sm" onClick={close}>Dismiss</button>
            <button className="btn ghost sm" onClick={() => setWeek(true)}>Plan my week</button>
          </div>
        </>
      )}

      {week && (
        <>
          <div className="planning-fit">
            <strong>{plan.fit}</strong>
            <span>{plan.explanation}</span>
          </div>
          <div className="week-plan-grid">
            {plan.rows.map((r) => (
              <div key={r.date}>
                <strong>{new Date(`${r.date}T12:00:00`).toLocaleDateString([], { weekday: 'short' })}</strong>
                {r.blocks.map((b) => (
                  <span key={b.item.id}>
                    {b.item.label || b.item.name}
                    <small>{b.durationMin}m</small>
                  </span>
                ))}
              </div>
            ))}
          </div>
          <button className="btn ghost sm" onClick={() => setWeek(false)}>Back to day</button>
          <button className="btn ghost sm" onClick={close}>Dismiss</button>
        </>
      )}
    </section>
  )
}
