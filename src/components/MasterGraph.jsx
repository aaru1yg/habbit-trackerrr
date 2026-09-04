import { useState } from 'react'
import { motion } from 'framer-motion'
import { ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine } from 'recharts'
import { useStore, buildMasterSeries } from '../store.jsx'

const RANGES = [7, 14, 30, 90]

function MasterTooltip({ active, payload, label, rangeLabel }) {
  if (!active || !payload || !payload.length) return null
  return (
    <div className="glass" style={{ padding: '12px 14px', minWidth: 160, borderRadius: 14, fontSize: '0.84rem' }}>
      <div style={{ fontWeight: 700, marginBottom: 8 }}>{label}</div>
      {payload.filter((p) => p.dataKey === 'Avg').map((p) => (
        <div key={p.dataKey} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><i style={{ width: 9, height: 9, borderRadius: 3, background: '#7c5cff' }} />Overall</span>
          <b>{p.value}%</b>
        </div>
      ))}
    </div>
  )
}

export default function MasterGraph() {
  const { state } = useStore()
  const [range, setRange] = useState(14)
  const [mode, setMode] = useState('overall')
  const data = buildMasterSeries(state, range)
  const daily = state.habits.filter((h) => h.isDaily)

  const visible = mode === 'perh' ? daily : daily.filter((h) => daily.length <= 6)

  return (
    <motion.div className="glass" initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }} style={{ padding: 22, marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 6 }}>
        <div>
          <h2 style={{ fontSize: '1.2rem' }}>Habits over time</h2>
          <span style={{ color: 'var(--muted)', fontSize: '0.82rem' }}>Your master graph — every habit vs the clock.</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
          <div className="seg">
            {RANGES.map((r) => (
              <button key={r} className={range === r ? 'active' : ''} onClick={() => setRange(r)}>{r}d</button>
            ))}
          </div>
          <div className="seg">
            <button className={mode === 'overall' ? 'active' : ''} onClick={() => setMode('overall')}>Overall</button>
            <button className={mode === 'perh' ? 'active' : ''} onClick={() => setMode('perh')}>Per habit</button>
          </div>
        </div>
      </div>

      <div style={{ height: 300 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 12, right: 8, bottom: 4, left: -14 }}>
            <defs>
              <linearGradient id="avgFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#7c5cff" stopOpacity={0.55} />
                <stop offset="100%" stopColor="#22d3ee" stopOpacity={0.04} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: '#98a2c8', fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={24} />
            <YAxis domain={[0, 100]} tick={{ fill: '#98a2c8', fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} />
            <Tooltip content={<MasterTooltip rangeLabel={range} />} />
            <Legend wrapperStyle={{ fontSize: '0.75rem', paddingTop: 4 }} />
            <ReferenceLine y={100} stroke="rgba(52,211,153,0.25)" strokeDasharray="4 4" />
            <Area type="monotone" dataKey="Avg" name="Overall" stroke="url(#avgFill)" fill="url(#avgFill)"
              strokeWidth={3} animationDuration={1400} dot={false} />
            {mode === 'perh' ? (
              daily.map((h) => (
                <Line key={h.id} type="monotone" dataKey={h.id} name={h.name} stroke={h.color}
                  strokeWidth={2} dot={false} animationDuration={1200} connectNulls />
              ))
            ) : (
              daily.slice(0, 6).map((h) => (
                <Line key={h.id} type="monotone" dataKey={h.id} name={h.name} stroke={h.color}
                  strokeWidth={2} strokeOpacity={0.85} dot={false} animationDuration={1200} connectNulls />
              ))
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  )
}
