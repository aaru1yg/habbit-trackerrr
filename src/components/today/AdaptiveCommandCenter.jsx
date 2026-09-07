import Reveal from '../motion/Reveal.jsx'
import { CardHead } from '../ui/SectionCard.jsx'
import { Link } from '../../lib/router.jsx'

const fmt = (min) => min == null ? 'Not enough data yet.' : min < 60 ? `${Math.round(min)} min` : `${(min / 60).toFixed(1)}h`
const hrefFor = (item) => item.kind === 'assignment' ? `assignments/${item.id}` : item.kind === 'project' || item.kind === 'project-task' ? `projects/${item.projectId || item.id}` : item.kind === 'goal-milestone' ? `goals/${item.goalId}` : `habits/${item.id}`

function Risk({ risk }) {
  const id = typeof risk === 'string' ? risk : risk?.id
  if (!id) return <span className="adaptive-risk">Not enough data yet.</span>
  return <span className="adaptive-risk" data-risk={id}>{id}</span>
}

export default function AdaptiveCommandCenter({ data, onComplete }) {
  const { next, priorities, workload } = data
  if (!next && !priorities.length) return null
  const selected = next?.item
  return <>
    {next && <Reveal as="section" variant="up" className="card pad adaptive-next sp-depth lane-left" aria-label="Next best action">
      <CardHead title="Next best action"><Risk risk={next} /></CardHead>
      <div className="adaptive-next-main">
        <div><p className="eyebrow">Consider</p><h2>{selected.label || selected.name}</h2><p className="adaptive-reason">{next.reason}</p></div>
        <div className="adaptive-meta"><span>Estimated: <strong>{fmt(next.estimatedMin)}</strong></span><span>Deadline: <strong>{next.deadline ? new Date(next.deadline).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'None set'}</strong></span></div>
      </div>
      <div className="adaptive-actions"><button className="btn primary sm" onClick={() => onComplete(selected)}>Complete</button><Link className="btn ghost sm" to={hrefFor(selected)}>View</Link></div>
      <details className="adaptive-why"><summary>Why this is prioritized</summary><div className="adaptive-signals"><span>Deadline: {selected.deadline ? new Date(selected.deadline).toLocaleDateString() : 'Not set'}</span><span>Progress: {next.progress == null ? 'Not enough data yet.' : `${next.progress}%`}</span><span>Remaining: {fmt(next.remainingMin)}</span><span>Priority: {selected.priority || 'Not set'}</span><span>Risk: <Risk risk={next.risk} /></span></div></details>
    </Reveal>}
    {priorities.length > 0 && <Reveal as="section" variant="left" className="card pad adaptive-priorities sp-depth lane-right"><CardHead title="Today’s priorities"><span className="tiny muted">{priorities.length} ranked</span></CardHead><ol className="adaptive-list">{priorities.map((entry, i) => <li key={`${entry.item.kind}-${entry.item.id}`}><span className="adaptive-index">{i + 1}</span><div className="adaptive-item"><Link to={hrefFor(entry.item)}><strong>{entry.item.label || entry.item.name}</strong></Link><span>{entry.reasons.length ? entry.reasons.join(' · ') : 'Not enough data yet.'}</span></div><Risk risk={entry.risk} /></li>)}</ol></Reveal>}
    <Reveal as="section" variant="depth" className="card pad adaptive-capacity"><CardHead title="Today’s capacity"><span className="tiny muted">workload context</span></CardHead><div className="adaptive-capacity-grid"><span>Available<strong>{fmt(workload.availableMin)}</strong></span><span>Committed<strong>{workload.committedMin ? fmt(workload.committedMin) : 'Not enough data yet.'}</strong></span><span>Remaining<strong>{workload.remainingMin == null ? 'Not enough data yet.' : fmt(workload.remainingMin)}</strong></span></div>{workload.overloaded && <p className="pace-note" data-tone="warn">{workload.reason} Review: {priorities.map((p) => p.item.label || p.item.name).join(', ')}.</p>}</Reveal>
  </>
}
