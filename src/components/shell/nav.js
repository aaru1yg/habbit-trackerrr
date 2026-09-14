/* Navigation model — canonical pillars plus secondary routes.
 * Exported from a single module so the shell, tests, and route
 * resolver all share one source of truth. */

import {
  IconToday, IconInsights, IconGoals, IconSettings, IconProjects,
  IconHabits, IconSearch, IconSparkle,
  IconCalendar, IconWeek, IconMind, IconRecord, IconTrophy,
  IconWorkload, IconTimeline, IconAssignment,
} from '../../lib/icons.jsx'

/* Primary pillars. The `group` array lists the routes that should
 * mark this pillar as active (e.g. /projects -> Work). */
export const PRIMARY = [
  { id: 'today',    to: 'today',                        label: 'Today',    Icon: IconToday,    group: ['today'] },
  { id: 'work',     to: 'work',                         label: 'Work',     Icon: IconProjects, group: ['work', 'projects', 'assignments', 'workload', 'timeline'] },
  { id: 'habits',   to: 'habits',                       label: 'Habits',   Icon: IconHabits,   group: ['habits', 'library', 'calendar', 'week'] },
  { id: 'insights', to: 'insights',                     label: 'Insights', Icon: IconInsights, group: ['insights', 'mind', 'record', 'achievements'] },
]

/* Secondary items shown in the sidebar/More sheet, grouped by pillar.
 * Goals + Settings are the shell-level secondary slots. */
export const SECONDARY_SHELL = [
  { id: 'goals',    to: 'goals',    label: 'Goals',    Icon: IconGoals },
  { id: 'settings', to: 'settings', label: 'Settings', Icon: IconSettings },
]

export const SECONDARY_GROUPS = [
  {
    label: 'Work',
    items: [
      { to: 'work?view=deliverables', label: 'Deliverables', Icon: IconAssignment },
      { to: 'work?view=projects',     label: 'Projects',     Icon: IconProjects },
      { to: 'work?view=workload',     label: 'Workload',     Icon: IconWorkload },
      { to: 'work?view=deadlines',    label: 'Deadlines',    Icon: IconTimeline },
    ],
  },
  {
    label: 'Habits',
    items: [
      { to: 'habits?view=calendar', label: 'Calendar',    Icon: IconCalendar },
      { to: 'habits?view=week',     label: 'Week review', Icon: IconWeek },
    ],
  },
  {
    label: 'Insights',
    items: [
      { to: 'insights?view=mind',         label: 'Mind',         Icon: IconMind },
      { to: 'insights?view=achievements', label: 'Achievements', Icon: IconTrophy },
      { to: 'insights?view=record',       label: 'Record',       Icon: IconRecord },
    ],
  },
]

/* Canonical parent for active-state resolution. Mirrors the legacy
 * canonicalParent() in lib/router.jsx so we keep behavior identical. */
export function resolveActivePillar(route) {
  for (const p of PRIMARY) if (p.group.includes(route)) return p.id
  for (const s of SECONDARY_SHELL) if (s.id === route) return s.id
  return 'today'
}

export function isActive(route, item) {
  if (item.group) return item.group.includes(route)
  return route === item.id || route === item.to?.split('?')[0]
}

/* Page titles for the top bar. Secondary destinations resolve to their
 * parent pillar label in the top-bar crumb so the user always knows
 * where they are. */
const TITLES = {
  today: 'Today',
  work: 'Work',
  projects: 'Projects',
  assignments: 'Deliverables',
  deliverables: 'Deliverables',
  workload: 'Workload',
  timeline: 'Deadlines',
  habits: 'Habits',
  library: 'Habits',
  calendar: 'Calendar',
  week: 'Week review',
  insights: 'Insights',
  mind: 'Mind',
  record: 'Record',
  achievements: 'Achievements',
  goals: 'Goals',
  settings: 'Settings',
}

export function pageTitle(route, view) {
  if (route === 'work' && view) {
    if (view === 'deadlines') return TITLES.timeline
    if (view === 'workload') return TITLES.workload
    if (view === 'projects') return TITLES.projects
    if (view === 'deliverables') return TITLES.deliverables
    return TITLES.work
  }
  if (route === 'timeline') return TITLES.timeline
  if (route === 'workload') return TITLES.workload
  if (route === 'projects') return TITLES.projects
  if (route === 'assignments') return TITLES.assignments
  if (route === 'habits' && view === 'calendar') return 'Calendar'
  if (route === 'habits' && view === 'week') return 'Week review'
  if (route === 'insights') {
    if (view === 'mind') return 'Mind'
    if (view === 'record') return 'Record'
    if (view === 'achievements') return 'Achievements'
  }
  return TITLES[route] || 'Today'
}

export { IconSearch, IconSparkle }
