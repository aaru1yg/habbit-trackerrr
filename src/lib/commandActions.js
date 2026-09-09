/* ============================================================
   COMMAND ACTIONS — the registry behind the Command Center
   (Phase E10, E11, E14, E15, E16).

   PURE. `executeCommand` returns a *descriptor* of what should
   happen; the component performs it. That keeps every decision
   testable without mounting React, and it means there is exactly
   one place that knows which commands exist.

   Nothing here re-implements an engine. "What should I do next?"
   calls the existing getNextBestAction; "Plan my day" hands off to
   the existing planning engine; ranking is Phase B's quickActions.
   ============================================================ */
import { getNextBestAction } from './adaptive.js'
import { dayStr } from './dates.js'
import { preferencesOf } from './personalization.js'

/* ------------------------------------------------------------
   Registry
   ------------------------------------------------------------ */

export const COMMAND_GROUPS = ['Create', 'Focus', 'Review', 'Open']

export const COMMANDS = [
  { id: 'capture', label: 'Quick capture', group: 'Create', icon: 'IconSparkle', keywords: ['add', 'new', 'what do i need to do', 'quick'] },
  { id: 'add-habit', label: 'Add habit', group: 'Create', icon: 'IconPlus', keywords: ['new habit', 'create habit', 'streak'] },
  { id: 'create-goal', label: 'Create goal', group: 'Create', icon: 'IconTarget', keywords: ['new goal', 'target', 'objective'] },
  { id: 'create-project', label: 'Create project', group: 'Create', icon: 'IconProjects', keywords: ['new project'] },
  { id: 'create-assignment', label: 'Create assignment', group: 'Create', icon: 'IconAssignment', keywords: ['new assignment', 'homework'] },
  { id: 'add-project-task', label: 'Add project task', group: 'Create', icon: 'IconLayers', keywords: ['task', 'todo', 'subtask'] },
  { id: 'next-action', label: 'What should I do next?', group: 'Focus', icon: 'IconTrendUp', keywords: ['next', 'best action', 'suggest', 'prioritise', 'prioritize'] },
  { id: 'start-focus', label: 'Start focus', group: 'Focus', icon: 'IconTarget', keywords: ['focus mode', 'deep work', 'timer'] },
  { id: 'plan-day', label: 'Plan my day', group: 'Focus', icon: 'IconClock', keywords: ['plan today', 'schedule day'] },
  { id: 'plan-week', label: 'Plan my week', group: 'Focus', icon: 'IconWeek', keywords: ['plan week', 'schedule week'] },
  { id: 'view-at-risk', label: 'View at-risk items', group: 'Review', icon: 'IconAlert', keywords: ['at risk', 'overdue', 'critical', 'slipping'] },
  { id: 'view-workload', label: 'View workload', group: 'Review', icon: 'IconWorkload', keywords: ['capacity', 'load', 'busy'] },
  { id: 'open-analytics', label: 'Open Analytics Lab', group: 'Review', icon: 'IconInsights', keywords: ['analytics', 'lab', 'data story', 'trajectory'] },
  { id: 'view-insights', label: 'View insights', group: 'Review', icon: 'IconInsights', keywords: ['patterns', 'trends', 'stats'] },
  { id: 'open-achievements', label: 'Open achievements', group: 'Open', icon: 'IconAward', keywords: ['badges', 'trophies', 'milestones'] },
  { id: 'search', label: 'Search everything', group: 'Open', icon: 'IconSearch', keywords: ['find', 'lookup', 'search'] },
]

/* A command is only offered when this app can actually perform it.
   Anything not in this map is filtered out — a button that does
   nothing would be a lie. */
const RUNNABLE = {
  capture: { kind: 'open', target: 'capture' },
  'add-habit': { kind: 'open', target: 'capture', preset: { type: 'habit' } },
  'create-goal': { kind: 'open', target: 'capture', preset: { type: 'goal-milestone', askGoal: true } },
  'create-project': { kind: 'open', target: 'capture', preset: { type: 'project' } },
  'create-assignment': { kind: 'open', target: 'capture', preset: { type: 'assignment' } },
  'add-project-task': { kind: 'open', target: 'capture', preset: { type: 'project-task', askProject: true } },
  'next-action': { kind: 'next-action' },
  'start-focus': { kind: 'open', target: 'focus' },
  'plan-day': { kind: 'open', target: 'plan-day' },
  'plan-week': { kind: 'open', target: 'plan-week' },
  'view-at-risk': { kind: 'navigate', route: 'work?view=overview&filter=risk' },
  'view-workload': { kind: 'navigate', route: 'work?view=workload' },
  'open-analytics': { kind: 'navigate', route: 'insights', view: 'lab' },
  'view-insights': { kind: 'navigate', route: 'insights' },
  'open-achievements': { kind: 'navigate', route: 'insights?view=achievements' },
  search: { kind: 'open', target: 'search' },
}

