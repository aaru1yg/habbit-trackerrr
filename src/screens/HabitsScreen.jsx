/* ============================================================
   HABITS — the place you manage what you repeat (as opposed to
   Today, where you simply do it).

   It renders the same list engine as the Library so there is
   exactly one habit-list implementation; only the framing and
   the copy differ.
   ============================================================ */
import LibraryScreen from './LibraryScreen.jsx'
import { useStore } from '../store.jsx'
import { activeHabits } from '../lib/stats.js'

export default function HabitsScreen() {
  const { state } = useStore()
  const habits = activeHabits(state)
  const routines = (state.routines || []).filter((r) => r.active !== false)
  const archived = (state.habits || []).filter((h) => h.archived)
  return (
    <LibraryScreen
      title="Habits"
      subtitle={
        `${habits.length} active habit${habits.length === 1 ? '' : 's'} · ` +
        `${routines.length} routine${routines.length === 1 ? '' : 's'}` +
        (archived.length ? ` · ${archived.length} archived` : '')
      }
    />
  )
}
