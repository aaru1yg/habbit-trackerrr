import { motion } from 'framer-motion'
import AnimatedNumber from './AnimatedNumber.jsx'
import CircularProgress from './CircularProgress.jsx'
import { useStore, overallCompletion, habitStreak, todayStr } from '../store.jsx'

const cardAnim = {
  hidden: { opacity: 0, y: 24 },
  show: (i) => ({ opacity: 1, y: 0, transition: { delay: 0.15 + i * 0.08, duration: 0.6, ease: [0.16, 1, 0.3, 1] } }),
}

export default function StatCards() {
  const { state } = useStore()
  const today = todayStr()
  const daily = state.habits.filter((h) => h.isDaily)
  const projects = state.habits.filter((h) => !h.isDaily)

  const doneCount = daily.filter((h) => {
    const c = state.checkins[h.id]?.[today]
    return c && c.done
  }).length

  const overall = overallCompletion(state, today)
  const streaks = daily.map((h) => habitStreak(state, h))
  const bestStreak = streaks.length ? Math.max(...streaks) : 0
  const totalCheckins = daily.reduce((acc, h) => acc + Object.keys(state.checkins[h.id] || {}).length, 0)

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const weekday = new Date().getDay()
  const weekTodayIdx = weekday

  return (
    <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 18, marginBottom: 26 }}>
      <motion.div custom={0} variants={cardAnim} initial="hidden" animate="show" className="glass" style={{ padding: 22, display: 'flex', alignItems: 'center', gap: 18 }}>
        <CircularProgress size={104} stroke={10} value={overall / 100} color="#7c5cff" color2="#22d3ee" sublabel="today">
          <span style={{ fontSize: 26, fontWeight: 800, fontFamily: 'Space Grotesk' }}>{overall}<span style={{ fontSize: 14 }}>%</span></span>
        </CircularProgress>
        <div>
          <div style={{ color: 'var(--muted)', fontSize: '0.82rem', fontWeight: 600 }}>Today's completion</div>
          <div style={{ fontSize: '1.05rem', fontWeight: 700, marginTop: 4 }}>{doneCount}/{daily.length} habits</div>
          <div style={{ color: 'var(--good)', fontSize: '0.85rem', marginTop: 6 }}>⚡ {daily.length - doneCount} left</div>
        </div>
      </motion.div>

      <motion.div custom={1} variants={cardAnim} initial="hidden" animate="show" className="glass" style={{ padding: 22 }}>
        <div style={{ color: 'var(--muted)', fontSize: '0.82rem', fontWeight: 600 }}>Best active streak</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 12 }}>
          <AnimatedNumber value={bestStreak} className="" suffix="" />
          <span style={{ fontSize: '2.6rem', fontWeight: 800, fontFamily: 'Space Grotesk' }}>{bestStreak} 🔥</span>
        </div>
        <div style={{ color: 'var(--muted)', fontSize: '0.82rem', marginTop: 8 }}>days on your longest run</div>
      </motion.div>

      <motion.div custom={2} variants={cardAnim} initial="hidden" animate="show" className="glass" style={{ padding: 22 }}>
        <div style={{ color: 'var(--muted)', fontSize: '0.82rem', fontWeight: 600 }}>Total check-ins logged</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 12 }}>
          <AnimatedNumber value={totalCheckins} suffix="" />
          <span style={{ fontSize: '2.6rem', fontWeight: 800, fontFamily: 'Space Grotesk' }}>{totalCheckins}</span>
        </div>
        <div style={{ color: 'var(--muted)', fontSize: '0.82rem', marginTop: 8 }}>across {daily.length} daily habits</div>
      </motion.div>

      <motion.div custom={3} variants={cardAnim} initial="hidden" animate="show" className="glass" style={{ padding: 22 }}>
        <div style={{ color: 'var(--muted)', fontSize: '0.82rem', fontWeight: 600 }}>Projects in motion</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 12 }}>
          <AnimatedNumber value={projects.length} suffix="" />
          <span style={{ fontSize: '2.6rem', fontWeight: 800, fontFamily: 'Space Grotesk' }}>{projects.length} 🚀</span>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }} className="chips">
          {weekDays.slice(0, 7).map((d, i) => (
            <span key={d} style={{
              width: 20, height: 20, borderRadius: 6, display: 'grid', placeItems: 'center',
              fontSize: '0.6rem', fontWeight: 700,
              background: weekTodayIdx === i ? 'var(--accent)' : 'rgba(255,255,255,0.07)',
              color: weekTodayIdx === i ? '#0a0a12' : 'var(--muted)',
            }}>{d[0]}</span>
          ))}
        </div>
      </motion.div>
    </section>
  )
}
