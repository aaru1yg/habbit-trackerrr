import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts'
import { useStore, todayStr, buildMonthDays, buildMonthWeeks, getMood, mindsetScore, weekMindset, MONTHS, WEEK_COLORS } from '../store.jsx'
import { pctColor } from './MonthCalendar.jsx'

const SCALE = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

function Dial({ label, value, color, onChange }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--muted)', marginBottom: 6 }}>
        <span style={{ fontWeight: 700, color: 'var(--text)' }}>{label}</span>
        <span className="futuristic">{value ?? '—'}/10</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: 4 }}>
        {SCALE.map((n) => (
          <motion.button key={n} whileTap={{ scale: 0.85 }} onClick={() => onChange(n)}
            style={{
              height: 30, borderRadius: 8, border: '1px solid var(--border)', fontSize: '0.72rem', fontWeight: 700,
              background: value != null && n <= value ? color : 'rgba(255,255,255,0.04)', color: value != null && n <= value ? '#0a0a12' : 'var(--muted)',
              transition: 'background 0.2s', boxShadow: value === n ? `0 0 12px ${color}` : 'none',
            }}>{n}</motion.button>
        ))}
      </div>
    </div>
  )
}

export default function MentalState() {
  const { state, dispatch } = useStore()
  const today = todayStr()
  const now = new Date()
  const [ym] = useState({ y: now.getFullYear(), m: now.getMonth() })
  const days = useMemo(() => buildMonthDays(ym.y, ym.m), [ym])
  const weeks = useMemo(() => buildMonthWeeks(days), [days])
  const entry = getMood(state, today)
  const todayScore = mindsetScore(entry)

  const set = (k, v) => dispatch({ type: 'SET_MOOD', date: today, patch: { [k]: v } })

  const chart = days.filter((d) => d.date <= today).map((d) => {
    const e = getMood(state, d.date)
    return { day: d.day, label: `${d.day}`, Mood: e.mood != null ? e.mood * 10 : null, Motivation: e.motivation != null ? e.motivation * 10 : null }
  })
  const hasData = chart.some((c) => c.Mood != null || c.Motivation != null)
  const weekScores = weeks.map((w) => ({ ...w, score: weekMindset(state, w) }))

  return (
    <motion.div className="glass" initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }} style={{ padding: 22, marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 style={{ fontSize: '1.3rem' }}>Mental State 🧠</h2>
          <span style={{ color: 'var(--muted)', fontSize: '0.82rem' }}>Log mood & motivation (1–10) each day · {MONTHS[ym.m]} {ym.y}</span>
        </div>
        <span className="chip" style={{ color: 'var(--text)' }}>
          <span className="dot" style={{ background: todayScore != null ? pctColor(todayScore) : 'var(--muted)' }} />
          Today's score {todayScore != null ? `${todayScore}%` : '—'}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 18, marginTop: 16 }}>
        <Dial label="Mood" value={entry.mood} color="#38bdf8" onChange={(v) => set('mood', v)} />
        <Dial label="Motivation" value={entry.motivation} color="#a78bfa" onChange={(v) => set('motivation', v)} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(220px, 1fr)', gap: 18, marginTop: 20 }} className="duo">
        <div style={{ height: 220 }}>
          {hasData ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chart} margin={{ top: 10, right: 10, bottom: 0, left: -18 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: '#98a2c8', fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis domain={[0, 100]} ticks={[25, 50, 75, 100]} tick={{ fill: '#98a2c8', fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} />
                <Tooltip contentStyle={{ background: 'rgba(16,20,40,0.95)', border: '1px solid var(--border-strong)', borderRadius: 12, fontSize: '0.8rem' }}
                  labelFormatter={(l) => `${MONTHS[ym.m].slice(0, 3)} ${l}`} formatter={(v) => [`${v}%`]} />
                <Legend wrapperStyle={{ fontSize: '0.74rem' }} />
                <Line type="monotone" dataKey="Mood" stroke="#38bdf8" strokeWidth={2.5} dot={false} connectNulls animationDuration={1400} style={{ filter: 'drop-shadow(0 0 5px #38bdf8)' }} />
                <Line type="monotone" dataKey="Motivation" stroke="#a78bfa" strokeWidth={2.5} dot={false} connectNulls animationDuration={1400} style={{ filter: 'drop-shadow(0 0 5px #a78bfa)' }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: '100%', display: 'grid', placeItems: 'center', color: 'var(--muted)', fontSize: '0.84rem', border: '1px dashed var(--border)', borderRadius: 16, textAlign: 'center', padding: 16 }}>
              Pick a mood & motivation above — your line graph starts drawing from today. No fake history.
            </div>
          )}
        </div>

        <div>
          <div style={{ fontWeight: 700, fontSize: '0.86rem', marginBottom: 8 }}>Analysis · Mindset Score</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {weekScores.map((w, i) => (
              <div key={w.index} style={{ display: 'grid', gridTemplateColumns: '54px 1fr 56px', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: '0.74rem', color: 'var(--muted)' }}>{w.label}</span>
                <div style={{ height: 14, borderRadius: 4, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                  <motion.div initial={{ width: 0 }} animate={{ width: `${w.score}%` }} transition={{ duration: 1, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
                    style={{ height: '100%', background: w.score ? pctColor(w.score) : 'transparent', boxShadow: w.score ? `0 0 10px ${WEEK_COLORS[i % WEEK_COLORS.length]}66` : 'none' }} />
                </div>
                <span className="futuristic" style={{ fontSize: '0.72rem', textAlign: 'right' }}>{w.score.toFixed(2)}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  )
}
