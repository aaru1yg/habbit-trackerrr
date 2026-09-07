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

/* ------------------------------------------------------------
   A kind-level suggestion, resolved to one named record.

   weeklyAdaptation reports that a whole kind runs long or short.
   Applying that must still change exactly one record, so this picks
   the deterministic next action of that kind and names it. There is
   deliberately no "fix everything" action — a bulk rewrite of stored
   estimates is the silent mutation #25 forbids, whatever it is called.
   ------------------------------------------------------------ */

export function kindSuggestion(suggestion, state, { now: _now } = {}) {
  if (!suggestion) return { enough: false, reason: NOT_ENOUGH, applyable: false, action: null, undo: null }

  const kind = suggestion.kind
  if (!isApplyable(kind)) {
    return {
      enough: true,
      kind,
      applyable: false,
      action: null,
      undo: null,
      reason: suggestion.text,
      blockedReason: 'A habit has no stored estimate, so this is information only — nothing to change.',
    }
  }

  const target = pickTarget(kind, state)
  if (!target) {
    return {
      enough: true,
      kind,
      applyable: false,
      action: null,
      undo: null,
      reason: suggestion.text,
      blockedReason: 'Nothing open of that kind to apply it to.',
    }
  }

  /* The number written is the number this suggestion measured, taken from
     the same focus-log sessions its text quotes. It is deliberately NOT
     re-derived through estimateAdvice: that reads completed records
     instead, so the panel could quote one figure and the button write
     another — or refuse to appear at all. One claim, one evidence source. */
  const suggested = Math.round(Number(suggestion.meanActualMin))
  if (!Number.isFinite(suggested) || suggested <= 0) {
    return { enough: true, kind, applyable: false, action: null, undo: null, reason: suggestion.text,
      blockedReason: 'No measured duration to apply.' }
  }

  const current = Number.isFinite(target.estimateMin) ? target.estimateMin : null
  if (current != null && Math.abs(suggested - current) < MIN_DELTA_MIN) {
    return {
      enough: true,
      kind,
      applyable: false,
      action: null,
      undo: null,
      reason: suggestion.text,
      blockedReason: `${target.label || 'The next one'} is already planned near that.`,
    }
  }

  const name = target.label || target.name || 'the next one'
  return {
    enough: true,
    kind,
    applyable: true,
    target,
    targetName: name,
    samples: suggestion.samples,
    suggestedMin: suggested,
    currentMin: current,
    action: applyEstimateAction(kind, target, suggested),
    undo: current != null ? undoEstimateAction(kind, target, current) : null,
    reason: `${suggestion.text} The next one is ${name}.`,
    label: `Plan ${minutesLabel(suggested)} instead`,
    blockedReason: null,
  }
}

/* The open record of this kind that the deterministic engine ranks next. */
function pickTarget(kind, state) {
  const open = collectOpen(kind, state)
  if (!open.length) return null
  /* Deterministic and stable: earliest deadline, then insertion order.
     No personalisation signal chooses what gets rewritten. */
  return open.sort((a, b) => String(a.deadline || '9999').localeCompare(String(b.deadline || '9999')))[0]
}

function collectOpen(kind, state) {
  const out = []
  if (kind === 'assignment') {
    for (const a of state.assignments || []) {
      if (a.archived || a.completedAt) continue
      out.push({ ...a, kind: 'assignment', label: a.name, deadline: a.deadline })
    }
  } else if (kind === 'project') {
    for (const p of state.projects || []) {
      if (p.archived || p.completedAt) continue
      out.push({ ...p, kind: 'project', label: p.name, deadline: p.deadline })
    }
  } else if (kind === 'project-task') {
    for (const p of state.projects || []) {
      if (p.archived) continue
      for (const m of p.milestones || []) for (const t of m.tasks || []) {
        if (t.done) continue
        out.push({ ...t, kind: 'project-task', label: t.name, deadline: t.due || m.due || p.deadline, projectId: p.id, milestoneId: m.id })
      }
    }
  }
  return out
}
