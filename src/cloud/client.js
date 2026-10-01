/* ============================================================
   SUPABASE CLIENT — loaded on demand, never on first paint.

   The app is local-first: it is fully usable with no account, so
   paying ~40 kB to construct an auth client before the first habit
   renders would be a tax on the common case. `getSupabase()`
   dynamic-imports the SDK the first time something actually needs
   it (restoring a session, signing in, syncing) and memoises the
   instance thereafter.
   ============================================================ */
import { SUPABASE_URL, SUPABASE_KEY, cloudConfigured } from './config.js'

let clientPromise = null
let injected = null

/** @returns {Promise<import('@supabase/supabase-js').SupabaseClient|null>} */
export function getSupabase() {
  // An injected client wins over the config check: the suite supplies a fake
  // backend, and there is no build-time Supabase config under test.
  if (injected) return injected
  if (!cloudConfigured) return Promise.resolve(null)
  clientPromise ||= import('@supabase/supabase-js').then(({ createClient }) =>
    createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'aaru.auth',
        flowType: 'pkce',
      },
    })
  )
  return clientPromise
}

/** Test seam: lets the suite install a fake backend without a network. */
export function __setSupabaseForTests(client) {
  injected = client ? Promise.resolve(client) : null
  clientPromise = null
}
