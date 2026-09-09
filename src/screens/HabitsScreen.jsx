/* ============================================================
   HABITS WORKSPACE — Phase 5.

   One place to MANAGE what you repeat (Today is where you DO it):

     #/habits                 → Active   (default)
     #/habits?view=routines   → Routines
     #/habits?view=calendar   → Calendar (history, habit × day)
     #/habits?view=week       → Week review
     #/habits/:id             → Habit detail (HabitDetailScreen)

   Legacy #/library, #/calendar and #/week render the same views
   through this screen so nothing users bookmarked breaks.

   Structure (§32-33): header → tabs → view body. No hero, no
   analytics wall above the list; the compact summary lives in the
   header line.
   ============================================================ */
import { lazy, Suspense, useMemo, useState } from 'react'
import { useStore } from '../store.jsx'
import { useHabitUI } from '../components/habits/HabitUIProvider.jsx'
import HabitList from '../components/habits/HabitList.jsx'
import RoutinesView, { RoutineForm } from '../components/habits/Routines.jsx'
import { Link } from '../lib/router.jsx'
import { todayStr } from '../lib/dates.js'
import { describeHabit, habitsSummary } from '../components/habits/habitRowModel.js'
import { IconPlus } from '../lib/icons.jsx'
import '../styles/habits.css'

/* The matrix and the review carry their own date maths; keep them out of
   the Active view's chunk so the default tab stays light. */
const CalendarView = lazy(() => import('./CalendarScreen.jsx'))
const WeekView = lazy(() => import('./WeekScreen.jsx'))

export const HABIT_VIEWS = [
  { id: 'active', label: 'Active', to: 'habits' },
  { id: 'routines', label: 'Routines', to: 'habits?view=routines' },
  { id: 'calendar', label: 'Calendar', to: 'habits?view=calendar' },
  { id: 'week', label: 'Week', to: 'habits?view=week' },
]

const VIEW_TITLES = { active: 'Habits', routines: 'Habits', calendar: 'Calendar', week: 'Week review' }

export function HabitTabs({ view }) {
  return (
    <nav className="habit-tabs" aria-label="Habit sections">
      {HABIT_VIEWS.map((v) => (
        <Link key={v.id} to={v.to} aria-current={view === v.id ? 'page' : undefined}>{v.label}</Link>
      ))}
    </nav>
  )
}

function ViewFallback() {
  return <div className="habits-loading" role="status" aria-label="Loading"><span className="spinner" aria-hidden="true" /></div>
}

export default function HabitsScreen({ view: requested = 'active', ymParam = null }) {
  const { state } = useStore()
  const habitUI = useHabitUI()
  const view = HABIT_VIEWS.some((v) => v.id === requested) ? requested : 'active'
  const [routineForm, setRoutineForm] = useState({ open: false, editing: null })
  const today = todayStr()

  const rows = useMemo(() => (state.habits || []).map((h) => describeHabit(state, h, today)), [state, today])
  const summary = useMemo(() => habitsSummary(rows), [rows])
  const routineCount = (state.routines || []).filter((r) => r.active !== false).length
  const live = rows.filter((r) => !r.archived)

  const sub = view === 'routines'
    ? `${routineCount} routine${routineCount === 1 ? '' : 's'} · ${live.length} habit${live.length === 1 ? '' : 's'} to stack`
    : view === 'calendar'
      ? 'What happened, habit by day. Tap a past cell to log it; press and hold for a note.'
      : view === 'week'
        ? 'Completion, change and what needs attention.'
        : summary

  return (
    <div className="screen habits-screen" id="habits-screen" data-view={view}>
      <header className="screen-head habits-head">
        <div style={{ minWidth: 0 }}>
          <h1 className="screen-title">{VIEW_TITLES[view]}</h1>
          <p className="screen-sub">{sub}</p>
        </div>
        <div className="head-actions">
          {view === 'routines' ? (
            <button type="button" className="btn primary" onClick={() => setRoutineForm({ open: true, editing: null })} disabled={live.length === 0}>
              <IconPlus size={16} /> New routine
            </button>
          ) : (
            <button type="button" className="btn primary" onClick={habitUI.openAdd} aria-label="New habit">
              <IconPlus size={16} /> New habit
            </button>
          )}
        </div>
      </header>

      <HabitTabs view={view} />

      <div className="habits-body">
        {view === 'active' && <HabitList onFire={habitUI.fire} />}
        {view === 'routines' && (
          <RoutinesView
            onNew={() => setRoutineForm({ open: true, editing: null })}
            onEdit={(r) => setRoutineForm({ open: true, editing: r })}
          />
        )}
        {view === 'calendar' && (
          <Suspense fallback={<ViewFallback />}>
            <CalendarView key={ymParam || 'current'} ymParam={ymParam} embedded />
          </Suspense>
        )}
        {view === 'week' && (
          <Suspense fallback={<ViewFallback />}>
            <WeekView embedded />
          </Suspense>
        )}
      </div>

      <RoutineForm
        open={routineForm.open}
        editing={routineForm.editing}
        onClose={() => setRoutineForm({ open: false, editing: null })}
      />
    </div>
  )
}
