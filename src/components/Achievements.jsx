import { motion } from 'framer-motion'
import { useStore, habitStreak, bestStreak } from '../store.jsx'

function Badge({ icon, name, unlocked, desc }) {
  return (
    <motion.div whileHover={{ y: -4, scale: 1.03 }}
      style={{
        padding: 14, borderRadius: 16, textAlign: 'center',
        background: unlocked ? 'linear-gradient(160deg, rgba(255,209,102,0.14), rgba(255,255,255,0.02))' : 'rgba(255,255,255,0.03)',
        border: `1px solid ${unlocked ? 'rgba(255,209,102,0.4)' : 'var(--border)'}`,
        opacity: unlocked ? 1 : 0.55, filter: unlocked ? 'none' : 'grayscale(1)',
        transition: 'all 0.3s',
      }}>
      <div style={{ fontSize: 30 }}>{icon}</div>
      <div style={{ fontWeight: 700, marginTop: 6, fontSize: '0.85rem' }}>{name}</div>
      <div style={{ color: 'var(--muted)', fontSize: '0.72rem', marginTop: 3 }}>{desc}</div>
    </motion.div>
  )
}

export default function Achievements() {
  const { state } = useStore()
  const daily = state.habits.filter((h) => h.isDaily)
  const longestBest = daily.length ? Math.max(...daily.map((h) => bestStreak(state, h))) : 0
  const activeStreak7 = daily.filter((h) => habitStreak(state, h) >= 7).length
  const activeStreak30 = daily.filter((h) => habitStreak(state, h) >= 30).length
  const anyToday = daily.filter((h) => state.checkins[h.id]?.[new Date().toISOString().slice(0, 10)]?.done).length >= daily.length && daily.length > 0

  const badges = [
    { icon: '🌱', name: 'Just started', desc: 'Log your first habit', unlocked: state.habits.length >= 1 },
    { icon: '🔥', name: '3-day fire', desc: '3-day streak on any habit', unlocked: daily.some((h) => habitStreak(state, h) >= 3) },
    { icon: '⚡', name: 'Week warrior', desc: '7-day streak', unlocked: activeStreak7 > 0 },
    { icon: '🏆', name: 'Monthly legend', desc: '30-day streak', unlocked: activeStreak30 > 0 },
    { icon: '💯', name: 'Perfect day', desc: '100% today', unlocked: anyToday },
    { icon: '🚀', name: 'Goal getter', desc: 'Longest best streak', unlocked: longestBest >= 14 },
    { icon: '🧲', name: 'Habit stacker', desc: '5+ tracked habits', unlocked: state.habits.length >= 5 },
    { icon: '👑', name: 'Track master', desc: '10+ tracked habits', unlocked: state.habits.length >= 10 },
  ]

  return (
    <motion.div className="glass" initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }} style={{ padding: 22 }}>
      <h2 style={{ fontSize: '1.2rem' }}>Achievements 🏅</h2>
      <span style={{ color: 'var(--muted)', fontSize: '0.82rem' }}>Milestones you've unlocked. Keep the streak alive!</span>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 12, marginTop: 16 }}>
        {badges.map((b, i) => <Badge key={i} {...b} />)}
      </div>
    </motion.div>
  )
}
