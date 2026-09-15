import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
/* Step 2 shell replaces the old sidebar/bottom nav. The legacy navigation
   component still exports WorkTabs and BrandMark used by existing screens
   and boot — those are left untouched. */
import ShellSidebar from './components/shell/ShellSidebar.jsx'
import ShellMobileNav from './components/shell/ShellMobileNav.jsx'
import ShellTopBar from './components/shell/ShellTopBar.jsx'
import ShellMore from './components/shell/ShellMore.jsx'
import PageContainer from './components/shell/PageContainer.jsx'
import { pageTitle, resolveActivePillar } from './components/shell/nav.js'
import './components/shell/shell.css'

/* The Omni Panel carries search, capture, commands and coach routing. It is
   lazy-loaded so the global interaction does not inflate the initial shell. */
const OmniPanel = lazy(() => import('./components/shell/OmniPanel.jsx'))
import Onboarding from './components/Onboarding.jsx'
import Confetti from './components/ui/Confetti.jsx'
import MigrationDialog from './components/auth/MigrationDialog.jsx'
import { isSheetOpen } from './components/ui/Sheet.jsx'
import TodayScreen from './screens/TodayScreen.jsx'
import { checkReminders, notify, checkWorkReminders, notifyWork } from './lib/reminders.js'
import { nowHHMM, todayStr } from './lib/dates.js'
import { IconPlus, IconOffline, IconProjects, IconAssignment, IconStack, IconSparkle } from './lib/icons.jsx'

/* Heavy screens are code-split; Today stays eager (it IS the product). */
const InsightsScreen = lazy(() => import('./screens/InsightsScreen.jsx'))
const MindScreen = lazy(() => import('./screens/MindScreen.jsx'))
const GoalsScreen = lazy(() => import('./screens/GoalsScreen.jsx'))
const GoalDetailScreen = lazy(() => import('./screens/GoalDetailScreen.jsx'))
const RecordScreen = lazy(() => import('./screens/RecordScreen.jsx'))
const SettingsScreen = lazy(() => import('./screens/SettingsScreen.jsx'))
const WorkScreen = lazy(() => import('./screens/WorkScreen.jsx'))
const ProjectDetailScreen = lazy(() => import('./screens/ProjectDetailScreen.jsx'))
const AssignmentDetailScreen = lazy(() => import('./screens/AssignmentDetailScreen.jsx'))
const HabitsScreen = lazy(() => import('./screens/HabitsScreen.jsx'))
const HabitDetailScreen = lazy(() => import('./screens/HabitDetailScreen.jsx'))
const AchievementsScreen = lazy(() => import('./screens/AchievementsScreen.jsx'))

/* DEV-ONLY primitive showcase (Step 1B visual proof). */
const PrimitiveShowcase = import.meta.env.DEV
  ? lazy(() => import('./components/primitives/Showcase.jsx'))
  : null
const WorkFoundationShowcase = import.meta.env.DEV
  ? lazy(() => import('./components/work/WorkFoundationShowcase.jsx'))
  : null

const ROUTES = [
  'today', 'work', 'calendar', 'week', 'insights', 'mind', 'goals', 'library', 'settings',
  'projects', 'assignments', 'workload', 'timeline', 'record', 'habits', 'achievements',
]
const DEV_ROUTES = import.meta.env.DEV ? ['__primitives'] : []

