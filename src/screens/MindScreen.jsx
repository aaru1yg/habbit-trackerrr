/* ============================================================
   MIND (§24, §25) — mood + energy/focus/motivation + reflection.
   Nothing clinical, nothing invented: charts only render when
   real entries exist, and correlations are stated as association.
   ============================================================ */
import { useMemo, useState } from 'react'
import { useStore } from '../store.jsx'
import SectionCard, { CardHead } from '../components/ui/SectionCard.jsx'
import EmptyState from '../components/ui/EmptyState.jsx'
import { LineSeries } from '../components/charts/workCharts.jsx'
import { todayStr, subDaysStr, prettyDate } from '../lib/dates.js'
import { MOODS, moodOf, moodStats, moodHabitLink } from '../lib/stats.js'
import { mindSeries, moodCorrelations } from '../lib/analytics.js'
import { IconMind, IconNote, IconSparkle, IconTarget, IconFlame } from '../lib/icons.jsx'

const DIMS = [
  { id: 'energy', label: 'Energy', Icon: IconSparkle, low: 'Running empty', high: 'Charged' },
  { id: 'focus', label: 'Focus', Icon: IconTarget, low: 'Scattered', high: 'Locked in' },
  { id: 'motivation', label: 'Motivation', Icon: IconFlame, low: 'Flat', high: 'Driven' },
]
const LEVELS = [1, 2, 3, 4, 5]
const DIM_LABEL = { score: 'Mood', energy: 'Energy', focus: 'Focus', motivation: 'Motivation' }

