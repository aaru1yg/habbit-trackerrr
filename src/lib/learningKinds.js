/* ============================================================
   LEARNING · KIND-LEVEL SUGGESTIONS — Phase G.

   LAZY-ONLY, and the split is a bundle decision, not tidiness.
   learning.js is imported by FocusMode, which is an eager screen, so
   everything in that file lands in the initial chunk. kindSuggestion is
   used only by ExecutionPanels, which is React.lazy — keeping it here
   means the weekly panel's resolve-to-one-record logic costs the
   initial chunk nothing.
   ============================================================ */
import { minutesLabel } from './dates.js'
import {
  NOT_ENOUGH,
  MIN_DELTA_MIN,
  isApplyable,
  applyEstimateAction,
  undoEstimateAction,
} from './learning.js'

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
