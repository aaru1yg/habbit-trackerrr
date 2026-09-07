/* Pure planning layer. Suggestions only: no persistence or state mutation. */
import { getTodayPriorities, getNextBestAction } from './adaptive.js'

const MIN = 60000
const isoDay = (d) => d.toISOString().slice(0, 10)
const estimate = (item) => Number.isFinite(item?.estimateMin) && item.estimateMin > 0 ? item.estimateMin : null
const reason = (ranked) => ranked.reasons?.length ? `Placed because it is ${ranked.reasons.join(' and ')}.` : 'Placed from the current priority order.'

export function validatePlan(blocks, { capacityMin = null } = {}) {
  const sorted = [...blocks].sort((a, b) => new Date(a.start) - new Date(b.start))
  const collisions = sorted.slice(1).filter((b, i) => new Date(b.start) < new Date(sorted[i].end))
  const total = sorted.reduce((n, b) => n + (b.durationMin || 0), 0)
  const impossible = sorted.filter((b) => !b.durationMin || b.durationMin <= 0 || new Date(b.end) <= new Date(b.start))
  return { valid: !collisions.length && !impossible.length, collisions, impossible, totalMin: total, overCapacity: capacityMin != null && total > capacityMin, reason: collisions.length ? 'The plan contains overlapping blocks.' : impossible.length ? 'A block has no valid duration.' : capacityMin != null && total > capacityMin ? `The plan exceeds capacity by ${total - capacityMin} minutes.` : 'No collisions detected.' }
}

export function buildDayPlan(state, { now = new Date(), capacityMin = state.profile?.dailyCapacityMin ?? null, startHour = 9, bufferPct = state.profile?.planningBufferPct ?? 15 } = {}) {
  const priorities = getTodayPriorities(state, { now, limit: 50, capacityMin })
  const next = getNextBestAction(state, { now, capacityMin })
  const ranked = next ? [{ ...next, item: next.item }, ...priorities.filter((x) => x.item.id !== next.item.id)] : priorities
  const items = ranked.filter((x) => estimate(x.item) != null)
  const available = capacityMin == null ? null : Math.max(0, Math.round(capacityMin * (1 - bufferPct / 100)))
  let cursor = new Date(now); cursor.setHours(startHour, 0, 0, 0)
  let used = 0
  const blocks = []
  for (const x of items) {
    const durationMin = estimate(x.item)
    const start = new Date(cursor)
    const end = new Date(start.getTime() + durationMin * MIN)
    const fits = available == null || used + durationMin <= available
    blocks.push({ id: `${x.item.kind}-${x.item.id}`, item: x.item, kind: x.item.kind, start: start.toISOString(), end: end.toISOString(), durationMin, fits, reason: reason(x), risk: x.risk?.id || x.urgency || null, signals: x.signals || null })
    cursor = end; used += durationMin
  }
  const validation = validatePlan(blocks, { capacityMin: available })
  return { blocks, mustDo: blocks.filter((b) => b.fits), canMove: blocks.filter((b) => !b.fits), capacityMin, usableCapacityMin: available, requiredMin: used, bufferMin: capacityMin == null ? null : capacityMin - available, fit: available == null ? 'INSUFFICIENT DATA' : validation.overCapacity ? 'OVERLOADED' : used > available * .85 ? 'TIGHT' : 'GOOD FIT', next, validation }
}

export function buildWeekPlan(state, { now = new Date(), days = 7, capacityMin = state.profile?.dailyCapacityMin ?? null } = {}) {
  const all = getTodayPriorities(state, { now, limit: 100, capacityMin: capacityMin == null ? null : capacityMin * days })
  const rows = Array.from({ length: days }, (_, i) => ({ date: isoDay(new Date(now.getTime() + i * 86400000)), blocks: [], availableMin: capacityMin, committedMin: 0 }))
  let index = 0
  for (const x of all) { const durationMin = estimate(x.item); if (durationMin == null) continue; const row = rows[index % rows.length]; row.blocks.push({ item: x.item, kind: x.item.kind, durationMin, reason: reason(x), risk: x.risk?.id || null }); row.committedMin += durationMin; index++ }
  const requiredMin = rows.reduce((n, r) => n + r.committedMin, 0); const availableMin = capacityMin == null ? null : capacityMin * days
  return { rows, requiredMin, availableMin, gapMin: availableMin == null ? null : availableMin - requiredMin, fit: availableMin == null ? 'INSUFFICIENT DATA' : requiredMin > availableMin ? 'OVERLOADED' : 'GOOD FIT', explanation: availableMin == null ? 'Planning is limited because available capacity is not configured.' : requiredMin > availableMin ? `The week exceeds available capacity by ${requiredMin - availableMin} minutes.` : 'The proposed week fits the configured capacity.' }
}

export function validateRecovery(plan, { capacityMin = null } = {}) {
  const kept = plan.keep || []; const minutes = kept.reduce((n, x) => n + (estimate(x.item) || 0), 0)
  return { valid: capacityMin == null || minutes <= capacityMin, keptMin: minutes, capacityMin, overBy: capacityMin == null ? null : Math.max(0, minutes - capacityMin), reason: capacityMin != null && minutes > capacityMin ? `The recovery path exceeds today's capacity by ${minutes - capacityMin} minutes.` : 'Recovery path fits the available capacity.' }
}
export function recoveryPlan(state, { now = new Date(), capacityMin = state.profile?.dailyCapacityMin ?? null } = {}) {
  const priorities = getTodayPriorities(state, { now, limit: 100, capacityMin }); const overdue = priorities.filter((x) => ['OVERDUE','CRITICAL'].includes(x.risk?.id)); const risky = priorities.filter((x) => x.risk?.id === 'AT RISK');
  const keep = [...overdue, ...risky].slice(0, 4); const move = priorities.filter((x) => !keep.includes(x)).filter((x) => x.item.priority !== 'low').slice(0, 3); const optional = priorities.filter((x) => !keep.includes(x) && !move.includes(x)); const plan = { keep, move, defer: optional.slice(0, 3), optional: optional.slice(3), missed: overdue, explanation: keep.length ? `Here is the highest-impact recovery path for ${keep.length} item${keep.length === 1 ? '' : 's'}.` : 'No urgent recovery items detected.' }; return { ...plan, validation: validateRecovery(plan, { capacityMin }) }
}
export function focusRecommendation(state, options = {}) { const next = getNextBestAction(state, options); return next ? { ...next, item: next.item, suggestedDuration: estimate(next.item), reason: next.reason } : null }
export function focusSessionSummary({ plannedMin, startedAt, endedAt, completed = false, interrupted = false } = {}) { const actualMin = startedAt && endedAt ? Math.max(0, Math.round((new Date(endedAt) - new Date(startedAt)) / MIN)) : null; return { plannedMin: Number.isFinite(plannedMin) ? plannedMin : null, actualMin, completed, interrupted, enough: actualMin != null } }
export function replan(plan, completedIds = [], options = {}) { const remaining = plan.blocks.filter((b) => !completedIds.includes(b.id)); return buildDayPlan(options.state || { assignments: [], projects: [], goals: [], habits: [], checkins: {} }, { ...options, existingBlocks: remaining }) }
