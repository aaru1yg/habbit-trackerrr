/* ============================================================
   FOCUS MODE (§23) — one thing, a real timer, and a real record.

   The session is persisted when it ends. That log is the only source
   of actual durations the product has, so nothing about "learning from
   your actuals" can be honest until a session is written down.
   ============================================================ */
import { useEffect, useMemo, useState } from 'react'
import { focusRecommendation } from '../../lib/planning.js'
import { estimateAdvice } from '../../lib/personalization.js'
import { Link } from '../../lib/router.jsx'

const fmt = (s) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${Math.floor(s % 60).toString().padStart(2, '0')}`
const DURATIONS = [25, 45, 60, 90]

export default function FocusMode({ state, dispatch, now = new Date(), openTick = 0 }) {
  const [open, setOpen] = useState(false)
  const [minutes, setMinutes] = useState(25)
  const [elapsed, setElapsed] = useState(0)
  const [started, setStarted] = useState(null)
  const [paused, setPaused] = useState(false)
  const [done, setDone] = useState(false)

  const rec = useMemo(() => focusRecommendation(state, { now }), [state, now])
  const advice = useMemo(
    () => (rec ? estimateAdvice(rec.item, state, { now }) : null),
    [rec, state, now],
  )

  useEffect(() => { if (openTick > 0) setOpen(true) }, [openTick])

  useEffect(() => {
    if (!started || paused || done) return
    const id = setInterval(() => setElapsed((x) => x + 1), 1000)
    return () => clearInterval(id)
  }, [started, paused, done])

  if (!open) return <button className="btn ghost focus-launch" onClick={() => setOpen(true)}>Focus mode</button>

  if (!rec) {
    return (
      <section className="card pad focus-mode">
        <h2>Focus mode</h2>
        <p>Not enough data yet. There is no open next action.</p>
        <button className="btn ghost" onClick={() => setOpen(false)}>Exit</button>
      </section>
    )
  }

  const item = rec.item

  /** Write down what actually happened. Only a session that ran is stored. */
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
    if (item.kind === 'habit') dispatch({ type: 'TOGGLE_CHECKIN', habitId: item.id, date: new Date().toISOString().slice(0, 10) })
    if (item.kind === 'assignment') dispatch({ type: 'SET_ASSIGNMENT_PROGRESS', id: item.id, pct: 100 })
    endSession(true)
    setDone(true)
  }

  const skip = () => {
    endSession(false, true)
    setOpen(false)
  }

  return (
    <section className="card pad focus-mode" aria-label="Focus mode">
      <div className="row-between">
        <span className="eyebrow">Focus mode</span>
        <button className="btn ghost sm" onClick={() => setOpen(false)}>Exit</button>
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
          <button className="btn primary" onClick={() => { setOpen(false); setDone(false) }}>Close</button>
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

          {/* §5 — the historical average is shown next to the estimate, never
              substituted for it. */}
          {advice?.enough && (
            <p className="focus-advice" role="note">
              Your recent similar sessions average ~{advice.actualMeanMin} min
              <span className="tiny muted"> · {advice.samples} session{advice.samples === 1 ? '' : 's'}</span>
            </p>
          )}

          <div className="focus-timer" role="timer" aria-live="polite">
            {fmt(elapsed)} <small>/ {minutes}:00</small>
          </div>

          <div className="focus-actions">
            {!started
              ? <button className="btn primary" onClick={start}>Start</button>
              : <button className="btn" onClick={() => setPaused((x) => !x)}>{paused ? 'Resume' : 'Pause'}</button>}
            <button className="btn primary" onClick={complete} disabled={!started}>Complete</button>
            <button className="btn ghost" onClick={skip} disabled={!started}>Skip</button>
            <Link className="btn ghost" to={item.kind === 'assignment' ? `assignments/${item.id}` : 'today'}>View</Link>
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
