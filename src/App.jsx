import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import { useStore } from './store.jsx'
import { useRoute, navigate } from './lib/router.jsx'
import { ToastProvider, useToast } from './components/ui/Toaster.jsx'
import HabitUIProvider, { useHabitUI } from './components/habits/HabitUIProvider.jsx'
import WorkUIProvider, { useWorkUI } from './components/work/WorkUIProvider.jsx'
import Backdrop from './components/layout/Backdrop.jsx'
import { BottomNav, Sidebar, MoreSheet } from './components/layout/Navigation.jsx'
import SearchPalette from './components/layout/SearchPalette.jsx'
import Onboarding from './components/Onboarding.jsx'
import Confetti from './components/ui/Confetti.jsx'
import { isSheetOpen } from './components/ui/Sheet.jsx'
import TodayScreen from './screens/TodayScreen.jsx'
import { checkReminders, notify, checkWorkReminders, notifyWork } from './lib/reminders.js'
import { nowHHMM, todayStr } from './lib/dates.js'
import { IconPlus, IconOffline, IconProjects, IconAssignment, IconStack } from './lib/icons.jsx'

/* Heavy screens are code-split; Today stays eager (it IS the product). */
const CalendarScreen = lazy(() => import('./screens/CalendarScreen.jsx'))
const WeekScreen = lazy(() => import('./screens/WeekScreen.jsx'))
const InsightsScreen = lazy(() => import('./screens/InsightsScreen.jsx'))
const MindScreen = lazy(() => import('./screens/MindScreen.jsx'))
const GoalsScreen = lazy(() => import('./screens/GoalsScreen.jsx'))
const LibraryScreen = lazy(() => import('./screens/LibraryScreen.jsx'))
const RecordScreen = lazy(() => import('./screens/RecordScreen.jsx'))
const SettingsScreen = lazy(() => import('./screens/SettingsScreen.jsx'))
const ProjectsScreen = lazy(() => import('./screens/ProjectsScreen.jsx'))
const ProjectDetailScreen = lazy(() => import('./screens/ProjectDetailScreen.jsx'))
const AssignmentsScreen = lazy(() => import('./screens/AssignmentsScreen.jsx'))
const AssignmentDetailScreen = lazy(() => import('./screens/AssignmentDetailScreen.jsx'))
const WorkloadScreen = lazy(() => import('./screens/WorkloadScreen.jsx'))
const TimelineScreen = lazy(() => import('./screens/TimelineScreen.jsx'))

const ROUTES = [
  'today', 'calendar', 'week', 'insights', 'mind', 'goals', 'library', 'settings',
  'projects', 'assignments', 'workload', 'timeline', 'record',
]

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
  const [moreOpen, setMoreOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)

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

  // '/' opens search anywhere except inside a field or dialog.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === '/' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const el = document.activeElement
        if (!el || isSheetOpen()) return
        const isField = el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable
        // a field left focused inside a sheet that is animating out does not count
        const lingering = el.closest?.('[role="dialog"]') && !isSheetOpen()
        if (isField && el.isConnected && !lingering) return
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Close the More sheet when the route changes.
  useEffect(() => { setMoreOpen(false) }, [route, param])

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
      <Sidebar route={active} name={state.profile.name} onSearch={() => setSearchOpen(true)} />
      {!online && (
        <div className="offline-pill" role="status">
          <IconOffline size={14} /> Offline — changes still save on this device
        </div>
      )}

      <ToastProvider>
        <WorkUIProvider>
          <HabitUIProvider onFire={onFire}>
            <main id="content" style={{ position: 'relative' }}>
              <Suspense fallback={<ScreenFallback />}>
                {active === 'today' && <TodayScreen onFire={onFire} />}
                {active === 'calendar' && <CalendarScreen key={param || 'current'} ymParam={param} />}
                {active === 'week' && <WeekScreen />}
                {active === 'insights' && <InsightsScreen />}
                {active === 'mind' && <MindScreen />}
                {active === 'goals' && <GoalsScreen />}
                {active === 'library' && <LibraryScreen />}
                {active === 'record' && <RecordScreen />}
                {active === 'settings' && <SettingsScreen />}
                {active === 'projects' && (param ? <ProjectDetailScreen id={param} /> : <ProjectsScreen route={active} />)}
                {active === 'assignments' && (param ? <AssignmentDetailScreen id={param} /> : <AssignmentsScreen route={active} />)}
                {active === 'workload' && <WorkloadScreen route={active} />}
                {active === 'timeline' && <TimelineScreen route={active} />}
              </Suspense>
            </main>

            <Fab route={active} />
            <SearchPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
          </HabitUIProvider>
        </WorkUIProvider>

        {/* completion confetti (auto-disabled under reduced motion) */}
        <Confetti fire={fire} count={90} origin={{ x: 0.5, y: 0.35 }} />

        <ReminderScheduler />
      </ToastProvider>

      <BottomNav route={active} onMore={() => setMoreOpen(true)} onSearch={() => setSearchOpen(true)} />
      <MoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} route={active} onSearch={() => setSearchOpen(true)} />
    </>
  )
}

