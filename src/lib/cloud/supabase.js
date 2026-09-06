/* Supabase client — created only when real build-time config is present.
 *
 * The app must never *claim* cloud capability it does not have, so this
 * module exports an honest `cloudConfigured` flag. When it is false the UI
 * stays in local-only mode instead of rendering a login screen that cannot
 * possibly create an account. */
import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL?.trim() || ''
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() || ''

/** True only when both public values were injected at build time. */
export const cloudConfigured = Boolean(url && anonKey && /^https?:\/\//.test(url))

export const supabase = cloudConfigured
  ? createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'aaru.auth',
        flowType: 'pkce',
      },
    })
  : null

/** Where Supabase should send users back to after email links.
 *  Derived from the live origin so GitHub Pages and localhost both work
 *  without hardcoding either one. */
export function redirectTo(path = '') {
  if (typeof window === 'undefined') return undefined
  const { origin, pathname } = window.location
  // Keep the Pages subpath (e.g. /habbit-trackerrr/) but drop any file/hash.
  const base = pathname.replace(/[^/]*$/, '')
  return `${origin}${base}${path}`
}
