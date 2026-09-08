import { lazy, Suspense, useState } from 'react'
import { useStore } from '../../store.jsx'
import { useWorkUI } from './WorkUIProvider.jsx'
import { itemActions } from '../../lib/commandActions.js'
import { minutesLabel, prettyDateTime } from '../../lib/dates.js'
import { projectContext } from './workViewModel.js'
import { Meter } from './WorkKit.jsx'
import WorkFocus from './WorkFocus.jsx'
const ItemActionsSheet = lazy(() => import('../ui/ItemActionsSheet.jsx'))
const TYPES = { assignment: 'Assignment', project: 'Project', 'project-task': 'Project task', milestone: 'Milestone' }

export default function UniversalWorkRow({ row, now }) {
  const { dispatch } = useStore()
  const work = useWorkUI()
  const [actionsOpen, setActionsOpen] = useState(false)
  const [focusOpen, setFocusOpen] = useState(false)
  const { item, kind, status } = row
  const actions = itemActions(kind, item)
  const complete = actions.find(a => a.id === 'complete')
  const context = kind === 'project' ? projectContext(row, now) : null
  const handleAction = action => {
    if (action.focus) { setFocusOpen(true); return true }
    if ((action.form || action.reschedule) && kind === 'assignment') { work.editAssignment(item); return true }
    if (action.form === 'project') { work.editProject(item); return true }
    return false
  }
  return (
    <article className={`workspace-row${status.complete ? ' is-complete' : ''}`} aria-label={`${TYPES[kind]}: ${item.name}`} data-kind={kind}>
      <div className="workspace-row-main">
        <span className="workspace-type">{TYPES[kind]}</span>
        <a className="workspace-row-title" href={`#/${row.href}`}>{item.name}</a>
        {row.parent && <a className="workspace-parent" href={`#/projects/${row.parent.id}`}>{row.parent.name}{row.milestone ? ` · ${row.milestone.name}` : ''}</a>}
        <div className="workspace-meta">
          <span>{row.day ? `Due ${prettyDateTime(item.deadline)}` : 'No deadline'}</span>
          <span>{row.remainingMin == null ? 'Effort not estimated' : `${minutesLabel(Math.round(row.remainingMin))} remaining`}</span>
          <span className="workspace-risk" data-risk={row.risk}>{row.risk === 'SAFE' ? 'No deadline risk' : row.risk}</span>
        </div>
        {context && <p className="tiny muted">{context.progress.done}/{context.progress.total} tasks · Projected completion: {context.forecast.projectedCompletion ? prettyDateTime(context.forecast.projectedCompletion) : 'Not enough history'}</p>}
      </div>
      <div className="workspace-progress"><span>{status.pct}% complete</span><Meter pct={status.pct} thin label={`${item.name}: ${status.pct}% complete`} /></div>
      <div className="workspace-row-actions">
        {!status.complete && ['assignment', 'project-task'].includes(kind) && <button className="btn sm" aria-label={`Focus on ${item.name}`} onClick={() => setFocusOpen(true)}>Focus</button>}
        {!status.complete && complete && <button className="btn ghost sm" aria-label={`Complete ${item.name}`} onClick={() => dispatch(complete.dispatch)}>Complete</button>}
        <a className="btn ghost sm" href={`#/${row.href}`} aria-label={`View ${item.name}`}>View</a>
        {kind !== 'milestone' && <button className="btn ghost sm" aria-label={`Actions for ${item.name}`} aria-haspopup="dialog" onClick={() => setActionsOpen(true)}>⋯</button>}
      </div>
      {actionsOpen && <Suspense fallback={<p role="status">Loading actions…</p>}><ItemActionsSheet open onClose={() => setActionsOpen(false)} kind={kind} id={item.id} onAction={handleAction} /></Suspense>}
      {focusOpen && <WorkFocus item={item} onClose={() => setFocusOpen(false)} />}
    </article>
  )
}
