import { Link } from '../../lib/router.jsx'
import {
  IconToday, IconCalendar, IconWeek, IconInsights, IconMind, IconGoals, IconSettings,
} from '../../lib/icons.jsx'

const MOBILE_TABS = [
  { to: 'today', label: 'Today', Icon: IconToday },
  { to: 'calendar', label: 'Calendar', Icon: IconCalendar },
  { to: 'week', label: 'Week', Icon: IconWeek },
  { to: 'insights', label: 'Insights', Icon: IconInsights },
  { to: 'mind', label: 'Mind', Icon: IconMind },
]

const SIDEBAR_TABS = [
  ...MOBILE_TABS,
  { to: 'goals', label: 'Goals', Icon: IconGoals },
  { to: 'settings', label: 'Settings', Icon: IconSettings },
]

export function BottomNav({ route }) {
  return (
    <nav className="bottom-nav" aria-label="Main">
      {MOBILE_TABS.map(({ to, label, Icon }) => (
        <Link key={to} to={to} aria-current={route === to ? 'page' : undefined}>
          <span className="nav-pill"><Icon size={21} /></span>
          {label}
        </Link>
      ))}
    </nav>
  )
}

export function Sidebar({ route, name }) {
  return (
    <aside className="sidebar">
      <Link to="today" className="sidebar-brand" aria-label="Aaru Habits home">
        <BrandMark size={30} />
        <span className="brand-name">Aaru Habits</span>
      </Link>
      <nav className="sidebar-nav" aria-label="Main">
        {SIDEBAR_TABS.map(({ to, label, Icon }) => (
          <Link key={to} to={to} aria-current={route === to ? 'page' : undefined}>
            <Icon size={19} />
            {label}
          </Link>
        ))}
      </nav>
      <div className="sidebar-foot">
        <span>{name ? `Signed in as ${name}` : 'Your data stays on this device'}</span>
      </div>
    </aside>
  )
}

export function BrandMark({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <defs>
        <linearGradient id="bm-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#6d4aff" />
          <stop offset="100%" stopColor="#22d3ee" />
        </linearGradient>
      </defs>
      <rect x="3" y="3" width="42" height="42" rx="13" fill="url(#bm-g)" />
      <path d="M15 24.5l6 6L34 17" stroke="#0b0f1a" strokeWidth="4.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  )
}
