/* Step 5A: Work entity presentation — ONE reusable row for Project,
   Assignment, Project Task and Milestone.

   Input shape is the `row` already produced by `workWorkspace()` in
   workViewModel.js. That adapter joins the store item, its kind,
   parent/milestone references, canonical status, and risk id. We do NOT
   add new intelligence here — we only present what the existing engines
   already compute.

   Props:
     row        - workWorkspace() row (kind + item + status + risk + parent + milestone + href)
     as         - element to render ('a' | 'button' | 'div' | 'article'); default 'a' when href exists
     onClick    - primary interaction (defaults to navigating to row.href)
     show       - object toggling which slots render:
                  kind?       (default true)
                  title?      (default true)
                  rel?        (default true — shows parent only when useful)
                  status?     (default true)
                  progress?   (default true)
                  deadline?   (default true)
                  effort?     (default false — only shown when asked)
                  risk?       (default true — but only when atRisk)
                  actions?    (default true)
     actions?   - override action nodes (otherwise renders a Complete + ⋯ when valid)
     onMore?    - called when the contextual "⋯" is pressed; if supplied shows ⋯
     className?
*/
import { forwardRef, lazy, Suspense, useState } from 'react'
import { Progress, Status } from '../primitives/index.js'
import { IconButton } from '../primitives/index.js'
import {
  IconProjects, IconAssignment, IconCheck, IconFlag, IconMore,
} from '../../lib/icons.jsx'
import { minutesLabel } from '../../lib/dates.js'

const ItemActionsSheet = lazy(() => import('../ui/ItemActionsSheet.jsx'))

const KIND_META = {
  project:       { label: 'Project',        Icon: IconProjects },
  assignment:    { label: 'Assignment',     Icon: IconAssignment },
  'project-task':{ label: 'Task',           Icon: IconCheck },
  milestone:     { label: 'Milestone',      Icon: IconFlag },
}

/* Map status/risk tones to the semantic tokens the primitives expect. */
const TONE_FOR = {
  completed: 'success',
  onTrack:   'success',
  atRisk:    'warning',
  urgent:    'danger',
  overdue:   'danger',
  noDeadline:'neutral',
  paused:    'neutral',
}
const RISK_LABEL = {
  OVERDUE:  'Overdue',
  CRITICAL: 'Due today',
  'AT RISK': 'At risk',
  'DUE SOON': 'Due soon',
  COMPLETED: 'Completed',
  SAFE:     '',
}
const RISK_TONE = {
  OVERDUE: 'bad',
  CRITICAL: 'bad',
  'AT RISK': 'warn',
  'DUE SOON': 'warn',
  COMPLETED: 'good',
  SAFE: 'neutral',
}

