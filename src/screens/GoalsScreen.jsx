/* ============================================================
   GOALS — the outcome layer. Phase 6.

   This screen answers, within seconds:
     WHAT am I trying to achieve?
     HOW far along am I?
     IS it healthy?
     WHAT is the next milestone?

   Default view is the LIST of structured goal cards. The spatial
   Goal Atlas is not the first thing you must parse — it is an
   optional "Atlas / Visual" exploration mode, lazy-loaded so goal
   management never pays for 3D/constellation rendering.

   All numbers are derived by the existing engines (goals.js,
   goalAnalytics.js, adaptive.js). Nothing here re-implements them.
   ============================================================ */
import { Suspense, lazy, useMemo, useState } from 'react'
import { useStore } from '../store.jsx'
import { useToast } from '../components/ui/Toaster.jsx'
import SectionCard from '../components/ui/SectionCard.jsx'
import EmptyState from '../components/ui/EmptyState.jsx'
import { Meter, StatStrip, WorkEmpty } from '../components/work/WorkKit.jsx'
import { SegControl } from '../components/ui/controls.jsx'
import GoalFormSheet from '../components/goals/GoalForm.jsx'
import { healthBadge } from '../components/goals/health.js'
import {
  areaOf, goalProgress, goalHealth, goalPace, nextMilestone, goalTodayActions, openGoals,
} from '../lib/goals.js'
import { habitRate, habitStreak, activeHabits } from '../lib/stats.js'
import { projectProgress } from '../lib/work.js'
import { todayStr, subDaysStr, prettyDate, dayOf, isValidDayStr } from '../lib/dates.js'
import { Link } from '../lib/router.jsx'
import {
  IconGoals, IconPlus, IconPencil, IconTrash, IconCheck, IconLink, IconFlame,
  IconChevronRight, IconTarget, IconArchive, IconLayers,
} from '../lib/icons.jsx'
import '../styles/goals.css'

/* The spatial GoalAtlas stays (Phase 6 §9) but only mounts when the user
   opts into it — lazy so the standard list never renders it. */
const GoalAtlas = lazy(() => import('../components/goals/GoalAtlas.jsx'))

