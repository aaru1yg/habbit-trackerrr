/* Translate Supabase/network failures into language a normal person can act
 * on. Raw technical strings never reach the UI. */

const MAP = [
  [/invalid login credentials/i, 'That email and password don’t match. Check them and try again.'],
  [/email not confirmed|not confirmed/i, 'Please confirm your email first — check your inbox for the verification link.'],
  [/user already registered|already been registered/i, 'An account with this email already exists. Try signing in instead.'],
  [/password should be at least|weak.?password/i, 'Please choose a longer password — at least 8 characters.'],
  [/unable to validate email|invalid.*email/i, 'That doesn’t look like a valid email address.'],
  [/token has expired|expired|invalid.*token/i, 'That link has expired. Request a new one and try again.'],
  [/rate limit|too many requests/i, 'Too many attempts. Please wait a minute and try again.'],
  [/same.?password|different from the old/i, 'Your new password must be different from your current one.'],
  [/session.*(missing|expired)|jwt expired|refresh.?token/i, 'Your session expired. Please sign in again.'],
  [/failed to fetch|networkerror|network request failed|load failed/i, 'Can’t reach the server. Check your connection and try again.'],
  [/fetch failed|ENOTFOUND|ECONNREFUSED/i, 'The cloud service is unreachable right now. Your data is safe locally.'],
  [/signups? not allowed|disabled/i, 'New sign-ups are currently disabled for this app.'],
  [/row-level security|permission denied/i, 'You don’t have access to that data.'],
]

/** @returns {string} a friendly, actionable message. */
export function friendlyError(err) {
  if (!err) return 'Something went wrong. Please try again.'
  const raw = typeof err === 'string' ? err : err.message || err.error_description || ''
  for (const [re, msg] of MAP) if (re.test(raw)) return msg
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return 'You’re offline. Changes are saved on this device and will sync when you reconnect.'
  }
  return 'Something went wrong. Please try again.'
}
