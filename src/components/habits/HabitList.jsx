/* ============================================================
   HABIT LIST — Active view of the Habits workspace (Step 4B).
   Renders the habit collection using HabitObject (Step 4A).
   Owns list concerns: summary-derived filters, ordering, missed
   logging, the actions sheet. No visual chrome of its own beyond
   a lightweight filter strip that belongs to the workspace.
   ============================================================ */
import { useMemo, useState } from 'react'
import { useStore } from '../../store.jsx'
import { useHabitActions, HabitActionsSheet } from './HabitActions.jsx'
import EmptyState from '../primitives/EmptyState.jsx'
import Button from '../primitives/Button.jsx'
import { todayStr } from '../../lib/dates.js'
import { describeHabit, HABIT_FILTERS, matchesFilter, filterCounts } from './habitRowModel.js'
import HabitObject from './HabitObject.jsx'
import { IconPlus } from '../../lib/icons.jsx'

function HabitRowLine({ row, onMore, onFire }) {
  const actions = useHabitActions()
  const { habit, status, done, scheduledToday, paused, archived, streak, miss, atRisk, schedule, next } = row
  const today = todayStr()

  const toggle = () => {
    if (!done) onFire?.()
    actions.log(habit, today, { done })
  }

  // Status label shown on the object's meta line.
  // The object's own secondary line gets one focused signal: Today / Completed /
  // Paused / Archived / Next {date} / Missed {day}. Schedule is always shown.
  let statusInfo = null
  if (paused) {
    statusInfo = { label: 'Paused', tone: 'neutral' }
  } else if (archived) {
    statusInfo = { label: 'Archived', tone: 'neutral' }
  } else if (status.id === 'completed') {
    statusInfo = null // "Completed" is conveyed by ring + button state; avoid redundancy
  } else if (status.id === 'today' && streak > 0) {
    statusInfo = null // schedule already says "Daily"; streak already on meta
  } else if (miss && !scheduledToday) {
    statusInfo = { label: `Missed ${miss.label}`, tone: 'warning' }
  } else if (next) {
    statusInfo = { label: `Next ${next.label}`, tone: 'neutral' }
  }

  return (
    <li
      className={`hlist-item${done ? ' is-done' : ''}${paused ? ' is-paused' : ''}${archived ? ' is-archived' : ''}${miss && !scheduledToday ? ' is-missed' : ''}`}
      data-status={status.id}
      data-habit={habit.id}
    >
      <HabitObject
        habit={habit}
        done={done}
        streak={streak}
        schedule={schedule}
        reminder={row.reminder}
        status={statusInfo}
        paused={paused}
        archived={archived}
        atRisk={atRisk}
        scheduledToday={scheduledToday && !archived}
        onToggleComplete={scheduledToday && !archived ? toggle : undefined}
        onDetail={(h) => { window.location.hash = `#/habits/${h.id}` }}
        onMore={(h) => onMore(h.id)}
      />
      {miss && !paused && !archived && (
        <div className={`hlist-missed${!scheduledToday && !done ? ' hlist-missed--log' : ''}`}>
          {scheduledToday && !done && <span>Missed {miss.label}.</span>}
          <Button variant="quiet" size="sm" onClick={() => actions.log(habit, miss.date)} aria-label={`Log ${habit.name} for ${miss.label}`}>
            {scheduledToday && !done ? 'Log it' : (<><IconPlus size={14} aria-hidden="true" /> Log {miss.label}</>)}
          </Button>
        </div>
      )}
    </li>
  )
}

export default function HabitList() {
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
  // Hide Archived filter unless something is archived (existing behaviour).
  const filters = useMemo(
    () => HABIT_FILTERS.filter((f) => f.id !== 'archived' || counts.archived > 0),
    [counts],
  )

  const live = rows.filter((r) => !r.archived)
  if (live.length === 0 && counts.archived === 0) {
    return (
      <section className="habits-empty" aria-labelledby="habits-empty-title">
        <EmptyState
          icon={<IconPlus size={36} />}
          eyebrow="No habits yet"
          title="Start a daily system you'll actually stick with."
          action={(
            <div className="empty-actions">
              <Button variant="primary" onClick={actions.add} icon={<IconPlus size={16} />}>Create habit</Button>
            </div>
          )}
          titleProps={{ id: 'habits-empty-title' }}
        >
          Small and specific beats big and vague. Adding one takes about five seconds.
        </EmptyState>
      </section>
    )
  }

  const moreHabit = more ? (state.habits || []).find((h) => h.id === more) || null : null

  return (
    <div className="habit-list-view">
      <div className="hw-controls" role="group" aria-label="Habit filters">
        {filters.map((f) => {
          const pressed = filter === f.id
          const count = counts[f.id]
          return (
            <button
              key={f.id}
              type="button"
              className="hw-filter"
              aria-pressed={pressed}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
              {count != null && count > 0 && (
                <span className="hw-filter__count" aria-hidden="true">{count}</span>
              )}
            </button>
          )
        })}
      </div>

      {visible.length === 0 ? (
        <p className="hw-filter-empty">
          {filter === 'attention' ? 'Nothing needs attention right now.'
            : filter === 'today' ? 'No habits scheduled for today.'
              : filter === 'paused' ? 'No paused habits.'
                : filter === 'archived' ? 'Nothing archived.'
                  : filter === 'active' ? 'No active habits.'
                    : 'No habits match this filter.'}
        </p>
      ) : (
        <ul className="hlist" aria-label="Habits">
          {visible.map((row) => <HabitRowLine key={row.habit.id} row={row} onMore={(id) => setMore(id)} onFire={() => { /* completion micro-sound hook reserved */ }} />)}
        </ul>
      )}

      <HabitActionsSheet habit={moreHabit} open={!!moreHabit} onClose={() => setMore(null)} />
    </div>
  )
}
