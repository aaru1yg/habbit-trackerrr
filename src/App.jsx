import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useStore } from './store.jsx'
import Header from './components/Header.jsx'
import StatCards from './components/StatCards.jsx'
import TodayHabits from './components/TodayHabits.jsx'
import MasterGraph from './components/MasterGraph.jsx'
import MasterPie from './components/MasterPie.jsx'
import ProjectTracker from './components/ProjectTracker.jsx'
import Heatmap from './components/Heatmap.jsx'
import WeekBars from './components/WeekBars.jsx'
import BalanceRadar from './components/BalanceRadar.jsx'
import DurationPie from './components/DurationPie.jsx'
import Achievements from './components/Achievements.jsx'
import HabitsList from './components/HabitsList.jsx'
import HabitModal from './components/HabitModal.jsx'
import Confetti from './components/Confetti.jsx'

export default function App() {
  const { state, dispatch } = useStore()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [fire, setFire] = useState(0)
  const [toast, setToast] = useState(null)

  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2600)
  }

  const onFire = () => {
    setFire((f) => f + 1)
  }

  const openAdd = () => { setEditing(null); setModalOpen(true) }
  const openEdit = (h) => { setEditing(h); setModalOpen(true) }

  const onDelete = (id) => {
    const h = state.habits.find((x) => x.id === id)
    if (h && !window.confirm(`Delete "${h.name}"? This cannot be undone.`)) return
    dispatch({ type: 'DELETE_HABIT', id })
  }

  const onExport = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `aaru-habit-tracker-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    showToast('📤 Data exported!')
  }

  const onImport = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'application/json'
    input.onchange = async (e) => {
      const file = e.target.files[0]
      if (!file) return
      try {
        const text = await file.text()
        const data = JSON.parse(text)
        if (!data.habits) throw new Error('invalid')
        dispatch({ type: 'IMPORT_DATA', data })
        showToast('📥 Data imported!')
      } catch (err) {
        showToast('⚠️ Could not import that file')
      }
    }
    input.click()
  }

  const onReset = () => {
    if (!window.confirm('Reset to fresh demo data? Your current data will be replaced.')) return
    dispatch({ type: 'RESET_ALL' })
    showToast('🔄 Demo data loaded')
  }

  return (
    <div className="app-shell">
      <div className="aurora"><span className="blob1" /><span className="blob2" /><span className="blob3" /></div>
      <div className="grid-overlay" />

      <Header onAdd={openAdd} onExport={onExport} onImport={onImport} onReset={onReset} />

      <StatCards />

      <div className="split" style={{ marginBottom: 24 }}>
        <div className="stack">
          <TodayHabits onFire={onFire} />
        </div>
        <div className="stack">
          <WeekBars />
          <Heatmap />
        </div>
      </div>

      <MasterGraph />
      <MasterPie />
      <ProjectTracker />

      <div className="duo" style={{ marginTop: 24 }}>
        <BalanceRadar />
        <DurationPie />
      </div>

      <div style={{ marginTop: 24 }}>
        <HabitsList onEdit={openEdit} onDelete={onDelete} />
      </div>

      <div style={{ marginTop: 24 }}>
        <Achievements />
      </div>

      <HabitModal open={modalOpen} onClose={() => setModalOpen(false)} editing={editing} />

      <Confetti fire={fire} />

      <AnimatePresence>
        {toast && (
          <motion.div className="toast" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}>
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
