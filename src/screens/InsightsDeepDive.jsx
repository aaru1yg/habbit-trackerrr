/* ============================================================
   INSIGHTS · DEEP DIVE
   Everything here is computed from real check-ins. Sections that
   do not have enough data say so instead of inventing a number.
   No causal claims — only "often appear together".
   ============================================================ */
import { useMemo } from 'react'
import SectionCard, { CardHead } from '../components/ui/SectionCard.jsx'
import { HBarList, DonutStat, BucketColumns, CompareBars } from '../components/charts/workCharts.jsx'
import DayClock from '../components/charts/DayClock.jsx'
import PulseRibbon from '../components/charts/PulseRibbon.jsx'
import MoodScatter from '../components/charts/MoodScatter.jsx'
import {
  weekdayPerformance, weekdayVsWeekend, consistencyRanking, consistencyLabel, streakHistory,
  completionDistribution, timeOfDayPerformance, habitCorrelations, moodCorrelations,
  monthlyPulse, personalBests, smartInsights, moodScatter,
} from '../lib/analytics.js'
import { activeHabits, habitBestStreak } from '../lib/stats.js'
import { shortDate, prettyDate } from '../lib/dates.js'
import { Link } from '../lib/router.jsx'
import { IconSparkle, IconInsights, IconFlame, IconChevronRight } from '../lib/icons.jsx'

const YEAR = new Date().getFullYear()
const DIM_LABEL = { score: 'Mood', energy: 'Energy', focus: 'Focus', motivation: 'Motivation' }

