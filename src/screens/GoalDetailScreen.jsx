/* ============================================================
   GOAL DETAIL — Goals 2.0 (spec §9).

   A goal entered as a living system: the Progress Core states
   (foundation → building → momentum → near completion → reached),
   the honest pace story (expected vs actual, recomputed per day),
   the milestone timeline, and everything contributing to it —
   each with its own real progress.

   Every number here is derived. Where the data cannot support a
   velocity, a projection or a consistency score, the screen says
   so in plain language instead of showing a hopeful zero.
   ============================================================ */
import { useMemo } from 'react'
import { useStore } from '../store.jsx'
import { CardHead } from '../components/ui/SectionCard.jsx'
import ProgressCore from '../components/ui/ProgressCore.jsx'
import AnimatedNumber from '../components/ui/AnimatedNumber.jsx'
import EmptyState from '../components/ui/EmptyState.jsx'
import SceneLayer from '../components/three/SceneLayer.jsx'
import Parallax from '../components/motion/Parallax.jsx'
import Reveal from '../components/motion/Reveal.jsx'
import PaceChart from '../components/charts/PaceChart.jsx'
import { areaOf, goalProgress, goalHealth, goalPace, nextMilestone, goalTodayActions } from '../lib/goals.js'
import { goalAnalytics } from '../lib/goalAnalytics.js'
import { habitRate, habitStreak } from '../lib/stats.js'
import { projectProgress, assignmentProgress, projectStatus, assignmentStatus } from '../lib/work.js'
import { prettyDate, todayStr, dayOf, shortDate } from '../lib/dates.js'
import { Link } from '../lib/router.jsx'
import {
  IconChevronRight, IconCheck, IconFlame, IconGoals,
} from '../lib/icons.jsx'

const stageOf = (pct) => (pct >= 100 ? 'reached'
  : pct >= 75 ? 'near completion'
    : pct >= 50 ? 'momentum'
      : pct >= 25 ? 'building'
        : 'foundation')

