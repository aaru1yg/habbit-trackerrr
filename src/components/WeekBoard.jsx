import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Cell, Tooltip } from 'recharts'
import { addDays, format, startOfWeek } from 'date-fns'
import { useStore, todayStr, dayStr, getHabitCheck, habitActiveOn, dayRollup } from '../store.jsx'

const DAY_COLORS = ['#7c5cff', '#3b82f6', '#22d3ee', '#34d399', '#fbbf24', '#f97316', '#ec4899']

function Donut({ pct, color, size = 88, stroke = 9, children }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={stroke} />
        <motion.circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - pct / 100) }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }} style={{ filter: pct > 0 ? `drop-shadow(0 0 6px ${color})` : 'none' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>{children}</div>
    </div>
  )
}

export default function WeekBoard({ onFire, onAdd }) {
  const { state, dispatch } = useStore()
  const today = todayStr()
  const [offset, setOffset] = useState(0)
  const weekStart = useMemo(() => addDays(startOfWeek(new Date(), { weekStartsOn: 0 }), offset * 7), [offset])
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const d = addDays(weekStart, i)
    return { date: dayStr(d), label: format(d, 'EEEE'), short: format(d, 'EEE'), num: format(d, 'dd.MM.yyyy') }
  }), [weekStart])

  const daily = state.habits.filter((h) => h.isDaily)
  const rollups = days.map((d) => dayRollup(state, d.date))
  const totalDone = rollups.reduce((a, r) => a + (r.total ? r.done : 0), 0)
  const totalPossible = rollups.reduce((a, r) => a + r.total, 0)
  const overall = totalPossible ? Math.round((totalDone / totalPossible) * 100) : 0
  const barData = days.map((d, i) => ({ day: d.short, done: rollups[i].done, total: rollups[i].total, fill: DAY_COLORS[i] }))
  const maxBar = Math.max(1, ...barData.map((b) => b.total))

  const toggle = (habit, date) => {
    if (!getHabitCheck(state, habit.id, date).done && onFire) onFire()
    dispatch({ type: 'SET_CHECKIN', habitId: habit.id, date })
  }

  return (
    <motion.div className="glass" initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }} style={{ padding: 22, marginBottom: 24 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 1fr) minmax(280px, 1.4fr) auto', gap: 20, alignItems: 'center' }} className="weekboard-head">
        <div>
          <h2 style={{ fontSize: '1.5rem' }}>Task Tracker</h2>
          <div style={{ color: 'var(--muted)', fontSize: '0.8rem', marginTop: 4 }}>Week Start Date</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
            <button className="btn ghost icon" style={{ padding: '4px 9px' }} onClick={() => setOffset((o) => o - 1)} aria-label="Previous week">‹</button>
            <span style={{ padding: '6px 14px', borderRadius: 10, background: '#34d399', color: '#062e21', fontWeight: 800, fontFamily: 'Space Grotesk', letterSpacing: '0.02em' }}>
              {format(weekStart, 'dd.MM.yyyy')}
            </span>
            <button className="btn ghost icon" style={{ padding: '4px 9px' }} onClick={() => setOffset((o) => o + 1)} aria-label="Next week">›</button>
            {offset !== 0 && <button className="btn ghost" style={{ padding: '4px 10px', fontSize: '0.74rem' }} onClick={() => setOffset(0)}>This week</button>}
          </div>
        </div>

        <div style={{ height: 130 }}>
          <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: '0.78rem', fontWeight: 600 }}>Overall Progress</div>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barData} margin={{ top: 6, right: 4, bottom: 0, left: -24 }} barCategoryGap="30%">
              <XAxis dataKey="day" tick={{ fill: '#98a2c8', fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis domain={[0, maxBar]} allowDecimals={false} tick={{ fill: '#98a2c8', fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip cursor={{ fill: 'rgba(255,255,255,0.04)' }} contentStyle={{ background: 'rgba(16,20,40,0.95)', border: '1px solid var(--border-strong)', borderRadius: 12, fontSize: '0.8rem' }}
                formatter={(v, n, e) => [`${v}/${e.payload.total}`, 'Done']} />
              <Bar dataKey="total" stackId="a" fill="rgba(255,255,255,0.10)" radius={[6, 6, 0, 0]} isAnimationActive={false} />
              <Bar dataKey="done" stackId="b" radius={[6, 6, 0, 0]} animationDuration={1000}>
                {barData.map((b, i) => <Cell key={i} fill={b.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <Donut pct={overall} color="#2dd4bf" size={110} stroke={11}>
          <div style={{ textAlign: 'center' }}>
            <div className="futuristic" style={{ fontSize: 22, fontWeight: 800 }}>{overall}%</div>
            <div style={{ fontSize: '0.6rem', color: 'var(--muted)', fontWeight: 700 }}>{totalDone} / {totalPossible} Completed</div>
          </div>
        </Donut>
      </div>

      {!daily.length ? (
        <div style={{ marginTop: 18, padding: 24, borderRadius: 18, border: '1px dashed var(--border-strong)', textAlign: 'center', color: 'var(--muted)', fontSize: '0.88rem' }}>
          Your week board is empty. <button className="btn primary" style={{ marginLeft: 8, padding: '6px 12px' }} onClick={onAdd}>＋ Add a habit</button>
        </div>
      ) : (
        <div style={{ overflowX: 'auto', marginTop: 18 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(150px, 1fr))', gap: 10, minWidth: 'max-content' }}>
            {days.map((d, i) => {
              const r = rollups[i]
              const isToday = d.date === today
              const future = d.date > today
              const active = daily.filter((h) => habitActiveOn(h, d.date))
              return (
                <motion.div key={d.date} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                  style={{
                    padding: 12, borderRadius: 16, background: 'rgba(0,0,0,0.22)', border: `1px solid ${isToday ? DAY_COLORS[i] : 'var(--border)'}`,
                    boxShadow: isToday ? `0 0 22px ${DAY_COLORS[i]}44` : 'none', opacity: future ? 0.75 : 1,
                  }}>
                  <div style={{ fontWeight: 800, fontSize: '1rem' }}>{d.label}</div>
                  <div style={{ color: 'var(--muted)', fontSize: '0.68rem' }}>{d.num}</div>
                  <div style={{ display: 'grid', placeItems: 'center', margin: '10px 0' }}>
                    <Donut pct={r.percent} color={DAY_COLORS[i]}>
                      <span className="futuristic" style={{ fontSize: 15, fontWeight: 800 }}>{r.percent}%</span>
                    </Donut>
                  </div>
                  <div style={{ color: 'var(--muted)', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Tasks</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <AnimatePresence initial={false}>
                      {active.map((h) => {
                        const on = getHabitCheck(state, h.id, d.date).done
                        return (
                          <motion.button key={h.id} layout type="button" disabled={future} onClick={() => toggle(h, d.date)}
                            whileTap={future ? {} : { scale: 0.97 }}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', borderRadius: 8, border: 'none', textAlign: 'left',
                              background: on ? DAY_COLORS[i] : 'rgba(255,255,255,0.04)', color: on ? '#0a0a12' : 'var(--text)',
                              fontSize: '0.76rem', fontWeight: 600, cursor: future ? 'default' : 'pointer', transition: 'background 0.25s',
                              textDecoration: on ? 'line-through' : 'none',
                            }}>
                            <span style={{
                              width: 14, height: 14, borderRadius: 4, border: `2px solid ${on ? '#0a0a12' : 'rgba(255,255,255,0.35)'}`,
                              background: on ? '#0a0a12' : 'transparent', display: 'grid', placeItems: 'center', flexShrink: 0,
                            }}>
                              {on && <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke={DAY_COLORS[i]} strokeWidth="5" strokeLinecap="round"><path d="M5 12l4.5 4.5L19 7" /></svg>}
                            </span>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.name}</span>
                          </motion.button>
                        )
                      })}
                    </AnimatePresence>
                    {!active.length && <span style={{ color: 'var(--muted)', fontSize: '0.72rem' }}>No habits scheduled</span>}
                  </div>
                </motion.div>
              )
            })}
          </div>
        </div>
      )}
    </motion.div>
  )
}
