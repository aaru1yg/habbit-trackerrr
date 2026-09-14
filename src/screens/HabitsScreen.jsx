/* ============================================================
   HABITS WORKSPACE (Step 4B)

   #/habits                → Active (default)
   #/habits?view=routines  → Routines
   #/habits?view=calendar  → Calendar (lazy)
   #/habits?view=week      → Week review (lazy)
   #/habits/:id            → Habit detail (HabitDetailScreen)

   Hierarchy:
     1. PAGE HEADER     eyebrow / H1 / primary action
     2. SECTION TABS    Active · Routines · Calendar · Week
     3. TODAY SUMMARY   "N of M done · X remaining [· Y paused]"
     4. HABIT CONTROLS  lightweight filter strip
     5. HABIT COLLECTION  HabitObject list
   ============================================================ */
import { lazy, Suspense, useMemo, useState } from 'react'
import { useStore } from '../store.jsx'
import { useHabitUI } from '../components/habits/HabitUIProvider.jsx'
import HabitList from '../components/habits/HabitList.jsx'
import RoutinesView, { RoutineForm } from '../components/habits/Routines.jsx'
import { Link } from '../lib/router.jsx'
import { todayStr } from '../lib/dates.js'
import { describeHabit } from '../components/habits/habitRowModel.js'
import Button from '../components/primitives/Button.jsx'
import { IconPlus } from '../lib/icons.jsx'
import '../styles/habits.css'
import '../styles/habits-workspace.css'

const CalendarView = lazy(() => import('./CalendarScreen.jsx'))
const WeekView = lazy(() => import('./WeekScreen.jsx'))

const HABIT_VIEWS = [
  { id: 'active',   label: 'Active',   title: 'Habits',      to: 'habits' },
  { id: 'routines', label: 'Routines', title: 'Habits',      to: 'habits?view=routines' },
  { id: 'calendar', label: 'Calendar', title: 'Calendar',    to: 'habits?view=calendar' },
  { id: 'week',     label: 'Week',     title: 'Week review', to: 'habits?view=week' },
]

function HabitTabs({ view }) {
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

/** A single concise summary unit: "N of M done · X remaining · Y need attention · Z paused" */
function TodaySummary({ rows }) {
  const live = rows.filter((r) => !r.archived)
  const scheduledToday = live.filter((r) => r.scheduledToday)
  const doneToday = scheduledToday.filter((r) => r.done)
  const remaining = scheduledToday.length - doneToday.length
  const paused = live.filter((r) => r.paused).length
  const atRisk = live.filter((r) => !r.paused && (r.atRisk || r.miss)).length

  return (
    <div className="hw-summary" role="status" aria-live="polite" aria-label="Today at a glance">
      <span className="hw-summary__num">{doneToday.length}</span>
      <span>of <span className="hw-summary__num">{scheduledToday.length}</span> <span className="hw-summary__done">complete</span></span>
      {remaining > 0 && (
        <>
          <span className="hw-summary__sep">·</span>
          <span className="hw-summary__remaining">{remaining} remaining</span>
        </>
      )}
      {atRisk > 0 && (
        <>
          <span className="hw-summary__sep">·</span>
          <span style={{ color: 'var(--warn)' }}>{atRisk} need{atRisk === 1 ? 's' : ''} attention</span>
        </>
      )}
      {paused > 0 && <span className="hw-summary__paused">{paused} paused</span>}
    </div>
  )
}

function RoutinesBody() {
  const [form, setForm] = useState({ open: false, editing: null })
  return (
    <div className="rt-shell">
      <div className="rt-shell__head">
        <Button variant="primary" onClick={() => setForm({ open: true, editing: null })} icon={<IconPlus size={16} />}>New routine</Button>
      </div>
      <RoutinesView onNew={() => setForm({ open: true, editing: null })} onEdit={(r) => setForm({ open: true, editing: r })} />
      <RoutineForm open={form.open} editing={form.editing} onClose={() => setForm({ open: false, editing: null })} />
    </div>
  )
}

export default function HabitsScreen({ view: requested = 'active', ymParam = null }) {
  const { state } = useStore()
  const habitUI = useHabitUI()
  const view = HABIT_VIEWS.some((v) => v.id === requested) ? requested : 'active'
  const today = todayStr()

  const rows = useMemo(
    () => [...(state.habits || [])]
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((h) => describeHabit(state, h, today)),
    [state, today],
  )

  const viewMeta = HABIT_VIEWS.find((v) => v.id === view) || HABIT_VIEWS[0]
  const title = viewMeta.title
  const sub =
    view === 'routines' ? 'Stack habits into repeatable sequences.'
    : view === 'calendar' ? 'What happened, habit by day.'
    : view === 'week' ? 'Completion, change, and what needs attention.'
    : 'Your daily system.'

  const primaryAction = view === 'routines'
    ? { label: 'New routine', onClick: () => {} /* routines body has its own button */ , hidden: true }
    : { label: 'New habit', onClick: habitUI.openAdd }

  return (
    <main className="screen habits-screen" id="habits-screen" data-view={view}>
      {/* 1. PAGE HEADER */}
      <header className="habits-head">
        <div className="habits-head__title-block" style={{ minWidth: 0 }}>
          <p className="habits-head__eyebrow">
            {view === 'active' ? 'MANAGE · HABITS' : `MANAGE · ${viewMeta.label.toUpperCase()}`}
          </p>
          <h1 className="screen-title">{title}</h1>
          <p className="screen-sub">{sub}</p>
        </div>
        {!primaryAction.hidden && (
          <div className="head-actions">
            <Button
              variant="primary"
              onClick={primaryAction.onClick}
              icon={<IconPlus size={16} />}
              aria-label={primaryAction.label}
            >
              {primaryAction.label}
            </Button>
          </div>
        )}
      </header>

      {/* 2. SECTION TABS */}
      <HabitTabs view={view} />

      {view === 'active' && (
        <>
          {/* 3. TODAY SUMMARY */}
          <TodaySummary rows={rows} />
          {/* 4 + 5. CONTROLS + COLLECTION (HabitList owns both) */}
          <HabitList />
        </>
      )}

      {view !== 'active' && (
        <div className="habits-body">
          {view === 'routines' && <RoutinesBody />}
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
      )}
    </main>
  )
}
