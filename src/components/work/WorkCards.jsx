/* ============================================================
   WORK CARDS — deliberately NOT the same card twice.

   ProjectCard    leads with progress + milestone + deadline.
   AssignmentCard leads with the countdown, then progress.
   WorkRow        is the compact form used inside Today, Calendar
                  and the deadline timeline.
   ============================================================ */
import { useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { StatusPill, KindTag, Meter, DeadlineHero, CountdownChip, QuickProgress, MilestoneStepper } from './WorkKit.jsx'
import { useWorkUI } from './WorkUIProvider.jsx'
import {
  projectStatus, assignmentStatus, projectProgress, assignmentProgress, milestoneTrack,
} from '../../lib/work.js'
import { shortDate, prettyDateTime, minutesLabel, dayOf } from '../../lib/dates.js'
import { IconPencil, IconTrash, IconChevronRight, IconLink, IconClock, IconLayers } from '../../lib/icons.jsx'

const PriorityChip = ({ priority }) => {
  if (priority === 'high') return <span className="chip tag-bad" style={{ minHeight: 22 }}>High priority</span>
  if (priority === 'low') return <span className="chip" style={{ minHeight: 22 }}>Low priority</span>
  return null
}

const deadlineText = (deadline) =>
  !deadline ? null : String(deadline).length > 10 ? prettyDateTime(deadline) : shortDate(dayOf(deadline))

/* ------------------------------------------------------------
   PROJECT CARD
   ------------------------------------------------------------ */
export function ProjectCard({ project, now = new Date(), showStepper = true }) {
  const work = useWorkUI()
  const status = projectStatus(project, now)
  const progress = projectProgress(project)
  const track = milestoneTrack(project)
  const nextMilestone = track.find((m) => !m.reached) || null
  const linked = (project.linkedHabitIds || []).length

  return (
    <article className={`work-card project-card${status.complete ? ' is-done' : ''}`} data-tone={status.tone} aria-label={`Project ${project.name}`}>
      <div className="work-top">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="wrap-gap" style={{ gap: 6, marginBottom: 6 }}>
            <KindTag kind="project">Project</KindTag>
            <StatusPill status={status} />
            <PriorityChip priority={project.priority} />
          </div>
          <a className="work-title" href={`#/projects/${project.id}`} style={{ color: 'inherit', textDecoration: 'none', display: 'block' }}>
            {project.name}
          </a>
          <div className="work-sub">
            {progress.total > 0
              ? <span>{progress.done} / {progress.total} tasks</span>
              : progress.mode === 'manual' || progress.mode === 'legacy'
                ? <span>Manual progress</span>
                : <span>No tasks yet</span>}
            {nextMilestone && <span>Next: {nextMilestone.name}</span>}
            {project.category && project.category !== 'General' && <span>{project.category}</span>}
          </div>
        </div>
        <div style={{ flex: 'none', textAlign: 'right' }}>
          <div className="meter-pct" style={{ fontSize: '1.5rem', lineHeight: 1 }}>{status.pct}%</div>
          <div className="tiny muted" style={{ marginTop: 4 }}>
            {status.complete ? 'Done' : status.hasDeadline ? `${status.daysLeft ?? 0}d left` : 'No deadline'}
          </div>
        </div>
      </div>

      <div className="work-body">
        <Meter pct={status.pct} tone={status.tone} pace={status.elapsedPct}
          label={`${status.pct}% complete${status.elapsedPct != null ? `, pace marker at ${status.elapsedPct}%` : ''}`} />
      </div>
      <div className="project-facts" aria-label="Project facts">
        <div className="work-fact">
          <span className="work-fact-label">Deadline</span>
          <strong className="work-fact-value">{status.hasDeadline ? deadlineText(project.deadline) : '—'}</strong>
          <span className="work-fact-note">{status.hasDeadline ? 'target date' : 'No deadline'}</span>
        </div>
        <div className="work-fact">
          <span className="work-fact-label">Days left</span>
          <strong className="work-fact-value">{status.hasDeadline ? (status.complete ? 'Done' : `${Math.max(0, status.daysLeft ?? 0)}d`) : '—'}</strong>
          <span className="work-fact-note">{status.hasDeadline && status.passed ? 'overdue' : 'on the clock'}</span>
        </div>
        <div className="work-fact">
          <span className="work-fact-label">Tasks</span>
          <strong className="work-fact-value">{progress.total ? `${progress.done}/${progress.total}` : '—'}</strong>
          <span className="work-fact-note">{progress.total ? 'complete' : 'add tasks'}</span>
        </div>
        <div className="work-fact">
          <span className="work-fact-label">Health</span>
          <strong className="work-fact-value">{status.label}</strong>
          <span className="work-fact-note">pace status</span>
        </div>
      </div>

      {showStepper && track.length > 1 && (
        <div style={{ marginTop: 14 }}>
          <MilestoneStepper track={track} pct={status.pct} />
        </div>
      )}

      <div className="work-foot">
        {status.hasDeadline && <CountdownChip status={status} />}
        {!status.hasDeadline && project.startDate && (
          <span className="count-chip">Started {shortDate(project.startDate)}</span>
        )}
        {linked > 0 && (
          <span className="count-chip"><IconLink size={12} /> {linked} habit{linked === 1 ? '' : 's'}</span>
        )}
        {Number(project.estimateMin) > 0 && (
          <span className="count-chip"><IconClock size={12} /> ~{minutesLabel(project.estimateMin)}</span>
        )}
        <span style={{ flex: 1 }} />
        <button className="btn ghost icon" aria-label={`Edit ${project.name}`} onClick={() => work.editProject(project)}>
          <IconPencil size={17} />
        </button>
        <button className="btn ghost icon" style={{ color: 'var(--bad)' }} aria-label={`Delete ${project.name}`} onClick={() => work.deleteProject(project)}>
          <IconTrash size={17} />
        </button>
        <a className="btn ghost icon" href={`#/projects/${project.id}`} aria-label={`Open ${project.name}`}>
          <IconChevronRight size={18} />
        </a>
      </div>
    </article>
  )
}

/* ------------------------------------------------------------
   ASSIGNMENT CARD — deadline first, progress second, urgency loud
   ------------------------------------------------------------ */
export function AssignmentCard({ assignment, now = new Date() }) {
  const work = useWorkUI()
  const reduced = useReducedMotion()
  const [openProgress, setOpenProgress] = useState(false)
  const status = assignmentStatus(assignment, now)
  const progress = assignmentProgress(assignment)
  const subs = assignment.subtasks || []
  const subsDone = subs.filter((s) => s.done).length

  return (
    <article className={`work-card assignment-card${status.complete ? ' is-done' : ''}`} data-tone={status.tone} aria-label={`Assignment ${assignment.name}`}>
      <div className="work-top">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="wrap-gap" style={{ gap: 6, marginBottom: 6 }}>
            <KindTag kind="assignment">Assignment</KindTag>
            <StatusPill status={status} />
            <PriorityChip priority={assignment.priority} />
          </div>
          <a className="work-title" href={`#/assignments/${assignment.id}`} style={{ color: 'inherit', textDecoration: 'none', display: 'block' }}>
            {assignment.name}
          </a>
          <div className="work-sub">
            {assignment.subject && <span>{assignment.subject}</span>}
            {status.hasDeadline && <span>{deadlineText(assignment.deadline)}</span>}
          </div>
          <div style={{ marginTop: 10 }}>
            <DeadlineHero status={status} />
          </div>
        </div>
        <div style={{ flex: 'none', textAlign: 'right' }}>
          <div className="meter-pct" style={{ fontSize: '1.5rem', lineHeight: 1 }}>{status.pct}%</div>
          <button
            className="btn ghost sm"
            style={{ marginTop: 6 }}
            aria-expanded={openProgress}
            aria-controls={`ap-${assignment.id}`}
            onClick={() => setOpenProgress((o) => !o)}
          >
            {openProgress ? 'Close' : 'Update'}
          </button>
        </div>
      </div>

      <div className="work-body">
        <Meter pct={status.pct} tone={status.tone} pace={status.elapsedPct}
          label={`${status.pct}% complete${status.elapsedPct != null ? `, pace marker at ${status.elapsedPct}%` : ''}`} />
        <div className="assignment-facts" aria-label="Assignment facts">
          <div className="work-fact"><span className="work-fact-label">Progress</span><strong className="work-fact-value">{status.pct}%</strong><span className="work-fact-note">complete</span></div>
          <div className="work-fact"><span className="work-fact-label">Due</span><strong className="work-fact-value">{status.hasDeadline ? (status.passed ? 'Past due' : status.dueText) : '—'}</strong><span className="work-fact-note">{status.hasDeadline ? deadlineText(assignment.deadline) : 'No deadline'}</span></div>
          <div className="work-fact"><span className="work-fact-label">Time left</span><strong className="work-fact-value">{status.hasDeadline && !status.complete ? (status.hoursLeft < 48 ? `${Math.max(0, Math.round(status.hoursLeft))}h` : `${Math.max(0, status.daysLeft ?? 0)}d`) : status.complete ? 'Done' : '—'}</strong><span className="work-fact-note">countdown</span></div>
          <div className="work-fact"><span className="work-fact-label">Status</span><strong className="work-fact-value">{status.label}</strong><span className="work-fact-note">urgency</span></div>
        </div>
        <AnimatePresence initial={false}>
          {openProgress && (
            <motion.div
              id={`ap-${assignment.id}`}
              key="quick"
              initial={reduced ? false : { height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={reduced ? undefined : { height: 0, opacity: 0 }}
              transition={{ duration: reduced ? 0 : 0.28, ease: [0.22, 1, 0.36, 1] }}
              style={{ overflow: 'hidden' }}
            >
              <div style={{ paddingTop: 14 }}>
                <QuickProgress
                  value={progress.mode === 'subtasks' ? progress.pct : assignment.progress}
                  onChange={(pct) => work.setAssignmentProgress(assignment, pct)}
                  label={progress.mode === 'subtasks' ? 'Progress (from subtasks)' : 'Progress'}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="work-foot">
        {subs.length > 0 && (
          <span className="count-chip"><IconLayers size={12} /> {subsDone}/{subs.length} subtasks</span>
        )}
        {progress.mode === 'subtasks' && <span className="count-chip">Synced with subtasks</span>}
        {Number(assignment.estimateMin) > 0 && (
          <span className="count-chip"><IconClock size={12} /> ~{minutesLabel(assignment.estimateMin)}</span>
        )}
        {assignment.projectId && <span className="count-chip"><IconLink size={12} /> In a project</span>}
        <span style={{ flex: 1 }} />
        <button className="btn ghost icon" aria-label={`Edit ${assignment.name}`} onClick={() => work.editAssignment(assignment)}>
          <IconPencil size={17} />
        </button>
        <button className="btn ghost icon" style={{ color: 'var(--bad)' }} aria-label={`Delete ${assignment.name}`} onClick={() => work.deleteAssignment(assignment)}>
          <IconTrash size={17} />
        </button>
        <a className="btn ghost icon" href={`#/assignments/${assignment.id}`} aria-label={`Open ${assignment.name}`}>
          <IconChevronRight size={18} />
        </a>
      </div>
    </article>
  )
}

/* ------------------------------------------------------------
   WORK ROW — compact, for Today's priority layer, calendar and
   the deadline timeline. Still leads with what matters most for
   that entity type.
   ------------------------------------------------------------ */
export function WorkRow({ kind, item, status, progressPct, onOpen, right }) {
  const href = kind === 'project' ? `#/projects/${item.id}` : `#/assignments/${item.id}`
  return (
    <a className="tl-item" href={href} onClick={onOpen} style={{ textDecoration: 'none', color: 'inherit' }}>
      <span className={`kind-tag ${kind}`} aria-hidden="true" style={{ flex: 'none', marginTop: 2 }} />
      <span className="tl-main">
        <span className="tl-name">{item.name}</span>
        <span className="tl-meta">
          <StatusPill status={status} />
          {kind === 'assignment'
            ? <span className="tiny muted tnum">{status.dueText}</span>
            : <span className="tiny muted tnum">{status.hasDeadline ? status.dueText : 'No deadline'}</span>}
          {right}
        </span>
      </span>
      <span className="tl-meter">
        <Meter pct={progressPct} tone={status.tone} thin label={`${progressPct}% complete`} />
        <span className="tiny tnum" style={{ display: 'block', textAlign: 'right', marginTop: 4, color: 'var(--text-2)', fontWeight: 700 }}>{progressPct}%</span>
      </span>
    </a>
  )
}

export const workStatusOf = (kind, item, now) => (kind === 'project' ? projectStatus(item, now) : assignmentStatus(item, now))
export const workProgressOf = (kind, item) => (kind === 'project' ? projectProgress(item).pct : assignmentProgress(item).pct)
