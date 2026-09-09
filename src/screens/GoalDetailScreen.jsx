/* ============================================================
   GOAL DETAIL — Phase 6 outcome-first hierarchy.

   A goal is read top-to-bottom as: OUTCOME → PROGRESS → NEXT
   MILESTONE → FORECAST → WHAT FEEDS THIS GOAL → CONTRIBUTORS →
   HISTORY / PACE → NOTES → MANAGE. The user sees meaningful goal
   state before any large chart. The compact hero keeps the spatial
   identity but does not dominate the first viewport, and every
   number stays derived from the existing engines (goals.js,
   goalAnalytics.js, adaptive.js, work.js, stats.js).
   ============================================================ */
import { Suspense, lazy, useState } from 'react'
import { useStore } from '../store.jsx'
import { useToast } from '../components/ui/Toaster.jsx'
import { LoadingBlock } from '../components/ui/feedback.jsx'
import { CardHead } from '../components/ui/SectionCard.jsx'
import ProgressCore from '../components/ui/ProgressCore.jsx'
import Sheet from '../components/ui/Sheet.jsx'
import EmptyState from '../components/ui/EmptyState.jsx'
import PaceChart from '../components/charts/PaceChart.jsx'
import GoalFormSheet from '../components/goals/GoalForm.jsx'
import { healthBadge } from '../components/goals/health.js'
import { areaOf, goalProgress, goalHealth, goalPace, nextMilestone, goalTodayActions } from '../lib/goals.js'
import { goalAnalytics } from '../lib/goalAnalytics.js'
import { goalForecast, goalContributors } from '../lib/adaptive.js'
import { habitStreak, activeHabits } from '../lib/stats.js'
import { projectProgress, assignmentProgress } from '../lib/work.js'
import { todayStr, prettyDate, dayOf, isValidDayStr } from '../lib/dates.js'
import { Link } from '../lib/router.jsx'
import {
  IconChevronRight, IconCheck, IconFlame, IconGoals, IconPlus, IconPencil, IconTrash,
  IconArchive, IconLink, IconClock, IconLayers,
} from '../lib/icons.jsx'
import '../styles/goals.css'

/* The spatial GoalAtlas is optional on Goal Detail too — "Explore
   connections". It is lazy so opening a goal never pays for it. */
const GoalAtlas = lazy(() => import('../components/goals/GoalAtlas.jsx'))

const stageOf = (pct) => (pct >= 100 ? 'reached'
  : pct >= 75 ? 'near completion'
    : pct >= 50 ? 'momentum'
      : pct >= 25 ? 'building'
        : 'foundation')

const RISK_TONE = { SAFE: 'neutral', 'ON TRACK': 'good', 'AT RISK': 'warn', OVERDUE: 'bad', CRITICAL: 'bad' }

