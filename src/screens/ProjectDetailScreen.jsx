/* ============================================================
   PROJECT DETAIL — overview, milestones, tasks, timeline and
   the project's own analytics. One project, one job.
   ============================================================ */
import { useMemo, useState } from 'react'
import { Reorder, useDragControls, useReducedMotion } from 'framer-motion'
import { useStore } from '../store.jsx'
import useNow from '../lib/useNow.js'
import { useWorkUI } from '../components/work/WorkUIProvider.jsx'
import { useToast } from '../components/ui/Toaster.jsx'
import SectionCard, { CardHead } from '../components/ui/SectionCard.jsx'
import { StatusPill, KindTag, Meter, MeterRow, MilestoneStepper, QuickProgress, WorkEmpty } from '../components/work/WorkKit.jsx'
import { BurndownChart, LineSeries, BucketColumns, HBarList, DonutStat } from '../components/charts/workCharts.jsx'
import PaceChart from '../components/charts/PaceChart.jsx'
import ProjectTrack from '../components/work/ProjectTrack.jsx'
import {
  projectStatus, projectProgress, milestoneTrack, burndown, progressSeries, entityVelocity,
  timeVsWork, itemHistory, allTasks, TASK_STATUSES, PRIORITIES,
  projectPace, projectPhase, phaseTone, PROJECT_PHASES,
} from '../lib/work.js'
import { activeHabits, habitRate, habitStreak } from '../lib/stats.js'
import { categoryOf } from '../lib/schedule.js'
import { Link } from '../lib/router.jsx'
import { todayStr, subDaysStr, shortDate, prettyDate, dayOf, minutesLabel, daysUntil, addDaysStr } from '../lib/dates.js'
import {
  IconChevronLeft, IconPlus, IconTrash, IconPencil, IconProjects, IconGrip, IconCheck,
  IconClock, IconX,
} from '../lib/icons.jsx'

