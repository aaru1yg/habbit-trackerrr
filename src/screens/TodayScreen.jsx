import { useEffect, useMemo, useState } from 'react'
import { Reorder } from 'framer-motion'
import { useStore } from '../store.jsx'
import { useHabitUI } from '../components/habits/HabitUIProvider.jsx'
import HabitRow from '../components/habits/HabitRow.jsx'
import RoutineStrip from '../components/habits/RoutineStrip.jsx'
import TodayHero from '../components/today/TodayHero.jsx'
import DaySheet from '../components/today/DaySheet.jsx'
import {
  ZoneLabel, FocusRings, WorkZone, WorkloadMini, GoalsMini, InsightMini,
  WeekMini, RecentMini,
} from '../components/today/HubZones.jsx'
import MasterGraph from '../components/charts/MasterGraph.jsx'
import EmptyState from '../components/ui/EmptyState.jsx'
import SearchPalette from '../components/layout/SearchPalette.jsx'

import { todayStr, prettyDate, prettyTime, greeting, weekDays, daysBetween, weekdayShort } from '../lib/dates.js'
import { activeHabits, todayStats, dailyInsight, weeklyReview, topStreak, activeRoutines, routineStats, trendSeries } from '../lib/stats.js'
import { habitPriority } from '../lib/habitIdentity.js'
import { todayPriorities, dayTimeline } from '../lib/today.js'
import { streakMilestone } from '../lib/analytics.js'
import { isScheduled } from '../lib/schedule.js'
import { Link } from '../lib/router.jsx'
import {
  IconSettings, IconPlus, IconSearch, IconDownload, IconFlame,
} from '../lib/icons.jsx'

