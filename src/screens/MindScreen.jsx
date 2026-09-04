import { useMemo, useState } from 'react'
import { useStore } from '../store.jsx'
import SectionCard, { CardHead } from '../components/ui/SectionCard.jsx'
import EmptyState from '../components/ui/EmptyState.jsx'
import { todayStr, subDaysStr, prettyDate, weekdayInitial } from '../lib/dates.js'
import { MOODS, moodOf, moodStats, moodHabitLink } from '../lib/stats.js'
import { IconMind, IconNote } from '../lib/icons.jsx'

export default function MindScreen() {
  const { state, dispatch } = useStore()
  const today = todayStr()
  const current = moodOf(state, today)
  const [note, setNote] = useState(current?.note || '')
  const [saved, setSaved] = useState(false)

  const stats = useMemo(() => moodStats(state, 30), [state])
  const link = useMemo(() => moodHabitLink(state, 30), [state])

  const pick = (score) => {
    dispatch({ type: 'SET_MOOD', date: today, patch: { score, note: note.trim() || undefined } })
    setSaved(true)
    setTimeout(() => setSaved(false), 1600)
  }

  const saveNote = () => {
    if (!current?.score) return
    dispatch({ type: 'SET_MOOD', date: today, patch: { note: note.trim() || undefined } })
    setSaved(true)
    setTimeout(() => setSaved(false), 1600)
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
          <div style={{ display: 'flex', gap: 8 }}>
            {MOODS.map((m) => (
              <button
                key={m.score}
                className="mood-btn"
                aria-pressed={current?.score === m.score}
                style={{ '--mood-c': m.color }}
                onClick={() => pick(m.score)}
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
              {saved && <p style={{ color: 'var(--good)', fontSize: 'var(--fs-xs)', marginTop: 8 }} role="status">Saved.</p>}
            </div>
          )}
          {!current?.score && (
            <p style={{ color: 'var(--text-3)', fontSize: 'var(--fs-xs)', marginTop: 14 }}>
              Pick a mood to unlock the note field. You can change it any time today.
            </p>
          )}
        </SectionCard>

        {/* history */}
        <SectionCard className="pad">
          <CardHead title="Last 30 days" />
          {!hasHistory ? (
            <EmptyState icon={<IconMind size={40} />} title="No moods logged yet">
              Check in for a few days and your mood history will appear here.
            </EmptyState>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
                <div>
                  <p className="eyebrow">Average mood</p>
                  <p className="stat-value tnum" style={{ marginTop: 2 }}>{stats.avg}<span style={{ fontSize: '0.9rem', color: 'var(--text-2)' }}> / 5</span></p>
                </div>
                <div>
                  <p className="eyebrow">Logged</p>
                  <p className="stat-value tnum" style={{ marginTop: 2 }}>{stats.count} <span style={{ fontSize: '0.9rem', color: 'var(--text-2)' }}>days</span></p>
                </div>
              </div>
              <div
                style={{ display: 'grid', gridTemplateColumns: 'repeat(30, minmax(0, 1fr))', gap: 3 }}
                role="img"
                aria-label={`Mood history: ${stats.count} of the last 30 days logged, average ${stats.avg} out of 5`}
              >
                {strip.map((s) => {
                  const m = MOODS.find((x) => x.score === s.mood?.score)
                  return (
                    <span
                      key={s.date}
                      title={`${prettyDate(s.date)}${m ? ` — ${m.label}` : ' — no entry'}${s.mood?.note ? `: ${s.mood.note}` : ''}`}
                      style={{
                        aspectRatio: '1', borderRadius: 4,
                        background: m ? m.color : 'var(--track)',
                        opacity: m ? 0.9 : 1,
                      }}
                    />
                  )
                })}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-3)', fontSize: '0.625rem', marginTop: 6 }}>
                <span>30 days ago</span>
                <span>today</span>
              </div>
            </>
          )}
        </SectionCard>

        {/* mood ↔ habits link */}
        {link && (
          <SectionCard className="pad">
            <CardHead title="Mood and habits" />
            <p style={{ color: 'var(--text-2)', fontSize: 'var(--fs-sm)' }}>
              On good-mood days you completed <b className="tnum">{link.goodPct}%</b> of your habits; on low days, <b className="tnum">{link.lowPct}%</b>.
            </p>
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
