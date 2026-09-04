import { motion } from 'framer-motion'
import { useState } from 'react'
import { useStore, buildHeatmap } from '../store.jsx'

const LEVELS = ['rgba(255,255,255,0.05)', 'rgba(124,92,255,0.3)', 'rgba(124,92,255,0.5)', 'rgba(124,92,255,0.72)', 'rgba(34,211,238,0.95)']
const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default function Heatmap() {
  const { state } = useStore()
  const [weeks, setWeeks] = useState(16)
  const grid = buildHeatmap(state, weeks)
  const [hover, setHover] = useState(null)

  return (
    <motion.div className="glass" initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }} style={{ padding: 22 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: '1.2rem' }}>Consistency heatmap 🔥</h2>
          <span style={{ color: 'var(--muted)', fontSize: '0.82rem' }}>How consistently you showed up, week by week.</span>
        </div>
        <div className="seg">
          {[12, 16, 24].map((w) => (
            <button key={w} className={weeks === w ? 'active' : ''} onClick={() => setWeeks(w)}>{w}w</button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 16, marginTop: 18 }}>
        <div style={{ display: 'grid', gap: 5, gridTemplateColumns: 'auto 1fr' }}>
          <div style={{ display: 'grid', gridTemplateRows: 'repeat(7, 1fr)', gap: 4, fontSize: '0.62rem', color: 'var(--muted)', textAlign: 'right', paddingRight: 6 }}>
            {DAY.map((d, i) => <div key={d} style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', height: 15 }}>{i === 0 ? d : i % 2 === 0 ? d[0] : ''}</div>)}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${weeks}, 1fr)`, gap: 4 }}>
            {grid.map((row, ri) =>
              row.map((cell, ci) => {
                const info = hover && hover.date === cell.date
                return (
                  <motion.div
                    key={`${ri}-${ci}`}
                    onMouseEnter={() => setHover(cell)}
                    onMouseLeave={() => setHover(null)}
                    whileHover={{ scale: 1.4 }}
                    initial={{ opacity: 0, scale: 0.4 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: (ri * weeks + ci) * 0.002, duration: 0.25 }}
                    style={{
                      width: 15, height: 15, borderRadius: 4, background: LEVELS[cell.level],
                      transition: 'background 0.2s',
                      boxShadow: cell.level === 4 ? '0 0 6px rgba(34,211,238,0.4)' : 'none',
                      outline: info ? '1px solid #fff' : 'none',
                    }}
                    title={`${cell.date} · ${cell.level * 25}%`}
                  />
                )
              })
            )}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, justifyContent: 'flex-end', fontSize: '0.72rem', color: 'var(--muted)' }}>
        Less
        {LEVELS.map((c, i) => <span key={i} style={{ width: 12, height: 12, borderRadius: 3, background: c, display: 'inline-block' }} />)}
        More
      </div>
      {hover && (
        <div style={{ color: 'var(--muted)', fontSize: '0.8rem', marginTop: 8, textAlign: 'center' }}>
          {hover.date} · {hover.level * 25}% overall completion
        </div>
      )}
    </motion.div>
  )
}
