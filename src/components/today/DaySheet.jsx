/* ============================================================
   DAY SHEET — inspect any day's complete habit activity.
   Opened from the master graph (tap a day) and from Today.

   For every scheduled habit: colour dot, state, run/streak state
   and any check-in note the user wrote. Past + today can still be
   logged here (same rule as the calendar); future days are read
   only. Nothing is invented: off days are labelled "not scheduled".
   ============================================================ */
import { useStore } from '../../store.jsx'
import Sheet from '../ui/Sheet.jsx'
import { todayStr, prettyDate, shortDate } from '../../lib/dates.js'
import { eligibleOn, isDone, checkinOf, runEndingOn } from '../../lib/stats.js'
import { isScheduled } from '../../lib/schedule.js'
import { habitColorHex, habitPriority, priorityMeta } from '../../lib/habitIdentity.js'
import { IconFlame, IconCheck, IconNote } from '../../lib/icons.jsx'

export default function DaySheet({ date, onClose }) {
  const { state, dispatch } = useStore()
  if (!date) return null

  const today = todayStr()
  const future = date > today
  const habits = (state.habits || [])
    .filter((h) => !h.archived && isScheduled(h, date))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))

  const done = habits.filter((h) => isDone(state, h.id, date)).length
  const scheduledPast = habits.filter((h) => eligibleOn(h, date)).length

  const toggle = (h) => {
    if (future) return
    if (!eligibleOn(h, date)) return
    dispatch({ type: 'TOGGLE_CHECKIN', habitId: h.id, date })
  }

  const hasNotes = habits.some((h) => checkinOf(state, h.id, date)?.note)

  return (
    <Sheet open={!!date} onClose={onClose} title={prettyDate(date)} labelledBy="day-sheet-title">
      <div className="stack" style={{ gap: 14 }}>
        <div className="day-sheet-head">
          <p className="tiny muted">
            {future
              ? 'Upcoming — read only.'
              : scheduledPast === 0
                ? 'No habits were scheduled this day.'
                : `${done} of ${scheduledPast} scheduled habits completed${scheduledPast ? ' — tap a row to log it' : ''}.`}
          </p>
          {habits.length > 0 && !future && (
            <div className="meter" role="img" aria-label={`${done} of ${scheduledPast} completed`}>
              <i style={{ width: scheduledPast ? `${Math.round((done / scheduledPast) * 100)}%` : 0 }} />
            </div>
          )}
        </div>

        {habits.length === 0 ? (
          <p className="empty-note">Nothing scheduled on {prettyDate(date)}.</p>
        ) : (
          <ul className="day-sheet-list">
            {habits.map((h) => {
              const d = isDone(state, h.id, date)
              const check = checkinOf(state, h.id, date)
              const run = d ? runEndingOn(state, h, date) : 0
              const canToggle = !future && eligibleOn(h, date)
              const p = habitPriority(h)
              const tag = future ? 'upcoming'
                : d ? 'done'
                  : eligibleOn(h, date) ? 'remaining' : 'off'
              return (
                <li key={h.id}>
                  <button
                    type="button"
                    className={`day-row is-${tag}`}
                    onClick={() => canToggle && toggle(h)}
                    disabled={!canToggle}
                    aria-pressed={d}
                    aria-label={`${h.name} — ${tag === 'done' ? 'completed' : tag === 'remaining' ? 'not completed, tap to log' : tag === 'upcoming' ? 'scheduled' : 'not scheduled'}`}
                    style={{ '--day-row-c': habitColorHex(h) }}
                  >
                    <span className="day-row-dot" aria-hidden="true" />
                    <span className="day-row-main">
                      <span className="day-row-name">{h.name}</span>
                      <span className="day-row-meta">
                        <span className="prio-mini" data-p={p} aria-hidden="true">
                          {[1, 2, 3, 4, 5].map((i) => (
                            <i key={i} data-on={i <= p ? 'true' : undefined} />
                          ))}
                        </span>
                        {run > 1 && (
                          <span className="day-row-run tnum"><IconFlame size={12} /> {run}-day run</span>
                        )}
                        <span className="tiny muted">
                          {tag === 'done' ? 'Completed'
                            : tag === 'remaining' ? 'Remaining'
                              : tag === 'upcoming' ? 'Scheduled' : 'Not scheduled'}
                        </span>
                      </span>
                    </span>
                    <span className={`day-row-check${d ? ' is-done' : ''}`} aria-hidden="true">
                      {d ? <IconCheck size={15} /> : null}
                    </span>
                  </button>
                  {check?.note && (
                    <p className="day-row-note"><IconNote size={12} /> {check.note}</p>
                  )}
                </li>
              )
            })}
          </ul>
        )}

        {!future && hasNotes && (
          <p className="tiny muted" style={{ textAlign: 'center' }}>Notes are recorded against the day they were written.</p>
        )}
        {!future && (
          <p className="tiny muted" style={{ textAlign: 'center' }}>
            View in context · <a href={`#/calendar/${date.slice(0, 7)}`} style={{ color: 'inherit' }}>calendar {shortDate(date)}</a>
          </p>
        )}
      </div>
    </Sheet>
  )
}

/** Priority label helper kept out of the DOM hot path for a11y names. */
export function dayRowAria(h) {
  return `${h.name} · priority ${priorityMeta(habitPriority(h)).label}`
}
