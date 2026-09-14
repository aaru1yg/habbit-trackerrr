/* ============================================================
   GOALS OVERVIEW (Step 6B) — long arcs, not rings.

   The list is the dominant surface. Each goal is read as:
   area + health → title → why → trajectory strip (actual vs
   expected pace, today marker, milestone dots, projected finish)
   → snapshot pills → next milestone → actions.

   All numbers come from goals.js / goalAnalytics.js / adaptive.js.
   Nothing is fabricated. The GoalAtlas stays lazy + opt-in.
   ============================================================ */
import { Suspense, lazy, useMemo, useState } from 'react'
import { useStore } from '../store.jsx'
import { useToast } from '../components/ui/Toaster.jsx'
import SectionCard from '../components/ui/SectionCard.jsx'
import EmptyState from '../components/ui/EmptyState.jsx'
import { WorkEmpty } from '../components/work/WorkKit.jsx'
import GoalFormSheet from '../components/goals/GoalForm.jsx'
import {
  areaOf, goalProgress, goalHealth, goalPace, nextMilestone, openGoals,
} from '../lib/goals.js'
import { goalAnalytics } from '../lib/goalAnalytics.js'
import { goalForecast } from '../lib/adaptive.js'
import { todayStr, prettyDate, dayOf, isValidDayStr } from '../lib/dates.js'
import { Link } from '../lib/router.jsx'
import {
  IconGoals, IconPlus, IconPencil, IconTrash, IconCheck,
  IconChevronRight, IconTarget, IconArchive, IconLayers, IconTrendUp,
} from '../lib/icons.jsx'
import '../styles/goals.css'

const GoalAtlas = lazy(() => import('../components/goals/GoalAtlas.jsx'))

/* Canonical health vocabulary (one presentation layer).
   Tones: good / warn / bad / neutral / complete. */
const HEALTH_LABEL = {
  complete: { text: 'Completed', tone: 'good' },
  overdue:  { text: 'Overdue', tone: 'bad' },
  risk:     { text: 'At risk', tone: 'warn' },
  ahead:    { text: 'Ahead', tone: 'good' },
  onTrack:  { text: 'On track', tone: 'neutral' },
  safe:     { text: 'No date', tone: 'neutral' },
}
function goalHealthLabel(state, goal, { now = new Date() } = {}) {
  const h = goalHealth(state, goal, { now })
  if (goal.status === 'completed' || h.prog?.pct >= 100) return HEALTH_LABEL.complete
  if (h.daysLeft != null && h.daysLeft < 0) return HEALTH_LABEL.overdue
  if (!goal.targetDate) return HEALTH_LABEL.safe
  if (h.tone === 'warn') return HEALTH_LABEL.risk
  if (h.tone === 'good') return HEALTH_LABEL.ahead
  return HEALTH_LABEL.onTrack
}

