/* ============================================================
   AUTH — real Supabase sessions, or nothing at all.

   Honesty rules baked in:
     - `configured` is false when no Supabase config was built in.
       The app then runs local-only and never offers an account.
     - `user` is only ever a genuinely authenticated Supabase user.
       There is no guest object pretending to be one.
     - Every failure is translated once, by errors.js, so no raw
       Postgres or GoTrue string ever reaches a person.
   ============================================================ */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { getSupabase } from './client.js'
import { cloudConfigured, googleEnabled, redirectTo } from './config.js'
import { friendlyError } from './errors.js'

const AuthContext = createContext(null)
export const useAuth = () => useContext(AuthContext)

export default function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  // Only "loading" if there is in fact a session to restore.
  const [loading, setLoading] = useState(cloudConfigured)
  // Set when the user arrives through a password-reset link.
  const [recovery, setRecovery] = useState(false)

  useEffect(() => {
    if (!cloudConfigured) return
    let alive = true
    let unsubscribe = () => {}

    ;(async () => {
      const sb = await getSupabase()
      if (!alive) return
      if (!sb) {
        // Configured, but the client could not be constructed. Stop claiming
        // to be loading: an indefinite spinner is worse than an honest
        // signed-out state the user can act on.
        setLoading(false)
        return
      }
      const { data } = await sb.auth.getSession()
      if (!alive) return
      setSession(data.session ?? null)
      setLoading(false)

      const { data: sub } = sb.auth.onAuthStateChange((event, next) => {
        if (!alive) return
        if (event === 'PASSWORD_RECOVERY') setRecovery(true)
        if (event === 'SIGNED_OUT') setRecovery(false)
        setSession(next ?? null)
        setLoading(false)
      })
      unsubscribe = () => sub.subscription.unsubscribe()
    })().catch(() => { if (alive) setLoading(false) })

    return () => { alive = false; unsubscribe() }
  }, [])

  /* One place where every auth call's failure becomes readable English. */
  const wrap = useCallback(async (fn) => {
    if (!cloudConfigured) return { error: 'Accounts aren’t available in this build.' }
    try {
      const sb = await getSupabase()
      const { data, error } = await fn(sb)
      if (error) return { error: friendlyError(error) }
      return { data }
    } catch (e) {
      return { error: friendlyError(e) }
    }
  }, [])

  const signUp = useCallback((email, password, displayName) => wrap((sb) =>
    sb.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: redirectTo(),
        data: displayName ? { display_name: displayName } : undefined,
      },
    })
  ), [wrap])

  const signIn = useCallback((email, password) => wrap((sb) =>
    sb.auth.signInWithPassword({ email: email.trim(), password })
  ), [wrap])

  const signInWithGoogle = useCallback(() => wrap((sb) =>
    sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: redirectTo() } })
  ), [wrap])

  const signOut = useCallback(async () => {
    if (!cloudConfigured) return {}
    const sb = await getSupabase()
    await sb?.auth.signOut()
    return {}
  }, [])

  const resetPassword = useCallback((email) => wrap((sb) =>
    sb.auth.resetPasswordForEmail(email.trim(), { redirectTo: redirectTo() })
  ), [wrap])

  const updatePassword = useCallback(async (password) => {
    const res = await wrap((sb) => sb.auth.updateUser({ password }))
    if (!res.error) setRecovery(false)
    return res
  }, [wrap])

  const resendVerification = useCallback((email) => wrap((sb) =>
    sb.auth.resend({ type: 'signup', email: email.trim(), options: { emailRedirectTo: redirectTo() } })
  ), [wrap])

  /* Erases the auth user and every row it owns, server-side, in one
     transaction. See delete_own_account() in supabase/schema.sql: it is
     SECURITY DEFINER but can only ever act on auth.uid(). */
  const deleteAccount = useCallback(async () => {
    const res = await wrap((sb) => sb.rpc('delete_own_account'))
    if (res.error) return res
    const sb = await getSupabase()
    await sb?.auth.signOut()
    return {}
  }, [wrap])

  const user = session?.user ?? null

  const value = useMemo(() => ({
    configured: cloudConfigured,
    googleEnabled,
    loading,
    session,
    user,
    email: user?.email ?? null,
    // Supabase records confirmation on either column depending on age.
    emailVerified: !!(user && (user.email_confirmed_at || user.confirmed_at)),
    recovery,
    endRecovery: () => setRecovery(false),
    signUp, signIn, signInWithGoogle, signOut,
    resetPassword, updatePassword, resendVerification, deleteAccount,
  }), [loading, session, user, recovery, signUp, signIn, signInWithGoogle,
    signOut, resetPassword, updatePassword, resendVerification, deleteAccount])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
