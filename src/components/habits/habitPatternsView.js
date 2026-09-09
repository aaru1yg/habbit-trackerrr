/* ============================================================
   HABIT PATTERNS VIEW MODEL — Phase 5 §18-19.

   Turns the output of habitPatterns() (src/lib/habitPatterns.js —
   the only pattern engine) into Observation → Evidence →
   Implication cards. It adds no analysis of its own: every
   threshold and number comes from the engine, and a sub-pattern
   only becomes a card when the engine says it has enough data.
   ============================================================ */
import { WEEKDAY_NAMES } from '../../lib/schedule.js'

export const NOT_ENOUGH = 'Not enough data yet.'

const dayName = (weekday) => WEEKDAY_NAMES[weekday] || 'that day'

export function patternCards(p, habitName = 'this habit') {
  if (!p) return []
  const cards = []

  const t = p.trend
  if (t && t.id !== 'INSUFFICIENT DATA' && t.current != null && t.delta != null) {
    /* The engine returns delta = current − previous; derive the previous
       percentage from those two numbers rather than reading a second field. */
    const previous = t.current - t.delta
    cards.push({
      id: 'trend',
      observation: `Completion is ${t.id.toLowerCase()} over the last 30 days.`,
      evidence: `${t.current}% in the last 30 days versus ${previous}% in the 30 before (${t.delta > 0 ? '+' : ''}${t.delta} points).`,
      implication: t.id === 'IMPROVING'
        ? 'Whatever changed recently is working — keep the current schedule.'
        : t.id === 'DECLINING'
          ? 'Consider simplifying the habit or pausing it deliberately before the streak resets on its own.'
          : 'Steady. A small change to the time or the trigger is the most likely way to move this.',
    })
  }

  const w = p.weekday
  if (w?.enough && w.best && w.weakest && w.best.weekday !== w.weakest.weekday && w.best.rate !== w.weakest.rate) {
    cards.push({
      id: 'weekday',
      observation: `${dayName(w.weakest.weekday)} is the weakest day; ${dayName(w.best.weekday)} is the strongest.`,
      evidence: `${w.weakest.done} of ${w.weakest.total} on ${dayName(w.weakest.weekday)}s (${w.weakest.rate}%) versus ${w.best.done} of ${w.best.total} on ${dayName(w.best.weekday)}s (${w.best.rate}%) over the last 90 days.`,
      implication: `Try doing ${habitName} earlier on ${dayName(w.weakest.weekday)}s, or make it lighter that day.`,
    })
  }

  const tm = p.time
  if (tm?.enough && tm.best) {
    const total = (tm.rows || []).reduce((n, r) => n + (r.total || 0), 0)
    cards.push({
      id: 'time',
      observation: `You usually complete it in the ${tm.best.part}.`,
      evidence: `${tm.best.done} of ${total} logged completions were in the ${tm.best.part}.`,
      implication: `Anchor the reminder to the ${tm.best.part} — that is when it already happens.`,
    })
  }

  const s = p.streak
  if (s?.enough && s.breakPoint) {
    cards.push({
      id: 'streak',
      observation: `Streaks tend to break after about ${s.breakPoint} day${s.breakPoint === 1 ? '' : 's'}.`,
      evidence: `Average run ${s.average} days; best run ${s.best} days; current run ${s.current}.`,
      implication: `Day ${s.breakPoint + 1} is the one to protect — plan the smallest possible version for it.`,
    })
  }

  const wl = p.workload
  if (wl?.enough) {
    cards.push({
      id: 'workload',
      observation: wl.observation || 'Completion changes with workload.',
      evidence: `${wl.high}% on high-workload days versus ${wl.low}% on lighter days.`,
      implication: 'On heavy days keep it small rather than skipping — a two-minute version still keeps the run alive.',
    })
  }

  return cards
}
