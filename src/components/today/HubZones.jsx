/* ============================================================
   HOME ZONES — the command-center rails of Today.

   Each zone answers ONE question and links somewhere real:
     Focus rings  · high-priority habits → habit detail
     Work         · open projects/assignments, urgency first
     Workload     · the next 7 days at a glance → Workload
     Goals        · what the day serves → goal detail
     Key insight  · one explainable pattern → Insights
     This week    · weekly snapshot
     Recent       · what changed → the entity that changed

   Deliberately NOT boxes-in-boxes: zones are open typographic
   sections separated by hairlines, cards appear only where a
   grouping earns one. Everything is real data; when a zone has
   nothing to say it renders nothing (or says so, plainly).
   ============================================================ */
import { useMemo } from 'react'
import { useStore } from '../../store.jsx'
import { Link } from '../../lib/router.jsx'
import { todayStr, subDaysStr, weekDays, weekdayShort, shortDate, prettyDate, prettyDateTime } from '../../lib/dates.js'
import { habitRate, habitStreak, topStreak, weekStats } from '../../lib/stats.js'
import { habitColorHex, habitPriority } from '../../lib/habitIdentity.js'
import { openGoals, goalProgress } from '../../lib/goals.js'
import { priorityWork, workloadSeries } from '../../lib/work.js'
import { smartInsights, timelineEvents } from '../../lib/analytics.js'
import { WorkRow } from '../work/WorkCards.jsx'
import { LoadColumns } from '../charts/workCharts.jsx'
import ProgressRing from '../ui/ProgressRing.jsx'
import AnimatedNumber from '../ui/AnimatedNumber.jsx'
import { IconChevronRight, IconProjects, IconAssignment, IconWorkload, IconSparkle } from '../../lib/icons.jsx'

/* ============================================================
   ZONE LABEL — shared open-layout heading (not a card).
   ============================================================ */
export function ZoneLabel({ children, hint, action, actionTo, actionLabel }) {
  return (
    <div className="zone-label">
      <div>
        <h2 className="zone-title">{children}</h2>
        {hint && <p className="zone-hint">{hint}</p>}
      </div>
      {(action || (actionTo && actionLabel)) && (
        action
          ? action
          : <Link to={actionTo} className="zone-action">{actionLabel} <IconChevronRight size={13} /></Link>
      )}
    </div>
  )
}

/* ============================================================
   FOCUS RINGS — high-priority habits, one ring each.
   ============================================================ */
export function FocusRings() {
  const { state } = useStore()
  const today = todayStr()
  const habits = useMemo(
    () => (state.habits || [])
      .filter((h) => !h.archived && habitPriority(h) >= 4)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .slice(0, 4),
    [state.habits],
  )

  if (!habits.length) return null

  return (
    <section className="hub-zone focus-rings" aria-label="High priority habits">
      <ZoneLabel hint="your high-priority habits">
        Focus
      </ZoneLabel>
      <div className="ring-row">
        {habits.map((h) => {
          const r = habitRate(state, h, subDaysStr(today, 29), today)
          const pct = r.eligible >= 2 && r.rate != null ? Math.round(r.rate * 100) : null
          const streak = habitStreak(state, h)
          const todayCheck = state.checkins?.[h.id]?.[today]
          const stateLabel = todayCheck?.done ? 'done today'
            : r.eligible >= 2 && streak > 0 ? `${streak}-day streak` : 'due today'
          return (
            <Link key={h.id} to={`habits/${h.id}`} className="focus-ring" aria-label={`${h.name}, ${pct == null ? 'not enough data yet' : `${pct} percent over the last 30 days`}, ${stateLabel}`}>
              <ProgressRing
                pct={pct}
                size={104}
                stroke={9}
                color={habitColorHex(h)}
                label={`${h.name}: ${pct == null ? 'not enough data yet' : `${pct}%`}`}
              >
                <span className="ring-center">
                  <span className="ring-pct tnum">{pct == null ? '—' : <><AnimatedNumber value={pct} duration={600} />%</>}</span>
                  <span className="ring-window">30d</span>
                </span>
              </ProgressRing>
              <span className="focus-name">{h.name}</span>
              <span className="focus-state" data-tone={todayCheck?.done ? 'good' : 'neutral'}>
                {todayCheck?.done ? '✓ done today' : stateLabel}
              </span>
              {pct == null && <span className="tiny muted">not enough data yet</span>}
            </Link>
          )
        })}
      </div>
    </section>
  )
}

