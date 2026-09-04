import { motion } from 'framer-motion'
import { format } from 'date-fns'
import { useStore } from '../store.jsx'

export default function Header({ onAdd, onExport, onImport, onReset }) {
  const { state } = useStore()
  const name = state.profile?.name || 'Aaru'
  const hour = new Date().getHours()
  const greeting = hour < 5 ? 'Night owl mode' : hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const dateLabel = format(new Date(), 'EEEE, MMMM d')

  return (
    <motion.header
      initial={{ opacity: 0, y: -24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      style={{ marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <motion.div
          whileHover={{ scale: 1.08, rotate: -6 }}
          style={{
            width: 62, height: 62, borderRadius: 20, display: 'grid', placeItems: 'center',
            fontSize: 30, background: 'linear-gradient(135deg, rgba(124,92,255,0.35), rgba(34,211,238,0.3))',
            border: '1px solid var(--border-strong)', boxShadow: '0 10px 30px rgba(124,92,255,0.4)',
          }}
        >
          🔥
        </motion.div>
        <div>
          <motion.h1
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            style={{ fontSize: 'clamp(1.6rem, 4vw, 2.4rem)', lineHeight: 1.05 }}
          >
            {greeting}, {name} <span style={{ display: 'inline-block' }}>👋</span>
          </motion.h1>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
            style={{ margin: '6px 0 0', color: 'var(--muted)', fontSize: '0.95rem' }}>
            {dateLabel} · Your {state.habits.length} tracked habits are waiting for you.
          </motion.p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <button className="btn ghost icon" title="Import data" onClick={onImport}>📥</button>
        <button className="btn ghost icon" title="Export data" onClick={onExport}>📤</button>
        <button className="btn ghost icon" title="Reset demo data" onClick={onReset}>🔄</button>
        <motion.button whileTap={{ scale: 0.94 }} className="btn primary" onClick={onAdd}>＋ New habit</motion.button>
      </div>
    </motion.header>
  )
}