export default function TodayScreen({ onFire }) {
  const { state, dispatch } = useStore()
  const habitUI = useHabitUI()
  const today = todayStr()
  const [searchOpen, setSearchOpen] = useState(false)
  const [day, setDay] = useState(null)

  const stats = todayStats(state)
  const allActive = activeHabits(state)
  const habitsToday = allActive.filter((h) => isScheduled(h, today))
  const insight = useMemo(() => dailyInsight(state), [state])
  const top = topStreak(state)
  const name = state.profile.name

  // ---- what changed / at risk (real data only) ----
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
    const out = []
    for (const h of allActive) {
      for (let i = 1; i <= 3; i++) {
        const d = shift(today, -i)
        if (isScheduled(h, d) && d >= (h.createdAt || d) && !state.checkins?.[h.id]?.[d]?.done) {
          out.push({ habit: h, date: d })
          break
        }
      }
    }
    return out.slice(0, 3)
  }, [state, allActive, today])

  /* hero side-rail: the honest last-7-days shape of this user's data */
  const week = useMemo(() => {
    const rows = trendSeries(state, 7).map((r) => ({
      day: r.date,
      label: weekdayShort(r.date),
      pct: r.total ? Math.round((r.done / r.total) * 100) : 0,
      done: r.done,
      total: r.total,
    }))
    const eligible = rows.filter((r) => r.total > 0)
    const avg = eligible.length
      ? Math.round(eligible.reduce((n, r) => n + r.pct, 0) / eligible.length)
      : 0
    return { rows, avg, hasAny: rows.some((r) => r.total > 0 && r.done > 0) }
  }, [state])

  const plan = useMemo(() => {
    const now = new Date()
    return {
      rows: todayPriorities(state, { now, limit: 8 }),
      timeline: dayTimeline(state, { now, date: today }),
    }
  }, [state, today])

  // Attention first: overdue/due-today work + at-risk or high-priority habits.
  const focusRows = useMemo(() => plan.rows.filter((r) => {
    if (r.kind !== 'habit') return true
    const h = allActive.find((x) => x.id === r.id)
    return r.tone === 'warn' || (h && habitPriority(h) >= 4)
  }).slice(0, 4), [plan.rows, allActive])

  const routinesToday = useMemo(
    () => activeRoutines(state).filter((r) => routineStats(state, r, today).total > 0),
    [state, today],
  )

  // high-priority remaining (the ring habits that still need today)
  const prioLeft = useMemo(() => {
    const hi = habitsToday.filter((h) => habitPriority(h) >= 4)
    const left = hi.filter((h) => !state.checkins?.[h.id]?.[today]?.done).length
    return { total: hi.length, left }
  }, [habitsToday, state.checkins, today])

  // Sunday (or unseen) weekly review
  const isSunday = new Date().getDay() === 0
  const reviewSeenKey = 'aaru.review.seen'
  const reviewSeenWeek = (() => {
    try { return localStorage.getItem(reviewSeenKey) } catch { return null }
  })()
  const currentWeekStart = weekDays(today)[0]
  const review = useMemo(() => weeklyReview(state), [state])
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
  const heroCopy = `${
    stats.total === 0
      ? 'No habits scheduled for today.'
      : stats.done === stats.total
        ? 'Everything done. Keep the rest of the day open.'
        : left === 1 ? 'One small finish left.' : `${left} small finishes left.`
  }${top.streak >= 3 ? ` Best streak: ${top.streak} days on ${top.habit?.name || 'a habit'}.` : ''}`

  const nothingScheduledButHabitsExist = allActive.length > 0 && habitsToday.length === 0

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

      <div className="hub">
        {/* ---------- MASTER DAILY PROGRESS ---------- */}
        <TodayHero
          stats={stats}
          top={top}
          atRisk={atRisk}
          nearMilestone={nearMilestone}
          copy={heroCopy}
          week={week}
          prio={prioLeft.total ? { left: prioLeft.left, total: prioLeft.total } : null}
        />

        {allActive.length === 0 ? (
          <section className="hub-empty" aria-label="Get started">
            <EmptyState
              art="art/empty-hero.webp"
              title="Start with one habit"
              icon={<IconFlame size={40} />}
              action={<button className="btn primary" onClick={habitUI.openAdd}><IconPlus size={16} /> Add your first habit</button>}
            >
              Pick a habit you want repeated. Small and specific beats big and vague.
            </EmptyState>
          </section>
        ) : (
          <>
            {/* ---------- MASTER HABIT GRAPH (one line per habit, its own colour) ---------- */}
            <section className="hub-zone master-zone" aria-label="Master habit graph">
              <div className="master-zone-head">
                <div>
                  <h2 className="screen-h2">Every habit, one line</h2>
                  <p className="zone-hint">One colour per habit — set when you create it. Lines are real 7-day completion averages.</p>
                </div>
                <Link to="habits" className="btn ghost sm">Manage habits</Link>
              </div>
              <MasterGraph habits={allActive} onOpenDay={(d) => setDay(d)} onOpenHabit={(h) => habitUI.openFull(h)} />
            </section>

            <div className="hub-grid">
              {/* ================= MAIN COLUMN ================= */}
              <main className="hub-main">
                {focusRows.length > 0 && (
                  <section className="hub-zone focus-zone today-priorities" aria-label="Needs attention first">
                    <ZoneLabel hint="what matters most right now">
                      Needs attention
                    </ZoneLabel>
                    <ol className="priority-list">
                      {focusRows.map((row, i) => (
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
                            <span className="priority-kind">{row.kind === 'assignment' ? 'assignment'
                              : row.kind === 'project' ? 'project'
                                : row.kind === 'task' ? 'task' : 'habit'}</span>
                          </Link>
                        </li>
                      ))}
                    </ol>
                  </section>
                )}

                {/* ---------- TODAY'S HABITS ---------- */}
                <section className="hub-zone today-list" aria-label="Today's habits">
                  <div className="zone-label">
                    <div>
                      <h2 className="zone-title">Today</h2>
                      <p className="zone-hint">
                        {stats.total === 0 ? 'nothing scheduled — add or skip a day in the calendar'
                          : stats.done === stats.total ? 'all done — clean sweep'
                            : `${stats.done} of ${stats.total} done`}
                      </p>
                    </div>
                    <button className="btn sm" onClick={habitUI.openAdd}>
                      <IconPlus size={15} /> Add
                    </button>
                  </div>

                  {nothingScheduledButHabitsExist ? (
                    <EmptyState
                      art="art/empty-calendar.webp"
                      title="Nothing scheduled today"
                      icon={<IconFlame size={40} />}
                    >
                      Your habits aren&rsquo;t scheduled for today. Use the calendar to catch up on another day, or add something new.
                    </EmptyState>
                  ) : habitsToday.length === 0 ? (
                    <p className="zone-empty">No habits yet — add one and it appears here every scheduled day.</p>
                  ) : (
                    <Reorder.Group
                      axis="y"
                      values={habitsToday}
                      onReorder={onReorderToday}
                      style={{ display: 'flex', flexDirection: 'column', gap: 8, listStyle: 'none', padding: 0, margin: 0 }}
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
                  )}

                  {/* inline day timeline */}
                  {plan.timeline.length > 0 && (
                    <div className="today-timeline-inline today-timeline">
                      <div className="zone-label compact" style={{ marginTop: 6 }}>
                        <div>
                          <h3 className="zone-title sm">Your day</h3>
                        </div>
                        <span className="tiny muted">{plan.timeline.filter((e) => !e.done).length} remaining</span>
                      </div>
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
                    </div>
                  )}
                </section>

                {/* Routines stacked on the record */}
                {routinesToday.length > 0 && (
                  <section className="hub-zone" aria-label="Routines today">
                    <ZoneLabel hint="stacked habits" actionTo="library" actionLabel="Manage">
                      Routines
                    </ZoneLabel>
                    <RoutineStrip date={today} />
                  </section>
                )}
              </main>

              {/* ================= RAIL ================= */}
              <aside className="hub-rail" aria-label="System overview">
                <FocusRings />
                <WorkZone />
                <WorkloadMini />
                <GoalsMini />
                <InsightMini />
              </aside>
            </div>

            {/* ================= RECAP (open zones, not boxes) ================= */}
            <div className="hub-recap">
              <WeekMini />
              <RecentMini />
              {overdue.length > 0 && (
                <section className="hub-zone missed-zone" aria-label="Missed recently">
                  <ZoneLabel hint="still loggable" actionTo="calendar" actionLabel="Calendar">
                    Missed recently
                  </ZoneLabel>
                  <div className="wrap-gap" style={{ gap: 6 }}>
                    {overdue.map(({ habit, date }) => (
                      <Link key={`${habit.id}-${date}`} to="calendar" className="btn sm" style={{ borderRadius: 999 }}>
                        {habit.name} · {date.slice(5).replace('-', '/')}
                      </Link>
                    ))}
                  </div>
                </section>
              )}
            </div>

            {/* Sunday review — thin, dismissible, once per week */}
            {showReview && review && (
              <section className="banner-row" aria-label="Weekly review">
                <div className="banner-row-body">
                  <p className="eyebrow">Weekly review</p>
                  {review.enough ? (
                    review.lines.slice(0, 2).map((l, i) => <p key={i} className="banner-text">{l}</p>)
                  ) : (
                    <p className="banner-text">{review.text}</p>
                  )}
                  {review.suggestion && <p className="banner-text" data-tone="good">{review.suggestion}</p>}
                </div>
                <button className="btn ghost sm" onClick={dismissReview}>Dismiss</button>
              </section>
            )}

            {/* Backup reminder — gentle, ≤ every 30 days */}
            {backupDue && (
              <section className="banner-row" aria-label="Backup reminder">
                <div className="banner-row-body" style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <span style={{ color: 'var(--warn)', display: 'grid', placeItems: 'center' }}><IconDownload size={18} /></span>
                  <p className="banner-text" style={{ flex: 1 }}>
                    It&rsquo;s been over a month since your last backup. Export a copy to keep your history safe.
                  </p>
                </div>
                <Link to="settings" className="btn sm">Export</Link>
              </section>
            )}

            {/* one useful insight (kept honest: no pattern claims before real data) */}
            {insight && (
              <section className="banner-row" aria-label="One useful insight">
                <div className="banner-row-body" style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
                  <span style={{ color: 'var(--accent-2)', marginTop: 2 }}>✦</span>
                  <div>
                    <p className="eyebrow">One useful insight</p>
                    <p className="banner-text" data-tone={insight.tone}>{insight.text}</p>
                  </div>
                </div>
                <Link to="insights" className="btn ghost sm">Evidence</Link>
              </section>
            )}
          </>
        )}
      </div>

      <DaySheet date={day} onClose={() => setDay(null)} />
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