export default function ProjectDetailScreen({ id }) {
  const { state, dispatch } = useStore()
  const work = useWorkUI()
  const now = useNow()
  const today = todayStr()

  const project = (state.projects || []).find((p) => p.id === id) || null
  const [tab, setTab] = useState('overview')
  const [newTask, setNewTask] = useState({})
  const [addingMilestone, setAddingMilestone] = useState(false)
  const [milestoneName, setMilestoneName] = useState('')

  const status = useMemo(() => (project ? projectStatus(project, now) : null), [project, now])
  const progress = useMemo(() => (project ? projectProgress(project) : null), [project])
  const track = useMemo(() => (project ? milestoneTrack(project) : []), [project])
  const nextMilestone = useMemo(() => track.find((m) => !m.reached) || null, [track])
  const habits = activeHabits(state)

  if (!project) {
    return (
      <div className="screen">
        <SectionCard>
          <WorkEmpty
            icon={<IconProjects size={40} />}
            title="Project not found"
            action={<a className="btn primary" href="#/projects">Back to projects</a>}
          >
            It may have been deleted on this device.
          </WorkEmpty>
        </SectionCard>
      </div>
    )
  }

  const linkedHabits = (project.linkedHabitIds || []).map((hid) => habits.find((h) => h.id === hid)).filter(Boolean)

  const addTask = (milestoneId) => {
    const name = (newTask[milestoneId] || '').trim()
    if (!name) return
    dispatch({ type: 'ADD_TASK', projectId: project.id, milestoneId, name })
    setNewTask((s) => ({ ...s, [milestoneId]: '' }))
  }

  const addMilestone = () => {
    const name = milestoneName.trim()
    if (!name) return
    dispatch({ type: 'ADD_MILESTONE', projectId: project.id, name })
    setMilestoneName('')
    setAddingMilestone(false)
  }

  const removeProject = () => {
    work.deleteProject(project)
    window.location.hash = '#/projects'
  }

  return (
    <div className="screen" id="project-detail">
      <header className="screen-head">
        <div style={{ minWidth: 0 }}>
          <a href="#/projects" className="back-link" aria-label="Back to projects">
            <IconChevronLeft size={16} /> Projects
          </a>
          <div className="wrap-gap" style={{ gap: 8, marginTop: 6 }}>
            <KindTag kind="project">Project</KindTag>
            <StatusPill status={status} />
          </div>
          <h1 className="screen-title" style={{ marginTop: 6, overflowWrap: 'anywhere' }}>{project.name}</h1>
          {project.description && <p className="screen-sub">{project.description}</p>}
        </div>
        <div className="head-actions">
          <button className="btn ghost icon" aria-label="Edit project" onClick={() => work.editProject(project)}><IconPencil size={17} /></button>
          <button className="btn ghost icon" style={{ color: 'var(--bad)' }} aria-label="Delete project" onClick={removeProject}><IconTrash size={17} /></button>
        </div>
      </header>

      <div className="detail-layout">
      <div className="stack">
        {/* Progress hero */}
        <SectionCard className="pad-lg project-detail-hero">
          <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
            <DonutStat
              pct={status.pct}
              size={124}
              tone={status.tone}
              label={progress.total ? `${progress.done} of ${progress.total} tasks` : progress.mode === 'none' ? 'No tasks yet' : 'Manual progress'}
              sub={status.hasDeadline
                ? `${status.complete ? 'Completed' : status.dueText}${project.startDate ? ` · started ${shortDate(project.startDate)}` : ''}`
                : project.startDate ? `Started ${shortDate(project.startDate)}` : 'No deadline set'}
            />
            <div style={{ flex: 1, minWidth: 200 }}>
              <div className="wrap-gap" style={{ gap: 6, marginBottom: 10 }}>
                <span className="status-pill" data-tone={phaseTone(projectPhase(project, now))}>
                  {PROJECT_PHASES.find((ph) => ph.id === projectPhase(project, now))?.label}
                </span>
                <StatusPill status={status.id} />
              </div>
              <MeterRow pct={status.pct} tone={status.tone} pace={status.elapsedPct} />
              <p className="tiny muted" style={{ marginTop: 10, lineHeight: 1.6 }}>
                {status.hasDeadline && !status.complete
                  ? <>Deadline {prettyDate(dayOf(project.deadline))} · <b className="tnum">{status.daysLeft ?? 0} days left</b> of a {status.durationDays}-day window{status.elapsedPct != null ? <> · <b className="tnum">{status.elapsedPct}%</b> of the time has gone</> : null}.</>
                  : status.complete
                    ? <>Completed{project.completedAt ? ` on ${shortDate(dayOf(project.completedAt))}` : ''}.</>
                    : 'No deadline — progress only. Add one to unlock pace and burndown analysis.'}
              </p>
              {status.hasDeadline && !status.complete && status.elapsedPct != null && (
                <p className="tiny" style={{ marginTop: 8, color: status.behind > 15 ? 'var(--bad)' : status.behind < -15 ? 'var(--good)' : 'var(--text-2)' }}>
                  {status.behind > 15
                    ? `Behind the pace line by ${status.behind} points.`
                    : status.behind < -15
                      ? `Ahead of the pace line by ${Math.abs(status.behind)} points.`
                      : 'On pace with the deadline.'}
                </p>
              )}
            </div>
          </div>

          {progress.total === 0 && (
            <div style={{ marginTop: 18, paddingTop: 18, borderTop: '1px solid var(--border)' }}>
              <QuickProgress
                value={project.manualPercent ?? project.legacyPercent ?? 0}
                onChange={(pct) => work.setProjectPercent(project, pct)}
                label="Progress (no tasks yet)"
              />
            </div>
          )}
        </SectionCard>

        {/* V3: the project as an object on its own track */}
        <SectionCard className="pad project-track-card">
          <CardHead title="The track">
            <span className="tiny muted">
              {project.deadline ? `deadline ${shortDate(dayOf(project.deadline))}` : 'no deadline'}
            </span>
          </CardHead>
          <ProjectTrack project={project} now={now} />
        </SectionCard>

        {/* Milestones */}
        {track.length > 0 && (
          <SectionCard className="pad">
            <CardHead title="Milestones">
              <span className="tiny muted tnum">{track.filter((m) => m.reached).length} / {track.length} reached</span>
            </CardHead>
            <MilestoneStepper track={track} pct={status.pct} vertical={track.length > 4} />
          </SectionCard>
        )}

        <div className="seg seg-wide" role="tablist" aria-label="Project sections">
          {[{ id: 'overview', label: 'Tasks' }, { id: 'timeline', label: 'Timeline' }, { id: 'analytics', label: 'Analytics' }].map((t) => (
            <button key={t.id} type="button" role="tab" aria-selected={tab === t.id}
              className={`seg-btn${tab === t.id ? ' active' : ''}`} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'overview' && (
          <>
            {(project.milestones || []).map((m) => {
              const mt = track.find((x) => x.id === m.id)
              return (
                <SectionCard className="pad" key={m.id}>
                  <CardHead title={m.name}>
                    <span className="tiny muted tnum">{mt?.done ?? 0}/{mt?.total ?? 0}</span>
                  </CardHead>
                  <TaskList
                    project={project}
                    milestone={m}
                    newTask={newTask[m.id] || ''}
                    onNewTaskChange={(v) => setNewTask((s) => ({ ...s, [m.id]: v }))}
                    onAddTask={() => addTask(m.id)}
                  />
                </SectionCard>
              )
            })}

            <SectionCard className="pad">
              {addingMilestone ? (
                <form style={{ display: 'flex', gap: 8 }} onSubmit={(e) => { e.preventDefault(); addMilestone() }}>
                  <label className="sr-only" htmlFor="new-milestone">Milestone name</label>
                  <input id="new-milestone" className="field" autoFocus value={milestoneName} maxLength={80}
                    placeholder="e.g. Frontend build"
                    onChange={(e) => setMilestoneName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Escape') setAddingMilestone(false) }} />
                  <button className="btn" type="submit">Add</button>
                  <button className="btn ghost icon" type="button" aria-label="Cancel" onClick={() => setAddingMilestone(false)}><IconX size={16} /></button>
                </form>
              ) : (
                <button className="btn ghost" onClick={() => setAddingMilestone(true)} style={{ alignSelf: 'flex-start' }}>
                  <IconPlus size={15} /> Add milestone
                </button>
              )}
            </SectionCard>

            <div className="split">
              <SectionCard className="pad">
                <CardHead title="Linked habits" />
                {linkedHabits.length === 0 ? (
                  <p className="empty-note">
                    Link habits in Edit to see project progress next to habit consistency.
                  </p>
                ) : (
                  <HBarList
                    rows={linkedHabits.map((h) => {
                      const r = habitRate(state, h, subDaysStr(today, 29), today)
                      return { label: h.name, value: r.rate == null ? null : Math.round(r.rate * 100), sub: `${habitStreak(state, h)}d streak` }
                    })}
                    emptyText="Not enough habit history yet."
                  />
                )}
                {linkedHabits.length > 0 && (
                  <p className="card-blurb">30-day consistency. Correlation, not cause.</p>
                )}
              </SectionCard>

              <SectionCard className="pad">
                <CardHead title="Notes" />
                <textarea
                  className="field"
                  rows={5}
                  maxLength={4000}
                  value={project.notes || ''}
                  placeholder="Context, decisions, links…"
                  aria-label="Project notes"
                  onChange={(e) => dispatch({ type: 'UPDATE_PROJECT', id: project.id, patch: { notes: e.target.value } })}
                />
              </SectionCard>
            </div>
          </>
        )}

        {tab === 'timeline' && <ProjectTimeline project={project} status={status} track={track} />}
        {tab === 'analytics' && <ProjectAnalyticsDetail project={project} status={status} />}
      </div>

      {/* Desktop rail (§81): the facts, always visible next to the work.
          On mobile it stacks under the main column. */}
      <aside className="rail stack" aria-label="Project details">
        <SectionCard className="pad">
          <CardHead title="Details" />
          <dl className="kv">
            <dt>Category</dt><dd>{categoryOf(project.category).label}</dd>
            <dt>Priority</dt><dd>{PRIORITIES.find((x) => x.id === project.priority)?.label || 'Normal'}</dd>
            <dt>Started</dt><dd className="tnum">{project.startDate ? prettyDate(project.startDate) : '—'}</dd>
            <dt>Deadline</dt>
            <dd className="tnum">
              {project.deadline
                ? `${prettyDate(dayOf(project.deadline))}${!status.complete && status.daysLeft != null ? ` · ${status.daysLeft}d left` : ''}`
                : 'None set'}
            </dd>
            <dt>Tasks</dt><dd className="tnum">{progress.done} of {progress.total} done</dd>
            {nextMilestone && (<><dt>Next milestone</dt><dd>{nextMilestone.name}</dd></>)}
            {Number(project.estimateMin) > 0 && (<><dt>Estimated</dt><dd className="tnum">{minutesLabel(project.estimateMin)}</dd></>)}
            {Number(project.actualMin) > 0 && (<><dt>Time logged</dt><dd className="tnum">{minutesLabel(project.actualMin)}</dd></>)}
          </dl>
        </SectionCard>

        <SectionCard className="pad">
          <CardHead title="Habits carrying this" />
          {linkedHabits.length ? (
            <div className="wrap-gap" style={{ gap: 6 }}>
              {linkedHabits.map((h) => (
                <Link key={h.id} to="library" className="chip">{h.name}</Link>
              ))}
            </div>
          ) : (
            <p className="empty-note">Link habits from Edit to see consistency next to progress.</p>
          )}
        </SectionCard>

        <SectionCard className="pad">
          <CardHead title="See it in context" />
          <div className="stack" style={{ gap: 8 }}>
            <Link to="workload" className="btn ghost sm">Workload</Link>
            <Link to="timeline" className="btn ghost sm">All deadlines</Link>
            <Link to="goals" className="btn ghost sm">Goals</Link>
          </div>
        </SectionCard>
      </aside>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------
   TASKS — status, due date, priority, estimate, reorder, delete
   ------------------------------------------------------------ */
function TaskList({ project, milestone, newTask, onNewTaskChange, onAddTask }) {
  const { dispatch } = useStore()
  const toast = useToast()
  const reduced = useReducedMotion()
  const tasks = milestone.tasks || []
  const [expanded, setExpanded] = useState(null)

  const onReorder = (next) => dispatch({ type: 'REORDER_TASKS', projectId: project.id, milestoneId: milestone.id, order: next.map((t) => t.id) })

  const remove = (task) => {
    const index = tasks.findIndex((t) => t.id === task.id)
    dispatch({ type: 'DELETE_TASK', projectId: project.id, milestoneId: milestone.id, taskId: task.id })
    setExpanded(null)
    toast.show(`Deleted “${task.name}”`, {
      duration: 6000,
      actionLabel: 'Undo',
      onAction: () => dispatch({ type: 'RESTORE_TASK', projectId: project.id, milestoneId: milestone.id, task, index }),
    })
  }

  const shared = {
    project, milestone, tasks, expanded, setExpanded, dispatch, remove,
  }

  return (
    <div>
      {reduced ? (
        <ul style={{ display: 'flex', flexDirection: 'column', gap: 2, listStyle: 'none', padding: 0, margin: 0 }}>
          {tasks.map((t) => <li key={t.id}><TaskRow task={t} {...shared} /></li>)}
        </ul>
      ) : (
        <Reorder.Group
          axis="y"
          values={tasks}
          onReorder={onReorder}
          as="ul"
          style={{ display: 'flex', flexDirection: 'column', gap: 2, listStyle: 'none', padding: 0, margin: 0 }}
        >
          {tasks.map((t) => <TaskRow key={t.id} task={t} {...shared} />)}
        </Reorder.Group>
      )}

      <form style={{ display: 'flex', gap: 8, marginTop: 10 }} onSubmit={(e) => { e.preventDefault(); onAddTask() }}>
        <label className="sr-only" htmlFor={`task-${milestone.id}`}>Add a task to {milestone.name}</label>
        <input
          id={`task-${milestone.id}`}
          className="field"
          style={{ minHeight: 44 }}
          placeholder="Add a task…"
          value={newTask}
          onChange={(e) => onNewTaskChange(e.target.value)}
        />
        <button className="btn icon" type="submit" aria-label={`Add task to ${milestone.name}`}><IconPlus size={17} /></button>
      </form>
    </div>
  )
}

/** One task: checkbox, status, due, priority, estimate, notes, reorder, delete. */
function TaskRow({ task: t, project, milestone, expanded, setExpanded, dispatch, remove }) {
  const work = useWorkUI()
  const reduced = useReducedMotion()
  const controls = useDragControls()
  const patch = (p) => dispatch({ type: 'UPDATE_TASK', projectId: project.id, milestoneId: milestone.id, taskId: t.id, patch: p })

  const row = (
    <div className={`task-row${t.done ? ' is-done' : ''}`}>
      <button
        className="check-box"
        data-done={t.done}
        aria-pressed={t.done}
        aria-label={`Mark ${t.name} ${t.done ? 'not done' : 'done'}`}
        onClick={() => work.toggleTask(project, milestone, t)}
      >
        {t.done && <IconCheck size={14} />}
      </button>

      <div className="task-main">
        <p className="task-name">{t.name}</p>
        <div className="task-meta">
          <label className="sr-only" htmlFor={`st-${t.id}`}>Status for {t.name}</label>
          <select
            id={`st-${t.id}`}
            className="status-select"
            value={t.done ? 'done' : (t.status || 'todo')}
            onChange={(e) => {
              const v = e.target.value
              patch(v === 'done' ? { done: true, status: 'done' } : { done: false, status: v })
            }}
          >
            {TASK_STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
          {t.due && (
            <span className={`chip${daysUntil(t.due) < 0 && !t.done ? ' tag-bad' : ''}`} style={{ minHeight: 22 }}>
              {daysUntil(t.due) < 0 && !t.done ? 'Overdue · ' : 'Due '}{shortDate(t.due)}
            </span>
          )}
          {t.priority === 'high' && <span className="chip tag-bad" style={{ minHeight: 22 }}>High</span>}
          {Number(t.estimateMin) > 0 && <span>~{minutesLabel(t.estimateMin)}</span>}
          <button className="btn ghost sm" style={{ padding: '0 10px' }}
            aria-expanded={expanded === t.id} aria-label={`Details for task ${t.name}`}
            onClick={() => setExpanded(expanded === t.id ? null : t.id)}>
            {expanded === t.id ? 'Close' : 'Details'}
          </button>
        </div>

        {expanded === t.id && (
          <div className="stack" style={{ gap: 10, marginTop: 12, padding: 12, borderRadius: 12, background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
            <div className="split" style={{ gap: 10 }}>
              <div>
                <label className="field-label" htmlFor={`due-${t.id}`}>Due date</label>
                <input id={`due-${t.id}`} className="field" type="date" value={t.due || ''} style={{ minHeight: 44 }}
                  onChange={(e) => patch({ due: e.target.value || null })} />
              </div>
              <div>
                <label className="field-label" htmlFor={`est-${t.id}`}>Estimate (minutes)</label>
                <input id={`est-${t.id}`} className="field" type="number" min="0" step="5" inputMode="numeric" style={{ minHeight: 44 }}
                  value={t.estimateMin ?? ''} placeholder="e.g. 45"
                  onChange={(e) => patch({ estimateMin: e.target.value ? Number(e.target.value) : null })} />
              </div>
            </div>
            <div>
              <label className="field-label" htmlFor={`prio-${t.id}`}>Priority</label>
              <select id={`prio-${t.id}`} className="field" style={{ minHeight: 44 }} value={t.priority || 'normal'} onChange={(e) => patch({ priority: e.target.value })}>
                {PRIORITIES.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            </div>
            <div>
              <label className="field-label" htmlFor={`note-${t.id}`}>Task notes</label>
              <textarea id={`note-${t.id}`} className="field" rows={2} maxLength={1000} value={t.notes || ''}
                onChange={(e) => patch({ notes: e.target.value })} />
            </div>
            <div className="row-between">
              <span className="tiny muted">
                {t.completedAt ? `Completed ${shortDate(dayOf(t.completedAt))}` : 'Not completed yet'}
              </span>
              <button className="btn danger sm" onClick={() => remove(t)}>
                <IconTrash size={14} /> Delete task
              </button>
            </div>
          </div>
        )}
      </div>

      {!reduced && (
        <button className="drag-handle" aria-label={`Reorder ${t.name}`} onPointerDown={(e) => controls.start(e)} style={{ alignSelf: 'center' }}>
          <IconGrip size={17} />
        </button>
      )}
    </div>
  )

  if (reduced) return row
  return (
    <Reorder.Item
      value={t}
      as="li"
      dragListener={false}
      dragControls={controls}
      style={{ listStyle: 'none', position: 'relative', touchAction: 'pan-y' }}
      whileDrag={{ scale: 1.01, zIndex: 5, boxShadow: 'var(--shadow-2)', borderRadius: 12, background: 'var(--surface-2)' }}
    >
      {row}
    </Reorder.Item>
  )
}

/* ------------------------------------------------------------
   PROJECT TIMELINE — start → milestones → deadline
   ------------------------------------------------------------ */
function ProjectTimeline({ project, status, track }) {
  const today = todayStr()
  if (!project.startDate && !project.deadline) {
    return (
      <SectionCard className="pad">
        <WorkEmpty icon={<IconClock size={34} />} title="No dates on this project">
          Add a start date and deadline in Edit to see the timeline, pace line and burndown.
        </WorkEmpty>
      </SectionCard>
    )
  }
  const start = project.startDate || today
  const end = project.deadline ? dayOf(project.deadline) : addDaysStr(start, 14)
  const total = Math.max(1, daysUntil(end, new Date(`${start}T12:00:00`)))
  const posOf = (d) => Math.max(0, Math.min(100, (daysUntil(d, new Date(`${start}T12:00:00`)) / total) * 100))
  const todayPos = posOf(today)
  const markers = track.map((m) => ({ ...m, pos: m.anchor }))

  return (
    <>
      <SectionCard className="pad">
        <CardHead title="Timeline" />
        <div style={{ position: 'relative', padding: '26px 4px 8px' }}>
          <div style={{ position: 'relative', height: 8, borderRadius: 999, background: 'var(--track)' }}>
            <div style={{ position: 'absolute', inset: '0 auto 0 0', width: `${status.pct}%`, borderRadius: 999, background: 'linear-gradient(90deg, var(--accent-1), var(--accent-2))', transition: 'width 600ms cubic-bezier(0.22,1,0.36,1)' }} />
            {todayPos > 0 && todayPos < 100 && (
              <span style={{ position: 'absolute', top: -6, bottom: -6, left: `${todayPos}%`, width: 2, background: 'var(--text-2)', opacity: 0.8, borderRadius: 2 }} aria-hidden="true" />
            )}
          </div>
          {markers.map((m) => (
            <span key={m.id} style={{ position: 'absolute', top: 18, left: `${m.pos}%`, transform: 'translateX(-50%)', textAlign: 'center', width: 76 }} aria-hidden="true">
              <span style={{ display: 'block', width: 8, height: 8, borderRadius: 999, margin: '0 auto', background: m.reached ? 'var(--accent-2)' : 'var(--surface-3)', border: `2px solid ${m.reached ? 'var(--accent-2)' : 'var(--border-2)'}` }} />
              <span className="tiny muted ellipsis" style={{ display: 'block', marginTop: 4 }}>{m.name}</span>
            </span>
          ))}
        </div>
        <div className="row-between" style={{ marginTop: markers.length ? 44 : 8 }}>
          <span className="tiny muted">Start · {shortDate(start)}</span>
          <span className="tiny muted">Deadline · {project.deadline ? shortDate(dayOf(project.deadline)) : 'none'}</span>
        </div>
        <dl className="kv" style={{ marginTop: 16 }}>
          <dt>Duration</dt><dd className="tnum">{status.durationDays ? `${status.durationDays} days` : '—'}</dd>
          <dt>Elapsed</dt><dd className="tnum">{status.elapsedPct != null ? `${status.elapsedPct}%` : '—'}</dd>
          <dt>Remaining</dt><dd className="tnum">{status.complete ? 'Done' : status.hasDeadline ? `${status.daysLeft ?? 0} days` : '—'}</dd>
          <dt>Work left</dt><dd className="tnum">{100 - status.pct}%</dd>
        </dl>
      </SectionCard>

      <SectionCard className="pad">
        <CardHead title="Milestone schedule" />
        {track.length === 0 ? (
          <p className="empty-note">No milestones yet.</p>
        ) : (
          <div className="tl">
            {track.map((m) => (
              <div className="tl-group" key={m.id}>
                <p className="tl-day" data-tone={m.reached ? 'good' : undefined}>{m.reached ? 'Reached' : m.partial ? 'In progress' : 'Upcoming'} · {m.anchor}%</p>
                <div className="tl-item" style={{ cursor: 'default' }}>
                  <span className="tl-main">
                    <span className="tl-name">{m.name}</span>
                    <span className="tl-meta">
                      <span className="tiny muted tnum">{m.done}/{m.total} tasks</span>
                      {m.due && <span className="tiny muted">Due {shortDate(m.due)}</span>}
                    </span>
                  </span>
                  <span className="tl-meter">
                    <Meter pct={m.own ?? (m.reached ? 100 : 0)} thin tone={m.reached ? 'good' : undefined} label={`${m.name} ${m.own ?? 0}%`} />
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </>
  )
}

/* ------------------------------------------------------------
   PROJECT ANALYTICS (single project)
   ------------------------------------------------------------ */
function ProjectAnalyticsDetail({ project, status }) {
  const now = useNow()
  const today = todayStr()
  const [range, setRange] = useState(30)

  const bd = useMemo(() => burndown(project, now), [project, now])
  const series = useMemo(() => {
    const from = subDaysStr(today, range - 1)
    return progressSeries(project, from, today)
  }, [project, range, today])
  const velocity = useMemo(() => entityVelocity(project, Math.min(range, 30), now), [project, range, now])
  const tvw = useMemo(() => timeVsWork(project, 'project', now), [project, now])
  const history = useMemo(() => itemHistory(project, 'project', now), [project, now])

  const taskBuckets = useMemo(() => {
    const b = { done: 0, doing: 0, blocked: 0, todo: 0 }
    for (const t of allTasks(project)) {
      if (t.done) b.done++
      else if (t.status === 'doing') b.doing++
      else if (t.status === 'blocked') b.blocked++
      else b.todo++
    }
    return b
  }, [project])

  const hasLog = (project.progressLog || []).length > 0
  const pace = useMemo(() => projectPace(project, { days: range, now }), [project, range, now])

  return (
    <>
      <SectionCard className="pad">
        <CardHead title="Expected vs actual">
          <span className="pace-legend" aria-hidden="true">
            <i className="pace-legend-actual" /> actual
            <i className="pace-legend-expected" /> expected
          </span>
        </CardHead>
        <PaceChart
          actual={pace.actual}
          expected={pace.expected}
          ariaLabel={`Expected versus actual progress for ${project.name} over the last ${range} days`}
        />
        {!pace.expected && (
          <p className="tiny muted" style={{ marginTop: 6 }}>
            No expected line: this project needs a start date and a deadline to compute one.
          </p>
        )}
      </SectionCard>

      <div className="split">
        <SectionCard className="pad">
          <CardHead title="Progress over time">
            <div className="seg" role="group" aria-label="Range">
              {[14, 30, 90].map((d) => (
                <button key={d} type="button" className={`seg-btn${range === d ? ' active' : ''}`} aria-pressed={range === d} onClick={() => setRange(d)}>{d}D</button>
              ))}
            </div>
          </CardHead>
          {hasLog ? (
            <LineSeries
              series={[{ id: 'pct', label: 'Complete', color: 'var(--accent-2)', points: series.map((r) => ({ date: r.date, value: r.pct })) }]}
              ariaLabel="Project progress over time"
            />
          ) : (
            <p className="empty-note">Progress is logged every time you complete a task or set a percentage.</p>
          )}
        </SectionCard>

        <SectionCard className="pad">
          <CardHead title="Task status" />
          <BucketColumns
            rows={[
              { label: 'Done', value: taskBuckets.done, color: 'var(--good)' },
              { label: 'Doing', value: taskBuckets.doing, color: 'var(--accent-2)' },
              { label: 'Blocked', value: taskBuckets.blocked, color: 'var(--bad)' },
              { label: 'To do', value: taskBuckets.todo, color: 'var(--text-3)' },
            ]}
          />
          <div className="hr" />
          <HBarList
            rows={[
              { label: 'Completed', value: status.pct, tone: 'good' },
              { label: 'Remaining', value: 100 - status.pct, tone: 'neutral' },
            ]}
          />
        </SectionCard>
      </div>

      {bd && (
        <SectionCard className="pad">
          <CardHead title="Deadline burndown" />
          <BurndownChart rows={bd.rows} today={today} />
          <p className="card-blurb">
            Ideal pace assumes even work from {shortDate(bd.start)} to {shortDate(bd.end)}. The solid line is what actually happened.
          </p>
        </SectionCard>
      )}

      {tvw && (
        <SectionCard className="pad">
          <CardHead title="Time versus work" />
          <HBarList
            rows={[
              { label: 'Time elapsed', value: tvw.elapsedPct, tone: tvw.behind ? 'bad' : 'neutral' },
              { label: 'Work completed', value: tvw.workPct, tone: tvw.behind ? 'warn' : 'good' },
            ]}
          />
          <p className="card-blurb">
            {tvw.behind
              ? `Behind schedule: ${tvw.gapPct} points of the clock have gone without matching work. ${tvw.remainingWork}% of the work is still open with ${tvw.daysLeft} days left.`
              : tvw.ahead
                ? `Ahead of schedule by ${Math.abs(tvw.gapPct)} points.`
                : 'On pace — time elapsed and work completed are within 15 points.'}
          </p>
        </SectionCard>
      )}

      <SectionCard className="pad">
        <CardHead title="Velocity" />
        {velocity.some((v) => v.count) ? (
          <>
            <BucketColumns rows={velocity.map((v) => ({ label: v.date.slice(5).replace('-', '/'), value: v.count, color: 'var(--accent-1)' }))} height={110} />
            <p className="card-blurb">Tasks completed per day over the last {Math.min(range, 30)} days.</p>
          </>
        ) : (
          <p className="empty-note">No completed tasks with timestamps in this window yet.</p>
        )}
      </SectionCard>

      {history && (
        <SectionCard className="pad">
          <CardHead title="Completion record" />
          <dl className="kv">
            <dt>Started</dt><dd>{history.start ? shortDate(history.start) : '—'}</dd>
            <dt>Completed</dt><dd>{history.completedDay ? shortDate(history.completedDay) : '—'}</dd>
            <dt>Duration</dt><dd className="tnum">{history.durationDays != null ? `${history.durationDays} days` : '—'}</dd>
            <dt>Estimated</dt><dd className="tnum">{history.estimated || '—'}</dd>
            <dt>Actual</dt><dd className="tnum">{history.actual || '—'}</dd>
            <dt>Tasks</dt><dd className="tnum">{history.tasksTotal ? `${history.tasksDone}/${history.tasksTotal}` : '—'}</dd>
            <dt>Deadline</dt><dd>{history.early == null ? '—' : history.early ? 'Finished early' : 'Finished after the deadline'}</dd>
          </dl>
        </SectionCard>
      )}
    </>
  )
}
