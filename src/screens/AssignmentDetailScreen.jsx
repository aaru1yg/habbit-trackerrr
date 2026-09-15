/* ============================================================
   ASSIGNMENT DETAIL — countdown, progress control, subtasks and
   the assignment's own analytics (§69).
   ============================================================ */
import { lazy, Suspense, useMemo, useState } from 'react'
import { Reorder, useDragControls, useReducedMotion } from 'framer-motion'
import useNow from '../lib/useNow.js'
import { useStore } from '../store.jsx'
import { useWorkUI } from '../components/work/WorkUIProvider.jsx'
import { useToast } from '../components/ui/Toaster.jsx'
import SectionCard, { CardHead } from '../components/ui/SectionCard.jsx'
import { StatusPill, KindTag, QuickProgress, WorkEmpty } from '../components/work/WorkKit.jsx'
import DeadlinePressure from '../components/work/DeadlinePressure.jsx'
import { AssignmentDeadlineField } from '../components/work/DeadlineField.jsx'
import WorkFocus from '../components/work/WorkFocus.jsx'
import { assignmentPace } from '../lib/adaptive.js'
import '../styles/workspace.css'
import '../components/work/WorkEntity.css'
const AssignmentAnalytics = lazy(() => import('../components/work/AssignmentAnalytics.jsx'))
import {
  assignmentStatus, assignmentProgress, timeVsWork, itemHistory,
  PRIORITIES, assignmentPressure,
} from '../lib/work.js'
import { shortDate, prettyDateTime,  dayOf, minutesLabel } from '../lib/dates.js'
import {
  IconChevronLeft, IconPlus, IconTrash, IconPencil, IconAssignment, IconCheck, IconGrip,
  IconClock, IconLink, IconX,
} from '../lib/icons.jsx'

