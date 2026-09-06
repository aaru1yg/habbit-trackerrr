/* ============================================================
   DEADLINE LANES — the coming days as one honest strip.

   Every open project/assignment with a deadline gets a lane from
   its start (clamped to the window) to its deadline; the inner
   fill is real completed progress, the bar tone is the life state.
   Items without deadlines, or deadlined outside the window, are
   simply absent — the strip never draws guessed work.

   Motion: lanes grow from their start edge on first view, today's
   line fades in last. Reduced motion: final layout, no growth.
   ============================================================ */
import AnimateOnView from '../motion/AnimateOnView.jsx'
import { addDaysStr, dayNum, weekdayInitial } from '../../lib/dates.js'

export default function DeadlineLanes({ model }) {
  const { lanes, from, days, today } = model
  const idx = (date) => {
    let i = 0
    let cur = from
    while (cur < date && i < days - 1) { cur = addDaysStr(cur, 1); i++ }
    return cur === date ? i : -1
  }
  const dayIdx = Array.from({ length: days }, (_, i) => addDaysStr(from, i))
  const todayI = idx(today)

  if (!lanes.length) {
    return (
      <p className="empty-note">
        Nothing with a deadline lands in this window. Add dated work and it appears here as a lane.
      </p>
    )
  }

  return (
    <AnimateOnView effect="lanes-in" className="lanes" style={{ '--lane-days': days }}>
      <div className="lanes-head" aria-hidden="true">
        <span className="lanes-corner" />
        <span className="lanes-days">
          {dayIdx.map((d) => (
            <span key={d} className={d === today ? 'is-today' : ''}>
              <em>{weekdayInitial(d)}</em>
              {dayNum(d)}
            </span>
          ))}
        </span>
      </div>
      {lanes.map((lane, i) => {
        const s = Math.max(0, idx(lane.start))
        const e = idx(lane.end)
        const left = (s / days) * 100
        const width = ((e - s + 1) / days) * 100
        return (
          <a
            key={lane.id}
            className="lane-row"
            href={lane.href}
            style={{ '--i': i }}
            aria-label={`${lane.name}: ${lane.start} to ${lane.end}${lane.clipped ? ' (continues beyond this window)' : ''}, ${lane.progress} percent done`}
          >
            <span className="lane-name">{lane.name}</span>
            <span className="lane-track">
              <span
                className="lane-bar"
                data-tone={lane.tone}
                data-passed={lane.passed ? 'true' : 'false'}
                style={{ left: `${left}%`, width: `${width}%` }}
              >
                <i className="lane-fill" style={{ '--p': lane.progress / 100 }} />
              </span>
            </span>
          </a>
        )
      })}
      {todayI >= 0 && (
        <span
          className="lanes-today"
          style={{ left: `calc(var(--lanes-name, 108px) + ((100% - var(--lanes-name, 108px)) * ${(todayI + 0.5) / days}))` }}
          aria-hidden="true"
        />
      )}
    </AnimateOnView>
  )
}
