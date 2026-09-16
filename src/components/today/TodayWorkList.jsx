import {
  IconCheck, IconArrowUpRight, IconCalendar,
  IconProjects, IconAssignment, IconTarget, IconAlert,
} from '../../lib/icons.jsx'
import { Link, navigate } from '../../lib/router.jsx'
import { isDone, habitStreak } from '../../lib/stats.js'
import { assignmentProgress, projectProgress } from '../../lib/work.js'
import { useStore } from '../../store.jsx'
import { useCallback } from 'react'
import { dueLabel } from '../../lib/dates.js'
import { scheduleLabel } from '../../lib/schedule.js'
import HabitObject from '../habits/HabitObject.jsx'

/**
 * TodayWorkList — editorial execution list.
 *
 * Anatomy for every Today entity:
 *   LEAD (completion / identity mark)
 *   BODY (type eyebrow · title · 1–2 supporting signals)
 *   TRAIL (compact progress + navigation)
 *
 * Step 4G-2A: Habits render the CANONICAL HabitObject (compact variant) so
 * Today shares one visual language with the Habits workspace. Work items
 * (assignments/projects/tasks/milestones) keep the slim linear rail.
 * HabitObject is NOT forked — we scope a `.today-hobj` modifier so it sits
 * flat in the Today list (no card chrome, compact 44px row rhythm).
 */
export default function TodayWorkList({ items = [], today }) {
  const { state, dispatch } = useStore()

  const toggleHabit = useCallback((h) => {
    dispatch({ type: 'TOGGLE_CHECKIN', habitId: h.id, date: today })
  }, [dispatch, today])

  if (items.length === 0) {
    return <p className="today-list__empty">Nothing else on the list.</p>
  }

  return (
    <ul className="today-list" role="list" aria-label="Today's work">
      {items.map((row) => (
        <WorkRow
          key={row.key}
          row={row}
          today={today}
          state={state}
          onToggleHabit={toggleHabit}
          dispatch={dispatch}
        />
      ))}
    </ul>
  )
}

function WorkRow({ row, today, state, onToggleHabit, dispatch }) {
  const {
    kind, item, name, href, reason,
    progress: pctOverride, deadline, estimateMin, meta: metaExtra, done: doneOverride,
  } = row

  const done = doneOverride != null ? doneOverride : isRowDone(kind, item, state, today)
  const progress = pctOverride != null ? pctOverride : rowProgress(kind, item, state, today)
  const isHabit = kind === 'habit'
  const risk = detectRisk(kind, item, deadline, reason)

  // Habits render the canonical HabitObject (compact) — share one visual language
  // with the Habits workspace. No eyebrow/trail/go needed; HabitObject owns its
  // own ring, name, meta and complete/nav affordances.
  if (isHabit) {
    const streak = habitStreak(state, item)
    return (
      <li className="today-row today-row--habit-obj">
        <HabitObject
          habit={item}
          done={done}
          streak={streak}
          schedule={scheduleLabel(item)}
          reminder={item.reminder || null}
          variant="compact"
          scheduledToday={true}
          paused={Boolean(item.pause)}
          archived={Boolean(item.archived)}
          onToggleComplete={onToggleHabit}
          onDetail={(h) => navigate(`habits/${h.id}`)}
          href={`#/habits/${item.id}`}
          className="today-hobj"
          interactive
        />
      </li>
    )
  }

  // Work item signals
  const signals = []
  let dueLabelText = null
  if (deadline) {
    dueLabelText = dueLabel(deadline)
    signals.push({ icon: <IconCalendar size={12} />, text: dueLabelText, tone: risk.tone })
  }
  if (risk.kind === 'overdue' && dueLabelText !== 'Overdue' && signals.length < 2) {
    signals.push({ icon: <IconAlert size={12} />, text: 'Overdue', tone: 'danger' })
  } else if (estimateMin != null && estimateMin > 0 && signals.length < 2) {
    // estimateMin reserved for habits; skip here unless genuinely useful
  } else if (risk.kind === 'atrisk' && signals.length < 2) {
    signals.push({ icon: <IconAlert size={12} />, text: 'At risk', tone: 'warning' })
  }
  if (metaExtra && signals.length < 2) {
    for (const m of metaExtra) {
      if (!m) continue
      signals.push({ icon: m.icon, text: m.text })
      if (signals.length >= 2) break
    }
  }

  const rowClasses = [
    'today-row',
    'today-row--work',
    done ? 'today-row--done' : '',
    risk.tone && !done ? `today-row--${risk.tone}` : '',
  ].filter(Boolean).join(' ')

  return (
    <li className={rowClasses}>
      <span className="today-row__lead">
        <WorkCheckButton
          kind={kind}
          name={name}
          done={done}
          onClick={() => completeOther(kind, item, dispatch, state, done)}
        />
      </span>

      <div className="today-row__body">
        <span className="today-row__type">
          <KindGlyph kind={kind} />
          <span className="today-row__type-label">{KIND_LABEL[kind] || kind}</span>
        </span>
        <span className="today-row__title" title={name}>{name}</span>
        {signals.length > 0 && (
          <span className="today-row__meta">
            {signals.map((s, i) => (
              <span
                key={i}
                className={'today-row__signal' + (s.tone ? ` today-row__signal--${s.tone}` : '')}
              >
                {s.icon}{s.text}
              </span>
            ))}
          </span>
        )}
      </div>

      <span className="today-row__trail">
        {progress != null ? (
          <span className="today-row__progress-cluster" aria-label={`${Math.round(progress)} percent complete`}>
            <span className="today-row__rail">
              <span
                className="today-row__rail-fill"
                style={{
                  width: `${Math.max(0, Math.min(100, progress))}%`,
                  background: done
                    ? 'var(--color-success)'
                    : risk.tone === 'danger' ? 'var(--color-danger)'
                    : risk.tone === 'warning' ? 'var(--color-warning)'
                    : 'var(--accent)',
                }}
              />
            </span>
            <span className="today-row__pct">{Math.round(progress)}%</span>
          </span>
        ) : null}
        <Link
          to={href}
          className="today-row__go"
          aria-label={`Open ${name}`}
        >
          <IconArrowUpRight size={14} />
        </Link>
      </span>
    </li>
  )
}