export default function AssignmentDetailScreen({ id }) {
  const { state, dispatch } = useStore()
  const work = useWorkUI()
  const toast = useToast()
  const reduced = useReducedMotion()
  const now = useNow()

  const assignment = (state.assignments || []).find((a) => a.id === id) || null
  const [focus, setFocus] = useState(false)
  const [analytics, setAnalytics] = useState(false)
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
            action={<a className="btn primary" href="#/work?view=deliverables">Back to deliverables</a>}
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
  const tvw = timeVsWork(assignment, 'assignment', now)
  const pace = assignmentPace(assignment, { now })
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
    window.location.hash = '#/work?view=deliverables'
  }

  const reorderSubs = (next) => dispatch({ type: 'REORDER_SUBTASKS', id: assignment.id, order: next.map((s) => s.id) })

  return (
    <div className="screen" id="assignment-detail">
      <section className="dlv" style={{maxWidth:'100%'}}>
        <header className="dlv__head">
          <div style={{minWidth:0}}>
            <a href="#/work?view=deliverables" className="dlv__eyebrow" style={{display:'inline-flex',alignItems:'center',gap:4,textDecoration:'none',color:'var(--text-3)'}}>
              <IconChevronLeft size={14} /> Work
            </a>
            <div style={{display:'inline-flex',gap:6,marginTop:6,flexWrap:'wrap'}}>
              <KindTag kind="assignment">Assignment</KindTag>
              <StatusPill status={status} />
              {assignment.priority === 'high' && <span className="chip tag-bad" style={{minHeight:22}}>High priority</span>}
            </div>
            <h1 className="dlv__title" style={{marginTop:4,overflowWrap:'anywhere',fontSize:'1.75rem'}}>{assignment.name}</h1>
            {assignment.subject && <p className="dlv__sub">{assignment.subject}{status.hasDeadline ? <> · <b>Deadline:</b> {prettyDateTime(assignment.deadline)}</> : ''}{project?.name ? ` · ${project.name}` : ''}</p>}
          </div>
          <div className="wo__head-actions-inline">
            <button className="btn ghost icon" aria-label="Edit assignment" onClick={() => work.editAssignment(assignment)}><IconPencil size={17} /></button>
            <button className="btn ghost icon" style={{color:'var(--bad)'}} aria-label="Delete assignment" onClick={remove}><IconTrash size={17} /></button>
          </div>
        </header>

        <div className="dlv__snap" aria-label="Assignment snapshot">
          {[
            { label: 'Progress', value: `${status.pct ?? 0}%`, tone: status.complete ? 'good' : (status.tone === 'danger' || status.id === 'overdue' || status.id === 'urgent') ? 'bad' : status.tone === 'warning' ? 'warn' : null },
            { label: status.complete ? 'Completed' : (status.hasDeadline ? (status.daysLeft === 0 ? 'Due today' : `${status.daysLeft ?? 0}d left`) : 'No deadline'), value: status.complete ? shortDate(dayOf(assignment.completedAt||now)) : (status.hasDeadline ? prettyDateTime(assignment.deadline) : 'Set deadline'), tone: status.complete ? 'good' : status.id === 'overdue' ? 'bad' : status.id === 'urgent' || status.daysLeft === 0 ? 'bad' : status.tone === 'warning' ? 'warn' : null },
            { label: 'Subtasks', value: subs.length ? `${subsDone}/${subs.length}` : '—', tone: subs.length>0 && subsDone===subs.length ? 'good' : null },
            { label: 'Estimate', value: Number(assignment.estimateMin) ? minutesLabel(assignment.estimateMin) : '—', tone: null },
          ].map((s,i) => <span key={i} className={['dlv__pill', s.tone?`is-${s.tone}`:''].join(' ').trim()} style={{cursor:'default'}}>
            <span className="dlv__pill-val tnum">{s.value}</span>
            <span className="dlv__pill-label">{s.label}</span>
          </span>)}
        </div>

        {/* One visual: progress + pace rail (same visual language as Project Detail) */}
        <section className="dlv__pulse" aria-label="Assignment progress vs pace">
          <p className="dlv__pulse-cap">
            <span className="tiny muted">Progress</span>
            <span className="tiny" style={{display:'inline-flex',gap:'var(--sp-3)',flexWrap:'wrap'}}>
              <span style={{color:'var(--text-3)'}}><i style={{display:'inline-block',width:10,height:3,background:'var(--accent-1)',borderRadius:2,verticalAlign:'middle',marginRight:4}}/>Progress</span>
              {status.hasDeadline && status.elapsedPct != null && <span style={{color:'var(--text-3)'}}><i style={{display:'inline-block',width:10,height:0,borderTop:'2px dashed var(--text-3)',verticalAlign:'middle',marginRight:4}}/>Pace</span>}
              {!status.complete && (status.id==='overdue' || status.id==='urgent' || (status.daysLeft != null && status.daysLeft <= 1)) && <span style={{color: status.id==='overdue' ? 'var(--bad)' : 'var(--warn)'}}><i style={{display:'inline-block',width:8,height:8,borderRadius:2,background: status.id==='overdue'?'var(--bad)':'var(--warn)',marginRight:4,verticalAlign:'middle'}}/>{status.countdown || 'Due now'}</span>}
            </span>
          </p>
          <div style={{position:'relative',height:14,background:'var(--surface-2)',borderRadius:'6px',overflow:'hidden'}} role="img" aria-label={`Progress ${status.pct??0}%`}>
            <div style={{width:`${Math.min(100,status.pct??0)}%`,height:'100%',background: status.complete?'var(--good)': (status.tone==='danger' || status.id==='overdue') ? 'var(--bad)' : 'var(--accent-1)',borderRadius:'6px',transition:'width .2s ease'}}/>
            {status.hasDeadline && status.elapsedPct != null && <div style={{position:'absolute',top:-2,bottom:-2,left:`${Math.min(100,Math.max(0,status.elapsedPct))}%`,width:2,background:'var(--text-3)'}} title="Time elapsed pace"/>}
          </div>
          <p className="tiny muted" style={{marginTop:8,lineHeight:1.6}}>
            {100 - (status.pct??0)}% remains{Number(assignment.estimateMin) > 0 ? <> · ~{minutesLabel(Math.round(assignment.estimateMin * (1 - (status.pct??0)/100)))} estimated remaining</> : ' · Effort not estimated'}{subs.length ? <> · {subsDone}/{subs.length} subtasks complete</> : ''}.
          </p>
          <details className="assignment-progress-controls" style={{marginTop:10}}><summary>Update progress</summary><QuickProgress value={progress.mode === 'subtasks' ? progress.pct : assignment.progress} onChange={pct => work.setAssignmentProgress(assignment, pct)} label={progress.mode === 'subtasks' ? 'Progress (synced with subtasks)' : 'Progress'} /></details>
        </section>

        {/* Needs attention when real risk present */}
        {!status.complete && (status.id === 'overdue' || status.id === 'urgent' || (status.behind != null && status.behind > 15)) && <section className="dlv__focus" style={{borderLeft:'3px solid var(--bad)',marginBottom:'var(--sp-4)'}} aria-label="Needs attention">
          <p className="dlv__eyebrow" style={{color:'var(--bad)'}}>Needs attention</p>
          <p className="tiny" style={{margin:'4px 0 0'}}>
            {status.id === 'overdue' ? 'Past due.' : status.id === 'urgent' ? 'Due today.' : `Behind pace by ${status.behind} points.`}
            {' '}Start a focus session or extend the deadline.
          </p>
        </section>}
      </section>

      <section className="assignment-next-action" style={{marginBottom:'var(--sp-4)'}}>
        {status.hasDeadline && <p className="tiny" style={{margin:'0 0 var(--sp-2)',color: status.id==='overdue'?'var(--bad)':'var(--text-2)'}}><b>Deadline:</b> {prettyDateTime(assignment.deadline)} · {status.countdown}</p>}
        <h2 style={{font:'var(--fw-semibold) var(--fs-sm)/1 var(--font-family)',textTransform:'uppercase',letterSpacing:'.08em',color:'var(--text-2)',margin:'0 0 var(--sp-2)'}}>Next action</h2>
        <p style={{margin:'0 0 var(--sp-2)'}}>{status.complete ? 'Work complete.' : subs.find(s => !s.done)?.name || 'Make progress on this deliverable.'}</p>
        <div style={{display:'inline-flex',gap:'var(--sp-2)',flexWrap:'wrap'}}>
          {!status.complete && <button className="btn primary" onClick={() => setFocus(true)}>Start Focus</button>}
          {project && <a className="btn ghost" href={`#/projects/${project.id}`}>Project: {project.name}</a>}
        </div>
      </section>
      {focus && <WorkFocus item={{ ...assignment, kind: 'assignment' }} onClose={() => setFocus(false)} />}

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

            <SectionCard className="pad"><CardHead title="Forecast / pressure" /><DeadlinePressure pressure={assignmentPressure(assignment, now)} size="lg" /><p className="tiny muted">{tvw ? `${tvw.elapsedPct}% of time elapsed · ${tvw.workPct}% work completed` : 'Set an assigned date and deadline to compare expected and actual progress.'}</p><p className="tiny muted">{pace.requiredPace != null ? `${minutesLabel(pace.requiredPace)} per day required.` : pace.reason || 'Add an effort estimate to see the required pace.'}</p></SectionCard>
            <details className="assignment-analytics" onToggle={e => { if (e.currentTarget.open) setAnalytics(true) }}><summary>Progress analytics and velocity</summary>{analytics && <Suspense fallback={<p role="status">Loading analytics…</p>}><AssignmentAnalytics assignment={assignment} now={now} /></Suspense>}</details>

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
