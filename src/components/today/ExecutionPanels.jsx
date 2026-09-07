import { useMemo, useState } from 'react'
import { useStore } from '../../store.jsx'
import { Link } from '../../lib/router.jsx'
import { CardHead } from '../ui/SectionCard.jsx'
import { IconAlert } from '../../lib/icons.jsx'
import { executionContext, weeklyAdaptation, proactiveNudge, dismissNudge } from '../../lib/execution.js'

/**
 * ExecutionPanels — Phase F #26/#27/#28.
 *
 * Three quiet surfaces: one contextual reading, one weekly planned-vs-actual
 * suggestion set, and at most one dismissible nudge. None is a modal and none
 * renders when its engine has nothing to say.
 *
 * Loaded with React.lazy by TodayScreen. execution.js composes contextualLens,
 * which was dead code before Phase F; reaching it from an eager screen pulled
 * its dependency subgraph into the initial bundle (232.9 -> 235.5 kB gz against
 * a 236 kB cap). Lazy-loading keeps the initial chunk where it was.
 */
export default function ExecutionPanels() {
  const { state } = useStore()
  const [nudgeGone, setNudgeGone] = useState(false)

  const now = useMemo(() => new Date(), [])
  const exec = useMemo(() => executionContext(state, { now }), [state, now])
  const adaptation = useMemo(() => weeklyAdaptation(state, { now }), [state, now])
  const nudge = useMemo(() => (nudgeGone ? null : proactiveNudge(state, { now })), [state, now, nudgeGone])

  if (!nudge && !exec.enough && !(adaptation.enough && adaptation.suggestions.length)) return null

  return (
    <>
      {/* #27 — one line, dismissible, only when an engine produced it. */}
      {nudge && (
        <section className="card pad nudge" data-tone={nudge.tone} aria-label="Suggestion">
          <p className="nudge-title"><IconAlert size={15} /> {nudge.title}</p>
          <p className="nudge-text">{nudge.text}</p>
          <div className="btn-row">
            {nudge.action === 'workload' && <Link className="btn sm" to="workload">Review workload</Link>}
            <button type="button" className="btn ghost sm" onClick={() => { dismissNudge(nudge.key); setNudgeGone(true) }}>
              Dismiss
            </button>
          </div>
        </section>
      )}

      {/* #26 — what the context says about right now. */}
      {exec.enough && (
        <section className="card pad exec-context" aria-label="Right now">
          <CardHead title="Right now"><span className="tiny muted">{exec.lens.reason}</span></CardHead>
          <p className="exec-name">{exec.name}</p>
          <p className="exec-detail">{exec.context}</p>
          <dl className="lab-evidence">
            <div className="lab-ev"><dt>Estimated</dt><dd>{exec.minutesLabel || 'Not enough data yet.'}</dd></div>
            <div className="lab-ev"><dt>Risk</dt><dd>{exec.risk || '—'}</dd></div>
            <div className="lab-ev">
              <dt>Deadline</dt>
              <dd>{exec.deadline ? String(exec.deadline).slice(0, 10) : 'None set'}</dd>
            </div>
          </dl>
        </section>
      )}

      {/* #28 — planned vs actual, from the real focus log. */}
      {adaptation.enough && adaptation.suggestions.length > 0 && (
        <section className="card pad weekly-adapt" aria-label="Weekly adaptation">
          <CardHead title="How your week actually went">
            <span className="tiny muted">{adaptation.sessions} sessions</span>
          </CardHead>
          <p className="card-blurb">{adaptation.summary}</p>
          <ul className="adapt-list">
            {adaptation.suggestions.map((sug) => (
              <li key={sug.id} data-tone={sug.tone}>
                <strong>{sug.title}</strong>
                <span>{sug.text}</span>
                <span className="tiny muted">
                  From {sug.samples} real sessions. Nothing changes unless you accept it.
                </span>
              </li>
            ))}
          </ul>
          <p className="tiny muted">{adaptation.reason}</p>
        </section>
      )}
    </>
  )
}