/* ============================================================
   WORK ZONE — open projects & assignments, urgency first.
   Projects and assignments stay visually separate (kind tags,
   footers) — one generic "work" blob is exactly what we avoid.
   ============================================================ */
export function WorkZone() {
  const { state } = useStore()
  const nowMemo = useMemo(() => new Date(), [])
  const rows = useMemo(() => priorityWork(state, nowMemo, 8), [state, nowMemo])
  const urgent = rows.all.filter((r) => r.status.passed || r.status.id === 'urgent')
  const rest = rows.all.filter((r) => !r.status.passed && r.status.id !== 'urgent')
  const openProjects = (state.projects || []).filter((p) => !p.archived && !p.completedAt).length
  const openAssignments = (state.assignments || []).filter((a) => !a.archived && !a.completedAt).length
  if (!rows.all.length && !openProjects && !openAssignments) return null

  const items = (urgent.length ? urgent : rest).slice(0, 5)
  const hasMore = rows.all.length > items.length

  return (
    <section className="hub-zone work-zone" aria-label="Open work and deadlines">
      <ZoneLabel
        hint="projects and assignments, by urgency"
        actionTo="timeline"
        actionLabel="All deadlines"
      >
        Work
      </ZoneLabel>
      {items.length === 0 ? (
        <p className="zone-empty">Nothing dated is open right now.</p>
      ) : (
        <div className="deadline-strip hub-work-list">
          {items.map((o) => (
            <WorkRow key={`${o.kind}-${o.item.id}`} kind={o.kind} item={o.item} status={o.status} progressPct={o.status.pct} />
          ))}
        </div>
      )}
      {hasMore && (
        <p className="tiny muted zone-more">+ {rows.all.length - items.length} more on the {urgent.length ? 'list' : 'way'} · see Timeline</p>
      )}
      {(openProjects > 0 || openAssignments > 0) && (
        <div className="zone-foot-links">
          <Link to="projects" className="zone-foot-link"><IconProjects size={14} /> Projects <span className="tnum">({openProjects})</span></Link>
          <Link to="assignments" className="zone-foot-link"><IconAssignment size={14} /> Assignments <span className="tnum">({openAssignments})</span></Link>
          <Link to="workload" className="zone-foot-link"><IconWorkload size={14} /> Workload</Link>
        </div>
      )}
    </section>
  )
}

/* ============================================================
   WORKLOAD MINI — next 7 days, overloading visibly obvious.
   ============================================================ */
export function WorkloadMini() {
  const { state } = useStore()
  const today = todayStr()
  const week = weekDays(today)
  const load = useMemo(
    () => workloadSeries(state, { from: week[0], days: 7 }),
    [state, week],
  )
  const hasAny = load.rows.some((r) => r.count > 0)
  if (!hasAny) return null
  const totalMin = load.minutes
  return (
    <section className="hub-zone workload-mini" aria-label="Workload over the next 7 days">
      <ZoneLabel hint={totalMin ? `~${Math.round(totalMin / 60)}h estimated this week` : 'items due each day'} actionTo="workload" actionLabel="Workload">
        Load this week
      </ZoneLabel>
      <LoadColumns rows={load.rows} today={today} />
    </section>
  )
}

/* ============================================================
   GOALS MINI — real goals with progress; a project fallback is
   labelled as projects, never disguised as goals.
   ============================================================ */
export function GoalsMini() {
  const { state } = useStore()
  const nowMemo = useMemo(() => new Date(), [])
  const rows = useMemo(() => {
    return openGoals(state, { now: nowMemo })
      .slice(0, 3)
      .map((g) => ({ id: g.id, name: g.title, pct: goalProgress(state, g, { now: nowMemo }).pct }))
  }, [state, nowMemo])

  if (!rows.length) return null

  return (
    <section className="hub-zone goals-mini" aria-label="Goals in progress">
      <ZoneLabel hint="the why behind the work" actionTo="goals" actionLabel="All goals">
        Goals
      </ZoneLabel>
      <div className="goal-mini-list">
        {rows.map((g) => (
          <Link key={g.id} to={`goals/${g.id}`} className="goal-mini-row">
            <span className="goal-mini-name">{g.name}</span>
            <span className="meter goal-mini-meter" role="img" aria-label={`${g.name}: ${g.pct ?? 0} percent`}>
              <i style={{ width: `${g.pct ?? 0}%` }} />
            </span>
            <span className="goal-mini-pct tnum">{g.pct == null ? '—' : `${g.pct}%`}</span>
          </Link>
        ))}
      </div>
    </section>
  )
}

