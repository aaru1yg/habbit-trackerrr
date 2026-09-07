/* Deterministic merge of a local app document with a cloud one.
 *
 * Rules (no silent data loss):
 *  - Collections keyed by id: union. When both sides have the same id, the
 *    row with the newer updatedAt wins; ties prefer cloud (the shared truth).
 *  - Tombstones (deletedAt) are respected and propagate, so a delete on one
 *    device is not resurrected by a stale copy on another.
 *  - Date-keyed maps (checkins, moods): union per key, newer wins.
 *  - Adaptive layer: preferences follow the more recently edited profile;
 *    signals and focus sessions are unioned chronologically.
 */
import { DEFAULT_PREFERENCES } from '../personalization.js'

const time = (v) => {
  const t = Date.parse(v || '')
  return Number.isFinite(t) ? t : 0
}

/**
 * Put a document into the shape this release compares documents in.
 *
 * A document written before the adaptive layer existed has no
 * `preferences`, `signals` or `focusLog`, and its profile carries no
 * `updatedAt`. "Absent" has to compare equal to "default" — otherwise
 * every account signed in before this release would look like a genuine
 * conflict on upgrade and get a migration prompt for a choice that is
 * not actually a choice.
 */
export function comparableDoc(doc) {
  if (!doc || typeof doc !== 'object') return doc
  return {
    ...doc,
    profile: { updatedAt: null, ...(doc.profile || {}) },
    preferences: { ...DEFAULT_PREFERENCES, ...(doc.preferences || {}) },
    signals: Array.isArray(doc.signals) ? doc.signals : [],
    focusLog: Array.isArray(doc.focusLog) ? doc.focusLog : [],
  }
}

/** Newer of two records, cloud winning ties. */
function pick(local, cloud) {
  if (!local) return cloud
  if (!cloud) return local
  const lt = Math.max(time(local.updatedAt), time(local.deletedAt))
  const ct = Math.max(time(cloud.updatedAt), time(cloud.deletedAt))
  return lt > ct ? local : cloud
}

/** Merge two id-keyed arrays. */
export function mergeById(localArr = [], cloudArr = []) {
  const out = new Map()
  for (const r of cloudArr) if (r && r.id) out.set(r.id, r)
  for (const r of localArr) {
    if (!r || !r.id) continue
    out.set(r.id, pick(r, out.get(r.id)))
  }
  // Drop tombstoned rows from the materialised view, keep order stable.
  return [...out.values()]
    .filter((r) => !r.deletedAt)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
}

/** Merge two plain maps of date -> record. */
export function mergeMap(localMap = {}, cloudMap = {}) {
  const out = { ...cloudMap }
  for (const [k, v] of Object.entries(localMap || {})) {
    const c = out[k]
    if (!c) { out[k] = v; continue }
    // Nested per-habit maps (checkins) recurse one level.
    if (v && c && typeof v === 'object' && typeof c === 'object' && !('done' in v) && !('score' in v)) {
      out[k] = mergeMap(v, c)
    } else {
      out[k] = pick(v, c)
    }
  }
  return out
}

/**
 * Merge two append-only event logs (signals, focus sessions).
 * Union by id, chronological, capped — a session or signal recorded on
 * either device survives, and neither side can resurrect a pruned entry
 * beyond the cap.
 */
export function mergeEventLog(localArr = [], cloudArr = [], { at = 'at', cap = 400 } = {}) {
  const out = new Map()
  for (const r of [...(cloudArr || []), ...(localArr || [])]) if (r && r.id) out.set(r.id, r)
  return [...out.values()]
    .sort((a, b) => time(a[at]) - time(b[at]) || String(a.id).localeCompare(String(b.id)))
    .slice(-cap)
}

/** Merge two whole app documents. */
export function mergeDocs(local, cloud) {
  if (!cloud) return local
  if (!local) return cloud
  // Preferences are settings, not a collection: the document whose profile
  // was touched more recently states them, wholesale. SET_PREFERENCE stamps
  // profile.updatedAt precisely so this comparison means something.
  const localIsNewer = time(local.profile?.updatedAt) >= time(cloud.profile?.updatedAt)
  return {
    ...cloud,
    ...local,
    version: Math.max(local.version || 0, cloud.version || 0),
    profile: localIsNewer
      ? { ...cloud.profile, ...local.profile }
      : { ...local.profile, ...cloud.profile },
    preferences: localIsNewer
      ? { ...(cloud.preferences || {}), ...(local.preferences || {}) }
      : { ...(local.preferences || {}), ...(cloud.preferences || {}) },
    habits: mergeById(local.habits, cloud.habits),
    routines: mergeById(local.routines, cloud.routines),
    projects: mergeById(local.projects, cloud.projects),
    assignments: mergeById(local.assignments, cloud.assignments),
    goals: mergeById(local.goals, cloud.goals),
    checkins: mergeMap(local.checkins, cloud.checkins),
    moods: mergeMap(local.moods, cloud.moods),
    signals: mergeEventLog(local.signals, cloud.signals, { at: 'at', cap: 400 }),
    focusLog: mergeEventLog(local.focusLog, cloud.focusLog, { at: 'startedAt', cap: 300 }),
  }
}

/** Human-readable counts for the migration prompt. */
export function summarise(doc) {
  if (!doc) return { habits: 0, projects: 0, assignments: 0, goals: 0, routines: 0, checkins: 0, moods: 0 }
  const countCheckins = Object.values(doc.checkins || {})
    .reduce((n, m) => n + Object.keys(m || {}).length, 0)
  return {
    habits: (doc.habits || []).filter((h) => !h.deletedAt).length,
    projects: (doc.projects || []).filter((p) => !p.deletedAt).length,
    assignments: (doc.assignments || []).filter((a) => !a.deletedAt).length,
    goals: (doc.goals || []).filter((g) => !g.deletedAt).length,
    routines: (doc.routines || []).filter((r) => !r.deletedAt).length,
    checkins: countCheckins,
    moods: Object.keys(doc.moods || {}).length,
  }
}

/** True when a document holds anything worth migrating. */
export function hasData(doc) {
  const s = summarise(doc)
  return s.habits + s.projects + s.assignments + s.goals + s.routines + s.checkins + s.moods > 0
}
