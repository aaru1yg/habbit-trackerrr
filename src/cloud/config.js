/* ============================================================
   CLOUD CONFIG — the one honest answer to "can this build sync?"

   Deliberately free of any `@supabase/supabase-js` import. The
   client weighs more than the rest of the app put together, so it
   must never reach the first chunk; see client.js. This module is
   pure environment reading and is safe to import anywhere.

   Both values are injected at build time by Vite and are public by
   design: the publishable key's entire authority is bounded by the
   row level security policies in supabase/schema.sql. The
   service_role key must never appear in a VITE_ variable.
   ============================================================ */

const raw = import.meta.env.VITE_SUPABASE_URL?.trim() || ''
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() || ''

/* A value starting with "/" is a same-origin path, which lets a deployment
   put Supabase behind its own domain (sidestepping third-party cookie and
   CORS rules) and lets local verification point at a stub on the dev server.
   Anything else must be an absolute http(s) URL. */
const absolute = /^https?:\/\//.test(raw)
const sameOrigin = raw.startsWith('/')
const origin = typeof window === 'undefined' ? '' : window.location.origin

export const SUPABASE_URL = absolute ? raw : sameOrigin ? origin + raw.replace(/\/$/, '') : ''
export const SUPABASE_KEY = publishableKey

/** True only when both public values were injected and the URL resolves.
 *  When false the app runs local-only and must not offer accounts: a sign-in
 *  form that cannot possibly reach a server is a lie. */
export const cloudConfigured = Boolean(SUPABASE_URL && publishableKey)

/** Google sign-in is off unless the deployment opts in, because the button
 *  only works if the provider is actually enabled in the Supabase project.
 *  Offering it otherwise sends people to an error page. */
export const googleEnabled =
  cloudConfigured && String(import.meta.env.VITE_SUPABASE_GOOGLE || '').trim() === 'true'

/** Where Supabase should return the user after an email link. Derived from
 *  the live origin so a custom domain, GitHub Pages' subpath and localhost
 *  all work without hardcoding any of them. */
export function redirectTo(path = '') {
  if (typeof window === 'undefined') return undefined
  const { origin, pathname } = window.location
  const base = pathname.replace(/[^/]*$/, '') // keep the subpath, drop the file
  return `${origin}${base}${path}`
}
