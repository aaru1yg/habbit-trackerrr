/* Memory of a resolved first-login migration, per account, on this device.
 *
 * Why this exists: after ANY migration choice the data ends up on BOTH sides —
 * 'merge' writes the merged doc to local AND cloud, 'keep local' pushes it to
 * the cloud, 'use cloud' imports it locally. "Both sides hold data" is exactly
 * the condition that raises the prompt, so without a persisted record of the
 * decision the dialog would reappear on every sign-in, asking the user to make
 * a choice they already made.
 *
 * The record is keyed by user id, so two accounts sharing one browser stay
 * independent: each makes (and remembers) its own decision.
 */
const KEY = 'aaru.habits.migration.v1'
const CHOICES = ['merge', 'local', 'cloud']

/** The choice this device previously made for this account, or null. */
export function readMigrationChoice(userId) {
  if (!userId) return null
  try {
    const map = JSON.parse(localStorage.getItem(KEY) || '{}')
    const choice = map?.[userId]
    return CHOICES.includes(choice) ? choice : null
  } catch {
    return null // corrupt or unavailable storage — fall back to asking
  }
}

/** Persist a successful resolution so this pair is never asked again. */
export function writeMigrationChoice(userId, choice) {
  if (!userId || !CHOICES.includes(choice)) return
  try {
    let map = {}
    try { map = JSON.parse(localStorage.getItem(KEY) || '{}') || {} } catch { map = {} }
    map[userId] = choice
    localStorage.setItem(KEY, JSON.stringify(map))
  } catch { /* quota/private mode — the prompt may reappear; non-fatal */ }
}

/** Order-insensitive JSON form.
 *
 * Lets a local document be compared with its cloud round-trip: Postgres jsonb
 * does not preserve object key order, so plain JSON.stringify comparison would
 * produce false "diverged" verdicts. Values are JSON data only (docs come from
 * JSON.parse / the reducer), so undefined/functions cannot occur. */
export function canonicalJson(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value ?? null)
  if (Array.isArray(value)) return '[' + value.map(canonicalJson).join(',') + ']'
  const keys = Object.keys(value).sort()
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + canonicalJson(value[k])).join(',') + '}'
}