export default function MindScreen() {
  const { state, dispatch } = useStore()
  const today = todayStr()
  const current = moodOf(state, today)
  const [note, setNote] = useState(current?.note || '')
  const [wentWell, setWentWell] = useState(current?.wentWell || '')
  const [difficult, setDifficult] = useState(current?.difficult || '')
  const [reflectOpen, setReflectOpen] = useState(false)
  const [saved, setSaved] = useState(false)

  const stats = useMemo(() => moodStats(state, 30), [state])
  const series = useMemo(() => mindSeries(state, 30), [state])
  const link = useMemo(() => moodHabitLink(state, 30), [state])
  const corr = useMemo(() => moodCorrelations(state, 60), [state])

  const flash = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 1600)
  }

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

  // 30-day strip
  const strip = useMemo(() => {
    const out = []
    for (let i = 29; i >= 0; i--) {
      const d = subDaysStr(today, i)
      out.push({ date: d, mood: moodOf(state, d) })
    }
    return out
  }, [state, today])

  const hasHistory = stats.count > 0
  const hasDims = series.rows.some((r) => r.energy != null || r.focus != null || r.motivation != null)
  const reflections = useMemo(
    () => Object.entries(state.moods || {})
      .filter(([, m]) => m && (m.wentWell || m.difficult))
      .sort((a, b) => b[0].localeCompare(a[0]))
      .slice(0, 6),
    [state]
  )

  return (
    <div className="screen" id="mind-screen">
      <header className="screen-head">
        <div>
          <h1 className="screen-title">Mind</h1>
          <p className="screen-sub">A quick daily check-in. Nothing clinical — just a pulse on how you&rsquo;re doing.</p>
        </div>
      </header>

      <div className="stack">
        {/* today's mood */}
        <SectionCard className="pad-lg">
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
            <div style={{ marginTop: 16 }}>
              <label className="field-label" htmlFor="mood-note">A line about today <span style={{ color: 'var(--text-3)', fontWeight: 500 }}>(optional)</span></label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  id="mood-note"
                  className="field"
                  maxLength={500}
                  placeholder="Woke up early, focused morning…"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && saveNote()}
                />
                <button className="btn" onClick={saveNote} disabled={!note.trim()}>Save</button>
              </div>
            </div>
          )}
          {!current?.score && (
            <p style={{ color: 'var(--text-3)', fontSize: 'var(--fs-xs)', marginTop: 14 }}>
              Pick a mood to unlock the note field. You can change it any time today.
            </p>
          )}
          {saved && <p style={{ color: 'var(--good)', fontSize: 'var(--fs-xs)', marginTop: 10 }} role="status">Saved.</p>}
        </SectionCard>

        {/* energy / focus / motivation (§24) */}
        <SectionCard className="pad">
          <CardHead title="Today&rsquo;s capacity" />
          <div className="stack" style={{ gap: 14 }}>
            {DIMS.map(({ id, label, Icon, low, high }) => {
              const value = current?.[id]
              return (
                <div key={id}>
                  <div className="row-between" style={{ marginBottom: 7 }}>
                    <span className="dim-label"><Icon size={15} /> {label}</span>
                    <span className="tiny muted">{value == null ? 'Not logged' : value <= 2 ? low : value >= 4 ? high : 'Steady'}</span>
                  </div>
                  <div className="level-row" role="group" aria-label={`${label} level, 1 low to 5 high`}>
                    {LEVELS.map((n) => (
                      <button
                        key={n}
                        type="button"
                        className="level-btn"
                        data-on={value === n ? 'true' : 'false'}
                        aria-pressed={value === n}
                        aria-label={`${label} ${n} of 5`}
                        onClick={() => setDim(id, n)}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
          <p className="tiny muted" style={{ marginTop: 14 }}>
            Optional. Logging capacity alongside habits is what lets the patterns below exist at all.
          </p>
        </SectionCard>

        {/* reflection (§25) */}
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
                <p className="tiny muted" style={{ margin: 0 }}>Reflections land in your Record timeline.</p>
                <button className="btn primary sm" onClick={saveReflection} disabled={!wentWell.trim() && !difficult.trim()}>Save reflection</button>
              </div>
            </div>
          ) : reflections.length ? (
            <div className="stack" style={{ gap: 10 }}>
              {reflections.map(([date, m]) => (
                <div key={date} className="corr-row">
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

        {/* trend */}
        {hasHistory && (
          <SectionCard className="pad">
            <CardHead title="Last 30 days">
              <span className="tiny muted tnum">{series.entries} logged</span>
            </CardHead>
            <div className="stat-trio" style={{ marginBottom: 16, gridTemplateColumns: `repeat(${hasDims ? 4 : 1}, minmax(0,1fr))` }}>
              <div><p className="eyebrow">Mood</p><p className="stat-num tnum">{series.averages.score ?? '—'}</p><p className="tiny muted">avg / 5</p></div>
              {hasDims && <div><p className="eyebrow">Energy</p><p className="stat-num tnum">{series.averages.energy ?? '—'}</p><p className="tiny muted">avg / 5</p></div>}
              {hasDims && <div><p className="eyebrow">Focus</p><p className="stat-num tnum">{series.averages.focus ?? '—'}</p><p className="tiny muted">avg / 5</p></div>}
              {hasDims && <div><p className="eyebrow">Drive</p><p className="stat-num tnum">{series.averages.motivation ?? '—'}</p><p className="tiny muted">avg / 5</p></div>}
            </div>
            <LineSeries
              series={[
                { id: 'score', label: 'Mood', color: 'var(--accent-2)', points: series.rows.map((r) => ({ date: r.date, value: r.score })) },
                ...(hasDims ? [
                  { id: 'energy', label: 'Energy', color: 'var(--good)', points: series.rows.map((r) => ({ date: r.date, value: r.energy })) },
                  { id: 'focus', label: 'Focus', color: 'var(--accent-1)', points: series.rows.map((r) => ({ date: r.date, value: r.focus })) },
                  { id: 'motivation', label: 'Motivation', color: 'var(--warn)', points: series.rows.map((r) => ({ date: r.date, value: r.motivation })) },
                ] : []),
              ]}
              domain={[0, 5]}
              unit=""
              height={190}
              showPoints={false}
              xCount={4}
              ariaLabel="Mood, energy, focus and motivation over the last 30 days"
            />
            <div className="mood-strip" role="img"
              aria-label={`Mood history: ${stats.count} of the last 30 days logged, average ${stats.avg} out of 5`}>
              {strip.map((s) => {
                const m = MOODS.find((x) => x.score === s.mood?.score)
                return (
                  <span
                    key={s.date}
                    title={`${prettyDate(s.date)}${m ? ` — ${m.label}` : ' — no entry'}${s.mood?.note ? `: ${s.mood.note}` : ''}`}
                    style={{ background: m ? m.color : 'var(--track)', opacity: m ? 0.9 : 1 }}
                  />
                )
              })}
            </div>
            <div className="row-between" style={{ color: 'var(--text-3)', fontSize: '0.625rem', marginTop: 6 }}>
              <span>30 days ago</span>
              <span>today</span>
            </div>
          </SectionCard>
        )}

        {!hasHistory && (
          <SectionCard>
            <EmptyState icon={<IconMind size={40} />} title="No moods logged yet">
              Check in for a few days and your mood history will appear here.
            </EmptyState>
          </SectionCard>
        )}

        {/* capacity ↔ habits (association only) */}
        {(corr.enough || link) && (
          <SectionCard className="pad">
            <CardHead title="How capacity lines up with habits" />
            <div className="stack" style={{ gap: 10 }}>
              {link && (
                <p className="corr-text">
                  On good-mood days you completed <b className="tnum">{link.goodPct}%</b> of your habits; on low days,{' '}
                  <b className="tnum">{link.lowPct}%</b>.
                </p>
              )}
              {corr.rows.map((r) => (
                <p key={r.dim} className="corr-text">
                  <span className="dim-label" style={{ marginRight: 6 }}>
                    {r.dim === 'energy' ? <IconSparkle size={14} /> : r.dim === 'focus' ? <IconTarget size={14} /> : <IconFlame size={14} />}
                    {DIM_LABEL[r.dim] || r.dim}
                  </span>
                  high days <b className="tnum">{r.highPct}%</b> vs low days <b className="tnum">{r.lowPct}%</b>{' '}
                  <span className={r.delta >= 0 ? 'corr-up' : 'corr-down'}>({r.delta >= 0 ? '+' : ''}{r.delta} points)</span>.
                </p>
              ))}
              <p className="tiny muted">
                <IconSparkle size={13} /> These travel together in your own log. That is an association, not a cause.
              </p>
            </div>
          </SectionCard>
        )}

        {/* recent notes */}
        {stats.entries.some((e) => e.note) && (
          <SectionCard className="pad">
            <CardHead title="Recent notes" />
            <div className="stack" style={{ gap: 10 }}>
              {[...stats.entries].reverse().filter((e) => e.note).slice(0, 7).map((e) => (
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
      </div>
    </div>
  )
}

/* Simple, friendly SVG faces — color follows the mood. */
function MoodFace({ score, active }) {
  const color = MOODS.find((m) => m.score === score)?.color
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true" style={{ opacity: active ? 1 : 0.75 }}>
      <circle cx="13" cy="13" r="11" fill={active ? color : 'transparent'} stroke={color} strokeWidth="1.6" />
      <circle cx="9.4" cy="10.6" r="1.3" fill={active ? '#0b0f1a' : color} />
      <circle cx="16.6" cy="10.6" r="1.3" fill={active ? '#0b0f1a' : color} />
      {score >= 4 && <path d="M8.6 15.2q4.4 4 8.8 0" stroke={active ? '#0b0f1a' : color} strokeWidth="1.8" fill="none" strokeLinecap="round" />}
      {score === 3 && <path d="M8.8 16.4h8.4" stroke={active ? '#0b0f1a' : color} strokeWidth="1.8" strokeLinecap="round" />}
      {score <= 2 && <path d="M8.6 17.6q4.4 -4 8.8 0" stroke={active ? '#0b0f1a' : color} strokeWidth="1.8" fill="none" strokeLinecap="round" />}
    </svg>
  )
}
