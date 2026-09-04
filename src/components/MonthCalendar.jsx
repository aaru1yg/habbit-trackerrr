import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  useStore, todayStr, getHabitCheck, buildMonthDays, buildMonthWeeks, habitActiveOn,
  dayRollup, habitMonthStats, monthOverview, MONTHS, WD_SHORT, WEEK_COLORS,
} from '../store.jsx'

const CELL = 30

function Check({ on, color, disabled, future, onClick }) {
  return (
    <motion.button
      type="button"
      aria-label={on ? 'Mark not done' : 'Mark done'}
      onClick={onClick}
      disabled={disabled}
      whileTap={disabled ? {} : { scale: 0.8 }}
      whileHover={disabled ? {} : { scale: 1.12 }}
      style={{
        width: 22, height: 22, borderRadius: 6, padding: 0,
        border: `2px solid ${future ? 'rgba(255,255,255,0.08)' : color}`,
        background: on ? color : 'transparent',
        boxShadow: on ? `0 0 12px ${color}` : 'none',
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.35 : 1,
        display: 'grid', placeItems: 'center',
        transition: 'background 0.2s, box-shadow 0.25s',
      }}
    >
      <motion.svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0a0a12" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
        <motion.path d="M5 12l4.5 4.5L19 7" initial={false} animate={{ pathLength: on ? 1 : 0, opacity: on ? 1 : 0 }} transition={{ duration: 0.3 }} />
      </motion.svg>
    </motion.button>
  )
}

