/* ============================================================
   INSIGHTS — one analytics screen.

   v4 shipped five (Insights, InsightsDeepDive, AnalyticsLab,
   Mind, Achievements) that re-derived the same numbers from
   three different helper libraries. Everything here comes from
   compute.js, and anything that needs more data than you have
   says so instead of drawing a plausible-looking line.
   ============================================================ */
import { useMemo, useState } from 'react'
import { useStore } from '../../core/store.jsx'
import {
  dayScore, consistency, streak, lifetime, earnedMilestones,
  moodCorrelation, workProgress, 
} from '../../core/compute.js'
import { CATEGORIES } from '../../core/schema.js'
import { today, lastDays, shift, dayOf } from '../../core/date.js'
import {
  Surface, Panel, Segmented, Empty, SectionHead, Columns, Heatmap, Bar, Num, Badge,
} from '../../ui/index.jsx'
import { IconInsights, IconTrophy, IconMood, IconFlame } from '../../ui/icons.jsx'
import { HabitGlyph, MilestoneGlyph } from '../../ui/icons.jsx'

const RANGES = [
  { value: 30, label: '30 days' },
  { value: 90, label: '90 days' },
  { value: 182, label: '6 months' },
]

export default function InsightsScreen() {
  const state = useStore()
  const [range, setRange] = useState(30)
  const d = today()

  const { habits, checkins, work, moods } = state
  const active = habits.filter((h) => !h.archivedAt)

  const data = useMemo(() => {
    const days = lastDays(range, d)
    const series = days.map((x) => dayScore(habits, checkins, x))
    const tracked = series.filter((s) => s.due > 0)
    const avg = tracked.length ? tracked.reduce((s, x) => s + x.ratio, 0) / tracked.length : 0

    // Momentum: last third vs first third, so it describes a
    // direction rather than a single noisy day.
    const third = Math.max(1, Math.floor(tracked.length / 3))
    const early = tracked.slice(0, third)
    const late = tracked.slice(-third)
    const momentum = early.length && late.length
      ? (late.reduce((s, x) => s + x.ratio, 0) / late.length) - (early.reduce((s, x) => s + x.ratio, 0) / early.length)
      : null

    return {
      days,
      series,
      avg,
      momentum,
      trackedDays: tracked.length,
      weekly: weeklyTrend(habits, checkins, Math.ceil(range / 7), d),
      heat: heatCells(habits, checkins, range, d),
    }
  }, [habits, checkins, range, d])

  const stats = useMemo(() => lifetime(state, d), [state, d])
  const medals = useMemo(() => earnedMilestones(stats), [stats])
  const corr = useMemo(() => moodCorrelation(habits, checkins, moods, 60, d), [habits, checkins, moods, d])

  const byArea = useMemo(() => {
    return CATEGORIES.map((c) => {
      const list = active.filter((h) => h.category === c.id)
      if (!list.length) return { ...c, rate: null, count: 0 }
      const rate = list.reduce((s, h) => s + consistency(h, checkins, range, d).rate, 0) / list.length
      return { ...c, rate, count: list.length }
    }).filter((c) => c.count > 0)
  }, [active, checkins, range, d])

  const ranked = useMemo(() => {
    return active
      .map((h) => ({ h, c: consistency(h, checkins, range, d), st: streak(h, checkins, d) }))
      .filter((x) => x.c.due >= 3)
      .sort((a, b) => b.c.rate - a.c.rate)
  }, [active, checkins, range, d])

  const moodSeries = useMemo(() => lastDays(range, d).map((x) => moods[x]?.mood ?? null), [moods, range, d])
  const hasMood = moodSeries.some((v) => v != null)

  const workStats = useMemo(() => {
    const live = work.filter((w) => !w.archivedAt)
    const done = live.filter((w) => w.doneAt)
    const inRange = done.filter((w) => dayOf(w.doneAt) >= shift(d, -range))
    const minutes = live.reduce(
      (s, w) => s + w.log.filter((e) => dayOf(e.at) >= shift(d, -range) && e.minutes).reduce((a, e) => a + e.minutes, 0),
      0
    )
    return { total: live.length, done: done.length, inRange: inRange.length, minutes, avg: live.length ? Math.round(live.reduce((s, w) => s + workProgress(w), 0) / live.length) : 0 }
  }, [work, range, d])

  if (!habits.length && !work.length) {
    return (
      <Surface variant="flat" className="d1">
        <Empty
          icon={<IconInsights size={24} />}
          title="Nothing to analyse yet"
          body="Insights are built entirely from your own check-ins and logs. Add a habit or a project, use it for a week, and this screen fills itself in."
        />
      </Surface>
    )
  }

  return (
    <div className="stack stack--loose">
      <SectionHead
        eyebrow="Reflect"
        title="Insights"
        sub="Every number here is derived from what you logged. Nothing is estimated."
        action={<Segmented options={RANGES} value={range} onChange={setRange} label="Range" />}
      />

      {/* ---------- Headline numbers ---------- */}
      <div className="grid grid--4 rise" style={{ '--i': 0 }}>
        <Surface variant="flat" lift sheen depth={1} className="tile">
          <div className="stat stat--sm">
            <span className="stat__v num"><Num value={Math.round(data.avg * 100)} />%</span>
            <span className="stat__k">Average completion</span>
            <span className="stat__sub">over {data.trackedDays} tracked days</span>
          </div>
        </Surface>
        <Surface variant="flat" lift sheen depth={1} className="tile">
          <div className="stat stat--sm">
            <span className="stat__v num" style={{ color: momentumColor(data.momentum) }}>
              {data.momentum == null ? '—' : `${data.momentum >= 0 ? '+' : ''}${Math.round(data.momentum * 100)}%`}
            </span>
            <span className="stat__k">Momentum</span>
            <span className="stat__sub">last third vs first third</span>
          </div>
        </Surface>
        <Surface variant="flat" lift sheen depth={1} className="tile">
          <div className="stat stat--sm">
            <span className="stat__v num"><Num value={stats.perfectDays} /></span>
            <span className="stat__k">Perfect days</span>
            <span className="stat__sub">all-time</span>
          </div>
        </Surface>
        <Surface variant="flat" lift sheen depth={1} className="tile">
          <div className="stat stat--sm">
            <span className="stat__v num"><Num value={stats.totalCheckins} /></span>
            <span className="stat__k">Check-ins</span>
            <span className="stat__sub">across {stats.activeDays} days</span>
          </div>
        </Surface>
      </div>

      {/* ---------- Trend + heatmap ---------- */}
      <div className="grid grid--2 rise" style={{ '--i': 1 }}>
        <Panel title="Weekly completion" sub="Each bar is one week’s average">
          {data.weekly.some((v) => v > 0) ? (
            <Columns
              height={132}
              max={100}
              ceiling
              data={data.weekly.map((v, i) => ({ value: v, title: `${v}% completed`, key: i }))}
              labels={data.weekly.map((_, i, a) => (i === a.length - 1 ? 'This week' : `${a.length - 1 - i}w ago`))}
            />
          ) : (
            <Empty title="Not enough history" body="This needs a few weeks of check-ins before it means anything." />
          )}
        </Panel>

        <Panel title="Consistency" sub="One square per day across all habits">
          <Heatmap cells={data.heat} today={d} />
          <div className="row" style={{ marginTop: 'var(--s3)', gap: 6, justifyContent: 'flex-end' }}>
            <span className="tiny faint">Less</span>
            {[0, 1, 2, 3, 4].map((l) => <span key={l} className="heat__cell" data-lv={l} style={{ width: 11, height: 11 }} />)}
            <span className="tiny faint">More</span>
          </div>
        </Panel>
      </div>

      {/* ---------- Areas + ranking ---------- */}
      <div className="grid grid--2 rise" style={{ '--i': 2 }}>
        <Panel title="By area" sub={`Average consistency over ${range} days`}>
          {byArea.length === 0 ? (
            <Empty title="No habits yet" />
          ) : (
            <div className="stack stack--tight">
              {byArea.map((c) => (
                <div key={c.id} className="row" style={{ gap: 'var(--s3)' }}>
                                    <span className="small" style={{ width: 62 }}>{c.label}</span>
                  <Bar value={c.rate * 100} className="spacer" />
                  <span className="tiny num dim" style={{ width: 66, textAlign: 'right' }}>
                    {Math.round(c.rate * 100)}% · {c.count}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Strongest to weakest" sub="Habits with at least 3 due days in range">
          {ranked.length === 0 ? (
            <Empty title="Not enough data" body="Each habit needs a few due days before it can be ranked fairly." />
          ) : (
            <div className="stack stack--tight">
              {ranked.map(({ h, c, st }) => (
                <div key={h.id} className="row" style={{ gap: 'var(--s3)' }}>
                  <HabitGlyph icon={h.icon} category={h.category} size={15} />
                  <span className="small clamp1" style={{ flex: '0 0 34%', minWidth: 0 }}>{h.name}</span>
                  <Bar value={c.rate * 100} thin className="spacer" />
                  <span className="tiny num dim" style={{ width: 40, textAlign: 'right' }}>{Math.round(c.rate * 100)}%</span>
                  <span className="tiny num row" style={{ width: 40, justifyContent: 'flex-end', gap: 3, color: st.current ? 'var(--urgent)' : 'var(--faint)' }}>
                    <IconFlame size={11} />{st.current}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      {/* ---------- Mood ---------- */}
      <Panel
        title="Mood"
        sub={hasMood ? 'Logged from Today, one tap a day' : 'Log a mood on Today and it appears here'}
        className="rise"
        style={{ '--i': 3 }}
        action={<IconMood size={18} />}
      >
        {!hasMood ? (
          <Empty title="No mood logged yet" body="The mood card on Today takes one tap. After about a week there is enough to compare against your habits." />
        ) : (
          <>
            <Columns
              data={moodSeries.map((v, i) => ({ value: v ?? 0, title: `${data.days[i]}: ${v ?? 'not logged'}` }))}
              height={80}
              max={5}
              ceiling
            />
            <div style={{ marginTop: 'var(--s4)' }}>
              {corr.r == null ? (
                <p className="small dim">
                  {corr.n} day{corr.n === 1 ? '' : 's'} have both a mood and habit activity.
                  At {corr.need} the correlation becomes worth showing. Below that it would be noise.
                </p>
              ) : (
                <p className="small muted">
                  Across {corr.n} paired days, habit completion and mood correlate at{' '}
                  <strong className="num">{corr.r.toFixed(2)}</strong>{' '}
                  <Badge tone={corr.r > 0.3 ? 'good' : corr.r < -0.3 ? 'bad' : 'neutral'}>{corrLabel(corr.r)}</Badge>
                  <br />
                  <span className="tiny faint">Correlation, not cause. Both could be driven by something else entirely.</span>
                </p>
              )}
            </div>
          </>
        )}
      </Panel>

      {/* ---------- Work ---------- */}
      {work.length > 0 && (
        <Panel title="Work throughput" sub={`Last ${range} days`} className="rise" style={{ '--i': 4 }}>
          <div className="grid grid--4">
            <div className="stat stat--sm"><span className="stat__v num"><Num value={workStats.inRange} /></span><span className="stat__k">Finished in range</span></div>
            <div className="stat stat--sm"><span className="stat__v num"><Num value={workStats.done} /></span><span className="stat__k">Finished all-time</span></div>
            <div className="stat stat--sm"><span className="stat__v num"><Num value={workStats.avg} />%</span><span className="stat__k">Average progress</span></div>
            <div className="stat stat--sm">
              <span className="stat__v num">{workStats.minutes ? `${Math.round(workStats.minutes / 60)}h` : '—'}</span>
              <span className="stat__k">Time logged</span>
              <span className="stat__sub">{workStats.minutes ? 'from your entries' : 'log time on a work item'}</span>
            </div>
          </div>
        </Panel>
      )}

      {/* ---------- Milestones ---------- */}
      <Panel
        title="Milestones"
        sub={`${medals.filter((m) => m.earned).length} of ${medals.length} earned`}
        className="rise"
        style={{ '--i': 5 }}
        action={<IconTrophy size={18} />}
      >
        <div className="medals">
          {medals.map((m) => (
            <div key={m.id} className="medal" data-earned={m.earned}>
              <span className="medal__ico"><MilestoneGlyph icon={m.icon} size={17} /></span>
              <span className="medal__t">{m.label}</span>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  )
}

/* ---------------- helpers --------------------------------- */

function weeklyTrend(habits, checkins, weeks, ref) {
  const out = []
  for (let w = weeks - 1; w >= 0; w--) {
    const end = shift(ref, -w * 7)
    let sum = 0
    let n = 0
    for (let i = 0; i < 7; i++) {
      const s = dayScore(habits, checkins, shift(end, -i))
      if (s.due) { sum += s.ratio; n++ }
    }
    out.push(n ? Math.round((sum / n) * 100) : 0)
  }
  return out
}

function heatCells(habits, checkins, window, ref) {
  const days = lastDays(window, ref)
  const lead = (new Date(days[0]).getDay() + 6) % 7
  const padded = [...Array.from({ length: lead }, (_, i) => shift(days[0], -(lead - i))), ...days]
  return padded.map((day) => {
    const s = dayScore(habits, checkins, day)
    const level = !s.due ? 0 : s.ratio >= 1 ? 4 : s.ratio >= 0.66 ? 3 : s.ratio >= 0.33 ? 2 : s.ratio > 0 ? 1 : 0
    return { day, level, title: s.due ? `${s.done}/${s.due}` : 'nothing due' }
  })
}

const momentumColor = (m) => (m == null ? 'var(--faint)' : m > 0.03 ? 'var(--accent)' : m < -0.03 ? 'var(--urgent)' : undefined)

const corrLabel = (r) => {
  const a = Math.abs(r)
  const strength = a > 0.6 ? 'strong' : a > 0.3 ? 'moderate' : 'weak'
  return `${strength} ${r >= 0 ? 'positive' : 'negative'}`
}
