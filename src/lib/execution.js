/* ============================================================
   EXECUTION — Phase F.

   LAZY-ONLY. Reached through ExecutionPanels, which TodayScreen loads
   with React.lazy. The reason is bundle, not tidiness: contextualLens
   was dead code until Phase F, and making it reachable from an eager
   screen dragged its dependency subgraph into the initial chunk
   (232.9 -> 235.5 kB gz, leaving 0.5 kB of a 236 kB cap).

   It adds no engine of its own — it composes contextualLens,
   getNextBestAction and the focus log that already exist.
   ============================================================ */
import { dayStr, minutesLabel } from './dates.js'
import { contextualLens, preferencesOf } from './personalization.js'
import { getNextBestAction } from './adaptive.js'
import { hrefFor, isCompletable } from './completion.js'

export const NOT_ENOUGH = 'Not enough data yet.'

/* ------------------------------------------------------------
   The execution context — what to do right now, and why

   contextualLens already worked out the time-of-day / load / capacity
   reading; nothing was rendering it. This pairs it with the next best
   action so one component can show "do this, now, because".
   ------------------------------------------------------------ */

export function executionContext(state, { now = new Date() } = {}) {
  const lens = contextualLens(state, { now })
  const prefs = preferencesOf(state)
  const next = getNextBestAction(state, { now, capacityMin: prefs.dailyCapacityMin })

  if (!next) {
    return {
      enough: false,
      reason: 'Nothing open to work on right now.',
      lens, next: null, item: null, completable: false,
    }
  }

  const item = next.item
  const kind = item.kind
  const completable = isCompletable(kind)
  const minutes = Number.isFinite(next.estimatedMin) ? next.estimatedMin : null

  /* One sentence that joins the context to the choice. It only states
     what the engines actually returned. */
  const context = !lens.enough
    ? next.reason
    : lens.prefers === 'short' && minutes != null && minutes > 30
      ? `${next.reason} It is a long block and this is a short window, so a smaller first step may fit better.`
      : lens.prefers === 'long' && minutes != null
        ? `${next.reason} You have a long window right now, which suits it.`
        : next.reason

  return {
    enough: true,
    lens,
    next,
    item,
    kind,
    name: item.label || item.name,
    href: hrefFor(kind, item),
    completable,
    minutes,
    minutesLabel: minutes == null ? null : minutesLabel(minutes),
    deadline: next.deadline,
    risk: next.urgency,
    reason: next.reason,
    context,
  }
}

/* ------------------------------------------------------------
   #28 · Weekly adaptation — planned vs actual

   The focus log already stores plannedMin and actualMin per session.
   This is the only place that reads the pair. It never edits a stored
   estimate; it produces a suggestion the user accepts or dismisses.
   ------------------------------------------------------------ */

const MIN_SESSIONS = 3
const MIN_GAP_RATIO = 0.15

