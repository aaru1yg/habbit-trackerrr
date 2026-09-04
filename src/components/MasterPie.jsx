import { motion } from 'framer-motion'
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts'
import { useStore } from '../store.jsx'

function PieTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null
  const p = payload[0]
  return (
    <div className="glass" style={{ padding: '10px 12px', borderRadius: 12, fontSize: '0.84rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}>
        <i style={{ width: 9, height: 9, borderRadius: 3, background: p.payload.fill }} />
        {p.name}
      </div>
      <div style={{ color: 'var(--muted)', marginTop: 4 }}>{p.value}% complete</div>
    </div>
  )
}

function ProjectDonut({ percent, color, size = 130, stroke = 12 }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const off = c * (1 - percent / 100)
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: off }}
          transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
          style={{ filter: `drop-shadow(0 0 6px ${color})` }}
        />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 24, fontFamily: 'Space Grotesk' }}>
        {Math.round(percent)}%
      </div>
    </div>
  )
}

export default function MasterPie() {
  const { state } = useStore()
  const projects = state.habits.filter((h) => !h.isDaily)
  const data = projects.map((h) => ({
    name: h.name,
    value: state.projects[h.id]?.percent || 0,
    fill: h.color,
  }))
  const avg = data.length ? Math.round(data.reduce((a, b) => a + b.value, 0) / data.length) : 0

  if (!projects.length) {
    return (
      <div className="glass" style={{ padding: 26, textAlign: 'center', color: 'var(--muted)' }}>
        No projects yet. Add a non-daily activity to track big goals 🎯
      </div>
    )
  }

  return (
    <motion.div className="glass" initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }} style={{ padding: 22 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 4 }}>
        <h2 style={{ fontSize: '1.2rem' }}>Master project pie 🚀</h2>
        <span className="chip" style={{ color: 'var(--text)' }}>
          <span className="dot" style={{ background: 'var(--good)' }} />
          {data.length} projects tracked
        </span>
      </div>
      <span style={{ color: 'var(--muted)', fontSize: '0.82rem' }}>A live look at every big goal's completion. Click a slice for details.</span>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24, alignItems: 'center', marginTop: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', height: 280 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={70} outerRadius={105}
                paddingAngle={3} stroke="rgba(7,10,20,0.8)" strokeWidth={2} animationDuration={1200}>
                {data.map((d, i) => <Cell key={i} fill={d.fill} />)}
              </Pie>
              <Tooltip content={<PieTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ position: 'absolute', textAlign: 'center', pointerEvents: 'none' }}>
            <div style={{ fontSize: 32, fontWeight: 800, fontFamily: 'Space Grotesk' }}>{avg}%</div>
            <div style={{ color: 'var(--muted)', fontSize: '0.72rem', fontWeight: 600 }}>avg complete</div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {projects.map((h) => {
            const pct = state.projects[h.id]?.percent || 0
            return (
              <motion.div key={h.id} whileHover={{ x: 4 }}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 14, background: 'rgba(0,0,0,0.22)', border: '1px solid var(--border)' }}>
                <ProjectDonut percent={pct} color={h.color} size={56} stroke={7} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontWeight: 700, fontSize: '0.92rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{h.emoji} {h.name}</span>
                  </div>
                  <div style={{ height: 6, marginTop: 6, borderRadius: 999, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                    <motion.div animate={{ width: `${pct}%` }} transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                      style={{ height: '100%', background: `linear-gradient(90deg, ${h.color}, ${h.color}88)` }} />
                  </div>
                </div>
                <span style={{ fontWeight: 800, fontFamily: 'Space Grotesk', fontSize: '1.1rem' }}>{pct}%</span>
              </motion.div>
            )
          })}
        </div>
      </div>
    </motion.div>
  )
}