export default function GoalsScreen() {
  const { state, dispatch } = useStore()
  const toast = useToast()
  const today = todayStr()
  const from = subDaysStr(today, 29)
  const [filter, setFilter] = useState('open')
  const [view, setView] = useState('list')
  const [form, setForm] = useState({ open: false, editing: null })
  const [linksFor, setLinksFor] = useState(null)
  const [learnOpen, setLearnOpen] = useState(false)

  const reached = useMemo(
    () => (state.goals || []).filter((g) => !g.archived && (g.status === 'completed' || goalProgress(state, g).pct >= 100)),
    [state],
  )
  const goals = (state.goals || []).filter((g) => !g.archived)
  const open = useMemo(() => openGoals(state), [state])

  const shown = useMemo(() => {
    if (filter === 'reached') return reached
    if (filter === 'all') return goals
    if (filter === 'risk') {
      return open.filter((g) => ['warn', 'bad'].includes(healthBadge(state, g).tone))
    }
    return open
  }, [filter, reached, goals, open, state])

  const ordered = useMemo(() => {
    const priority = filter === 'risk'
    return [...shown].sort((a, b) => {
      // Deterministic: risk view pushes the most urgent first; otherwise deadline.
      if (priority) {
        const ra = healthBadge(state, a).tone === 'bad' ? 0 : 1
        const rb = healthBadge(state, b).tone === 'bad' ? 0 : 1
        if (ra !== rb) return ra - rb
      }
      const ad = isValidDayStr(a.targetDate) ? a.targetDate : '9999-99-99'
      const bd = isValidDayStr(b.targetDate) ? b.targetDate : '9999-99-99'
      return ad.localeCompare(bd) || a.title.localeCompare(b.title)
    })
  }, [shown, state, filter])

  const remove = (goal) => {
    dispatch({ type: 'DELETE_GOAL', id: goal.id })
    toast.show(`Deleted “${goal.title}”`, {
      duration: 6000,
      actionLabel: 'Undo',
      onAction: () => dispatch({ type: 'RESTORE_GOAL', goal }),
    })
  }

  const archive = (goal) => {
    dispatch({ type: 'UPDATE_GOAL', id: goal.id, patch: { archived: true, status: 'archived' } })
    toast.show(`Archived “${goal.title}”`, {
      duration: 6000,
      actionLabel: 'Undo',
      onAction: () => dispatch({ type: 'UPDATE_GOAL', id: goal.id, patch: { archived: false, status: 'active' } }),
    })
  }

  const nextMilestoneRow = useMemo(() => {
    for (const g of open) {
      const m = nextMilestone(g)
      if (m) return { goal: g, milestone: m }
    }
    return null
  }, [open])

  const summary = useMemo(() => {
    const avg = open.length ? Math.round(open.reduce((n, g) => n + goalProgress(state, g).pct, 0) / open.length) : null
    const atRisk = open.filter((g) => ['warn', 'bad'].includes(healthBadge(state, g).tone)).length
    return { open: open.length, reached: reached.length, all: goals.length, avg, atRisk }
  }, [open, reached, goals, state])

  const tabs = [
    { id: 'open', label: 'Open', count: summary.open },
    { id: 'risk', label: 'At risk', count: summary.atRisk },
    { id: 'reached', label: 'Reached', count: summary.reached },
    { id: 'all', label: 'All', count: summary.all },
  ]

  const cells = [
    { label: 'Open goals', value: summary.open, note: summary.open === 1 ? 'active' : 'active' },
    {
      label: 'Average progress',
      value: summary.avg == null ? '—' : summary.avg,
      note: summary.avg == null ? 'no open goals' : 'across open goals',
      tone: summary.avg != null && summary.avg < 50 ? undefined : undefined,
    },
    {
      label: 'Next milestone',
      value: nextMilestoneRow && isValidDayStr(nextMilestoneRow.milestone.targetDate)
        ? `${Math.max(0, Math.round((new Date(`${nextMilestoneRow.milestone.targetDate}T00:00`) - new Date(`${today}T00:00`)) / 86400000))}d`
        : '—',
      note: nextMilestoneRow ? nextMilestoneRow.milestone.name : 'none set',
      small: true,
    },
    { label: 'Reached', value: summary.reached, note: 'all time', tone: summary.reached ? 'good' : undefined },
  ]

  return (
    <div className="screen" id="goals-screen">
      <header className="screen-head goals-head">
        <div>
          <h1 className="screen-title">Goals</h1>
          <p className="screen-sub">
            The outcomes you care about — how far along each one is, whether it is healthy, and what comes next.
          </p>
        </div>
        <div className="head-actions">
          <button className="btn primary" onClick={() => setForm({ open: true, editing: null })}>
            <IconPlus size={16} /> New goal
          </button>
        </div>
      </header>

      <div className="stack">
        <StatStrip cells={cells} />

        <div className="goals-toolbar">
          <SegControl label="Goal filters" value={filter} onChange={setFilter} options={tabs} />

          {goals.length > 0 && (filter === 'open' || filter === 'all') && (
            <SegControl label="Goals view" value={view} onChange={setView} options={[{ id: 'list', label: 'List', icon: <IconLayers size={15} /> }, { id: 'atlas', label: 'Atlas / Visual', icon: <IconTarget size={15} /> }]} />
          )}
        </div>

        {ordered.length === 0 ? (
          <SectionCard>
            {goals.length === 0 ? (
              <>
                <EmptyState
                  art="art/empty-goals.webp"
                  icon={<IconTarget size={40} />}
                  title="No goals yet"
                >
                  A goal is the outcome you are actually after. Add one, break it into milestones, then link the habits and projects that move it.
                </EmptyState>
                <div className="goals-empty-actions">
                  <button className="btn primary" onClick={() => setForm({ open: true, editing: null })}><IconPlus size={16} /> Set your first goal</button>
                  <button type="button" className="btn ghost" onClick={() => setLearnOpen((v) => !v)} aria-expanded={learnOpen}>
                    Learn how goals work
                  </button>
                </div>
                {learnOpen && (
                  <div className="goal-learn">
                    <GoalHowItWorks />
                  </div>
                )}
              </>
            ) : (
              <WorkEmpty icon={<IconGoals size={40} />} title="Nothing here">
                {filter === 'reached'
                  ? 'Reached goals land here once their outcome is complete.'
                  : filter === 'risk'
                    ? 'No open goals are at risk right now.'
                    : 'Add a goal to see it in this view.'}
              </WorkEmpty>
            )}
          </SectionCard>
        ) : view === 'atlas' && (filter === 'open' || filter === 'all') ? (
          <Suspense fallback={<div className="card pad" style={{ minHeight: 180 }} role="status">Loading atlas…</div>}>
            <GoalAtlas goals={ordered} />
          </Suspense>
        ) : (
          <div className="goal-list" aria-label={filter === 'reached' ? 'Reached goals' : 'Active goals'}>
            {ordered.map((goal, i) => (
              <GoalCard
                key={goal.id}
                goal={goal}
                index={i}
                today={today}
                from={from}
                onEdit={(g) => setForm({ open: true, editing: g })}
                onArchive={archive}
                onDelete={remove}
                onLinks={(g) => setLinksFor((cur) => (cur === g.id ? null : g.id))}
                linksOpen={linksFor === goal.id}
              />
            ))}
          </div>
        )}

        {/* the role of each layer — kept minimal and only when goals exist */}
        {goals.length > 0 && (
          <details className="goals-how card pad" open={false}>
            <summary className="goals-how-summary">How the layers connect</summary>
            <GoalHowItWorks />
          </details>
        )}
      </div>

      <GoalFormSheet
        open={form.open}
        onClose={() => setForm({ open: false, editing: null })}
        editing={form.editing}
      />
    </div>
  )
}

