/* ============================================================
   PACE RIBBON + PRESSURE PLANE (V4, spec §11).

   Assignments speak in TIME. A plane states: how many days are
   left, where the pace line says you should be, where you are,
   and the gap between the two — one ribbon, instantly readable.
   Every number comes from `assignmentStatus` (the same engine the
   list cards use). No deadline → the plane refuses to render.
   ============================================================ */
import { Link } from '../../lib/router.jsx'
import { DepthCard } from '../spatial/Depth.jsx'
import { StatusPill } from './WorkKit.jsx'
import { shortDate, dayOf } from '../../lib/dates.js'

/** expected (pace) vs actual (progress) on one honest track. */
export function PaceRibbon({ status }) {
  const pct = Math.max(0, Math.min(100, status.pct || 0))
  const expected = status.elapsedPct
  const behind = status.behind
  return (
    <div className="pace-ribbon">
      <div
        className="pace-ribbon-track"
        role="img"
        aria-label={expected == null
          ? `Progress ${pct}%. No pace line without a start date.`
          : `Actual ${pct}%, expected by now ${expected}%. ${behind > 5 ? `Behind pace by ${Math.round(behind)} points.` : behind < -5 ? `Ahead of pace by ${Math.round(-behind)} points.` : 'On pace.'}`}
      >
        {expected != null && (
          <>
            <span className="exp" style={{ right: `${100 - Math.min(100, expected)}%` }} aria-hidden="true" />
            <span className="exp-tick" style={{ left: `${Math.min(100, expected)}%` }} aria-hidden="true" />
          </>
        )}
        <span className="act" style={{ width: `${pct}%` }} aria-hidden="true" />
      </div>
      <div className="pace-ribbon-legend">
        <span>Actual <b className="tnum">{pct}%</b></span>
        {expected != null && <span>Expected <b className="tnum">{expected}%</b></span>}
        {expected != null && Math.abs(behind) > 5 && (
          <b data-tone={behind > 0 ? 'bad' : 'good'} style={{ color: behind > 0 ? 'var(--bad)' : 'var(--good)' }}>
            {behind > 0 ? 'BEHIND PACE' : 'AHEAD OF PACE'}
          </b>
        )}
      </div>
    </div>
  )
}

/**
 * The TIME PRESSURE plane for one assignment.
 * Shows nothing unless there is a real deadline.
 */
export function PressurePlane({ row, index = 0 }) {
  const { assignment, status } = row
  if (!status.hasDeadline || status.complete) return null
  const daysLeft = status.daysLeft
  const dueDay = shortDate(dayOf(status.deadline))
  const big = daysLeft == null ? status.countdown || '—' : String(Math.max(0, daysLeft))
  const unit = daysLeft == null ? 'time left' : Math.max(0, daysLeft) === 1 ? 'day left' : 'days left'
  return (
    <DepthCard as="li" depth={(index % 3) + 2} max={4} className="press-plane" aria-label={`Pressure for ${assignment.name}`}>
      <div className="press-inner">
        <div className="press-top">
          <a className="press-name" href={`#/assignments/${assignment.id}`}>{assignment.name}</a>
          <StatusPill status={status} />
        </div>
        <div className="press-grid">
          <div className="press-days" data-tone={status.tone}>
            <span className="tnum">{big}</span> <small>{unit} · due {dueDay}</small>
          </div>
          <PaceRibbon status={status} />
        </div>
        <Link to={`assignments/${assignment.id}`} className="press-open tiny">
          Open brief <span aria-hidden="true">→</span>
        </Link>
      </div>
    </DepthCard>
  )
}

export default function PressureRow({ rows }) {
  const dated = rows.filter((r) => r.status.hasDeadline && !r.status.complete).slice(0, 3)
  if (!dated.length) return null
  return (
    <section className="press-band" aria-label="Deadline pressure">
      <p className="press-band-head">TIME PRESSURE</p>
      <ul className="press-list">
        {dated.map((r, i) => <PressurePlane key={r.assignment.id} row={r} index={i} />)}
      </ul>
    </section>
  )
}
