/* Schedule semantics: habits are daily or weekday-specific. */
export const CATEGORIES = [
  { id: 'fitness', label: 'Fitness', cssVar: '--cat-fitness' },
  { id: 'mind', label: 'Mind', cssVar: '--cat-mind' },
  { id: 'learning', label: 'Learning', cssVar: '--cat-learning' },
  { id: 'health', label: 'Health', cssVar: '--cat-health' },
  { id: 'creative', label: 'Creative', cssVar: '--cat-creative' },
  { id: 'social', label: 'Social', cssVar: '--cat-social' },
]

export const categoryOf = (id) => CATEGORIES.find((c) => c.id === id) || CATEGORIES[1]

export const WEEKDAY_OPTIONS = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 0, label: 'Sun' },
]

export function isScheduled(habit, dateStr) {
  if (!habit || habit.archived) return false
  const sched = habit.schedule || { type: 'daily' }
  if (sched.type === 'weekdays') {
    const days = Array.isArray(sched.days) ? sched.days : []
    if (!days.length) return false
    // dateStr is local yyyy-MM-dd -> weekday via Date (avoid UTC drift)
    const [y, m, d] = dateStr.split('-').map(Number)
    return days.includes(new Date(y, m - 1, d).getDay())
  }
  return true
}

export function scheduleLabel(habit) {
  const sched = habit.schedule || { type: 'daily' }
  if (sched.type !== 'weekdays' || !Array.isArray(sched.days) || !sched.days.length) return 'Every day'
  if (sched.days.length === 7) return 'Every day'
  const names = { 0: 'Sun', 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat' }
  const ordered = [1, 2, 3, 4, 5, 6, 0].filter((d) => sched.days.includes(d))
  if (ordered.length === 5 && [1, 2, 3, 4, 5].every((d) => ordered.includes(d))) return 'Weekdays'
  if (ordered.length === 2 && [0, 6].every((d) => ordered.includes(d))) return 'Weekends'
  return ordered.map((d) => names[d]).join(' · ')
}

/** Starter suggestions for onboarding / add flow. Real habits, no fake history. */
export const STARTER_HABITS = [
  { name: 'Move for 20 minutes', category: 'fitness' },
  { name: 'Read 10 pages', category: 'learning' },
  { name: 'Meditate', category: 'mind' },
  { name: 'Drink water', category: 'health' },
  { name: 'Make something', category: 'creative' },
  { name: 'Message a friend', category: 'social' },
  { name: 'Stretch', category: 'fitness' },
  { name: 'Journal', category: 'mind' },
  { name: 'Sleep by 11', category: 'health' },
]
