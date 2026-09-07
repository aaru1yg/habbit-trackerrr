/* ============================================================
   ADAPTIVE HOME (§1, §2) — emphasis and quick actions.

   Emphasis, never structure: this component reports *why* Today is
   leaning the way it is and publishes the weights as CSS custom
   properties. It cannot add, remove or reorder a section, and every
   weight is already clamped inside EMPHASIS_RANGE by the engine.

   Quick actions are ranked from real observations. Below the threshold
   the engine returns the default order and says so; we show that
   caption rather than pretending the row was learned.
   ============================================================ */
import { useMemo } from 'react'
import { useStore } from '../../store.jsx'
import { useHabitUI } from '../habits/HabitUIProvider.jsx'
import { useWorkUI } from '../work/WorkUIProvider.jsx'
import { navigate } from '../../lib/router.jsx'
import { quickActions, EMPHASIS_RANGE } from '../../lib/personalization.js'
import { IconPlus, IconProjects, IconAssignment, IconSparkle, IconInsights, IconWorkload, IconClock, IconTarget } from '../../lib/icons.jsx'

const EMPHASIS_LABEL = {
  deadline: 'Deadlines',
  work: 'Project work',
  habit: 'Habits',
  goal: 'Goals',
}

const EMPHASIS_HEADING = {
  deadline: 'Deadlines',
  work: 'Project work',
  habit: 'Habits and consistency',
  goal: 'Goals and long-term progress',
  start: 'Getting started',
  balanced: 'A bit of everything',
}

/* Actions we can actually perform right now. Anything without a handler is
   not rendered — a button that does nothing would be a lie. Quick capture
   arrives in Phase E and joins this map then. */
const ACTION_ICON = {
  'add-habit': IconPlus,
  'add-project': IconProjects,
  'add-assignment': IconAssignment,
  'start-focus': IconTarget,
  'plan-day': IconClock,
  'review-workload': IconWorkload,
  'view-insights': IconInsights,
}

/** CSS custom properties the rest of Today reads to modulate emphasis. */
export function emphasisVars(emphasis) {
  return {
    '--emph-deadline': emphasis.weights.deadline,
    '--emph-work': emphasis.weights.work,
    '--emph-habit': emphasis.weights.habit,
    '--emph-goal': emphasis.weights.goal,
  }
}

export function AdaptiveEmphasis({ emphasis }) {
  const rows = Object.entries(emphasis.weights)
    .map(([id, weight]) => ({ id, weight, label: EMPHASIS_LABEL[id] }))
    .sort((a, b) => b.weight - a.weight || a.id.localeCompare(b.id))
  const span = EMPHASIS_RANGE.max - EMPHASIS_RANGE.min

  return (
    <section className="card pad adaptive-emphasis" aria-label="Why Today looks like this">
      <div className="row-between" style={{ gap: 12 }}>
        <p className="eyebrow" style={{ margin: 0 }}>Today’s emphasis</p>
        <span className="emphasis-badge">{EMPHASIS_HEADING[emphasis.id]}</span>
      </div>
      <p className="emphasis-reason">{emphasis.reason}</p>

      <ul className="emphasis-bars">
        {rows.map((r) => (
          <li key={r.id} data-active={emphasis.weights[r.id] >= 1.2}>
            <span className="emphasis-label">{r.label}</span>
            <span
              className="emphasis-track"
              role="img"
              aria-label={`${r.label} emphasis ${r.weight.toFixed(2)} times normal`}
            >
              <i style={{ width: `${Math.round(((r.weight - EMPHASIS_RANGE.min) / span) * 100)}%` }} />
            </span>
            <span className="emphasis-value tnum">{r.weight.toFixed(2)}×</span>
          </li>
        ))}
      </ul>

      {emphasis.evidence.length > 0 && (
        <p className="emphasis-evidence">
          {emphasis.evidence.map((e) => <span key={e.label}>{e.label}: <b>{e.value}</b></span>)}
        </p>
      )}
      <p className="tiny muted" style={{ marginTop: 10, lineHeight: 1.55 }}>
        Emphasis changes how strongly each area is shown. It never adds, removes or reorders a
        section, and nothing here is inferred about you beyond what you did in the app.
      </p>
    </section>
  )
}

export function AdaptiveQuickActions({ now, onFocus, onPlan }) {
  const { state } = useStore()
  const habitUI = useHabitUI()
  const workUI = useWorkUI()

  const result = useMemo(() => quickActions(state, { now, limit: 4 }), [state, now])

  const run = (id) => {
    switch (id) {
      case 'add-habit': return habitUI.openAdd()
      case 'add-project': return workUI.newProject()
      case 'add-assignment': return workUI.newAssignment()
      case 'start-focus': return onFocus?.()
      case 'plan-day': return onPlan?.()
      case 'review-workload': return navigate('workload')
      case 'view-insights': return navigate('insights')
      default: return null
    }
  }

  // Only render actions this build can actually carry out.
  const actions = result.actions.filter((a) => ACTION_ICON[a.id] && (a.id !== 'start-focus' || onFocus) && (a.id !== 'plan-day' || onPlan))
  if (!actions.length) return null

  return (
    <section className="card pad quick-actions" aria-label="Quick actions">
      <div className="row-between" style={{ gap: 12, marginBottom: 10 }}>
        <p className="eyebrow" style={{ margin: 0 }}><IconSparkle size={13} /> Quick actions</p>
        <span className="tiny muted">{result.source === 'observed' ? 'from your recent actions' : 'default order'}</span>
      </div>
      <div className="quick-action-row">
        {actions.map((a) => {
          const Icon = ACTION_ICON[a.id]
          return (
            <button key={a.id} type="button" className="btn quick-action" onClick={() => run(a.id)}>
              <Icon size={16} />
              <span>{a.label}</span>
            </button>
          )
        })}
      </div>
      <p className="tiny muted" style={{ marginTop: 10, lineHeight: 1.55 }}>{result.reason}</p>
    </section>
  )
}
