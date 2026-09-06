import { useEffect, useMemo, useState } from 'react'
import { Reorder } from 'framer-motion'
import { useStore } from '../store.jsx'
import { useHabitUI } from '../components/habits/HabitUIProvider.jsx'
import HabitRow from '../components/habits/HabitRow.jsx'
import RoutineStrip from '../components/habits/RoutineStrip.jsx'
import ProgressRing from '../components/ui/ProgressRing.jsx'
import AnimatedNumber from '../components/ui/AnimatedNumber.jsx'
import SectionCard, { CardHead } from '../components/ui/SectionCard.jsx'
import EmptyState from '../components/ui/EmptyState.jsx'
import SearchPalette from '../components/layout/SearchPalette.jsx'
import { StatusPill } from '../components/work/WorkKit.jsx'
import { todayStr, prettyDate, prettyTime, greeting, weekDays, daysBetween } from '../lib/dates.js'
import { activeHabits, todayStats, dailyInsight, weeklyReview, topStreak, habitStreak, routineStats, activeRoutines } from '../lib/stats.js'
import { priorityWork } from '../lib/work.js'
import { todayPriorities, dayTimeline, todayGoals, todayProjectGoals, todayHeadline } from '../lib/today.js'
import { streakMilestone } from '../lib/analytics.js'
import { isScheduled } from '../lib/schedule.js'
import { Link } from '../lib/router.jsx'
import {
  IconSettings, IconPlus, IconSparkle, IconChevronRight, IconDownload, IconFlame,
  IconSearch, IconAlert, IconStack,
} from '../lib/icons.jsx'

