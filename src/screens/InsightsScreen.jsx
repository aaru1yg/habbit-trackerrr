import { useMemo, useState } from 'react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, AreaChart, Area, Cell,
} from 'recharts'
import { useStore } from '../store.jsx'
import SectionCard, { CardHead } from '../components/ui/SectionCard.jsx'
import AnimatedNumber from '../components/ui/AnimatedNumber.jsx'
import EmptyState from '../components/ui/EmptyState.jsx'
import MiniMonth from '../components/ui/MiniMonth.jsx'
import { todayStr, subDaysStr, weekDays, shortDate, weekdayShort } from '../lib/dates.js'
import {
  activeHabits, dayStats, weekStats, topStreak, achievements, yearOverview,
  habitRate, rankHabits, moodStats, moodHabitLink,
} from '../lib/stats.js'
import { categoryOf } from '../lib/schedule.js'
import { navigate } from '../lib/router.jsx'
import { IconInsights, IconAward, IconTrendUp } from '../lib/icons.jsx'

const YEAR = new Date().getFullYear()

export default function InsightsScreen() {
  const { state } = useStore()
  const today = todayStr()
  const habits = activeHabits(state)

  const hasData = habits.length > 0 && Object.values(state.checkins || {}).some((days) => Object.keys(days || {}).length > 0)

  // ---- KPIs ----
  const last30 = useMemo(() => {
    let done = 0, total = 0
    for (let i = 0; i < 30; i++) {
      const s = dayStats(state, subDaysStr(today, i))
      done += s.done
      total += s.total
    }
    return total ? Math.round((done / total) * 100) : null
  }, [state, today])

  const totalCheckins = useMemo(
    () => Object.values(state.checkins || {}).reduce((n, days) => n + Object.values(days || {}).filter((c) => c?.done).length, 0),
    [state]
  )
  const best = achievements(state)
  const mood = useMemo(() => moodStats(state, 30), [state])
  const moodLink = useMemo(() => moodHabitLink(state, 30), [state])

  // ---- weekly trend (12 weeks, recharts) ----
  const weekly = useMemo(() => {
    const rows = []
    for (let w = 11; w >= 0; w--) {
      const ws = weekStats(state, weekDays(subDaysStr(today, w * 7)))
      rows.push({
        label: shortDate(weekDays(subDaysStr(today, w * 7))[0]).replace(/,.*/, ''),
        short: weekdayShort(weekDays(subDaysStr(today, w * 7))[0]),
        pct: ws.total ? ws.pct : null,
      })
    }
    return rows
  }, [state, today])

  // ---- 90-day daily trend (area) ----
  const daily = useMemo(() => {
    const rows = []
    for (let i = 29; i >= 0; i--) {
      const d = subDaysStr(today, i)
      const s = dayStats(state, d)
      rows.push({ date: shortDate(d), pct: s.total ? s.pct : null })
    }
    return rows
  }, [state, today])

  // ---- per-habit rates (30d) ----
  const habitRanks = useMemo(() => rankHabits(state, subDaysStr(today, 29), today, 3), [state, today])

  // ---- category balance (30d) ----
  const byCategory = useMemo(() => {
    const map = {}
    for (const h of habits) {
      const r = habitRate(state, h, subDaysStr(today, 29), today)
      const c = categoryOf(h.category)
      if (!map[c.id]) map[c.id] = { label: c.label, cssVar: c.cssVar, done: 0, total: 0 }
      map[c.id].done += r.done
      map[c.id].total += r.eligible
    }
    return Object.values(map).filter((c) => c.total > 0)
  }, [state, habits, today])

  const year = useMemo(() => yearOverview(state, YEAR), [state])
  const yearsWithData = year.some((m) => m.anyEligible)

  if (!habits.length) {
    return (
      <div className="screen" id="insights-screen">
        <header className="screen-head">
          <div>
            <h1 className="screen-title">Insights</h1>
            <p className="screen-sub">Your numbers, straight from your data.</p>
          </div>
        </header>
        <SectionCard>
          <EmptyState icon={<IconInsights size={40} />} title="Nothing to analyze yet">
            Add habits and check them off — insights appear as your history grows.
          </EmptyState>
        </SectionCard>
      </div>
    )
  }

  return (
    <div className="screen" id="insights-screen">
      <header className="screen-head">
        <div>
          <h1 className="screen-title">Insights</h1>
          <p className="screen-sub">Every number here comes from your own check-ins.</p>
        </div>
      </header>

      <div className="stack">
        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
          <SectionCard className="pad" style={{ padding: 16 }}>
            <p className="eyebrow">30-day completion</p>
            <p className="stat-value" style={{ marginTop: 6 }}>
              {last30 == null ? '—' : <><AnimatedNumber value={last30} />%</>}
            </p>
          </SectionCard>
          <SectionCard className="pad" style={{ padding: 16 }} delay={0.04}>
            <p className="eyebrow">Best streak</p>
            <p className="stat-value" style={{ marginTop: 6 }}>
              <AnimatedNumber value={best.best} /> <span style={{ fontSize: '0.95rem', color: 'var(--text-2)' }}>days</span>
            </p>
          </SectionCard>
          <SectionCard className="pad" style={{ padding: 16 }} delay={0.08}>
            <p className="eyebrow">Active habits</p>
            <p className="stat-value" style={{ marginTop: 6 }}><AnimatedNumber value={habits.length} /></p>
          </SectionCard>
          <SectionCard className="pad" style={{ padding: 16 }} delay={0.12}>
            <p className="eyebrow">Total check-ins</p>
            <p className="stat-value" style={{ marginTop: 6 }}><AnimatedNumber value={totalCheckins} /></p>
          </SectionCard>
        </div>

        {/* weekly trend */}
        <SectionCard className="pad">
          <CardHead title="Weekly completion" />
          {hasData ? (
            <div style={{ width: '100%', height: 200 }}>
              <ResponsiveContainer>
                <BarChart data={weekly} margin={{ top: 8, right: 4, left: -22, bottom: 0 }}>
                  <CartesianGrid stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="short" tick={{ fill: 'var(--text-3)', fontSize: 11 }} axisLine={false} tickLine={false} interval={1} />
                  <YAxis domain={[0, 100]} tick={{ fill: 'var(--text-3)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    formatter={(v) => (v == null ? 'no data' : `${v}%`)}
                    labelFormatter={(l, payload) => payload?.[0]?.payload?.label ? `Week of ${payload[0].payload.label}` : l}
                    contentStyle={{ background: 'var(--surface-solid)', border: '1px solid var(--border-2)', borderRadius: 12, fontSize: 12, color: 'var(--text)' }}
                    cursor={{ fill: 'var(--surface-3)' }}
                  />
                  <Bar dataKey="pct" radius={[5, 5, 0, 0]} maxBarSize={26}>
                    {weekly.map((w, i) => (
                      <Cell key={i} fill={w.pct == null ? 'var(--track)' : i === weekly.length - 1 ? 'var(--accent-2)' : 'var(--accent-1)'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p style={{ color: 'var(--text-2)', fontSize: 'var(--fs-sm)', padding: '12px 0' }}>
              No check-ins yet — this chart fills in as you go.
            </p>
          )}
        </SectionCard>

        {/* 30-day trend */}
        <SectionCard className="pad">
          <CardHead title="Last 30 days" />
          {hasData ? (
            <div style={{ width: '100%', height: 180 }}>
              <ResponsiveContainer>
                <AreaChart data={daily} margin={{ top: 8, right: 4, left: -22, bottom: 0 }}>
                  <defs>
                    <linearGradient id="insight-area" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--accent-2)" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="var(--accent-2)" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="date" tick={{ fill: 'var(--text-3)', fontSize: 10 }} axisLine={false} tickLine={false} interval={5} />
                  <YAxis domain={[0, 100]} tick={{ fill: 'var(--text-3)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    formatter={(v) => (v == null ? 'no data' : `${v}%`)}
                    contentStyle={{ background: 'var(--surface-solid)', border: '1px solid var(--border-2)', borderRadius: 12, fontSize: 12, color: 'var(--text)' }}
                  />
                  <Area type="monotone" dataKey="pct" stroke="var(--accent-2)" strokeWidth={2} fill="url(#insight-area)" connectNulls />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p style={{ color: 'var(--text-2)', fontSize: 'var(--fs-sm)', padding: '12px 0' }}>
              Nothing logged in the last 30 days.
            </p>
          )}
        </SectionCard>

        {/* habit consistency */}
        {habitRanks.length > 0 && (
          <SectionCard className="pad">
            <CardHead title="Habit consistency" />
            <p style={{ color: 'var(--text-3)', fontSize: 'var(--fs-xs)', marginBottom: 12 }}>Last 30 days · habits with at least 3 scheduled days</p>
            <div className="stack" style={{ gap: 12 }}>
              {habitRanks.map(({ habit, rate, done, eligible }) => (
                <div key={habit.id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--fs-sm)', marginBottom: 5 }}>
                    <span style={{ fontWeight: 600 }}>{habit.name}</span>
                    <span className="tnum" style={{ color: 'var(--text-2)' }}>{Math.round(rate * 100)}% <span style={{ color: 'var(--text-3)' }}>({done}/{eligible})</span></span>
                  </div>
                  <div style={{ height: 6, borderRadius: 999, background: 'var(--track)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.round(rate * 100)}%`, borderRadius: 999, background: 'linear-gradient(90deg, var(--accent-1), var(--accent-2))' }} />
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        )}

        {/* category balance */}
        {byCategory.length > 0 && (
          <SectionCard className="pad">
            <CardHead title="Where your effort goes" />
            <div className="stack" style={{ gap: 10 }}>
              {byCategory.map((c) => {
                const pct = Math.round((c.done / c.total) * 100)
                return (
                  <div key={c.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span className="dot" style={{ width: 8, height: 8, borderRadius: 99, background: `var(${c.cssVar})`, flex: 'none' }} />
                    <span style={{ width: 72, fontSize: 'var(--fs-sm)', fontWeight: 600, flex: 'none' }}>{c.label}</span>
                    <div style={{ flex: 1, height: 6, borderRadius: 999, background: 'var(--track)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, borderRadius: 999, background: `var(${c.cssVar})` }} />
                    </div>
                    <span className="tnum" style={{ width: 38, textAlign: 'right', fontSize: 'var(--fs-sm)', color: 'var(--text-2)' }}>{pct}%</span>
                  </div>
                )
              })}
            </div>
          </SectionCard>
        )}

        {/* year overview */}
        <SectionCard className="pad">
          <CardHead title={`${YEAR} at a glance`} />
          {yearsWithData ? (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(112px, 1fr))', gap: 10 }}>
                {year.map((m) => (
                  <MiniMonth key={m.month} year={YEAR} month={m.month} cells={m.cells} onSelect={(y, mo) => navigate(`calendar/${y}-${String(mo + 1).padStart(2, '0')}`)} />
                ))}
              </div>
              <p style={{ color: 'var(--text-3)', fontSize: 'var(--fs-xs)', marginTop: 12 }}>Tap a month to open it in the calendar.</p>
            </>
          ) : (
            <p style={{ color: 'var(--text-2)', fontSize: 'var(--fs-sm)', padding: '8px 0' }}>
              Your {YEAR} heatmap appears once you start checking off habits.
            </p>
          )}
        </SectionCard>

        {/* achievements */}
        <SectionCard className="pad">
          <CardHead title="Achievements" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
            {best.badges.map((b) => (
              <div
                key={b.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '12px 12px', borderRadius: 14,
                  background: b.earned ? 'var(--accent-soft)' : 'var(--surface-2)',
                  border: `1px solid ${b.earned ? 'transparent' : 'var(--border)'}`,
                  opacity: b.earned ? 1 : 0.7,
                }}
              >
                <BadgeArt id={b.id} earned={b.earned} />
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontWeight: 700, fontSize: 'var(--fs-sm)', fontFamily: 'var(--font-display)' }}>{b.label}</p>
                  <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-3)' }}>{b.earned ? 'Earned' : b.blurb}</p>
                </div>
              </div>
            ))}
          </div>
          {best.next && (
            <p style={{ color: 'var(--text-2)', fontSize: 'var(--fs-sm)', marginTop: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <IconTrendUp size={14} />
              {best.next.threshold - best.best} more streak day{best.next.threshold - best.best === 1 ? '' : 's'} to reach {best.next.label}.
            </p>
          )}
        </SectionCard>

        {/* mood link */}
        {moodLink && (
          <SectionCard className="pad">
            <CardHead title="Mood and habits" />
            <p style={{ color: 'var(--text-2)', fontSize: 'var(--fs-sm)' }}>
              On days you felt good, you completed <b className="tnum" style={{ color: 'var(--good)' }}>{moodLink.goodPct}%</b> of your habits.
              On low days, <b className="tnum" style={{ color: 'var(--warn)' }}>{moodLink.lowPct}%</b>. (Last 30 days.)
            </p>
          </SectionCard>
        )}
      </div>
    </div>
  )
}

/* Badge artwork (generated) with graceful fallback. */
function BadgeArt({ id, earned }) {
  const [failed, setFailed] = useState(false)
  if (failed) {
    return (
      <span
        aria-hidden="true"
        style={{
          width: 34, height: 34, borderRadius: 999, flex: 'none',
          background: earned ? 'linear-gradient(135deg, var(--accent-1), var(--accent-2))' : 'var(--surface-3)',
        }}
      />
    )
  }
  return (
    <img
      src={`art/badge-${id}.webp`}
      alt=""
      width={34}
      height={34}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      style={{ width: 34, height: 34, borderRadius: 99, objectFit: 'cover', flex: 'none', filter: earned ? 'none' : 'grayscale(0.9) opacity(0.6)' }}
    />
  )
}
