import { motion } from 'framer-motion'
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts'
import { useStore } from '../store.jsx'

const TYPE_META = {
  forever: { label: 'Daily · forever', color: '#22d3ee' },
  oneday: { label: 'One-day only', color: '#fb7185' },
  shortterm: { label: 'Short-term', color: '#fbbf24' },
}

function Tip({ active, payload }) {
  if (!active || !payload?.length) return null
  const p = payload[0]
  return (
    <div className="glass" style={{ padding: '8px 10px', borderRadius: 10, fontSize: '0.8rem' }}>
      <div style={{ fontWeight: 700 }}>{p.name}</div>
      <div style={{ color: 'var(--muted)' }}>{p.value} habits</div>
    </div>
  )
}

export default function DurationPie() {
  const { state } = useStore()
  const counts = { forever: 0, oneday: 0, shortterm: 0 }
  state.habits.forEach((h) => {
    const k = h.durationType === 'forever' ? 'forever' : h.isDaily ? h.durationType : 'shortterm'
    if (counts[k] !== undefined) counts[k]++
  })
  const data = Object.entries(TYPE_META).map(([k, m]) => ({ name: m.label, value: counts[k], fill: m.color })).filter((d) => d.value > 0)

  if (!data.length) {
    return (
      <div className="glass" style={{ padding: 26, textAlign: 'center', color: 'var(--muted)' }}>No habits yet.</div>
    )
  }

  return (
    <motion.div className="glass" initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }} style={{ padding: 22 }}>
      <h2 style={{ fontSize: '1.2rem' }}>Habit types ring 🗂️</h2>
      <span style={{ color: 'var(--muted)', fontSize: '0.82rem' }}>Forever vs one-day vs short-term breakdown.</span>
      <div style={{ height: 220, marginTop: 6 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={4} animationDuration={1000}>
              {data.map((d, i) => <Cell key={i} fill={d.fill} />)}
            </Pie>
            <Tooltip content={<Tip />} />
            <Legend wrapperStyle={{ fontSize: '0.74rem', color: 'var(--muted)' }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  )
}
