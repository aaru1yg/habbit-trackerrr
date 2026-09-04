import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { format } from 'date-fns'
import { useStore } from '../store.jsx'

const ACCENTS = [
  { id: 'default', label: 'Aurora', c1: '#7c5cff', c2: '#22d3ee' },
  { id: 'cyber', label: 'Cyber', c1: '#ff5d8f', c2: '#ffb703' },
  { id: 'emerald', label: 'Emerald', c1: '#10b981', c2: '#22d3ee' },
  { id: 'violet', label: 'Violet', c1: '#a855f7', c2: '#ec4899' },
  { id: 'azure', label: 'Azure', c1: '#38bdf8', c2: '#818cf8' },
]

export default function Header({ onAdd, onExport, onImport, onReset }) {
  const { state, dispatch } = useStore()
  const profile = state.profile || { name: 'Aaru' }
  const [accent, setAccent] = useState(localStorage.getItem('aaru.accent') || 'default')
  const [installEvt, setInstallEvt] = useState(null)
  const [online, setOnline] = useState(navigator.onLine !== false)

  useEffect(() => {
    document.body.setAttribute('data-accent', accent === 'default' ? '' : accent)
    localStorage.setItem('aaru.accent', accent)
  }, [accent])

  useEffect(() => {
    const onPrompt = (e) => { e.preventDefault(); setInstallEvt(e) }
    const onInstalled = () => setInstallEvt(null)
    const onOnline = () => setOnline(true)
    const onOffline = () => setOnline(false)
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  const install = async () => {
    if (!installEvt) return
    installEvt.prompt()
    await installEvt.userChoice
    setInstallEvt(null)
  }

  const editName = () => {
    const n = window.prompt("What's your name?", profile.name || 'Aaru')
    if (n && n.trim()) dispatch({ type: 'SET_PROFILE', patch: { name: n.trim() } })
  }

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
            fontSize: 30, background: 'linear-gradient(135deg, rgba(124,92,255,0.4), rgba(34,211,238,0.3))',
            border: '1px solid var(--border-strong)', boxShadow: '0 0 26px rgba(124,92,255,0.55)',
          }}
        >
          🔥
        </motion.div>
        <div>
          <motion.h1
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            style={{ fontSize: 'clamp(1.6rem, 4vw, 2.4rem)', lineHeight: 1.05 }}
          >
            {greeting}, <span className="title-glow" onClick={editName} style={{ cursor: 'pointer' }} title="Edit name">{profile.name}</span> <span style={{ display: 'inline-block' }}>👋</span>
          </motion.h1>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
            style={{ margin: '6px 0 0', color: 'var(--muted)', fontSize: '0.95rem' }}>
            {dateLabel} · {state.habits.length} trackers ready.
          </motion.p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-end' }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <button className="btn ghost icon" title="Import data" onClick={onImport}>📥</button>
          <button className="btn ghost icon" title="Export data" onClick={onExport}>📤</button>
          <button className="btn ghost icon" title="Erase all data & start fresh" onClick={onReset}>🔄</button>
          <span className={`chip`} style={{ fontSize: '0.74rem', color: online ? 'var(--good)' : 'var(--warn)' }}>
            <span className="dot" style={{ background: online ? 'var(--good)' : 'var(--warn)' }} />
            {online ? 'Online' : 'Offline mode'}
          </span>
          {installEvt && (
            <button className="btn primary" onClick={install}>📲 Install app</button>
          )}
          <motion.button whileTap={{ scale: 0.94 }} className="btn primary" onClick={onAdd}>＋ New</motion.button>
        </div>

        {/* accent theme switcher */}
        <div className="seg" style={{ padding: 4 }}>
          {ACCENTS.map((a) => (
            <button key={a.id} onClick={() => setAccent(a.id)}
              style={{ padding: '5px 10px', display: 'flex', alignItems: 'center', gap: 6 }}
              className={accent === a.id ? 'active' : ''}
              title={a.label}>
              <span style={{ width: 12, height: 12, borderRadius: '50%', background: `linear-gradient(135deg, ${a.c1}, ${a.c2})` }} />
              <span style={{ fontSize: '0.72rem' }}>{a.label}</span>
            </button>
          ))}
        </div>
      </div>
    </motion.header>
  )
}
