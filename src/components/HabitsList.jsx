import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ResponsiveContainer, AreaChart, Area, Tooltip } from 'recharts'
import { useStore, habitStreak, bestStreak } from '../store.jsx'
import { format as fmt, subDays } from 'date-fns'

function HabitDetail({ habit }) {
  const { state } = useStore()
  const days = []
  for (let i = 13; i >= 0; i--) {
    const d = fmt(subDays(new Date(), i), 'yyyy-MM-dd')
    const check = state.checkins[habit.id]?.[d]
    days.push({ day: fmt(subDays(new Date(), i), 'EEE'), date: fmt(subDays(new Date(), i), 'MMM d'), pct: habit.isDaily ? Math.min(100, Math.round(((check?.value || 0) / (habit.targetValue || 1)) * 100)) : ((state.projects[habit.id]?.percent || 0)) })
  }
  const streak = habitStreak(state, habit)
  const best = bestStreak(state, habit)
  const checkCount = Object.keys(state.checkins[habit.id] || {}).filter((d) => state.checkins[habit.id][d].done).length

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 16, paddingTop: 4 }}>
      <div style={{ height: 120 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={days}>
            <defs>
              <linearGradient id={`hl-${habit.id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={habit.color} stopOpacity={0.5} />
                <stop offset="100%" stopColor={habit.color} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <Tooltip contentStyle={{ background: 'rgba(16,20,40,0.95)', border: '1px solid var(--border-strong)', borderRadius: 12, fontSize: '0.78rem' }} />
            <Area type="monotone" dataKey="pct" stroke={habit.color} strokeWidth={2.5} fill={`url(#hl-${habit.id})`} animationDuration={900} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, alignItems: 'center' }}>
        <Metric label="Streak" value={`${streak}🔥`} />
        <Metric label="Best" value={`${best}d`} />
        <Metric label="Check-ins" value={checkCount} />
        <Metric label="Progress" value={`${habit.isDaily ? format2(days) : (state.projects[habit.id]?.percent || 0) + '%'}`} />
      </div>
    </div>
  )
}

function format2(days) {
  const done = days.filter((d) => d.pct >= 100).length
  return `${done}/14d`
}

function Metric({ label, value }) {
  return (
    <div style={{ padding: '10px 8px', borderRadius: 12, background: 'rgba(0,0,0,0.2)', textAlign: 'center', border: '1px solid var(--border)' }}>
      <div style={{ fontSize: '1.1rem', fontWeight: 800, fontFamily: 'Space Grotesk' }}>{value}</div>
      <div style={{ color: 'var(--muted)', fontSize: '0.68rem', fontWeight: 600 }}>{label}</div>
    </div>
  )
}

function Row({ habit, onEdit, onDelete }) {
  const { state } = useStore()
  const [open, setOpen] = useState(false)
  return (
    <motion.div layout
      style={{ border: '1px solid var(--border)', borderRadius: 18, background: 'var(--panel)', overflow: 'hidden', backdropFilter: 'blur(14px)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px' }}>
        <div style={{ width: 42, height: 42, borderRadius: 12, display: 'grid', placeItems: 'center', fontSize: 20, background: `linear-gradient(135deg, ${habit.color}33, ${habit.color}11)`, border: `1px solid ${habit.color}55` }}>{habit.emoji}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>{habit.name}
            <span className="chip" style={{ fontSize: '0.68rem', padding: '3px 9px' }}>
              {habit.isDaily ? (habit.durationType === 'forever' ? '♾️ forever' : habit.durationType === 'oneday' ? '📍 one-day' : '📆 daily') : (habit.durationType === 'shortterm' ? '🚀 short-term' : habit.durationType === 'oneday' ? '📍 one-day' : '♾️ forever')}
            </span>
          </div>
          <div style={{ color: 'var(--muted)', fontSize: '0.76rem', marginTop: 2 }}>{habit.isDaily ? `${habit.targetValue} ${habit.targetUnit}/day` : `project · ${habit.targetValue}%`} · since {habit.startDate.slice(5)}</div>
        </div>
        <button className="btn ghost icon" onClick={() => setOpen(!open)} title="Detail" style={{ padding: 8 }}>{open ? '▲' : '📈'}</button>
        <button className="btn ghost icon" onClick={() => onEdit(habit)} title="Edit" style={{ padding: 8 }}>✏️</button>
        <button className="btn ghost icon" onClick={() => onDelete(habit.id)} title="Delete" style={{ padding: 8 }}>🗑️</button>
      </div>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.35 }} style={{ overflow: 'hidden', padding: open ? '0 16px 14px' : 0 }}>
            <HabitDetail habit={habit} />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export default function HabitsList({ onEdit, onDelete }) {
  const { state } = useStore()
  const [filter, setFilter] = useState('all')
  const all = state.habits
  const filtered = filter === 'all' ? all : filter === 'daily' ? all.filter((h) => h.isDaily) : all.filter((h) => !h.isDaily)

  return (
    <motion.div className="glass" initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }} style={{ padding: 22 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: '1.2rem' }}>All trackers 🧰</h2>
          <span style={{ color: 'var(--muted)', fontSize: '0.82rem' }}>Manage, edit, and inspect every habit & project.</span>
        </div>
        <div className="seg">
          <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>All</button>
          <button className={filter === 'daily' ? 'active' : ''} onClick={() => setFilter('daily')}>Daily</button>
          <button className={filter === 'project' ? 'active' : ''} onClick={() => setFilter('project')}>Projects</button>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
        {filtered.map((h) => <Row key={h.id} habit={h} onEdit={onEdit} onDelete={onDelete} />)}
        {!filtered.length && <div style={{ color: 'var(--muted)', textAlign: 'center', padding: 18 }}>Nothing here yet.</div>}
      </div>
    </motion.div>
  )
}