export default function GoalDetailScreen({ id }) {
  const { state } = useStore()
  const today = todayStr()
  const goal = (state.goals || []).find((g) => g.id === id && !g.archived)

  const data = useMemo(() => (goal ? {
    prog: goalProgress(state, goal),
    health: goalHealth(state, goal),
    pace: goalPace(goal),
    next: nextMilestone(goal),
    analytics: goalAnalytics(state, goal, { days: 30 }),
    actions: goalTodayActions(state, goal, { date: today }),
  } : null), [state, goal, today])

  if (!goal || !data) {
    return (
      <div className="screen">
        <EmptyState art="art/empty-goals.webp" icon={<IconGoals size={40} />} title="Goal not found">
          It may have been archived or deleted on this device.
          <div style={{ marginTop: 12 }}>
            <Link to="goals" className="btn primary sm">All goals</Link>
          </div>
        </EmptyState>
      </div>
    )
  }

  const { prog, health, pace, next, analytics, actions } = data
  const area = areaOf(goal.area)
  const pending = actions.filter((a) => !a.done)
  const habits = (goal.linkedHabitIds || []).map((hid) => state.habits.find((h) => h.id === hid)).filter((h) => h && !h.archived)
  const projects = (goal.linkedProjectIds || []).map((pid) => state.projects.find((p) => p.id === pid)).filter((p) => p && !p.archived)
  const assignments = (goal.linkedAssignmentIds || []).map((aid) => state.assignments.find((a) => a.id === aid)).filter((a) => a && !a.archived)
  const ms = [...(goal.milestones || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  const msDone = ms.filter((m) => m.done).length

  return (
    <div className="screen" id="goal-detail-screen">
      <header className="screen-head">
        <div>
          <Link to="goals" className="back-link"><IconChevronRight size={14} style={{ transform: 'rotate(180deg)' }} /> All goals</Link>
          <h1 className="screen-title">{goal.title}</h1>
          <p className="screen-sub">
            {goal.why || `${area.label} goal`}
          </p>
        </div>
        <div className="wrap-gap" style={{ gap: 6, justifyContent: 'flex-end' }}>
          <span className="chip"><span className="dot" style={{ background: `var(${area.cssVar})` }} />{area.label}</span>
          <span className="status-pill" data-tone={health.tone}>{health.label}</span>
        </div>
      </header>

      <div className="stack">
        {/* ---------- the goal object ---------- */}
        <Reveal as="section" variant="depth" className="card pad-lg goal-hero">
          <Parallax travel={2} className="goal-scene" aria-hidden="true">
            <SceneLayer pct={prog.pct} theme={state.profile.theme} />
          </Parallax>

          <div className="goal-hero-inner">
            <div className="goal-core">
              <ProgressCore
                pct={prog.pct}
                size={188}
                stroke={11}
                caption={stageOf(prog.pct)}
                label={`${goal.title}: ${prog.pct} percent complete — ${stageOf(prog.pct)} stage`}
              />
            </div>

            <div className="goal-hero-copy">
              <p className="eyebrow">{prog.detail}</p>
              <p className="goal-hero-note" data-tone={health.tone}>{health.note}</p>

              <div className="goal-facts">
                <div className="goal-fact">
                  <strong>
                    {analytics.velocity
                      ? <><AnimatedNumber value={analytics.velocity.perWeek} format={(v) => `${Math.round(v * 10) / 10}`} /> pts/wk</>
                      : '—'}
                  </strong>
                  <span>velocity</span>
                  <em>{analytics.velocity ? `measured ${shortDate(analytics.velocity.fromDay)} → ${shortDate(analytics.velocity.toDay)}` : 'not enough history yet'}</em>
                </div>
                <div className="goal-fact">
                  <strong>
                    {analytics.projection.day ? prettyDate(analytics.projection.day)
                      : analytics.projection.reason === 'complete' ? 'Reached'
                        : '—'}
                  </strong>
                  <span>projected completion</span>
                  <em>
                    {analytics.projection.reason === 'projected' ? `at current velocity, ${analytics.projection.daysLeft} days out`
                      : analytics.projection.reason === 'complete' ? 'this goal is reached'
                        : analytics.projection.reason === 'stalled' ? 'progress is flat — no upward trend to project'
                          : 'needs at least two real progress points'}
                  </em>
                </div>
                <div className="goal-fact">
                  <strong>{analytics.consistency.pct == null ? '—' : <><AnimatedNumber value={analytics.consistency.pct} />%</>}</strong>
                  <span>consistency</span>
                  <em>{analytics.consistency.detail}</em>
                </div>
                <div className="goal-fact">
                  <strong>{health.daysLeft == null ? '—' : <><AnimatedNumber value={Math.abs(health.daysLeft)} />{health.daysLeft < 0 ? 'd over' : 'd'}</>}</strong>
                  <span>{goal.targetDate ? `target ${prettyDate(goal.targetDate)}` : 'no target date'}</span>
                  <em>{pace ? `pace line at ${pace.expected}% today` : 'set a start and target date to get a pace line'}</em>
                </div>
              </div>
            </div>
          </div>
        </Reveal>

        {/* ---------- expected vs actual ---------- */}
        <Reveal as="section" variant="up" delay={60} className="card pad">
          <CardHead title="Expected vs actual">
            <span className="pace-legend" aria-hidden="true">
              <i className="pace-legend-actual" /> actual
              <i className="pace-legend-expected" /> expected
            </span>
          </CardHead>
          <PaceChart actual={analytics.actual} expected={analytics.expected} ariaLabel={`Expected versus actual progress for ${goal.title} over the last 30 days`} />
          {!analytics.expected && (
            <p className="tiny muted" style={{ marginTop: 6 }}>
              No pace line: this goal has no start + target window to measure against.
            </p>
          )}
        </Reveal>

        {/* ---------- milestone timeline ---------- */}
        <Reveal as="section" variant="up" delay={80} className="card pad">
          <CardHead title="Milestones">
            <span className="tiny muted tnum">{ms.length ? `${msDone} of ${ms.length} reached` : 'none yet'}</span>
          </CardHead>
          {ms.length === 0 ? (
            <p className="tiny muted">
              No milestones yet. Add them from the goal list, or link habits and projects below — progress will derive from them.
            </p>
          ) : (
            <ol className="ms-timeline" aria-label="Milestone timeline">
              {ms.map((m, i) => {
                const late = m.done && m.doneAt && m.targetDate && dayOf(m.doneAt) > m.targetDate
                return (
                  <Reveal as="li" key={m.id} index={i} variant="left" className={`ms-node${m.done ? ' is-done' : ''}`}>
                    <span className="ms-node-dot" aria-hidden="true">{m.done ? <IconCheck size={12} /> : null}</span>
                    <span className="ms-node-body">
                      <span className="ms-node-name">{m.name}</span>
                      <span className="ms-node-meta">
                        {m.targetDate ? `target ${prettyDate(m.targetDate)}` : 'no target date'}
                        {m.done && m.doneAt ? ` · reached ${prettyDate(dayOf(m.doneAt))}` : ''}
                        {late ? ' · reached late' : ''}
                        {m.done && m.targetDate && !late ? ' · on time' : ''}
                      </span>
                    </span>
                    {m.done && (
                      <span className="ms-node-tag" data-tone={late ? 'warn' : 'good'}>{late ? 'late' : 'on time'}</span>
                    )}
                  </Reveal>
                )
              })}
            </ol>
          )}
          {next && (
            <p className="pace-note" data-tone="neutral" style={{ marginTop: 10 }}>
              <IconChevronRight size={14} /> Next up: {next.name}{next.targetDate ? ` by ${prettyDate(next.targetDate)}` : ''}.
            </p>
          )}
        </Reveal>

        {/* ---------- what feeds this goal ---------- */}
        <Reveal as="section" variant="up" delay={60} className="card pad">
          <CardHead title="What feeds this goal">
            <span className="tiny muted tnum">{habits.length + projects.length + assignments.length} linked</span>
          </CardHead>
          {habits.length + projects.length + assignments.length === 0 ? (
            <p className="tiny muted">
              Nothing linked yet — this goal reports 0% until a milestone, habit, project or assignment feeds it.
            </p>
          ) : (
            <div className="stack" style={{ gap: 8 }}>
              {habits.map((h) => {
                const rate = habitRate(state, h, todayStr().slice(0, 8) + '01', today)
                const streak = habitStreak(state, h)
                return (
                  <Link key={h.id} to={`habits/${h.id}`} className="feed-row">
                    <span className="feed-kind">habit</span>
                    <span className="feed-name ellipsis">{h.name}</span>
                    {streak > 1 && <span className="tiny tnum" style={{ color: 'var(--warn)', display: 'inline-flex', gap: 3, alignItems: 'center' }}><IconFlame size={12} />{streak}d</span>}
                    <span className="tiny muted tnum">{rate.rate == null ? 'no data' : `${Math.round(rate.rate * 100)}% 30d`}</span>
                    <IconChevronRight size={14} />
                  </Link>
                )
              })}
              {projects.map((p) => {
                const st = projectStatus(p)
                return (
                  <Link key={p.id} to={`projects/${p.id}`} className="feed-row">
                    <span className="feed-kind">project</span>
                    <span className="feed-name ellipsis">{p.name}</span>
                    <span className="status-pill" data-tone={st.tone}>{st.label}</span>
                    <span className="tiny muted tnum">{projectProgress(p).pct}%</span>
                    <IconChevronRight size={14} />
                  </Link>
                )
              })}
              {assignments.map((a) => {
                const st = assignmentStatus(a)
                return (
                  <Link key={a.id} to={`assignments/${a.id}`} className="feed-row">
                    <span className="feed-kind">assignment</span>
                    <span className="feed-name ellipsis">{a.name}</span>
                    <span className="status-pill" data-tone={st.tone}>{st.label}</span>
                    <span className="tiny muted tnum">{assignmentProgress(a).pct}%</span>
                    <IconChevronRight size={14} />
                  </Link>
                )
              })}
            </div>
          )}
        </Reveal>

        {/* ---------- today's contribution ---------- */}
        {actions.length > 0 && (
          <Reveal as="section" variant="up" delay={40} className="card pad">
            <CardHead title="Today’s contribution">
              <span className="tiny muted tnum">{pending.length} open</span>
            </CardHead>
            {pending.length === 0 ? (
              <p className="pace-note" data-tone="good" style={{ margin: 0 }}>
                <IconCheck size={14} /> Everything this goal needs today is already done.
              </p>
            ) : (
              <ul className="feed-actions">
                {pending.map((a) => (
                  <li key={`${a.kind}-${a.id}`}>
                    <Link to={a.kind === 'habit' ? `habits/${a.id}` : a.kind === 'task' ? 'projects' : `assignments/${a.id}`} className="feed-row">
                      <span className="feed-kind">{a.kind}</span>
                      <span className="feed-name ellipsis">{a.name}</span>
                      <IconChevronRight size={14} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Reveal>
        )}

        {goal.notes && (
          <Reveal as="section" variant="up" className="card pad">
            <CardHead title="Notes" />
            <p style={{ color: 'var(--text-2)', fontSize: 'var(--fs-sm)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{goal.notes}</p>
          </Reveal>
        )}
      </div>
    </div>
  )
}
