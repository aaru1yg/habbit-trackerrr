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
import { WorkRow } from '../components/work/WorkCards.jsx'
import { StatusPill } from '../components/work/WorkKit.jsx'
import { todayStr, prettyDate, greeting, weekDays, daysBetween } from '../lib/dates.js'
import { activeHabits, todayStats, dailyInsight, weeklyReview, topStreak, habitStreak, routineStats, activeRoutines } from '../lib/stats.js'
import { priorityWork } from '../lib/work.js'
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
  const hasPriority = priority.overdue.length + priority.dueToday.length + priority.upcoming.length > 0
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
      <header className="screen-head">
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
        {/* Progress */}
        <SectionCard className="pad-lg" style={{ overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
            <ProgressRing pct={stats.pct} size={132} stroke={12} label={stats.total ? `${stats.pct} percent complete today` : 'No habits yet'}>
              <div>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '2rem', lineHeight: 1 }}>
                  <AnimatedNumber value={stats.pct ?? 0} format={(v) => `${Math.round(v)}`} />%
                </div>
                <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-3)', marginTop: 2 }}>today</div>
              </div>
            </ProgressRing>
            <div style={{ flex: 1, minWidth: 180 }}>
              <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'var(--fs-h2)', lineHeight: 1.3 }}>
                {stats.total === 0
                  ? 'No habits scheduled'
                  : stats.done === stats.total
                    ? 'Everything done. Enjoy the rest of your day.'
                    : <><AnimatedNumber value={stats.done} /> of <AnimatedNumber value={stats.total} /> complete</>}
              </p>
              {stats.total > 0 && (
                <p style={{ color: 'var(--text-2)', fontSize: 'var(--fs-sm)', marginTop: 6 }}>
                  {left === 0 ? '' : left === 1 ? 'One habit left.' : `${left} habits left.`}
                  {top.streak >= 3 ? ` Best streak: ${top.streak} days${top.habit ? ` on ${top.habit.name}` : ''}.` : ''}
                </p>
              )}
              {atRisk && (
                <p className="pace-note" data-tone="warn" style={{ marginTop: 12 }}>
                  <IconAlert size={14} />
                  Your {atRisk.streak}-day streak on {atRisk.habit.name} is at risk tonight.
                </p>
              )}
              {!atRisk && nearMilestone && (
                <p className="pace-note" data-tone="good" style={{ marginTop: 12 }}>
                  <IconFlame size={14} />
                  {nearMilestone.away === 1
                    ? `One more completion gives ${nearMilestone.habit.name} a ${nearMilestone.target}-day streak.`
                    : `${nearMilestone.away} completions away from a ${nearMilestone.target}-day streak on ${nearMilestone.habit.name}.`}
                </p>
              )}
            </div>
          </div>
        </SectionCard>

        {/* Priority work — contextual layer, habits stay primary (§82) */}
        {hasPriority && (
          <SectionCard className="pad" delay={0.04}>
            <CardHead title="Priority work">
              <Link to="workload" className="btn ghost sm">Workload <IconChevronRight size={14} /></Link>
            </CardHead>
            <div className="deadline-strip">
              {[...priority.overdue, ...priority.dueToday, ...priority.upcoming].slice(0, 3).map((o) => (
                <WorkRow key={`${o.kind}-${o.item.id}`} kind={o.kind} item={o.item} status={o.status} progressPct={o.status.pct} />
              ))}
            </div>
          </SectionCard>
        )}

        {/* One daily insight */}
        {insight && (
          <SectionCard className="pad" delay={0.06}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <span style={{ color: 'var(--accent-2)', marginTop: 2 }}><IconSparkle size={18} /></span>
              <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-2)', lineHeight: 1.55 }}>{insight.text}</p>
            </div>
          </SectionCard>
        )}

        {/* Missed days you can still log */}
        {overdue.length > 0 && (
          <SectionCard className="pad" delay={0.08}>
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

        {/* Today's habits */}
        <SectionCard className="pad" delay={0.12}>
          <CardHead title="Today">
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
