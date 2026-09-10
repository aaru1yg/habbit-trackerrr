/* ============================================================
   HABIT LIST — the Active view of the Habits workspace (§3-5, §20-22).

   Row grammar, left to right:
     NAME → TODAY STATUS → SCHEDULE → STREAK → ACTIONS
   Primary action is Complete / Completed (or a quick log for a
   missed day); everything else lives behind one "⋯" button that
   opens the shared HabitActionsSheet. Dense, 2D, scannable.
   ============================================================ */
import { useMemo, useState } from 'react'
import { useStore } from '../../store.jsx'
import { useHabitActions, HabitActionsSheet } from './HabitActions.jsx'
import Burst from '../motion/Burst.jsx'
import EmptyState from '../ui/EmptyState.jsx'
import { FilterBar } from '../work/WorkKit.jsx'
import { Link } from '../../lib/router.jsx'
import { categoryOf } from '../../lib/schedule.js'
import { todayStr } from '../../lib/dates.js'
import { describeHabit, HABIT_FILTERS, matchesFilter, filterCounts } from './habitRowModel.js'
import HabitRing from './HabitRing.jsx'
import { IconCheck, IconFlame, IconMore, IconClock, IconPlus } from '../../lib/icons.jsx'

function HabitRowLine({ row, onMore, onFire }) {
  const actions = useHabitActions()
  const [burst, setBurst] = useState(0)
  const { habit, status, done, scheduledToday, paused, archived, streak, miss } = row
  const cat = categoryOf(habit.category)
  const today = todayStr()

  const complete = () => {
    if (!done) { setBurst((b) => b + 1); onFire?.() }
    actions.log(habit, today, { done })
  }

  return (
    <li
      className={`hrow${done ? ' is-done' : ''}${paused ? ' is-paused' : ''}${archived ? ' is-archived' : ''}${status.id === 'missed' ? ' is-missed' : ''}`}
      data-status={status.id}
      data-habit={habit.id}
      style={{
        '--habit-color': `var(${cat.cssVar})`,
        '--habit-soft': `color-mix(in srgb, var(${cat.cssVar}) 16%, transparent)`,
        /* Blend toward var(--text) (not white) so the strong accent stays
           readable as text in daylight too — see HabitRow. */
        '--habit-strong': `color-mix(in srgb, var(${cat.cssVar}) 82%, var(--text))`,
      }}
    >
      <div className="hrow-main">
        <div
          className="hrow-identity"
          style={{
            '--habit-color': `var(${cat.cssVar})`,
            '--habit-soft': `color-mix(in srgb, var(${cat.cssVar}) 16%, transparent)`,
            '--habit-strong': `color-mix(in srgb, var(${cat.cssVar}) 82%, var(--text))`,
          }}
        >
          <HabitRing done={done} streak={streak} size={38} label={`${habit.name}: ${done ? 'completed today' : 'not completed today'}`} />
          <Link to={`habits/${habit.id}`} className="hrow-name" aria-label={`Open ${habit.name}`}>
            <span className="hrow-dot" style={{ background: `var(${cat.cssVar})` }} aria-hidden="true" />
            <span className="hrow-name-text">{habit.name}</span>
          </Link>
        </div>
        <div className="hrow-meta">
          <span className="status-pill hrow-status" data-tone={status.tone === 'neutral' ? undefined : status.tone} data-status={status.id}>
            {status.label}
          </span>
          <span className="hrow-schedule">
            {row.schedule}
            {row.pausedUntil && ` · until ${row.pausedUntil.slice(5).replace('-', '/')}`}
            {row.next && !paused && ` · next ${row.next.label}`}
          </span>
          {row.reminder && <span className="hrow-reminder"><IconClock size={11} aria-hidden="true" /> {row.reminder}</span>}
          {streak > 0 && (
            <span className={`hrow-streak${row.atRisk ? ' at-risk' : ''}`} title={row.atRisk ? 'Streak at risk today' : undefined}>
              <IconFlame size={12} aria-hidden="true" /> <span className="tnum">{streak}</span>d
              <span className="sr-only">{` streak${row.atRisk ? ', at risk today' : ''}`}</span>
            </span>
          )}
        </div>
      </div>

      <div className="hrow-actions">
        {scheduledToday && !archived && (
          <button
            type="button"
            className={`btn sm hrow-complete${done ? ' is-done' : ' primary'}`}
            aria-pressed={done}
            aria-label={`Mark ${habit.name} ${done ? 'not done' : 'complete'}`}
            onClick={complete}
          >
            <span className="hrow-complete-inner">
              <Burst fire={burst} count={9} spread={30} size={4} />
              {done ? <IconCheck size={15} aria-hidden="true" /> : null}
              {done ? 'Completed' : 'Complete'}
            </span>
          </button>
        )}
        {!scheduledToday && miss && !archived && !paused && (
          <button
            type="button"
            className="btn sm hrow-complete is-missed"
            aria-label={`Log ${habit.name} for ${miss.label}`}
            onClick={() => actions.log(habit, miss.date)}
          >
            <IconPlus size={14} aria-hidden="true" /> Log {miss.label}
          </button>
        )}
        {paused && (
          <button type="button" className="btn sm" onClick={() => actions.togglePause(habit)} aria-label={`Resume ${habit.name}`}>Resume</button>
        )}
        {archived && (
          <button type="button" className="btn sm" onClick={() => actions.archive(habit)} aria-label={`Restore ${habit.name}`}>Restore</button>
        )}
        <button type="button" className="btn ghost icon hrow-more" aria-label={`More actions for ${habit.name}`} aria-haspopup="dialog" onClick={() => onMore(habit)}>
          <IconMore size={18} />
        </button>
      </div>

      {scheduledToday && !done && miss && (
        <div className="hrow-missed">
          <span>Missed {miss.label}.</span>
          <button type="button" className="btn ghost sm" onClick={() => actions.log(habit, miss.date)} aria-label={`Log ${habit.name} for ${miss.label}`}>
            Log it
          </button>
        </div>
      )}
    </li>
  )
}

