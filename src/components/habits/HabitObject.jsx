import { Button, IconButton } from '../primitives/index.js'
import { IconCheck, IconMore, IconFlame } from '../../lib/icons.jsx'
import './HabitObject.css'

/**
 * HabitObject — the definitive reusable visual representation of one habit.
 *
 * PRESENTATION-FIRST. Callers own data derivation and reducers.
 *
 * Anatomy: ring + body (name + meta: schedule/reminder/streak/status) + actions.
 * The whole card is click-to-detail for mouse users. For keyboard/AT users the
 * name is a real focusable link; we do NOT put role=button on the article
 * (that would create invalid nested interactives — buttons inside a button).
 */
export default function HabitObject({
  habit,
  done = false,
  streak = 0,
  schedule = '',
  reminder = null,
  status = null,
  variant = 'default',
  scheduledToday = true,
  paused = false,
  archived = false,
  atRisk = false,
  onToggleComplete,
  onDetail,
  onMore,
  interactive = true,
  href = null,
  className = '',
  ...rest
}) {
  const size = variantSize(variant)
  const stroke = strokeFor(variant)
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const dashoffset = circumference * (1 - (done ? 1 : 0))
  const catColorVar = `--cat-${habit.category || 'mind'}`

  const stateClass = [
    done && 'is-done',
    paused && 'is-paused',
    archived && 'is-archived',
  ].filter(Boolean).join(' ')

  const completeLabel = done ? `Mark ${habit.name} as not complete` : `Mark ${habit.name} as complete`
  const statusText = status?.label || (archived ? 'Archived' : paused ? 'Paused' : '')
  const tone = status?.tone || (atRisk ? 'warning' : undefined)

  // Mouse click on card opens detail — but buttons/links own their own clicks.
  const onCardClick = (e) => {
    if (!interactive || !onDetail) return
    if (e.target.closest('button, a')) return
    onDetail(habit)
  }

  const detailHref = href || (onDetail && habit.id ? `#/habits/${habit.id}` : null)

  return (
    <article
      className={`habit-obj habit-obj--${variant} ${stateClass} ${className}`.trim()}
      style={{ '--cat-color': `var(${catColorVar})`, '--cat-strong': `var(${catColorVar}-strong, var(${catColorVar}))` }}
      data-done={done ? 'true' : 'false'}
      data-paused={paused ? 'true' : undefined}
      data-archived={archived ? 'true' : undefined}
      onClick={onCardClick}
      aria-label={`${habit.name}${done ? ', completed today' : ''}${streak ? `, ${streak} day streak` : ''}`}
      {...rest}
    >
      <span className="habit-obj__ring" aria-hidden="true">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} focusable="false">
          <circle className="habit-obj__ring-track" cx={size/2} cy={size/2} r={radius} />
          <circle
            className="habit-obj__ring-fill"
            cx={size/2} cy={size/2} r={radius}
            strokeDasharray={circumference}
            strokeDashoffset={dashoffset}
            transform={`rotate(-90 ${size/2} ${size/2})`}
          />
        </svg>
        <span className="habit-obj__ring-dot" />
        <span className="habit-obj__ring-mark">
          <IconCheck size={variant === 'featured' ? 22 : 16} aria-hidden="true" />
        </span>
      </span>

      {/* Body */}
      <div className="habit-obj__body">
        {detailHref ? (
          <a
            className="habit-obj__name habit-obj__name-link"
            href={detailHref}
            onClick={(e) => { if (onDetail) { e.preventDefault(); e.stopPropagation(); onDetail(habit) } }}
            title={habit.name}
          >{habit.name}</a>
        ) : (
          <h3 className="habit-obj__name">{habit.name}</h3>
        )}
        <div className="habit-obj__meta">
          {schedule && <span className="habit-obj__schedule">{schedule}</span>}
          {reminder && (
            <span className="habit-obj__reminder" aria-label={`Reminder at ${formatTime(reminder)}`}>
              {formatTime(reminder)}
            </span>
          )}
          {streak > 0 && (
            <span className="habit-obj__streak" data-at-risk={atRisk ? 'true' : undefined}>
              <IconFlame size={variant === 'compact' ? 11 : 12} aria-hidden="true" />
              <span className="tnum">{streak}</span>d
            </span>
          )}
          {statusText && (
            <span className="habit-obj__status" data-tone={tone}>{statusText}</span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="habit-obj__actions">
        {scheduledToday && !archived && !paused && onToggleComplete && (
          <Button
            variant={done ? 'quiet' : 'secondary'}
            size="sm"
            className={`habit-obj__complete${done ? ' is-done' : ''}`}
            onClick={(e) => { e.stopPropagation(); onToggleComplete(habit) }}
            aria-pressed={done}
            aria-label={completeLabel}
            icon={<IconCheck size={15} aria-hidden="true" />}
          >
            <span className="habit-obj__complete-label">{done ? 'Completed' : 'Complete'}</span>
          </Button>
        )}
        {onMore && (
          <IconButton
            size={variant === 'compact' ? 'sm' : 'md'}
            className="habit-obj__more"
            onClick={(e) => { e.stopPropagation(); onMore(habit) }}
            label={`More actions for ${habit.name}`}
            aria-haspopup="dialog"
            icon={<IconMore size={18} aria-hidden="true" />}
          />
        )}
      </div>
    </article>
  )
}

function variantSize(v) {
  if (v === 'compact') return 28
  if (v === 'featured') return 56
  return 40
}
function strokeFor(v) {
  if (v === 'compact') return 2.5
  if (v === 'featured') return 3.5
  return 3
}
function formatTime(hhmm) {
  if (!hhmm) return ''
  const [h, m] = String(hhmm).split(':').map(Number)
  if (Number.isNaN(h)) return hhmm
  const isPm = h >= 12
  const h12 = ((h + 11) % 12) + 1
  return `${h12}${m ? ':' + String(m).padStart(2,'0') : ''} ${isPm ? 'PM' : 'AM'}`
}
