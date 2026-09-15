/* ============================================================
   FOCUS MODE (§23) — one thing, a real timer, and a real record.

   The session is persisted when it ends. That log is the only source
   of actual durations the product has, so nothing about "learning from
   your actuals" can be honest until a session is written down.
   ============================================================ */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { focusRecommendation } from '../../lib/planning.js'
import { completionAction, hrefFor, isCompletable } from '../../lib/completion.js'
import { estimateSuggestion } from '../../lib/learning.js'
import { useToast } from '../ui/Toaster.jsx'
import { Link } from '../../lib/router.jsx'

const fmt = (s) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${Math.floor(s % 60).toString().padStart(2, '0')}`
const DURATIONS = [25, 45, 60, 90]

/**
 * FocusMode — focus timer sheet.
 *
 * When embedded inside a Sheet (Work screen), `onClose` is NOT passed — the
 * parent Sheet owns Escape/close. The legacy closed-state ghost button
 * ("Focus mode") remains for that path.
 *
 * When embedded directly on Today, `onClose` IS passed. When the user exits,
 * skips-without-starting, or finishes, `onClose()` fires and Today unmounts
 * this component entirely, so the ghost "Focus mode" button never appears
 * inline under Tools. Escape also exits.
 */
export default function FocusMode({ state, dispatch, now = new Date(), openTick = 0, selectedItem = null, defaultOpen = false, onClose }) {
  const [open, setOpen] = useState(defaultOpen)
  const [minutes, setMinutes] = useState(25)
  const [elapsed, setElapsed] = useState(0)
  const [started, setStarted] = useState(null)
  const [paused, setPaused] = useState(false)
  const [done, setDone] = useState(false)

  const toast = useToast()
  const rec = useMemo(() => selectedItem ? { item: selectedItem, reason: 'Work you chose to focus on.', suggestedDuration: selectedItem.estimateMin ?? null } : focusRecommendation(state, { now }), [state, now, selectedItem])
  const advice = useMemo(
    () => (rec ? estimateSuggestion(rec.item, state, { now }) : null),
    [rec, state, now],
  )
  const [estimateApplied, setEstimateApplied] = useState(false)

  const close = useCallback(() => { setOpen(false); onClose?.() }, [onClose])

  const acceptEstimate = () => {
    if (!advice?.action) return
    dispatch(advice.action)
    dispatch({ type: 'RECORD_SIGNAL', signal: 'estimate-accept', target: String(rec.item.id) })
    setEstimateApplied(true)
    toast.show(`${advice.name} is now planned at ${advice.suggestedMin} min.`, {
      duration: 6000,
      actionLabel: advice.undo ? 'Undo' : null,
      onAction: advice.undo ? () => dispatch(advice.undo) : null,
    })
  }

  // External open tick (Today's Focus button or WorkFocus) — reopen the sheet.
  useEffect(() => { if (openTick > 0) { setOpen(true); setDone(false); setElapsed(0); setStarted(null); setPaused(false); setEstimateApplied(false) } }, [openTick])

  // Escape-to-close when an onClose owner is provided (Today embedding).
  useEffect(() => {
    if (!open || !onClose) return
    const onKey = (e) => { if (e.key === 'Escape') close() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose, close])

  useEffect(() => {
    if (!started || paused || done) return
    const id = setInterval(() => setElapsed((x) => x + 1), 1000)
    return () => clearInterval(id)
  }, [started, paused, done])

  // Today-embedding closed state: return null. The legacy ghost "Focus mode"
  // launch button is only rendered when onClose is absent (Sheet embedding /
  // legacy inline usage) — not on Today.
  if (!open) {
    return onClose ? null : <button className="btn ghost focus-launch" onClick={() => setOpen(true)}>Focus mode</button>
  }

  if (!rec) {
    return (
      <section
        role="dialog"
        aria-modal={onClose ? 'true' : undefined}
        aria-label="Focus mode"
        className="card pad focus-mode"
      >
        <h2>Focus mode</h2>
        <p>Not enough data yet. There is no open next action.</p>
        <button className="btn ghost" onClick={close}>Exit</button>
      </section>
    )
  }

  const item = rec.item

  const endSession = (completed, interrupted = false) => {
    if (!started) return
    const endedAt = new Date().toISOString()
    const actualMin = Math.max(1, Math.round((Date.parse(endedAt) - Date.parse(started)) / 60000))
    dispatch({
      type: 'ADD_FOCUS_SESSION',
      session: {
        kind: item.kind, itemId: item.id, name: item.label || item.name,
        startedAt: started, endedAt, plannedMin: minutes, actualMin, completed, interrupted,
      },
    })
    if (completed) dispatch({ type: 'RECORD_SIGNAL', signal: 'focus-complete', target: String(item.id) })
  }

  const start = () => {
    const at = new Date().toISOString()
    setStarted(at)
    dispatch({ type: 'RECORD_SIGNAL', signal: 'focus-start', target: String(item.id) })
  }

  const complete = () => {
    const action = completionAction(item.kind, item)
    if (action) dispatch(action)
    endSession(true)
    setDone(true)
  }

  const skip = () => {
    endSession(false, true)
    close()
  }

  return (
    <section
      role="dialog"
      aria-modal={onClose ? 'true' : undefined}
      aria-label="Focus mode"
      className="card pad focus-mode"
    >
      <div className="row-between">
        <span className="eyebrow">Focus mode</span>
        <button className="btn ghost sm" onClick={close} aria-label="Exit focus">Exit</button>
      </div>

      {done ? (
        <>
          <h2>Session complete</h2>
          <p>Nice work on {item.label || item.name}.</p>
          <p className="tiny muted" style={{ lineHeight: 1.6 }}>
            {started
              ? `This session is saved with its real duration, so future estimates for similar work can be compared against it.`
              : 'Nothing was measured, so nothing was saved.'}
          </p>
          <button className="btn primary" onClick={close}>Close</button>
        </>
      ) : (
        <>
          <p className="eyebrow">Next best action</p>
          <h2>{item.label || item.name}</h2>
          <p className="focus-reason">{rec.reason}</p>

          <div className="focus-duration">
            <label htmlFor="focus-duration">Planned duration</label>
            <select id="focus-duration" value={minutes} onChange={(e) => setMinutes(Number(e.target.value))}>
              {DURATIONS.map((x) => <option key={x} value={x}>{x} min</option>)}
            </select>
          </div>

          {advice?.enough && (
            <div className="focus-advice" role="note">
              <p style={{ margin: 0 }}>
                {advice.text}
                <span className="tiny muted"> · {advice.samples} session{advice.samples === 1 ? '' : 's'}</span>
              </p>
              {advice.applyable && !estimateApplied && (
                <button type="button" className="btn sm" onClick={acceptEstimate}>{advice.label}</button>
              )}
              {advice.applyable && estimateApplied && (
                <p className="tiny good" style={{ margin: '6px 0 0' }}>
                  Applied. Undo is in the toast if you changed your mind.
                </p>
              )}
              {!advice.applyable && <p className="tiny muted" style={{ margin: '6px 0 0' }}>{advice.blockedReason}</p>}
            </div>
          )}

          <div className="focus-timer" role="timer" aria-live="polite">
            {fmt(elapsed)} <small>/ {minutes}:00</small>
          </div>

          <div className="focus-actions">
            {!started
              ? <button className="btn primary" onClick={start}>Start</button>
              : <button className="btn" onClick={() => setPaused((x) => !x)}>{paused ? 'Resume' : 'Pause'}</button>}
            {isCompletable(item.kind)
              ? <button className="btn primary" onClick={complete} disabled={!started}>Complete</button>
              : <span className="tiny muted" role="note">A project is finished by finishing its work — there is no one-tap complete.</span>}
            <button className="btn ghost" onClick={skip} disabled={!started}>Skip</button>
            <Link className="btn ghost" to={hrefFor(item.kind, item)} onClick={close}>View</Link>
          </div>

          <details>
            <summary>Why this action?</summary>
            <p className="tiny muted">
              {rec.reason} Estimated: {rec.suggestedDuration == null ? 'Not enough data yet.' : `${rec.suggestedDuration} min`}.
              {started ? '' : ' Start the timer to record how long this actually takes.'}
            </p>
          </details>
        </>
      )}
    </section>
  )
}
