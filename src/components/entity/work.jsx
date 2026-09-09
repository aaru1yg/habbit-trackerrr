/* ============================================================
   WORK ENTITY — WorkItem + WorkStatus (V5).

   One work DNA: status pill (engine label + tone, always with
   text), name, honest meta (due/effort/risk), progress meter,
   and the same act-without-navigating behaviors (Focus, Complete,
   View, ⋯ actions). Math stays in lib/work.js.
   ============================================================ */
import { lazy, Suspense, useState } from 'react'
import { useStore } from '../../store.jsx'
import { useWorkUI } from '../work/WorkUIProvider.jsx'
import { LoadingBlock } from '../ui/feedback.jsx'
import { itemActions } from '../../lib/commandActions.js'
import { minutesLabel, prettyDateTime } from '../../lib/dates.js'
import { projectContext } from '../work/workViewModel.js'
import { Badge, StatusPill } from '../ui/meta.jsx'
import { Button } from '../ui/controls.jsx'
import WorkFocus from '../work/WorkFocus.jsx'

const ItemActionsSheet = lazy(() => import('../ui/ItemActionsSheet.jsx'))

const TYPES = {
  assignment: 'Assignment',
  project: 'Project',
  'project-task': 'Project task',
  milestone: 'Milestone',
}

export function WorkStatus({ status }) {
  return <StatusPill tone={status.tone || 'neutral'}>{status.label || 'Work'}</StatusPill>
}

/**
 * WorkItem — the universal work row. row: workViewModel row
 * ({ key, kind, item, status, href, risk, remainingMin, ... }).
 */
export function WorkItem({ row, now }) {
  const { dispatch } = useStore()
  const work = useWorkUI()
  const [actionsOpen, setActionsOpen] = useState(false)
  const [focusOpen, setFocusOpen] = useState(false)
  const { item, kind, status } = row
  const actions = itemActions(kind, item)
  const complete = actions.find((a) => a.id === 'complete')
  const context = kind === 'project' ? projectContext(row, now) : null

  const handleAction = (action) => {
    if (action.focus) { setFocusOpen(true); return true }
    if ((action.form || action.reschedule) && kind === 'assignment') { work.editAssignment(item); return true }
    if (action.form === 'project') { work.editProject(item); return true }
    return false
  }

  return (
    <article
      className={`vwork${status.complete ? ' is-complete' : ''}`}
      aria-label={`${TYPES[kind]}: ${item.name}`}
      data-kind={kind}
    >
      <div className="vwork-main">
        <div className="vwork-title-row">
          <Badge tone="neutral">{TYPES[kind]}</Badge>
          <a className="vwork-title" href={`#/${row.href}`}>{item.name}</a>
        </div>
        {row.parent && (
          <a className="vwork-parent" href={`#/projects/${row.parent.id}`}>
            {row.parent.name}{row.milestone ? ` · ${row.milestone.name}` : ''}
          </a>
        )}
        <div className="vwork-meta">
          <WorkStatus status={status} />
          <span>{row.day ? `Due ${prettyDateTime(item.deadline)}` : 'No deadline'}</span>
          <span>{row.remainingMin == null ? 'Effort not estimated' : `${minutesLabel(Math.round(row.remainingMin))} remaining`}</span>
          <span className="vwork-risk" data-risk={row.risk}>{row.risk === 'SAFE' ? 'No deadline risk' : row.risk}</span>
        </div>
        {context && <p className="tiny muted">{context.progress.done}/{context.progress.total} tasks · Projected completion: {context.forecast.projectedCompletion ? prettyDateTime(context.forecast.projectedCompletion) : 'Not enough history'}</p>}
      </div>

      <div className="vwork-progress">
        <span className="vwork-pct tnum">{status.pct}% complete</span>
        <span className="meter" role="img" aria-label={`${item.name}: ${status.pct}% complete`}>
          <i style={{ width: `${Math.max(0, Math.min(100, status.pct))}%` }} />
        </span>
      </div>

      <div className="vwork-actions">
        {!status.complete && ['assignment', 'project-task'].includes(kind) && (
          <Button variant="subtle" size="sm" aria-label={`Focus on ${item.name}`} onClick={() => setFocusOpen(true)}>
            Focus
          </Button>
        )}
        {!status.complete && complete && (
          <Button variant="ghost" size="sm" aria-label={`Complete ${item.name}`} onClick={() => dispatch(complete.dispatch)}>
            Complete
          </Button>
        )}
        <a className="vbtn" data-variant="ghost" data-size="sm" href={`#/${row.href}`} aria-label={`View ${item.name}`}>
          <span className="vbtn-label">View</span>
        </a>
        {kind !== 'milestone' && (
          <Button variant="ghost" size="sm" aria-label={`Actions for ${item.name}`} aria-haspopup="dialog" onClick={() => setActionsOpen(true)}>
            ⋯
          </Button>
        )}
      </div>

      {actionsOpen && (
        <Suspense fallback={<LoadingBlock label="Loading actions" />}>
          <ItemActionsSheet open onClose={() => setActionsOpen(false)} kind={kind} id={item.id} onAction={handleAction} />
        </Suspense>
      )}
      {focusOpen && <WorkFocus item={item} onClose={() => setFocusOpen(false)} />}
    </article>
  )
}
