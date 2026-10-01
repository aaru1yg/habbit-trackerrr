/* ============================================================
   MERGE — reconciling two copies of one document.

   Runs in exactly two situations:
     1. first sign-in on a device that already holds local data,
        when the user chooses "combine";
     2. a write that lost a race, where the server moved on since
        we last read it. Rather than clobber the other device, we
        re-read, merge, and write again.

   Rules, in order of precedence:
     - A record deleted on one device stays deleted, unless the
       other device edited it after the deletion. Deletions are
       recorded as tombstones (see schema.js) precisely so that an
       absent record and a deleted record stay distinguishable.
     - Otherwise, for a record present on both sides, the copy with
       the newer `updatedAt` wins. Ties go to the cloud, which is
       the shared truth.
     - A record present on only one side is kept.
     - Date-keyed maps (check-ins, moods) merge per key by the same
       rule, so two devices logging different days both survive.
     - Settings are not a collection. They move together, from
       whichever profile was edited more recently.

   Nothing is ever dropped because it was unrecognised, and no rule
   resolves a conflict by throwing one side away wholesale.
   ============================================================ */
import { DEFAULT_PROFILE, pruneTombstones } from '../core/schema.js'
import { canonicalJson } from './migrationState.js'

const time = (v) => {
  const t = Date.parse(v || '')
  return Number.isFinite(t) ? t : 0
}

/**
 * The instant a record last changed.
 *
 * `updatedAt` is the answer whenever it exists. `createdAt` is only a
 * fallback for records written before edit stamps existed, and must never be
 * mixed in with Math.max: it is a date, so it reads as midnight, and a record
 * created recently but never edited would otherwise outrank a genuine edit
 * made to the other copy an hour ago.
 */
const recordTime = (r) => time(r?.updatedAt) || time(r?.createdAt)

/**
 * Fill in the keys a document written by an older build will not have, so
 * "absent" compares equal to "default". Without this, the first sign-in after
 * an upgrade would read as a genuine conflict and prompt the user to resolve a
 * choice that does not exist.
 */
export function comparableDoc(doc) {
  if (!doc || typeof doc !== 'object') return doc
  return {
    ...doc,
    profile: { ...DEFAULT_PROFILE, ...(doc.profile || {}) },
    habits: doc.habits || [],
    work: doc.work || [],
    goals: doc.goals || [],
    checkins: doc.checkins || {},
    moods: doc.moods || {},
    deleted: doc.deleted || {},
  }
}

/** Order-insensitive identity of a document. */
export const docKey = (doc) => canonicalJson(comparableDoc(doc))

/** Is this record covered by a tombstone that outlives its last edit? */
function buried(record, tombstones) {
  const t = time(tombstones[record.id])
  if (!t) return false
  // An edit made *after* the deletion is a deliberate revival, not a stale
  // copy, so the newer action wins either way.
  return t >= recordTime(record)
}

/** Newer of two records; cloud wins ties. */
function pick(local, cloud) {
  if (!local) return cloud
  if (!cloud) return local
  return recordTime(local) > recordTime(cloud) ? local : cloud
}

/** Union two id-keyed collections, honouring tombstones from both sides. */
export function mergeById(localArr = [], cloudArr = [], tombstones = {}) {
  const out = new Map()
  for (const r of cloudArr) if (r && r.id) out.set(r.id, r)
  for (const r of localArr) {
    if (!r || !r.id) continue
    out.set(r.id, pick(r, out.get(r.id)))
  }
  return [...out.values()]
    .filter((r) => !buried(r, tombstones))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((r, i) => ({ ...r, order: i }))
}

/** Merge one level of a date-keyed map: day -> entry. */
export function mergeDayMap(localMap = {}, cloudMap = {}) {
  const out = { ...cloudMap }
  for (const [day, entry] of Object.entries(localMap || {})) {
    out[day] = out[day] ? pick(entry, out[day]) : entry
  }
  return out
}

/** Merge check-ins: habitId -> day -> entry. */
export function mergeCheckins(local = {}, cloud = {}) {
  const out = {}
  for (const id of new Set([...Object.keys(cloud || {}), ...Object.keys(local || {})])) {
    out[id] = mergeDayMap(local?.[id], cloud?.[id])
  }
  return out
}

/** Union two tombstone maps, keeping the later deletion of any id. */
export function mergeTombstones(local = {}, cloud = {}) {
  const out = { ...(cloud || {}) }
  for (const [id, at] of Object.entries(local || {})) {
    if (!out[id] || time(at) > time(out[id])) out[id] = at
  }
  return pruneTombstones(out)
}

/** Merge two whole documents. Neither argument is mutated. */
export function mergeDocs(localRaw, cloudRaw) {
  if (!cloudRaw) return localRaw
  if (!localRaw) return cloudRaw
  const local = comparableDoc(localRaw)
  const cloud = comparableDoc(cloudRaw)

  const deleted = mergeTombstones(local.deleted, cloud.deleted)
  // Settings travel as a unit: a half-local, half-cloud theme is nobody's
  // preference. `profile.updatedAt` is stamped on every settings change
  // precisely so this comparison means something.
  const localProfileNewer = time(local.profile.updatedAt) >= time(cloud.profile.updatedAt)

  const habits = mergeById(local.habits, cloud.habits, deleted)
  const liveHabits = new Set(habits.map((h) => h.id))
  const goals = mergeById(local.goals, cloud.goals, deleted)
  const liveGoals = new Set(goals.map((g) => g.id))

  const checkins = {}
  for (const [id, days] of Object.entries(mergeCheckins(local.checkins, cloud.checkins))) {
    // A habit that lost the merge takes its history with it, exactly as a
    // local delete does. Orphan check-ins are unreachable either way.
    if (liveHabits.has(id) && Object.keys(days).length) checkins[id] = days
  }

  return {
    ...cloud,
    ...local,
    version: Math.max(local.version || 0, cloud.version || 0),
    profile: localProfileNewer
      ? { ...cloud.profile, ...local.profile }
      : { ...local.profile, ...cloud.profile },
    habits,
    goals: goals.map((g) => ({ ...g, habitIds: (g.habitIds || []).filter((id) => liveHabits.has(id)) })),
    work: mergeById(local.work, cloud.work, deleted)
      .map((w) => (w.goalId && !liveGoals.has(w.goalId) ? { ...w, goalId: null } : w)),
    checkins,
    moods: mergeDayMap(local.moods, cloud.moods),
    deleted,
  }
}

/** Counts for the "how should we combine these?" prompt. Real numbers only. */
export function summarise(doc) {
  const d = doc || {}
  const checkins = Object.values(d.checkins || {})
    .reduce((n, days) => n + Object.keys(days || {}).length, 0)
  return {
    habits: (d.habits || []).length,
    work: (d.work || []).length,
    goals: (d.goals || []).length,
    checkins,
    moods: Object.keys(d.moods || {}).length,
  }
}

/** True when a document holds anything a person would miss. */
export function hasData(doc) {
  const s = summarise(doc)
  return s.habits + s.work + s.goals + s.checkins + s.moods > 0
}
