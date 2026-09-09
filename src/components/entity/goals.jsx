/* ============================================================
   GOAL ENTITY — GoalHealth / GoalProgress / GoalCard (V5).

   Every goal reads WHAT → PROGRESS → HEALTH → NEXT MILESTONE, in
   lists, on Today and in detail headers alike. Health mapping stays
   in goals/health.js; progress math stays in lib/goals.js.
   ============================================================ */
import { goalProgress, nextMilestone } from '../../lib/goals.js'
import { healthBadge } from '../goals/health.js'
import { accentVars } from '../../lib/accent.js'
import { StatusPill } from '../ui/meta.jsx'
import { Link } from '../../lib/router.jsx'

export function GoalHealth({ state, goal, now }) {
  const h = healthBadge(state, goal, { now })
  return <StatusPill tone={h.tone}>{h.text}</StatusPill>
}

export function GoalProgress({ pct, detail, label }) {
  return (
    <div className="vgoal-prog">
      <div className="vgoal-prog-top">
        <span className="vgoal-pct tnum">{pct}%</span>
        {detail && <span className="vgoal-detail">{detail}</span>}
      </div>
      <span className="meter" role="img" aria-label={label || `${pct} percent complete`}>
        <i style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
      </span>
    </div>
  )
}

/**
 * GoalCard — list-first goal composition. state/now flow in; every
 * number comes from the engines.
 */
export function GoalCard({ state, goal, now }) {
  const prog = goalProgress(state, goal)
  const nm = nextMilestone(goal)
  return (
    <article className="vgoal" style={accentVars(goal.accent)}>
      <div className="vgoal-top">
        <Link to={`goals/${goal.id}`} className="vgoal-name">{goal.title}</Link>
        <GoalHealth state={state} goal={goal} now={now} />
      </div>
      <GoalProgress pct={prog.pct} detail={prog.detail} label={`${goal.title}: ${prog.pct} percent complete`} />
      {nm && prog.pct < 100 && (
        <p className="vgoal-next">
          <span className="vgoal-next-k">Next</span> {nm.name}
        </p>
      )}
    </article>
  )
}