function useIsMobile() {
  const [m, setM] = useState(() => typeof window === 'undefined' ? false : window.matchMedia('(max-width: 767px)').matches)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia('(max-width: 767px)')
    const onChange = () => setM(mq.matches)
    mq.addEventListener?.('change', onChange)
    window.addEventListener('resize', onChange)
    return () => { mq.removeEventListener?.('change', onChange); window.removeEventListener('resize', onChange) }
  }, [])
  return m
}

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
  const isMobile = useIsMobile()
  const [fire, setFire] = useState(0)
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine !== false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [omniOpen, setOmniOpen] = useState(false)
  const [omniMode, setOmniMode] = useState('command')

  useEffect(() => { applySpatialMode() }, [])

  useEffect(() => {
    document.body.classList.add('has-new-shell')
    return () => document.body.classList.remove('has-new-shell')
  }, [])

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

  /* Global keyboard shortcuts: ⌘K / Ctrl+K = Omni command, '/' = search. */
  useEffect(() => {
    const inAField = () => {
      const el = document.activeElement
      if (!el) return true
      const isField = el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable
      const lingering = el.closest?.('[role="dialog"]') && !isSheetOpen()
      return isField && el.isConnected && !lingering
    }
    const onKey = (e) => {
      const wantsCommand = (e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === 'k'
      const wantsSearch = e.key === '/' && !e.metaKey && !e.ctrlKey && !e.altKey
      if (!wantsCommand && !wantsSearch) return
      if (isSheetOpen()) return
      if (wantsSearch && inAField()) return
      e.preventDefault()
      setOmniMode(wantsCommand ? 'command' : 'search')
      setOmniOpen(true)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => { setMoreOpen(false) }, [route, param])

  // Legacy pillar aliases — canonical URLs are /insights?view=mind|record
  // (P2 #11). Redirect /mind and /record hashes to the Insights sub-view
  // without creating a history entry, so deep-link bookmarks keep working.
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (route === 'mind') {
      window.history.replaceState(null, '', '#/insights?view=mind')
    } else if (route === 'record') {
      window.history.replaceState(null, '', '#/insights?view=record')
    }
  }, [route])

  const lastVisited = useRef(null)
  useEffect(() => {
    const knownRoutes = [...ROUTES, ...DEV_ROUTES]
    if (!knownRoutes.includes(route) || lastVisited.current === route) return
    lastVisited.current = route
    if (!DEV_ROUTES.includes(route)) {
      dispatch({ type: 'RECORD_SIGNAL', signal: 'screen-visit', target: route })
    }
  }, [route, dispatch])

  useEffect(() => { dispatch({ type: 'PRUNE_SIGNALS', days: 180 }) }, [dispatch])

  const onFire = useCallback(() => setFire((f) => f + 1), [])
  const closeOmni = useCallback(() => setOmniOpen(false), [])
  const openOmni = useCallback((mode = 'command') => { setOmniMode(mode); setOmniOpen(true) }, [])
  const openSearch = useCallback(() => openOmni('search'), [openOmni])

  const active = ROUTES.includes(route) ? canonicalParent(route) : 'today'
  const activePillar = resolveActivePillar(route)
  const view = query?.view || null
  const title = useMemo(() => pageTitle(route, view), [route, view])

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

  // Step 4G-3: pick an explicit content-width family per route.
  const pageSize = (() => {
    if (route === 'today') return 'narrow'
    if (route === 'work' || route === 'projects' || route === 'assignments' || route === 'workload' || route === 'timeline') return 'workspace'
    if (route === 'goals') return param ? 'detail' : 'workspace'
    if (route === 'habits') {
      if (param) return 'detail'
      if (view === 'calendar') return 'wide'
      if (view === 'week') return 'workspace'
      if (view === 'routines') return 'narrow'
      return 'workspace'
    }
    return undefined
  })()

  const isDevShowcase = import.meta.env.DEV && (route === '__primitives' || route === '__work-foundation')
  const isWorkFoundation = import.meta.env.DEV && route === '__work-foundation'

  return (
    <>
      <Backdrop />
      {/* V4: ambient/boot layers continue to run; the shell sits above Backdrop
          and below sheets/dialogs. PointerLight is retained for parity but
          visually subtle. */}
      <WorldLayer />
      <BootSequence />
      <PointerLight />

      <div className="app-root">
        {!isMobile && (
          <ShellSidebar
            route={route}
            name={state.profile.name}
            onSearch={openSearch}
            onOmni={() => openOmni('command')}
          />
        )}

        <div className="app-main">
          <ShellTopBar
            title={title}
            isMobile={isMobile}
            onSearch={openSearch}
            onOmni={() => openOmni('command')}
          />

          {!online && (
            <div className="app-offline" role="status">
              <IconOffline size={14} /> Offline — changes still save on this device
            </div>
          )}

          <ToastProvider>
            <UnlockWatcher />
            <WorkUIProvider>
              <HabitUIProvider onFire={onFire}>
                <main id="content">
                  <PageContainer key={`${activePillar}${param ? `/${param}` : ''}`} className={isDevShowcase ? 'app-page--showcase' : ''} size={isWorkFoundation ? 'workspace' : pageSize}>
                    {/* Legacy route-cam travel animation is preserved on
                        this wrapper so existing screens still transition. */}
                    <div className="route-cam">
                      <Suspense fallback={<ScreenFallback />}>
                        {active === 'today' && <TodayScreen onFire={onFire} onCapture={() => openOmni('create')} onSearch={openSearch} />}
                        {route === 'work' && <WorkScreen />}
                        {route === 'calendar' && <HabitsScreen view="calendar" ymParam={param} />}
                        {route === 'week' && <HabitsScreen view="week" />}
                        {route === 'insights' && (view === 'mind' ? <MindScreen /> : view === 'record' ? <RecordScreen /> : view === 'achievements' ? <AchievementsScreen route="achievements" /> : <InsightsScreen />)}
                        {route === 'mind' && <MindScreen />}
                        {route === 'goals' && (param ? <GoalDetailScreen id={param} /> : <GoalsScreen />)}
                        {route === 'library' && <HabitsScreen view="active" />}
                        {route === 'record' && <RecordScreen />}
                        {route === 'settings' && <SettingsScreen />}
                        {route === 'projects' && (param ? <ProjectDetailScreen id={param} /> : <WorkScreen route="projects" />)}
                        {route === 'assignments' && (param ? <AssignmentDetailScreen id={param} /> : <WorkScreen route="assignments" />)}
                        {route === 'workload' && <WorkScreen route="workload" />}
                        {route === 'timeline' && <WorkScreen route="timeline" />}
                        {route === 'achievements' && <AchievementsScreen route="achievements" />}
                        {route === 'habits' && (param ? <HabitDetailScreen id={param} /> : <HabitsScreen view={view || 'active'} />)}
                        {isDevShowcase && route === '__primitives' && PrimitiveShowcase && <PrimitiveShowcase />}
                        {isWorkFoundation && WorkFoundationShowcase && <WorkFoundationShowcase />}
                      </Suspense>
                    </div>
                  </PageContainer>
                </main>

                {/* Screen-specific contextual FABs are retained temporarily
                    (new shell Omni is the canonical global entry, but legacy
                    screens still reference these anchors during the rebuild). */}
                <Fab route={route} onCapture={() => openOmni('create')} />

                <Suspense fallback={null}>
                  <OmniPanel open={omniOpen} onClose={closeOmni} initialMode={omniMode} route={active} />
                </Suspense>
              </HabitUIProvider>
            </WorkUIProvider>

            <Confetti fire={fire} count={90} origin={{ x: 0.5, y: 0.35 }} />

            <MigrationDialog />
            <ReminderScheduler />
          </ToastProvider>
        </div>
      </div>

      {isMobile && (
        <ShellMobileNav
          route={route}
          onCapture={() => openOmni('command')}
          onMore={() => setMoreOpen(true)}
        />
      )}
      <ShellMore
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        onSearch={openSearch}
        onOmni={() => openOmni('command')}
      />
    </>
  )
}

/* ------------------------------------------------------------
   FAB — contextual legacy floaters. These are TEMPORARY during
   the shell migration; screens still expect them. Omni is the
   canonical entry, but per-screen quick-adds remain functional.
   ------------------------------------------------------------ */
function Fab({ route, onCapture }) {
  const habitUI = useHabitUI()
  const workUI = useWorkUI()
  const [open, setOpen] = useState(false)
  const isMobile = typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches

  useEffect(() => { setOpen(false) }, [route])

  // On mobile the nav already has Omni; skip the old floater to avoid
  // two overlapping buttons. Desktop keeps the legacy + button.
  if (isMobile) return null

  if (route === 'work') return <div className="fab-stack"><button className="btn primary floating" style={{ position: 'static' }} onClick={onCapture} aria-label="Create work with quick capture"><IconPlus size={22} /></button></div>

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
