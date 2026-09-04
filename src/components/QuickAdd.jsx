import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore, PRESETS, PALETTE, EMOJI, todayStr, uid } from '../store.jsx'

// Always-visible "add" bar + preset chips. Quick way in; full modal for details.
export default function QuickAdd({ onOpenModal, onToast }) {
  const { state, dispatch } = useStore()
  const [name, setName] = useState('')
  const daily = state.habits.filter((h) => h.isDaily).length
  const projects = state.habits.filter((h) => !h.isDaily).length

  const create = (habit) => {
    dispatch({
      type: 'ADD_HABIT',
      habit: {
        id: uid(), isDaily: true, durationType: 'forever', startDate: todayStr(), endDate: null,
        targetValue: 1, targetUnit: 'times', note: '', ...habit,
      },
    })
    onToast && onToast(`✅ Added "${habit.name}"`)
  }

  const submit = (e) => {
    e.preventDefault()
    const n = name.trim()
    if (!n) return
    const preset = PRESETS.find((p) => p.name.toLowerCase() === n.toLowerCase())
    create({
      name: n,
      emoji: preset?.emoji || EMOJI[state.habits.length % EMOJI.length],
      color: preset?.color || PALETTE[state.habits.length % PALETTE.length],
    })
    setName('')
  }

  const available = PRESETS.filter((p) => !state.habits.some((h) => h.name.toLowerCase() === p.name.toLowerCase()))

  return (
    <motion.div className="glass" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      style={{ padding: 18, marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: '1.1rem' }}>Add a habit or project ✨</h2>
          <span style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>
            {state.habits.length === 0 ? 'Fresh start — nothing is pre-filled. Everything you see will be yours.' : `${daily} daily habit${daily === 1 ? '' : 's'} · ${projects} project${projects === 1 ? '' : 's'}`}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn" onClick={() => onOpenModal('habit')}>📅 New habit</button>
          <button className="btn" onClick={() => onOpenModal('project')}>🚀 New project</button>
        </div>
      </div>

      <form onSubmit={submit} style={{ display: 'flex', gap: 10, marginTop: 14 }}>
        <input className="field" placeholder="Type a habit name and press Enter… e.g. Wake up at 05:00" value={name} onChange={(e) => setName(e.target.value)} aria-label="Quick add habit name" />
        <button type="submit" className="btn primary" disabled={!name.trim()} style={{ flexShrink: 0 }}>＋ Add</button>
      </form>

      <AnimatePresence>
        {available.length > 0 && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} style={{ overflow: 'hidden' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
              {available.slice(0, 10).map((p) => (
                <motion.button key={p.name} layout whileHover={{ y: -2 }} whileTap={{ scale: 0.95 }} onClick={() => create(p)} type="button"
                  style={{ padding: '6px 11px', borderRadius: 999, fontSize: '0.78rem', fontWeight: 600, border: `1px solid ${p.color}55`, background: `${p.color}18`, color: 'var(--text)' }}>
                  ＋ {p.emoji} {p.name}
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export function Fab({ onClick }) {
  return (
    <motion.button
      onClick={onClick}
      aria-label="Add new habit or project"
      title="Add new"
      initial={{ scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 0.4 }}
      whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }}
      style={{
        position: 'fixed', right: 22, bottom: 22, zIndex: 900, width: 60, height: 60, borderRadius: 20, border: 'none',
        background: 'linear-gradient(120deg, var(--accent), var(--accent-2))', color: '#0a0a12', fontSize: 30, fontWeight: 800, lineHeight: 1,
        boxShadow: '0 14px 36px rgba(124,92,255,0.55)', display: 'grid', placeItems: 'center',
      }}>
      ＋
    </motion.button>
  )
}
