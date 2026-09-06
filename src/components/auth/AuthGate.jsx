/* Decides what the user sees before the app shell.
 *
 * Local-only builds (no Supabase config) go straight through, so the app
 * never blocks behind a login screen that could not create an account. */
import { useAuth } from '../../lib/cloud/AuthProvider.jsx'
import AuthScreen from './AuthScreen.jsx'
import ResetPasswordScreen from './ResetPasswordScreen.jsx'

export default function AuthGate({ children }) {
  const auth = useAuth()

  if (!auth?.configured) return children

  if (auth.loading) {
    return (
      <div className="auth-loading" role="status" aria-label="Loading">
        <span className="spinner" aria-hidden="true" />
      </div>
    )
  }

  if (auth.recovery) return <ResetPasswordScreen />
  if (!auth.user) return <AuthScreen />
  return children
}