export default function HabitList({ onFire }) {
  const { state } = useStore()
  const actions = useHabitActions()
  const [filter, setFilter] = useState('all')
  const [more, setMore] = useState(null)
  const today = todayStr()

  const rows = useMemo(
    () => [...(state.habits || [])]
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((h) => describeHabit(state, h, today)),
    [state, today],
  )
  const counts = useMemo(() => filterCounts(rows), [rows])
  const visible = useMemo(() => rows.filter((r) => matchesFilter(r, filter)), [rows, filter])
  const filters = useMemo(() => HABIT_FILTERS.filter((f) => f.id !== 'archived' || counts.archived > 0), [counts])

  const live = rows.filter((r) => !r.archived)
  if (live.length === 0 && counts.archived === 0) {
    return (
      <section className="habits-empty card" aria-labelledby="habits-empty-title">
        <p className="eyebrow">No habits yet</p>
        <EmptyState
          art="art/empty-habits.webp"
          icon={<IconPlus size={40} />}
          title={<h2 id="habits-empty-title" style={{ font: 'inherit', margin: 0 }}>You don't have any habits yet.</h2>}
          action={(
            <div className="empty-actions">
              <button type="button" className="btn primary" onClick={actions.add}><IconPlus size={16} /> Create habit</button>
            </div>
          )}
        >
          Small and specific beats big and vague — adding one takes about five seconds.
        </EmptyState>
      </section>
    )
  }

  const moreHabit = more ? (state.habits || []).find((h) => h.id === more) || null : null

  return (
    <div className="habit-list-view">
      <FilterBar filters={filters} value={filter} onChange={setFilter} counts={counts} ariaLabel="Habit filters" />
      {visible.length === 0 ? (
        <p className="empty-note habits-filter-empty">
          {filter === 'attention' ? 'Nothing needs attention right now.'
            : filter === 'today' ? 'No habits scheduled for today.'
              : filter === 'paused' ? 'No paused habits.'
                : filter === 'archived' ? 'Nothing archived.'
                  : 'No habits match this filter.'}
        </p>
      ) : (
        <ul className="hlist" aria-label="Habits">
          {visible.map((row) => <HabitRowLine key={row.habit.id} row={row} onMore={(h) => setMore(h.id)} onFire={onFire} />)}
        </ul>
      )}
      <HabitActionsSheet habit={moreHabit} open={!!moreHabit} onClose={() => setMore(null)} />
    </div>
  )
}
