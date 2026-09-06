/* Shown when the user arrives via a Supabase password-recovery link.
 * Supabase has already exchanged the link for a temporary session, so the
 * only remaining step is choosing the new password. */
import { useState } from 'react'
import { useAuth } from '../../lib/cloud/AuthProvider.jsx'
import { IconCheck } from '../../lib/icons.jsx'

export default function ResetPasswordScreen() {
  const auth = useAuth()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (password.length < 8) return setError('Please use a password of at least 8 characters.')
    if (password !== confirm) return setError('Those passwords don’t match.')
    setBusy(true)
    const { error } = await auth.updatePassword(password)
    setBusy(false)
    if (error) setError(error)
  }

  return (
    <div className="auth-shell auth-shell-single">
      <main className="auth-panel">
        <div className="auth-card">
          <div className="auth-logo auth-logo-mobile">
            <span className="auth-logo-mark"><IconCheck size={18} /></span>
            <span className="auth-logo-word">Habit OS</span>
          </div>
          <h2 className="auth-title">Choose a new password</h2>
          <p className="auth-sub">You’re signed in from your reset link. Pick a new password to finish.</p>

          {error && <p className="auth-alert auth-alert-bad" role="alert">{error}</p>}

          <form onSubmit={submit} className="stack" style={{ gap: 14 }} noValidate>
            <div>
              <label className="field-label" htmlFor="new-password">New password</label>
              <input id="new-password" className="field" type="password" value={password} required
                autoComplete="new-password" placeholder="At least 8 characters"
                onChange={(e) => setPassword(e.target.value)} />
            </div>
            <div>
              <label className="field-label" htmlFor="confirm-password">Confirm password</label>
              <input id="confirm-password" className="field" type="password" value={confirm} required
                autoComplete="new-password" onChange={(e) => setConfirm(e.target.value)} />
            </div>
            <button className="btn primary auth-submit" type="submit" disabled={busy}>
              {busy ? 'Saving…' : 'Save password'}
            </button>
          </form>

          <div className="auth-links">
            <button type="button" className="auth-link" onClick={() => { auth.endRecovery(); auth.signOut() }}>
              Cancel and sign in instead
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}
