import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import { useStore } from './store.jsx'
import { useRoute, navigate, canonicalParent } from './lib/router.jsx'
import { ToastProvider, useToast } from './components/ui/Toaster.jsx'
import UnlockWatcher from './components/achievements/UnlockWatcher.jsx'
import HabitUIProvider, { useHabitUI } from './components/habits/HabitUIProvider.jsx'
import WorkUIProvider, { useWorkUI } from './components/work/WorkUIProvider.jsx'
import Backdrop from './components/layout/Backdrop.jsx'
import PointerLight from './components/motion/PointerLight.jsx'
import WorldLayer from './components/spatial/WorldLayer.jsx'
import BootSequence from './components/spatial/BootSequence.jsx'
import { applySpatialMode } from './lib/spatial.js'
import { BottomNav, Sidebar, MoreSheet } from './components/layout/Navigation.jsx'
import SearchPalette from './components/layout/SearchPalette.jsx'
/* Phase E: the Command Center carries the capture parser and the command
   registry, so it is loaded on first ⌘K rather than on first paint. */
const CommandCenter = lazy(() => import('./components/layout/CommandCenter.jsx'))
import Onboarding from './components/Onboarding.jsx'
import Confetti from './components/ui/Confetti.jsx'
import MigrationDialog from './components/auth/MigrationDialog.jsx'
import { isSheetOpen } from './components/ui/Sheet.jsx'
import TodayScreen from './screens/TodayScreen.jsx'
import { checkReminders, notify, checkWorkReminders, notifyWork } from './lib/reminders.js'
import { nowHHMM, todayStr } from './lib/dates.js'
import { IconPlus, IconOffline, IconProjects, IconAssignment, IconStack, IconSparkle } from './lib/icons.jsx'

/* Heavy screens are code-split; Today stays eager (it IS the product). */
const CalendarScreen = lazy(() => import('./screens/CalendarScreen.jsx'))
const WeekScreen = lazy(() => import('./screens/WeekScreen.jsx'))
const InsightsScreen = lazy(() => import('./screens/InsightsScreen.jsx'))
const MindScreen = lazy(() => import('./screens/MindScreen.jsx'))
const GoalsScreen = lazy(() => import('./screens/GoalsScreen.jsx'))
const GoalDetailScreen = lazy(() => import('./screens/GoalDetailScreen.jsx'))
const RecordScreen = lazy(() => import('./screens/RecordScreen.jsx'))
const SettingsScreen = lazy(() => import('./screens/SettingsScreen.jsx'))
const ProjectsScreen = lazy(() => import('./screens/ProjectsScreen.jsx'))
const ProjectDetailScreen = lazy(() => import('./screens/ProjectDetailScreen.jsx'))
const AssignmentsScreen = lazy(() => import('./screens/AssignmentsScreen.jsx'))
const AssignmentDetailScreen = lazy(() => import('./screens/AssignmentDetailScreen.jsx'))
const WorkloadScreen = lazy(() => import('./screens/WorkloadScreen.jsx'))
const HabitsScreen = lazy(() => import('./screens/HabitsScreen.jsx'))
const HabitDetailScreen = lazy(() => import('./screens/HabitDetailScreen.jsx'))
const TimelineScreen = lazy(() => import('./screens/TimelineScreen.jsx'))
const AchievementsScreen = lazy(() => import('./screens/AchievementsScreen.jsx'))

const ROUTES = [
  'today', 'work', 'calendar', 'week', 'insights', 'mind', 'goals', 'library', 'settings',
  'projects', 'assignments', 'workload', 'timeline', 'record', 'habits', 'achievements',
]

function ScreenFallback() {
  return (
    <div className="screen" style={{ display: 'grid', placeItems: 'center', minHeight: '50vh' }} role="status" aria-label="Loading">
      <span className="spinner" aria-hidden="true" />
    </div>
  )
}

