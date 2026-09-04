import { useEffect, useMemo } from 'react'
import { Reorder, motion } from 'framer-motion'
import { useStore } from '../store.jsx'
import { useHabitUI } from '../components/habits/HabitUIProvider.jsx'
import HabitRow from '../components/habits/HabitRow.jsx'
import ProgressRing from '../components/ui/ProgressRing.jsx'
import AnimatedNumber from '../components/ui/AnimatedNumber.jsx'
import SectionCard, { CardHead } from '../components/ui/SectionCard.jsx'
import EmptyState from '../components/ui/EmptyState.jsx'
import { todayStr, prettyDate, greeting, weekDays, daysBetween } from '../lib/dates.js'
import { activeHabits, todayStats, dailyInsight, weeklyReview, topStreak, projectProgress } from '../lib/stats.js'
import { isScheduled } from '../lib/schedule.js'
import { Link, useNavigate } from '../lib/router.jsx'
import { IconSettings, IconPlus, IconSparkle, IconChevronRight, IconDownload, IconFlame, IconGoals } from '../lib/icons.jsx'

export default function TodayScreen({ onFire }) {
  const { state, dispatch } = useStore()
  const habitUI = useHabitUI()
  const navigate = useNavigate()
  const today = todayStr()
  const stats = todayStats(state)
  const habitsToday = activeHabits(state).filter((h) => isScheduled(h, today))
  const insight = useMemo(() => dailyInsight(state), [state])
  const review = useMemo(() => weeklyReview(state), [state])
  const top = topStreak(state)
  const name = state.profile.name

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

  // stamp the nag once shown so it doesn't repeat for another 30 days
  useEffect(() => {
    if (backupDue) dispatch({ type: 'SET_PROFILE', patch: { lastBackupReminder: today } })
  }, [backupDue, dispatch, today])

  const dispatchReorder = (order) => dispatch({ type: 'REORDER_HABITS', order })

  // Commit a reorder of today's scheduled habits into the full habit order.
  const onReorderToday = (newTodayOrder) => {
    const ids = newTodayOrder.map((h) => h.id)
    const idSet = new Set(ids)
    let i = 0
    const fullOrder = state.habits.map((h) => (idSet.has(h.id) ? ids[i++] : h.id))
    dispatchReorder(fullOrder)
  }

  return (
    <div className="screen" id="today-screen">
      <header className="screen-head">
        <div>
          <h1 className="screen-title">{greeting(name)}</h1>
          <p className="screen-sub">{prettyDate(today)}</p>
        </div>
        <Link to="settings" className="btn ghost icon" aria-label="Settings">
          <IconSettings />
        </Link>
      </header>

      <div className="stack">
        {/* Progress */}
        <SectionCard className="pad-lg" style={{ overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
            <ProgressRing pct={stats.pct} size={132} stroke={12} label={stats.total ? `${stats.pct} percent complete today` : 'No habits yet'}>
              <div>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '2rem', lineHeight: 1 }}>
                  <AnimatedNumber value={stats.pct ?? 0} format={(v) => `${Math.round(v)}`} />%
                </div>
                <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-3)', marginTop: 2 }}>today</div>
              </div>
            </ProgressRing>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'var(--fs-h2)', lineHeight: 1.3 }}>
                {stats.total === 0
                  ? 'No habits scheduled'
                  : stats.done === stats.total
                    ? 'Everything done. Enjoy the rest of your day.'
                    : <><AnimatedNumber value={stats.done} /> of <AnimatedNumber value={stats.total} /> complete</>}
              </p>
              {stats.total > 0 && (
                <p style={{ color: 'var(--text-2)', fontSize: 'var(--fs-sm)', marginTop: 6 }}>
                  {stats.total - stats.done === 1 ? 'One habit left.' : `${stats.total - stats.done} habits left.`}
                  {top.streak >= 3 ? ` Best streak: ${top.streak} days.` : ''}
                </p>
              )}
            </div>
          </div>
        </SectionCard>

        {/* One daily insight */}
        {insight && (
          <SectionCard className="pad" delay={0.05}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <span style={{ color: 'var(--accent-2)', marginTop: 2 }}><IconSparkle size={18} /></span>
              <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-2)', lineHeight: 1.55 }}>{insight.text}</p>
            </div>
          </SectionCard>
        )}

        {/* Weekly review (Sundays) */}
        {showReview && (
          <SectionCard className="pad" delay={0.08}>
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
        <SectionCard className="pad" delay={0.1}>
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

        {/* Goals teaser */}
        {(state.projects || []).filter((p) => !p.completedAt).length > 0 && (
          <SectionCard className="pad" delay={0.12}>
            <CardHead title="Goals in progress">
              <Link to="goals" className="btn ghost sm">All goals <IconChevronRight size={14} /></Link>
            </CardHead>
            <div className="stack" style={{ gap: 12 }}>
              {state.projects.filter((p) => !p.completedAt).slice(0, 3).map((p) => {
                const pct = projectProgress(p)
                return (
                  <button key={p.id} className="goal-teaser" onClick={() => navigate('goals')} style={{ textAlign: 'left', display: 'block', width: '100%' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--fs-sm)', marginBottom: 6 }}>
                      <span style={{ fontWeight: 600 }}>{p.name}</span>
                      <span className="tnum" style={{ color: 'var(--text-2)' }}>{pct}%</span>
                    </div>
                    <div style={{ height: 6, borderRadius: 999, background: 'var(--track)', overflow: 'hidden' }}>
                      <motion.div
                        initial={false}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                        style={{ height: '100%', borderRadius: 999, background: 'linear-gradient(90deg, var(--accent-1), var(--accent-2))' }}
                      />
                    </div>
                  </button>
                )
              })}
            </div>
          </SectionCard>
        )}

        {/* Backup reminder (gentle, ≤ every 30 days) */}
        {backupDue && (
          <SectionCard className="pad" delay={0.14}>
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
    </div>
  )
}
