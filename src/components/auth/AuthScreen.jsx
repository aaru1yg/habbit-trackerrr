/* Welcome / auth experience.
 *
 * Desktop: split composition (brand panel + focused form).
 * Mobile:  single centred column.
 *
 * Uses the app's own visual language — deep ink, violet→cyan, Manrope
 * display type — rather than a generic Supabase template. */
import { useState } from 'react'
import { useAuth } from '../../lib/cloud/AuthProvider.jsx'
import { IconCheck, IconFlame, IconStack } from '../../lib/icons.jsx'

const MODES = { SIGN_IN: 'signin', SIGN_UP: 'signup', FORGOT: 'forgot' }

export default function AuthScreen() {
  const auth = useAuth()
  const [mode, setMode] = useState(MODES.SIGN_IN)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  // Shown after a signup that needs email confirmation.
  const [pendingEmail, setPendingEmail] = useState('')

  const reset = () => { setError(''); setNotice('') }

  const validate = () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Please enter a valid email address.')
      return false
    }
    if (mode !== MODES.FORGOT && password.length < 8) {
      setError('Please use a password of at least 8 characters.')
      return false
    }
    return true
  }

  const submit = async (e) => {
    e.preventDefault()
    reset()
    if (!validate()) return
    setBusy(true)
    try {
      if (mode === MODES.SIGN_IN) {
        const { error } = await auth.signIn(email, password)
        if (error) setError(error)
      } else if (mode === MODES.SIGN_UP) {
        const { data, error } = await auth.signUp(email, password, name.trim())
        if (error) { setError(error); return }
        // No session back → Supabase is waiting on email confirmation.
        if (!data?.session) {
          setPendingEmail(email.trim())
          setNotice(`We sent a confirmation link to ${email.trim()}. Open it to activate your account.`)
        }
      } else {
        const { error } = await auth.resetPassword(email)
        if (error) { setError(error); return }
        setNotice(`If an account exists for ${email.trim()}, a reset link is on its way.`)
      }
    } finally {
      setBusy(false)
    }
  }

  const resend = async () => {
    reset()
    setBusy(true)
    const { error } = await auth.resendVerification(pendingEmail)
    setBusy(false)
    if (error) setError(error)
    else setNotice('Verification email sent again — check your inbox and spam folder.')
  }

  const google = async () => {
    reset()
    setBusy(true)
    const { error } = await auth.signInWithGoogle()
    setBusy(false)
    if (error) setError(error)
  }

  const title = mode === MODES.SIGN_UP ? 'Create your account'
    : mode === MODES.FORGOT ? 'Reset your password'
      : 'Welcome back'
  const subtitle = mode === MODES.SIGN_UP ? 'Start building habits that stick — synced across every device.'
    : mode === MODES.FORGOT ? 'We’ll email you a link to choose a new password.'
      : 'Sign in to pick up exactly where you left off.'

  return (
    <div className="auth-shell">
      <aside className="auth-brand" aria-hidden="true">
        <img className="auth-scene" src="art/scene-hero.webp" alt="" width="1200" height="675" loading="eager" decoding="async" />
        <div className="auth-brand-inner">
          <div className="auth-logo">
            <span className="auth-logo-mark"><IconCheck size={20} /></span>
            <span className="auth-logo-word">Habit OS</span>
          </div>
          <h1 className="auth-brand-title">Small things,<br />done daily.</h1>
          <p className="auth-brand-sub">
            A personal productivity environment — habits, goals, projects and
            deadlines living in one spatial place, backed up to your private
            cloud and waiting on every device you own.
          </p>
          <ul className="auth-points">
            <li><IconFlame size={16} /> Streaks that survive a bad week</li>
            <li><IconStack size={16} /> Projects and assignments together</li>
            <li><IconCheck size={16} /> Private by default, yours alone</li>
          </ul>
        </div>
        {/* V4: the product previewed as floating planes in depth (decorative). */}
        <div className="auth-planes">
          <i>Today</i>
          <i>Habits · streaks</i>
          <i>Projects · goals</i>
          <i>Deadlines · insights</i>
        </div>
        <div className="auth-glow" />
      </aside>

      <main className="auth-panel">
        <div className="auth-hero-mobile" aria-hidden="true">
          <div className="auth-logo" style={{ justifyContent: 'center' }}>
            <span className="auth-logo-mark"><IconCheck size={16} /></span>
            <span className="auth-logo-word">Habit OS</span>
          </div>
          <h1>SMALL THINGS.<br />DONE DAILY.</h1>
          <p>Your personal productivity environment.</p>
        </div>
        <div className="auth-card">
          <div className="auth-logo auth-logo-mobile">
            <span className="auth-logo-mark"><IconCheck size={18} /></span>
            <span className="auth-logo-word">Habit OS</span>
          </div>

          <h2 className="auth-title">{title}</h2>
          <p className="auth-sub">{subtitle}</p>

          {error && <p className="auth-alert auth-alert-bad" role="alert">{error}</p>}
          {notice && <p className="auth-alert auth-alert-good" role="status">{notice}</p>}

          {pendingEmail && mode === MODES.SIGN_UP ? (
            <div className="stack" style={{ gap: 12 }}>
              <button type="button" className="btn" onClick={resend} disabled={busy}>
                Resend verification email
              </button>
              <button type="button" className="btn ghost" onClick={() => { setPendingEmail(''); setMode(MODES.SIGN_IN); reset() }}>
                Back to sign in
              </button>
            </div>
          ) : (
            <form onSubmit={submit} className="stack" style={{ gap: 14 }} noValidate>
              {mode === MODES.SIGN_UP && (
                <div>
                  <label className="field-label" htmlFor="auth-name">Your name <span style={{ color: 'var(--text-3)', fontWeight: 500 }}>(optional)</span></label>
                  <input id="auth-name" className="field" value={name} maxLength={60}
                    autoComplete="name" onChange={(e) => setName(e.target.value)} />
                </div>
              )}

              <div>
                <label className="field-label" htmlFor="auth-email">Email</label>
                <input id="auth-email" className="field" type="email" value={email} required
                  autoComplete="email" inputMode="email" placeholder="you@example.com"
                  onChange={(e) => setEmail(e.target.value)} />
              </div>

              {mode !== MODES.FORGOT && (
                <div>
                  <label className="field-label" htmlFor="auth-password">Password</label>
                  <input id="auth-password" className="field" type="password" value={password} required
                    autoComplete={mode === MODES.SIGN_UP ? 'new-password' : 'current-password'}
                    placeholder={mode === MODES.SIGN_UP ? 'At least 8 characters' : ''}
                    onChange={(e) => setPassword(e.target.value)} />
                </div>
              )}

              <button className="btn primary auth-submit" type="submit" disabled={busy}>
                {busy ? 'One moment…'
                  : mode === MODES.SIGN_UP ? 'Create account'
                    : mode === MODES.FORGOT ? 'Send reset link'
                      : 'Continue'}
              </button>
            </form>
          )}

          {mode === MODES.SIGN_IN && !pendingEmail && (
            <>
              <div className="auth-divider"><span>or</span></div>
              <button type="button" className="btn auth-google" onClick={google} disabled={busy}>
                Continue with Google
              </button>
            </>
          )}

          <div className="auth-links">
            {mode === MODES.SIGN_IN && (
              <>
                <button type="button" className="auth-link" onClick={() => { setMode(MODES.FORGOT); reset() }}>Forgot password?</button>
                <button type="button" className="auth-link" onClick={() => { setMode(MODES.SIGN_UP); reset() }}>Create account</button>
              </>
            )}
            {mode === MODES.SIGN_UP && (
              <button type="button" className="auth-link" onClick={() => { setMode(MODES.SIGN_IN); reset() }}>
                Already have an account? Sign in
              </button>
            )}
            {mode === MODES.FORGOT && (
              <button type="button" className="auth-link" onClick={() => { setMode(MODES.SIGN_IN); reset() }}>
                Back to sign in
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