/* ------------------------------------------------------------
   FAB — context aware, but Add Habit is always ONE tap away on
   the habit screens (§11). It sits above the bottom nav, inside
   the safe area, and screens reserve bottom padding for it.
   ------------------------------------------------------------ */
function Fab({ route }) {
  const habitUI = useHabitUI()
  const workUI = useWorkUI()
  const [open, setOpen] = useState(false)

  useEffect(() => { setOpen(false) }, [route])

  if (route === 'projects') {
    return (
      <div className="fab-stack">
        <button className="btn primary floating" style={{ position: 'static' }} onClick={workUI.newProject} aria-label="Add a project">
          <IconProjects size={22} />
        </button>
      </div>
    )
  }
  if (route === 'assignments') {
    return (
      <div className="fab-stack">
        <button className="btn primary floating" style={{ position: 'static' }} onClick={() => workUI.newAssignment()} aria-label="Add an assignment">
          <IconAssignment size={22} />
        </button>
      </div>
    )
  }
  if (route === 'workload' || route === 'timeline') {
    return (
      <div className="fab-stack">
        {open && (
          <div className="fab-menu" role="menu" aria-label="Add">
            <button className="fab-choice" role="menuitem" onClick={() => { setOpen(false); habitUI.openAdd() }}>
              <IconPlus size={17} /> Habit
            </button>
            <button className="fab-choice" role="menuitem" onClick={() => { setOpen(false); workUI.newProject() }}>
              <IconProjects size={17} /> Project
            </button>
            <button className="fab-choice" role="menuitem" onClick={() => { setOpen(false); workUI.newAssignment() }}>
              <IconAssignment size={17} /> Assignment
            </button>
          </div>
        )}
        <button className="btn primary floating" style={{ position: 'static' }} onClick={() => setOpen((o) => !o)}
          aria-label="Add a habit, project or assignment" aria-expanded={open}>
          {open ? <IconStack size={22} /> : <IconPlus size={24} />}
        </button>
      </div>
    )
  }

  return (
    <div className="fab-stack">
      <button className="btn primary floating" style={{ position: 'static' }} onClick={habitUI.openAdd} aria-label="Add a habit">
        <IconPlus size={24} />
      </button>
    </div>
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
      if (!s) return
      if (s.habits?.length) {
        const due = checkReminders(s, nowHHMM(), todayStr())
        for (const h of due) {
          const shown = notify(h)
          if (!shown) toast.show(`Reminder: ${h.name}`)
        }
      }
      // Deadline alerts: one per tick (most urgent first) so opening the app
      // never fires a burst of toasts. Each item alerts once per day.
      if (s.profile?.workReminders) {
        const due = checkWorkReminders(s, { thresholdHours: s.profile.workReminderHours || 24 })
          .sort((a, b) => (a.status.hoursLeft ?? 0) - (b.status.hoursLeft ?? 0))
        const next = due[0]
        if (next) {
          const shown = notifyWork(next.kind, next.item, next.status)
          if (!shown) {
            toast.show(`${next.item.name}: ${next.status.dueText || 'deadline approaching'}`, {
              actionLabel: 'Open',
              onAction: () => { window.location.hash = `#/${next.kind}s/${next.item.id}` },
            })
          }
        }
      }
    }
    const id = setInterval(tick, 30000)
    tick()
    return () => clearInterval(id)
  }, [toast])

  return null
}

export { navigate }
