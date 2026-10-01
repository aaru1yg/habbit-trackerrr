/* ============================================================
   NAV — the whole information architecture, in one array.

   v4 had 21 routes across a rail, a "more" sheet, an omni panel
   and a mobile dock that each kept their own list. There are now
   six destinations and one list. If it is not here, it does not
   exist.
   ============================================================ */
import {
  IconToday, IconHabits, IconWork, IconGoals, IconInsights, IconSettings,
} from '../ui/icons.jsx'

export const NAV = [
  { id: 'today',    label: 'Today',    Icon: IconToday,    hint: 'What to do right now' },
  { id: 'habits',   label: 'Habits',   Icon: IconHabits,   hint: 'What you repeat' },
  { id: 'work',     label: 'Work',     Icon: IconWork,     hint: 'What you finish' },
  { id: 'goals',    label: 'Goals',    Icon: IconGoals,    hint: 'What it all adds up to' },
  { id: 'insights', label: 'Insights', Icon: IconInsights, hint: 'What the data says' },
  { id: 'settings', label: 'Settings', Icon: IconSettings, hint: 'Your data and this app' },
]

/* Detail routes inherit their parent's title. */
const PARENT = { habit: 'habits', work: 'work', goal: 'goals' }

/* Pages reachable from the footer rather than the nav. */
const EXTRA_TITLES = { privacy: 'Privacy', terms: 'Terms' }

export const parentOf = (name) => PARENT[name] || name

export function titleFor(name) {
  const id = parentOf(name)
  return NAV.find((n) => n.id === id)?.label || EXTRA_TITLES[name] || 'Today'
}

/** Mobile dock shows five; Settings lives in the top bar there. */
export const DOCK = NAV.filter((n) => n.id !== 'settings')
