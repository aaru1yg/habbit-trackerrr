/* ============================================================
   APP — route table. Six destinations, three detail views.
   ============================================================ */
import { lazy, Suspense } from 'react'
import { useRoute } from './app/router.jsx'
import Shell from './app/Shell.jsx'
import TodayScreen from './features/today/TodayScreen.jsx'

/* Today is in the main bundle because it is always the first
   paint. Everything else is split, so the initial download stays
   small. */
const HabitsScreen   = lazy(() => import('./features/habits/HabitsScreen.jsx'))
const HabitDetail    = lazy(() => import('./features/habits/HabitDetail.jsx'))
const WorkScreen     = lazy(() => import('./features/work/WorkScreen.jsx'))
const WorkDetail     = lazy(() => import('./features/work/WorkDetail.jsx'))
const GoalsScreen    = lazy(() => import('./features/goals/GoalsScreen.jsx'))
const GoalDetail     = lazy(() => import('./features/goals/GoalDetail.jsx'))
const InsightsScreen = lazy(() => import('./features/insights/InsightsScreen.jsx'))
const SettingsScreen = lazy(() => import('./features/settings/SettingsScreen.jsx'))
const AccountScreen  = lazy(() => import('./features/account/AccountScreen.jsx'))
const PrivacyScreen  = lazy(() => import('./features/legal/PrivacyScreen.jsx'))
const TermsScreen    = lazy(() => import('./features/legal/TermsScreen.jsx'))

const ROUTES = {
  today:    TodayScreen,
  habits:   HabitsScreen,
  habit:    HabitDetail,
  work:     WorkScreen,
  goals:    GoalsScreen,
  goal:     GoalDetail,
  insights: InsightsScreen,
  settings: SettingsScreen,
  account:  AccountScreen,
  privacy:  PrivacyScreen,
  terms:    TermsScreen,
}

export default function App() {
  const route = useRoute()
  // 'work' is both a list and a detail route; the id decides.
  const Screen = route.name === 'work' && route.id ? WorkDetail : ROUTES[route.name] || TodayScreen

  return (
    <Shell>
      <Suspense fallback={<ScreenSkeleton />}>
        <Screen />
      </Suspense>
    </Shell>
  )
}

function ScreenSkeleton() {
  return (
    <div className="stack" aria-busy="true" aria-label="Loading">
      <div className="skel" style={{ height: 150, borderRadius: 'var(--r-md)' }} />
      <div className="grid grid--4">
        {[0, 1, 2, 3].map((i) => <div key={i} className="skel" style={{ height: 84, borderRadius: 'var(--r-md)' }} />)}
      </div>
      <div className="skel" style={{ height: 240, borderRadius: 'var(--r-md)' }} />
    </div>
  )
}
