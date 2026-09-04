import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore, PALETTE, EMOJI, todayStr } from '../store.jsx'

const UNIT_OPTIONS = [
  { value: 'times', label: 'Times' },
  { value: 'minutes', label: 'Minutes' },
  { value: 'pages', label: 'Pages' },
  { value: 'glasses', label: 'Glasses' },
  { value: 'percent', label: 'Percent' },
]

const blank = () => ({
  name: '',
  emoji: '🔥',
  color: PALETTE[Math.floor(Math.random() * PALETTE.length)],
  isDaily: true,
  durationType: 'forever',
  startDate: todayStr(),
  endDate: '',
  targetValue: 1,
  targetUnit: 'times',
  note: '',
})

export default function HabitModal({ open, onClose, editing }) {
  const { dispatch } = useStore()
  const [form, setForm] = useState(null)

  useEffect(() => {
    if (open) setForm(editing ? { ...editing } : blank())
  }, [open, editing])

  // Guard: never render with a null form (avoids a flash on first open).
  if (!open) return null
  const f = form || blank()

  const set = (k, v) => setForm((prev) => ({ ...(prev || blank()), [k]: v }))

  const isProject = !f.isDaily
  const isRange = f.durationType === 'shortterm'

  const save = () => {
    if (!f.name.trim()) return
    const payload = {
      ...f,
      name: f.name.trim(),
      endDate: isRange ? f.endDate : (f.durationType === 'oneday' ? f.startDate : null),
      targetValue: f.durationType === 'oneday' ? (f.isDaily ? 1 : 100) : f.targetValue,
      targetUnit: f.durationType === 'oneday' ? (f.isDaily ? 'times' : 'percent') : f.targetUnit,
    }
    if (editing) dispatch({ type: 'UPDATE_HABIT', id: editing.id, patch: payload })
    else dispatch({ type: 'ADD_HABIT', habit: { ...payload, id: Math.random().toString(36).slice(2, 10) } })
    onClose()
  }

  const onTypeClick = (isDaily) => {
    set('isDaily', isDaily)
    if (isDaily) {
      set('durationType', 'forever')
      set('targetUnit', 'times')
      set('targetValue', 1)
    } else {
      set('durationType', 'shortterm')
      set('targetUnit', 'percent')
      set('targetValue', 100)
    }
  }

  const onDurationClick = (dt) => {
    set('durationType', dt)
    if (dt === 'oneday') {
      set('targetValue', f.isDaily ? 1 : 100)
      set('targetUnit', f.isDaily ? 'times' : 'percent')
    }
  }

  return (
    <AnimatePresence>
      <motion.div className="overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(4,6,14,0.7)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: 0.96 }}
          transition={{ type: 'spring', damping: 26, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
          className="glass" style={{ width: 'min(560px, 100%)', maxHeight: '90vh', overflowY: 'auto', padding: 26 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
            <h2 style={{ fontSize: '1.3rem' }}>{editing ? 'Edit' : 'New'} habit</h2>
            <button className="btn ghost icon" onClick={onClose}>✕</button>
          </div>

          <div className="label" style={{ marginBottom: 4 }}>What kind is this?</div>
          <div className="seg" style={{ width: '100%', marginBottom: 18 }}>
            <button className={f.isDaily ? 'active' : ''} onClick={() => onTypeClick(true)} style={{ flex: 1 }}>📅 Daily habit</button>
            <button className={!f.isDaily ? 'active' : ''} onClick={() => onTypeClick(false)} style={{ flex: 1 }}>🚀 Project / activity</button>
          </div>

          <div className="label">Name</div>
          <input className="field" placeholder={isProject ? 'e.g. Build portfolio site' : 'e.g. Drink water'} value={f.name}
            onChange={(e) => set('name', e.target.value)} autoFocus />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
            <div>
              <div className="label">Emoji</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 6 }}>
                {EMOJI.map((e) => (
                  <button key={e} onClick={() => set('emoji', e)}
                    style={{ fontSize: 18, padding: 5, borderRadius: 9, border: '1px solid var(--border)', background: f.emoji === e ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.03)' }}>{e}</button>
                ))}
              </div>
            </div>
            <div>
              <div className="label">Color</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 6 }}>
                {PALETTE.map((c) => (
                  <button key={c} onClick={() => set('color', c)}
                    style={{ height: 30, borderRadius: 9, border: f.color === c ? '2px solid #fff' : '1px solid var(--border)', background: c }} />
                ))}
              </div>
            </div>
          </div>

          {/* Duration — available for BOTH daily habits and projects */}
          <div style={{ marginTop: 16 }}>
            <div className="label">How long should it last?</div>
            <div className="seg" style={{ width: '100%' }}>
              <button className={f.durationType === 'forever' ? 'active' : ''} onClick={() => onDurationClick('forever')} style={{ flex: 1 }}>♾️ Forever</button>
              <button className={f.durationType === 'oneday' ? 'active' : ''} onClick={() => onDurationClick('oneday')} style={{ flex: 1 }}>📍 One-day</button>
              <button className={f.durationType === 'shortterm' ? 'active' : ''} onClick={() => onDurationClick('shortterm')} style={{ flex: 1 }}>📆 Short-term</button>
            </div>
          </div>

          {f.isDaily ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
              <div>
                <div className="label">Daily target value</div>
                <input type="number" min="1" className="field" value={f.targetValue}
                  onChange={(e) => set('targetValue', Math.max(1, Number(e.target.value) || 1))} />
              </div>
              <div>
                <div className="label">Unit</div>
                <select className="field" value={f.targetUnit} onChange={(e) => set('targetUnit', e.target.value)}>
                  {UNIT_OPTIONS.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
                </select>
              </div>
            </div>
          ) : (
            <div style={{ marginTop: 16, padding: '12px 14px', borderRadius: 12, background: 'rgba(34,211,238,0.08)', border: '1px solid rgba(34,211,238,0.25)', fontSize: '0.84rem', color: 'var(--muted)' }}>
              🚀 Tracked as a <b style={{ color: 'var(--text)' }}>project</b> — you'll set its progress in steps of 10% (0–100), with its own graph & pie chart. Choose <b style={{ color: 'var(--text)' }}>One-day</b> for a single event, or <b style={{ color: 'var(--text)' }}>Short-term</b> for a deadline project.
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: f.durationType === 'shortterm' ? '1fr 1fr' : '1fr', gap: 16, marginTop: 16 }}>
            <div>
              <div className="label">{f.durationType === 'oneday' ? 'On this day' : 'Start date'}</div>
              <input type="date" className="field" value={f.startDate} onChange={(e) => set('startDate', e.target.value)} />
            </div>
            {f.durationType === 'shortterm' && (
              <div>
                <div className="label">End date</div>
                <input type="date" className="field" value={f.endDate} min={f.startDate} onChange={(e) => set('endDate', e.target.value)} />
              </div>
            )}
          </div>

          {f.durationType === 'oneday' && (
            <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 12, background: 'rgba(251,113,133,0.1)', border: '1px solid rgba(251,113,133,0.3)', color: 'var(--bad)', fontSize: '0.82rem' }}>
              📍 One-day mode: track a single-time activity (event, exam, deadline) as done/not-done on that day only.
            </div>
          )}

          <div className="label" style={{ marginTop: 16 }}>Note (optional)</div>
          <textarea className="field" rows="2" placeholder="Why this habit matters to you..." value={f.note} onChange={(e) => set('note', e.target.value)} />

          <div style={{ display: 'flex', gap: 12, marginTop: 22, justifyContent: 'flex-end' }}>
            <button className="btn ghost" onClick={onClose}>Cancel</button>
            <button className="btn primary" onClick={save}>{editing ? 'Save changes' : 'Create habit'} ✨</button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
