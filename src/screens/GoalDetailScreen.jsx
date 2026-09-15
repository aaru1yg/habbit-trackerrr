/* ============================================================
   GOAL DETAIL (Step 6C) — deep execution view for one goal.
   Long arcs, not rings — the trajectory is the dominant visual.
   ============================================================ */
import { Suspense, lazy, useMemo, useState } from 'react'
import { useStore } from '../store.jsx'
import { useToast } from '../components/ui/Toaster.jsx'
import SectionCard, { CardHead } from '../components/ui/SectionCard.jsx'
import Sheet from '../components/ui/Sheet.jsx'
import EmptyState from '../components/ui/EmptyState.jsx'
import GoalFormSheet from '../components/goals/GoalForm.jsx'
import {
  areaOf, goalProgress, goalHealth, goalPace, nextMilestone, goalTodayActions,
} from '../lib/goals.js'
import { goalAnalytics } from '../lib/goalAnalytics.js'
import { goalForecast } from '../lib/adaptive.js'
import { habitStreak, activeHabits } from '../lib/stats.js'
import { projectProgress, assignmentProgress } from '../lib/work.js'
import { todayStr, prettyDate, shortDate, dayOf, isValidDayStr, daysUntil, daysBetween } from '../lib/dates.js'
import { Link } from '../lib/router.jsx'
import {
  IconChevronRight, IconCheck, IconGoals, IconPlus, IconPencil, IconTrash,
  IconArchive, IconLink, IconClock, IconLayers,
  IconFlame, IconChevronLeft,
} from '../lib/icons.jsx'
import '../styles/goals.css'

const GoalAtlas = lazy(() => import('../components/goals/GoalAtlas.jsx'))

const HEALTH = {
  complete: { text: 'Completed', tone: 'good' },
  overdue:  { text: 'Overdue', tone: 'bad' },
  risk:     { text: 'At risk', tone: 'warn' },
  ahead:    { text: 'Ahead', tone: 'good' },
  onTrack:  { text: 'On track', tone: 'neutral' },
  safe:     { text: 'No date', tone: 'neutral' },
}
function goalHealthLabel(state, goal, { now = new Date() } = {}) {
  const h = goalHealth(state, goal, { now })
  if (goal.status === 'completed' || h.prog?.pct >= 100) return HEALTH.complete
  if (h.daysLeft != null && h.daysLeft < 0) return HEALTH.overdue
  if (!goal.targetDate) return HEALTH.safe
  if (h.tone === 'warn') return HEALTH.risk
  if (h.tone === 'good') return HEALTH.ahead
  return HEALTH.onTrack
}

function momentumText(prog, pace, analytics, forecast) {
  if (prog.pct >= 100) return { text: 'Completed', tone: 'good' }
  if (forecast.reason === 'stalled') return { text: 'Stalled', tone: 'bad' }
  const behind = pace ? pace.expected - prog.pct : null
  if (behind != null) {
    if (behind > 15) return { text: `${behind} pts behind pace`, tone: 'warn' }
    if (behind < -10) return { text: `${Math.abs(behind)} pts ahead`, tone: 'good' }
  }
  if (analytics.velocity?.perWeek > 0) return { text: `${analytics.velocity.perWeek} pts / week`, tone: 'neutral' }
  return { text: 'Getting started', tone: 'neutral' }
}