export function weeklyAdaptation(state, { days = 28, now = new Date() } = {}) {
  const cutoff = dayStr(new Date(now.getTime() - days * 86400000))
  const sessions = (state.focusLog || []).filter((s) => {
    if (!s?.endedAt || !s.completed) return false
    const d = dayStr(new Date(s.endedAt))
    return d >= cutoff
  })

  const measured = sessions.filter((s) => Number.isFinite(s.actualMin) && Number.isFinite(s.plannedMin) && s.plannedMin > 0)

  if (measured.length < MIN_SESSIONS) {
    return {
      enough: false,
      sessions: measured.length,
      needed: MIN_SESSIONS,
      reason: measured.length
        ? `${measured.length} finished session${measured.length === 1 ? '' : 's'} so far — ${MIN_SESSIONS} are needed before a planned-versus-actual comparison means anything.`
        : NOT_ENOUGH,
      suggestions: [],
    }
  }

  const plannedTotal = measured.reduce((n, s) => n + s.plannedMin, 0)
  const actualTotal = measured.reduce((n, s) => n + s.actualMin, 0)
  const ratio = plannedTotal > 0 ? actualTotal / plannedTotal : null
  const gapRatio = ratio == null ? null : ratio - 1

  /* Group by kind so a suggestion names the thing that is mis-estimated. */
  const byKind = {}
  for (const s of measured) {
    const k = s.kind || 'assignment'
    const bucket = (byKind[k] = byKind[k] || { kind: k, n: 0, planned: 0, actual: 0 })
    bucket.n++
    bucket.planned += s.plannedMin
    bucket.actual += s.actualMin
  }

  const suggestions = []
  for (const b of Object.values(byKind)) {
    if (b.n < 2 || b.planned <= 0) continue
    const r = b.actual / b.planned
    const drift = r - 1
    if (Math.abs(drift) < MIN_GAP_RATIO) continue
    const meanPlanned = Math.round(b.planned / b.n)
    const meanActual = Math.round(b.actual / b.n)
    suggestions.push({
      id: `${b.kind}-estimate`,
      kind: b.kind,
      samples: b.n,
      meanPlannedMin: meanPlanned,
      meanActualMin: meanActual,
      drift: Math.round(drift * 100),
      tone: drift > 0 ? 'warn' : 'good',
      title: drift > 0
        ? `${b.kind.replace('-', ' ')} sessions run long`
        : `${b.kind.replace('-', ' ')} sessions finish early`,
      text: drift > 0
        ? `Your last ${b.n} ran ${minutesLabel(meanActual)} against ${minutesLabel(meanPlanned)} planned — about ${Math.round(drift * 100)}% over. Planning ${minutesLabel(meanActual)} would match what actually happens.`
        : `Your last ${b.n} ran ${minutesLabel(meanActual)} against ${minutesLabel(meanPlanned)} planned — about ${Math.round(Math.abs(drift) * 100)}% under. You may be over-reserving time.`,
    })
  }
  suggestions.sort((a, b) => Math.abs(b.drift) - Math.abs(a.drift))

  return {
    enough: true,
    sessions: measured.length,
    needed: MIN_SESSIONS,
    days,
    plannedTotalMin: plannedTotal,
    actualTotalMin: actualTotal,
    ratio: ratio == null ? null : Math.round(ratio * 100) / 100,
    gapRatio,
    summary: gapRatio == null
      ? NOT_ENOUGH
      : Math.abs(gapRatio) < MIN_GAP_RATIO
        ? `Across ${measured.length} sessions your plans match reality within ${Math.round(Math.abs(gapRatio) * 100)}%. Nothing to change.`
        : gapRatio > 0
          ? `Across ${measured.length} sessions you took ${minutesLabel(actualTotal - plannedTotal)} longer than planned.`
          : `Across ${measured.length} sessions you finished ${minutesLabel(plannedTotal - actualTotal)} sooner than planned.`,
    suggestions,
    reason: `From ${measured.length} completed focus session${measured.length === 1 ? '' : 's'} in the last ${days} days. Nothing here changes a stored estimate unless you accept it.`,
  }
}

/* ------------------------------------------------------------
   #27 · proactive, not spammy

   One rule: a nudge is shown at most once per key, and only when an
   engine actually produced something. The dismissed keys live in
   sessionStorage so a reload does not re-nag, and nothing is stored
   in the user's data.
   ------------------------------------------------------------ */

const DISMISS_KEY = 'aaru.nudges.dismissed'

export function dismissedNudges() {
  try {
    const raw = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(DISMISS_KEY) : null
    const list = raw ? JSON.parse(raw) : []
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

export function dismissNudge(key) {
  try {
    if (typeof sessionStorage === 'undefined') return
    const next = [...new Set([...dismissedNudges(), String(key)])]
    sessionStorage.setItem(DISMISS_KEY, JSON.stringify(next))
  } catch {
    /* Private mode or a full quota: failing to remember a dismissal
       must never break the screen. */
  }
}

export const isNudgeDismissed = (key) => dismissedNudges().includes(String(key))

/**
 * The single proactive line for this session. Returns null when there
 * is nothing honest to say or the user has already dismissed it.
 */
export function proactiveNudge(state, { now = new Date() } = {}) {
  const adaptation = weeklyAdaptation(state, { now })
  const best = adaptation.suggestions[0]
  if (best) {
    const key = `estimate:${best.id}:${best.samples}`
    if (!isNudgeDismissed(key)) {
      return { key, tone: best.tone, title: best.title, text: best.text, action: 'weekly' }
    }
  }

  const lens = contextualLens(state, { now })
  if (lens.enough && lens.id === 'critical') {
    const key = `load:${dayStr(now)}`
    if (!isNudgeDismissed(key)) {
      return { key, tone: 'warn', title: 'Today is heavy', text: lens.reason, action: 'workload' }
    }
  }

  return null
}
