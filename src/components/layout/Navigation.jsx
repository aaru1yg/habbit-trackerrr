import { useEffect, useState } from 'react'
import { Link } from '../../lib/router.jsx'
import Sheet from '../ui/Sheet.jsx'
import {
  IconToday, IconCalendar, IconWeek, IconInsights, IconMind, IconGoals, IconSettings,
  IconProjects, IconAssignment, IconWorkload, IconTimeline, IconSearch, IconStack, IconX,
} from '../../lib/icons.jsx'

/* ============================================================
   NAVIGATION
   Desktop: a grouped sidebar (the product is an operating system,
   so the groups tell you what each area is FOR).
   Mobile: five bottom tabs + a More sheet. Projects, Assignments,
   Workload and Timeline share the Work hub segment control.
   ============================================================ */

const WORK_ROUTES = ['projects', 'assignments', 'workload', 'timeline']

const GROUPS = [
  {
    label: 'Track',
    items: [
      { to: 'today', label: 'Today', Icon: IconToday },
      { to: 'calendar', label: 'Calendar', Icon: IconCalendar },
      { to: 'week', label: 'Week', Icon: IconWeek },
    ],
  },
  {
    label: 'Work',
    items: [
      { to: 'projects', label: 'Projects', Icon: IconProjects },
      { to: 'assignments', label: 'Assignments', Icon: IconAssignment },
      { to: 'workload', label: 'Workload', Icon: IconWorkload },
      { to: 'timeline', label: 'Deadlines', Icon: IconTimeline },
    ],
  },
  {
    label: 'Understand',
    items: [
      { to: 'insights', label: 'Insights', Icon: IconInsights },
      { to: 'mind', label: 'Mind', Icon: IconMind },
    ],
  },
  {
    label: 'Organize',
    items: [
      { to: 'library', label: 'Habit library', Icon: IconStack },
      { to: 'goals', label: 'Goals', Icon: IconGoals },
      { to: 'record', label: 'Record', Icon: IconTimeline },
    ],
  },
]

const MOBILE_TABS = [
  { to: 'today', label: 'Today', Icon: IconToday },
  { to: 'calendar', label: 'Calendar', Icon: IconCalendar },
  { to: 'projects', label: 'Work', Icon: IconProjects, group: WORK_ROUTES },
  { to: 'insights', label: 'Insights', Icon: IconInsights },
]

const MORE_ITEMS = [
  { to: 'week', label: 'Week', Icon: IconWeek },
  { to: 'mind', label: 'Mind', Icon: IconMind },
  { to: 'workload', label: 'Workload', Icon: IconWorkload },
  { to: 'timeline', label: 'Deadlines', Icon: IconTimeline },
  { to: 'library', label: 'Habit library', Icon: IconStack },
  { to: 'goals', label: 'Goals', Icon: IconGoals },
  { to: 'record', label: 'Record', Icon: IconTimeline },
  { to: 'settings', label: 'Settings', Icon: IconSettings },
]

const isActive = (route, item) => (item.group ? item.group.includes(route) : route === item.to)

export function BottomNav({ route, onMore, onSearch }) {
  const moreActive = MORE_ITEMS.some((m) => m.to === route)
  return (
    <nav className="bottom-nav" aria-label="Main">
      {MOBILE_TABS.map(({ to, label, Icon, group }) => {
        const active = group ? group.includes(route) : route === to
        return (
          <Link key={to} to={to} aria-current={active ? 'page' : undefined}>
            <span className="nav-pill"><Icon size={21} /></span>
            {label}
          </Link>
        )
      })}
      <button type="button" onClick={onMore} aria-current={moreActive ? 'page' : undefined} aria-label="More sections">
        <span className="nav-pill"><IconStack size={21} /></span>
        More
      </button>
    </nav>
  )
}

export function Sidebar({ route, name, onSearch }) {
  return (
    <aside className="sidebar">
      <Link to="today" className="sidebar-brand" aria-label="Aaru Habits home">
        <BrandMark size={30} />
        <span className="brand-name">Habit OS</span>
      </Link>

      <button type="button" className="sidebar-search" onClick={onSearch} aria-label="Search habits, projects, assignments and notes">
        <IconSearch size={16} />
        <span>Search</span>
        <kbd aria-hidden="true">/</kbd>
      </button>

      <nav className="sidebar-nav" aria-label="Main">
        {GROUPS.map((group) => (
          <div key={group.label} className="sidebar-group">
            <p className="sidebar-group-label">{group.label}</p>
            {group.items.map(({ to, label, Icon }) => (
              <Link key={to} to={to} aria-current={route === to ? 'page' : undefined}>
                <Icon size={18} />
                {label}
              </Link>
            ))}
          </div>
        ))}
      </nav>

      <div className="sidebar-foot">
        <Link to="settings" aria-current={route === 'settings' ? 'page' : undefined} className="sidebar-settings">
          <IconSettings size={17} />
          Settings
        </Link>
        <span>{name ? `Signed in as ${name}` : 'Your data stays on this device'}</span>
      </div>
    </aside>
  )
}

/** Mobile "More" sheet — the rest of the operating system. */
export function MoreSheet({ open, onClose, route, onSearch }) {
  return (
    <Sheet open={open} onClose={onClose} title="More" labelledBy="more-title">
      <div className="stack" style={{ gap: 4 }}>
        {onSearch && (
          <button type="button" className="more-link" onClick={() => { onClose(); onSearch() }}>
            <IconSearch size={19} />
            <span>Search everything</span>
          </button>
        )}
        {MORE_ITEMS.map(({ to, label, Icon }) => (
          <Link key={to} to={to} className="more-link" onClick={onClose} aria-current={route === to ? 'page' : undefined}>
            <Icon size={19} />
            <span>{label}</span>
          </Link>
        ))}
      </div>
    </Sheet>
  )
}

/** Work hub segment control (Projects · Assignments · Workload · Deadlines). */
export function WorkTabs({ route }) {
  const tabs = [
    { to: 'projects', label: 'Projects', Icon: IconProjects },
    { to: 'assignments', label: 'Assignments', Icon: IconAssignment },
    { to: 'workload', label: 'Workload', Icon: IconWorkload },
    { to: 'timeline', label: 'Deadlines', Icon: IconTimeline },
  ]
  return (
    <div className="tabbar" role="tablist" aria-label="Work sections">
      {tabs.map(({ to, label, Icon }) => (
        <Link key={to} to={to} role="tab" aria-selected={route === to} aria-current={route === to ? 'page' : undefined}>
          <Icon size={16} />
          {label}
        </Link>
      ))}
    </div>
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