export default function GoalDetailScreen({ id }) {
  const { state, dispatch } = useStore()
  const toast = useToast()
  const today = todayStr()
  const now = new Date()
  const goal = (state.goals || []).find((g) => g.id === id && !g.archived)

  const [form, setForm] = useState({ open: false, editing: null })
  const [confirm, setConfirm] = useState(null)
  const [linkOpen, setLinkOpen] = useState(false)
  const [atlasOpen, setAtlasOpen] = useState(false)

  // Hooks must run unconditionally — compute against a stable fallback when goal missing.
  const emptyGoal = useMemo(() => ({ milestones: [], linkedHabitIds: [], linkedProjectIds: [], linkedAssignmentIds: [] }), [])
  const safeGoal = goal || emptyGoal
  const area = areaOf(safeGoal.area)
  const health = goalHealthLabel(state, safeGoal, { now })
  const prog = goalProgress(state, safeGoal, { now })
  const pace = goalPace(safeGoal, { now })
  const analytics = goalAnalytics(state, safeGoal, { days: 30, now })
  const forecast = goalForecast(state, safeGoal, { now })
  const actions = goal ? goalTodayActions(state, safeGoal, { date: today }) : []
  const pending = actions.filter((a) => !a.done)
  const ms = useMemo(() => [...(safeGoal.milestones || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)), [safeGoal])
  const msDone = ms.filter((m) => m.done).length
  const next = nextMilestone(safeGoal)
  const isReached = goal && (health.tone === 'good' && health.text === 'Completed')
  const daysLeft = isValidDayStr(safeGoal.targetDate) ? daysUntil(safeGoal.targetDate, now) : null

  const linkedHabits = (safeGoal.linkedHabitIds || [])
    .map((hid) => (state.habits || []).find((h) => h.id === hid)).filter((h) => h && !h.archived)
  const linkedProjects = (safeGoal.linkedProjectIds || [])
    .map((pid) => (state.projects || []).find((p) => p.id === pid)).filter((p) => p && !p.archived)
  const linkedAssignments = (safeGoal.linkedAssignmentIds || [])
    .map((aid) => (state.assignments || []).find((a) => a.id === aid)).filter((a) => a && !a.archived)
  const allHabits = activeHabits(state)
  const openProjects = (state.projects || []).filter((p) => !p.archived && !p.completedAt)
  const openAssignments = (state.assignments || []).filter((a) => !a.archived && !a.completedAt)
  const linkedCount = linkedHabits.length + linkedProjects.length + linkedAssignments.length

  if (!goal) {
    return (
      <div className="screen">
        <EmptyState art="art/empty-goals.webp" icon={<IconGoals size={40} />} title="Goal not found">
          It may have been archived or deleted on this device.
          <div style={{ marginTop: 12 }}>
            <Link to="goals" className="btn primary sm">All goals</Link>
          </div>
        </EmptyState>
      </div>
    )
  }

  const archive = () => {
    dispatch({ type: 'UPDATE_GOAL', id: goal.id, patch: { archived: true, status: 'archived' } })
    setConfirm(null)
    toast.show(`Archived "${goal.title}"`, { duration: 6000, actionLabel: 'Undo', onAction: () => dispatch({ type: 'UPDATE_GOAL', id: goal.id, patch: { archived: false, status: 'active' } }) })
  }
  const remove = () => {
    dispatch({ type: 'DELETE_GOAL', id: goal.id })
    setConfirm(null)
    toast.show(`Deleted "${goal.title}"`, { duration: 6000, actionLabel: 'Undo', onAction: () => dispatch({ type: 'RESTORE_GOAL', goal }) })
  }
  const toggle = (key, lid) => {
    const on = (goal[key] || []).includes(lid)
    dispatch({ type: 'UPDATE_GOAL', id: goal.id, patch: { [key]: on ? goal[key].filter((x) => x !== lid) : [...(goal[key] || []), lid] } })
  }
  const toggleMs = (mid) => dispatch({ type: 'TOGGLE_GOAL_MILESTONE', id: goal.id, milestoneId: mid })

  const projectedText = forecast.projectedCompletion && forecast.reason === 'projected'
    ? prettyDate(dayOf(forecast.projectedCompletion)) : null
  const momentum = momentumText(prog, pace, analytics, forecast)

  const snapshot = [
    { label: 'Progress', val: `${prog.pct}%` },
    ...(pace && daysLeft != null ? [{ label: daysLeft < 0 ? 'Late' : daysLeft === 0 ? 'Due' : 'Days left', val: Math.abs(daysLeft), tone: daysLeft < 0 ? 'bad' : pace.expected - prog.pct > 15 ? 'warn' : undefined }] : goal.targetDate ? [{ label: 'Target', val: prettyDate(goal.targetDate) }] : []),
    ...(projectedText ? [{ label: 'Projected', val: projectedText, tone: forecast.deadline && new Date(forecast.projectedCompletion) > new Date(forecast.deadline) ? 'warn' : 'good' }] : []),
    ...(ms.length > 0 ? [{ label: 'Milestones', val: `${msDone}/${ms.length}` }] : []),
    { label: 'Momentum', val: momentum.text, tone: momentum.tone },
    ...(linkedCount > 0 ? [{ label: 'Linked', val: linkedCount }] : []),
  ]

  const riskText = isReached ? 'Outcome reached.'
    : health.text === 'Overdue' ? `Target date passed (${prettyDate(goal.targetDate)}). ${prog.pct}% reached.`
    : health.text === 'At risk' ? `${prog.pct}% done vs ${pace?.expected ?? 0}% expected — ${(pace?.expected ?? 0) - prog.pct} points behind pace.`
    : health.text === 'Ahead' ? 'Ahead of pace. Keep the momentum.'
    : health.text === 'On track' ? (pace ? `${prog.pct}% done · ${pace.expected}% through the window.` : `${prog.pct}% done.`)
    : prog.detail

  return (
    <div className="screen" id="goal-detail-screen">
      <div className="dlv">
        <p className="dlv__eyebrow">
          <Link to="goals" className="dlv__back" aria-label="Back to all goals">
            <IconChevronLeft size={14} /> Goals
          </Link>
        </p>

        <div className="goal-detail__head">
          <div className="goal-detail__titleblock">
            <div className="goal-row__eyebrow">
              <span className="chip" style={{ color: `var(${area.cssVar})` }}>
                <span className="dot" style={{ background: `var(${area.cssVar})` }} />{area.label}
              </span>
              <span className="status-pill" data-tone={health.tone}>{health.text}</span>
              {goal.targetDate && (
                <span className="chip" style={{ color: 'var(--text-3)' }}>
                  <IconClock size={12} />
                  {isReached ? (goal.completedAt ? prettyDate(dayOf(goal.completedAt)) : 'Reached')
                    : daysLeft < 0 ? `${Math.abs(daysLeft)}d late`
                    : daysLeft === 0 ? 'Due today'
                    : `${prettyDate(goal.targetDate)} · ${daysLeft}d left`}
                </span>
              )}
            </div>
            <h1 className="dlv__title" style={{ fontSize: 'clamp(1.6rem, 2.8vw, 2.1rem)', margin: '4px 0 0' }}>{goal.title}</h1>
            {goal.why && <p className="dlv__sub">{goal.why}</p>}
          </div>
          <div className="wo__head-actions-inline" style={{ marginBottom: 0 }}>
            <button className="btn ghost sm" onClick={() => setForm({ open: true, editing: goal })} aria-label="Edit goal"><IconPencil size={15} /> Edit</button>
            <button className="btn ghost sm" onClick={() => setLinkOpen((v) => !v)} aria-expanded={linkOpen} aria-label="Link work"><IconLink size={15} /> Link</button>
            <button className="btn ghost sm" onClick={() => setAtlasOpen((v) => !v)} aria-expanded={atlasOpen} aria-label="Explore connections">
              <IconLayers size={15} /> {atlasOpen ? 'Hide atlas' : 'Atlas'}
            </button>
            <button className="btn ghost sm" onClick={() => setConfirm('archive')} aria-label="Archive goal"><IconArchive size={15} /></button>
            <button className="btn ghost sm" style={{ color: 'var(--bad)' }} onClick={() => setConfirm('delete')} aria-label="Delete goal"><IconTrash size={15} /></button>
          </div>
        </div>

        <div className="dlv__snap">
          {snapshot.map((c, i) => (
            <span key={i} className={`dlv__pill${c.tone ? ` is-${c.tone}` : ''}`} style={{ cursor: 'default' }}>
              <span className="dlv__pill-val">{c.val}</span>
              <span className="dlv__pill-label">{c.label}</span>
            </span>
          ))}
        </div>

        <section className="goal-detail__trajectory" aria-label={`${goal.title} trajectory`}>
          <div className="goal-detail__trajectory-head">
            <h2 style={{ font: 'var(--fw-semibold) var(--fs-sm)/1 var(--font-family)', textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--text-2)', margin: 0 }}>Trajectory</h2>
            <p className="tiny muted" data-tone={health.tone} style={{ margin: 0 }}>{riskText}</p>
          </div>
          <DetailTrajectory
            actual={analytics.actual}
            prog={prog}
            pace={pace}
            milestones={ms}
            isReached={!!isReached}
            projection={forecast}
            today={today}
            areaVar={area.cssVar}
            tone={health.tone}
            ariaLabel={`${goal.title}: ${prog.pct}% complete${pace ? `, ${pace.expected}% expected by today` : ''}.`}
          />
        </section>

        {!isReached && (health.tone === 'bad' || health.tone === 'warn') && (
          <section className="dlv__focus" style={{ borderLeft: `3px solid var(--${health.tone})`, marginBottom: 'var(--sp-3)' }} aria-label="Needs attention">
            <p className="dlv__eyebrow" style={{ color: `var(--${health.tone})`, margin: 0 }}>Needs attention</p>
            <p style={{ margin: '4px 0 0' }}>{riskText}</p>
            {next && <p className="tiny muted" style={{ margin: '4px 0 0' }}>Next milestone: <b>{next.name}</b>{isValidDayStr(next.targetDate) ? ` · by ${prettyDate(next.targetDate)}` : ''}</p>}
          </section>
        )}

        <div className="dlv__grid">
          <div className="dlv__list stack">
            <SectionCard className="pad">
              <CardHead title="Next milestone">
                {ms.length > 0 && <span className="tiny muted tnum">{msDone} of {ms.length} reached</span>}
              </CardHead>
              {next ? (
                <div className="goal-next-row" style={{ marginTop: 6 }}>
                  <button type="button" className="goal-next-toggle" aria-pressed={!!next.done} onClick={() => toggleMs(next.id)}>
                    <span className="ms-box" aria-hidden="true">{next.done ? <IconCheck size={13} /> : null}</span>
                    <span className="goal-next-name">{next.name}</span>
                    {isValidDayStr(next.targetDate) && <span className="goal-next-date tnum">by {prettyDate(next.targetDate)}</span>}
                    <IconChevronRight size={14} className="goal-next-open" aria-hidden="true" />
                  </button>
                </div>
              ) : ms.length === 0 ? (
                <div className="empty-milestone" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                  <button type="button" className="btn ghost sm" onClick={() => setForm({ open: true, editing: goal })}><IconPlus size={14} /> Add a milestone</button>
                  <span className="tiny muted">No milestones yet — progress derives from linked work or manual percent.</span>
                </div>
              ) : (
                <p className="goal-reached-note">All milestones reached.</p>
              )}
            </SectionCard>

            {actions.length > 0 && (
              <SectionCard className="pad">
                <CardHead title="Today's contribution">
                  <span className="tiny muted tnum">{pending.length} open</span>
                </CardHead>
                {pending.length === 0 ? (
                  <p className="pace-note" data-tone="good" style={{ margin: 0 }}><IconCheck size={14} /> Everything this goal needs today is done.</p>
                ) : (
                  <ul className="feed-actions">
                    {pending.map((a) => (
                      <li key={`${a.kind}-${a.id}`}>
                        <Link to={a.kind === 'habit' ? `habits/${a.id}` : a.kind === 'task' ? 'projects' : `assignments/${a.id}`} className="feed-row">
                          <span className="feed-kind">{a.kind}</span>
                          <span className="feed-name ellipsis">{a.name}</span>
                          <IconChevronRight size={14} />
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </SectionCard>
            )}

            <SectionCard className="pad">
              <CardHead title="Milestones" />
              {ms.length === 0 ? (
                <div className="empty-milestone" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                  <button type="button" className="btn ghost sm" onClick={() => setForm({ open: true, editing: goal })}><IconPlus size={14} /> Add a milestone</button>
                  <span className="tiny muted">Checkpoints make the arc concrete.</span>
                </div>
              ) : (
                <MilestoneTimeline ms={ms} onToggle={toggleMs} />
              )}
            </SectionCard>

            <SectionCard className="pad">
              <CardHead title="Progress analytics">
                <span className="tiny muted">Actual · expected · projection</span>
              </CardHead>
              <AnalyticsSurface
                actual={analytics.actual}
                expected={analytics.expected}
                prog={prog}
                pace={pace}
                velocity={analytics.velocity}
                consistency={analytics.consistency}
                projection={forecast}
                milestones={ms}
                isReached={!!isReached}
                today={today}
                areaVar={area.cssVar}
                tone={health.tone}
              />
            </SectionCard>

            {goal.notes && (
              <SectionCard className="pad">
                <CardHead title="Notes" />
                <p style={{ color: 'var(--text-2)', fontSize: 'var(--fs-sm)', lineHeight: 1.6, whiteSpace: 'pre-wrap', margin: 0 }}>{goal.notes}</p>
              </SectionCard>
            )}

            <SectionCard className="pad">
              <CardHead title="Manage goal" />
              <div className="goal-detail-actions manage">
                <button className="btn" onClick={() => setForm({ open: true, editing: goal })}><IconPencil size={15} /> Edit</button>
                <button className="btn" onClick={() => setConfirm('archive')}><IconArchive size={15} /> Archive</button>
                <button className="btn" style={{ color: 'var(--bad)' }} onClick={() => setConfirm('delete')}><IconTrash size={15} /> Delete</button>
              </div>
            </SectionCard>
          </div>

          <aside className="dlv__side stack">
            <SectionCard className="pad">
              <CardHead title="Forecast">
                <span className="goal-risk" style={{
                  color: health.tone === 'good' ? 'var(--good)' : health.tone === 'warn' ? 'var(--warn)' : health.tone === 'bad' ? 'var(--bad)' : 'var(--text-2)',
                }}>{health.text}</span>
              </CardHead>
              <dl className="kv" style={{ margin: '6px 0 0' }}>
                <div><dt>Progress</dt><dd className="tnum">{prog.pct}%</dd></div>
                {pace && <div><dt>Expected today</dt><dd className="tnum">{pace.expected}%</dd></div>}
                <div><dt>Target</dt><dd className="tnum">{goal.targetDate ? prettyDate(goal.targetDate) : '—'}</dd></div>
                <div><dt>Projected</dt><dd className="tnum">{projectedText || '—'}</dd></div>
                {forecast.requiredPacePerDay != null && prog.pct < 100 && <div><dt>Required pace</dt><dd className="tnum">{Math.round(forecast.requiredPacePerDay)}% / day</dd></div>}
                {analytics.velocity?.perWeek > 0 && <div><dt>Velocity</dt><dd className="tnum">{analytics.velocity.perWeek} pts / wk</dd></div>}
                {analytics.consistency?.pct != null && <div><dt>Consistency</dt><dd className="tnum">{analytics.consistency.pct}%</dd></div>}
              </dl>
              <p className="tiny muted" style={{ marginTop: 8, marginBottom: 0 }}>{forecast.reason}</p>
            </SectionCard>

            <SectionCard className="pad">
              <CardHead title="What feeds this goal">
                <button type="button" className="btn ghost sm" onClick={() => setLinkOpen((v) => !v)} aria-expanded={linkOpen} style={{ padding: '2px 8px', minHeight: 28 }}>
                  <IconLink size={13} /> {linkOpen ? 'Done' : 'Link'}
                </button>
              </CardHead>
              {linkedCount === 0 && !linkOpen ? (
                <p className="tiny muted" style={{ margin: 0 }}>Nothing linked yet. Link habits or work to feed progress automatically.</p>
              ) : (
                <div className="stack" style={{ gap: 6 }}>
                  {linkedHabits.map((h) => (
                    <Link key={h.id} to={`habits/${h.id}`} className="feed-row">
                      <span className="feed-kind habit">habit</span>
                      <span className="feed-name ellipsis">{h.name}</span>
                      {habitStreak(state, h) > 1 && <span className="tiny tnum" style={{ color: 'var(--warn)', display: 'inline-flex', gap: 3, alignItems: 'center' }}><IconFlame size={12} />{habitStreak(state, h)}d</span>}
                      <IconChevronRight size={14} />
                    </Link>
                  ))}
                  {linkedProjects.map((p) => (
                    <Link key={p.id} to={`projects/${p.id}`} className="feed-row">
                      <span className="feed-kind project">project</span>
                      <span className="feed-name ellipsis">{p.name}</span>
                      <span className="tiny muted tnum">{projectProgress(p).pct}%</span>
                      <IconChevronRight size={14} />
                    </Link>
                  ))}
                  {linkedAssignments.map((a) => (
                    <Link key={a.id} to={`assignments/${a.id}`} className="feed-row">
                      <span className="feed-kind assignment">assignment</span>
                      <span className="feed-name ellipsis">{a.name}</span>
                      <span className="tiny muted tnum">{assignmentProgress(a).pct}%</span>
                      <IconChevronRight size={14} />
                    </Link>
                  ))}
                </div>
              )}
              {linkOpen && (
                <div className="goal-links" style={{ marginTop: 10 }}>
                  <p className="field-label" style={{ marginTop: 4 }}>Habits</p>
                  {allHabits.length === 0 ? <p className="tiny muted">Add a habit first.</p> : (
                    <div className="wrap-gap" style={{ gap: 6 }}>
                      {allHabits.map((h) => {
                        const on = (goal.linkedHabitIds || []).includes(h.id)
                        return <button key={h.id} type="button" className="chip-btn" aria-pressed={on} onClick={() => toggle('linkedHabitIds', h.id)}>{on && <IconCheck size={13} />}{h.name}</button>
                      })}
                    </div>
                  )}
                  <p className="field-label" style={{ marginTop: 12 }}>Projects</p>
                  {openProjects.length === 0 ? <p className="tiny muted">No open projects yet.</p> : (
                    <div className="wrap-gap" style={{ gap: 6 }}>
                      {openProjects.map((p) => {
                        const on = (goal.linkedProjectIds || []).includes(p.id)
                        return <button key={p.id} type="button" className="chip-btn" aria-pressed={on} onClick={() => toggle('linkedProjectIds', p.id)}>{on && <IconCheck size={13} />}{p.name}</button>
                      })}
                    </div>
                  )}
                  <p className="field-label" style={{ marginTop: 12 }}>Assignments</p>
                  {openAssignments.length === 0 ? <p className="tiny muted">No open assignments yet.</p> : (
                    <div className="wrap-gap" style={{ gap: 6 }}>
                      {openAssignments.map((a) => {
                        const on = (goal.linkedAssignmentIds || []).includes(a.id)
                        return <button key={a.id} type="button" className="chip-btn" aria-pressed={on} onClick={() => toggle('linkedAssignmentIds', a.id)}>{on && <IconCheck size={13} />}{a.name}</button>
                      })}
                    </div>
                  )}
                </div>
              )}
            </SectionCard>

            {atlasOpen && (
              <Suspense fallback={<div className="card pad" style={{ minHeight: 180 }} role="status">Loading atlas…</div>}>
                <GoalAtlas goals={[goal]} />
              </Suspense>
            )}
          </aside>
        </div>
      </div>

      <GoalFormSheet open={form.open} onClose={() => setForm({ open: false, editing: null })} editing={form.editing || goal} />

      <Sheet open={confirm === 'delete'} onClose={() => setConfirm(null)} title="Delete goal"
        footer={<>
          <button className="btn" onClick={() => setConfirm(null)}>Cancel</button>
          <button className="btn" style={{ background: 'var(--bad)', color: 'var(--bg-deep)', borderColor: 'transparent' }} onClick={remove}>Delete goal</button>
        </>}>
        <p className="card-blurb">Delete "{goal.title}" and its milestones? An undo toast is available for a short window.</p>
      </Sheet>
      <Sheet open={confirm === 'archive'} onClose={() => setConfirm(null)} title="Archive goal"
        footer={<>
          <button className="btn" onClick={() => setConfirm(null)}>Cancel</button>
          <button className="btn" onClick={archive}>Archive goal</button>
        </>}>
        <p className="card-blurb">Archive "{goal.title}"? It will leave your open goals.</p>
      </Sheet>
    </div>
  )
}

/* ------------------------------------------------------------
   DETAIL TRAJECTORY — larger, readable than the overview strip.
   ------------------------------------------------------------ */
function DetailTrajectory({ actual, prog, pace, milestones, isReached, projection, today, areaVar, tone, ariaLabel }) {
  const W = 780, H = 200, L = 44, R = 16, T = 18, B = 38
  const n = actual.length
  const projDays = projection?.reason === 'projected' && projection.daysLeft != null
    ? Math.min(Math.max(0, projection.daysLeft), 30) : 0
  const total = Math.max(1, n - 1 + projDays)
  const x = (i) => L + (i / total) * (W - L - R)
  const y = (v) => T + (1 - Math.max(0, Math.min(100, v)) / 100) * (H - T - B)

  const pts = actual.map((r, i) => ({ ...r, i, x: x(i), y: r.pct == null ? null : y(r.pct) }))
  let d = ''; let started = false
  pts.forEach((p) => {
    if (p.y == null) { started = false; return }
    d += (started ? 'L' : 'M') + p.x.toFixed(1) + ' ' + p.y.toFixed(1) + ' '; started = true
  })
  d = d.trim()

  let ed = ''
  if (pace && pace.start && pace.end) {
    const t0 = new Date(`${pace.start}T00:00`).getTime()
    const t1 = new Date(`${pace.end}T23:59`).getTime()
    const tNow = new Date(`${today}T12:00`).getTime()
    const todayI = Math.max(0, Math.min(total, ((tNow - t0) / (t1 - t0)) * (n - 1)))
    const todayX = x(todayI)
    ed = `M${L} ${y(0).toFixed(1)} L${todayX.toFixed(1)} ${y(pace.expected).toFixed(1)}`
    if (!isReached && tNow <= t1) {
      const targetI = Math.min(total, n - 1)
      ed += ` L${x(targetI).toFixed(1)} ${y(100).toFixed(1)}`
    }
  }

  let projD = ''
  if (projDays > 0 && !isReached) {
    const last = [...pts].reverse().find((p) => p.y != null)
    if (last) {
      const endI = n - 1 + projDays
      projD = `M${last.x.toFixed(1)} ${last.y.toFixed(1)} L${x(endI).toFixed(1)} ${y(100).toFixed(1)}`
    }
  }

  const known = pts.filter((p) => p.y != null)
  const last = known[known.length - 1]
  const todayIdx = (() => {
    if (!pace) return n - 1
    const t0 = new Date(`${pace.start}T00:00`).getTime()
    const t1 = new Date(`${pace.end}T23:59`).getTime()
    const tNow = new Date(`${today}T12:00`).getTime()
    return Math.max(0, Math.min(total, ((tNow - t0) / (t1 - t0)) * (n - 1)))
  })()
  const todayX = x(todayIdx)

  const msDots = milestones.map((m) => {
    let cx, cy
    if (m.done) {
      cx = last ? last.x : x(n - 1); cy = last ? last.y : y(prog.pct)
      if (m.doneAt && isValidDayStr(dayOf(m.doneAt))) {
        const day = dayOf(m.doneAt)
        const hit = pts.find((p) => p.day === day && p.y != null)
        if (hit) { cx = hit.x; cy = hit.y }
      }
    } else {
      if (pace && isValidDayStr(m.targetDate)) {
        const t0 = new Date(`${pace.start}T00:00`).getTime()
        const t1 = new Date(`${pace.end}T23:59`).getTime()
        const tm = new Date(`${m.targetDate}T12:00`).getTime()
        const pctAlong = Math.max(0, Math.min(1.2, (tm - t0) / (t1 - t0)))
        const i = pctAlong * total
        cx = x(Math.min(i, total)); cy = y(Math.min(100, Math.round(pctAlong * 100)))
      } else {
        cx = x(n - 1); cy = y(prog.pct)
      }
    }
    return { m, cx, cy }
  })

  const stroke = isReached ? 'var(--good)' : `var(${areaVar})`
  const expStroke = tone === 'bad' ? 'var(--bad)' : tone === 'warn' ? 'var(--warn)' : 'var(--text-3)'
  const days = actual.map((r) => r.day)
  const xLabels = n <= 4 ? days.map((_, i) => i) : Array.from({ length: 5 }, (_, k) => Math.round((k * (n - 1)) / 4))

  return (
    <div className="goal-detail__trajectory-viz">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-label={ariaLabel} preserveAspectRatio="none">
        <defs>
          <linearGradient id="gtraj-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity="0.22" />
            <stop offset="100%" stopColor={stroke} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 25, 50, 75, 100].map((v) => (
          <g key={v}>
            <line x1={L} y1={y(v)} x2={W - R} y2={y(v)} stroke="var(--border)" strokeDasharray={v === 0 ? '0' : '2 4'} />
            <text x={L - 8} y={y(v) + 3} textAnchor="end" fontSize="10" fill="var(--text-3)" style={{ fontVariantNumeric: 'tabular-nums' }}>{v}</text>
          </g>
        ))}
        {xLabels.filter((i) => days[i]).map((i) => (
          <text key={i} x={i === 0 ? L : i >= n - 1 ? W - R : x(i)} y={H - 14}
            textAnchor={i === 0 ? 'start' : i >= n - 1 ? 'end' : 'middle'}
            fontSize="10" fill="var(--text-3)">{shortDate(days[i])}</text>
        ))}
        {ed && <path d={ed} fill="none" stroke={expStroke} strokeWidth="1.6" strokeDasharray="4 5" opacity="0.85" />}
        {projD && <path d={projD} fill="none" stroke={stroke} strokeWidth="2" strokeDasharray="3 4" opacity="0.55" />}
        {d && (() => {
          const kp = pts.filter((p) => p.y != null)
          if (kp.length < 2) return null
          let area = `M${kp[0].x.toFixed(1)} ${y(0).toFixed(1)}`
          kp.forEach((p) => { area += `L${p.x.toFixed(1)} ${p.y.toFixed(1)}` })
          area += `L${kp[kp.length - 1].x.toFixed(1)} ${y(0).toFixed(1)}Z`
          return <path d={area} fill="url(#gtraj-fill)" />
        })()}
        {d && <path d={d} fill="none" stroke={stroke} strokeWidth="2.6" strokeLinejoin="round" strokeLinecap="round" />}
        {last && <circle cx={last.x} cy={last.y} r="4.5" fill="var(--surface-solid)" stroke={stroke} strokeWidth="2.2" />}
        {msDots.map(({ m, cx, cy }, i) => (
          <g key={m.id || i}>
            <circle cx={cx} cy={cy} r={m.done || isReached ? 4.5 : 4}
              fill={m.done || isReached ? stroke : 'var(--surface-solid)'}
              stroke={stroke} strokeWidth="2" />
            {isValidDayStr(m.targetDate) && !m.done && (
              <text x={cx} y={cy - 9} textAnchor="middle" fontSize="9.5" fill="var(--text-3)">{m.name.length > 14 ? m.name.slice(0, 13) + '…' : m.name}</text>
            )}
          </g>
        ))}
        <line x1={todayX} y1={T - 4} x2={todayX} y2={H - B + 4} stroke={stroke} strokeWidth="1.5" strokeDasharray="1 2" opacity="0.65" />
        <polygon points={`${todayX - 4},${H - B + 6} ${todayX + 4},${H - B + 6} ${todayX},${H - B}`} fill={stroke} opacity="0.75" />
        <text x={todayX} y={H - 2} textAnchor="middle" fontSize="10" fontWeight="700" fill={stroke}>Today</text>
      </svg>
      <div className="pace-legend" style={{ marginTop: 6 }} aria-hidden="true">
        <span><i style={{ background: stroke, height: 3, top: -1 }} /> actual</span>
        {ed && <span><i className="pace-legend-expected" style={{ borderTop: `2px dashed ${expStroke}`, background: 'transparent' }} /> expected</span>}
        {projD && <span><i style={{ display: 'inline-block', width: 16, height: 0, borderTop: `2px dashed ${stroke}`, opacity: 0.6, marginRight: 6, position: 'relative', top: -3 }} /> projected</span>}
        {milestones.length > 0 && <span><i className="dot" style={{ background: stroke, width: 8, height: 8, borderRadius: '50%', display: 'inline-block', marginRight: 6 }} /> milestone</span>}
      </div>
    </div>
  )
}

function MilestoneTimeline({ ms, onToggle }) {
  const done = ms.filter((m) => m.done)
  const upcoming = ms.filter((m) => !m.done)
  return (
    <div className="ms-timeline">
      {upcoming.length > 0 && (
        <div className="ms-group">
          <p className="ms-group-label">Upcoming</p>
          <div className="ms-list">
            {upcoming.map((m) => (
              <button key={m.id} type="button" className="goal-next-toggle" aria-pressed={false} onClick={() => onToggle(m.id)}>
                <span className="ms-box" aria-hidden="true" />
                <span className="goal-next-name">{m.name}</span>
                {isValidDayStr(m.targetDate) && <span className="goal-next-date tnum">{prettyDate(m.targetDate)}</span>}
              </button>
            ))}
          </div>
        </div>
      )}
      {done.length > 0 && (
        <div className="ms-group">
          <p className="ms-group-label">Reached</p>
          <ol className="ms-list" style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 4 }}>
            {done.map((m) => (
              <li key={m.id}>
                <button type="button" className="goal-next-toggle is-done" aria-pressed="true" onClick={() => onToggle(m.id)}>
                  <span className="ms-box" aria-hidden="true"><IconCheck size={13} /></span>
                  <span className="goal-next-name" style={{ textDecoration: 'line-through', color: 'var(--text-3)' }}>{m.name}</span>
                  {m.doneAt && <span className="goal-next-date tnum">{prettyDate(dayOf(m.doneAt))}</span>}
                </button>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------
   ANALYTICS SURFACE — primary trajectory (multi-series) +
   secondary velocity / consistency / projection summary.
   Gaps stay null; projection only drawn when supported.
   ------------------------------------------------------------ */
function AnalyticsSurface({ actual, expected, prog, pace, velocity, consistency, projection, milestones, isReached, today, areaVar, tone }) {
  const W = 780, H = 260, L = 48, R = 16, T = 22, B = 46
  const n = actual.length
  const projDays = projection?.reason === 'projected' && projection.daysLeft != null
    ? Math.min(Math.max(0, projection.daysLeft), 30) : 0
  const total = Math.max(1, n - 1 + projDays)
  const x = (i) => L + (i / total) * (W - L - R)
  const y = (v) => T + (1 - Math.max(0, Math.min(100, v)) / 100) * (H - T - B)

  const pts = actual.map((r, i) => ({ ...r, i, x: x(i), y: r.pct == null ? null : y(r.pct) }))
  let d = ''; let started = false
  pts.forEach((p) => {
    if (p.y == null) { started = false; return }
    d += (started ? 'L' : 'M') + p.x.toFixed(1) + ' ' + p.y.toFixed(1) + ' '; started = true
  })
  d = d.trim()

  // Expected line across full window when available
  let ed = ''
  if (expected && expected.length > 0 && pace && pace.start && pace.end) {
    const t0 = new Date(`${pace.start}T00:00`).getTime()
    const t1 = new Date(`${pace.end}T23:59`).getTime()
    const tNow = new Date(`${today}T12:00`).getTime()
    const todayI = Math.max(0, Math.min(total, ((tNow - t0) / (t1 - t0)) * (n - 1)))
    const todayX = x(todayI)
    ed = `M${L} ${y(0).toFixed(1)} L${todayX.toFixed(1)} ${y(pace.expected).toFixed(1)}`
    if (!isReached && tNow <= t1) {
      const targetI = Math.min(total, n - 1)
      ed += ` L${x(targetI).toFixed(1)} ${y(100).toFixed(1)}`
    }
  }

  // Target marker at deadline (100% point on the last day of window)
  const targetX = (pace && pace.end) ? x(Math.min(total, n - 1)) : null

  // Projection dashed from last known point to (endI, 100)
  let projD = ''; let projEndX = null
  if (projDays > 0 && !isReached) {
    const last = [...pts].reverse().find((p) => p.y != null)
    if (last) {
      const endI = n - 1 + projDays
      projEndX = x(endI)
      projD = `M${last.x.toFixed(1)} ${last.y.toFixed(1)} L${projEndX.toFixed(1)} ${projEndY.toFixed(1)}`
    }
  }

  const known = pts.filter((p) => p.y != null)
  const last = known[known.length - 1]
  const todayIdx = (() => {
    if (!pace) return n - 1
    const t0 = new Date(`${pace.start}T00:00`).getTime()
    const t1 = new Date(`${pace.end}T23:59`).getTime()
    const tNow = new Date(`${today}T12:00`).getTime()
    return Math.max(0, Math.min(total, ((tNow - t0) / (t1 - t0)) * (n - 1)))
  })()
  const todayX = x(todayIdx)

  // Milestones: same logic as overview but bigger
  const msDots = milestones.map((m) => {
    let cx, cy
    if (m.done) {
      cx = last ? last.x : x(n - 1); cy = last ? last.y : y(prog.pct)
      if (m.doneAt && isValidDayStr(dayOf(m.doneAt))) {
        const day = dayOf(m.doneAt)
        const hit = pts.find((p) => p.day === day && p.y != null)
        if (hit) { cx = hit.x; cy = hit.y }
      }
    } else if (pace && isValidDayStr(m.targetDate)) {
      const t0 = new Date(`${pace.start}T00:00`).getTime()
      const t1 = new Date(`${pace.end}T23:59`).getTime()
      const tm = new Date(`${m.targetDate}T12:00`).getTime()
      const pctAlong = Math.max(0, Math.min(1.2, (tm - t0) / (t1 - t0)))
      const i = pctAlong * total
      cx = x(Math.min(i, total)); cy = y(Math.min(100, Math.round(pctAlong * 100)))
    } else {
      cx = x(n - 1); cy = y(prog.pct)
    }
    return { m, cx, cy }
  })

  const stroke = isReached ? 'var(--good)' : `var(${areaVar})`
  const expStroke = tone === 'bad' ? 'var(--bad)' : tone === 'warn' ? 'var(--warn)' : 'var(--text-3)'
  const days = actual.map((r) => r.day)
  const xLabels = n <= 4 ? days.map((_, i) => i) : Array.from({ length: 6 }, (_, k) => Math.round((k * (n - 1)) / 5))

  // Velocity: 14-day bars (points gained per day across the window, approximate).
  const velBars = useMemo(() => {
    const bars = []
    if (!known.length) return bars
    for (let i = 1; i < known.length; i++) {
      const prev = known[i - 1], cur = known[i]
      const dv = Math.max(0, cur.pct - prev.pct)
      const span = Math.max(1, daysBetween(prev.day, cur.day))
      bars.push({ x: cur.x, h: dv / span })
    }
    return bars
  }, [known])
  const maxBar = Math.max(1, ...velBars.map(b => b.h))

  // Consistency: a strip of recent 14-day contributions.
  const consStrip = useMemo(() => {
    if (!consistency || consistency.pct == null) return null
    const arr = []
    for (let i = 13; i >= 0; i--) {
      const p = pts[pts.length - 1 - i]
      arr.push({ active: p && p.pct != null && i > 0 && pts[pts.length - i] && pts[pts.length - i].pct != null && pts[pts.length - i].pct > (p.pct || 0) })
    }
    return { pct: consistency.pct, arr }
  }, [pts, consistency])

  const insight = (() => {
    if (isReached) return 'Goal reached.'
    if (!pace) return 'Set a start date and target date to see expected pace and projection.'
    if (projection.reason === 'stalled') return 'Progress has stalled — recent velocity is zero.'
    if (projection.reason === 'insufficient') return 'Not enough progress data yet for a reliable projection.'
    const behind = pace.expected - prog.pct
    if (projection.reason === 'projected') {
      const late = projection.day && pace.end && projection.day > pace.end
      if (late) return `Current velocity (${velocity?.perWeek ?? '—'} pts/wk) projects completion after the target.`
      if (behind > 15) return `${behind} points behind pace; projected finish ${prettyDate(dayOf(projection.projectedCompletion))}.`
      if (behind < -10) return `Tracking ${Math.abs(behind)} points ahead of expected pace.`
      return `On pace — projected finish ${prettyDate(dayOf(projection.projectedCompletion))}.`
    }
    if (behind > 15) return `${behind} points behind expected pace.`
    if (behind < -10) return `${Math.abs(behind)} points ahead of pace.`
    return `On pace — ${prog.pct}% done vs ${pace.expected}% expected.`
  })()

  const enoughData = known.length >= 2
  const hasExpected = !!ed

  return (
    <div className="goal-analytics">
      {!enoughData ? (
        <p className="tiny muted" style={{ margin: 0 }}>
          Not enough progress history yet to draw a trajectory. As milestones are reached or linked work moves, the arc will appear here.
        </p>
      ) : (
        <>
          <div className="goal-analytics__chart">
            <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img"
              aria-label={`Progress analytics for this goal. ${prog.pct}% complete${pace ? `; expected ${pace.expected}% by today` : ''}.`}
              preserveAspectRatio="none">
              <defs>
                <linearGradient id="analytics-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={stroke} stopOpacity="0.28" />
                  <stop offset="100%" stopColor={stroke} stopOpacity="0" />
                </linearGradient>
              </defs>
              {/* guides */}
              {[0, 25, 50, 75, 100].map((v) => (
                <g key={v}>
                  <line x1={L} y1={y(v)} x2={W - R} y2={y(v)} stroke="var(--border)" strokeDasharray={v === 0 ? '0' : '2 4'} />
                  <text x={L - 8} y={y(v) + 3} textAnchor="end" fontSize="10" fill="var(--text-3)" style={{ fontVariantNumeric: 'tabular-nums' }}>{v}%</text>
                </g>
              ))}
              {/* target line */}
              {targetX != null && (
                <g>
                  <line x1={targetX} y1={T - 4} x2={targetX} y2={H - B + 6} stroke="var(--text-3)" strokeWidth="1" strokeDasharray="2 3" opacity="0.5" />
                  <text x={targetX} y={T - 8} textAnchor="middle" fontSize="10" fontWeight="700" fill="var(--text-3)">Target</text>
                </g>
              )}
              {/* expected */}
              {hasExpected && <path d={ed} fill="none" stroke={expStroke} strokeWidth="1.6" strokeDasharray="4 5" opacity="0.85" />}
              {/* projected */}
              {projD && <path d={projD} fill="none" stroke={stroke} strokeWidth="2" strokeDasharray="3 4" opacity="0.55" />}
              {/* area fill under actual */}
              {d && (() => {
                let area = `M${known[0].x.toFixed(1)} ${y(0).toFixed(1)}`
                known.forEach((p) => { area += `L${p.x.toFixed(1)} ${p.y.toFixed(1)}` })
                area += `L${known[known.length - 1].x.toFixed(1)} ${y(0).toFixed(1)}Z`
                return <path d={area} fill="url(#analytics-fill)" />
              })()}
              {/* velocity bars */}
              {velBars.map((b, i) => (
                <rect key={i} x={b.x - 3} y={y(Math.min(100, b.h * 4)) - 0} width={3} height={Math.max(2, (b.h / maxBar) * 14)} fill={stroke} opacity="0.35" rx="1" />
              ))}
              {/* actual */}
              {d && <path d={d} fill="none" stroke={stroke} strokeWidth="2.8" strokeLinejoin="round" strokeLinecap="round" />}
              {/* last dot */}
              {last && <circle cx={last.x} cy={last.y} r="5" fill="var(--surface-solid)" stroke={stroke} strokeWidth="2.4" />}
              {/* milestones */}
              {msDots.map(({ m, cx, cy }, i) => (
                <g key={m.id || i}>
                  <circle cx={cx} cy={cy} r={m.done || isReached ? 5 : 4.5}
                    fill={m.done || isReached ? stroke : 'var(--surface-solid)'}
                    stroke={stroke} strokeWidth="2" />
                  {isValidDayStr(m.targetDate) && !m.done && (
                    <text x={cx} y={cy - 10} textAnchor="middle" fontSize="9.5" fill="var(--text-2)">
                      {m.name.length > 12 ? m.name.slice(0, 11) + '…' : m.name}
                    </text>
                  )}
                </g>
              ))}
              {/* today */}
              <line x1={todayX} y1={T - 4} x2={todayX} y2={H - B + 8} stroke={stroke} strokeWidth="1.5" strokeDasharray="1 2" opacity="0.7" />
              <polygon points={`${todayX - 4},${H - B + 10} ${todayX + 4},${H - B + 10} ${todayX},${H - B + 2}`} fill={stroke} opacity="0.8" />
              <text x={todayX} y={H - 2} textAnchor="middle" fontSize="10" fontWeight="700" fill={stroke}>Today</text>
              {/* projected end marker */}
              {projD && projEndX != null && (
                <g>
                  <line x1={projEndX} y1={T} x2={projEndX} y2={H - B + 6} stroke={stroke} strokeWidth="1" strokeDasharray="2 3" opacity="0.5" />
                  <text x={projEndX} y={T - 6} textAnchor="middle" fontSize="9.5" fontWeight="700" fill={stroke} opacity="0.85">Projected</text>
                </g>
              )}
              {/* date axis labels */}
              {xLabels.filter((i) => days[i]).map((i) => (
                <text key={i} x={i === 0 ? L : i >= n - 1 ? W - R : x(i)} y={H - 20}
                  textAnchor={i === 0 ? 'start' : i >= n - 1 ? 'end' : 'middle'}
                  fontSize="10" fill="var(--text-3)">{shortDate(days[i])}</text>
              ))}
            </svg>
          </div>

          <div className="pace-legend" aria-hidden="true">
            <span><i style={{ background: stroke, height: 3, top: -1 }} /> actual</span>
            {hasExpected && <span><i style={{ borderTop: `2px dashed ${expStroke}`, background: 'transparent', height: 0 }} /> expected</span>}
            {projD && <span><i style={{ display: 'inline-block', width: 16, height: 0, borderTop: `2px dashed ${stroke}`, opacity: 0.6, marginRight: 6, position: 'relative', top: -3 }} /> projected</span>}
            {milestones.length > 0 && <span><i className="dot" style={{ background: stroke, width: 8, height: 8, borderRadius: '50%', display: 'inline-block', marginRight: 6 }} /> milestone</span>}
          </div>

          {/* Secondary analytics row */}
          <div className="goal-analytics__grid">
            <div className="goal-analytics__stat">
              <p className="k">Velocity</p>
              <p className="v tnum">{velocity?.perWeek != null ? `${velocity.perWeek} pts/wk` : '—'}</p>
              <p className="n">{velocity ? `across ${velocity.points} points, ${daysBetween(velocity.fromDay, velocity.toDay)} days` : 'Not enough data yet.'}</p>
            </div>
            <div className="goal-analytics__stat">
              <p className="k">Consistency</p>
              <p className="v tnum">{consistency?.pct != null ? `${consistency.pct}%` : '—'}</p>
              {consStrip && (
                <div className="cons-strip" aria-label={`Consistency ${consStrip.pct}%`}>
                  {consStrip.arr.map((c, i) => (
                    <span key={i} className={`cons-bar${c.active ? ' is-on' : ''}`} style={{ background: c.active ? stroke : 'var(--surface-2)' }} />
                  ))}
                </div>
              )}
              <p className="n">{consistency?.detail || ''}</p>
            </div>
            <div className="goal-analytics__stat">
              <p className="k">Projection</p>
              <p className="v tnum">
                {projection.reason === 'projected' ? prettyDate(dayOf(projection.projectedCompletion))
                  : projection.reason === 'stalled' ? 'Stalled'
                  : projection.reason === 'complete' ? 'Reached'
                  : '—'}
              </p>
              <p className="n">{projection.reason === 'projected'
                ? `${projection.daysLeft}d from now at current velocity`
                : projection.reason === 'stalled' ? 'Recent velocity is zero.'
                : projection.reason === 'insufficient' ? 'Need more progress data.'
                : ''}</p>
            </div>
            <div className="goal-analytics__stat">
              <p className="k">Pace</p>
              <p className="v tnum">{pace ? `${pace.expected}% expected` : '—'}</p>
              <p className="n">{pace ? `${prog.pct}% actual · ${Math.abs(pace.expected - prog.pct)} pts ${pace.expected > prog.pct ? 'behind' : 'ahead'}` : 'Set a target date for a pace line.'}</p>
            </div>
          </div>

          <p className="goal-analytics__insight" data-tone={tone}>{insight}</p>
        </>
      )}
    </div>
  )
}
