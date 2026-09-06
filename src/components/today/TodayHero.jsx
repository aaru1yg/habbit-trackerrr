import { useEffect, useRef, useState } from 'react'
import ProgressCore from '../ui/ProgressCore.jsx'
import AnimatedNumber from '../ui/AnimatedNumber.jsx'
import SceneLayer from '../three/SceneLayer.jsx'
import Parallax from '../motion/Parallax.jsx'
import Burst from '../motion/Burst.jsx'
import AnimateOnView from '../motion/AnimateOnView.jsx'
import { useScrollProgress } from '../../lib/motion.js'
import { useStore } from '../../store.jsx'
import { IconAlert, IconFlame } from '../../lib/icons.jsx'

/* ============================================================
   TODAY HERO — the emotional centre of Habit OS (spec §7).

   One composition, three depths:
     far    the WebGL energy field (SceneLayer; absent when the
            device or the user prefers stillness)
     mid    the Progress Core — ticks, arc, orb, halo
     near   the words: what is done, what remains, what is at risk

   The hero answers the scroll: as the page moves it settles back
   and compresses a few percent while the list below comes
   forward. Reduced motion pins every layer at rest.

   A completion pulses the core once and sheds a small particle
   response — never confetti per checkbox; the full celebration
   stays reserved for milestones.
   ============================================================ */
export default function TodayHero({ stats, top, atRisk, nearMilestone, copy, week }) {
  const { state } = useStore()
  const heroRef = useRef(null)
  const scroll = useScrollProgress(heroRef)
  const [pulse, setPulse] = useState(0)
  const prevDone = useRef(stats.done)

  /* one pulse + one small burst per newly completed habit */
  useEffect(() => {
    if (stats.done > prevDone.current) setPulse((p) => p + 1)
    prevDone.current = stats.done
  }, [stats.done])

  useEffect(() => {
    const el = heroRef.current
    if (!el) return undefined
    return scroll.subscribe((p) => {
      // only the first 60% of the hero's travel should compress it
      el.style.setProperty('--px', Math.min(1, p * 1.6).toFixed(3))
    })
  }, [scroll])

  const left = Math.max(0, stats.total - stats.done)

  return (
    <section
      ref={heroRef}
      className={`card pad-lg today-hero today-hero-v3 scene-enter sp-depth${pulse ? ' core-hit' : ''}`}
      aria-label="Today at a glance"
    >
      <div className="today-hero-inner hero-compress">
        <div className="today-ring today-core">
          {/* far depth: the energy field hugs the core, travels slower */}
          <Parallax travel={2} className="today-scene" aria-hidden="true">
            <SceneLayer pct={stats.pct} theme={state.profile.theme} />
          </Parallax>
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
