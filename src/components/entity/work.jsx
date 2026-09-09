/* ============================================================
   WORK ENTITY — WorkItem / ProjectCard / AssignmentCard /
   MilestoneRow + WorkStatus (V5).

   One work DNA: status pill (engine label + tone, always with
   text), name, honest meta (due/effort/risk), progress meter,
   and the same act-without-navigating behaviors (Focus, Complete,
   View, ⋯ actions). Math stays in lib/work.js.
   ============================================================ */
import { lazy, Suspense, useState } from 'react'
import { useStore } from '../../store.jsx'
import { useWorkUI } from '../work/WorkUIProvider.jsx'
import { itemActions } from '../../lib/commandActions.js'
import { minutesLabel } from '../../lib/dates.js'
import { allTasks } from '../../lib/work.js'
import { accentVars } from '../../lib/accent.js'
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
export function WorkItem({ row }) {
  const { dispatch } = useStore()
  const work = useWorkUI()
  const [actionsOpen, setActionsOpen] = useState(false)
  const [focusOpen, setFocusOpen] = useState(false)
  const { item, kind, status } = row
  const actions = itemActions(kind, item)
  const complete = actions.find((a) => a.id === 'complete')

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
          <span>{row.day ? `Due ${row.day}` : 'No deadline'}</span>
          <span>{row.remainingMin == null ? 'Effort not estimated' : `${minutesLabel(Math.round(row.remainingMin))} left`}</span>
        </div>
      </div>

      <div className="vwork-progress">
        <span className="vwork-pct tnum">{status.pct}%</span>
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
        <Suspense fallback={<p role="status">Loading actions…</p>}>
          <ItemActionsSheet open onClose={() => setActionsOpen(false)} kind={kind} id={item.id} onAction={handleAction} />
        </Suspense>
      )}
      {focusOpen && <WorkFocus item={item} onClose={() => setFocusOpen(false)} />}
    </article>
  )
}

/** ProjectCard — gallery/list card with accent scope. */
export function ProjectCard({ project, status }) {
  const tasks = allTasks(project)
  const done = tasks.filter((t) => t.done).length
  return (
    <article className="vproj" style={accentVars(project.accent)} aria-label={`Project: ${project.name}`}>
      <div className="vproj-top">
        <a className="vproj-name" href={`#/projects/${project.id}`}>{project.name}</a>
        <WorkStatus status={status} />
      </div>
      <div className="vproj-prog">
        <span className="tnum">{status.pct}%</span>
        <span className="meter" role="img" aria-label={`${project.name}: ${status.pct}% complete`}>
          <i style={{ width: `${Math.max(0, Math.min(100, status.pct))}%` }} />
        </span>
      </div>
      <p className="vproj-meta">
        {tasks.length ? `${done} of ${tasks.length} tasks` : 'No tasks yet'}
        {status.dueText ? ` · ${status.dueText}` : ''}
      </p>
    </article>
  )
}

/** AssignmentCard — deliverable card with accent scope. */
export function AssignmentCard({ assignment, status }) {
  const subs = assignment.subtasks || []
  const done = subs.filter((s) => s.done).length
  const meta = subs.length
    ? `${done} of ${subs.length} subtasks${status.dueText ? ` · ${status.dueText}` : ''}`
    : (status.dueText || 'No deadline')
  return (
    <article className="vasgn" style={accentVars(assignment.accent)} aria-label={`Assignment: ${assignment.name}`}>
      <div className="vasgn-top">
        <a className="vasgn-name" href={`#/assignments/${assignment.id}`}>{assignment.name}</a>
        <WorkStatus status={status} />
      </div>
      {assignment.subject && <p className="vasgn-subject">{assignment.subject}</p>}
      <div className="vasgn-prog">
        <span className="tnum">{status.pct}%</span>
        <span className="meter" role="img" aria-label={`${assignment.name}: ${status.pct}% complete`}>
          <i style={{ width: `${Math.max(0, Math.min(100, status.pct))}%` }} />
        </span>
      </div>
      <p className="vasgn-meta">{meta}</p>
    </article>
  )
}

/** MilestoneRow — one milestone with its tasks summarized. */
export function MilestoneRow({ milestone, onToggle, href }) {
  const tasks = milestone.tasks || []
  const done = tasks.filter((t) => t.done).length
  return (
    <div className={`vms${milestone.done ? ' is-done' : ''}`}>
      <button
        type="button"
        role="checkbox"
        aria-checked={!!milestone.done}
        className="vms-check"
        aria-label={`${milestone.done ? 'Reopen' : 'Complete'} milestone ${milestone.name}`}
        onClick={onToggle}
      >
        <span className="vms-box" aria-hidden="true">{milestone.done ? '✓' : ''}</span>
      </button>
      <div className="vms-body">
        {href ? <a className="vms-name" href={href}>{milestone.name}</a> : <span className="vms-name">{milestone.name}</span>}
        <span className="vms-meta">
          {tasks.length ? `${done} of ${tasks.length} tasks` : 'No tasks yet'}
          {milestone.due ? ` · due ${milestone.due}` : ''}
        </span>
      </div>
    </div>
  )
}
