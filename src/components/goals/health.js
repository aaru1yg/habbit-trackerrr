/* ============================================================
   GOAL HEALTH UI MAPPING — Phase 6.

   This file does NOT compute health. It only *maps* the existing,
   authoritative deterministic signals onto the four-state health
   language the Goals workspace speaks (SAFE / ON TRACK / AT RISK /
   OVERDUE, plus REACHED). The engines stay in goals.js (goalHealth)
   and adaptive.js (goalForecast risk) and remain the single source
   of truth. No forecast or risk is fabricated here.
   ============================================================ */
import { goalHealth } from '../../lib/goals.js'

/**
 * @returns {{text:string, tone:'neutral'|'good'|'warn'|'bad', reached:boolean, note:string, daysLeft:number|null}}
 */
export function healthBadge(state, goal, { now = new Date() } = {}) {
  if (!goal) return { text: '—', tone: 'neutral', reached: false, note: '', daysLeft: null }
  const h = goalHealth(state, goal, { now })

  // Reached is a state of its own (§23), always wins.
  if (goal.status === 'completed' || h.label === 'Reached' || h.prog?.pct >= 100) {
    return { text: 'Reached', tone: 'good', reached: true, note: h.note, daysLeft: h.daysLeft }
  }
  // The target has passed but the goal is not done → overdue.
  if (h.daysLeft != null && h.daysLeft < 0) {
    return { text: 'Overdue', tone: 'bad', reached: false, note: h.note, daysLeft: h.daysLeft }
  }
  // No target date → there is nothing to be at risk against.
  if (!goal.targetDate) {
    return { text: 'Safe', tone: 'neutral', reached: false, note: h.note, daysLeft: h.daysLeft }
  }
  // Warn tone is exactly goalHealth's "behind pace" → at risk.
  if (h.tone === 'warn') {
    return { text: 'At risk', tone: 'warn', reached: false, note: h.note, daysLeft: h.daysLeft }
  }
  // Otherwise on pace / ahead of pace → on track.
  return { text: 'On track', tone: h.tone === 'good' ? 'good' : 'neutral', reached: false, note: h.note, daysLeft: h.daysLeft }
}