export default function App() {
  const { state, dispatch } = useStore()
  const { route, param, query } = useRoute()
  const [fire, setFire] = useState(0)
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine !== false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [commandOpen, setCommandOpen] = useState(false)

  // V4: publish the device's spatial tier once, keep it honest on change.
  useEffect(() => applySpatialMode(), [])

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

  /* '/' opens search and ⌘K / Ctrl+K opens the command center, anywhere
     except inside a field or an open dialog. Both share one guard so the
     two shortcuts can never fight over the same keystroke. */
  useEffect(() => {
    const inAField = () => {
      const el = document.activeElement
      if (!el) return true
      const isField = el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable
      // a field left focused inside a sheet that is animating out does not count
      const lingering = el.closest?.('[role="dialog"]') && !isSheetOpen()
      return isField && el.isConnected && !lingering
    }
    const onKey = (e) => {
      const wantsCommand = (e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === 'k'
      const wantsSearch = e.key === '/' && !e.metaKey && !e.ctrlKey && !e.altKey
      if (!wantsCommand && !wantsSearch) return
      if (isSheetOpen()) return
      // ⌘K is a chord, so it works from inside a field; '/' does not.
      if (wantsSearch && inAField()) return
      e.preventDefault()
      if (wantsCommand) setCommandOpen(true)
      else setSearchOpen(true)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Close the More sheet when the route changes.
  useEffect(() => { setMoreOpen(false) }, [route, param])

  /* Adaptive layer: one honest record per screen the user actually opens.
     Guarded by a ref so a re-render (or a StrictMode double-invoke) never
     inflates the count, and restricted to real routes so a stray hash is
     not recorded as behaviour. */
  const lastVisited = useRef(null)
  useEffect(() => {
    if (!ROUTES.includes(route) || lastVisited.current === route) return
    lastVisited.current = route
    dispatch({ type: 'RECORD_SIGNAL', signal: 'screen-visit', target: route })
  }, [route, dispatch])

  // Keep the log bounded: drop behaviour older than the window, once a session.
  useEffect(() => { dispatch({ type: 'PRUNE_SIGNALS', days: 180 }) }, [dispatch])

  const onFire = () => setFire((f) => f + 1)

  if (!state.profile.onboarded) {
    return (
      <>
        <Backdrop />
        <WorldLayer />
        <BootSequence />
        <Onboarding />
      </>
    )
  }

  const active = ROUTES.includes(route) ? canonicalParent(route) : 'today'
  const view = query?.view || null

  return (
    <>
      <Backdrop />
      {/* V4: the ambient environment sits under the whole app; the boot
          cinematic runs once per session above everything (skippable,
          reduced-motion aware). Neither holds data — see docs/V4-AUDIT.md. */}
      <WorldLayer />
      <BootSequence />
      <PointerLight />
      <Sidebar route={active} name={state.profile.name} onSearch={() => setSearchOpen(true)} />
      {!online && (
        <div className="offline-pill" role="status">
          <IconOffline size={14} /> Offline — changes still save on this device
        </div>
      )}

      <ToastProvider>
        <UnlockWatcher />
        <WorkUIProvider>
          <HabitUIProvider onFire={onFire}>
            <main id="content" style={{ position: 'relative' }}>
              {/* Route change = camera travel, not a swap (spec §8): the screen
                  rises ~90px out of depth in 420ms. Keyed so any route/param
                  change re-plays it; reduced motion disables it in CSS. */}
              <div key={`${active}${param ? `/${param}` : ''}`} className="route-cam">
                <Suspense fallback={<ScreenFallback />}>
                  {active === 'today' && <TodayScreen onFire={onFire} onCapture={() => setCommandOpen(true)} />}
                  {route === 'work' && (view === 'deliverables' || view === 'assignments' ? <AssignmentsScreen route="assignments" /> : view === 'workload' ? <WorkloadScreen route="workload" /> : view === 'deadlines' ? <TimelineScreen route="timeline" /> : <ProjectsScreen route="projects" />)}
                  {route === 'calendar' && <CalendarScreen key={param || 'current'} ymParam={param} />}
                  {route === 'week' && <WeekScreen />}
                  {route === 'insights' && (view === 'mind' ? <MindScreen /> : view === 'record' ? <RecordScreen /> : view === 'achievements' ? <AchievementsScreen route="achievements" /> : <InsightsScreen />)}
                  {route === 'mind' && <MindScreen />}
                  {route === 'goals' && (param ? <GoalDetailScreen id={param} /> : <GoalsScreen />)}
                  {route === 'library' && <HabitsScreen route="habits" />}
                  {route === 'record' && <RecordScreen />}
                  {route === 'settings' && <SettingsScreen />}
                  {route === 'projects' && (param ? <ProjectDetailScreen id={param} /> : <ProjectsScreen route="projects" />)}
                  {route === 'assignments' && (param ? <AssignmentDetailScreen id={param} /> : <AssignmentsScreen route="assignments" />)}
                  {route === 'workload' && <WorkloadScreen route="workload" />}
                  {route === 'timeline' && <TimelineScreen route="timeline" />}
                  {route === 'achievements' && <AchievementsScreen route="achievements" />}
                  {route === 'habits' && (view === 'calendar' ? <CalendarScreen /> : view === 'week' ? <WeekScreen /> : param ? <HabitDetailScreen id={param} /> : <HabitsScreen route="habits" />)}
                </Suspense>
              </div>
            </main>

            <Fab route={active} onCapture={() => setCommandOpen(true)} />
            <SearchPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
            <Suspense fallback={null}>
              <CommandCenter open={commandOpen} onClose={() => setCommandOpen(false)} />
            </Suspense>
          </HabitUIProvider>
        </WorkUIProvider>

        {/* completion confetti (auto-disabled under reduced motion) */}
        <Confetti fire={fire} count={90} origin={{ x: 0.5, y: 0.35 }} />

        <MigrationDialog />
        <ReminderScheduler />
      </ToastProvider>

      <BottomNav route={active} onMore={() => setMoreOpen(true)} onSearch={() => setSearchOpen(true)} onCapture={() => setCommandOpen(true)} />
      <MoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} route={active} onSearch={() => setSearchOpen(true)} />
    </>
  )
}

/* ------------------------------------------------------------
   FAB — context aware, but Add Habit is always ONE tap away on
   the habit screens (§11). It sits above the bottom nav, inside
   the safe area, and screens reserve bottom padding for it.
   ------------------------------------------------------------ */
function Fab({ route, onCapture }) {
  const habitUI = useHabitUI()
  const workUI = useWorkUI()
  const [open, setOpen] = useState(false)

  useEffect(() => { setOpen(false) }, [route])

  if (route === 'projects' || route === 'work') {
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
            <button className="fab-choice" role="menuitem" onClick={() => { setOpen(false); onCapture() }}>
              <IconSparkle size={17} /> Quick capture
            </button>
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
