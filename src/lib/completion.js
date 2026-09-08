/* ============================================================
   COMPLETION — the one mapping from an entity kind to the reducer
   action that actually completes it (Phase F).

   Deliberately tiny and dependent only on dates.js: Today and Focus
   Mode are eager screens, and with well under 1 kB of bundle headroom
   anything they import lands in the initial chunk. The contextual and
   weekly-adaptation logic lives in execution.js, which is reached only
   through a lazy component.
   ============================================================ */
import { dayStr } from './dates.js'

export function completionAction(kind, item, { today = null } = {}) {
  const day = today || dayStr(new Date())
  switch (kind) {
    case 'habit':
      return { type: 'TOGGLE_CHECKIN', habitId: item.id, date: day }
    case 'assignment':
      return { type: 'SET_ASSIGNMENT_PROGRESS', id: item.id, pct: 100 }
    case 'project-task':
      return { type: 'TOGGLE_TASK', projectId: item.projectId, milestoneId: item.milestoneId, taskId: item.id }
    case 'goal-milestone':
      return { type: 'TOGGLE_GOAL_MILESTONE', id: item.goalId, milestoneId: item.id }
    default:
      // A project has no honest one-tap completion.
      return null
  }
}

/** Can this kind be completed in one tap at all? */
export const isCompletable = (kind) => Boolean(completionAction(kind, { id: 'x' }))

/** Where the full record of this kind lives. */
export function hrefFor(kind, item) {
  switch (kind) {
    case 'assignment': return `assignments/${item.id}`
    case 'project': case 'project-task': return `projects/${item.projectId || item.id}`
    case 'goal-milestone': return `goals/${item.goalId}`
    case 'habit': return `habits/${item.id}`
    default: return 'today'
  }
}