export default function GoalDetailScreen({ id }) {
  const { state, dispatch } = useStore()
  const toast = useToast()
  const today = todayStr()
  const goal = (state.goals || []).find((g) => g.id === id && !g.archived)

  const [form, setForm] = useState({ open: false, mode: 'edit' })
  const [confirm, setConfirm] = useState(null) // 'delete' | 'archive' | null
  const [linkOpen, setLinkOpen] = useState(false)
  const [atlasOpen, setAtlasOpen] = useState(false)

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

  const now = new Date()
  const badge = healthBadge(state, goal, { now })
  const health = goalHealth(state, goal, { now })
  const prog = goalProgress(state, goal, { now })
  const pace = goalPace(goal, { now })
  const analytics = goalAnalytics(state, goal, { days: 30, now })
  const actions = goalTodayActions(state, goal, { date: today })
  const pending = actions.filter((a) => !a.done)
  const area = areaOf(goal.area)
  const ms = [...(goal.milestones || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  const msDone = ms.filter((m) => m.done).length

  const archive = () => {
    dispatch({ type: 'UPDATE_GOAL', id: goal.id, patch: { archived: true, status: 'archived' } })
    setConfirm(null)
    toast.show(`Archived “${goal.title}”`, {
      duration: 6000,
      actionLabel: 'Undo',
      onAction: () => dispatch({ type: 'UPDATE_GOAL', id: goal.id, patch: { archived: false, status: 'active' } }),
    })
  }
  const remove = () => {
    dispatch({ type: 'DELETE_GOAL', id: goal.id })
    setConfirm(null)
    toast.show(`Deleted “${goal.title}”`, {
      duration: 6000,
      actionLabel: 'Undo',
      onAction: () => dispatch({ type: 'RESTORE_GOAL', goal }),
    })
  }

  return (
    <div className="screen" id="goal-detail-screen">
      <header className="screen-head goal-detail-head">
        <div>
          <Link to="goals" className="back-link"><IconChevronRight size={14} style={{ transform: 'rotate(180deg)' }} /> All goals</Link>
          <h1 className="screen-title">{goal.title}</h1>
          <p className="screen-sub">{goal.why || `${area.label} goal`}</p>
        </div>
        <div className="wrap-gap" style={{ gap: 6, justifyContent: 'flex-end' }}>
          <span className="chip"><span className="dot" style={{ background: `var(${area.cssVar})` }} />{area.label}</span>
          <span className="status-pill" data-tone={badge.tone} aria-label={`Health: ${badge.text}`}>{badge.text}</span>
        </div>
      </header>

      <div className="goal-detail-actions">
        <button className="btn ghost sm" onClick={() => setForm({ open: true, mode: 'edit' })}><IconPencil size={14} /> Edit</button>
        <button className="btn ghost sm" onClick={() => setForm({ open: true, mode: 'milestone' })}><IconPlus size={14} /> Add milestone</button>
        <button className="btn ghost sm" onClick={() => setLinkOpen((v) => !v)} aria-expanded={linkOpen}><IconLink size={14} /> {linkOpen ? 'Done linking' : 'Link work'}</button>
        <button className="btn ghost sm" onClick={() => setAtlasOpen((v) => !v)} aria-expanded={atlasOpen}><IconLayers size={14} /> {atlasOpen ? 'Hide connections' : 'Explore connections'}</button>
        <span style={{ flex: 1 }} />
        <button className="btn ghost sm" onClick={() => setConfirm('archive')} aria-label="Archive goal"><IconArchive size={15} /></button>
        <button className="btn ghost sm" style={{ color: 'var(--bad)' }} onClick={() => setConfirm('delete')} aria-label="Delete goal"><IconTrash size={15} /></button>
      </div>

      <div className="goal-detail-grid">
        {/* ============ MAIN ============ */}
        <div className="goal-detail-main">
          {/* OUTCOME + PROGRESS + HEALTH — compact hero */}
          <section className="card pad-lg goal-hero goal-hero-compact" aria-label="Goal status">
            <div className="goal-hero-inner">
              <div className="goal-core">
                <ProgressCore
                  pct={prog.pct}
                  size={150}
                  stroke={10}
                  caption={stageOf(prog.pct)}
                  label={`${goal.title}: ${prog.pct} percent complete — ${stageOf(prog.pct)} stage`}
                />
              </div>
              <div className="goal-hero-copy">
                <p className="eyebrow">{prog.detail}</p>
                <p className="goal-hero-note" data-tone={badge.tone}>{badge.note || badge.text}</p>
                <div className="goal-facts">
                  <div className="goal-fact">
                    <strong className="tnum">{goal.targetDate ? prettyDate(goal.targetDate) : '—'}</strong>
                    <span>target</span>
                    <em>{health.daysLeft == null ? (goal.targetDate ? '· see health' : 'no target date') : health.daysLeft < 0 ? `${Math.abs(health.daysLeft)}d overdue` : `${health.daysLeft}d left`}</em>
                  </div>
                  <div className="goal-fact">
                    <strong className="tnum">{prog.done}{prog.total ? `/${prog.total}` : ''}</strong>
                    <span>progress basis</span>
                    <em>{prog.source === 'none' ? 'nothing linked yet' : `from ${prog.source}`}</em>
                  </div>
                  <div className="goal-fact">
                    <strong>{pace ? <span className="tnum">{pace.expected}%</span> : '—'}</strong>
                    <span>expected today</span>
                    <em>{pace ? 'straight-line pace' : 'set a target date for a pace line'}</em>
                  </div>
                  <div className="goal-fact">
                    <strong className="tnum">{analytics.consistency.pct == null ? '—' : `${analytics.consistency.pct}%`}</strong>
                    <span>consistency</span>
                    <em>{analytics.consistency.detail}</em>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* NEXT MILESTONE */}
          <section className="card pad">
            <CardHead title="Next milestone">
              {ms.length > 0 && <span className="tiny muted tnum">{msDone} of {ms.length} reached</span>}
            </CardHead>
            <NextMilestone goal={goal} dispatch={dispatch} ms={ms} onAdd={() => setForm({ open: true, mode: 'milestone' })} />
          </section>

          {/* MILESTONES (execution surface) */}
          <section className="card pad">
            <CardHead title="Milestones" />
            <Milestones ms={ms} goalId={goal.id} dispatch={dispatch} onAdd={() => setForm({ open: true, mode: 'milestone' })} />
          </section>

          {/* TODAY'S CONTRIBUTION */}
          {actions.length > 0 && (
            <section className="card pad">
              <CardHead title="Today’s contribution">
                <span className="tiny muted tnum">{pending.length} open</span>
              </CardHead>
              <TodayContribution pending={pending} />
            </section>
          )}

          {/* HISTORY / PACE — "view progress history" */}
          <section className="card pad">
            <details open={false}>
              <summary className="history-summary">
                <span><IconClock size={15} /> View progress history</span>
                <span className="tiny muted">current vs expected over 30 days</span>
              </summary>
              <div className="history-body">
                <div className="pace-legend" aria-hidden="true">
                  <i className="pace-legend-actual" /> actual
                  <i className="pace-legend-expected" /> expected
                </div>
                <PaceChart actual={analytics.actual} expected={analytics.expected} ariaLabel={`Expected versus actual progress for ${goal.title} over the last 30 days`} />
                {!analytics.expected && (
                  <p className="tiny muted" style={{ marginTop: 6 }}>
                    No pace line: this goal has no start + target window to measure against.
                  </p>
                )}
              </div>
            </details>
          </section>

          {goal.notes && (
            <section className="card pad">
              <CardHead title="Notes" />
              <p style={{ color: 'var(--text-2)', fontSize: 'var(--fs-sm)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{goal.notes}</p>
            </section>
          )}

          <section className="card pad">
            <CardHead title="Manage goal" />
            <div className="goal-detail-actions manage">
              <button className="btn" onClick={() => setForm({ open: true, mode: 'edit' })}><IconPencil size={15} /> Edit</button>
              <button className="btn" onClick={() => setForm({ open: true, mode: 'milestone' })}><IconPlus size={15} /> Add milestone</button>
              <button className="btn" onClick={() => setConfirm('archive')}><IconArchive size={15} /> Archive</button>
              <button className="btn" style={{ color: 'var(--bad)' }} onClick={() => setConfirm('delete')}><IconTrash size={15} /> Delete</button>
            </div>
            <p className="tiny muted" style={{ marginTop: 10 }}>
              Destructive actions ask first. Progress, forecasting and contributors all derive from the work linked below.
            </p>
          </section>
        </div>

        {/* ============ ASIDE ============ */}
        <div className="goal-detail-aside">
          {/* FORECAST */}
          <ForecastSection state={state} goal={goal} />
          {/* CONTRIBUTORS */}
          <ContributorsSection state={state} goal={goal} />
          {/* WHAT FEEDS THIS GOAL / LINKED WORK */}
          <FeedSection
            state={state} goal={goal}
            linkOpen={linkOpen} onToggleLink={() => setLinkOpen((v) => !v)}
          />
          {atlasOpen && (
            <Suspense fallback={<div className="card pad" style={{ minHeight: 120 }}><LoadingBlock label="Loading connections" /></div>}>
              <GoalAtlas goals={[goal]} />
            </Suspense>
          )}
        </div>
      </div>

      <GoalFormSheet
        open={form.open}
        onClose={() => setForm({ open: false, mode: 'edit' })}
        editing={goal}
      />

      <Sheet
        open={confirm === 'delete'}
        onClose={() => setConfirm(null)}
        title="Delete goal"
        labelledBy="confirm-delete-goal"
        footer={(
          <>
            <button className="btn" onClick={() => setConfirm(null)}>Cancel</button>
            <button className="btn" style={{ background: 'var(--bad)', color: 'var(--bg-deep)', borderColor: 'transparent' }} onClick={remove}>Delete goal</button>
          </>
        )}
      >
        <p className="card-blurb">
          Delete “{goal.title}” and its milestones? This cannot be undone from here (an undo restores it for a short window).
        </p>
      </Sheet>

      <Sheet
        open={confirm === 'archive'}
        onClose={() => setConfirm(null)}
        title="Archive goal"
        labelledBy="confirm-archive-goal"
        footer={(
          <>
            <button className="btn" onClick={() => setConfirm(null)}>Cancel</button>
            <button className="btn" onClick={archive}>Archive goal</button>
          </>
        )}
      >
        <p className="card-blurb">
          Archive “{goal.title}”? It will stop appearing in your open goals.
        </p>
      </Sheet>
    </div>
  )
}

/* ------------------------------------------------------------ */
function NextMilestone({ goal, dispatch, ms, onAdd }) {
  const next = nextMilestone(goal)
  if (ms.length === 0) {
    return (
      <div className="goal-next empty-milestone">
        <button type="button" className="btn ghost sm" onClick={onAdd}><IconPlus size={14} /> Add a milestone</button>
        <span className="tiny muted">No milestones yet — add one to give this goal checkpoints, or link work below.</span>
      </div>
    )
  }
  if (!next) {
    return <p className="goal-reached-note">All milestones are reached — this outcome is complete.</p>
  }
  return (
    <div className="goal-next-row">
      <button
        type="button"
        className="goal-next-toggle"
        aria-pressed={false}
        onClick={() => dispatch({ type: 'TOGGLE_GOAL_MILESTONE', id: goal.id, milestoneId: next.id })}
      >
        <span className="ms-box" aria-hidden="true" />
        <span className="goal-next-name">{next.name}</span>
        {isValidDayStr(next.targetDate) && <span className="goal-next-date tnum">by {prettyDate(next.targetDate)}</span>}
      </button>
      <span className="tiny muted" style={{ alignSelf: 'center' }}>Mark complete</span>
    </div>
  )
}

function Milestones({ ms, goalId, dispatch, onAdd }) {
  if (ms.length === 0) {
    return (
      <div className="goal-next empty-milestone">
        <button type="button" className="btn ghost sm" onClick={onAdd}><IconPlus size={14} /> Add a milestone</button>
        <span className="tiny muted">Progress is measured from these when they exist.</span>
      </div>
    )
  }
  const next = ms.find((m) => !m.done)
  const done = ms.filter((m) => m.done)
  const upcoming = ms.filter((m) => !m.done && m !== next)
  return (
    <div className="ms-groups">
      {next && (
        <div className="ms-group">
          <p className="ms-group-label">Up next</p>
          <MilestoneToggleRow key={next.id} m={next} goalId={goalId} dispatch={dispatch} next />
        </div>
      )}
      {upcoming.length > 0 && (
        <div className="ms-group">
          <p className="ms-group-label">Upcoming</p>
          {upcoming.map((m) => <MilestoneToggleRow key={m.id} m={m} goalId={goalId} dispatch={dispatch} />)}
        </div>
      )}
      {done.length > 0 && (
        <div className="ms-group">
          <p className="ms-group-label">Reached</p>
          <ol className="ms-list">
            {done.map((m) => (
              <li key={m.id}>
                <button type="button" className="ms-row is-done" aria-pressed="true" onClick={() => dispatch({ type: 'TOGGLE_GOAL_MILESTONE', id: goalId, milestoneId: m.id })}>
                  <span className="ms-box" aria-hidden="true"><IconCheck size={13} /></span>
                  <span className="ms-name">{m.name}</span>
                  {m.targetDate && <span className="ms-date tnum">{prettyDate(m.targetDate)}</span>}
                </button>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  )
}

function MilestoneToggleRow({ m, goalId, dispatch, next = false }) {
  return (
    <button type="button" className="goal-next-toggle" aria-pressed={m.done} onClick={() => dispatch({ type: 'TOGGLE_GOAL_MILESTONE', id: goalId, milestoneId: m.id })}>
      <span className="ms-box" aria-hidden="true">{m.done ? <IconCheck size={13} /> : null}</span>
      <span className="goal-next-name">{m.name}</span>
      {isValidDayStr(m.targetDate) && <span className="goal-next-date tnum">{prettyDate(m.targetDate)}</span>}
      {next && <span className="ms-next-chip">Next</span>}
    </button>
  )
}

/* Forecast — compact Current / Expected / Projected + pace + WHY. */
function ForecastSection({ state, goal }) {
  const f = goalForecast(state, goal)
  const pct = (v) => v == null ? '—' : `${v}%`
  const riskText = f.risk?.id || 'SAFE'
  const tone = RISK_TONE[riskText] || 'neutral'
  return (
    <section className="card pad adaptive-forecast">
      <CardHead title="Forecast">
        <span className="adaptive-risk" data-risk={riskText} style={{ color: tone === 'good' ? 'var(--good)' : tone === 'warn' ? 'var(--warn)' : tone === 'bad' ? 'var(--bad)' : 'var(--text-2)' }}>
          {riskText}
        </span>
      </CardHead>
      <div className="forecast-grid" aria-label={`Forecast for ${goal.title}`}>
        <span>Current<strong>{pct(f.currentProgress)}</strong></span>
        <span>Expected<strong>{pct(f.expectedProgress)}</strong></span>
        <span>Projected<strong>{f.projectedCompletion ? prettyDate(dayOf(f.projectedCompletion)) : '—'}</strong></span>
      </div>
      {(f.requiredPacePerDay != null || f.actualPacePerDay != null) && f.currentProgress < 100 && (
        <div className="forecast-pace">
          <span><em>Required pace</em><strong className="tnum">{f.requiredPacePerDay == null ? '—' : `${Math.round(f.requiredPacePerDay)}%/day`}</strong></span>
          <span><em>Current pace</em><strong className="tnum">{f.actualPacePerDay == null ? '—' : `${Math.round(f.actualPacePerDay * 100) / 100}%/day`}</strong></span>
        </div>
      )}
      <p className="card-blurb">{f.reason}</p>
      {f.projectedCompletion && f.deadline && f.currentProgress < 100 && (
        <p className="forecast-why">
          Projected {prettyDate(dayOf(f.projectedCompletion))} vs target {prettyDate(dayOf(f.deadline))}
        </p>
      )}
    </section>
  )
}

/* Contributors — "what is moving this goal?" from goalContributors(). */
function ContributorsSection({ state, goal }) {
  const c = goalContributors(state, goal)
  const hasRows = c.rows.length > 0
  return (
    <section className="card pad">
      <CardHead title="What is moving this goal?" />
      {!hasRows ? (
        <p className="tiny muted">Nothing linked yet — contributions appear once work or habits feed this goal.</p>
      ) : (
        <ul className="contributor-list">
          {c.rows.map((r) => {
            const href = r.type === 'habit' ? `habits/${findId(state.habits, r.name)}`
              : r.type === 'project' ? `projects/${findId(state.projects, r.name)}`
                : `assignments/${findId(state.assignments, r.name)}`
            const measured = r.contribution != null
            return (
              <li key={`${r.type}-${r.name}`}>
                <Link to={href} className="contributor-row">
                  <span className={`feed-kind ${r.type}`}>{r.type}</span>
                  <span className="goal-habit-name ellipsis">{r.name}</span>
                  {r.type === 'habit' ? (
                    <span className="tiny muted">linked · not weighted</span>
                  ) : (
                    <strong className="tnum">{measured ? `${r.contribution}%` : '—'}</strong>
                  )}
                  <IconChevronRight size={14} className="dim" />
                </Link>
              </li>
            )
          })}
        </ul>
      )}
      {!c.enough && hasRows && <p className="tiny muted" style={{ marginTop: 8 }}>Not enough data yet to apportion contributions.</p>}
    </section>
  )
}

function findId(list, name) {
  const item = (list || []).find((x) => x.name === name)
  return item ? item.id : ''
}

/* Linked work — this goal is fed by… */
function FeedSection({ state, goal, linkOpen, onToggleLink }) {
  const habits = (goal.linkedHabitIds || []).map((hid) => (state.habits || []).find((h) => h.id === hid)).filter((h) => h && !h.archived)
  const projects = (goal.linkedProjectIds || []).map((pid) => (state.projects || []).find((p) => p.id === pid)).filter((p) => p && !p.archived)
  const assignments = (goal.linkedAssignmentIds || []).map((aid) => (state.assignments || []).find((a) => a.id === aid)).filter((a) => a && !a.archived)
  const count = habits.length + projects.length + assignments.length

  return (
    <section className="card pad">
      <CardHead title="This goal is fed by">
        <span className="tiny muted tnum">{count} linked</span>
      </CardHead>
      {count === 0 && !linkOpen ? (
        <p className="tiny muted">
          Nothing linked yet. This goal reports 0% until a milestone, project, assignment or habit feeds it.
        </p>
      ) : (
        <div className="stack" style={{ gap: 8 }}>
          {habits.map((h) => {
            const streak = habitStreak(state, h)
            return (
              <Link key={h.id} to={`habits/${h.id}`} className="feed-row">
                <span className="feed-kind habit">habit</span>
                <span className="feed-name ellipsis">{h.name}</span>
                {streak > 1 && <span className="tiny tnum" style={{ color: 'var(--warn)', display: 'inline-flex', gap: 3, alignItems: 'center' }}><IconFlame size={12} />{streak}d</span>}
                <span className="tiny muted tnum">{streak === 0 ? 'no streak yet' : ''}</span>
                <IconChevronRight size={14} />
              </Link>
            )
          })}
          {projects.map((p) => (
            <Link key={p.id} to={`projects/${p.id}`} className="feed-row">
              <span className="feed-kind project">project</span>
              <span className="feed-name ellipsis">{p.name}</span>
              <span className="tiny muted tnum">{projectProgress(p).pct}%</span>
              <IconChevronRight size={14} />
            </Link>
          ))}
          {assignments.map((a) => (
            <Link key={a.id} to={`assignments/${a.id}`} className="feed-row">
              <span className="feed-kind assignment">assignment</span>
              <span className="feed-name ellipsis">{a.name}</span>
              <span className="tiny muted tnum">{assignmentProgress(a).pct}%</span>
              <IconChevronRight size={14} />
            </Link>
          ))}
        </div>
      )}
      <div className="goal-linkbar" style={{ marginTop: 10, borderTop: 0, paddingTop: 0 }}>
        <button type="button" className="btn ghost sm" onClick={onToggleLink} aria-expanded={linkOpen}>
          <IconLink size={14} /> {linkOpen ? 'Done' : 'Link existing work'}
        </button>
      </div>
      {linkOpen && <LinkExistingWorkEditor state={state} goal={goal} />}
    </section>
  )
}

function LinkExistingWorkEditor({ state, goal }) {
  const { dispatch } = useStore()
  const allHabits = activeHabits(state)
  const openProjects = (state.projects || []).filter((p) => !p.archived && !p.completedAt)
  const openAssignments = (state.assignments || []).filter((a) => !a.archived && !a.completedAt)
  const toggle = (key, id) => {
    const on = (goal[key] || []).includes(id)
    dispatch({ type: 'UPDATE_GOAL', id: goal.id, patch: { [key]: on ? goal[key].filter((x) => x !== id) : [...(goal[key] || []), id] } })
  }
  const chips = (key, items) => (
    <div className="wrap-gap" style={{ gap: 6 }}>
      {items.map((x) => {
        const on = (goal[key] || []).includes(x.id)
        return (
          <button key={x.id} type="button" className="chip-btn" aria-pressed={on} onClick={() => toggle(key, x.id)}>
            {on && <IconCheck size={13} />}{x.name}
          </button>
        )
      })}
    </div>
  )
  return (
    <div className="goal-links">
      <p className="field-label" style={{ marginTop: 4 }}>Habits</p>
      {allHabits.length === 0 ? <p className="tiny muted">Add a habit first, then link it here.</p> : chips('linkedHabitIds', allHabits)}
      <p className="field-label" style={{ marginTop: 12 }}>Projects</p>
      {openProjects.length === 0 ? <p className="tiny muted">No open projects yet.</p> : chips('linkedProjectIds', openProjects)}
      <p className="field-label" style={{ marginTop: 12 }}>Assignments</p>
      {openAssignments.length === 0 ? <p className="tiny muted">No open assignments yet.</p> : chips('linkedAssignmentIds', openAssignments)}
    </div>
  )
}

function TodayContribution({ pending }) {
  if (pending.length === 0) {
    return <p className="pace-note" data-tone="good" style={{ margin: 0 }}><IconCheck size={14} /> Everything this goal needs today is already done.</p>
  }
  return (
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
  )
}
