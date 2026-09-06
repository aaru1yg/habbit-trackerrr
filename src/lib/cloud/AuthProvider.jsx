/* Real Supabase auth session management.
 *
 * Honesty rules baked in:
 *  - `configured` is false when no Supabase config was built in; the app then
 *    runs local-only and must not offer accounts.
 *  - `user` is only ever a real authenticated Supabase user.
 */
import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react'
import { supabase, cloudConfigured, redirectTo } from './supabase.js'
import { friendlyError } from './errors.js'

const AuthContext = createContext(null)
export const useAuth = () => useContext(AuthContext)

export default function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(cloudConfigured)
  // 'idle' | 'recovery' — set when the user arrives via a password-reset link
  const [recovery, setRecovery] = useState(false)

  useEffect(() => {
    if (!cloudConfigured) return
    let alive = true

    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return
      setSession(data.session ?? null)
      setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      if (!alive) return
      if (event === 'PASSWORD_RECOVERY') setRecovery(true)
      if (event === 'SIGNED_OUT') setRecovery(false)
      setSession(next ?? null)
      setLoading(false)
    })
    return () => {
      alive = false
      sub.subscription.unsubscribe()
    }
  }, [])

  const wrap = useCallback(async (fn) => {
    if (!cloudConfigured) return { error: 'Cloud accounts aren’t available in this build.' }
    try {
      const { data, error } = await fn()
      if (error) return { error: friendlyError(error) }
      return { data }
    } catch (e) {
      return { error: friendlyError(e) }
    }
  }, [])

  const signUp = useCallback((email, password, displayName) => wrap(async () => {
    const res = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: redirectTo(),
        data: displayName ? { display_name: displayName } : undefined,
      },
    })
    return res
  }), [wrap])

  const signIn = useCallback((email, password) => wrap(() =>
    supabase.auth.signInWithPassword({ email: email.trim(), password })
  ), [wrap])

  const signInWithGoogle = useCallback(() => wrap(() =>
    supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: redirectTo() } })
  ), [wrap])

  const signOut = useCallback(async () => {
    if (!cloudConfigured) return { error: null }
    await supabase.auth.signOut()
    return {}
  }, [])

  const resetPassword = useCallback((email) => wrap(() =>
    supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: redirectTo() })
  ), [wrap])

  const updatePassword = useCallback(async (password) => {
    const res = await wrap(() => supabase.auth.updateUser({ password }))
    if (!res.error) setRecovery(false)
    return res
  }, [wrap])

  const resendVerification = useCallback((email) => wrap(() =>
    supabase.auth.resend({ type: 'signup', email: email.trim(), options: { emailRedirectTo: redirectTo() } })
  ), [wrap])

  const deleteAccount = useCallback(async () => {
    if (!cloudConfigured) return { error: 'Cloud accounts aren’t available in this build.' }
    try {
      const { error } = await supabase.rpc('delete_own_account')
      if (error) return { error: friendlyError(error) }
      await supabase.auth.signOut()
      return {}
    } catch (e) {
      return { error: friendlyError(e) }
    }
  }, [])

  const user = session?.user ?? null

  const value = useMemo(() => ({
    configured: cloudConfigured,
    loading,
    session,
    user,
    // Supabase marks confirmation via email_confirmed_at / confirmed_at.
    emailVerified: !!(user && (user.email_confirmed_at || user.confirmed_at)),
    recovery,
    endRecovery: () => setRecovery(false),
    signUp,
    signIn,
    signInWithGoogle,
    signOut,
    resetPassword,
    updatePassword,
    resendVerification,
    deleteAccount,
  }), [loading, session, user, recovery, signUp, signIn, signInWithGoogle, signOut, resetPassword, updatePassword, resendVerification, deleteAccount])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
