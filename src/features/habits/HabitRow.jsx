/* ============================================================
   HABIT ROW — the single way a habit is ever rendered in a list.

   Today and Habits both use this, so a streak badge or a counter
   can never look different depending on where you are.
   ============================================================ */
import { Link } from '../../app/router.jsx'
import { useActions } from '../../core/store.jsx'
import { progressOn, streak } from '../../core/compute.js'
import { Check, Bar, Stepper, cx } from '../../ui/index.jsx'
import { IconFlame, IconChevron } from '../../ui/icons.jsx'

/* `compact` is used by Today's "Next up" shortlist: the same row,
   minus the stepper, so a habit appearing in both places reads as
   a summary there and the full control here. */
export default function HabitRow({ habit, checkins, day, showStreak = true, linkable = true, compact = false }) {
  const actions = useActions()
  const p = progressOn(habit, checkins, day)
  const st = showStreak ? streak(habit, checkins) : null
  const counted = habit.target.type !== 'done'

  const setValue = (v) => actions.setCheckin(habit.id, day, v)

  return (
    <div className="erow" data-done={p.done} data-counted={counted && !compact}>
      <span className="erow__icon" aria-hidden="true">{habit.icon}</span>

      <div className="erow__main">
        {linkable ? (
          <Link to={`habit/${habit.id}`} className="erow__title">{habit.name}</Link>
        ) : (
          <span className="erow__title">{habit.name}</span>
        )}

        <div className="erow__meta">
          {habit.cue && <span className="clamp1">{habit.cue}</span>}
          {counted && (
            <span className="num">
              {p.value} / {p.goal} {habit.target.unit}
            </span>
          )}
          {st && st.current > 0 && (
            <span className="erow__streak">
              <IconFlame size={12} />
              {st.current}
              <span className="faint" style={{ fontWeight: 500 }}>{st.unit === 'week' ? 'w' : 'd'}</span>
            </span>
          )}
        </div>

        {counted && p.value > 0 && !p.done && (
          <Bar className="erow__bar" value={p.ratio * 100} thin />
        )}
      </div>

      {/* Its own cell, not part of erow__side: on a phone the stepper
          drops to a second line so the habit name keeps full width. */}
      {counted && !compact && (
        <div className="erow__step">
          <Stepper
            value={p.value}
            onChange={setValue}
            min={0}
            max={p.goal * 4}
            step={habit.target.type === 'minutes' ? 5 : 1}
          />
        </div>
      )}

      <div className="erow__side">
        <Check
          checked={p.done}
          partial={p.ratio}
          label={`Mark ${habit.name} ${counted && !compact ? 'complete' : 'done'}`}
          onChange={(on) => setValue(on ? p.goal : 0)}
        />
        {linkable && !compact && (
          <Link
            to={`habit/${habit.id}`}
            className={cx('btn', 'btn--ghost', 'btn--icon', 'btn--sm')}
            aria-label={`Open ${habit.name}`}
            style={{ display: 'grid', placeItems: 'center' }}
          >
            <IconChevron size={15} />
          </Link>
        )}
      </div>
    </div>
  )
}