/* --- Work lead check --- */

function WorkCheckButton({ kind, name, done, onClick }) {
  const completable = COMPLETABLE.has(kind)
  return (
    <button
      type="button"
      className={'today-row__lead-mark' + (done ? ' is-done' : '') + (completable ? ' is-interactive' : '')}
      aria-pressed={completable ? done : undefined}
      aria-label={completable
        ? (done ? `Mark ${name} as not complete` : `Mark ${name} as complete`)
        : `${name}`}
      disabled={!completable}
      onClick={completable ? onClick : undefined}
      tabIndex={completable ? 0 : -1}
    >
      {done ? <IconCheck size={13} /> : null}
    </button>
  )
}

function KindGlyph({ kind }) {
  switch (kind) {
    case 'assignment': return <IconAssignment size={11} aria-hidden="true" />
    case 'project':    return <IconProjects size={11} aria-hidden="true" />
    case 'project-task': return <IconCheck size={11} aria-hidden="true" />
    case 'goal-milestone': return <IconTarget size={11} aria-hidden="true" />
    default: return null
  }
}

function detectRisk(kind, item, deadline, reason) {
  const todayStart = new Date(new Date().toISOString().slice(0,10) + 'T00:00:00')
  if (kind === 'habit') return { kind: 'none', tone: null }
  if (deadline && new Date(deadline) < todayStart) return { kind: 'overdue', tone: 'danger' }
  if (reason === 'Overdue') return { kind: 'overdue', tone: 'danger' }
  if (item?.priority === 'high' || reason === 'due within a day') return { kind: 'atrisk', tone: 'warning' }
  if (deadline) {
    const hrs = (new Date(deadline) - Date.now()) / 36e5
    if (hrs < 24) return { kind: 'atrisk', tone: 'warning' }
  }
  return { kind: 'none', tone: null }
}

const KIND_LABEL = {
  assignment: 'Assignment',
  project: 'Project',
  'project-task': 'Task',
  'goal-milestone': 'Milestone',
}

const COMPLETABLE = new Set(['assignment', 'project-task', 'goal-milestone'])

function isRowDone(kind, item, state, today) {
  if (kind === 'habit') return isDone(state, item.id, today)
  if (kind === 'assignment') return Boolean(item.completedAt) || assignmentProgress(item).pct >= 100
  if (kind === 'project') return Boolean(item.completedAt) || projectProgress(item).pct >= 100
  if (kind === 'project-task') return Boolean(item.done)
  if (kind === 'goal-milestone') return Boolean(item.done)
  return false
}
function rowProgress(kind, item, state, today) {
  if (kind === 'habit') return isDone(state, item.id, today) ? 100 : null
  if (kind === 'assignment') return assignmentProgress(item).pct
  if (kind === 'project') return projectProgress(item).pct
  if (kind === 'project-task') return item.done ? 100 : null
  if (kind === 'goal-milestone') return item.done ? 100 : null
  return null
}
function completeOther(kind, item, dispatch, state, currentlyDone) {
  if (currentlyDone) return
  if (kind === 'assignment') {
    dispatch({ type: 'SET_ASSIGNMENT_PROGRESS', id: item.id, pct: 100 })
  } else if (kind === 'project') {
    dispatch({ type: 'UPDATE_PROJECT', id: item.id, patch: { manualPercent: 100, completedAt: item.completedAt || new Date().toISOString() } })
  } else if (kind === 'project-task') {
    dispatch({ type: 'TOGGLE_TASK', projectId: item.projectId, milestoneId: item.milestoneId, taskId: item.id })
  } else if (kind === 'goal-milestone') {
    dispatch({ type: 'TOGGLE_GOAL_MILESTONE', id: item.goalId, milestoneId: item.id })
  }
}
