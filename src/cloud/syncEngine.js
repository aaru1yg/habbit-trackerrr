/* ============================================================
   SYNC ENGINE — the only code that talks to `user_state`.

   Status is reported honestly and is never optimistic:
     'local'   — no account, or this build has no cloud config.
                 Nothing is backed up and the UI says so.
     'syncing' — a request is genuinely in flight.
     'synced'  — a round-trip to Postgres resolved. `lastSyncedAt`
                 is the server's own timestamp, not a local guess.
     'offline' — the device is offline; edits are queued locally.
     'error'   — the last attempt failed. Never shown as synced.

   Writes are compare-and-swap on `revision`. The previous version
   of this file incremented a revision column that nothing ever
   checked, so two devices editing at once meant last-write-wins
   and the loser's edits vanished without a word. Here a write that
   lost the race returns { conflict: true } and the caller re-reads
   and merges instead of overwriting.
   ============================================================ */
import { getSupabase } from './client.js'
import { VERSION } from '../core/schema.js'
import { friendlyError } from './errors.js'

export const SYNC = {
  LOCAL: 'local',
  SYNCING: 'syncing',
  SYNCED: 'synced',
  OFFLINE: 'offline',
  ERROR: 'error',
}

const TABLE = 'user_state'

async function db() {
  const sb = await getSupabase()
  if (!sb) throw new Error('Cloud sync is not configured in this build.')
  return sb
}

/** Read this user's document. @returns {{doc, revision, updatedAt}} */
export async function pull(userId) {
  const sb = await db()
  const { data, error } = await sb
    .from(TABLE)
    .select('doc, revision, updated_at')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  if (!data) return { doc: null, revision: 0, updatedAt: null }
  return {
    doc: data.doc ?? null,
    revision: data.revision ?? 0,
    updatedAt: data.updated_at ?? null,
  }
}

/**
 * Write the document, but only if the server is still at `expect`.
 *
 * @param {string} userId
 * @param {object} doc
 * @param {number} expect  revision this write is based on; 0 means "no row yet"
 * @returns {{revision, updatedAt} | {conflict: true}}
 */
export async function push(userId, doc, expect = 0) {
  const sb = await db()
  const row = { doc, schema_version: VERSION }

  if (!expect) {
    // We believe no row exists. Insert, and let the primary key arbitrate:
    // a unique violation means another device created it first, which is a
    // conflict to merge, not an error to show.
    const { data, error } = await sb
      .from(TABLE)
      .insert({ user_id: userId, revision: 1, ...row })
      .select('revision, updated_at')
      .single()
    if (error) {
      if (error.code === '23505') return { conflict: true }
      throw error
    }
    return { revision: data.revision, updatedAt: data.updated_at }
  }

  const { data, error } = await sb
    .from(TABLE)
    .update({ revision: expect + 1, ...row })
    .eq('user_id', userId)
    .eq('revision', expect) // ← the compare half of compare-and-swap
    .select('revision, updated_at')
    .maybeSingle()
  if (error) throw error
  // Zero rows matched: either the revision moved on, or the row is gone.
  if (!data) return { conflict: true }
  return { revision: data.revision, updatedAt: data.updated_at }
}

/** Remove this user's cloud document, leaving the local copy untouched. */
export async function clearCloud(userId) {
  const sb = await db()
  const { error } = await sb.from(TABLE).delete().eq('user_id', userId)
  if (error) throw error
}

export { friendlyError }