export default function GoalsScreen() {
  const { state, dispatch } = useStore()
  const toast = useToast()
  const today = todayStr()
  const [filter, setFilter] = useState('open')
  const [view, setView] = useState('list')
  const [form, setForm] = useState({ open: false, editing: null })
  const [learnOpen, setLearnOpen] = useState(false)

  const goalsAll = useMemo(() => (state.goals || []).filter((g) => !g.archived), [state])
  const reachedList = useMemo(() => goalsAll.filter((g) => g.status === 'completed' || goalProgress(state, g).pct >= 100), [goalsAll, state])
  const openList = useMemo(() => openGoals(state), [state])

  const rows = useMemo(() => openList.map((g) => ({ goal: g, ...goalHealth(state, g, { now: new Date() }) })), [openList, state])
  const atRisk = rows.filter((r) => r.tone === 'bad' || r.tone === 'warn')

  const shown = useMemo(() => {
    if (filter === 'reached') return reachedList
    if (filter === 'all') return goalsAll
    if (filter === 'risk') return openList.filter((g) => ['warn', 'bad'].includes(goalHealth(state, g, { now: new Date() }).tone))
    return openList
  }, [filter, reachedList, goalsAll, openList, state])

  const ordered = useMemo(() => {
    const priority = filter === 'risk'
    return [...shown].sort((a, b) => {
      if (priority) {
        const ra = goalHealth(state, a).tone === 'bad' ? 0 : 1
        const rb = goalHealth(state, b).tone === 'bad' ? 0 : 1
        if (ra !== rb) return ra - rb
      }
      const aReached = a.status === 'completed' || goalProgress(state, a).pct >= 100
      const bReached = b.status === 'completed' || goalProgress(state, b).pct >= 100
      if (aReached !== bReached) return aReached ? 1 : -1
      const ad = isValidDayStr(a.targetDate) ? a.targetDate : '9999-99-99'
      const bd = isValidDayStr(b.targetDate) ? b.targetDate : '9999-99-99'
      return ad.localeCompare(bd) || a.title.localeCompare(b.title)
    })
  }, [shown, state, filter])

  const next = useMemo(() => {
    for (const g of openList) {
      const m = nextMilestone(g)
      if (m) return { goal: g, milestone: m }
    }
    return null
  }, [openList])

  const remove = (goal) => {
    dispatch({ type: 'DELETE_GOAL', id: goal.id })
    toast.show(`Deleted "${goal.title}"`, {
      duration: 6000,
      actionLabel: 'Undo',
      onAction: () => dispatch({ type: 'RESTORE_GOAL', goal }),
    })
  }
  const archive = (goal) => {
    dispatch({ type: 'UPDATE_GOAL', id: goal.id, patch: { archived: true, status: 'archived' } })
    toast.show(`Archived "${goal.title}"`, {
      duration: 6000,
      actionLabel: 'Undo',
      onAction: () => dispatch({ type: 'UPDATE_GOAL', id: goal.id, patch: { archived: false, status: 'active' } }),
    })
  }

  const tabs = [
    { id: 'open', label: 'Active', count: openList.length },
    { id: 'risk', label: 'Needs attention', count: atRisk.length },
    { id: 'reached', label: 'Completed', count: reachedList.length },
    { id: 'all', label: 'All', count: goalsAll.length },
  ]

  const snapshot = [
    { label: 'Active', value: openList.length, tone: openList.length ? undefined : undefined },
    { label: 'Attention', value: atRisk.length, tone: atRisk.length ? 'warn' : undefined },
    { label: 'Healthy', value: openList.length - atRisk.length, tone: openList.length - atRisk.length > 0 ? 'good' : undefined },
    { label: 'Completed', value: reachedList.length, tone: reachedList.length ? 'good' : undefined },
  ]

  return (
    <div className="screen" id="goals-screen">
      <header className="wo__head" style={{ alignItems: 'flex-start' }}>
        <div className="wo__head-main">
          <p className="wo__eyebrow">Goals</p>
          <h1 className="screen-title" style={{ fontSize: 'clamp(1.6rem, 2.6vw, 2.1rem)' }}>Goals</h1>
          <p className="screen-sub" style={{ maxWidth: 640 }}>
            The long-term outcomes you are moving toward. Each arc shows where you are against where you planned to be — and what comes next.
          </p>
        </div>
        <div className="wo__head-actions">
          <button className="btn primary" onClick={() => setForm({ open: true, editing: null })}>
            <IconPlus size={16} /> New goal
          </button>
        </div>
      </header>

      <div className="stack">
        <div className="dlv__snap" role="group" aria-label="Goal snapshot">
          {snapshot.map((c) => (
            <div key={c.label} className={`dlv__pill${c.tone ? ` is-${c.tone}` : ''}`} style={{ cursor: 'default' }}>
              <span className="dlv__pill-val tnum">{c.value}</span>
              <span className="dlv__pill-label">{c.label}</span>
            </div>
          ))}
          {next && isValidDayStr(next.milestone.targetDate) && (
            <div className="dlv__pill" style={{ cursor: 'default' }}>
              <span className="dlv__pill-val">{next.milestone.name}</span>
              <span className="dlv__pill-label">Next · {prettyDate(next.milestone.targetDate)}</span>
            </div>
          )}
        </div>

        <div className="wo__toolbar">
          <div className="seg" role="tablist" aria-label="Goal filters">
            {tabs.map((t) => (
              <button key={t.id} type="button" role="tab" aria-selected={filter === t.id}
                className={`seg-btn${filter === t.id ? ' active' : ''}`} onClick={() => setFilter(t.id)}>
                {t.label} <span className="count">{t.count}</span>
              </button>
            ))}
          </div>
          {goalsAll.length > 0 && (
            <div className="goals-view-switch" role="group" aria-label="Goals view">
              <button type="button" className={`seg-btn${view === 'list' ? ' active' : ''}`} aria-pressed={view === 'list'} onClick={() => setView('list')}>
                <IconTrendUp size={15} /> Trajectories
              </button>
              <button type="button" className={`seg-btn${view === 'atlas' ? ' active' : ''}`} aria-pressed={view === 'atlas'} onClick={() => setView('atlas')}>
                <IconLayers size={15} /> Atlas
              </button>
            </div>
          )}
        </div>

        {ordered.length === 0 ? (
          <SectionCard>
            {goalsAll.length === 0 ? (
              <>
                <EmptyState art="art/empty-goals.webp" icon={<IconTarget size={40} />} title="What are you moving toward?">
                  A goal is an outcome with a horizon. Add one, set a target date, mark the milestones along the way, then link the habits and work that move it.
                </EmptyState>
                <div className="goals-empty-actions">
                  <button className="btn primary" onClick={() => setForm({ open: true, editing: null })}>
                    <IconPlus size={16} /> Set your first goal
                  </button>
                  <button type="button" className="btn ghost" onClick={() => setLearnOpen((v) => !v)} aria-expanded={learnOpen}>
                    Learn how goals work
                  </button>
                </div>
                {learnOpen && (
                  <div className="goal-learn"><GoalHowItWorks /></div>
                )}
              </>
            ) : (
              <WorkEmpty icon={<IconGoals size={40} />} title="Nothing here">
                {filter === 'reached'
                  ? 'Completed goals land here once they are reached.'
                  : filter === 'risk'
                    ? 'No open goals need attention right now.'
                    : 'Add a goal to see it in this view.'}
              </WorkEmpty>
            )}
          </SectionCard>
        ) : view === 'atlas' ? (
          <Suspense fallback={<div className="card pad" style={{ minHeight: 220 }} role="status">Loading atlas…</div>}>
            <GoalAtlas goals={ordered} />
          </Suspense>
        ) : (
          <div className="goal-list" aria-label={filter === 'reached' ? 'Completed goals' : 'Active goals'}>
            {ordered.map((g) => (
              <GoalRow key={g.id} goal={g} today={today}
                onEdit={() => setForm({ open: true, editing: g })}
                onArchive={() => archive(g)}
                onDelete={() => remove(g)}
              />
            ))}
          </div>
        )}

        {goalsAll.length > 0 && (
          <details className="goals-how card pad">
            <summary className="goals-how-summary">How goals connect to habits and work</summary>
            <GoalHowItWorks />
          </details>
        )}
      </div>

      <GoalFormSheet
        open={form.open}
        onClose={() => setForm({ open: false, editing: null })}
        editing={form.editing}
      />
    </div>
  )
}

