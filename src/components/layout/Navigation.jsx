import { Fragment, useMemo } from 'react'
import { Link } from '../../lib/router.jsx'
import Sheet from '../ui/Sheet.jsx'
import { useStore } from '../../store.jsx'
import { achievementSummary } from '../../lib/achievements.js'
import {
  IconToday, IconInsights, IconGoals, IconSettings, IconProjects, IconAssignment,
  IconWorkload, IconTimeline, IconSearch, IconStack, IconX, IconHabits, IconTrophy,
  IconMind, IconRecord, IconSparkle, IconCalendar, IconWeek,
} from '../../lib/icons.jsx'

/* Phase 1 information architecture: the same five destinations on desktop
   and mobile. Secondary tools stay reachable without becoming pillars. */
const PRIMARY = [
  { to: 'today', label: 'Today', Icon: IconToday },
  { to: 'work', label: 'Work', Icon: IconProjects },
  { to: 'habits', label: 'Habits', Icon: IconHabits },
  { to: 'goals', label: 'Goals', Icon: IconGoals },
  { to: 'insights', label: 'Insights', Icon: IconInsights },
]
const SECONDARY = [
  { to: 'work?view=deliverables', label: 'Deliverables', Icon: IconAssignment },
  { to: 'work?view=projects', label: 'Projects', Icon: IconProjects },
  { to: 'work?view=workload', label: 'Workload', Icon: IconWorkload },
  { to: 'work?view=deadlines', label: 'Deadlines', Icon: IconTimeline },
  { to: 'habits?view=calendar', label: 'Calendar', Icon: IconCalendar },
  { to: 'habits?view=week', label: 'Week review', Icon: IconWeek },
  { to: 'insights?view=mind', label: 'Mind', Icon: IconMind },
  { to: 'insights?view=achievements', label: 'Achievements', Icon: IconTrophy },
  { to: 'insights?view=record', label: 'Record', Icon: IconRecord },
  { to: 'settings', label: 'Settings', Icon: IconSettings },
]


export function BottomNav({ route, onMore, onCapture }) {
  return (
    <nav className="bottom-nav" aria-label="Main">
      {PRIMARY.map(({ to, label, Icon }, i) => (
        <Fragment key={to}>
          {i === 2 && onCapture && (
            <button type="button" className="nav-capture" onClick={onCapture} aria-label="Quick capture">
              <span className="nav-pill nav-pill-accent"><IconSparkle size={21} /></span>
              Capture
            </button>
          )}
          <Link to={to} aria-current={route === to ? 'page' : undefined}>
            <span className="nav-pill"><Icon size={21} /></span>
            {label}
          </Link>
        </Fragment>
      ))}
      <button type="button" onClick={onMore} aria-label="More sections">
        <span className="nav-pill"><IconStack size={21} /></span>
        More
      </button>
    </nav>
  )
}

export function Sidebar({ route, name, onSearch }) {
  const { state } = useStore()
  const unlocked = useMemo(() => achievementSummary(state).unlocked, [state])
  return (
    <aside className="sidebar">
      <Link to="today" className="sidebar-brand" aria-label="Habit OS home">
        <BrandMark size={30} /><span className="brand-name">Habit OS</span>
      </Link>
      <button type="button" className="sidebar-search" onClick={onSearch} aria-label="Search habits, projects, assignments and notes">
        <IconSearch size={16} /><span>Search</span><kbd aria-hidden="true">/</kbd>
      </button>
      <nav className="sidebar-nav" aria-label="Main">
        {PRIMARY.map(({ to, label, Icon }) => (
          <Link key={to} to={to} aria-current={route === to ? 'page' : undefined}>
            <Icon size={18} />{label}
            {to === 'insights' && unlocked > 0 && <span className="sidebar-count tnum" aria-label={`${unlocked} unlocked`}>{unlocked}</span>}
          </Link>
        ))}
      </nav>
      <div className="sidebar-foot">
        <Link to="settings" aria-current={route === 'settings' ? 'page' : undefined} className="sidebar-settings"><IconSettings size={17} />Settings</Link>
        <span>{name ? `Signed in as ${name}` : 'Your data stays on this device'}</span>
      </div>
    </aside>
  )
}

export function MoreSheet({ open, onClose, onSearch }) {
  return (
    <Sheet open={open} onClose={onClose} title="More" labelledBy="more-title">
      <div className="stack" style={{ gap: 4 }}>
        {onSearch && <button type="button" className="more-link" onClick={() => { onClose(); onSearch() }}><IconSearch size={19} /><span>Search everything</span></button>}
        <p className="more-group-label">Work</p>
        {SECONDARY.slice(0, 4).map(({ to, label, Icon }) => <Link key={to} to={to} className="more-link" onClick={onClose}><Icon size={19} /><span>{label}</span></Link>)}
        <p className="more-group-label">Habits</p>
        {SECONDARY.slice(4, 6).map(({ to, label, Icon }) => <Link key={to} to={to} className="more-link" onClick={onClose}><Icon size={19} /><span>{label}</span></Link>)}
        <p className="more-group-label">Insights</p>
        {SECONDARY.slice(6, 9).map(({ to, label, Icon }) => <Link key={to} to={to} className="more-link" onClick={onClose}><Icon size={19} /><span>{label}</span></Link>)}
        <p className="more-group-label">System</p>
        <Link to="settings" className="more-link" onClick={onClose}><IconSettings size={19} /><span>Settings</span></Link>
      </div>
    </Sheet>
  )
}

/** Contextual Work navigation; models Deliverables without changing schemas. */
export function WorkTabs({ route }) {
  const tabs = [
    { to: 'work?view=deliverables', label: 'Deliverables', Icon: IconAssignment },
    { to: 'work?view=projects', label: 'Projects', Icon: IconProjects },
    { to: 'work?view=workload', label: 'Workload', Icon: IconWorkload },
    { to: 'work?view=deadlines', label: 'Deadlines', Icon: IconTimeline },
  ]
  return <div className="tabbar" role="tablist" aria-label="Work sections">
    {tabs.map(({ to, label, Icon }, index) => {
      const ids = ['assignments', 'projects', 'workload', 'timeline']
      const selected = route === ids[index] || (route === 'work' && index === 1)
      return <Link key={to} to={to} role="tab" aria-selected={selected} aria-current={selected ? 'page' : undefined}><Icon size={16} />{label}</Link>
    })}
  </div>
}

export function BrandMark({ size = 24 }) {
  return <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true"><defs><linearGradient id="bm-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="var(--accent-1)" /><stop offset="100%" stopColor="var(--accent-2)" /></linearGradient></defs><rect x="3" y="3" width="42" height="42" rx="13" fill="url(#bm-g)" /><path d="M15 24.5l6 6L34 17" stroke="var(--bg-deep)" strokeWidth="4.6" strokeLinecap="round" strokeLinejoin="round" fill="none" /></svg>
}

export { IconX }
