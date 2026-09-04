import { motion } from 'framer-motion'
import { format, subDays } from 'date-fns'
import { useStore, overallCompletion, habitStreak, bestStreak, todayStr, lastNDays } from '../store.jsx'

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function computeInsights(state) {
  const daily = state.habits.filter((h) => h.isDaily)
  const today = todayStr()

  // total done check-ins -> XP
  let xp = 0
  for (const h of daily) {
    for (const [d, c] of Object.entries(state.checkins[h.id] || {})) {
      if (c && c.done) xp += 1
    }
  }
  const level = Math.floor(Math.sqrt(xp / 4)) + 1
  const levelFloor = (level - 1) * (level - 1) * 4
  const levelCeil = level * level * 4
  const levelPct = Math.min(100, Math.round(((xp - levelFloor) / (levelCeil - levelFloor)) * 100))

  // weekly trend: avg last 7 vs prior 7
  const avgRange = (backStart, backEnd) => {
    let sum = 0, n = 0
    for (let i = backStart; i < backEnd; i++) {
      sum += overallCompletion(state, format(subDays(new Date(), i), 'yyyy-MM-dd'))
      n++
    }
    return n ? sum / n : 0
  }
  const recent7 = avgRange(0, 7)
  const prior7 = avgRange(7, 14)
  const trend = prior7 === 0 ? (recent7 > 0 ? 100 : 0) : Math.round(((recent7 - prior7) / prior7) * 100)

  // best day of week over last 8 weeks
  const daySums = Array(7).fill(0)
  const dayCounts = Array(7).fill(0)
  for (let i = 0; i < 56; i++) {
    const d = format(subDays(new Date(), i), 'yyyy-MM-dd')
    const wd = new Date(subDays(new Date(), i)).getDay()
    daySums[wd] += overallCompletion(state, d)
    dayCounts[wd] += 1
  }
  let bestDay = 0
  for (let i = 1; i < 7; i++) {
    if (dayCounts[i] && daySums[i] / dayCounts[i] > daySums[bestDay] / (dayCounts[bestDay] || 1)) bestDay = i
  }
  const bestDayAvg = dayCounts[bestDay] ? Math.round(daySums[bestDay] / dayCounts[bestDay]) : 0

  // top & weakest habit by best streak
  const ranked = daily
    .map((h) => ({ name: h, streak: bestStreak(state, h), cur: habitStreak(state, h) }))
    .sort((a, b) => b.streak - a.streak)
  const top = ranked[0]
  const weakest = ranked[ranked.length - 1]

  const activeDays = new Set()
  for (const h of daily) {
    for (const [d, c] of Object.entries(state.checkins[h.id] || {})) if (c && c.done) activeDays.add(d)
  }

  return { xp, level, levelPct, trend, bestDay, bestDayAvg, top, weakest, activeDays: activeDays.size }
}

export default function Insights() {
  const { state } = useStore()
  const i = computeInsights(state)
  const trendColor = i.trend >= 0 ? 'var(--good)' : 'var(--bad)'
  const trendArrow = i.trend >= 0 ? '▲' : '▼'

  return (
    <motion.div className="glass" initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }} style={{ padding: 22 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 style={{ fontSize: '1.2rem' }}>Deep insights 🧠</h2>
          <span style={{ color: 'var(--muted)', fontSize: '0.82rem' }}>Your trend, patterns & XP.</span>
        </div>
        <span className="chip futuristic" style={{ color: 'var(--text)' }}>
          <span className="dot" style={{ background: 'var(--accent)' }} />LVL {i.level}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 14, marginTop: 18 }}>
        <InsightCard label="Weekly trend" value={`${trendArrow} ${Math.abs(i.trend)}%`} color={trendColor} sub={i.trend >= 0 ? 'vs last week' : 'vs last week'} />
        <InsightCard label="Best day" value={WEEKDAYS[i.bestDay]} color="var(--accent-2)" sub={`${i.bestDayAvg}% avg`} />
        <InsightCard label="Active days" value={i.activeDays} color="var(--good)" sub="days you showed up" />
        <InsightCard label="Top habit" value={i.top ? `${i.top.name.emoji} ${i.top.name.name}` : '—'} color="var(--accent)" sub={i.top ? `${i.top.streak}-day best` : ''} />
      </div>

      {/* XP bar */}
      <div style={{ marginTop: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--muted)', marginBottom: 7 }}>
          <span style={{ fontWeight: 700, color: 'var(--text)' }}>{i.xp} XP</span>
          <span>Level {i.level} → {i.level + 1}</span>
        </div>
        <div style={{ height: 12, borderRadius: 999, background: 'rgba(255,255,255,0.08)', overflow: 'hidden', position: 'relative' }}>
          <motion.div
            animate={{ width: `${i.levelPct}%` }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
            style={{
              height: '100%',
              background: 'linear-gradient(90deg, var(--accent), var(--accent-2))',
              boxShadow: '0 0 16px var(--accent)',
              position: 'relative',
            }}>
            <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', fontSize: '0.6rem', color: '#0a0a12', fontWeight: 800 }}>{i.levelPct}%</span>
          </motion.div>
        </div>
      </div>

      {i.top && i.weakest && i.top.name.id !== i.weakest.name.id && (
        <div style={{ marginTop: 14, fontSize: '0.82rem', color: 'var(--muted)' }}>
          💡 Your strongest habit is <b style={{ color: 'var(--text)' }}>{i.top.name.name}</b> — focus an extra push on{' '}
          <b style={{ color: 'var(--warn)' }}>{i.weakest.name.name}</b> to balance your week.
        </div>
      )}
    </motion.div>
  )
}

function InsightCard({ label, value, color, sub }) {
  return (
    <div style={{ padding: '14px 16px', borderRadius: 16, background: 'rgba(0,0,0,0.22)', border: '1px solid var(--border)' }}>
      <div style={{ color: 'var(--muted)', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
      <div className="futuristic" style={{ fontSize: '1.2rem', fontWeight: 700, color, marginTop: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</div>
      <div style={{ color: 'var(--muted)', fontSize: '0.74rem', marginTop: 3 }}>{sub}</div>
    </div>
  )
}
