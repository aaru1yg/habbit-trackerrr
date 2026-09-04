import { motion } from 'framer-motion'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, LabelList } from 'recharts'
import { useStore, lastNDays, overallCompletion } from '../store.jsx'
import { format as fmt } from 'date-fns'

export default function WeekBars() {
  const { state } = useStore()
  const days = lastNDays(7)
  const data = days.map((d) => ({
    day: fmt(d, 'EEE'),
    date: fmt(d, 'MMM d'),
    pct: overallCompletion(state, fmt(d, 'yyyy-MM-dd')),
  }))

  const avg = Math.round(data.reduce((a, b) => a + b.pct, 0) / data.length)

  return (
    <motion.div className="glass" initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }} style={{ padding: 22 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: '1.2rem' }}>Last 7 days</h2>
          <span style={{ color: 'var(--muted)', fontSize: '0.82rem' }}>Weekly completion bars</span>
        </div>
        <span className="chip"><span className="dot" style={{ background: 'var(--good)' }} />avg {avg}%</span>
      </div>
      <div style={{ height: 220, marginTop: 12 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 20, right: 8, bottom: 0, left: -14 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
            <XAxis dataKey="day" tick={{ fill: '#98a2c8', fontSize: 11 }} tickLine={false} axisLine={false} />
            <YAxis domain={[0, 100]} tick={{ fill: '#98a2c8', fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} />
            <Tooltip
              contentStyle={{ background: 'rgba(16,20,40,0.95)', border: '1px solid var(--border-strong)', borderRadius: 12, fontSize: '0.84rem' }}
              formatter={(v) => [`${v}%`, 'Completion']}
              labelFormatter={(l) => data.find((d) => d.day === l)?.date || l}
            />
            <Bar dataKey="pct" name="Completion" radius={[8, 8, 0, 0]} animationDuration={1100}>
              {data.map((d, i) => {
                const isToday = i === data.length - 1
                return <Cell key={i} fill={isToday ? '#22d3ee' : 'url(#barG)'} />
              })}
              <LabelList dataKey="pct" position="top" style={{ fill: '#eef2ff', fontSize: 11, fontWeight: 700 }} />
            </Bar>
            <defs>
              <linearGradient id="barG" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#7c5cff" />
                <stop offset="100%" stopColor="#5b3df5" />
              </linearGradient>
            </defs>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  )
}
