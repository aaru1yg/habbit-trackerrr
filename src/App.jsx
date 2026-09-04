import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import { useStore } from './store.jsx'
import { useRoute } from './lib/router.jsx'
import { ToastProvider, useToast } from './components/ui/Toaster.jsx'
import HabitUIProvider, { useHabitUI } from './components/habits/HabitUIProvider.jsx'
import Backdrop from './components/layout/Backdrop.jsx'
import { BottomNav, Sidebar } from './components/layout/Navigation.jsx'
import Onboarding from './components/Onboarding.jsx'
import Confetti from './components/ui/Confetti.jsx'
import TodayScreen from './screens/TodayScreen.jsx'
import { checkReminders, notify } from './lib/reminders.js'
import { nowHHMM, todayStr } from './lib/dates.js'
import { IconPlus, IconOffline } from './lib/icons.jsx'

/* Heavy screens are code-split; Today stays eager (it IS the product). */
const CalendarScreen = lazy(() => import('./screens/CalendarScreen.jsx'))
const WeekScreen = lazy(() => import('./screens/WeekScreen.jsx'))
const InsightsScreen = lazy(() => import('./screens/InsightsScreen.jsx'))
const MindScreen = lazy(() => import('./screens/MindScreen.jsx'))
const GoalsScreen = lazy(() => import('./screens/GoalsScreen.jsx'))
const SettingsScreen = lazy(() => import('./screens/SettingsScreen.jsx'))

const ROUTES = ['today', 'calendar', 'week', 'insights', 'mind', 'goals', 'settings']

function ScreenFallback() {
  return (
    <div className="screen" style={{ display: 'grid', placeItems: 'center', minHeight: '50vh' }} role="status" aria-label="Loading">
      <span className="spinner" aria-hidden="true" />
    </div>
  )
}

export default function App() {
  const { state } = useStore()
  const { route, param } = useRoute()
  const [fire, setFire] = useState(0)
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine !== false)

  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])

  const onFire = () => setFire((f) => f + 1)

  if (!state.profile.onboarded) {
    return (
      <>
        <Backdrop />
        <Onboarding />
      </>
    )
  }

  const active = ROUTES.includes(route) ? route : 'today'

  return (
    <>
      <Backdrop />
      <Sidebar route={active} name={state.profile.name} />
      {!online && (
        <div className="offline-pill" role="status">
          <IconOffline size={14} /> Offline — changes still save on this device
        </div>
      )}

      <ToastProvider>
        <HabitUIProvider onFire={onFire}>
          <main id="content" style={{ position: 'relative' }}>
            <Suspense fallback={<ScreenFallback />}>
              {active === 'today' && <TodayScreen onFire={onFire} />}
              {active === 'calendar' && <CalendarScreen key={param || 'current'} ymParam={param} />}
              {active === 'week' && <WeekScreen />}
              {active === 'insights' && <InsightsScreen />}
              {active === 'mind' && <MindScreen />}
              {active === 'goals' && <GoalsScreen />}
              {active === 'settings' && <SettingsScreen />}
            </Suspense>
          </main>

          <Fab />
        </HabitUIProvider>

        {/* completion confetti (auto-disabled under reduced motion) */}
        <Confetti fire={fire} count={90} origin={{ x: 0.5, y: 0.35 }} />

        <ReminderScheduler />
      </ToastProvider>

      <BottomNav route={active} />
    </>
  )
}

/* Floating add button (mobile only — desktop uses screen headers). */
function Fab() {
  const habitUI = useHabitUI()
  return (
    <button className="btn primary floating" onClick={habitUI.openAdd} aria-label="Add a habit">
      <IconPlus size={24} />
    </button>
  )
}

/* Checks reminders every 30s while the app is open. */
function ReminderScheduler() {
  const { state } = useStore()
  const toast = useToast()
  const stateRef = useRef(state)
  stateRef.current = state

  useEffect(() => {
    const tick = () => {
      const s = stateRef.current
      if (!s?.habits?.length) return
      const due = checkReminders(s, nowHHMM(), todayStr())
      for (const h of due) {
        const shown = notify(h)
        if (!shown) toast.show(`Reminder: ${h.name}`)
      }
    }
    const id = setInterval(tick, 30000)
    tick()
    return () => clearInterval(id)
  }, [toast])

  return null
}
