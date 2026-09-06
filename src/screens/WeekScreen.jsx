import { useMemo, useState } from 'react'
import { useStore } from '../store.jsx'
import { useHabitUI } from '../components/habits/HabitUIProvider.jsx'
import SectionCard, { CardHead } from '../components/ui/SectionCard.jsx'
import ProgressRing from '../components/ui/ProgressRing.jsx'
import AnimatedNumber from '../components/ui/AnimatedNumber.jsx'
import MiniBars from '../components/ui/Bars.jsx'
import EmptyState from '../components/ui/EmptyState.jsx'
import { todayStr, subDaysStr, weekDays, weekdayShort, shortDate, prettyDate } from '../lib/dates.js'
import { activeHabits, isDone, weekStats, weekDelta, strongestHabit, weakestHabit, habitStreak } from '../lib/stats.js'
import { IconWeek, IconChevronLeft, IconChevronRight, IconTrendUp, IconTrendDown, IconFlame } from '../lib/icons.jsx'
import { isScheduled, categoryOf } from '../lib/schedule.js'
import { calendarMarkers } from '../lib/work.js'
import { WorkRow, workProgressOf } from '../components/work/WorkCards.jsx'
import { Link } from '../lib/router.jsx'

export default function WeekScreen() {
  const { state } = useStore()
  const habitUI = useHabitUI()
  const [offset, setOffset] = useState(0) // weeks back from current
  const today = todayStr()

  const weekStart = useMemo(() => weekDays(subDaysStr(today, offset * 7))[0], [today, offset])
  const week = useMemo(() => weekDays(subDaysStr(today, offset * 7)), [today, offset])
  const prevWeek = useMemo(() => weekDays(subDaysStr(week[0], 7)), [week])
  const stats = useMemo(() => weekStats(state, week), [state, week])
  const delta = useMemo(() => weekDelta(state, week, prevWeek), [state, week, prevWeek])

  const rangeLabel = `${shortDate(week[0])} – ${shortDate(week[6])}`
  const label = offset === 0 ? 'This week' : offset === 1 ? 'Last week' : rangeLabel

  const habits = activeHabits(state).filter((h) => week.some((d) => isScheduled(h, d)))
  const strong = useMemo(() => strongestHabit(state, week[0], week[6], 3), [state, week])
  const weak = useMemo(() => weakestHabit(state, week[0], week[6], 3), [state, week])

  const isThisWeek = offset === 0
  const daysElapsed = isThisWeek ? week.filter((d) => d <= today) : week

  // ---- work landing in this week (§72) ----
  const marks = useMemo(() => calendarMarkers(state, week), [state, week])
  const weekWork = useMemo(() => {
    const out = []
    for (const day of week) {
      for (const m of marks.get(day) || []) {
        if (m.kind === 'project-deadline' || m.kind === 'assignment-deadline') {
          out.push({ day, kind: m.kind === 'project-deadline' ? 'project' : 'assignment', item: m.item, status: m.status })
        }
      }
    }
    out.sort((a, b) => a.day.localeCompare(b.day))
    return out
  }, [marks, week])
  const weekOther = useMemo(() => {
    let tasks = 0
    let milestones = 0
    for (const day of week) {
      for (const m of marks.get(day) || []) {
        if (m.kind === 'task') tasks += 1
        if (m.kind === 'milestone') milestones += 1
      }
    }
    return { tasks, milestones }
  }, [marks, week])

  return (
    <div className="screen" id="week-screen">
      <header className="screen-head">
        <div>
          <h1 className="screen-title">Week</h1>
          <p className="screen-sub">{rangeLabel}{isThisWeek && ' · in progress'}</p>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn icon" onClick={() => setOffset((o) => o + 1)} aria-label="Previous week"><IconChevronLeft size={18} /></button>
          <button className="btn icon" onClick={() => setOffset((o) => Math.max(0, o - 1))} aria-label="Next week" disabled={offset === 0}><IconChevronRight size={18} /></button>
        </div>
      </header>

      <div className="stack">
        {weekWork.length > 0 && (
          <SectionCard className="pad">
            <CardHead title={isThisWeek ? 'Due this week' : 'Deadlines that week'}>
              <Link to="timeline" className="btn ghost sm">All deadlines</Link>
            </CardHead>
            <div className="tl">
              {weekWork.map(({ day, kind, item, status }) => (
                <WorkRow
                  key={`${kind}-${item.id}-${day}`}
                  kind={kind}
                  item={item}
                  status={status}
                  progressPct={workProgressOf(kind, item)}
                  right={<span className="tiny muted tnum">{weekdayShort(day)}</span>}
                />
              ))}
            </div>
            {(weekOther.tasks > 0 || weekOther.milestones > 0) && (
              <p className="tiny muted" style={{ marginTop: 10 }}>
                Also landing this week:{' '}
                {[weekOther.milestones > 0 && `${weekOther.milestones} milestone${weekOther.milestones === 1 ? '' : 's'}`,
                  weekOther.tasks > 0 && `${weekOther.tasks} task${weekOther.tasks === 1 ? '' : 's'}`]
                  .filter(Boolean).join(' and ')}.
              </p>
            )}
          </SectionCard>
        )}

        {habits.length === 0 ? (
          <SectionCard>
            <EmptyState art="art/empty-week.webp" icon={<IconWeek size={40} />} title="No habits scheduled this week">
              Add a habit to start tracking your week.
            </EmptyState>
          </SectionCard>
        ) : (
          <>
          {/* weekly completion */}
          <SectionCard className="pad-lg">
            <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
              <ProgressRing pct={stats.pct} size={124} stroke={11} label={`${stats.pct ?? 0} percent this week`}>
                <div>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.9rem', lineHeight: 1 }}>
                    <AnimatedNumber value={stats.pct ?? 0} />%
                  </div>
                  <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-3)', marginTop: 2 }}>week</div>
                </div>
              </ProgressRing>
              <div style={{ flex: 1, minWidth: 180 }}>
                <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'var(--fs-h2)' }}>
                  <AnimatedNumber value={stats.done} /> of <AnimatedNumber value={stats.total} /> check-ins
                </p>
                {delta.delta != null ? (
                  <p style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 8, fontSize: 'var(--fs-sm)', color: delta.delta >= 0 ? 'var(--good)' : 'var(--bad)', fontWeight: 600 }}>
                    {delta.delta >= 0 ? <IconTrendUp size={15} /> : <IconTrendDown size={15} />}
                    {delta.delta >= 0 ? 'Up' : 'Down'} {Math.abs(delta.delta)}% vs previous week
                  </p>
                ) : (
                  <p style={{ color: 'var(--text-3)', fontSize: 'var(--fs-sm)', marginTop: 8 }}>
                    No comparison yet — the previous week has no data.
                  </p>
                )}
              </div>
            </div>
            <div style={{ marginTop: 20 }}>
              <MiniBars
                data={week.map((d) => ({
                  label: weekdayShort(d),
                  value: (() => {
                    const s = stats.perDay.find((x) => x.date === d)
                    return s && s.total ? s.done / s.total : null
                  })(),
                }))}
                height={84}
                highlightLast={false}
              />
            </div>
          </SectionCard>

          {/* strongest / weakest */}
          {(strong || weak) && (
            <div className="grid-2">
              {strong && (
                <SectionCard className="pad" delay={0.05}>
                  <p className="eyebrow">Strongest habit</p>
                  <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'var(--fs-h2)', margin: '6px 0 2px' }}>{strong.habit.name}</p>
                  <p className="tnum" style={{ color: 'var(--good)', fontWeight: 700 }}>{Math.round(strong.rate * 100)}% this week</p>
                </SectionCard>
              )}
              {weak && (
                <SectionCard className="pad" delay={0.08}>
                  <p className="eyebrow">Needs attention</p>
                  <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'var(--fs-h2)', margin: '6px 0 2px' }}>{weak.habit.name}</p>
                  <p className="tnum" style={{ color: 'var(--warn)', fontWeight: 700 }}>{Math.round(weak.rate * 100)}% this week</p>
                </SectionCard>
              )}
            </div>
          )}

          {/* habit × day grid */}
          <SectionCard className="pad">
            <CardHead title="By habit" />
            <div className="stack" style={{ gap: 10 }}>
              {habits.map((h) => {
                const streak = habitStreak(state, h)
                const doneThisWeek = week.filter((d) => isDone(state, h.id, d)).length
                return (
                  <button
                    key={h.id}
                    className="week-habit"
                    onClick={() => habitUI.openDetail(h)}
                    aria-label={`Details for ${h.name}`}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', padding: '10px 12px', borderRadius: 14, background: 'var(--surface-2)', border: '1px solid var(--border)' }}
                  >
                    <span className="dot" style={{ width: 8, height: 8, borderRadius: 99, background: `var(${categoryOf(h.category).cssVar})`, flex: 'none' }} />
                    <span style={{ flex: 1, minWidth: 0, fontWeight: 600, fontSize: 'var(--fs-sm)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{h.name}</span>
                    {streak > 1 && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: 'var(--warn)', fontSize: 'var(--fs-xs)', fontWeight: 700 }}>
                        <IconFlame size={12} /> {streak}d
                      </span>
                    )}
                    <span style={{ display: 'flex', gap: 5 }} aria-hidden="true">
                      {week.map((d) => {
                        const sched = isScheduled(h, d)
                        const done = isDone(state, h.id, d)
                        const future = d > today
                        return (
                          <span
                            key={d}
                            title={`${prettyDate(d)}: ${done ? 'done' : sched ? (future ? 'upcoming' : 'missed') : 'not scheduled'}`}
                            style={{
                              width: 22, height: 22, borderRadius: 7,
                              background: done ? 'var(--good)' : sched ? (future ? 'transparent' : 'var(--track)') : 'transparent',
                              border: done ? 'none' : sched ? '1px solid var(--border-2)' : '1px dashed var(--border)',
                              opacity: future ? 0.45 : 1,
                              display: 'inline-block',
                            }}
                          />
                        )
                      })}
                    </span>
                    <span className="sr-only">{`${doneThisWeek} of 7 days logged this week`}</span>
                  </button>
                )
              })}
            </div>
            <p style={{ color: 'var(--text-3)', fontSize: 'var(--fs-xs)', marginTop: 12 }}>
              Solid = completed · outline = missed · dashed = not scheduled
            </p>
          </SectionCard>
          </>
        )}
      </div>
    </div>
  )
}