/* ============================================================
   KEY INSIGHT — one explainable pattern, linked to evidence.
   ============================================================ */
export function InsightMini() {
  const { state } = useStore()
  const rows = useMemo(() => smartInsights(state, 3), [state])
  const top = useMemo(() => topStreak(state), [state])
  if (!rows.length && !top.habit) return null
  return (
    <section className="hub-zone insight-mini" aria-label="Key insight">
      <ZoneLabel hint="patterns from your own record" actionTo="insights" actionLabel="All insights">
        Key insight
      </ZoneLabel>
      {rows.length === 0 ? (
        <p className="zone-empty">Keep logging — patterns appear after a little real history.</p>
      ) : (
        <ul className="insight-mini-list">
          {rows.slice(0, 2).map((ins) => (
            <li key={ins.id} data-tone={ins.tone}>
              <Link to="insights" className="insight-mini-row">
                <span className="insight-mini-icon"><IconSparkle size={15} /></span>
                <span className="insight-mini-body">
                  <span className="insight-mini-title">
                    {ins.title}
                    <span className="insight-mini-metric tnum" data-tone={ins.tone}>{ins.metric}</span>
                  </span>
                  <span className="insight-mini-text">{ins.text}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/* ============================================================
   WEEK MINI — weekly snapshot (this week vs last + review).
   ============================================================ */
export function WeekMini() {
  const { state } = useStore()
  const today = todayStr()
  const thisWeek = weekDays(today)
  const lastWeek = weekDays(subDaysStr(today, 7))
  const a = weekStats(state, thisWeek.filter((d) => d <= today))
  const b = weekStats(state, lastWeek)
  const delta = a.total && b.total ? a.pct - b.pct : null
  const perDay = thisWeek.map((d) => {
    const s = weekStats(state, [d])
    return { date: d, pct: s.pct, done: s.done, total: s.total, label: weekdayShort(d).slice(0, 2) }
  })
  if (!a.total && !b.total) return null
  return (
    <section className="hub-zone week-mini" aria-label="Weekly snapshot">
      <ZoneLabel
        hint={delta == null ? 'no comparable week yet' : delta === 0 ? 'level with last week' : delta > 0 ? `${delta} pts above last week` : `${Math.abs(delta)} pts below last week`}
        actionTo="week"
        actionLabel="Week view"
      >
        This week
      </ZoneLabel>
      <div className="week-mini-bars" role="img" aria-label={`Completion this week: ${perDay.map((d) => `${d.label} ${d.pct ?? 'no plan'}`).join(', ')}`}>
        {perDay.map((d) => (
          <span key={d.date} className="week-mini-bar" title={`${shortDate(d.date)} · ${d.pct == null ? 'nothing scheduled' : `${d.pct}%`}`}>
            <i data-on={d.pct != null ? 'true' : undefined} style={{ height: `${d.pct ?? 0}%` }} />
            <em>{d.label}</em>
          </span>
        ))}
      </div>
      <p className="week-mini-nums tnum">
        {a.total ? <><strong>{a.pct}%</strong> this week · <strong>{b.total ? `${b.pct}%` : '—'}</strong> last</> : 'no habits scheduled yet this week'}
      </p>
    </section>
  )
}

/* ============================================================
   RECENT MINI — what changed, linked to the thing that changed.
   ============================================================ */
export function RecentMini() {
  const { state } = useStore()
  const events = useMemo(() => timelineEvents(state, 8), [state])
  if (!events.length) return null
  return (
    <section className="hub-zone recent-mini" aria-label="Recent activity">
      <ZoneLabel hint="the system, live" actionTo="timeline" actionLabel="Full timeline">
        Recent activity
      </ZoneLabel>
      <ul className="recent-list">
        {events.slice(0, 6).map((e, i) => {
          const key = `${e.day}-${e.title}-${i}`
          const inner = (
            <>
              <span className="recent-dot" data-tone={e.tone} aria-hidden="true" />
              <span className="recent-body">
                <span className="recent-title">{e.title}</span>
                {e.body && <span className="recent-sub">{e.body}</span>}
              </span>
              <span className="recent-date tnum">{e.time ? prettyDateTime(e.at) : prettyDate(e.day || e.at)}</span>
            </>
          )
          return (
            <li key={key}>
              {e.href ? <Link to={e.href} className="recent-row">{inner}</Link>
                : <span className="recent-row">{inner}</span>}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

