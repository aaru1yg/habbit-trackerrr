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
import { todayStr, dayStr } from '../lib/dates.js'
import { describeHabit } from '../components/habits/habitRowModel.js'
import { dayStats } from '../lib/stats.js'
import { recoveryPlan } from '../lib/planning.js'
import PlanningPanel from '../components/today/PlanningPanel.jsx'
import FocusMode from '../components/today/FocusMode.jsx'
import Button from '../components/primitives/Button.jsx'
import { IconPlus, IconTarget, IconClock, IconCalendar, IconMind, IconChevronRight, IconFlame } from '../lib/icons.jsx'
import '../styles/habits.css'
import '../styles/habits-workspace.css'
import '../styles/habit-routines.css'
import '../styles/habits-ref.css'

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
function TodaySummary({ rows, top }) {
  const live = rows.filter((r) => !r.archived)
  const scheduledToday = live.filter((r) => r.scheduledToday)
  const doneToday = scheduledToday.filter((r) => r.done)
  const remaining = scheduledToday.length - doneToday.length
  const paused = live.filter((r) => r.paused).length
  const atRisk = live.filter((r) => !r.paused && (r.atRisk || r.miss)).length

  const pct = scheduledToday.length ? Math.round((100 * doneToday.length) / scheduledToday.length) : 0
  const R = 15.5
  const C = 2 * Math.PI * R
  return (
    <div className="hw-summary" role="status" aria-live="polite" aria-label="Today at a glance">
      <div className="hb-tile hb-tile--ring">
        <span className="hb-tile__ring" aria-hidden="true">
          <svg viewBox="0 0 40 40" focusable="false">
            <circle className="hb-tile__ring-track" cx="20" cy="20" r={R} fill="none" strokeWidth="4" />
            <circle
              className="hb-tile__ring-arc"
              cx="20" cy="20" r={R} fill="none" strokeWidth="4" strokeLinecap="round"
              strokeDasharray={`${Math.round((pct / 100) * C)} ${C}`}
              transform="rotate(-90 20 20)"
            />
          </svg>
        </span>
        <span className="hb-tile__body">
          <span className="hb-tile__num">{doneToday.length} / {scheduledToday.length}</span>
          <span className="hb-tile__label">Completed today</span>
        </span>
      </div>
      <div className="hb-tile">
        <span className="hb-tile__dot" data-tone="remaining" aria-hidden="true" />
        <span className="hb-tile__body">
          <span className="hb-tile__num">{remaining}</span>
          <span className="hb-tile__label">Remaining</span>
        </span>
      </div>
      <div className="hb-tile">
        <span className="hb-tile__dot" data-tone="attention" aria-hidden="true" />
        <span className="hb-tile__body">
          <span className="hb-tile__num">{atRisk}</span>
          <span className="hb-tile__label">Needs attention</span>
        </span>
      </div>
      <div className="hb-tile">
        <span className="hb-tile__flame" aria-hidden="true"><IconFlame size={14} /></span>
        <span className="hb-tile__body">
          <span className="hb-tile__num">{top.streak}</span>
          <span className="hb-tile__label">Current best streak</span>
        </span>
      </div>
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
  const { state, dispatch } = useStore()
  const habitUI = useHabitUI()
  const view = HABIT_VIEWS.some((v) => v.id === requested) ? requested : 'active'
  const today = todayStr()
  // Reference rail: same tools Today uses; panels mount on first open.
  const [planTick, setPlanTick] = useState(0)
  const [focusTick, setFocusTick] = useState(0)
  const now = useMemo(() => new Date(), [])
  const openPlan = () => setPlanTick((n) => n + 1)
  const openFocus = () => setFocusTick((n) => n + 1)

  const rows = useMemo(
    () => [...(state.habits || [])]
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((h) => describeHabit(state, h, today)),
    [state, today],
  )

  // Rail data: real week stats (Mon–Sun) + top streak + recovery availability.
  const weekStrip = useMemo(() => {
    const base = new Date(now)
    base.setDate(base.getDate() - ((base.getDay() + 6) % 7)) // Monday
    return [...Array(7)].map((_, i) => {
      const d = new Date(base)
      d.setDate(base.getDate() + i)
      return dayStats(state, dayStr(d))
    })
  }, [state, now])
  const weekDone = weekStrip.reduce((n, d) => n + d.done, 0)
  const weekTotal = weekStrip.reduce((n, d) => n + d.total, 0)
  const weekPct = weekTotal ? Math.round((100 * weekDone) / weekTotal) : 0
  const top = useMemo(() => {
    let best = { streak: 0, habit: null }
    for (const r of rows) {
      if (r.archived || r.paused) continue
      if (r.streak > best.streak) best = { streak: r.streak, habit: r.habit }
    }
    return best
  }, [rows])
  const recovery = useMemo(() => recoveryPlan(state, { now }), [state, now])

  const viewMeta = HABIT_VIEWS.find((v) => v.id === view) || HABIT_VIEWS[0]
  const title = viewMeta.title
  const sub =
    view === 'routines' ? 'Stack habits into repeatable sequences.'
    : view === 'calendar' ? 'What happened, habit by day.'
    : view === 'week' ? 'Completion, change, and what needs attention.'
    : 'Small habits. Big results. Build the life you want.'

  const primaryAction = view === 'routines'
    ? { label: 'New routine', onClick: () => {} /* routines body has its own button */ , hidden: true }
    : { label: 'New habit', onClick: habitUI.openAdd }

  return (
    <main className="screen habits-screen" id="habits-screen" data-view={view}>
      {/* 1. PAGE HEADER */}
      <header className="habits-head">
        <div className="habits-head__title-block" style={{ minWidth: 0 }}>
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
          {/* 3. TODAY SUMMARY — reference stat tiles */}
          <TodaySummary rows={rows} top={top} />
          {/* 4 + 5. CONTROLS + COLLECTION (HabitList owns both) */}
          <HabitList />
          {/* 6. RAIL — This week, quick actions, art (reference right column). */}
          <aside className="hb-rail" aria-label="Habit progress and tools">
            <section className="tdy-card hb-week" aria-labelledby="hb-week-heading">
              <div className="hb-week__head">
                <h2 id="hb-week-heading" className="tdy-card__title">This week</h2>
                {weekTotal > 0 && <span className="hb-week__pct">{weekPct}%</span>}
              </div>
              <p className="hb-week__sub">
                {weekTotal > 0 ? `${weekDone} of ${weekTotal} completed` : 'Nothing scheduled this week yet.'}
              </p>
              {weekTotal > 0 && (
                <div className="p-progress hb-week__bar" role="progressbar" aria-valuenow={weekPct} aria-valuemin={0} aria-valuemax={100} aria-label="This week's completion">
                  <div className="p-progress__bar hb-week__bar-fill" style={{ width: `${weekPct}%` }} />
                </div>
              )}
              <div className="hb-week__strip" role="list" aria-label="Completion by day">
                {weekStrip.map((d, i) => (
                  <div key={d.date} role="listitem" className={`hb-week__day${d.date === today ? ' is-today' : ''}${d.date > today ? ' is-future' : ''}`}>
                    <span className="hb-week__day-label">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i]}</span>
                    <span className="hb-week__day-num">{d.date > today ? '' : d.total ? `${d.done}/${d.total}` : '–'}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="tdy-card hb-quick" aria-labelledby="hb-quick-heading">
              <h2 id="hb-quick-heading" className="tdy-card__title">Quick actions</h2>
              <nav className="tdy-quick__list" aria-label="Habit tools">
                <button type="button" className="tdy-quick__row" onClick={openFocus} aria-label="Open focus mode">
                  <span className="tdy-quick__ico" data-tone="accent" aria-hidden="true"><IconClock size={16} /></span>
                  <span className="tdy-quick__body"><span className="tdy-quick__title">Start focus</span><span className="tdy-quick__sub">25 min Pomodoro</span></span>
                  <IconChevronRight size={14} aria-hidden="true" />
                </button>
                <button type="button" className="tdy-quick__row" onClick={openPlan} aria-label="Open day planner">
                  <span className="tdy-quick__ico" data-tone="plan" aria-hidden="true"><IconTarget size={16} /></span>
                  <span className="tdy-quick__body"><span className="tdy-quick__title">Plan my day</span><span className="tdy-quick__sub">Time block</span></span>
                  <IconChevronRight size={14} aria-hidden="true" />
                </button>
                {recovery?.keep?.length > 0 && (
                  <button type="button" className="tdy-quick__row" onClick={openPlan} aria-label="View recovery suggestions">
                    <span className="tdy-quick__ico" data-tone="recover" aria-hidden="true"><IconMind size={16} /></span>
                    <span className="tdy-quick__body"><span className="tdy-quick__title">Recovery</span><span className="tdy-quick__sub">Get unstuck</span></span>
                    <IconChevronRight size={14} aria-hidden="true" />
                  </button>
                )}
                <Link className="tdy-quick__row" to="habits?view=calendar" aria-label="Open calendar view">
                  <span className="tdy-quick__ico" data-tone="calendar" aria-hidden="true"><IconCalendar size={16} /></span>
                  <span className="tdy-quick__body"><span className="tdy-quick__title">Open calendar</span><span className="tdy-quick__sub">View full schedule</span></span>
                  <IconChevronRight size={14} aria-hidden="true" />
                </Link>
              </nav>
            </section>

            <div className="tdy-art" aria-hidden="true">
              <img src="art/scene-hero.webp" alt="" loading="lazy" />
              <p>Consistent habits create a better you.</p>
            </div>
            <p className="hb-quote" role="note">One day at a time.</p>
          </aside>
        </>
      )}

      {view === 'active' && planTick > 0 && (
        <PlanningPanel state={state} now={now} openTick={planTick} defaultOpen onClose={() => setPlanTick(0)} />
      )}
      {view === 'active' && focusTick > 0 && (
        <FocusMode state={state} dispatch={dispatch} now={now} openTick={focusTick} defaultOpen onClose={() => setFocusTick(0)} />
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
