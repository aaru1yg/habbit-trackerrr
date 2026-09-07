/* ============================================================
   INTENTS — a one-slot handoff between the Command Center and the
   screen that owns an action.

   Some commands ("Plan my day", "Start focus") are performed by
   panels that live inside TodayScreen and open through an `openTick`
   prop. The Command Center can be open on any route, so it needs a
   way to say "go to Today and open that panel" without a second copy
   of those panels and without new global state in the store.

   One pending intent, consumed exactly once. Deliberately tiny: this
   is plumbing, not a feature, and it holds no data.
   ============================================================ */

let pending = null
const listeners = new Set()

/**
 * Queue an intent and tell anyone already listening. Notifying matters
 * because the receiving screen may already be mounted — navigating to
 * Today from Today does not remount it, so a mount-only check would
 * silently drop the request.
 */
export function setIntent(intent) {
  pending = intent || null
  if (!pending) return
  for (const fn of listeners) fn(pending)
}

/** Subscribe to intents as they are queued. Returns an unsubscribe. */
export function onIntent(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/** Take the pending intent, clearing it. Returns null when there is none. */
export function takeIntent() {
  const value = pending
  pending = null
  return value
}

/** Read without consuming — used by tests. */
export function peekIntent() {
  return pending
}

export const INTENTS = {
  PLAN_DAY: 'plan-day',
  PLAN_WEEK: 'plan-week',
  START_FOCUS: 'start-focus',
}
