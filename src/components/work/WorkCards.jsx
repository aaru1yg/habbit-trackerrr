/* ============================================================
   WORK CARDS (FINAL 2B)
   ProjectCard, AssignmentCard and WorkRow now share the WorkEntity
   visual language (.we / .we-card family in WorkEntity.css). No new
   abstractions, no new computation — every value still comes from
   projectStatus/assignmentStatus/milestoneTrack/etc. as before.

   Gallery view cards are independent (they intentionally look like
   a gallery, not a list) but their class is renamed from the legacy
   "project-card" (which collided with the card style) to "gal-card".
   ============================================================ */
import { useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { StatusPill, KindTag, Meter, DeadlineHero, CountdownChip, QuickProgress, MilestoneStepper } from './WorkKit.jsx'
import DeadlinePressure from './DeadlinePressure.jsx'
import { useWorkUI } from './WorkUIProvider.jsx'
import {
  projectStatus, assignmentStatus, projectProgress, assignmentProgress, milestoneTrack,
  assignmentPressure, projectPhase, phaseTone, PROJECT_PHASES,
} from '../../lib/work.js'
import { shortDate, prettyDateTime, minutesLabel, dayOf } from '../../lib/dates.js'
import { IconPencil, IconTrash, IconChevronRight, IconLink, IconClock, IconLayers, IconProjects, IconAssignment } from '../../lib/icons.jsx'

const PriorityChip = ({ priority }) => {
  if (priority === 'high') return <span className="chip tag-bad" style={{ minHeight: 22 }}>High priority</span>
  if (priority === 'low') return <span className="chip" style={{ minHeight: 22 }}>Low priority</span>
  return null
}

const deadlineText = (deadline) =>
  !deadline ? null : String(deadline).length > 10 ? prettyDateTime(deadline) : shortDate(dayOf(deadline))

/* Canonical kind/action icons for the card lead (shared with WorkEntity) */
const KindIcon = ({ kind }) => {
  const Icon = kind === 'assignment' ? IconAssignment : IconProjects
  return <Icon size={14} />
}

/* ------------------------------------------------------------
   PROJECT CARD → .we-card
   ------------------------------------------------------------ */
export function ProjectCard({ project, now = new Date(), showStepper = true }) {
  const work = useWorkUI()
  const status = projectStatus(project, now)
  const progress = projectProgress(project)
  const track = milestoneTrack(project)
  const nextMilestone = track.find((m) => !m.reached) || null
  const linked = (project.linkedHabitIds || []).length

  return (
    <article className={`we-card${status.complete ? ' is-done' : ''}`} data-kind="project" data-tone={status.tone} aria-label={`Project ${project.name}`}>
      <div className="wec-head">
        <span className="wec-lead" aria-hidden="true">
          <span className="wec-kind" data-kind="project"><KindIcon kind="project" /></span>
        </span>
        <div className="wec-main" style={{ flex: 1, minWidth: 0 }}>
          <div className="wec-chips">
            <KindTag kind="project">Project</KindTag>
            <span className="status-pill" data-tone={phaseTone(projectPhase(project, now))}>
              {PROJECT_PHASES.find((ph) => ph.id === projectPhase(project, now))?.label}
            </span>
            <PriorityChip priority={project.priority} />
          </div>
          <a className="wec-title" href={`#/projects/${project.id}`}>{project.name}</a>
          <div className="wec-sub">
            {progress.total > 0
              ? <span>{progress.done} / {progress.total} tasks</span>
              : progress.mode === 'manual' || progress.mode === 'legacy'
                ? <span>Manual progress</span>
                : <span>No tasks yet</span>}
            {nextMilestone && <span>Next: {nextMilestone.name}</span>}
            {project.category && project.category !== 'General' && <span>{project.category}</span>}
          </div>
        </div>
        <div className="wec-side">
          <div className="wec-pct">{status.pct}%</div>
          <div className="wec-side-note">
            {status.complete ? 'Done' : status.hasDeadline ? `${status.daysLeft ?? 0}d left` : 'No deadline'}
          </div>
        </div>
      </div>

      <div className="wec-body">
        <Meter pct={status.pct} tone={status.tone} pace={status.elapsedPct}
          label={`${status.pct}% complete${status.elapsedPct != null ? `, pace marker at ${status.elapsedPct}%` : ''}`} />
        <div className="wec-facts" aria-label="Project facts">
          <div className="wec-fact">
            <span className="wec-fact__label">Deadline</span>
            <strong className="wec-fact__value">{status.hasDeadline ? deadlineText(project.deadline) : '—'}</strong>
            <span className="wec-fact__note">{status.hasDeadline ? 'target date' : 'No deadline'}</span>
          </div>
          <div className="wec-fact">
            <span className="wec-fact__label">Days left</span>
            <strong className="wec-fact__value">{status.hasDeadline ? (status.complete ? 'Done' : `${Math.max(0, status.daysLeft ?? 0)}d`) : '—'}</strong>
            <span className="wec-fact__note">{status.hasDeadline && status.passed ? 'overdue' : 'on the clock'}</span>
          </div>
          <div className="wec-fact">
            <span className="wec-fact__label">Tasks</span>
            <strong className="wec-fact__value">{progress.total ? `${progress.done}/${progress.total}` : '—'}</strong>
            <span className="wec-fact__note">{progress.total ? 'complete' : 'add tasks'}</span>
          </div>
          <div className="wec-fact">
            <span className="wec-fact__label">Health</span>
            <strong className="wec-fact__value">{status.label}</strong>
            <span className="wec-fact__note">pace status</span>
          </div>
        </div>

        {showStepper && track.length > 1 && (
          <MilestoneStepper track={track} pct={status.pct} />
        )}
      </div>

      <div className="wec-foot">
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
        <span className="wec-foot__spacer" />
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
   ASSIGNMENT CARD → .we-card
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
    <article className={`we-card${status.complete ? ' is-done' : ''}`} data-kind="assignment" data-tone={status.tone} aria-label={`Assignment ${assignment.name}`}>
      <div className="wec-head">
        <span className="wec-lead" aria-hidden="true">
          <span className="wec-kind" data-kind="assignment"><KindIcon kind="assignment" /></span>
        </span>
        <div className="wec-main" style={{ flex: 1, minWidth: 0 }}>
          <div className="wec-chips">
            <KindTag kind="assignment">Assignment</KindTag>
            <StatusPill status={status} />
            <PriorityChip priority={assignment.priority} />
          </div>
          <a className="wec-title" href={`#/assignments/${assignment.id}`}>{assignment.name}</a>
          <div className="wec-sub">
            {assignment.subject && <span>{assignment.subject}</span>}
            {status.hasDeadline && <span>{deadlineText(assignment.deadline)}</span>}
          </div>
          <div className="wec-hero">
            <DeadlineHero status={status} />
            <div style={{ marginTop: 8 }}>
              <DeadlinePressure pressure={assignmentPressure(assignment, now)} showDetail={false} />
            </div>
          </div>
        </div>
        <div className="wec-side">
          <div className="wec-pct">{status.pct}%</div>
          <button
            className="btn ghost sm"
            style={{ marginTop: 4 }}
            aria-expanded={openProgress}
            aria-controls={`ap-${assignment.id}`}
            onClick={() => setOpenProgress((o) => !o)}
          >
            {openProgress ? 'Close' : 'Update'}
          </button>
        </div>
      </div>

      <div className="wec-body">
        <Meter pct={status.pct} tone={status.tone} pace={status.elapsedPct}
          label={`${status.pct}% complete${status.elapsedPct != null ? `, pace marker at ${status.elapsedPct}%` : ''}`} />
        <div className="wec-facts" aria-label="Assignment facts">
          <div className="wec-fact"><span className="wec-fact__label">Progress</span><strong className="wec-fact__value">{status.pct}%</strong><span className="wec-fact__note">complete</span></div>
          <div className="wec-fact"><span className="wec-fact__label">Due</span><strong className="wec-fact__value">{status.hasDeadline ? (status.passed ? 'Past due' : status.dueText) : '—'}</strong><span className="wec-fact__note">{status.hasDeadline ? deadlineText(assignment.deadline) : 'No deadline'}</span></div>
          <div className="wec-fact"><span className="wec-fact__label">Time left</span><strong className="wec-fact__value">{status.hasDeadline && !status.complete ? (status.hoursLeft < 48 ? `${Math.max(0, Math.round(status.hoursLeft))}h` : `${Math.max(0, status.daysLeft ?? 0)}d`) : status.complete ? 'Done' : '—'}</strong><span className="wec-fact__note">countdown</span></div>
          <div className="wec-fact"><span className="wec-fact__label">Status</span><strong className="wec-fact__value">{status.label}</strong><span className="wec-fact__note">urgency</span></div>
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
              <div style={{ paddingTop: 10 }}>
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

      <div className="wec-foot">
        {subs.length > 0 && (
          <span className="count-chip"><IconLayers size={12} /> {subsDone}/{subs.length} subtasks</span>
        )}
        {progress.mode === 'subtasks' && <span className="count-chip">Synced with subtasks</span>}
        {Number(assignment.estimateMin) > 0 && (
          <span className="count-chip"><IconClock size={12} /> ~{minutesLabel(assignment.estimateMin)}</span>
        )}
        {assignment.projectId && <span className="count-chip"><IconLink size={12} /> In a project</span>}
        <span className="wec-foot__spacer" />
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
   WORK ROW — compact (hairlines + .we, now canonical).
   Used on Today/Calendar/Deadline timeline/Workload/Settings.
   ------------------------------------------------------------ */
export function WorkRow({ kind, item, status, progressPct, onOpen, right }) {
  const href = kind === 'project' ? `#/projects/${item.id}` : `#/assignments/${item.id}`
  const toneCls = status?.tone ? ` data-tone="${status.tone}"` : ''
  return (
    <a className="we" href={href} onClick={onOpen} aria-label={`${kind === 'project' ? 'Project' : 'Assignment'} ${item.name}`} {...(toneCls ? { 'data-tone': status.tone } : {})}>
      <span className="we__lead" aria-hidden="true">
        <span className="we-kind" data-kind={kind}><KindIcon kind={kind} /></span>
      </span>
      <span className="we__body">
        <span className="we-title">{item.name}</span>
        <span className="we-meta">
          <span className="we-meta__item" data-tone={status?.tone === 'bad' ? 'bad' : status?.tone === 'warn' ? 'warn' : 'neutral'}>
            <StatusPill status={status} />
          </span>
          {kind === 'assignment'
            ? <span className="we-meta__item">{status.dueText}</span>
            : <span className="we-meta__item">{status.hasDeadline ? status.dueText : 'No deadline'}</span>}
          {right}
        </span>
        <span className="we-progress">
          <Meter pct={progressPct} tone={status?.tone} thin label={`${progressPct}% complete`} />
          <span className="we-progress__pct">{progressPct}%</span>
        </span>
      </span>
    </a>
  )
}

export const workStatusOf = (kind, item, now) => (kind === 'project' ? projectStatus(item, now) : assignmentStatus(item, now))
export const workProgressOf = (kind, item) => (kind === 'project' ? projectProgress(item).pct : assignmentProgress(item).pct)
