/* ============================================================
   ASSIGNMENT DETAIL — countdown, progress control, subtasks and
   the assignment's own analytics (§69).
   ============================================================ */
import { useMemo, useState } from 'react'
import { Reorder, useDragControls, useReducedMotion } from 'framer-motion'
import useNow from '../lib/useNow.js'
import { useStore } from '../store.jsx'
import { useWorkUI } from '../components/work/WorkUIProvider.jsx'
import { useToast } from '../components/ui/Toaster.jsx'
import SectionCard, { CardHead } from '../components/ui/SectionCard.jsx'
import { StatusPill, KindTag, MeterRow, QuickProgress, DeadlineHero, WorkEmpty } from '../components/work/WorkKit.jsx'
import DeadlinePressure from '../components/work/DeadlinePressure.jsx'
import { AssignmentDeadlineField } from '../components/work/DeadlineField.jsx'
import { LineSeries, DonutStat, BucketColumns, TimeVsWorkBars } from '../components/charts/workCharts.jsx'
import {
  assignmentStatus, assignmentProgress, progressSeries, entityVelocity, timeVsWork, itemHistory,
  PRIORITIES, assignmentPressure,
} from '../lib/work.js'
import { todayStr, subDaysStr, shortDate, prettyDateTime,  dayOf, minutesLabel } from '../lib/dates.js'
import {
  IconChevronLeft, IconPlus, IconTrash, IconPencil, IconAssignment, IconCheck, IconGrip,
  IconClock, IconLink, IconX, IconHourglass,
} from '../lib/icons.jsx'

