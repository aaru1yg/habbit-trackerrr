import { motion } from 'framer-motion'
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Tooltip } from 'recharts'
import { useStore, overallCompletion, todayStr, habitStreak } from '../store.jsx'

export default function BalanceRadar() {
  const { state } = useStore()
  const today = todayStr()
  const daily = state.habits.filter((h) => h.isDaily)
  // bucket habits into categories by keyword for a friendly radar
  const buckets = [
    { label: 'Fitness', keys: ['work', 'gym', 'run', 'run', 'train', 'step', 'walk', 'exercise', 'workout', 'yoga', 'move'] },
    { label: 'Mind', keys: ['medit', 'mind', 'journal', 'reflect', 'gratitude', 'calm', 'focus', 'deep'] },
    { label: 'Learning', keys: ['read', 'learn', 'study', 'course', 'code', 'practice', 'skill', 'reac'] },
    { label: 'Health', keys: ['water', 'sleep', 'eat', 'food', 'diet', 'vitamin', 'drink', 'hydrat', 'meal'] },
    { label: 'Creative', keys: ['write', 'draw', 'music', 'guitar', 'art', 'edit', 'design', 'create', 'sing'] },
    { label: 'Social', keys: ['call', 'text', 'friend', 'social', 'family', 'connect', 'networ'] },
  ]

  const metrics = buckets.map((b) => {
    const matched = daily.filter((h) => b.keys.some((k) => h.name.toLowerCase().includes(k)))
    if (!matched.length) return { subject: b.label, value: 0, full: 0 }
    const val = matched.reduce((a, h) => a + (state.checkins[h.id]?.[today]?.done ? 1 : 0), 0)
    const value = Math.round((val / matched.length) * 100)
    return { subject: b.label, value, full: matched.length }
  })

  const hasAny = metrics.some((m) => m.full > 0)

  return (
    <motion.div className="glass" initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }} style={{ padding: 22 }}>
      <h2 style={{ fontSize: '1.2rem' }}>Life balance radar ⚖️</h2>
      <span style={{ color: 'var(--muted)', fontSize: '0.82rem' }}>How evenly your energy is spent across areas.</span>
      <div style={{ height: 260 }}>
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={metrics} outerRadius="72%">
            <PolarGrid stroke="rgba(255,255,255,0.1)" />
            <PolarAngleAxis dataKey="subject" tick={{ fill: '#eef2ff', fontSize: 11 }} />
            <PolarRadiusAxis domain={[0, 100]} tick={{ fill: '#98a2c8', fontSize: 9 }} tickCount={5} axisLine={false} />
            <Radar name="Today" dataKey="value" stroke="#22d3ee" strokeWidth={2.5} fill="#22d3ee" fillOpacity={0.25} animationDuration={1100} />
            <Tooltip contentStyle={{ background: 'rgba(16,20,40,0.95)', border: '1px solid var(--border-strong)', borderRadius: 12, fontSize: '0.84rem' }}
              formatter={(v, n, e) => [`${v}%`, e?.payload?.subject || n]} />
          </RadarChart>
        </ResponsiveContainer>
      </div>
      {!hasAny && <div style={{ color: 'var(--muted)', fontSize: '0.8rem', textAlign: 'center' }}>Add habits matching fitness/mind/learning/health keywords to see your balance.</div>}
    </motion.div>
  )
}
