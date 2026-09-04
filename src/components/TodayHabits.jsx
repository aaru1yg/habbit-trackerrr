import { motion } from 'framer-motion'
import { useStore, todayStr, getHabitCheck, habitStreak } from '../store.jsx'

const unitLabel = { times: 'x', minutes: 'min', pages: 'pages', glasses: 'glasses', percent: '%' }

export function HabitRow({ habit, index, onFire }) {
  const { state, dispatch } = useStore()
  const today = todayStr()
  const check = getHabitCheck(state, habit.id, today)
  const done = check.done
  const target = habit.targetValue || 1
  const streak = habitStreak(state, habit)
  const pct = Math.min(100, Math.round((check.value / target) * 100))

  const toggle = () => {
    if (!done) onFire()
    dispatch({ type: 'SET_CHECKIN', habitId: habit.id, date: today })
  }
  const addVal = (delta) => {
    const next = Math.min(target, Math.max(0, check.value + delta))
    if (next >= target && !done) onFire()
    dispatch({ type: 'SET_CHECKIN_VALUE', habitId: habit.id, date: today, value: next })
  }

  const isMulti = target > 1

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -3 }}
      style={{
        display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderRadius: 18,
        background: 'var(--panel)', border: '1px solid var(--border)', backdropFilter: 'blur(14px)',
        transition: 'border-color 0.3s, box-shadow 0.3s',
        ...(done ? { borderColor: 'rgba(52,211,153,0.5)', boxShadow: '0 8px 30px rgba(52,211,153,0.18)' } : {}),
      }}
    >
      <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
        style={{
          width: 48, height: 48, borderRadius: 14, display: 'grid', placeItems: 'center', fontSize: 24,
          background: `linear-gradient(135deg, ${habit.color}33, ${habit.color}11)`,
          border: `1px solid ${habit.color}55`, flexShrink: 0,
        }}>
        {habit.emoji}
      </motion.div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 700, fontSize: '0.98rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{habit.name}</span>
          {habit.durationType !== 'forever' && (
            <span style={{ fontSize: '0.66rem', padding: '2px 7px', borderRadius: 999, background: 'rgba(251,183,34,0.16)', color: 'var(--warn)', fontWeight: 700 }}>
              {habit.durationType === 'oneday' ? 'one-day' : 'short-term'}
            </span>
          )}
          {streak > 1 && (
            <span style={{ fontSize: '0.72rem', color: 'var(--warn)', fontWeight: 700 }}>🔥 {streak}d</span>
          )}
        </div>
        <div style={{ color: 'var(--muted)', fontSize: '0.82rem', marginTop: 3, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span>Goal: {target} {unitLabel[habit.targetUnit] || habit.targetUnit}</span>
          {isMulti && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <button onClick={() => addVal(-1)} style={{ width: 22, height: 22, borderRadius: 7, border: '1px solid var(--border-strong)', background: 'rgba(255,255,255,0.04)', color: 'var(--text)' }}>−</button>
              <span style={{ fontWeight: 700 }}>{check.value}/{target}</span>
              <button onClick={() => addVal(1)} style={{ width: 22, height: 22, borderRadius: 7, border: '1px solid var(--border-strong)', background: 'rgba(255,255,255,0.04)', color: 'var(--text)' }}>＋</button>
            </span>
          )}
        </div>
        {isMulti && (
          <div style={{ height: 6, marginTop: 8, borderRadius: 999, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
            <motion.div animate={{ width: `${pct}%` }} transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              style={{ height: '100%', borderRadius: 999, background: `linear-gradient(90deg, ${habit.color}, ${habit.color}99)` }} />
          </div>
        )}
      </div>

      <motion.button
        onClick={toggle}
        whileTap={{ scale: 0.85 }}
        aria-label={done ? 'Mark not done' : 'Mark done'}
        style={{
          width: 56, height: 56, borderRadius: 18, flexShrink: 0, display: 'grid', placeItems: 'center',
          border: '1px solid var(--border-strong)', cursor: 'pointer',
          background: done ? 'linear-gradient(135deg, #10b981, #34d399)' : 'rgba(255,255,255,0.04)',
          color: done ? '#062e21' : 'var(--muted)',
          boxShadow: done ? '0 8px 24px rgba(52,211,153,0.4)' : 'none',
          transition: 'all 0.25s ease',
        }}
      >
        <motion.svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
          animate={{ scale: done ? 1 : 0.6, opacity: done ? 1 : 0.55 }}>
          <motion.path d="M5 12l4.5 4.5L19 7" initial={false}
            animate={{ pathLength: done ? 1 : 0, opacity: done ? 1 : 0.4 }} transition={{ duration: 0.4 }} />
        </motion.svg>
      </motion.button>
    </motion.div>
  )
}

export default function TodayHabits({ onFire, onAdd }) {
  const { state } = useStore()
  const today = todayStr()
  const daily = state.habits.filter((h) => h.isDaily)
  const active = daily.filter((h) => (!h.startDate || today >= h.startDate) && (!h.endDate || today <= h.endDate))

  if (!active.length) {
    return (
      <div className="glass" style={{ padding: 26, textAlign: 'center', color: 'var(--muted)' }}>
        <div>No daily habits yet — create your first habit! 🎯</div>
        {onAdd && <button className="btn primary" style={{ marginTop: 12 }} onClick={onAdd}>＋ New habit</button>}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: '0.82rem', color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        Today's checklist · {daily.filter((h) => state.checkins[h.id]?.[today]?.done).length}/{active.length} done
      </div>
      {active.map((h, i) => (
        <HabitRow key={h.id} habit={h} index={i} onFire={onFire} />
      ))}
    </div>
  )
}
