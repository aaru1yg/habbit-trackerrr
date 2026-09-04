import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, PieChart, Pie, Cell } from 'recharts'
import { useStore } from '../store.jsx'

const STEPS = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]

function ProjectCard({ habit, index }) {
  const { state, dispatch } = useStore()
  const [open, setOpen] = useState(false)
  const project = state.projects[habit.id] || { percent: 0, milestones: [] }
  const pct = project.percent || 0
  const avgMilestone = project.milestones.length
    ? project.milestones.reduce((a, b) => a + b.percent, 0) / project.milestones.length
    : pct

  const setPct = (v) => dispatch({ type: 'SET_PROJECT_PERCENT', habitId: habit.id, percent: v })

  const milestoneData = (project.milestones || []).map((m) => ({ ...m, label: m.date.slice(5) }))
  const pieData = [{ name: 'Done', value: pct, fill: habit.color }, { name: 'Remaining', value: 100 - pct, fill: 'rgba(255,255,255,0.08)' }]

  const end = habit.endDate
  const daysLeft = end ? Math.round((new Date(end) - new Date()) / 86400000) : null

  return (
    <motion.div layout initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="glass" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 48, height: 48, borderRadius: 14, display: 'grid', placeItems: 'center', fontSize: 24,
          background: `linear-gradient(135deg, ${habit.color}33, ${habit.color}11)`, border: `1px solid ${habit.color}55`,
        }}>{habit.emoji}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700 }}>{habit.name}</div>
          <div style={{ color: 'var(--muted)', fontSize: '0.78rem', marginTop: 3 }}>
            {daysLeft !== null && daysLeft >= 0 ? `⏳ ${daysLeft}d left` : '⚡ only today'} · started {habit.startDate.slice(5)}
          </div>
        </div>
        <div style={{ fontWeight: 800, fontFamily: 'Space Grotesk', fontSize: '1.3rem', color: habit.color }}>{pct}%</div>
      </div>

      <div style={{ height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
        <motion.div animate={{ width: `${pct}%` }} transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          style={{ height: '100%', background: `linear-gradient(90deg, ${habit.color}, ${habit.color}88)` }} />
      </div>

      {/* percent step selector */}
      <div>
        <div className="label" style={{ marginBottom: 8 }}>Set progress</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {STEPS.map((s) => (
            <motion.button key={s} whileTap={{ scale: 0.9 }}
              onClick={() => setPct(s)}
              style={{
                padding: '5px 0', width: 38, borderRadius: 10, border: '1px solid var(--border)', fontSize: '0.78rem', fontWeight: 700,
                background: pct === s ? habit.color : 'rgba(255,255,255,0.04)',
                color: pct === s ? '#0a0a12' : 'var(--muted)', transition: 'all 0.2s',
              }}>{s}</motion.button>
          ))}
        </div>
      </div>

      <button className="btn ghost" onClick={() => setOpen(!open)} style={{ justifyContent: 'center' }}>
        {open ? 'Hide detail' : 'Show own graph & pie'} {open ? '▲' : '▼'}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.4 }} style={{ overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, alignItems: 'center', paddingTop: 4 }}>
              <div style={{ height: 160 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={milestoneData}>
                    <defs>
                      <linearGradient id={`pg-${habit.id}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={habit.color} stopOpacity={0.5} />
                        <stop offset="100%" stopColor={habit.color} stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="label" tick={{ fill: '#98a2c8', fontSize: 9 }} tickLine={false} axisLine={false} />
                    <YAxis domain={[0, 100]} tick={{ fill: '#98a2c8', fontSize: 9 }} tickLine={false} axisLine={false} width={26} />
                    <Tooltip contentStyle={{ background: 'rgba(16,20,40,0.95)', border: '1px solid var(--border-strong)', borderRadius: 12, fontSize: '0.8rem' }} />
                    <Area type="monotone" dataKey="percent" stroke={habit.color} strokeWidth={2.5} fill={`url(#pg-${habit.id})`} animationDuration={900} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div style={{ height: 160, position: 'relative', display: 'grid', placeItems: 'center' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} dataKey="value" innerRadius={42} outerRadius={62} stroke="none" animationDuration={900}>
                      {pieData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ position: 'absolute', textAlign: 'center' }}>
                  <div style={{ fontSize: 20, fontWeight: 800, fontFamily: 'Space Grotesk', color: habit.color }}>{pct}%</div>
                  <div style={{ color: 'var(--muted)', fontSize: '0.62rem' }}>complete</div>
                </div>
              </div>
            </div>
            <div style={{ color: 'var(--muted)', fontSize: '0.76rem', marginTop: 8 }}>
              Avg progress {Math.round(avgMilestone)}% · last updated {project.updatedAt?.slice(5) || 'today'}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export default function ProjectTracker() {
  const { state } = useStore()
  const projects = state.habits.filter((h) => !h.isDaily)
  if (!projects.length) return null

  return (
    <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ duration: 0.6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '28px 0 14px' }}>
        <h2 style={{ fontSize: '1.2rem' }}>Custom project tracker</h2>
        <span className="chip" style={{ color: 'var(--muted)' }}>pick a % · own graph & pie each</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 18 }}>
        {projects.map((h, i) => <ProjectCard key={h.id} habit={h} index={i} />)}
      </div>
    </motion.div>
  )
}