export default function TodayScreen({ onFire }) {
  const { state, dispatch } = useStore()
  const habitUI = useHabitUI()
  const today = todayStr()
  const [searchOpen, setSearchOpen] = useState(false)

  const stats = todayStats(state)
  const habitsToday = activeHabits(state).filter((h) => isScheduled(h, today))
  const insight = useMemo(() => dailyInsight(state), [state])
  const review = useMemo(() => weeklyReview(state), [state])
  const top = topStreak(state)
  const name = state.profile.name

  // ---- Today intelligence (§28) — all from real data ----
  const atRisk = useMemo(() => {
    if (!top.habit) return null
    const done = state.checkins?.[top.habit.id]?.[today]?.done === true
    return top.streak >= 3 && !done ? { habit: top.habit, streak: top.streak } : null
  }, [state, top, today])

  const nearMilestone = useMemo(() => {
    for (const h of habitsToday) {
      if (state.checkins?.[h.id]?.[today]?.done) continue
      const m = streakMilestone(state, h)
      if (m && m.away <= 2) return { habit: h, ...m }
    }
    return null
  }, [state, habitsToday, today])

  const overdue = useMemo(() => {
    // scheduled days in the last 3 days that were missed
    const out = []
    for (const h of activeHabits(state)) {
      for (let i = 1; i <= 3; i++) {
        const d = shift(today, -i)
        if (isScheduled(h, d) && d >= (h.createdAt || d) && !state.checkins?.[h.id]?.[d]?.done) {
          out.push({ habit: h, date: d })
          break
        }
      }
    }
    return out.slice(0, 3)
  }, [state, today])

  const priority = useMemo(() => priorityWork(state, new Date(), 3), [state])
  const plan = useMemo(() => {
    const now = new Date()
    return {
      rows: todayPriorities(state, { now, limit: 4 }),
      timeline: dayTimeline(state, { now, date: today }),
      // Real goals lead. Until the user creates one, projects stand in —
      // labelled as projects, never as goals they did not create.
      goals: todayGoals(state, { now, limit: 3 }),
      projectGoals: todayProjectGoals(state, { now, limit: 3 }),
      headline: todayHeadline(state, { now }),
    }
  }, [state, today])
  const routinesToday = useMemo(
    () => activeRoutines(state).filter((r) => routineStats(state, r, today).total > 0),
    [state, today]
  )

  // Sunday (or unseen) weekly review
  const isSunday = new Date().getDay() === 0
  const reviewSeenKey = 'aaru.review.seen'
  const reviewSeenWeek = (() => {
    try { return localStorage.getItem(reviewSeenKey) } catch { return null }
  })()
  const currentWeekStart = weekDays(today)[0]
  const showReview = isSunday && review && reviewSeenWeek !== currentWeekStart
  const dismissReview = () => {
    try { localStorage.setItem(reviewSeenKey, currentWeekStart) } catch { /* ok */ }
  }

  // 30-day backup reminder (gentle, once per period, only when there's real data)
  const hasData = habitsToday.length > 0 || Object.keys(state.checkins || {}).length > 0
  const lastExport = state.profile.lastBackupExport
  const lastNag = state.profile.lastBackupReminder
  const backupDue = hasData && (lastExport == null || daysBetween(lastExport, today) >= 30) && (lastNag == null || daysBetween(lastNag, today) >= 30)

  useEffect(() => {
    if (backupDue) dispatch({ type: 'SET_PROFILE', patch: { lastBackupReminder: today } })
  }, [backupDue, dispatch, today])

  const onReorderToday = (newTodayOrder) => {
    const ids = newTodayOrder.map((h) => h.id)
    const idSet = new Set(ids)
    let i = 0
    const fullOrder = state.habits.map((h) => (idSet.has(h.id) ? ids[i++] : h.id))
    dispatch({ type: 'REORDER_HABITS', order: fullOrder })
  }

  const left = Math.max(0, stats.total - stats.done)

  return (
    <div className="screen" id="today-screen">
      <header className="screen-head today-head">
        <div>
          <h1 className="screen-title">{greeting(name)}</h1>
          <p className="screen-sub">{prettyDate(today)}</p>
        </div>
        <div className="head-actions">
          <button className="btn ghost icon" aria-label="Search" onClick={() => setSearchOpen(true)}><IconSearch size={18} /></button>
          <Link to="settings" className="btn ghost icon" aria-label="Settings">
            <IconSettings />
          </Link>
        </div>
      </header>

      <div className="stack">
        {/* Today is deliberately one flow: what is due, how far through it, then context. */}
        <SectionCard className="pad-lg today-hero" style={{ overflow: 'hidden' }}>
          <div className="today-hero-inner">
            <div className="today-ring">
              <ProgressRing pct={stats.pct} size={156} stroke={12} label={stats.total ? `${stats.pct} percent complete today` : 'No habits yet'}>
                <div>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '2rem', lineHeight: 1 }}>
                    <AnimatedNumber value={stats.pct ?? 0} format={(v) => `${Math.round(v)}`} />%
                  </div>
                  <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-3)', marginTop: 4 }}>today</div>
                </div>
              </ProgressRing>
            </div>
            <div className="today-hero-copy">
              <p className="eyebrow today-kicker">Today’s focus</p>
              <div className="today-summary">
                <strong><span className="tnum">{stats.done}</span> of <span className="tnum">{stats.total}</span> complete</strong>
                <span>{stats.total === 1 ? 'habit' : 'habits'} scheduled</span>
              </div>
              <p style={{ color: 'var(--text-2)', fontSize: 'var(--fs-sm)', marginTop: 7 }}>
                {stats.total === 0
                  ? 'No habits scheduled for today.'
                  : stats.done === stats.total
                    ? 'Everything done. Keep the rest of the day open.'
                    : left === 1 ? 'One small finish left.' : `${left} small finishes left.`}
                {top.streak >= 3 ? ` Best streak: ${top.streak} days on ${top.habit?.name || 'a habit'}.` : ''}
              </p>
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
                <div className="today-stat"><strong>{stats.done}</strong><span>completed</span></div>
                <div className="today-stat"><strong>{left}</strong><span>remaining</span></div>
                <div className="today-stat"><strong>{top.streak || 0}</strong><span>day streak</span></div>
              </div>
            </div>
          </div>
        </SectionCard>

        {/* Today's priorities — what actually needs doing, in order */}
        {plan.rows.length > 0 && (
          <SectionCard className="pad today-priorities" delay={0.06}>
            <CardHead title="Today's priorities">
              <span className="tiny muted tnum">{plan.rows.length} item{plan.rows.length === 1 ? '' : 's'}</span>
            </CardHead>
            <p className={`pace-note`} data-tone={plan.headline.tone} style={{ marginTop: 0, marginBottom: 12 }}>
              {plan.headline.text}
            </p>
            <ol className="priority-list">
              {plan.rows.map((row, i) => (
                <li key={`${row.kind}-${row.id}`} className="priority-row" data-tone={row.tone}>
                  <Link to={row.href} className="priority-row-inner">
                    <span className="priority-index tnum" aria-hidden="true">{i + 1}</span>
                    <span className="priority-body">
                      <span className="priority-name">{row.name}</span>
                      <span className="priority-reason">{row.reason}</span>
                      {row.pct > 0 && (
                        <span className="meter" role="img" aria-label={`${row.name}: ${row.pct} percent complete`}>
                          <i style={{ width: `${row.pct}%` }} />
                        </span>
                      )}
                    </span>
                    <span className="priority-kind">{row.kind}</span>
                  </Link>
                </li>
              ))}
            </ol>
          </SectionCard>
        )}

        {/* Goals in progress */}
        {(plan.goals.length > 0 || plan.projectGoals.length > 0) && (
          <SectionCard className="pad today-goals" delay={0.08}>
            <CardHead title={plan.goals.length ? 'Goals in progress' : 'Projects in progress'}>
              <Link to={plan.goals.length ? 'goals' : 'projects'} className="btn ghost sm">
                {plan.goals.length ? 'All goals' : 'All projects'} <IconChevronRight size={14} />
              </Link>
            </CardHead>
            <div className="goal-strip">
              {(plan.goals.length ? plan.goals : plan.projectGoals).map((g) => (
                <Link key={g.id} to={g.href} className="goal-chip" data-tone={g.tone}>
                  <span className="goal-chip-head">
                    <span className="goal-chip-name">{g.name}</span>
                    <span className="tnum goal-chip-pct">{g.pct}%</span>
                  </span>
                  <span className="meter" role="img" aria-label={`${g.name}: ${g.pct} percent complete`}>
                    <i style={{ width: `${g.pct}%` }} />
                  </span>
                  <span className="goal-chip-meta">
                    {g.dueText}
                    {g.behind != null && g.behind > 10 ? ` · ${g.behind} points behind pace` : ''}
                    {g.behind != null && g.behind < -10 ? ` · ${Math.abs(g.behind)} points ahead of pace` : ''}
                    {g.pendingToday ? ` · ${g.pendingToday} to do today` : ''}
                  </span>
                </Link>
              ))}
            </div>
          </SectionCard>
        )}

        {/* Today's habits */}
        <SectionCard className="pad today-section" delay={0.12}>
          <CardHead title="What needs to be done">
            <button className="btn sm" onClick={habitUI.openAdd}>
              <IconPlus size={15} /> Add
            </button>
          </CardHead>

          {habitsToday.length === 0 ? (
            <EmptyState
              art="art/empty-hero.webp"
              title={activeHabits(state).length ? 'Nothing scheduled today' : 'Start with one habit'}
              icon={<IconFlame size={40} />}
            >
              {activeHabits(state).length
                ? 'Your habits aren\u2019t scheduled for today. Use the calendar to catch up on another day, or add something new.'
                : 'Pick a habit you want repeated. Small and specific beats big and vague.'}
            </EmptyState>
          ) : (
            <>
              {stats.done === stats.total && (
                <p style={{ textAlign: 'center', color: 'var(--text-2)', fontSize: 'var(--fs-sm)', padding: '2px 0 10px' }}>
                  All done for today.
                </p>
              )}
              <Reorder.Group
                axis="y"
                values={habitsToday}
                onReorder={onReorderToday}
                style={{ display: 'flex', flexDirection: 'column', gap: 10, listStyle: 'none', padding: 0, margin: 0 }}
                as="ul"
              >
                {habitsToday.map((h) => (
                  <HabitRow
                    key={h.id}
                    habit={h}
                    onDetail={habitUI.openDetail}
                    onArchive={habitUI.archive}
                    onDelete={habitUI.remove}
                    onFire={onFire}
                  />
                ))}
              </Reorder.Group>
            </>
          )}
        </SectionCard>


        {/* Day timeline — built from reminder times and real deadlines */}
        {plan.timeline.length > 0 && (
          <SectionCard className="pad today-timeline" delay={0.14}>
            <CardHead title="Your day">
              <span className="tiny muted">{plan.timeline.filter((e) => !e.done).length} remaining</span>
            </CardHead>
            <ol className="timeline">
              {plan.timeline.map((e, i) => (
                <li key={`${e.kind}-${e.label}-${i}`}>
                  <Link to={e.href} className={`tl-row${e.done ? ' is-done' : ''}`}>
                    <span className="tl-time tnum">{e.time ? prettyTime(`${today}T${e.time}`) : '—'}</span>
                    <span className="tl-marker" data-tone={e.tone || (e.done ? 'good' : 'neutral')} aria-hidden="true" />
                    <span className="tl-body">
                      <span className="tl-label">{e.label}</span>
                      <span className="tl-note">{e.note}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          </SectionCard>
        )}

        {/* One daily insight */}
        {insight && (
          <SectionCard className="pad today-insight" delay={0.06}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <span style={{ color: 'var(--accent-2)', marginTop: 2 }}><IconSparkle size={18} /></span>
              <div>
                <span className="insight-label">One useful insight</span>
                <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-2)', lineHeight: 1.55 }}>{insight.text}</p>
              </div>
            </div>
          </SectionCard>
        )}

        {/* Missed days you can still log */}
        {overdue.length > 0 && (
          <SectionCard className="pad today-missed" delay={0.08}>
            <CardHead title="Missed recently">
              <Link to="calendar" className="btn ghost sm">Log in calendar</Link>
            </CardHead>
            <div className="wrap-gap" style={{ gap: 6 }}>
              {overdue.map(({ habit, date }) => (
                <Link key={`${habit.id}-${date}`} to="calendar" className="btn sm" style={{ borderRadius: 999 }}>
                  {habit.name} · {date.slice(5).replace('-', '/')}
                </Link>
              ))}
            </div>
          </SectionCard>
        )}

        {/* Weekly review (Sundays) */}
        {showReview && (
          <SectionCard className="pad" delay={0.1}>
            <CardHead title={review.enough ? 'Your week in review' : 'Weekly review'}>
              <button className="btn ghost sm" onClick={dismissReview}>Dismiss</button>
            </CardHead>
            {review.enough ? (
              <div className="stack" style={{ gap: 8 }}>
                {review.lines.map((l, i) => (
                  <p key={i} style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-2)' }}>· {l}</p>
                ))}
                {review.suggestion && (
                  <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text)', background: 'var(--accent-soft)', borderRadius: 12, padding: '10px 12px', marginTop: 4 }}>
                    {review.suggestion}
                  </p>
                )}
              </div>
            ) : (
              <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-2)' }}>{review.text}</p>
            )}
          </SectionCard>
        )}

        {/* Routines (habit stacking) */}
        {routinesToday.length > 0 && (
          <SectionCard className="pad" delay={0.14}>
            <CardHead title="Routines">
              <Link to="library" className="btn ghost sm">Manage <IconChevronRight size={14} /></Link>
            </CardHead>
            <RoutineStrip date={today} />
          </SectionCard>
        )}

        {/* Backup reminder (gentle, ≤ every 30 days) */}
        {backupDue && (
          <SectionCard className="pad" delay={0.16}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <span style={{ color: 'var(--warn)' }}><IconDownload size={18} /></span>
              <p style={{ flex: 1, fontSize: 'var(--fs-sm)', color: 'var(--text-2)' }}>
                It&rsquo;s been over a month since your last backup. Export a copy to keep your history safe.
              </p>
              <Link to="settings" className="btn sm">Export</Link>
            </div>
          </SectionCard>
        )}
      </div>

      <SearchPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  )
}

/** Shift a 'yyyy-MM-dd' string by n days without importing more helpers. */
function shift(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(y, m - 1, d + n)
  const p = (v) => String(v).padStart(2, '0')
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`
}