export default function AssignmentDetailScreen({ id }) {
  const { state, dispatch } = useStore()
  const work = useWorkUI()
  const toast = useToast()
  const reduced = useReducedMotion()
  const now = useNow()
  const today = todayStr()

  const assignment = (state.assignments || []).find((a) => a.id === id) || null
  const [range, setRange] = useState(14)
  const [newSub, setNewSub] = useState('')
  const [editingDeadline, setEditingDeadline] = useState(false)

  const status = useMemo(() => (assignment ? assignmentStatus(assignment, now) : null), [assignment, now])
  const progress = useMemo(() => (assignment ? assignmentProgress(assignment) : null), [assignment])

  if (!assignment) {
    return (
      <div className="screen">
        <SectionCard>
          <WorkEmpty
            icon={<IconAssignment size={40} />}
            title="Assignment not found"
            action={<a className="btn primary" href="#/assignments">Back to assignments</a>}
          >
            It may have been deleted on this device.
          </WorkEmpty>
        </SectionCard>
      </div>
    )
  }

  const project = assignment.projectId ? (state.projects || []).find((p) => p.id === assignment.projectId) : null
  const subs = assignment.subtasks || []
  const subsDone = subs.filter((s) => s.done).length
  const series = progressSeries(assignment, subDaysStr(today, range - 1), today)
  const velocity = entityVelocity(assignment, Math.min(range, 30), now)
  const tvw = timeVsWork(assignment, 'assignment', now)
  const history = itemHistory(assignment, 'assignment', now)

  const addSub = () => {
    const name = newSub.trim()
    if (!name) return
    dispatch({ type: 'ADD_SUBTASK', id: assignment.id, name })
    setNewSub('')
  }

  const removeSub = (sub) => {
    const index = subs.findIndex((s) => s.id === sub.id)
    dispatch({ type: 'DELETE_SUBTASK', id: assignment.id, subtaskId: sub.id })
    toast.show(`Deleted “${sub.name}”`, {
      duration: 6000,
      actionLabel: 'Undo',
      onAction: () => dispatch({ type: 'RESTORE_SUBTASK', id: assignment.id, subtask: sub, index }),
    })
  }

  const remove = () => {
    work.deleteAssignment(assignment)
    window.location.hash = '#/assignments'
  }

  const reorderSubs = (next) => dispatch({ type: 'REORDER_SUBTASKS', id: assignment.id, order: next.map((s) => s.id) })

  return (
    <div className="screen" id="assignment-detail">
      <header className="screen-head">
        <div style={{ minWidth: 0 }}>
          <a href="#/assignments" className="back-link" aria-label="Back to assignments">
            <IconChevronLeft size={16} /> Assignments
          </a>
          <div className="wrap-gap" style={{ gap: 8, marginTop: 6 }}>
            <KindTag kind="assignment">Assignment</KindTag>
            <StatusPill status={status} />
            {assignment.priority === 'high' && <span className="chip tag-bad" style={{ minHeight: 22 }}>High priority</span>}
          </div>
          <h1 className="screen-title" style={{ marginTop: 6, overflowWrap: 'anywhere' }}>{assignment.name}</h1>
          <p className="screen-sub">
            {[assignment.subject, status.hasDeadline ? `Due ${prettyDateTime(assignment.deadline)}` : 'No deadline', project?.name].filter(Boolean).join(' · ')}
          </p>
        </div>
        <div className="head-actions">
          <button className="btn ghost icon" aria-label="Edit assignment" onClick={() => work.editAssignment(assignment)}><IconPencil size={17} /></button>
          <button className="btn ghost icon" style={{ color: 'var(--bad)' }} aria-label="Delete assignment" onClick={remove}><IconTrash size={17} /></button>
        </div>
      </header>

      <div className="stack">
        {/* Countdown + progress hero */}
        <SectionCard className="pad-lg assignment-detail-hero">
          <div className="detail-hero">
            <div style={{ minWidth: 150 }}>
              <p className="eyebrow">Time left</p>
              <div style={{ marginTop: 8 }}>
                <DeadlineHero status={status} />
              </div>
              {status.hasDeadline && (
                <p className="tiny muted" style={{ marginTop: 8 }}>
                  {status.passed ? `Deadline passed ${shortDate(dayOf(assignment.deadline))}` : `Due ${prettyDateTime(assignment.deadline)}`}
                </p>
              )}
              <div style={{ marginTop: 12 }}>
                <DeadlinePressure pressure={assignmentPressure(assignment, now)} size="lg" />
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <DonutStat pct={status.pct} size={104} tone={status.tone}
                  label={progress.mode === 'subtasks' ? `${subsDone}/${subs.length} subtasks` : 'Progress'}
                  sub={status.complete ? 'Completed' : `${100 - status.pct}% left`} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <MeterRow pct={status.pct} tone={status.tone} pace={status.elapsedPct} />
                  <p className="tiny muted" style={{ marginTop: 10, lineHeight: 1.6 }}>
                    {status.elapsedPct != null
                      ? <><b className="tnum">{status.elapsedPct}%</b> of the time has elapsed and <b className="tnum">{status.pct}%</b> of the work is done.</>
                      : 'Add an assigned date and deadline to compare the clock with the work.'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {status.elapsedPct != null && !status.complete && (
            <p className="pace-note" data-tone={tvw?.behind ? 'bad' : tvw?.ahead ? 'good' : undefined} style={{ marginTop: 16 }}>
              <IconHourglass size={14} />
              {tvw?.behind
                ? `Behind schedule by ${tvw.gapPct} points — ${tvw.remainingWork}% of the work is still open with ${status.daysLeft ?? 0} days left.`
                : tvw?.ahead
                  ? `Ahead of schedule by ${Math.abs(tvw.gapPct)} points.`
                  : 'On pace with the deadline.'}
            </p>
          )}

          <div style={{ marginTop: 18, paddingTop: 18, borderTop: '1px solid var(--border)' }}>
            <QuickProgress
              value={progress.mode === 'subtasks' ? progress.pct : assignment.progress}
              onChange={(pct) => work.setAssignmentProgress(assignment, pct)}
              label={progress.mode === 'subtasks' ? 'Progress (synced with subtasks)' : 'Progress'}
            />
          </div>
        </SectionCard>

        <div className="detail-layout">
          <div className="stack">
            {/* Subtasks */}
            <SectionCard className="pad">
              <CardHead title="Subtasks">
                {subs.length > 0 && <span className="tiny muted tnum">{subsDone}/{subs.length} done</span>}
              </CardHead>

              {subs.length > 0 && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 44, cursor: 'pointer', marginBottom: 8 }}>
                  <input
                    type="checkbox"
                    checked={assignment.progressMode === 'subtasks'}
                    onChange={(e) => dispatch({ type: 'UPDATE_ASSIGNMENT', id: assignment.id, patch: { progressMode: e.target.checked ? 'subtasks' : 'explicit' } })}
                    style={{ width: 20, height: 20, accentColor: 'var(--accent-1)', flex: 'none' }}
                  />
                  <span className="tiny soft">Keep progress in sync with subtasks ({subsDone}/{subs.length} = {progress.pct}%)</span>
                </label>
              )}

              {reduced ? (
                <ul style={{ display: 'flex', flexDirection: 'column', gap: 2, listStyle: 'none', padding: 0, margin: 0 }}>
                  {subs.map((s) => (
                    <li key={s.id}>
                      <SubtaskRow sub={s} assignment={assignment} dispatch={dispatch} remove={removeSub} />
                    </li>
                  ))}
                </ul>
              ) : (
                <Reorder.Group axis="y" values={subs} onReorder={reorderSubs} as="ul"
                  style={{ display: 'flex', flexDirection: 'column', gap: 2, listStyle: 'none', padding: 0, margin: 0 }}>
                  {subs.map((s) => <SubtaskRow key={s.id} sub={s} assignment={assignment} dispatch={dispatch} remove={removeSub} />)}
                </Reorder.Group>
              )}

              <form style={{ display: 'flex', gap: 8, marginTop: 10 }} onSubmit={(e) => { e.preventDefault(); addSub() }}>
                <label className="sr-only" htmlFor="new-subtask">Add a subtask</label>
                <input id="new-subtask" className="field" style={{ minHeight: 44 }} placeholder="Add a subtask…"
                  value={newSub} onChange={(e) => setNewSub(e.target.value)} />
                <button className="btn icon" type="submit" aria-label="Add subtask"><IconPlus size={17} /></button>
              </form>
            </SectionCard>

            {/* Analytics */}
            <SectionCard className="pad">
              <CardHead title="Daily progress">
                <div className="seg" role="group" aria-label="Range">
                  {[7, 14, 30].map((d) => (
                    <button key={d} type="button" className={`seg-btn${range === d ? ' active' : ''}`} aria-pressed={range === d} onClick={() => setRange(d)}>{d}D</button>
                  ))}
                </div>
              </CardHead>
              {(assignment.progressLog || []).length ? (
                <LineSeries
                  series={[{ id: 'pct', label: 'Progress', color: 'var(--accent-2)', points: series.map((r) => ({ date: r.date, value: r.pct })) }]}
                  height={180}
                  ariaLabel="Assignment progress over time"
                />
              ) : (
                <p className="empty-note">Every progress change is logged with a timestamp — this line starts with your first update.</p>
              )}
            </SectionCard>

            <div className="split">
              <SectionCard className="pad">
                <CardHead title="Time vs work" />
                {tvw ? (
                  <TimeVsWorkBars elapsedPct={tvw.elapsedPct} workPct={tvw.workPct} behind={tvw.behind} ahead={tvw.ahead} />
                ) : (
                  <p className="empty-note">Needs both an assigned date and a deadline.</p>
                )}
              </SectionCard>

              <SectionCard className="pad">
                <CardHead title="Work velocity" />
                {velocity.some((v) => v.count) ? (
                  <BucketColumns rows={velocity.map((v) => ({ label: v.date.slice(5).replace('-', '/'), value: v.count, color: 'var(--accent-1)' }))} height={104} />
                ) : (
                  <p className="empty-note">Complete subtasks to see how fast the work is moving.</p>
                )}
              </SectionCard>
            </div>

            <SectionCard className="pad">
              <CardHead title="Notes" />
              <textarea className="field" rows={4} maxLength={4000} value={assignment.notes || ''}
                placeholder="Brief, requirements, links…" aria-label="Assignment notes"
                onChange={(e) => dispatch({ type: 'UPDATE_ASSIGNMENT', id: assignment.id, patch: { notes: e.target.value } })} />
            </SectionCard>
          </div>

          {/* Rail */}
          <div className="rail stack">
            <SectionCard className="pad">
              <CardHead title="Details" />
              <dl className="kv">
                <dt>Status</dt><dd><StatusPill status={status} /></dd>
                <dt>Subject</dt><dd>{assignment.subject || '—'}</dd>
                <dt>Assigned</dt><dd>{assignment.assignedDate ? shortDate(assignment.assignedDate) : '—'}</dd>
                <dt>Deadline</dt><dd className="tnum">{status.hasDeadline ? prettyDateTime(assignment.deadline) : '—'}</dd>
                <dt>Countdown</dt><dd className="tnum">{status.countdown || '—'}</dd>
                <dt>Priority</dt><dd>{PRIORITIES.find((p) => p.id === assignment.priority)?.label || 'Normal'}</dd>
                <dt>Estimate</dt><dd className="tnum">{Number(assignment.estimateMin) ? minutesLabel(assignment.estimateMin) : '—'}</dd>
                <dt>Project</dt>
                <dd>
                  {project
                    ? <a href={`#/projects/${project.id}`} style={{ color: 'var(--accent-2)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}><IconLink size={13} /> {project.name}</a>
                    : <span className="muted">Standalone</span>}
                </dd>
                <dt>Progress log</dt><dd className="tnum">{(assignment.progressLog || []).length} entries</dd>
              </dl>

              <div style={{ marginTop: 14 }}>
                <button className="btn ghost sm" onClick={() => setEditingDeadline((e) => !e)} aria-expanded={editingDeadline}>
                  <IconClock size={15} /> {editingDeadline ? 'Close deadline editor' : 'Change deadline'}
                </button>
                {editingDeadline && (
                  <div style={{ marginTop: 12 }}>
                    <AssignmentDeadlineField
                      value={assignment.deadline}
                      onChange={(v) => dispatch({ type: 'UPDATE_ASSIGNMENT', id: assignment.id, patch: { deadline: v } })}
                      label="New deadline"
                    />
                  </div>
                )}
              </div>

              {!project && (state.projects || []).filter((p) => !p.archived).length > 0 && (
                <div style={{ marginTop: 14 }}>
                  <label className="field-label" htmlFor="link-project">Link to a project</label>
                  <select id="link-project" className="field" style={{ minHeight: 44 }} value=""
                    onChange={(e) => e.target.value && dispatch({ type: 'UPDATE_ASSIGNMENT', id: assignment.id, patch: { projectId: e.target.value } })}>
                    <option value="">Choose…</option>
                    {(state.projects || []).filter((p) => !p.archived).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
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
                  <dt>Subtasks</dt><dd className="tnum">{history.tasksTotal ? `${history.tasksDone}/${history.tasksTotal}` : '—'}</dd>
                  <dt>Deadline</dt><dd>{history.early == null ? '—' : history.early ? 'Submitted early' : 'Submitted late'}</dd>
                </dl>
              </SectionCard>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function SubtaskRow({ sub: s, assignment, remove }) {
  const work = useWorkUI()
  const reduced = useReducedMotion()
  const controls = useDragControls()

  const row = (
    <div className={`task-row${s.done ? ' is-done' : ''}`}>
      <button className="check-box" data-done={s.done} aria-pressed={s.done}
        aria-label={`Mark ${s.name} ${s.done ? 'not done' : 'done'}`}
        onClick={() => work.toggleSubtask(assignment, s)}>
        {s.done && <IconCheck size={14} />}
      </button>
      <div className="task-main">
        <p className="task-name">{s.name}</p>
        {s.completedAt && <p className="tiny muted" style={{ marginTop: 3 }}>Completed {shortDate(dayOf(s.completedAt))}</p>}
      </div>
      <button className="btn ghost icon" aria-label={`Delete ${s.name}`} onClick={() => remove(s)}>
        <IconX size={15} />
      </button>
      {!reduced && (
        <button className="drag-handle" aria-label={`Reorder ${s.name}`} onPointerDown={(e) => controls.start(e)} style={{ alignSelf: 'center' }}>
          <IconGrip size={17} />
        </button>
      )}
    </div>
  )

  if (reduced) return row
  return (
    <Reorder.Item value={s} as="li" dragListener={false} dragControls={controls}
      style={{ listStyle: 'none', position: 'relative', touchAction: 'pan-y' }}
      whileDrag={{ scale: 1.01, zIndex: 5, boxShadow: 'var(--shadow-2)', borderRadius: 12, background: 'var(--surface-2)' }}>
      {row}
    </Reorder.Item>
  )
}
