import { useEffect, useRef, useState } from 'react'
import ProgressCore from '../ui/ProgressCore.jsx'
import AnimatedNumber from '../ui/AnimatedNumber.jsx'
import Burst from '../motion/Burst.jsx'
import AnimateOnView from '../motion/AnimateOnView.jsx'
import { IconAlert, IconFlame } from '../../lib/icons.jsx'

/* ============================================================
   TODAY HERO — the emotional centre of Habit OS.

   2D by design: a pure-CSS energy field (no WebGL anywhere), the
   Progress Core, and the words — what is done, what remains, what
   is at risk. A completion pulses the core once and sheds a small
   particle response — never confetti per checkbox; the full
   celebration stays reserved for milestones.
   ============================================================ */
export default function TodayHero({ stats, top, atRisk, nearMilestone, copy, week, prio }) {
  const [pulse, setPulse] = useState(0)
  const prevDone = useRef(stats.done)

  /* one pulse + one small burst per newly completed habit */
  useEffect(() => {
    if (stats.done > prevDone.current) setPulse((p) => p + 1)
    prevDone.current = stats.done
  }, [stats.done])

  const left = Math.max(0, stats.total - stats.done)

  return (
    <section
      className="card pad-lg today-hero today-hero-v3 scene-enter"
      aria-label="Today at a glance"
    >
      <div className="today-hero-inner hero-compress">
        <div className="today-ring today-core">
          {/* pure-CSS energy field — same calm depth, zero WebGL */}
          <span className="today-scene-2d" aria-hidden="true" />
          {pulse > 0 && <span key={pulse} className="core-pulse go" aria-hidden="true" />}
          <Burst fire={pulse} count={10} spread={64} />
          <ProgressCore
            pct={stats.total ? stats.pct : null}
            size={172}
            stroke={11}
            caption="today"
            label={stats.total ? `${stats.pct} percent complete today` : 'No habits yet'}
          />
        </div>

        <div className="today-hero-copy">
          <p className="eyebrow today-kicker">Today’s focus</p>
          <div className="today-summary">
            <strong>
              <AnimatedNumber value={stats.done} /> of <AnimatedNumber value={stats.total} /> complete
            </strong>
            <span>{stats.total === 1 ? 'habit' : 'habits'} scheduled</span>
          </div>
          <p>{copy}</p>

          {prio && prio.left > 0 && (
            <p className="pace-note" data-tone="warn">
              <IconAlert size={14} />
              {prio.left} high-priority habit{prio.left === 1 ? '' : 's'} still open today.
            </p>
          )}

          {atRisk && (
            <p className="pace-note" data-tone="warn">
              <IconAlert size={14} />
              Your {atRisk.streak}-day streak on {atRisk.habit.name} is at risk tonight.
            </p>
          )}
          {!atRisk && nearMilestone && (
            <p className="pace-note" data-tone="good">
              <IconFlame size={14} />
              {nearMilestone.away === 1
                ? `One more completion gives ${nearMilestone.habit.name} a ${nearMilestone.target}-day streak.`
                : `${nearMilestone.away} completions away from a ${nearMilestone.target}-day streak on ${nearMilestone.habit.name}.`}
            </p>
          )}

          <div className="today-stats" aria-label="Today at a glance">
            <div className="today-stat">
              <strong><AnimatedNumber value={stats.done} /></strong>
              <span>completed</span>
            </div>
            <div className="today-stat">
              <strong><AnimatedNumber value={left} /></strong>
              <span>remaining</span>
            </div>
            <div className="today-stat">
              <strong><AnimatedNumber value={top.streak || 0} /></strong>
              <span>day streak</span>
            </div>
          </div>
        </div>

        {week && (
          <div className="today-week" aria-label="Completion over the last 7 days">
            <span className="today-week-label">last 7 days</span>
            {week.hasAny ? (
              <>
                <AnimateOnView effect="bar-rise" className="today-week-bars">
                  {week.rows.map((d, i) => (
                    <span
                      key={d.day}
                      className="today-week-bar"
                      style={{ '--i': i }}
                      title={`${d.label} · ${d.pct}%`}
                    >
                      <i style={{ height: `${Math.max(8, d.pct)}%` }} data-on={d.total > 0 && d.done > 0 ? 'true' : undefined} />
                    </span>
                  ))}
                </AnimateOnView>
                <span className="today-week-avg tnum">{week.avg}% avg</span>
              </>
            ) : (
              <span className="today-week-empty">no check-ins yet</span>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
