/* ============================================================
   HABIT DETAIL — the full record for one habit.
   Everything on this page comes from stored check-ins. When a
   window has no eligible days, the chart says so instead of
   drawing an empty axis.
   ============================================================ */
import { useMemo, useState } from 'react'
import { useStore } from '../store.jsx'
import SectionCard, { CardHead } from '../components/ui/SectionCard.jsx'
import ProgressRing from '../components/ui/ProgressRing.jsx'
import AnimatedNumber from '../components/ui/AnimatedNumber.jsx'
import { useHabitUI } from '../components/habits/HabitUIProvider.jsx'
import { Heatmap } from '../components/charts/chartKit.jsx'
import { HBarList, Sparkline } from '../components/charts/workCharts.jsx'
import { habitDetail, consistencyLabel } from '../lib/analytics.js'
import { heatmapSeries } from '../lib/stats.js'
import { categoryOf, scheduleLabel } from '../lib/schedule.js'
import { prettyDate } from '../lib/dates.js'
import { habitColorHex, habitPriority, priorityMeta } from '../lib/habitIdentity.js'
import { Link, navigate } from '../lib/router.jsx'
import { TrendChart } from '../components/charts/chartKit.jsx'
import { IconPencil, IconChevronLeft, IconFlame, IconClock, IconCalendar, IconLayers, IconTarget } from '../lib/icons.jsx'

const RANGES = [
  { id: 7, label: '7D' },
  { id: 30, label: '30D' },
  { id: 90, label: '90D' },
  { id: 182, label: '6M' },
  { id: 365, label: '1Y' },
]