function GoalHowItWorks() {
  return (
    <div className="layer-chain">
      {[
        { label: 'Goal', note: 'the outcome and why it matters' },
        { label: 'Milestones', note: 'checkpoints along the arc' },
        { label: 'Projects · Assignments', note: 'work with a deadline' },
        { label: 'Habits', note: 'what you repeat, daily or weekly' },
      ].map((l, i) => (
        <div key={l.label} className="layer-step">
          <span className="layer-index tnum" aria-hidden="true">{i + 1}</span>
          <div>
            <p className="layer-label">{l.label}</p>
            <p className="layer-note">{l.note}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------
   GOAL ROW — trajectory-first list item.
   ------------------------------------------------------------ */
function GoalRow({ goal, today, onEdit, onArchive, onDelete }) {
  const { state, dispatch } = useStore()
  const now = new Date()
  const area = areaOf(goal.area)
  const health = goalHealthLabel(state, goal, { now })
  const prog = goalProgress(state, goal, { now })
  const pace = goalPace(goal, { now })
  const analytics = goalAnalytics(state, goal, { days: 30, now })
  const forecast = goalForecast(state, goal, { now })
  const ms = goal.milestones || []
  const msDone = ms.filter((m) => m.done).length
  const next = nextMilestone(goal)
  const isReached = health.tone === 'good' && health.text === 'Completed'
  const daysLeft = isValidDayStr(goal.targetDate)
    ? Math.round((new Date(`${goal.targetDate}T12:00`) - now) / 86400000)
    : null

  // Trajectory mini-chart geometry.
  const actual = analytics.actual || []
  const expected = analytics.expected || []
  const daysLeftHorizon = !isReached && forecast.projectedCompletion
    ? Math.max(0, Math.round((new Date(`${forecast.projectedCompletion}T12:00`) - now) / 86400000))
    : null
  const projectionDays = (daysLeftHorizon != null && forecast.reason === 'projected') ? Math.min(daysLeftHorizon, 21) : 0
  const windowEnd = pace?.end || goal.targetDate
  const windowStart = pace?.start || goal.startDate
  const hasWindow = windowStart && windowEnd && windowEnd >= windowStart
  const projPct = isReached ? 100 : prog.pct
  const expectedToday = pace?.expected ?? null
  const behind = (expectedToday != null) ? expectedToday - projPct : null

  // Snapshot pills (compact, real).
  const dueText = isReached
    ? (goal.completedAt ? prettyDate(dayOf(goal.completedAt)) : 'Reached')
    : daysLeft == null
      ? (goal.targetDate ? prettyDate(goal.targetDate) : 'No date')
      : daysLeft < 0 ? `${Math.abs(daysLeft)}d late`
      : daysLeft === 0 ? 'Due today'
      : `${daysLeft}d left`

  const momentum = (() => {
    if (isReached) return { text: 'Completed', tone: 'good' }
    if (forecast.reason === 'stalled') return { text: 'Stalled', tone: 'bad' }
    if (behind != null) {
      if (behind > 15) return { text: `Slowing · ${behind}pts behind`, tone: 'warn' }
      if (behind < -10) return { text: `Ahead · ${Math.abs(behind)}pts`, tone: 'good' }
    }
    if (analytics.velocity?.perWeek > 0) return { text: `${analytics.velocity.perWeek}pts/wk`, tone: 'neutral' }
    return { text: 'Getting started', tone: 'neutral' }
  })()

  return (
    <article className={`goal-row${isReached ? ' is-done' : ''}`} data-tone={health.tone} data-area={goal.area}
      aria-label={`Goal ${goal.title}`}
      style={{ borderLeftColor: `var(${area.cssVar})` }}>
      <div className="goal-row__head">
        <div className="goal-row__titleblock">
          <div className="goal-row__eyebrow">
            <span className="chip" style={{ color: `var(${area.cssVar})` }}>
              <span className="dot" style={{ background: `var(${area.cssVar})` }} />
              {area.label}
            </span>
            <span className="status-pill" data-tone={health.tone}>{health.text}</span>
          </div>
          <h2 className="goal-row__title">
            <Link to={`goals/${goal.id}`} className="goal-row__link">{goal.title}</Link>
          </h2>
          {goal.why && !isReached && <p className="goal-row__why">{goal.why}</p>}
        </div>
        <div className="goal-row__pct tnum" aria-hidden="true" style={{ color: isReached ? 'var(--good)' : `var(${area.cssVar})` }}>
          {projPct}%
        </div>
      </div>

      {/* Trajectory strip */}
      <TrajectoryStrip
        actual={actual}
        expected={expected}
        prog={projPct}
        expectedToday={expectedToday}
        milestones={ms}
        isReached={isReached}
        hasWindow={hasWindow}
        windowStart={windowStart}
        windowEnd={windowEnd}
        today={today}
        projectionDays={projectionDays}
        areaVar={area.cssVar}
        tone={health.tone}
        ariaLabel={`${goal.title} trajectory: ${projPct}% complete${expectedToday != null ? `, expected ${expectedToday}% by today` : ''}`}
      />

      {/* Snapshot pills */}
      <div className="goal-row__snap">
        <span className="dlv__pill" style={{ cursor: 'default' }}><span className="dlv__pill-val tnum">{projPct}%</span><span className="dlv__pill-label">Progress</span></span>
        <span className="dlv__pill" style={{ cursor: 'default' }}><span className="dlv__pill-val">{dueText}</span><span className="dlv__pill-label">Horizon</span></span>
        {ms.length > 0 && <span className="dlv__pill" style={{ cursor: 'default' }}><span className="dlv__pill-val tnum">{msDone}/{ms.length}</span><span className="dlv__pill-label">Milestones</span></span>}
        <span className={`dlv__pill is-${momentum.tone}`} style={{ cursor: 'default' }}><span className="dlv__pill-val">{momentum.text}</span><span className="dlv__pill-label">Momentum</span></span>
      </div>

      {/* Next milestone */}
      {!isReached ? (
        next ? (
          <div className="goal-row__next">
            <div className="goal-row__next-label">Next milestone</div>
            <div className="goal-row__next-row">
              <button type="button" className="goal-next-toggle"
                aria-pressed={!!next.done}
                onClick={() => dispatch({ type: 'TOGGLE_GOAL_MILESTONE', id: goal.id, milestoneId: next.id })}>
                <span className="ms-box" aria-hidden="true">{next.done ? <IconCheck size={13} /> : null}</span>
                <span className="goal-next-name">{next.name}</span>
                {isValidDayStr(next.targetDate) && <span className="goal-next-date tnum">{prettyDate(next.targetDate)}</span>}
                <IconChevronRight size={14} className="goal-next-open" aria-hidden="true" />
              </button>
              <Link to={`goals/${goal.id}`} className="btn ghost sm goal-row__open" aria-label={`Open ${goal.title}`}>
                Open
              </Link>
            </div>
          </div>
        ) : ms.length === 0 ? (
          <div className="goal-row__next empty-milestone">
            <button type="button" className="btn ghost sm" onClick={onEdit}><IconPlus size={14} /> Add a milestone</button>
            <Link to={`goals/${goal.id}`} className="btn ghost sm">Open</Link>
          </div>
        ) : (
          <div className="goal-row__next">
            <p className="goal-reached-note">All milestones reached.</p>
            <Link to={`goals/${goal.id}`} className="btn ghost sm goal-row__open">Open</Link>
          </div>
        )
      ) : (
        <div className="goal-row__next">
          <p className="goal-reached-note"><IconCheck size={13} /> Outcome reached. Open to review.</p>
          <Link to={`goals/${goal.id}`} className="btn ghost sm goal-row__open">Open</Link>
        </div>
      )}

      {/* Footer actions */}
      <div className="goal-row__foot">
        <button className="btn ghost sm" onClick={onEdit}><IconPencil size={14} /> Edit</button>
        <span style={{ flex: 1 }} />
        <button className="btn ghost sm" onClick={onArchive} aria-label={`Archive ${goal.title}`}><IconArchive size={15} /></button>
        <button className="btn ghost sm" style={{ color: 'var(--bad)' }} onClick={onDelete} aria-label={`Delete ${goal.title}`}><IconTrash size={15} /></button>
      </div>
    </article>
  )
}

/* ------------------------------------------------------------
   TRAJECTORY STRIP — compact actual-vs-expected arc.

   Real data only. Actual line uses goalAnalytics actual series;
   expected is the linear pace line when a window exists; today is
   marked; completed milestones are filled dots, next is a ring;
   future milestones are hollow; projection extends as dashed.
   Gaps are breaks in the actual line (never interpolated).
   ------------------------------------------------------------ */
function TrajectoryStrip({ actual, prog, expectedToday, milestones, isReached, hasWindow, windowStart, windowEnd, today, projectionDays, areaVar, tone, ariaLabel }) {
  const W = 640, H = 64, L = 4, R = 4, T = 6, B = 18
  const n = actual.length
  const x = (i) => (n <= 1 ? (L + W - R) / 2 : L + (i / Math.max(1, n - 1 + projectionDays)) * (W - L - R))
  const y = (v) => T + (1 - Math.max(0, Math.min(100, v)) / 100) * (H - T - B)

  const known = actual.map((r, i) => ({ ...r, i, x: x(i), y: r.pct == null ? null : y(r.pct) }))
  let d = ''
  let started = false
  known.forEach((p) => {
    if (p.y == null) { started = false; return }
    d += (started ? 'L' : 'M') + p.x.toFixed(1) + ' ' + p.y.toFixed(1) + ' '
    started = true
  })
  d = d.trim()

  // Expected pace line: from (0,0) at windowStart to (n-1, expectedToday) and onward to target.
  let ed = ''
  if (hasWindow && expectedToday != null) {
    const t0 = new Date(`${windowStart}T00:00`).getTime()
    const t1 = new Date(`${windowEnd}T23:59`).getTime()
    const tNow = new Date(`${today}T12:00`).getTime()
    const todayX = L + Math.max(0, Math.min(1, (tNow - t0) / (t1 - t0))) * (W - L - R) * (n - 1) / Math.max(1, n - 1 + projectionDays)
    ed = `M${L} ${y(0)} L${todayX.toFixed(1)} ${y(expectedToday).toFixed(1)}`
  }

  // Projection dashed extension.
  let projD = ''
  if (projectionDays > 0 && !isReached) {
    const i0 = n - 1
    const p0 = known.find((p) => p.i === i0 && p.y != null)
    if (p0) {
      const xEnd = x(n - 1 + projectionDays)
      projD = `M${p0.x.toFixed(1)} ${p0.y.toFixed(1)} L${xEnd.toFixed(1)} ${y(100).toFixed(1)}`
    }
  }

  // Milestone markers along trajectory.
  const msDots = milestones.map((m) => {
    let mx, my
    if (isReached || m.done) {
      // Completed: place at last known point or progress line.
      const last = [...known].reverse().find((p) => p.y != null)
      mx = last ? last.x : x(n - 1)
      my = last ? last.y : y(prog)
    } else {
      // Next / upcoming: place on expected line at the milestone targetDate (clamped), else at current progress x.
      const t0 = hasWindow ? new Date(`${windowStart}T00:00`).getTime() : new Date(`${today}T00:00`).getTime()
      const t1 = hasWindow ? new Date(`${windowEnd}T23:59`).getTime() : new Date(`${today}T00:00`).getTime()
      if (isValidDayStr(m.targetDate) && t1 > t0) {
        const tm = new Date(`${m.targetDate}T12:00`).getTime()
        const pctAlong = Math.max(0, Math.min(1.2, (tm - t0) / (t1 - t0)))
        const idx = pctAlong * (n - 1 + projectionDays)
        mx = x(Math.round(idx))
        my = y(Math.round(pctAlong * (expectedToday ?? prog)))
      } else {
        mx = x(n - 1)
        my = y(prog)
      }
    }
    return { m, cx: mx, cy: my }
  })

  // Today marker x.
  const todayX = hasWindow && expectedToday != null
    ? L + Math.max(0, Math.min(1, (new Date(`${today}T12:00`).getTime() - new Date(`${windowStart}T00:00`).getTime()) / (new Date(`${windowEnd}T23:59`).getTime() - new Date(`${windowStart}T00:00`).getTime()))) * (W - L - R) * (n - 1) / Math.max(1, n - 1 + projectionDays)
    : x(n - 1)

  const stroke = isReached ? 'var(--good)' : `var(${areaVar})`
  const expStroke = tone === 'bad' ? 'var(--bad)' : tone === 'warn' ? 'var(--warn)' : 'var(--text-3)'

  return (
    <div className="goal-trajectory" role="img" aria-label={ariaLabel}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" aria-hidden="true">
        {/* baseline */}
        <line x1={L} y1={y(0)} x2={W - R} y2={y(0)} stroke="var(--border)" strokeWidth="1" />
        {/* 50% guide */}
        <line x1={L} y1={y(50)} x2={W - R} y2={y(50)} stroke="var(--border)" strokeDasharray="2 4" strokeWidth="1" />
        {/* expected pace */}
        {ed && <path d={ed} fill="none" stroke={expStroke} strokeWidth="1.5" strokeDasharray="3 4" opacity="0.8" />}
        {/* projection */}
        {projD && <path d={projD} fill="none" stroke={stroke} strokeWidth="1.8" strokeDasharray="2 3" opacity="0.5" />}
        {/* actual line */}
        {d && <path d={d} fill="none" stroke={stroke} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />}
        {/* current dot */}
        {(() => {
          const last = [...known].reverse().find((p) => p.y != null)
          if (!last) return null
          return <circle cx={last.x} cy={last.y} r="3.5" fill="var(--surface-solid)" stroke={stroke} strokeWidth="2" />
        })()}
        {/* milestone dots */}
        {msDots.map(({ m, cx, cy }, i) => (
          <circle key={m.id || i} cx={cx} cy={cy} r={m.done || isReached ? 3.5 : 3}
            fill={m.done || isReached ? stroke : 'var(--surface-solid)'}
            stroke={stroke} strokeWidth="1.8" />
        ))}
        {/* today marker */}
        <line x1={todayX} y1={T - 2} x2={todayX} y2={H - B + 2} stroke={stroke} strokeWidth="1.5" strokeDasharray="1 2" opacity="0.6" />
        <polygon points={`${todayX - 3},${H - B + 4} ${todayX + 3},${H - B + 4} ${todayX},${H - B}`} fill={stroke} opacity="0.7" />
      </svg>
      <div className="goal-trajectory__legend" aria-hidden="true">
        <span><i style={{ background: stroke }} /> actual</span>
        {ed && <span><i style={{ borderTop: `2px dashed ${expStroke}` }} /> expected</span>}
        {projD && <span><i style={{ borderTop: `2px dashed ${stroke}`, opacity: 0.6 }} /> projected</span>}
        {milestones.length > 0 && <span><i className="dot" style={{ background: stroke }} /> milestone</span>}
      </div>
    </div>
  )
}