const WorkEntity = forwardRef(function WorkEntity({
  row,
  as,
  onClick,
  show: showProp,
  actions: actionsNode,
  onMore,
  dispatch,
  className = '',
  ...rest
}, ref) {
  const { kind, item, status, risk, parent, milestone, href, remainingMin } = row || {}
  const meta = KIND_META[kind] || KIND_META.project
  const show = {
    kind: true, title: true, rel: true, status: true, progress: true,
    deadline: true, effort: false, risk: true, actions: true,
    ...(showProp || {}),
  }
  const [sheetOpen, setSheetOpen] = useState(false)

  const Tag = as || (href ? 'a' : 'div')
  const anchorProps = Tag === 'a' ? { href: `#/${href}` } : {}
  const handleClick = (e) => { if (onClick) onClick(e) }

  const complete = status?.complete
  const pct = status?.pct ?? 0
  const progressTone = complete ? 'success'
    : (risk === 'OVERDUE' || risk === 'CRITICAL' || status?.id === 'overdue' || status?.id === 'urgent') ? 'danger'
    : (risk === 'AT RISK' || status?.id === 'atRisk') ? 'warning'
    : 'accent'

  const showRel = show.rel && (parent || milestone)
  const milestoneText = milestone ? milestone.name : ''

  // Deadline: prefer the canonical status.dueText ('Due today'/'Overdue'/…)
  const deadlineLabel = show.deadline && status?.dueText && !complete
    ? status.dueText
    : null

  // Risk: only show one concise attention signal when non-normal
  const riskLabel = show.risk && !complete && risk && RISK_LABEL[risk] && risk !== 'SAFE'
    ? RISK_LABEL[risk]
    : null
  const riskTone = RISK_TONE[risk] || 'neutral'

  // Status label (semantic). Skip when a risk label already conveys the
  // same state (e.g. "Overdue" + "Overdue" double-labelling).
  const statusLabel = show.status && !complete && status?.label
    && statusLabelNotRedundant(status.id, risk)
    ? status.label : null

  // Effort: opt-in; show e.g. "1h 30m remaining"
  const effortLabel = show.effort && remainingMin != null && !complete
    ? `${minutesLabel(Math.round(remainingMin))} left`
    : null

  // Complete action — only where the existing reducer supports it.
  const canComplete = (kind === 'assignment' || kind === 'project-task') && dispatch && !complete
  const canReopen   = (kind === 'assignment' || kind === 'project-task') && dispatch && complete

  const ariaLabel = `${meta.label}: ${item?.name}`

  return (
    <>
      <Tag
        ref={ref}
        className={['we', complete ? 'is-complete' : '', className].filter(Boolean).join(' ')}
        data-kind={kind}
        aria-label={ariaLabel}
        onClick={handleClick}
        {...anchorProps}
        {...rest}
      >
        <span className="we__lead" aria-hidden="true">
          {show.kind ? (
            <span className="we-kind" data-kind={kind}>
              <meta.Icon size={14}/>
            </span>
          ) : null}
        </span>

        <div className="we__body">
          {show.title && (
            <h3 className="we-title">{item?.name}</h3>
          )}

          {showRel && (
            <span className="we-rel">
              {parent ? (
                <span
                  role="link"
                  tabIndex={0}
                  className="we-rel__link"
                  data-href={`#/projects/${parent.id}`}
                  onClick={(e) => { e.stopPropagation(); window.location.hash = `/projects/${parent.id}` }}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); e.preventDefault(); window.location.hash = `/projects/${parent.id}` } }}
                >{parent.name}</span>
              ) : null}
              {parent && milestoneText ? <span className="we-rel__sep">·</span> : null}
              {milestoneText ? <span>{milestoneText}</span> : null}
              {!parent && !milestone && kind === 'milestone' ? <span>Milestone</span> : null}
            </span>
          )}

          <div className="we-meta" role="group" aria-label={`${item?.name} status`}>
            {statusLabel && (
              <span className="we-meta__item" data-tone={TONE_FOR[status.id] || 'neutral'}>
                <Status tone={TONE_FOR[status.id] || 'neutral'}>{statusLabel}</Status>
              </span>
            )}
        {deadlineLabel && (
          <span className="we-meta__item" data-tone={TONE_FOR[status.id] || 'neutral'}>
            {deadlineLabel}
          </span>
        )}
            {riskLabel && riskLabel !== statusLabel && (
              <span className="we-meta__item" data-tone={riskTone === 'bad' ? 'bad' : riskTone === 'warn' ? 'warn' : 'neutral'}>
                {riskLabel}
              </span>
            )}
            {effortLabel && (
              <span className="we-meta__item" data-tone="neutral">{effortLabel}</span>
            )}
          </div>

          {show.progress && pct != null && (
            <div className="we-progress">
              <Progress
                thin
                value={pct}
                tone={progressTone}
                label={`${item?.name}: ${pct}% complete`}
              />
              <span className="we-progress__pct tnum" aria-hidden="true">{pct}%</span>
            </div>
          )}
        </div>

        {show.actions && (
          <span className="we__actions">
            {actionsNode}
            {!actionsNode && canComplete && (
              <button
                type="button"
                className="btn sm we-complete"
                aria-label={`Mark ${item?.name} as complete`}
                onClick={(e) => {
                  e.preventDefault(); e.stopPropagation()
                  if (kind === 'assignment') dispatch({ type: 'SET_ASSIGNMENT_PROGRESS', id: item.id, pct: 100 })
                  if (kind === 'project-task') dispatch({ type: 'TOGGLE_TASK', projectId: item.projectId, milestoneId: item.milestoneId, taskId: item.id })
                }}
              >
                Complete
              </button>
            )}
            {!actionsNode && canReopen && (
              <button
                type="button"
                className="btn ghost sm we-complete"
                aria-label={`Mark ${item?.name} as not complete`}
                onClick={(e) => {
                  e.preventDefault(); e.stopPropagation()
                  if (kind === 'assignment') dispatch({ type: 'SET_ASSIGNMENT_PROGRESS', id: item.id, pct: Math.max(0, Math.min(99, Math.round((item.progress || 0) - 1))) })
                  if (kind === 'project-task') dispatch({ type: 'TOGGLE_TASK', projectId: item.projectId, milestoneId: item.milestoneId, taskId: item.id })
                }}
              >
                Undo
              </button>
            )}
            {!actionsNode && onMore && kind !== 'milestone' && (
              <IconButton
                className="we-more"
                label={`Actions for ${item?.name}`}
                aria-haspopup="dialog"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setSheetOpen(true) }}
              >
                <IconMore size={18} />
              </IconButton>
            )}
          </span>
        )}
      </Tag>
      {sheetOpen && (
        <Suspense fallback={null}>
          <ItemActionsSheet
            open
            onClose={() => setSheetOpen(false)}
            kind={kind}
            id={item.id}
          />
        </Suspense>
      )}
    </>
  )
})

function statusLabelNotRedundant(statusId, risk) {
  // If the risk label already says "Overdue" / "Due today" (CRITICAL), the
  // Status pill would be a duplicate. Suppress it to keep one clear signal.
  if (statusId === 'overdue' && risk === 'OVERDUE') return false
  if (statusId === 'urgent' && risk === 'CRITICAL') return false
  if (statusId === 'atRisk' && risk === 'AT RISK') return false
  if (statusId === 'onTrack') return false // "On track" is noise on every healthy row; omit by default.
  return true
}

export default WorkEntity
export { KIND_META }
