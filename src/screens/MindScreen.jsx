/* ============================================================
   MIND — behavioral patterns (Step 7C).
   Daily check-in stays (mood + capacity + reflection) but the
   analytics below are rebuilt around pattern questions:

     1. How do my capacity tracks move alongside my habits?
     2. When during the week / day do I do best?
     3. Which behaviors travel together?
     4. What evidence is there of an association?

   Rules:
     - All series use identity colors (--cat-*, --mind-cap-*).
       Semantic good/warn/bad ONLY on tone rails / deltas, never on
       neutral lines.
     - Correlations are association-only language.
     - Null gaps are real gaps; no smoothing.
     - enough / min-sample gates respected.
     - AnalyticsLab double-lazy boundary untouched.
   ============================================================ */
import { useId, useMemo, useState } from 'react'
import { useStore } from '../store.jsx'
import SectionCard, { CardHead } from '../components/ui/SectionCard.jsx'
import EmptyState from '../components/ui/EmptyState.jsx'
import { HBarList, CompareBars } from '../components/charts/workCharts.jsx'
import { todayStr, subDaysStr, prettyDate, shortDate } from '../lib/dates.js'
import { MOODS, moodOf, moodStats, moodHabitLink, eligibleOn, isDone, activeHabits } from '../lib/stats.js'
import {
  mindSeries, moodCorrelations, weekdayPerformance, weekdayVsWeekend,
  timeOfDayPerformance, habitCorrelations,
} from '../lib/analytics.js'
import { Link } from '../lib/router.jsx'
import {
  IconMind, IconNote, IconSparkle, IconTarget, IconFlame,
  IconChevronRight, IconClock, IconRecord, IconCalendar,
} from '../lib/icons.jsx'
import '../styles/insights.css'

const DIMS = [
  /* Identity palette for capacity dimensions — neutral, NOT semantic.
     These are identity colors (color = what), not state tones. */
  { id: 'score',      label: 'Mood',       Icon: IconMind,    low: 'Tough day',  high: 'Great day', color: 'var(--mind-cap-score)' },
  { id: 'energy',     label: 'Energy',     Icon: IconSparkle, low: 'Drained',    high: 'Charged',   color: 'var(--mind-cap-energy)' },
  { id: 'focus',      label: 'Focus',      Icon: IconTarget,  low: 'Scattered',  high: 'Locked in', color: 'var(--mind-cap-focus)' },
  { id: 'motivation', label: 'Motivation', Icon: IconFlame,   low: 'Flat',       high: 'Driven',    color: 'var(--mind-cap-motivation)' },
]
const LEVELS = [1, 2, 3, 4, 5]
const RANGES = [
  { id: '14d', label: '14D', days: 14 },
  { id: '30d', label: '30D', days: 30 },
  { id: '60d', label: '60D', days: 60 },
]
const PART_LABEL = { morning: 'Morning', afternoon: 'Afternoon', evening: 'Evening', night: 'Night' }

