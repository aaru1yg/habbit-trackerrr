/* Cloud sync against Supabase `user_state`.
 *
 * Status is reported honestly and is never optimistic:
 *   'local'   — no account / cloud not configured. Not backed up.
 *   'syncing' — a request is in flight.
 *   'synced'  — a real round-trip to Postgres succeeded. lastSyncedAt is the
 *               server timestamp, not a local guess.
 *   'offline' — the device is offline; changes are queued locally.
 *   'error'   — the last attempt failed. Never shows as synced.
 */
import { supabase } from './supabase.js'
import { friendlyError } from './errors.js'

export const SYNC = {
  LOCAL: 'local',
  SYNCING: 'syncing',
  SYNCED: 'synced',
  OFFLINE: 'offline',
  ERROR: 'error',
}

/** Read this user's cloud document. Returns { doc, revision, updatedAt }. */
export async function pull(userId) {
  const { data, error } = await supabase
    .from('user_state')
    .select('doc, revision, updated_at')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  if (!data) return { doc: null, revision: 0, updatedAt: null }
  return { doc: data.doc ?? null, revision: data.revision ?? 0, updatedAt: data.updated_at ?? null }
}

/** Write this user's document. Returns the server-confirmed row. */
export async function push(userId, doc, revision = 1) {
  const { data, error } = await supabase
    .from('user_state')
    .upsert(
      { user_id: userId, doc, revision, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    )
    .select('revision, updated_at')
    .single()
  if (error) throw error
  return { revision: data.revision, updatedAt: data.updated_at }
}

/** Delete this user's cloud document (used by "use local data" resets). */
export async function clearCloud(userId) {
  const { error } = await supabase.from('user_state').delete().eq('user_id', userId)
  if (error) throw error
}

export { friendlyError }