/** Commands this build can actually run. */
export function availableCommands() {
  return COMMANDS.filter((c) => RUNNABLE[c.id])
}

/* ------------------------------------------------------------
   Matching — deterministic, ordered, no fuzzy magic.
   ------------------------------------------------------------ */

const norm = (s) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim()

/**
 * Rank commands against what the user typed. An exact label match wins;
 * otherwise a label prefix, then a keyword hit. Order is stable so the
 * same input always produces the same list.
 */
export function matchCommands(query, { limit = 8 } = {}) {
  const q = norm(query)
  if (!q) return []
  const rows = []
  for (const c of availableCommands()) {
    const label = norm(c.label)
    const words = label.split(' ')
    let score = 0
    if (label === q) score = 100
    else if (label.startsWith(q)) score = 80
    else if (words.some((w) => w.startsWith(q) && w.length > 2)) score = 60
    else if (label.includes(q)) score = 45
    else if ((c.keywords || []).some((k) => norm(k).includes(q) || q.includes(norm(k)))) score = 30
    if (score) rows.push({ ...c, score })
  }
  rows.sort((a, b) => b.score - a.score || COMMANDS.findIndex((x) => x.id === a.id) - COMMANDS.findIndex((x) => x.id === b.id))
  return rows.slice(0, limit)
}

/* ------------------------------------------------------------
   E14 · Next best action — a call, never a second implementation.
   ------------------------------------------------------------ */

export function nextActionResult(state, { now = new Date() } = {}) {
  const next = getNextBestAction(state, { now, capacityMin: preferencesOf(state).dailyCapacityMin })
  if (!next) {
    return { enough: false, reason: 'Nothing open to suggest yet. Add some work and this will have something to say.' }
  }
  return {
    enough: true,
    item: next.item,
    kind: next.item.kind,
    name: next.item.label || next.item.name,
    reason: next.reason,
    risk: next.urgency,
    estimatedMin: next.estimatedMin,
    deadline: next.deadline,
    signals: next.signals,
  }
}

/* ------------------------------------------------------------
   Execution — returns a descriptor; the caller performs it.
   ------------------------------------------------------------ */

export function executeCommand(id, state = {}, { now = new Date() } = {}) {
  const command = COMMANDS.find((c) => c.id === id)
  if (!command) return { ok: false, reason: 'That command does not exist.' }
  const run = RUNNABLE[id]
  if (!run) return { ok: false, reason: 'That command is not available in this build.' }

  if (run.kind === 'next-action') {
    const result = nextActionResult(state, { now })
    return { ok: true, command, descriptor: { kind: 'result', result }, result }
  }
  return { ok: true, command, descriptor: run }
}

/* ------------------------------------------------------------
   E15 · Universal action model
   Every action names the reducer or route it needs, so no component
   invents its own state logic. `destructive` marks the ones that
   must be confirmed.
   ------------------------------------------------------------ */

export const UNIVERSAL_ACTIONS = ['view', 'edit', 'complete', 'focus', 'move', 'archive', 'link', 'delete']

const hrefFor = (kind, entity) => {
  switch (kind) {
    case 'habit': return `habits/${entity.id}`
    case 'project': return `projects/${entity.id}`
    case 'assignment': return `assignments/${entity.id}`
    case 'goal': return `goals/${entity.id}`
    case 'project-task': return `projects/${entity.projectId}?task=${encodeURIComponent(entity.id)}`
    case 'goal-milestone': return `goals/${entity.goalId}`
    default: return 'today'
  }
}

/**
 * The actions that are valid for THIS entity, in display order.
 * Nothing is offered that cannot be performed.
 */