export default function HabitDetailScreen({ id }) {
  const { state } = useStore()
  const habitUI = useHabitUI()
  const [days, setDays] = useState(90)

  const habit = useMemo(() => (state.habits || []).find((h) => h.id === id) || null, [state.habits, id])
  const detail = useMemo(() => habitDetail(state, habit, days), [state, habit, days])
  const heat = useMemo(
    () => habit ? heatmapSeries({ ...state, habits: [habit] }, Math.ceil(days / 7) + 1) : [],
    [state, habit, days],
  )

  if (!habit) {
    return (
      <div className="screen">
        <header className="screen-head">
          <div>
            <h1 className="screen-title">Habit not found</h1>
            <p className="screen-sub">This habit may have been deleted.</p>
          </div>
        </header>
        <div className="stack">
          <SectionCard className="pad">
            <Link to="habits" className="btn primary">
              <IconChevronLeft size={16} /> Back to habits
            </Link>
          </SectionCard>
        </div>
      </div>
    )
  }

  const cat = categoryOf(habit.category)
  const hex = habitColorHex(habit)
  const prio = habitPriority(habit)
  const streaks = detail.streaks?.runs ?? []
  const linkedGoals = (state.goals || []).filter((g) => !g.archived && (g.linkedHabitIds || []).includes(habit.id))
  const rate = detail.rate
  const pct = rate?.rate != null ? Math.round(rate.rate * 100) : null

  const facts = [
    { label: 'Current streak', value: detail.streak, unit: detail.streak === 1 ? 'day' : 'days' },
    { label: 'Best streak', value: detail.best, unit: detail.best === 1 ? 'day' : 'days' },
    { label: `Last ${days} days`, value: pct == null ? '—' : pct, unit: '%' },
    {
      label: 'Consistency',
      value: detail.consistency?.enough ? detail.consistency.score : '—',
      unit: detail.consistency?.enough ? consistencyLabel(detail.consistency.score) : 'not enough data',
    },
  ]

  const weekdayRows = detail.weekdays
    .filter((w) => w.rate != null)
    .map((w) => ({ label: w.label, value: Math.round(w.rate * 100) }))

  const scheduledTrend = detail.trend.filter((t) => t.scheduled)
  const trendValues = scheduledTrend.map((t) => (t.pct ? 1 : 0))
  const perfData = scheduledTrend.map((t) => ({ date: t.date, pct: t.pct ? 100 : 0 }))

  return (
    <div className="screen" id="habit-detail-screen">
      <header className="screen-head">
        <div style={{ minWidth: 0 }}>
          <button className="btn ghost sm back-link" onClick={() => navigate('habits')}>
            <IconChevronLeft size={15} /> Habits
          </button>
          <h1 className="screen-title habit-detail-title">
            <span className="habit-dot" style={{ background: hex }} aria-hidden="true" />
            {habit.name}
          </h1>
          <p className="screen-sub">
            {cat.label} · {scheduleLabel(habit)}{habit.reminder ? ` · ${habit.reminder}` : ''} ·{' '}
            <span className="prio-mini" data-p={prio} aria-label={`Priority ${prio} — ${priorityMeta(prio).label}`} title={`Priority ${prio} — ${priorityMeta(prio).label}`}>
              {[1, 2, 3, 4, 5].map((i) => <i key={i} data-on={i <= prio ? 'true' : undefined} aria-hidden="true" />)}
            </span>
            {priorityMeta(prio).label}
          </p>
        </div>
        <div className="head-actions">
          <button className="btn" onClick={() => habitUI.openEdit(habit)} aria-label={`Edit ${habit.name}`}>
            <IconPencil size={16} /> Edit
          </button>
        </div>
      </header>

      <div className="stack">
        {/* ---------- Summary ---------- */}
        <SectionCard className="pad-lg habit-summary">
          <div className="habit-summary-inner">
            <ProgressRing
              pct={pct ?? 0}
              size={132}
              stroke={11}
              label={pct == null ? 'Not enough data yet' : `${pct} percent over the last ${days} days`}
            >
              <div>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.75rem', lineHeight: 1 }}>
                  {pct == null ? '—' : <><AnimatedNumber value={pct} />%</>}
                </div>
                <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-3)', marginTop: 4 }}>
                  {rate?.eligible ? `${rate.done} of ${rate.eligible}` : 'no eligible days'}
                </div>
              </div>
            </ProgressRing>

            <div className="habit-summary-copy">
              <p className="eyebrow">Window</p>
              <div className="seg" role="group" aria-label="Date range" style={{ marginTop: 6 }}>
                {RANGES.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    className={`seg-btn${days === r.id ? ' active' : ''}`}
                    aria-pressed={days === r.id}
                    onClick={() => setDays(r.id)}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
              <p className="habit-summary-line">
                {detail.delta == null
                  ? 'Not enough history to compare with the previous period.'
                  : detail.delta === 0
                    ? 'Exactly level with the previous period.'
                    : detail.delta > 0
                      ? `Up ${detail.delta} points on the previous ${days} days.`
                      : `Down ${Math.abs(detail.delta)} points on the previous ${days} days.`}
              </p>
              {trendValues.length > 2 && (
                <div className="habit-spark">
                  <Sparkline values={trendValues} width={180} height={30} />
                  <span className="tiny muted">every scheduled day, oldest first</span>
                </div>
              )}
            </div>
          </div>

          <div className="habit-facts">
            {facts.map((f) => (
              <div key={f.label} className="habit-fact">
                <span className="habit-fact-label">{f.label}</span>
                <strong className="tnum">{f.value}</strong>
                <span className="habit-fact-unit">{f.unit}</span>
              </div>
            ))}
          </div>
        </SectionCard>

        {/* ---------- Performance ---------- */}
        <SectionCard className="pad" delay={0.02}>
          <CardHead title="Performance">
            <span className="tiny muted tnum">{detail.trend.filter((t) => t.scheduled).length} scheduled days</span>
          </CardHead>
          {trendValues.length >= 2 ? (
            <>
              <TrendChart data={perfData} color={hex} />
              <p className="card-blurb" style={{ marginTop: 6 }}>
                Every scheduled day in the window, oldest first — 100 when done, 0 when not.
              </p>
            </>
          ) : (
            <p className="empty-note">Not enough data yet — at least two scheduled days in this window are needed before a trend means anything.</p>
          )}
        </SectionCard>

        {/* ---------- Consistency heatmap ---------- */}
        <SectionCard className="pad" delay={0.04}>
          <CardHead title="Consistency">
            <span className="tiny muted tnum">{detail.rate?.done ?? 0}/{detail.rate?.eligible ?? 0} days</span>
          </CardHead>
          <Heatmap weeks={heat} ariaLabel={`${habit.name} consistency heatmap`} />
        </SectionCard>

        {/* ---------- Streak history ---------- */}
        <SectionCard className="pad" delay={0.06}>
          <CardHead title="Streak history">
            <span className="tiny muted"><IconFlame size={13} /> best {detail.best}</span>
          </CardHead>
          {streaks.length === 0 ? (
            <p className="empty-note">No completed streaks recorded yet.</p>
          ) : (
            <div className="streak-list">
              {streaks.map((s, i) => (
                <div key={`${s.start}-${i}`} className="streak-row">
                  <span className="streak-bar" style={{ width: `${Math.max(8, (s.length / Math.max(1, detail.best)) * 100)}%` }} aria-hidden="true" />
                  <span className="streak-len tnum">{s.length}d</span>
                  <span className="streak-range">
                    {prettyDate(s.start)}{s.end !== s.start ? ` → ${prettyDate(s.end)}` : ''}
                  </span>
                  {s.current && <span className="streak-now">current</span>}
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        {/* ---------- Weekday pattern ---------- */}
        <SectionCard className="pad" delay={0.08}>
          <CardHead title="By weekday">
            <span className="tiny muted"><IconCalendar size={13} /> last 12 weeks</span>
          </CardHead>
          {weekdayRows.length === 0 ? (
            <p className="empty-note">
              Not enough data yet — a weekday needs at least a few scheduled days before it means anything.
            </p>
          ) : (
            <HBarList rows={weekdayRows} max={100} unit="%" />
          )}
        </SectionCard>

        {/* ---------- Time of day ---------- */}
        {detail.times && (
          <SectionCard className="pad" delay={0.1}>
            <CardHead title="When you log it">
              <span className="tiny muted"><IconClock size={13} /> {detail.times.total} logged completions</span>
            </CardHead>
            <HBarList
              rows={detail.times.parts.map((p) => ({ label: p.label, value: p.count }))}
              max={Math.max(...detail.times.parts.map((p) => p.count))}
            />
          </SectionCard>
        )}

        {/* ---------- Notes ---------- */}
        {detail.notes.length > 0 && (
          <SectionCard className="pad" delay={0.12}>
            <CardHead title="Notes" />
            <div className="stack" style={{ gap: 10 }}>
              {detail.notes.map((n) => (
                <div key={n.date} className="habit-note">
                  <span className="habit-note-date">{prettyDate(n.date)}</span>
                  <p>{n.note}</p>
                </div>
              ))}
            </div>
          </SectionCard>
        )}

        {/* ---------- Links (goals · projects · routines) ---------- */}
        {(linkedGoals.length > 0 || detail.linkedProjects.length > 0 || detail.routines.length > 0) && (
          <SectionCard className="pad" delay={0.14}>
            <CardHead title="Connected to">
              <span className="tiny muted"><IconLayers size={13} /> goals, projects &amp; routines that use this habit</span>
            </CardHead>
            <div className="stack" style={{ gap: 12 }}>
              {linkedGoals.length > 0 && (
                <div>
                  <p className="eyebrow" style={{ marginBottom: 6 }}>Goals this habit feeds</p>
                  <div className="wrap-gap">
                    {linkedGoals.map((g) => (
                      <Link key={g.id} to={`goals/${g.id}`} className="btn sm"><IconTarget size={14} /> {g.title}</Link>
                    ))}
                  </div>
                </div>
              )}
              {(detail.linkedProjects.length > 0 || detail.routines.length > 0) && (
                <div>
                  <p className="eyebrow" style={{ marginBottom: 6 }}>Projects &amp; routines</p>
                  <div className="wrap-gap">
                    {detail.linkedProjects.map((p) => (
                      <Link key={p.id} to={`projects/${p.id}`} className="btn sm">{p.name}</Link>
                    ))}
                    {detail.routines.map((r) => (
                      <span key={r.id} className="chip">{r.name}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </SectionCard>
        )}
      </div>
    </div>
  )
}