export default function MindScreen() {
  const { state, dispatch } = useStore()
  const today = todayStr()
  const current = moodOf(state, today)
  const [note, setNote] = useState(current?.note || '')
  const [wentWell, setWentWell] = useState(current?.wentWell || '')
  const [difficult, setDifficult] = useState(current?.difficult || '')
  const [reflectOpen, setReflectOpen] = useState(false)
  const [saved, setSaved] = useState(false)
  const [rangeDays, setRangeDays] = useState(30)
  const [primaryDim, setPrimaryDim] = useState('score')

  const flash = () => { setSaved(true); setTimeout(() => setSaved(false), 1600) }

  const setDim = (key, value) => {
    const next = { ...current }
    if (next[key] === value) delete next[key]
    else next[key] = value
    const patch = { ...next }
    if (note.trim()) patch.note = note.trim()
    if (wentWell.trim()) patch.wentWell = wentWell.trim()
    if (difficult.trim()) patch.difficult = difficult.trim()
    dispatch({ type: 'SET_MOOD', date: today, patch: Object.keys(patch).length ? patch : null })
    flash()
  }
  const saveNote = () => {
    dispatch({ type: 'SET_MOOD', date: today, patch: { ...(current || {}), note: note.trim() || undefined } })
    flash()
  }
  const saveReflection = () => {
    const patch = {
      ...(current || {}),
      wentWell: wentWell.trim() || undefined,
      difficult: difficult.trim() || undefined,
    }
    dispatch({ type: 'SET_MOOD', date: today, patch: Object.keys(patch).length ? patch : null })
    flash()
  }

  const stats = useMemo(() => moodStats(state, rangeDays), [state, rangeDays])
  const series = useMemo(() => mindSeries(state, rangeDays), [state, rangeDays])
  const link = useMemo(() => moodHabitLink(state, rangeDays), [state, rangeDays])
  const corr = useMemo(() => moodCorrelations(state, Math.min(60, rangeDays * 2)), [state, rangeDays])
  const wd = useMemo(() => weekdayPerformance(state, Math.max(4, Math.round(rangeDays / 7))), [state, rangeDays])
  const wdVsWe = useMemo(() => weekdayVsWeekend(state, Math.max(4, Math.round(rangeDays / 7))), [state, rangeDays])
  const tod = useMemo(() => timeOfDayPerformance(state, rangeDays), [state, rangeDays])
  const habCorr = useMemo(() => habitCorrelations(state, Math.min(60, rangeDays * 2), 3), [state, rangeDays])

  // Top 3 active habits (by recent eligible count) for primary overlay.
  const topHabits = useMemo(() => {
    const habits = activeHabits(state)
    const scored = habits.map((h) => {
      let d = 0; let done = 0
      for (let i = rangeDays - 1; i >= 0; i--) {
        const day = subDaysStr(today, i)
        if (eligibleOn(h, day)) { d++; if (isDone(state, h.id, day)) done++ }
      }
      return { h, days: d, done, rate: d ? done / d : 0 }
    }).filter((x) => x.days >= 6).sort((a, b) => b.days - a.days).slice(0, 3).map((x) => x.h)
    return scored
  }, [state, rangeDays, today])

  const hasHistory = stats.count > 0
  const reflections = useMemo(
    () => Object.entries(state.moods || {})
      .filter(([, m]) => m && (m.wentWell || m.difficult))
      .sort((a, b) => b[0].localeCompare(a[0]))
      .slice(0, 6),
    [state],
  )

  const primaryDimDef = DIMS.find((d) => d.id === primaryDim) || DIMS[0]

  return (
    <div className="screen" id="mind-screen">
      <header className="screen-head">
        <div>
          <p className="insights-eyebrow"><IconMind size={11} /> Mind</p>
          <h1 className="screen-title">Behavioral patterns</h1>
          <p className="screen-sub">
            When you perform best, what moves together, and what the rhythms are — derived from your own check-ins.
            Every pattern below is an association, not a cause.
          </p>
        </div>
      </header>

      <div className="stack">
        {/* =========================================================
            TODAY CHECK-IN (kept from prior Mind; restyled for 7C).
            Compact two-column on wide screens; stacked on mobile.
           ========================================================= */}
        <SectionCard className="pad-lg mind-checkin">
          <div className="mind-checkin-grid">
            <div>
              <CardHead title="How are you feeling today?" />
              <div className="mood-row">
                {MOODS.map((m) => (
                  <button
                    key={m.score}
                    className="mood-btn"
                    aria-pressed={current?.score === m.score}
                    style={{ '--mood-c': m.color }}
                    onClick={() => setDim('score', m.score)}
                  >
                    <MoodFace score={m.score} active={current?.score === m.score} />
                    {m.label}
                  </button>
                ))}
              </div>
              {current?.score && (
                <div className="mind-note-row">
                  <label className="field-label" htmlFor="mood-note">A line about today <span className="muted">(optional)</span></label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input id="mood-note" className="field" maxLength={500}
                      placeholder="Woke up early, focused morning…"
                      value={note} onChange={(e) => setNote(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && saveNote()} />
                    <button className="btn" onClick={saveNote} disabled={!note.trim()}>Save</button>
                  </div>
                </div>
              )}
              {!current?.score && (
                <p className="tiny muted" style={{ marginTop: 12 }}>
                  Pick a mood to unlock the note field. You can change it any time today.
                </p>
              )}
            </div>

            <div>
              <CardHead title="Today&rsquo;s capacity" />
              <div className="stack" style={{ gap: 10 }}>
                {DIMS.slice(1).map(({ id, label, Icon, low, high }) => {
                  const value = current?.[id]
                  return (
                    <div key={id} className="mind-dim">
                      <div className="row-between" style={{ marginBottom: 6 }}>
                        <span className="dim-label"><Icon size={14} /> {label}</span>
                        <span className="tiny muted">{value == null ? 'Not logged' : value <= 2 ? low : value >= 4 ? high : 'Steady'}</span>
                      </div>
                      <div className="level-row" role="group" aria-label={`${label} level, 1 low to 5 high`}>
                        {LEVELS.map((n) => (
                          <button key={n} type="button" className="level-btn"
                            data-on={value === n ? 'true' : 'false'}
                            aria-pressed={value === n} aria-label={`${label} ${n} of 5`}
                            onClick={() => setDim(id, n)}>{n}</button>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
              <p className="tiny muted" style={{ marginTop: 10 }}>
                Logging capacity is what lets the patterns below exist.
              </p>
            </div>
          </div>
          {saved && <p style={{ color: 'var(--good)', fontSize: 'var(--fs-xs)', marginTop: 10 }} role="status">Saved.</p>}
        </SectionCard>

        {/* =========================================================
            PRIMARY VISUAL — capacity & habits, over time.
            Answers: How does my capacity move alongside completion?
            Identity colors for every line; no semantic tones on series.
           ========================================================= */}
        {hasHistory ? (
          <SectionCard className="pad mind-pattern-card">
            <CardHead
              title="Capacity &amp; habits over time"
              subtitle="Completion is the bold line; your chosen capacity track is overlaid in its own identity color. Null days stay gaps."
            >
              <div className="ins-range" role="group" aria-label="Trend range">
                {RANGES.map((r) => (
                  <button key={r.id} type="button" className="seg"
                    aria-pressed={rangeDays === r.days}
                    onClick={() => setRangeDays(r.days)}>{r.label}</button>
                ))}
              </div>
            </CardHead>

            <div className="mind-dim-toggle" role="group" aria-label="Capacity dimension to overlay">
              {DIMS.map((d) => (
                <button key={d.id} type="button" className="mind-dim-chip"
                  aria-pressed={primaryDim === d.id}
                  onClick={() => setPrimaryDim(d.id)}
                  style={{ '--chip-c': d.color }}>
                  <i /><d.Icon size={13} />{d.label}
                </button>
              ))}
            </div>

            <CapacityTrend
              rows={series.rows}
              topHabits={topHabits}
              state={state}
              primaryDim={primaryDim}
              primaryColor={primaryDimDef.color}
              primaryLabel={primaryDimDef.label}
              rangeDays={rangeDays}
            />

            <p className="tiny muted mind-trust">
              Association only — these lines show when things travel together in your log, not what causes what.
            </p>
          </SectionCard>
        ) : (
          <SectionCard>
            <EmptyState icon={<IconMind size={40} />} title="No moods logged yet">
              Check in for a few days and your behavioral patterns will appear here.
            </EmptyState>
          </SectionCard>
        )}

        {/* =========================================================
            SECONDARY VISUALS — each answers ONE question.
              a) When during the week?  (weekday bars)
              b) When during the day?   (time-of-day bars)
              c) High vs low capacity  (compare bars)
              d) Pairs that move together
           ========================================================= */}
        {hasHistory && (
          <div className="mind-grid">
            {/* Rhythm: weekday */}
            <SectionCard className="pad">
              <CardHead title="Weekly rhythm" subtitle="Completion by weekday" Icon={IconCalendar} />
              {wd.enough ? (
                <>
                  <HBarList
                    rows={wd.rows.map((r) => ({
                      label: r.name,
                      value: r.rate != null ? Math.round(r.rate * 100) : null,
                      sub: r.rate == null ? 'not enough' : `${r.samples} wk`,
                      color: (r.weekday === 0 || r.weekday === 6)
                        ? 'var(--accent-soft-stroke, var(--text-3))'
                        : 'var(--accent-2)',
                      tone: r.rate != null && wd.best && r.weekday === wd.best.weekday ? 'good' : undefined,
                    }))}
                    unit="%"
                  />
                  {wdVsWe && (
                    <p className="tiny muted" style={{ marginTop: 12 }}>
                      Weekdays <b className="tnum">{wdVsWe.weekdayPct}%</b> · Weekends <b className="tnum">{wdVsWe.weekendPct}%</b>
                      {' '}· {Math.abs(wdVsWe.delta) >= 5
                        ? `${wdVsWe.delta > 0 ? 'weekdays higher' : 'weekends higher'} by ${Math.abs(wdVsWe.delta)} pts`
                        : 'no meaningful gap'}
                      {' '}(association).
                    </p>
                  )}
                </>
              ) : (
                <p className="empty-note">Not enough weeks yet to show a weekday pattern.</p>
              )}
            </SectionCard>

            {/* Rhythm: time of day */}
            <SectionCard className="pad">
              <CardHead title="When in the day" subtitle="Where your check-ins cluster" Icon={IconClock} />
              {tod.enough ? (
                <>
                  <HBarList
                    rows={tod.parts.map((p) => ({
                      label: PART_LABEL[p.id] || p.label,
                      value: p.pct,
                      sub: `${p.count}`,
                      color: p.id === tod.peak ? 'var(--accent-2)' : 'var(--text-3)',
                    }))}
                    unit="%"
                  />
                  <p className="tiny muted" style={{ marginTop: 12 }}>
                    Peak: <b>{PART_LABEL[tod.peak]}</b> across {tod.total} timestamped completions.
                  </p>
                </>
              ) : (
                <p className="empty-note">Need at least 8 timestamped check-ins to show a daily rhythm.</p>
              )}
            </SectionCard>

            {/* Capacity ↔ habits split */}
            <SectionCard className="pad">
              <CardHead title="How capacity lines up with habits" Icon={IconSparkle} />
              {(link || corr.rows.length > 0) ? (
                <div className="stack" style={{ gap: 10 }}>
                  {link && (
                    <div className="mind-split">
                      <span className="mind-split-label"><IconMind size={13} /> Mood</span>
                      <CompareBars
                        a={{ label: 'Low days', value: link.lowPct, color: 'var(--text-3)' }}
                        b={{ label: 'Good days', value: link.goodPct, color: 'var(--mind-cap-score)' }}
                        unit="%"
                      />
                    </div>
                  )}
                  {corr.rows.map((r) => {
                    const dimDef = DIMS.find((d) => d.id === r.dim) || DIMS[1]
                    return (
                      <div key={r.dim} className="mind-split">
                        <span className="mind-split-label"><dimDef.Icon size={13} /> {dimDef.label}</span>
                        <CompareBars
                          a={{ label: 'Low', value: r.lowPct, color: 'var(--text-3)' }}
                          b={{ label: 'High', value: r.highPct, color: dimDef.color }}
                          unit="%"
                        />
                      </div>
                    )
                  })}
                  <p className="tiny muted">
                    These travel together in your log — association, not cause.
                  </p>
                </div>
              ) : (
                <p className="empty-note">Log capacity alongside a few days of habits and splits will appear here.</p>
              )}
            </SectionCard>

            {/* Pairs that travel together */}
            <SectionCard className="pad">
              <CardHead title="Pairs that travel together" subtitle="Habit co-occurrence" />
              {habCorr.enough ? (
                <div className="stack" style={{ gap: 10 }}>
                  {habCorr.pairs.map((p, i) => (
                    <div key={i} className="mind-pair">
                      <span className="mind-pair-labels">
                        <i style={{ background: `var(--cat-${p.a.category || 'mind'})` }} />
                        {p.a.name}
                        <span className="muted">·</span>
                        <i style={{ background: `var(--cat-${p.b.category || 'mind'})` }} />
                        {p.b.name}
                      </span>
                      <span className={`mind-pair-delta tnum ${p.delta >= 0 ? 'corr-up' : 'corr-down'}`}>
                        {p.delta >= 0 ? '+' : ''}{p.delta} pts
                      </span>
                    </div>
                  ))}
                  <p className="tiny muted">
                    When one is completed, the other is {habCorr.pairs[0].delta >= 0 ? 'more' : 'less'} likely to be — association only.
                  </p>
                </div>
              ) : (
                <p className="empty-note">No strong co-occurrence yet. Needs two habits with at least 8 overlapping scheduled days and a ≥15-point gap.</p>
              )}
            </SectionCard>
          </div>
        )}

        {/* =========================================================
            PATTERN INSIGHT OBJECTS — Signal/Evidence/Interpretation
           ========================================================= */}
        {hasHistory && (
          <SectionCard className="pad">
            <CardHead title="Pattern observations" />
            <div className="mind-insights">
              {buildInsights({ wd, wdVsWe, tod, link, corr, habCorr, topHabits }).map((ins, i) => (
                <article key={i} className={`mind-insight data-tone-${ins.tone || 'neutral'}`}>
                  <p className="mind-insight-signal">{ins.signal}</p>
                  <p className="mind-insight-evidence tnum">{ins.evidence}</p>
                  <p className="mind-insight-meaning">{ins.meaning}</p>
                  {ins.action && (
                    <Link to={ins.action.to} className="mind-insight-action">
                      {ins.action.label} <IconChevronRight size={12} />
                    </Link>
                  )}
                </article>
              ))}
              {buildInsights({ wd, wdVsWe, tod, link, corr, habCorr, topHabits }).length === 0 && (
                <p className="empty-note">Check in a few more days — patterns need some runway to show up.</p>
              )}
            </div>
          </SectionCard>
        )}

        {/* =========================================================
            REFLECTION + NOTES + CROSS-LINKS
           ========================================================= */}
        <SectionCard className="pad">
          <CardHead title="Reflection">
            <button className="btn ghost sm" onClick={() => setReflectOpen((o) => !o)} aria-expanded={reflectOpen}>
              {reflectOpen ? 'Close' : current?.wentWell || current?.difficult ? 'Edit today' : 'Write today'}
            </button>
          </CardHead>
          {reflectOpen ? (
            <div className="stack" style={{ gap: 12 }}>
              <div>
                <label className="field-label" htmlFor="went-well">What went well?</label>
                <textarea id="went-well" className="field" rows={2} maxLength={400} value={wentWell}
                  placeholder="Shipped the draft, walked after lunch…"
                  onChange={(e) => setWentWell(e.target.value)} />
              </div>
              <div>
                <label className="field-label" htmlFor="difficult">What got in the way?</label>
                <textarea id="difficult" className="field" rows={2} maxLength={400} value={difficult}
                  placeholder="Late meetings, phone in the room…"
                  onChange={(e) => setDifficult(e.target.value)} />
              </div>
              <div className="row-between">
                <p className="tiny muted" style={{ margin: 0 }}>Reflections live in your Record timeline.</p>
                <button className="btn primary sm" onClick={saveReflection} disabled={!wentWell.trim() && !difficult.trim()}>Save reflection</button>
              </div>
            </div>
          ) : reflections.length ? (
            <div className="stack" style={{ gap: 10 }}>
              {reflections.map(([date, m]) => (
                <div key={date} className="corr-row mind-refl">
                  <p className="tiny muted">{prettyDate(date)}</p>
                  {m.wentWell && <p className="corr-text"><b>Went well:</b> {m.wentWell}</p>}
                  {m.difficult && <p className="corr-text"><b>In the way:</b> {m.difficult}</p>}
                </div>
              ))}
            </div>
          ) : (
            <p className="empty-note">Two questions, thirty seconds. What went well, and what got in the way?</p>
          )}
        </SectionCard>

        {stats.entries.some((e) => e.note) && (
          <SectionCard className="pad">
            <CardHead title="Recent notes" Icon={IconNote} />
            <div className="stack" style={{ gap: 10 }}>
              {[...stats.entries].reverse().filter((e) => e.note).slice(0, 5).map((e) => (
                <div key={e.date} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <span style={{ color: 'var(--text-3)', marginTop: 2 }}><IconNote size={15} /></span>
                  <div>
                    <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-3)' }}>
                      {prettyDate(e.date)} · {MOODS.find((m) => m.score === e.score)?.label}
                    </p>
                    <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-2)' }}>{e.note}</p>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        )}

        {/* Cross-links to Record and Overview */}
        <div className="mind-foot">
          <Link to="insights?view=record" className="mind-foot-link">
            <IconRecord size={15} /> Open your Record timeline <IconChevronRight size={13} />
          </Link>
          <Link to="insights" className="mind-foot-link muted">
            Back to Insights overview
          </Link>
        </div>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------
   Build deterministic pattern-insight objects from existing
   engines. All use Signal / Evidence / Interpretation / (Action).
   Causal language is forbidden.
------------------------------------------------------------- */
function buildInsights({ wd, wdVsWe, tod, link, corr, habCorr, topHabits }) {
  const out = []
  if (wd?.enough && wd.best && wd.worst) {
    const gap = Math.round((wd.best.rate - wd.worst.rate) * 100)
    if (gap >= 15) {
      out.push({
        tone: wd.best.rate >= 0.7 ? 'good' : 'neutral',
        signal: `${wd.best.name}s are your strongest day`,
        evidence: `${Math.round(wd.best.rate * 100)}% vs ${Math.round(wd.worst.rate * 100)}% on ${wd.worst.name}s (${gap}pt gap)`,
        meaning: `Completion is consistently higher on ${wd.best.name}s — a rhythm you can lean on.`,
        action: wdVsWe && Math.abs(wdVsWe.delta) >= 5 ? { to: 'insights?view=mind', label: 'See weekly rhythm' } : null,
      })
    }
  }
  if (tod?.enough && tod.total >= 8) {
    const peakPart = tod.parts.find((p) => p.id === tod.peak)
    const peakPct = peakPart?.pct || 0
    if (peakPct >= 40) {
      out.push({
        tone: 'neutral',
        signal: `${PART_LABEL[tod.peak]} is when you most often check in`,
        evidence: `${peakPct}% of timestamped completions (${peakPart.count} of ${tod.total})`,
        meaning: `Your completions cluster in the ${PART_LABEL[tod.peak].toLowerCase()} — scheduling harder habits there may fit your existing rhythm.`,
      })
    }
  }
  if (link && Math.abs(link.goodPct - link.lowPct) >= 15) {
    const better = link.goodPct >= link.lowPct
    out.push({
      tone: better ? 'good' : 'warn',
      signal: better ? 'Habits track with higher-mood days' : 'Habits hold on lower-mood days too',
      evidence: `${link.goodPct}% on good-mood days vs ${link.lowPct}% on low days`,
      meaning: `Completion is ${better ? 'higher' : 'lower'} on days you log a better mood — an association, not a cause.`,
      action: topHabits[0] ? { to: `habit/${topHabits[0].id}`, label: `Check ${topHabits[0].name}` } : null,
    })
  }
  if (corr.rows.length) {
    const strongest = corr.rows.slice().sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))[0]
    const dimDef = DIMS.find((d) => d.id === strongest.dim)
    if (dimDef && Math.abs(strongest.delta) >= 15) {
      out.push({
        tone: strongest.delta >= 0 ? 'good' : 'warn',
        signal: `${dimDef.label} is the strongest capacity link`,
        evidence: `high ${dimDef.label.toLowerCase()} days ${strongest.highPct}% vs low ${strongest.lowPct}% (${strongest.delta >= 0 ? '+' : ''}${strongest.delta}pts)`,
        meaning: `Habits and ${dimDef.label.toLowerCase()} travel together in your log.`,
      })
    }
  }
  if (habCorr.enough && habCorr.pairs[0]) {
    const p = habCorr.pairs[0]
    out.push({
      tone: 'neutral',
      signal: `${p.a.name} and ${p.b.name} move together`,
      evidence: `${p.delta >= 0 ? '+' : ''}${p.delta}pts when one is done`,
      meaning: `Completing one is associated with ${p.delta >= 0 ? 'higher' : 'lower'} odds of the other — a pair worth noticing.`,
      action: { to: `habit/${p.a.id}`, label: `Open ${p.a.name}` },
    })
  }
  return out.slice(0, 4)
}

/* -------------------------------------------------------------
   Capacity + Habits multi-series SVG.
   Left axis = completion % (0–100), right axis = capacity (1–5).
   Aggregate completion = --accent-2 solid thick.
   Capacity dim = identity color, thinner.
   ≤3 top habits = each in its category color, thinnest, dashed.
   Null points break the path (no interpolation).
------------------------------------------------------------- */
function CapacityTrend({ rows, topHabits, state, primaryDim, primaryColor, primaryLabel, rangeDays }) {
  const gid = useId().replace(/:/g, '')
  const W = 780; const H = 260
  const L = 38; const R = 38; const T = 16; const B = 40
  const n = rows.length
  if (n < 2) return <p className="empty-note">Not enough data yet.</p>

  const x = (i) => L + (i / Math.max(1, n - 1)) * (W - L - R)
  const yPct = (v) => T + (1 - v / 100) * (H - T - B)
  const yCap = (v) => T + (1 - (v - 1) / 4) * (H - T - B)

  // Build completion values per row (aggregate across active habits).
  const aggRows = rows.map((r) => {
    let done = 0; let total = 0
    for (const h of topHabits.length ? topHabits : []) {
      if (eligibleOn(h, r.date)) {
        total++
        if (isDone(state, h.id, r.date)) done++
      }
    }
    if (!total) return null
    return Math.round((done / total) * 100)
  })
  // When no habits, fall back to completion in row (from mindSeries).
  const agg = aggRows.some((v) => v != null)
    ? aggRows
    : rows.map((r) => r.completion)

  const capVals = rows.map((r) => r[primaryDim])

  // Aggregate area path (solid)
  const aggPath = buildPath(agg, x, yPct, { breakAtNull: true })
  const aggArea = buildArea(agg, x, yPct, yPct(0), { breakAtNull: true })
  const capPath = buildPath(capVals, x, yCap, { breakAtNull: true })
  const habitPaths = topHabits.map((h) => {
    const pts = rows.map((r) => {
      if (!eligibleOn(h, r.date)) return null
      return isDone(state, h.id, r.date) ? 100 : 0
    })
    // Smear each habit to a 0/100 value; connect to itself over 3 days to show a trace.
    const smeared = smear(pts, 2)
    return {
      h,
      color: `var(--cat-${h.category || 'mind'})`,
      d: buildPath(smeared, x, yPct, { breakAtNull: true }),
    }
  })

  // Today index = last row (rows built from today-days-1 → today)
  const todayX = x(n - 1)

  // x-ticks: 5 evenly spaced.
  const tickIdx = []
  const tickCount = Math.min(5, n)
  for (let i = 0; i < tickCount; i++) {
    tickIdx.push(Math.round(i * (n - 1) / (tickCount - 1)))
  }

  // Compute aria label from real data.
  const aggAvg = avg(agg)
  const capAvg = avg(capVals)
  const ariaLabel = [
    `Behavioral trend over the last ${rangeDays} days.`,
    aggAvg != null ? `Average completion ${Math.round(aggAvg)} percent.` : '',
    capAvg != null ? `Average ${primaryLabel} ${capAvg.toFixed(1)} out of 5.` : '',
    topHabits.length ? `Overlaid habits: ${topHabits.map((h) => h.name).join(', ')}.` : '',
  ].filter(Boolean).join(' ')

  return (
    <div className="mind-chart">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={ariaLabel}>
        <defs>
          <linearGradient id={`mg-${gid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent-2)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--accent-2)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Y guides — completion % */}
        {[0, 50, 100].map((v) => (
          <g key={`p${v}`}>
            <line x1={L} x2={W - R} y1={yPct(v)} y2={yPct(v)} stroke="var(--grid)" strokeWidth="1" />
            <text x={L - 6} y={yPct(v) + 3} textAnchor="end" fontSize="10" fill="var(--text-3)" className="tnum">{v}</text>
          </g>
        ))}
        {/* Y guides right — capacity 1..5 (lighter) */}
        {[1, 3, 5].map((v) => (
          <g key={`c${v}`}>
            <line x1={L} x2={W - R} y1={yCap(v)} y2={yCap(v)} stroke="var(--grid)" strokeWidth="0.6" strokeDasharray="2 3" />
            <text x={W - R + 6} y={yCap(v) + 3} textAnchor="start" fontSize="10" fill="var(--text-3)" className="tnum">{v}</text>
          </g>
        ))}

        {/* Aggregate area + line */}
        {aggArea && <path d={aggArea} fill={`url(#mg-${gid})`} />}
        {aggPath && <path d={aggPath} fill="none" stroke="var(--accent-2)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />}

        {/* Capacity line */}
        {capPath && <path d={capPath} fill="none" stroke={primaryColor} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />}

        {/* Habit traces */}
        {habitPaths.map((hp) => (
          hp.d && <path key={hp.h.id} d={hp.d} fill="none" stroke={hp.color} strokeWidth="1.3" strokeDasharray="3 3" strokeLinecap="round" opacity="0.75" />
        ))}

        {/* Today marker */}
        <line x1={todayX} x2={todayX} y1={T} y2={H - B} stroke="var(--accent-1)" strokeWidth="1.2" strokeDasharray="2 3" />
        <polygon points={`${todayX - 4},${T - 1} ${todayX + 4},${T - 1} ${todayX},${T + 5}`} fill="var(--accent-1)" />
        <text x={todayX} y={T - 4} textAnchor="middle" fontSize="9" fill="var(--accent-1)" fontWeight="700">Today</text>

        {/* X ticks */}
        {tickIdx.map((i) => (
          <text key={i} x={x(i)} y={H - 16} textAnchor="middle" fontSize="10" fill="var(--text-3)" className="tnum">
            {shortDate(rows[i].date)}
          </text>
        ))}
        <text x={L - 6} y={H - 4} textAnchor="end" fontSize="9" fill="var(--text-3)">0%</text>
        <text x={W - R + 6} y={H - 4} textAnchor="start" fontSize="9" fill="var(--text-3)">1–5</text>
      </svg>

      <div className="ins-legend mind-legend">
        <span><i style={{ background: 'var(--accent-2)' }} />Completion</span>
        <span><i style={{ background: primaryColor }} />{primaryLabel} (1–5)</span>
        {habitPaths.map((hp) => (
          <span key={hp.h.id}><i style={{ background: hp.color }} />{hp.h.name}</span>
        ))}
      </div>
    </div>
  )
}

/* --- path helpers: break on null, no smoothing --- */
function buildPath(values, x, y, { breakAtNull = true } = {}) {
  let d = ''; let pen = false
  for (let i = 0; i < values.length; i++) {
    const v = values[i]
    if (v == null) { if (breakAtNull) pen = false; continue }
    d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)} `
    pen = true
  }
  return d.trim() || null
}
function buildArea(values, x, y, baseY, { breakAtNull = true } = {}) {
  // Build per-segment area paths (broken at nulls).
  const segs = []
  let cur = []
  for (let i = 0; i < values.length; i++) {
    const v = values[i]
    if (v == null) {
      if (cur.length) { segs.push(cur); cur = [] }
      if (!breakAtNull) cur.push(null)
      continue
    }
    cur.push({ i, v })
  }
  if (cur.length) segs.push(cur)
  let d = ''
  for (const seg of segs) {
    if (seg.length < 2) continue
    d += `M${x(seg[0].i).toFixed(1)},${baseY.toFixed(1)} `
    for (const p of seg) d += `L${x(p.i).toFixed(1)},${y(p.v).toFixed(1)} `
    d += `L${x(seg[seg.length - 1].i).toFixed(1)},${baseY.toFixed(1)} Z `
  }
  return d.trim() || null
}
function smear(values, window = 2) {
  // For a 0/100 habit series, produce a rolling % so the habit trace reads as a
  // short trend rather than a square wave. Nulls remain null.
  const out = new Array(values.length).fill(null)
  for (let i = 0; i < values.length; i++) {
    if (values[i] == null) continue
    let s = 0; let n = 0
    for (let k = -window; k <= window; k++) {
      const j = i + k
      if (j < 0 || j >= values.length) continue
      if (values[j] == null) continue
      s += values[j]; n++
    }
    out[i] = n ? Math.round(s / n) : null
  }
  return out
}
function avg(values) {
  const vs = values.filter((v) => v != null && Number.isFinite(v))
  return vs.length ? vs.reduce((a, b) => a + b, 0) / vs.length : null
}

/* Mood faces (unchanged from prior Mind; color follows each mood chip). */
function MoodFace({ score, active }) {
  const color = MOODS.find((m) => m.score === score)?.color
  return (
    <svg width="24" height="24" viewBox="0 0 26 26" aria-hidden="true" style={{ opacity: active ? 1 : 0.7 }}>
      <circle cx="13" cy="13" r="11" fill={active ? color : 'transparent'} stroke={color} strokeWidth="1.6" />
      <circle cx="9.4" cy="10.6" r="1.3" fill={active ? '#0b0f1a' : color} />
      <circle cx="16.6" cy="10.6" r="1.3" fill={active ? '#0b0f1a' : color} />
      {score >= 4 && <path d="M8.6 15.2q4.4 4 8.8 0" stroke={active ? '#0b0f1a' : color} strokeWidth="1.8" fill="none" strokeLinecap="round" />}
      {score === 3 && <path d="M8.8 16.4h8.4" stroke={active ? '#0b0f1a' : color} strokeWidth="1.8" strokeLinecap="round" />}
      {score <= 2 && <path d="M8.6 17.6q4.4 -4 8.8 0" stroke={active ? '#0b0f1a' : color} strokeWidth="1.8" fill="none" strokeLinecap="round" />}
    </svg>
  )
}
