/* ============================================================
   PROJECT TRACK — the project as an object moving through
   time (spec §10).

   One horizontal track from start to deadline. On it:
     · the progress fill (real task/log progress)
     · milestone nodes at their real target dates
     · today, marked, so "where should we be?" is one glance
     · the deadline flag

   Nodes are buttons: tap or focus one and it explains itself
   below the track. Nothing is positioned by guesswork — a
   milestone without a date joins the "unscheduled" row instead
   of being smeared across the track.
   ============================================================ */
import { useMemo, useState } from 'react'
import { todayStr, isValidDayStr, dayOf, shortDate, prettyDate, daysBetween } from '../../lib/dates.js'
import { projectStatus, projectPhase, phaseTone } from '../../lib/work.js'
import { IconCheck, IconFlag } from '../../lib/icons.jsx'

export default function ProjectTrack({ project, now = new Date() }) {
  const [selected, setSelected] = useState(null)
  const today = todayStr()

  const model = useMemo(() => {
    const st = projectStatus(project, now)
    const phase = projectPhase(project, now)
    const ms = (project.milestones || []).map((m) => ({
      ...m,
      tasks: m.tasks || [],
    }))
    const dated = ms.filter((m) => isValidDayStr(m.targetDate || m.due))
    const undated = ms.filter((m) => !isValidDayStr(m.targetDate || m.due))

    const start = isValidDayStr(project.startDate) ? project.startDate
      : isValidDayStr(project.createdAtDay) ? project.createdAtDay
        : dated.map((m) => m.targetDate || m.due).sort()[0] || today
    const candidates = [
      project.deadline ? dayOf(project.deadline) : null,
      ...dated.map((m) => m.targetDate || m.due),
      today,
    ].filter(Boolean)
    const end = candidates.sort().pop()

    const span = Math.max(1, daysBetween(start, end))
    const x = (day) => Math.max(0, Math.min(100, (daysBetween(start, day) / span) * 100))

    return {
      st, phase, start, end, span, x,
      todayX: x(today),
      nodes: dated.map((m) => ({
        id: m.id,
        name: m.name,
        day: m.targetDate || m.due,
        done: Boolean(m.done) || (m.tasks.length > 0 && m.tasks.every((t) => t.done)),
        tasks: m.tasks.length,
        doneTasks: m.tasks.filter((t) => t.done).length,
      })),
      undated: undated.map((m) => m.name),
      hasDeadline: Boolean(project.deadline),
    }
  }, [project, now, today])

  const sel = model.nodes.find((n) => n.id === selected) || null
  const tone = phaseTone(model.phase)

  return (
    <div className="ptl" data-phase={model.phase} aria-label={`Project timeline from ${prettyDate(model.start)} to ${prettyDate(model.end)}`}>
      <div className="ptl-track">
        <i className="ptl-fill" style={{ width: `${model.st.pct}%` }} aria-hidden="true" />
        <span className="ptl-today" style={{ left: `${model.todayX}%` }} aria-hidden="true">
          <em>today</em>
        </span>
        {model.nodes.map((n) => (
          <button
            key={n.id}
            type="button"
            className={`ptl-node${n.done ? ' is-done' : ''}${selected === n.id ? ' is-sel' : ''}`}
            style={{ left: `${model.x(n.day)}%` }}
            aria-label={`Milestone ${n.name}, ${prettyDate(n.day)}${n.done ? ', reached' : ''}`}
            aria-pressed={selected === n.id}
            onClick={() => setSelected(selected === n.id ? null : n.id)}
          >
            {n.done ? <IconCheck size={11} /> : null}
          </button>
        ))}
        {model.hasDeadline && (
          <span className="ptl-flag" style={{ left: '100%' }} aria-hidden="true">
            <IconFlag size={12} />
          </span>
        )}
      </div>

      <div className="ptl-scale" aria-hidden="true">
        <span>{shortDate(model.start)}</span>
        <span className="ptl-phase" data-tone={tone}>{model.phase.replace('-', ' ')}</span>
        <span>{model.hasDeadline ? shortDate(dayOf(project.deadline)) : 'no deadline'}</span>
      </div>

      {sel && (
        <p className="ptl-detail" role="status">
          <strong>{sel.name}</strong> · {prettyDate(sel.day)} ·{' '}
          {sel.done
            ? 'reached'
            : sel.tasks
              ? `${sel.doneTasks} of ${sel.tasks} tasks done`
              : daysBetween(today, sel.day) >= 0
                ? `in ${daysBetween(today, sel.day)} days`
                : `${Math.abs(daysBetween(today, sel.day))} days past its date`}
        </p>
      )}
      {!sel && model.undated.length > 0 && (
        <p className="ptl-detail" role="status">
          {model.undated.length} milestone{model.undated.length === 1 ? '' : 's'} without a target date: {model.undated.join(', ')}
        </p>
      )}
      {!sel && model.nodes.length > 0 && (
        <p className="ptl-detail ptl-hint" role="status">
          {model.nodes.length} milestone{model.nodes.length === 1 ? '' : 's'} on the track — select one for its date and state.
        </p>
      )}
      {model.nodes.length === 0 && model.undated.length === 0 && (
        <p className="ptl-detail" role="status">No milestones yet — the track shows the window and today only.</p>
      )}
    </div>
  )
}