export default function MonthCalendar({ onAdd, onFire }) {
  const { state, dispatch } = useStore()
  const now = new Date()
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() })
  const today = todayStr()

  const days = useMemo(() => buildMonthDays(ym.y, ym.m), [ym])
  const weeks = useMemo(() => buildMonthWeeks(days), [days])
  const daily = state.habits.filter((h) => h.isDaily)
  const overview = monthOverview(state, days)
  const isCurrentMonth = ym.y === now.getFullYear() && ym.m === now.getMonth()

  const prev = () => setYm(({ y, m }) => (m === 0 ? { y: y - 1, m: 11 } : { y, m: m - 1 }))
  const next = () => setYm(({ y, m }) => (m === 11 ? { y: y + 1, m: 0 } : { y, m: m + 1 }))

  const toggle = (habit, date) => {
    const was = getHabitCheck(state, habit.id, date).done
    if (!was && onFire) onFire()
    dispatch({ type: 'SET_CHECKIN', habitId: habit.id, date })
  }

  const rollups = days.map((d) => (d.date <= today ? dayRollup(state, d.date) : null))
  const gridCols = `220px repeat(${days.length}, ${CELL}px)`

  return (
    <motion.div className="glass" initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }} style={{ padding: 22, marginBottom: 24 }}>
      {/* header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn ghost icon" onClick={prev} aria-label="Previous month">‹</button>
          <div style={{ textAlign: 'center', minWidth: 170 }}>
            <AnimatePresence mode="wait">
              <motion.h2 key={`${ym.y}-${ym.m}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                style={{ fontSize: '1.6rem', lineHeight: 1 }}>
                {MONTHS[ym.m]} <span style={{ color: 'var(--muted)', fontSize: '1rem', fontWeight: 500 }}>{ym.y}</span>
              </motion.h2>
            </AnimatePresence>
            <div style={{ color: 'var(--muted)', fontSize: '0.78rem', letterSpacing: '0.12em', textTransform: 'uppercase', marginTop: 4 }}>— Habit Tracker —</div>
          </div>
          <button className="btn ghost icon" onClick={next} aria-label="Next month">›</button>
          {!isCurrentMonth && (
            <button className="btn ghost" style={{ padding: '6px 12px', fontSize: '0.78rem' }} onClick={() => setYm({ y: now.getFullYear(), m: now.getMonth() })}>Today</button>
          )}
        </div>

        {/* overview stats */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Stat label="Number of habits" value={overview.habits} />
          <Stat label="Completed habits" value={overview.completed} />
          <div style={{ padding: '8px 14px', borderRadius: 14, background: 'rgba(0,0,0,0.22)', border: '1px solid var(--border)', minWidth: 150 }}>
            <div style={{ color: 'var(--muted)', fontSize: '0.66rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Progress</div>
            <div style={{ height: 8, marginTop: 6, borderRadius: 999, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
              <motion.div animate={{ width: `${overview.percent}%` }} transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
                style={{ height: '100%', background: 'linear-gradient(90deg, var(--bad), var(--warn), var(--good))' }} />
            </div>
          </div>
          <Stat label="Progress in %" value={`${overview.percent}%`} accent />
        </div>
      </div>

      {!daily.length ? (
        <div style={{ marginTop: 22, padding: 30, borderRadius: 18, border: '1px dashed var(--border-strong)', textAlign: 'center' }}>
          <div style={{ fontSize: 34 }}>🗓️</div>
          <div style={{ fontWeight: 700, marginTop: 8 }}>Your calendar is ready — no habits yet.</div>
          <div style={{ color: 'var(--muted)', fontSize: '0.86rem', marginTop: 4 }}>Add your first habit and this month's grid fills in automatically. No fake data, ever.</div>
          <button className="btn primary" style={{ marginTop: 14 }} onClick={onAdd}>＋ Add a habit</button>
        </div>
      ) : (
        <div style={{ overflowX: 'auto', marginTop: 18, paddingBottom: 6 }} className="cal-scroll">
          <div style={{ display: 'grid', gridTemplateColumns: gridCols, alignItems: 'center', rowGap: 6, minWidth: 'max-content' }}>
            {/* Week bands */}
            <div style={{ fontWeight: 800, fontSize: '1.15rem', paddingRight: 12 }}>My Habits</div>
            {weeks.map((w) => (
              <motion.div key={w.index} initial={{ opacity: 0, scaleX: 0.6 }} animate={{ opacity: 1, scaleX: 1 }} transition={{ delay: w.index * 0.06 }}
                style={{
                  gridColumn: `span ${w.days.length}`, background: WEEK_COLORS[w.index % WEEK_COLORS.length],
                  borderRadius: '12px 12px 0 0', padding: '6px 0 2px', textAlign: 'center', color: '#0a0a12', fontWeight: 800, fontSize: '0.82rem', margin: '0 2px',
                }}>
                {w.label}
              </motion.div>
            ))}

            {/* weekday + day number rows */}
            <div />
            {days.map((d) => (
              <div key={`wd-${d.day}`} style={{
                textAlign: 'center', fontSize: '0.66rem', color: '#0a0a12', fontWeight: 700,
                background: WEEK_COLORS[d.week % WEEK_COLORS.length], margin: '0 2px', opacity: 0.9,
              }}>{WD_SHORT[d.weekday]}</div>
            ))}
            <div />
            {days.map((d) => {
              const isToday = d.date === today
              return (
                <div key={`dn-${d.day}`} style={{
                  textAlign: 'center', fontSize: '0.72rem', fontWeight: 800, padding: '3px 0 5px', margin: '0 2px',
                  background: WEEK_COLORS[d.week % WEEK_COLORS.length], color: '#0a0a12', borderRadius: '0 0 8px 8px',
                  outline: isToday ? '2px solid #fff' : 'none', outlineOffset: -2,
                }}>{d.day}</div>
              )
            })}

            {/* habit rows */}
            {daily.map((h, ri) => {
              const stats = habitMonthStats(state, h, days)
              return (
                <RowGroup key={h.id} index={ri}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingRight: 12, minWidth: 0 }}>
                    <span style={{ fontSize: 16 }}>{h.emoji}</span>
                    <span style={{ fontWeight: 600, fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{h.name}</span>
                    <span style={{ marginLeft: 'auto', fontSize: '0.68rem', color: 'var(--muted)', fontWeight: 700 }}>{stats.done}/{stats.elapsed}</span>
                  </div>
                  {days.map((d) => {
                    const future = d.date > today
                    const active = habitActiveOn(h, d.date)
                    const on = active && getHabitCheck(state, h.id, d.date).done
                    return (
                      <div key={d.day} style={{ display: 'grid', placeItems: 'center' }}>
                        <Check on={on} color={h.color} disabled={future || !active} future={future} onClick={() => toggle(h, d.date)} />
                      </div>
                    )
                  })}
                </RowGroup>
              )
            })}

            {/* per-day progress rows */}
            <div style={{ height: 8, gridColumn: `1 / span ${days.length + 1}` }} />
            <div style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--muted)' }}>Progress</div>
            {rollups.map((r, i) => (
              <div key={`p-${i}`} className="futuristic" style={{ textAlign: 'center', fontSize: '0.62rem', fontWeight: 700, color: r ? pctColor(r.percent) : 'rgba(255,255,255,0.25)' }}>
                {r ? `${r.percent}%` : '·'}
              </div>
            ))}
            <div style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--good)' }}>Done</div>
            {rollups.map((r, i) => (
              <div key={`d-${i}`} style={{ textAlign: 'center', fontSize: '0.7rem', color: 'var(--text)' }}>{r ? r.done : '·'}</div>
            ))}
            <div style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--bad)' }}>Not Done</div>
            {rollups.map((r, i) => (
              <div key={`n-${i}`} style={{ textAlign: 'center', fontSize: '0.7rem', color: 'var(--muted)' }}>{r ? r.notDone : '·'}</div>
            ))}
          </div>

          {/* daily completion sparkline (area) */}
          <DaySpark rollups={rollups} />
        </div>
      )}

      {/* Analysis */}
      {daily.length > 0 && (
        <div style={{ marginTop: 22 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <h3 style={{ fontSize: '1.05rem' }}>Analysis</h3>
            <span style={{ color: 'var(--muted)', fontSize: '0.78rem' }}>consistency per habit this month</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '8px 26px', marginTop: 10 }}>
            {daily.map((h, i) => {
              const s = habitMonthStats(state, h, days)
              return (
                <div key={h.id} style={{ display: 'grid', gridTemplateColumns: '150px 1fr 58px', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: '0.82rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{h.emoji} {h.name}</span>
                  <div style={{ height: 14, borderRadius: 4, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                    <motion.div initial={{ width: 0 }} animate={{ width: `${s.percent}%` }} transition={{ duration: 1, delay: i * 0.05, ease: [0.16, 1, 0.3, 1] }}
                      style={{ height: '100%', background: pctColor(s.percent), boxShadow: `0 0 10px ${pctColor(s.percent)}66` }} />
                  </div>
                  <span className="futuristic" style={{ fontSize: '0.74rem', fontWeight: 700, textAlign: 'right' }}>{s.percent.toFixed(2)}%</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </motion.div>
  )
}

function RowGroup({ children }) {
  return <>{children}</>
}

function Stat({ label, value, accent }) {
  return (
    <div style={{ padding: '8px 14px', borderRadius: 14, background: 'rgba(0,0,0,0.22)', border: '1px solid var(--border)' }}>
      <div style={{ color: 'var(--muted)', fontSize: '0.66rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
      <div className="futuristic" style={{ fontSize: '1.05rem', fontWeight: 700, marginTop: 2, color: accent ? 'var(--accent-2)' : 'var(--text)' }}>{value}</div>
    </div>
  )
}

export function pctColor(p) {
  if (p >= 70) return '#34d399'
  if (p >= 40) return '#fbbf24'
  return '#fb7185'
}

// Tiny animated area sparkline drawn under the calendar grid (no library needed → crisp, aligned to columns)
function DaySpark({ rollups }) {
  const vals = rollups.map((r) => (r ? r.percent : null))
  const n = vals.length
  const w = 220 + n * CELL
  const h = 90
  const pts = []
  vals.forEach((v, i) => {
    if (v == null) return
    const x = 220 + i * CELL + CELL / 2
    const y = 10 + (1 - v / 100) * (h - 20)
    pts.push([x, y])
  })
  if (pts.length < 2) return null
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0]},${p[1]}`).join(' ')
  const area = `${line} L${pts[pts.length - 1][0]},${h} L${pts[0][0]},${h} Z`
  return (
    <svg width={w} height={h} style={{ display: 'block', marginTop: 6 }}>
      <defs>
        <linearGradient id="daysparkFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2dd4bf" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#2dd4bf" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {[100, 75, 50, 25].map((g) => (
        <g key={g}>
          <line x1={220} x2={w} y1={10 + (1 - g / 100) * (h - 20)} y2={10 + (1 - g / 100) * (h - 20)} stroke="rgba(255,255,255,0.06)" />
          <text x={200} y={13 + (1 - g / 100) * (h - 20)} fill="#98a2c8" fontSize="9" textAnchor="end">{g}%</text>
        </g>
      ))}
      <motion.path d={area} fill="url(#daysparkFill)" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1.2 }} />
      <motion.path d={line} fill="none" stroke="#2dd4bf" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.4, ease: 'easeOut' }} style={{ filter: 'drop-shadow(0 0 6px #2dd4bf)' }} />
    </svg>
  )
}