export default function InsightsDeepDive({ state }) {
  const habits = activeHabits(state)

  const insights = useMemo(() => smartInsights(state, 6), [state])
  const weekdays = useMemo(() => weekdayPerformance(state, 12), [state])
  const split = useMemo(() => weekdayVsWeekend(state, 12), [state])
  const consistency = useMemo(() => consistencyRanking(state, 90).slice(0, 3), [state])
  const distribution = useMemo(() => completionDistribution(state, 90), [state])
  const timeOfDay = useMemo(() => timeOfDayPerformance(state, 90), [state])
  const pulse = useMemo(() => monthlyPulse(state, YEAR), [state])
  const bests = useMemo(() => personalBests(state), [state])
  const corr = useMemo(() => habitCorrelations(state, 60, 4), [state])
  const moodCorr = useMemo(() => moodCorrelations(state, 60), [state])
  const scatter = useMemo(() => moodScatter(state, 60), [state])

  // streak history for the habit with the longest recorded streak
  const streakHabit = useMemo(() => {
    let best = null
    for (const h of habits) {
      const b = habitBestStreak(state, h)
      if (b > 0 && (!best || b > best.days)) best = { habit: h, days: b }
    }
    return best
  }, [state, habits])
  const streaks = useMemo(
    () => (streakHabit ? streakHistory(state, streakHabit.habit, 6) : null),
    [state, streakHabit]
  )

  return (
    <div className="stack">
      {/* ---- Smart insights (§19) ---- */}
      <SectionCard className="pad">
        <CardHead title="What your data says" />
        {insights.length ? (
          <div className="insight-list">
            {insights.map((ins) => (
              <article key={ins.id} className="insight-card" data-tone={ins.tone}>
                <span className="insight-icon" aria-hidden="true"><IconSparkle size={16} /></span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p className="insight-title">{ins.title}</p>
                  <p className="insight-text">{ins.text}</p>
                </div>
                {ins.metric && <span className="insight-metric tnum">{ins.metric}</span>}
              </article>
            ))}
          </div>
        ) : (
          <p className="empty-note">
            Insights appear once you have a few weeks of check-ins. Nothing here is estimated or filled in.
          </p>
        )}
      </SectionCard>

      {/* ---- Consistency (§18) ---- */}
      <SectionCard className="pad">
        <CardHead title="Consistency">
          <span className="tiny muted">last 90 days</span>
        </CardHead>
        {consistency.length ? (
          <div className="grid-3-tight">
            {consistency.map(({ habit, score, rate, bestRun }) => (
              <Link key={habit.id} to="library" className="tile-btn">
                <DonutStat
                  pct={score ?? 0}
                  tone={score == null ? undefined : score >= 70 ? 'good' : score >= 40 ? 'warn' : 'bad'}
                  label={`${habit.name} consistency ${score == null ? 'not enough data' : `${score}%`}`}
                  size={92}
                />
                <p className="tile-title ellipsis">{habit.name}</p>
                <p className="tile-sub">{score == null ? 'Not enough data' : consistencyLabel(score)}</p>
                {bestRun > 1 && <p className="tiny muted tnum">Longest run: {bestRun} days</p>}
                {rate != null && <p className="tiny muted tnum">{Math.round(rate * 100)}% of scheduled days</p>}
              </Link>
            ))}
          </div>
        ) : (
          <p className="empty-note">
            Consistency measures how evenly you show up, not just how often. It needs at least a few weeks of scheduled days.
          </p>
        )}
      </SectionCard>

      {/* ---- Weekday performance (§17) ---- */}
      <SectionCard className="pad">
        <CardHead title="By weekday">
          <span className="tiny muted">last {weekdays.windowWeeks} weeks</span>
        </CardHead>
        {weekdays.enough ? (
          <>
            <HBarList
              rows={weekdays.rows.map((r) => ({
                key: r.weekday,
                label: r.name,
                value: r.rate == null ? null : Math.round(r.rate * 100),
                sub: `${r.done}/${r.total}`,
                tone: r.weekday === weekdays.best?.weekday ? 'good' : r.weekday === weekdays.worst?.weekday ? 'bad' : undefined,
              }))}
              aria-label="Completion rate by weekday"
            />
            {split && (
              <div style={{ marginTop: 16 }}>
                <p className="eyebrow">Weekday vs weekend</p>
                <CompareBars
                  a={{ label: 'Weekdays', value: split.weekdayPct }}
                  b={{ label: 'Weekends', value: split.weekendPct }}
                />
              </div>
            )}
          </>
        ) : (
          <p className="empty-note">Two or more weekdays with real check-ins are needed before this says anything honest.</p>
        )}
      </SectionCard>

      {/* ---- Time of day (§17E) ---- */}
      <SectionCard className="pad">
        <CardHead title="When you check in" />
        {timeOfDay.enough ? (
          <>
            <DayClock data={timeOfDay} />
            <p className="card-blurb">
              {(() => {
                const peak = timeOfDay.parts.find((x) => x.id === timeOfDay.peak)
                return peak
                  ? <>Most of your check-ins happen in the <b>{peak.label.toLowerCase()}</b> ({peak.pct}%). Based on {timeOfDay.total} real timestamps.</>
                  : `Based on ${timeOfDay.total} real timestamps.`
              })()}
            </p>
          </>
        ) : (
          <p className="empty-note">
            This only appears once your check-ins carry real timestamps — nothing is guessed.
          </p>
        )}
      </SectionCard>

      {/* ---- Completion distribution (§17D) ---- */}
      <SectionCard className="pad">
        <CardHead title="How your days land">
          <span className="tiny muted">last 90 days</span>
        </CardHead>
        {distribution.enough ? (
          <>
            <BucketColumns
              rows={distribution.buckets.map((b) => ({
                label: b.label,
                value: b.count,
                color: b.id === 'full' ? 'var(--good)' : b.id === 'high' ? 'var(--accent-2)' : undefined,
              }))}
              height={120}
            />
            <p className="card-blurb">
              {distribution.sampled} scheduled days sampled · <b className="tnum">{distribution.perfectDays}</b> day{distribution.perfectDays === 1 ? '' : 's'} at 75–100%.
            </p>
          </>
        ) : (
          <p className="empty-note">A week or two of scheduled days turns this into a picture of your typical day.</p>
        )}
      </SectionCard>

      {/* ---- Streak history (§17C) ---- */}
      <SectionCard className="pad">
        <CardHead title="Streak history">
          {streakHabit && <span className="tiny muted ellipsis">{streakHabit.habit.name}</span>}
        </CardHead>
        {streaks && streaks.enough ? (
          <>
            <div className="stat-trio">
              <div><p className="eyebrow">Current</p><p className="stat-num tnum">{streaks.current}</p><p className="tiny muted">days</p></div>
              <div><p className="eyebrow">Longest</p><p className="stat-num tnum">{streaks.longest}</p><p className="tiny muted">days</p></div>
              <div><p className="eyebrow">Breaks</p><p className="stat-num tnum">{streaks.interruptions}</p><p className="tiny muted">runs of 2+ days</p></div>
            </div>
            <div style={{ marginTop: 16 }}>
              <HBarList
                rows={streaks.runs.map((r, i) => ({
                  key: i,
                  label: `${shortDate(r.start)} → ${shortDate(r.end)}`,
                  value: r.length,
                  unit: 'd',
                  tone: r.length === streaks.longest ? 'good' : undefined,
                }))}
                max={streaks.longest || 1}
                unit="d"
              />
            </div>
            <p className="card-blurb">A break is not a failure — it is a gap in the record. Missed unscheduled days never count.</p>
          </>
        ) : (
          <p className="empty-note">Complete a habit on consecutive scheduled days and its runs show up here.</p>
        )}
      </SectionCard>

      {/* ---- Monthly pulse (§17G) ---- */}
      <SectionCard className="pad">
        <CardHead title={`${YEAR} month by month`} />
        {pulse.enough ? (
          <>
            <PulseRibbon months={pulse.months} year={YEAR} />
            <p className="card-blurb">
              Best month so far:{' '}
              <b className="tnum">
                {(() => {
                  const withData = pulse.months.filter((m) => m.pct != null)
                  if (!withData.length) return '—'
                  const best = withData.reduce((a, b) => (b.pct > a.pct ? b : a))
                  return `${best.label} at ${best.pct}%`
                })()}
              </b>
              {'. '}Tap a month in the calendar for the day-by-day view.
            </p>
          </>
        ) : (
          <p className="empty-note">Monthly totals appear once a month has real scheduled days.</p>
        )}
      </SectionCard>

      {/* ---- Personal bests (§17H) ---- */}
      <SectionCard className="pad">
        <CardHead title="Personal bests" />
        {bests.enough ? (
          <div className="kv">
            {bests.bestWeek && (
              <div className="kv-row"><span className="kv-k">Best week</span><span className="kv-v tnum">{bests.bestWeek.pct}% · {shortDate(bests.bestWeek.start)}–{shortDate(bests.bestWeek.end)}</span></div>
            )}
            {bests.bestMonth && (
              <div className="kv-row"><span className="kv-k">Best month</span><span className="kv-v tnum">{bests.bestMonth.pct}% · {bests.bestMonth.label}</span></div>
            )}
            {bests.bestDay && (
              <div className="kv-row"><span className="kv-k">Best day</span><span className="kv-v tnum">{bests.bestDay.pct}% · {prettyDate(bests.bestDay.date)} ({bests.bestDay.done}/{bests.bestDay.total})</span></div>
            )}
            {bests.longestStreak && (
              <div className="kv-row"><span className="kv-k">Longest streak</span><span className="kv-v tnum">{bests.longestStreak.days} days · {bests.longestStreak.habit.name}</span></div>
            )}
            {bests.mostConsistent && (
              <div className="kv-row"><span className="kv-k">Most consistent</span><span className="kv-v">{bests.mostConsistent.habit.name} · {bests.mostConsistent.score}% ({consistencyLabel(bests.mostConsistent.score)})</span></div>
            )}
            {bests.improvement && (
              <div className="kv-row"><span className="kv-k">Biggest improvement</span><span className="kv-v tnum">{bests.improvement.habit.name} +{bests.improvement.delta} pts</span></div>
            )}
            <div className="kv-row"><span className="kv-k">Total check-ins</span><span className="kv-v tnum">{bests.totalCheckins}</span></div>
          </div>
        ) : (
          <p className="empty-note">Bests are recorded, never projected. They appear as your history grows.</p>
        )}
      </SectionCard>

      {/* ---- Correlations (§26) ---- */}
      <SectionCard className="pad">
        <CardHead title="Patterns that travel together" />
        {scatter.enough && <MoodScatter data={scatter} dimLabel="mood" />}
        {corr.enough || moodCorr.enough ? (
          <div className="stack" style={{ gap: 12 }}>
            {corr.pairs.map(({ a, b, withRate, withoutRate, delta }, i) => (
              <div key={i} className="corr-row">
                <p className="corr-pair"><IconFlame size={14} /> {a.name} <span className="muted">+</span> {b.name}</p>
                <p className="corr-text">
                  On days you completed <b>{a.name}</b>, you finished <b className="tnum">{withRate}%</b> of <b>{b.name}</b>.
                  On days without it, <b className="tnum">{withoutRate}%</b>{' '}
                  <span className={delta >= 0 ? 'corr-up' : 'corr-down'}>({delta >= 0 ? '+' : ''}{delta} points)</span>.
                </p>
                <p className="tiny muted">These often appear together — that is not proof one causes the other.</p>
              </div>
            ))}
            {moodCorr.rows.map((r) => (
              <div key={r.dim} className="corr-row">
                <p className="corr-pair"><IconInsights size={14} /> {DIM_LABEL[r.dim] || r.dim} and completion</p>
                <p className="corr-text">
                  On high-{(DIM_LABEL[r.dim] || r.dim).toLowerCase()} days you completed <b className="tnum">{r.highPct}%</b>,
                  on low days <b className="tnum">{r.lowPct}%</b>{' '}
                  <span className={r.delta >= 0 ? 'corr-up' : 'corr-down'}>({r.delta >= 0 ? '+' : ''}{r.delta} points)</span>.
                </p>
                <p className="tiny muted">Based on {r.highTotal + r.lowTotal} logged days. Association, not causation.</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="empty-note">
            With a few weeks of overlap between two habits (or logged energy/mood), this shows what tends to happen together.
          </p>
        )}
      </SectionCard>

      <SectionCard className="pad">
        <div className="row-between">
          <p className="card-blurb" style={{ margin: 0 }}>
            Want the work side? Projects, assignments and deadlines have their own analytics.
          </p>
          <Link to="workload" className="btn ghost sm">Workload <IconChevronRight size={14} /></Link>
        </div>
      </SectionCard>
    </div>
  )
}
