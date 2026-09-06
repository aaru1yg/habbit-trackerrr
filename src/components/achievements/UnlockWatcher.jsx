/* ============================================================
   UNLOCK WATCHER — the moment an achievement is earned.

   Achievements are derived from state, never stored, so V2 had no
   "you just earned this" moment: the card was simply earned next
   time you looked. This watcher diffs the earned set across state
   changes and, only for achievements that flip during a session,
   fires the shared feedback channel + one toast. On first mount
   it records the current set without celebrating, so reloading
   the app never re-announces old trophies.
   ============================================================ */
import { useEffect, useMemo, useRef } from 'react'
import { useStore } from '../../store.jsx'
import { useToast } from '../ui/Toaster.jsx'
import { achievementList } from '../../lib/achievements.js'
import { interactionFeedback } from '../../lib/motion.js'

export default function UnlockWatcher() {
  const { state } = useStore()
  const toast = useToast()

  const earned = useMemo(() => {
    const map = new Map()
    for (const a of achievementList(state)) if (a.earned) map.set(a.id, a)
    return map
  }, [state])

  const prev = useRef(null)
  useEffect(() => {
    if (prev.current === null) {
      prev.current = earned
      return
    }
    const added = [...earned.entries()].filter(([id]) => !prev.current.has(id))
    for (const [id] of added) interactionFeedback('unlock', { id })
    if (added.length === 1) {
      toast.show(`Trophy earned: ${added[0][1].title}`)
    } else if (added.length > 1) {
      toast.show(`${added.length} trophies earned: ${added.map(([, a]) => a.title).join(', ')}`)
    }
    prev.current = earned
  }, [earned, toast])

  return null
}