export function itemActions(kind, entity, { now = new Date(), today = null } = {}) {
  if (!entity) return []
  /* Local date, not toISOString(): the rest of the app keys check-ins by
     local day, and UTC disagrees with it either side of midnight. */
  const day = today || dayStr(now)
  const out = []
  const push = (a) => out.push(a)

  const view = { id: 'view', label: 'View', href: hrefFor(kind, entity) }

  switch (kind) {
    case 'habit': {
      const done = Boolean(entity?.doneToday)
      push(view)
      push({
        id: 'complete', label: done ? 'Undo' : 'Complete',
        dispatch: { type: 'TOGGLE_CHECKIN', habitId: entity.id, date: day },
        tone: done ? undefined : 'good',
      })
      push({ id: 'edit', label: 'Edit', form: 'habit', entity })
      push({ id: 'archive', label: 'Archive', dispatch: { type: 'UPDATE_HABIT', id: entity.id, patch: { archived: true } }, destructive: true })
      push({ id: 'delete', label: 'Delete', dispatch: { type: 'DELETE_HABIT', id: entity.id }, destructive: true, undo: { type: 'RESTORE_HABIT', habit: entity } })
      break
    }
    case 'assignment': {
      const complete = Boolean(entity.completedAt) || Number(entity.progress) >= 100
      push(view)
      push({ id: 'focus', label: 'Focus', focus: { kind: 'assignment', id: entity.id, name: entity.name, estimateMin: entity.estimateMin } })
      push({ id: 'complete', label: 'Complete', dispatch: { type: 'SET_ASSIGNMENT_PROGRESS', id: entity.id, pct: 100 }, disabled: complete })
      push({ id: 'edit', label: 'Edit', form: 'assignment', entity })
      push({ id: 'move', label: 'Move deadline', reschedule: { kind: 'assignment', id: entity.id, deadline: entity.deadline } })
      push({ id: 'archive', label: 'Archive', dispatch: { type: 'UPDATE_ASSIGNMENT', id: entity.id, patch: { archived: true } }, destructive: true })
      push({ id: 'delete', label: 'Delete', dispatch: { type: 'DELETE_ASSIGNMENT', id: entity.id }, destructive: true, undo: { type: 'RESTORE_ASSIGNMENT', assignment: entity } })
      break
    }
    case 'project': {
      push(view)
      push({ id: 'add-task', label: 'Add task', form: 'project-task', entity })
      push({ id: 'edit', label: 'Edit', form: 'project', entity })
      push({ id: 'link', label: 'Link', link: { kind: 'project', id: entity.id } })
      push({ id: 'archive', label: 'Archive', dispatch: { type: 'UPDATE_PROJECT', id: entity.id, patch: { archived: true } }, destructive: true })
      push({ id: 'delete', label: 'Delete', dispatch: { type: 'DELETE_PROJECT', id: entity.id }, destructive: true, undo: { type: 'RESTORE_PROJECT', project: entity } })
      break
    }
    case 'goal': {
      push(view)
      push({ id: 'add-milestone', label: 'Add milestone', form: 'goal-milestone', entity })
      push({ id: 'edit', label: 'Edit', form: 'goal', entity })
      push({ id: 'link', label: 'Link', link: { kind: 'goal', id: entity.id } })
      push({ id: 'delete', label: 'Delete', dispatch: { type: 'DELETE_GOAL', id: entity.id }, destructive: true, undo: { type: 'RESTORE_GOAL', goal: entity } })
      break
    }
    case 'project-task': {
      push(view)
      push({ id: 'focus', label: 'Focus', focus: { kind, id: entity.id, name: entity.name } })
      push({ id: 'edit', label: 'Edit', href: hrefFor(kind, entity) })
      push({ id: 'move', label: 'Move deadline', href: hrefFor(kind, entity) })
      push({
        id: 'complete', label: entity.done ? 'Reopen' : 'Complete',
        dispatch: { type: 'TOGGLE_TASK', projectId: entity.projectId, milestoneId: entity.milestoneId, taskId: entity.id },
      })
      push({ id: 'delete', label: 'Delete', dispatch: { type: 'DELETE_TASK', projectId: entity.projectId, milestoneId: entity.milestoneId, taskId: entity.id }, destructive: true })
      break
    }
    case 'goal-milestone': {
      push(view)
      push({
        id: 'complete', label: entity.done ? 'Reopen' : 'Complete',
        dispatch: { type: 'TOGGLE_GOAL_MILESTONE', id: entity.goalId, milestoneId: entity.id },
      })
      push({ id: 'delete', label: 'Delete', dispatch: { type: 'DELETE_GOAL_MILESTONE', id: entity.goalId, milestoneId: entity.id }, destructive: true })
      break
    }
    default:
      push(view)
  }

  return out.filter((a) => UNIVERSAL_ACTIONS.includes(a.id) || ['add-task', 'add-milestone'].includes(a.id))
}

/** Resolve a `{kind, id}` reference to the entity and its parent ids. */
export function resolveItem(state, kind, id, { now = new Date() } = {}) {
  switch (kind) {
    case 'habit': {
      const habit = (state.habits || []).find((h) => h.id === id)
      return habit ? { kind, entity: { ...habit, doneToday: Boolean(state.checkins?.[id]?.[dayStr(now)]?.done) } } : null
    }
    case 'assignment': {
      const a = (state.assignments || []).find((x) => x.id === id)
      return a ? { kind, entity: a } : null
    }
    case 'project': {
      const p = (state.projects || []).find((x) => x.id === id)
      return p ? { kind, entity: p } : null
    }
    case 'goal': {
      const g = (state.goals || []).find((x) => x.id === id)
      return g ? { kind, entity: g } : null
    }
    case 'project-task': {
      for (const p of state.projects || []) for (const m of p.milestones || []) {
        const task = (m.tasks || []).find(t => t.id === id)
        if (task) return { kind, entity: { ...task, projectId: p.id, milestoneId: m.id } }
      }
      return null
    }
    default:
      return null
  }
}