function GoalHowItWorks() {
  return (
    <div className="layer-chain">
      {[
        { label: 'Goal', note: 'the outcome and why it matters' },
        { label: 'Milestones', note: 'the checkpoints along the way' },
        { label: 'Projects · Assignments', note: 'the work with a deadline' },
        { label: 'Habits', note: 'what you repeat, daily or weekly' },
      ].map((l, i) => (
        <div key={l.label} className="layer-step">
          <span className="layer-index tnum" aria-hidden="true">{i + 1}</span>
          <div>
            <p className="layer-label">{l.label}</p>
            <p className="layer-note">{l.note}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------
   GOAL CARD — Phase 6 hierarchy: NAME → PROGRESS → DEADLINE /
   HEALTH → NEXT MILESTONE → ACTION. Clear primary/secondary
   emphasis; reached goals recede.
   ------------------------------------------------------------ */
function GoalCard({ goal, today, from, onEdit, onArchive, onDelete, onLinks, linksOpen }) {
  const { state, dispatch } = useStore()
  const now = new Date()
  const badge = healthBadge(state, goal, { now })
  const reached = badge.reached
  const health = goalHealth(state, goal, { now })
  const prog = goalProgress(state, goal, { now })
  const pace = goalPace(goal, { now })
  const area = areaOf(goal.area)
  const next = nextMilestone(goal)
  const doneMilestones = (goal.milestones || []).filter((m) => m.done).length
  const totalMilestones = (goal.milestones || []).length
  const actions = goalTodayActions(state, goal, { date: today })
  const pending = actions.filter((a) => !a.done)

  const linkedHabits = (goal.linkedHabitIds || [])
    .map((id) => (state.habits || []).find((h) => h.id === id))
    .filter(Boolean)
  const linkedProjects = (goal.linkedProjectIds || [])
    .map((id) => (state.projects || []).find((p) => p.id === id))
    .filter(Boolean)
  const allHabits = activeHabits(state)
  const openProjects = (state.projects || []).filter((p) => !p.archived && !p.completedAt)
  const openAssignments = (state.assignments || []).filter((a) => !a.archived && !a.completedAt)
  const linkedAssignments = (goal.linkedAssignmentIds || [])
    .map((id) => (state.assignments || []).find((a) => a.id === id))
    .filter(Boolean)

  const toggleHabit = (habitId) => {
    const on = (goal.linkedHabitIds || []).includes(habitId)
    dispatch({ type: 'UPDATE_GOAL', id: goal.id, patch: { linkedHabitIds: on ? goal.linkedHabitIds.filter((x) => x !== habitId) : [...(goal.linkedHabitIds || []), habitId] } })
  }
  const toggleProject = (projectId) => {
    const on = (goal.linkedProjectIds || []).includes(projectId)
    dispatch({ type: 'UPDATE_GOAL', id: goal.id, patch: { linkedProjectIds: on ? goal.linkedProjectIds.filter((x) => x !== projectId) : [...(goal.linkedProjectIds || []), projectId] } })
  }
  const toggleAssignment = (aid) => {
    const on = (goal.linkedAssignmentIds || []).includes(aid)
    dispatch({ type: 'UPDATE_GOAL', id: goal.id, patch: { linkedAssignmentIds: on ? goal.linkedAssignmentIds.filter((x) => x !== aid) : [...(goal.linkedAssignmentIds || []), aid] } })
  }

  const daysLeft = badge.daysLeft
  const deadlineText = reached
    ? `Reached ${goal.completedAt ? prettyDate(dayOf(goal.completedAt)) : ''}`.trim()
    : daysLeft == null
      ? (goal.targetDate ? `Target ${prettyDate(goal.targetDate)}` : 'No target date')
      : daysLeft < 0
        ? `${Math.abs(daysLeft)}d past target`
        : daysLeft === 0
          ? 'Target is today'
          : `Target ${prettyDate(goal.targetDate)} · ${daysLeft}d left`

  return (
    <article className={`goal-card${reached ? ' is-reached' : ''}`} data-tone={reached ? 'good' : badge.tone} aria-label={`Goal ${goal.title}`}>
      <div className="goal-head">
        <div className="goal-main">
          <div className="goal-eyebrow" aria-hidden="false">
            <span className="chip">
              <span className="dot" style={{ background: `var(${area.cssVar})` }} />
              {area.label}
            </span>
            <span className={`health-pill${reached ? '' : ` status-pill`}`} data-tone={badge.tone} aria-label={`Health: ${badge.text}`}>
              {badge.text}
            </span>
          </div>

          <h2 className="goal-title">
            <Link to={`goals/${goal.id}`} className="goal-title-link">
              {goal.title}
            </Link>
          </h2>
          {goal.why && !reached && <p className="goal-why">{goal.why}</p>}

          {!reached && (
            <div className="goal-progress">
              <Meter
                pct={prog.pct}
                tone={health.tone}
                pace={pace ? pace.expected : null}
                label={`${goal.title}: ${prog.pct}% complete${pace ? `, expected pace ${pace.expected}%` : ''}`}
              />
            </div>
          )}
        </div>

        <div className="goal-stat" aria-label={`${prog.pct} percent complete`}>
          <span className="goal-pct tnum">{prog.pct}%</span>
          {reached && <span className="goal-reached-tag"><IconCheck size={13} /> Reached</span>}
        </div>
      </div>

      <dl className="goal-meta">
        <div>
          <dt>Deadline</dt>
          <dd>{reached ? deadlineText : (goal.targetDate ? deadlineText : 'No target date')}</dd>
        </div>
        {!reached && totalMilestones > 0 && (
          <div>
            <dt>Milestones</dt>
            <dd className="tnum">{doneMilestones}/{totalMilestones}</dd>
          </div>
        )}
        {prog.source !== 'none' && !reached && (
          <div>
            <dt>Progress</dt>
            <dd>{prog.detail}</dd>
          </div>
        )}
        <div>
          <dt>Health</dt>
          <dd data-tone={badge.tone}>{badge.note || badge.text}</dd>
        </div>
      </dl>

      {/* NEXT MILESTONE — the primary execution surface on the card */}
      {reached ? (
        <p className="goal-reached-note">This outcome is complete. Open it to review progress and notes.</p>
      ) : totalMilestones > 0 ? (
        <div className="goal-next">
          <div className="goal-next-label">
            <IconChevronRight size={14} />
            {next ? 'Next milestone' : 'Milestones'}
            <span className="tnum">({doneMilestones}/{totalMilestones})</span>
          </div>
          {next ? (
            <div className="goal-next-row">
              <button
                type="button"
                className="goal-next-toggle"
                aria-pressed={next.done}
                onClick={() => dispatch({ type: 'TOGGLE_GOAL_MILESTONE', id: goal.id, milestoneId: next.id })}
              >
                <span className="ms-box" aria-hidden="true">{next.done ? <IconCheck size={13} /> : null}</span>
                <span className="goal-next-name">{next.name}</span>
                {isValidDayStr(next.targetDate) && <span className="goal-next-date tnum">{prettyDate(next.targetDate)}</span>}
                <IconChevronRight size={14} className="goal-next-open" aria-hidden="true" />
              </button>
              <Link to={`goals/${goal.id}`} className="btn ghost sm goal-open-btn" aria-label={`Open ${goal.title}`}>
                Open
              </Link>
            </div>
          ) : (
            <p className="tiny muted">All milestones reached — this goal is complete.</p>
          )}
        </div>
      ) : (
        !reached && (
          <div className="goal-next empty-milestone">
            <button type="button" className="btn ghost sm" onClick={() => onEdit(goal)}>
              <IconPlus size={14} /> Add a milestone
            </button>
            <span className="tiny muted">No milestones yet — progress will derive from linked work or a manual percent.</span>
          </div>
        )
      )}

      {/* Link existing work */}
      <div className="goal-linkbar">
        <button type="button" className="btn ghost sm" onClick={() => onLinks(goal)} aria-expanded={linksOpen}>
          <IconLink size={14} /> {linksOpen ? 'Done' : 'Link work'}
        </button>
        {!reached && next && (
          <span className="tiny muted goal-today-hint">
            {pending.length === 0 ? 'Nothing linked is due today.' : `Today: ${pending.slice(0, 2).map((a) => a.name).join(', ')}${pending.length > 2 ? ` +${pending.length - 2}` : ''}`}
          </span>
        )}
      </div>

      {linksOpen && (
        <div className="goal-links">
          <p className="field-label" style={{ marginTop: 4 }}>Habits</p>
          {allHabits.length === 0 ? (
            <p className="tiny muted">Add a habit first, then link it here.</p>
          ) : (
            <div className="wrap-gap" style={{ gap: 6 }}>
              {allHabits.map((h) => {
                const on = (goal.linkedHabitIds || []).includes(h.id)
                return (
                  <button key={h.id} type="button" className="chip-btn" aria-pressed={on} onClick={() => toggleHabit(h.id)}>
                    {on && <IconCheck size={13} />}
                    {h.name}
                  </button>
                )
              })}
            </div>
          )}

          <p className="field-label" style={{ marginTop: 12 }}>Projects</p>
          {openProjects.length === 0 ? (
            <p className="tiny muted">No open projects yet.</p>
          ) : (
            <div className="wrap-gap" style={{ gap: 6 }}>
              {openProjects.map((p) => {
                const on = (goal.linkedProjectIds || []).includes(p.id)
                return (
                  <button key={p.id} type="button" className="chip-btn" aria-pressed={on} onClick={() => toggleProject(p.id)}>
                    {on && <IconCheck size={13} />}
                    {p.name}
                  </button>
                )
              })}
            </div>
          )}

          <p className="field-label" style={{ marginTop: 12 }}>Assignments</p>
          {openAssignments.length === 0 ? (
            <p className="tiny muted">No open assignments yet.</p>
          ) : (
            <div className="wrap-gap" style={{ gap: 6 }}>
              {openAssignments.map((a) => {
                const on = (goal.linkedAssignmentIds || []).includes(a.id)
                return (
                  <button key={a.id} type="button" className="chip-btn" aria-pressed={on} onClick={() => toggleAssignment(a.id)}>
                    {on && <IconCheck size={13} />}
                    {a.name}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Linked contributors, always visible when they exist */}
      {(linkedHabits.length > 0 || linkedProjects.length > 0 || linkedAssignments.length > 0) && !linksOpen && !reached && (
        <div className="goal-linked">
          {linkedHabits.map((h) => {
            const r = habitRate(state, h, from, today)
            const streak = habitStreak(state, h)
            return (
              <Link key={h.id} to={`habits/${h.id}`} className="goal-habit">
                <span className="dot" style={{ background: `var(${area.cssVar})` }} />
                <span className="goal-habit-name ellipsis">{h.name}</span>
                {streak > 1 && (
                  <span className="tiny tnum" style={{ color: 'var(--warn)', fontWeight: 700, display: 'inline-flex', gap: 3, alignItems: 'center' }}>
                    <IconFlame size={12} />{streak}d
                  </span>
                )}
                <span className="tiny muted tnum" style={{ flex: 'none' }}>
                  {r.rate == null ? 'no data' : `${Math.round(r.rate * 100)}% 30d`}
                </span>
              </Link>
            )
          })}
          {linkedProjects.map((p) => (
            <Link key={p.id} to={`projects/${p.id}`} className="goal-habit">
              <span className="dot" style={{ background: 'var(--accent-1)' }} />
              <span className="goal-habit-name ellipsis">{p.name}</span>
              <span className="tiny muted tnum" style={{ flex: 'none' }}>{projectProgress(p).pct}%</span>
            </Link>
          ))}
          {linkedAssignments.map((a) => (
            <Link key={a.id} to={`assignments/${a.id}`} className="goal-habit">
              <span className="dot" style={{ background: 'var(--info)' }} />
              <span className="goal-habit-name ellipsis">{a.name}</span>
              <span className="tiny muted tnum" style={{ flex: 'none' }}>{a.progress ?? 0}%</span>
            </Link>
          ))}
        </div>
      )}

      {!reached && pending.length > 0 && (
        <p className="goal-today">
          Today: {pending.slice(0, 3).map((a) => a.name).join(', ')}{pending.length > 3 ? ` +${pending.length - 3} more` : ''}
        </p>
      )}

      <div className="goal-foot">
        <button className="btn ghost sm" onClick={() => onEdit(goal)}><IconPencil size={14} /> Edit</button>
        <span style={{ flex: 1 }} />
        <button className="btn ghost sm" onClick={() => onArchive(goal)} aria-label={`Archive ${goal.title}`}><IconArchive size={15} /></button>
        <button className="btn ghost sm" style={{ color: 'var(--bad)' }} onClick={() => onDelete(goal)} aria-label={`Delete ${goal.title}`}><IconTrash size={15} /></button>
      </div>
    </article>
  )
}
