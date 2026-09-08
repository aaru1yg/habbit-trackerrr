/* ============================================================
   LEARNING — Phase G, #25.

   The loop was one-directional: the product measured actual vs planned
   and described the gap, but offered no way to act on it. This module
   adds the missing half — an explicit accept path — and nothing else.
   The measurement itself already exists and is already tested
   (estimateAdvice, weeklyAdaptation).

   Two rules hold throughout:
     · nothing here writes on its own. Every action it returns must be
       dispatched by a component in response to a user pressing a
       button that names the number it will write.
     · a kind with no stored estimate gets an explanation, never a
       write. Inventing a field nothing reads is the silent mutation
       #25 forbids.
   ============================================================ */
import { minutesLabel } from './dates.js'
import { estimateAdvice } from './personalization.js'

export const NOT_ENOUGH = 'Not enough data yet.'

/** Below this the stored estimate already agrees with the evidence. */
export const MIN_DELTA_MIN = 5

/* ------------------------------------------------------------
   The write path.

   These are the only three kinds whose record stores an estimateMin:
   baseAssignment and baseProject declare one, and a task gets one at
   creation. A habit does not — estimateSamples measures habit sessions
   off the focus log, so there is nothing to write back to.
   ------------------------------------------------------------ */

const APPLYABLE = {
  assignment: (item, min) => ({ type: 'UPDATE_ASSIGNMENT', id: item.id, patch: { estimateMin: min } }),
  project: (item, min) => ({ type: 'UPDATE_PROJECT', id: item.id, patch: { estimateMin: min } }),
  'project-task': (item, min) => ({
    type: 'UPDATE_TASK', projectId: item.projectId, milestoneId: item.milestoneId, taskId: item.id,
    patch: { estimateMin: min },
  }),
}

export const isApplyable = (kind) => Boolean(APPLYABLE[kind])

/**
 * The reducer action that writes one estimate, or null.
 * Undo is the same action with the previous value: UPDATE_* merges a
 * patch, so there is nothing to reconstruct.
 */
export function applyEstimateAction(kind, item, minutes) {
  const build = APPLYABLE[kind]
  if (!build || !item?.id) return null
  const min = Math.round(Number(minutes))
  if (!Number.isFinite(min) || min <= 0) return null
  return build(item, min)
}

export const undoEstimateAction = (kind, item, previousMin) =>
  applyEstimateAction(kind, item, previousMin)

/* ------------------------------------------------------------
   One suggestion for one item.
   ------------------------------------------------------------ */

export function estimateSuggestion(item, state, { now = new Date() } = {}) {
  const kind = item?.kind || null
  const advice = estimateAdvice(item || {}, state, { now })

  if (!advice?.enough) {
    return {
      enough: false,
      kind,
      applyable: false,
      action: null,
      undo: null,
      reason: advice?.reason || NOT_ENOUGH,
    }
  }

  const current = advice.estimateMin
  const suggested = advice.suggestedMin
  const applyable = isApplyable(kind)
  const delta = current == null ? null : suggested - current

  /* The evidence agrees with what is stored, so there is nothing to say.
     This is also what makes an accepted suggestion disappear on its own. */
  if (delta != null && Math.abs(delta) < MIN_DELTA_MIN) {
    return {
      enough: false, kind, applyable: false, action: null, undo: null,
      reason: `Your stored estimate already matches your last ${advice.samples} comparable sessions.`,
      advice,
    }
  }

  const name = item.label || item.name || 'this'

  return {
    enough: true,
    kind,
    name,
    applyable,
    samples: advice.samples,
    currentMin: current,
    suggestedMin: suggested,
    deltaMin: delta,
    tone: delta != null && delta > 0 ? 'warn' : 'good',
    advice,
    /* The button names the number it will write. */
    label: applyable ? `Plan ${minutesLabel(suggested)} instead` : null,
    text: current == null
      ? `Your last ${advice.samples} comparable ${String(kind).replace('-', ' ')}${advice.samples === 1 ? '' : 's'} averaged ${minutesLabel(suggested)}. ${name} has no estimate yet.`
      : `Your last ${advice.samples} comparable ${String(kind).replace('-', ' ')}${advice.samples === 1 ? '' : 's'} averaged ${minutesLabel(suggested)}; ${name} is planned at ${minutesLabel(current)}.`,
    /* Explained, not applied: a habit has no stored estimate. */
    blockedReason: applyable
      ? null
      : 'A habit has no stored estimate, so this is information only — nothing to change.',
    action: applyable ? applyEstimateAction(kind, item, suggested) : null,
    undo: applyable && current != null ? undoEstimateAction(kind, item, current) : null,
  }
}
