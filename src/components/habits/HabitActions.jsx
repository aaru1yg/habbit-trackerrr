/* ============================================================
   HABIT ACTIONS — one place for the management verbs the Habits
   workspace exposes (Phase 5 §5, §16-17, §35).

   useHabitActions() wraps the existing reducer actions and the
   shared HabitUIProvider (form, archive/undo, delete/undo) with
   the toasts the old Library card used, so the list row, the
   actions sheet and the detail page all behave identically.

   HabitActionsSheet is the "⋯" overflow: View · Edit · Skip today
   · Pause/Resume · Archive/Restore · Delete (confirmed).
   ============================================================ */
import { useCallback, useState } from 'react'
import { useStore } from '../../store.jsx'
import { useOptionalToast } from '../ui/Toaster.jsx'
import Sheet from '../ui/Sheet.jsx'
import { useHabitUI } from './HabitUIProvider.jsx'
import { isPaused, isScheduled } from '../../lib/schedule.js'
import { isDone } from '../../lib/stats.js'
import { todayStr, addDaysStr, shortDate, weekdayShort } from '../../lib/dates.js'
import { navigate } from '../../lib/router.jsx'
import { interactionFeedback } from '../../lib/motion.js'
import { IconChevronRight, IconTrash } from '../../lib/icons.jsx'

export function useHabitActions() {
  const { dispatch } = useStore()
  const toast = useOptionalToast()
  const habitUI = useHabitUI()

  /** Toggle a check-in for any loggable date (today or a missed day). */
  const log = useCallback((habit, date, { done = false } = {}) => {
    interactionFeedback(done ? 'uncomplete' : 'complete', { habitId: habit.id, date })
    dispatch({ type: 'TOGGLE_CHECKIN', habitId: habit.id, date })
    if (date !== todayStr() && !done) {
      toast?.show(`Logged ${habit.name} for ${weekdayShort(date)} ${shortDate(date)}`, {
        actionLabel: 'Undo',
        onAction: () => dispatch({ type: 'TOGGLE_CHECKIN', habitId: habit.id, date }),
      })
    }
  }, [dispatch, toast])

  const togglePause = useCallback((habit) => {
    const today = todayStr()
    if (isPaused(habit, today)) {
      dispatch({ type: 'PAUSE_HABIT', id: habit.id, from: null })
      toast?.show(`${habit.name} resumed`)
      return
    }
    const until = addDaysStr(today, 7)
    dispatch({ type: 'PAUSE_HABIT', id: habit.id, from: today, until })
    toast?.show(`${habit.name} paused until ${shortDate(until)}`, {
      actionLabel: 'Undo',
      onAction: () => dispatch({ type: 'PAUSE_HABIT', id: habit.id, from: null }),
    })
  }, [dispatch, toast])

  const skipToday = useCallback((habit) => {
    const today = todayStr()
    dispatch({ type: 'SKIP_DAY', id: habit.id, date: today })
    toast?.show(`Skipped ${habit.name} today — not counted as a miss`, {
      actionLabel: 'Undo',
      onAction: () => dispatch({ type: 'SKIP_DAY', id: habit.id, date: today }),
    })
  }, [dispatch, toast])

  return {
    log,
    togglePause,
    skipToday,
    edit: habitUI?.openEdit,
    add: habitUI?.openAdd,
    archive: habitUI?.archive,
    remove: habitUI?.remove,
    view: (habit) => navigate(`habits/${habit.id}`),
  }
}

export function HabitActionsSheet({ habit, open, onClose }) {
  const { state } = useStore()
  const actions = useHabitActions()
  const [confirming, setConfirming] = useState(false)
  const today = todayStr()
  const close = () => { setConfirming(false); onClose() }
  const run = (fn) => { close(); fn(habit) }

  const paused = habit ? isPaused(habit, today) : false
  const canSkip = habit && !habit.archived && !paused && isScheduled(habit, today) && !isDone(state, habit.id, today)

  return (
    <Sheet open={open && !!habit} onClose={close} title={habit?.name || 'Habit'} labelledBy="habit-actions-title">
      {habit && (
        <div className="stack" style={{ gap: 10 }}>
          <div className="item-actions" role="group" aria-label={`Actions for ${habit.name}`}>
            <button type="button" className="btn item-action" onClick={() => run(actions.view)}>
              <span>View</span><IconChevronRight size={15} />
            </button>
            <button type="button" className="btn item-action" onClick={() => run(actions.edit)}>
              <span>Edit</span><IconChevronRight size={15} />
            </button>
            {canSkip && (
              <button type="button" className="btn item-action" onClick={() => run(actions.skipToday)}>
                <span>Skip today</span><IconChevronRight size={15} />
              </button>
            )}
            {!habit.archived && (
              <button type="button" className="btn item-action" onClick={() => run(actions.togglePause)}>
                <span>{paused ? 'Resume' : 'Pause for a week'}</span><IconChevronRight size={15} />
              </button>
            )}
            <button type="button" className="btn item-action" onClick={() => run(actions.archive)}>
              <span>{habit.archived ? 'Restore' : 'Archive'}</span><IconChevronRight size={15} />
            </button>
            <button
              type="button"
              className="btn item-action danger"
              aria-describedby={confirming ? 'habit-delete-confirm' : undefined}
              onClick={() => { if (!confirming) { setConfirming(true); return } run(actions.remove) }}
            >
              <span>{confirming ? 'Confirm delete' : 'Delete'}</span><IconTrash size={15} />
            </button>
          </div>
          {confirming && (
            <p id="habit-delete-confirm" className="capture-warn" role="alert">
              Deleting removes every check-in for this habit. An Undo will be offered right after.
            </p>
          )}
        </div>
      )}
    </Sheet>
  )
}
