/* ============================================================
   AUTH FORM — sign in, create an account, recover a password.

   One form, three modes, because they share every field but one.
   Deliberately plain: this is a door, not a landing page. No
   marketing copy, no illustration, no social proof.
   ============================================================ */
import { useState } from 'react'
import { Button, Field, Input, Panel } from '../../ui/index.jsx'
import { IconAlert, IconMail } from '../../ui/icons.jsx'
import { useAuth } from '../../cloud/AuthProvider.jsx'

const MODES = {
  signin: {
    title: 'Sign in',
    sub: 'Your habits, work and goals on every device you use.',
    submit: 'Sign in',
  },
  signup: {
    title: 'Create an account',
    sub: 'Everything already on this device comes with you.',
    submit: 'Create account',
  },
  reset: {
    title: 'Reset your password',
    sub: 'We will email you a link to choose a new one.',
    submit: 'Send reset link',
  },
}

export default function AuthForm({ initialMode = 'signin', onDone }) {
  const auth = useAuth()
  const [mode, setMode] = useState(initialMode)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [offline, setOffline] = useState(false)

  const copy = MODES[mode]

  const switchTo = (next) => {
    setMode(next)
    setError('')
    setNotice('')
  }

  async function submit(e) {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    setNotice('')

    const res = mode === 'signin' ? await auth.signIn(email, password)
      : mode === 'signup' ? await auth.signUp(email, password, name.trim())
      : await auth.resetPassword(email)

    setBusy(false)
    if (res.error) {
      setError(res.error)
      /* Sticky: a request that never reached a server will not start
         reaching one because the person tries a different password. */
      setOffline(Boolean(res.unreachable))
      return
    }
    setOffline(false)

    if (mode === 'reset') {
      setNotice(`If an account exists for ${email.trim()}, a reset link is on its way.`)
      return
    }
    if (mode === 'signup' && !res.data?.session) {
      // Email confirmation is on: there is no session yet, and saying
      // "you're in" would be a lie.
      setNotice(`Check ${email.trim()} for a link to confirm your address, then sign in.`)
      setMode('signin')
      setPassword('')
      return
    }
    onDone?.()
  }

  return (
    <Panel title={copy.title} sub={copy.sub}>
      <form className="stack" onSubmit={submit} noValidate>
        {mode === 'signup' && (
          <Field label="Name" hint="Optional. Used only for the greeting on Today.">
            <Input
              type="text" value={name} autoComplete="name" maxLength={40}
              placeholder="Your name"
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
        )}

        <Field label="Email">
          <Input
            type="email" value={email} required autoComplete="email"
            autoCapitalize="none" spellCheck="false" placeholder="you@example.com"
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>

        {mode !== 'reset' && (
          <Field
            label="Password"
            hint={mode === 'signup' ? 'At least 8 characters.' : undefined}
          >
            <Input
              type="password" value={password} required
              minLength={mode === 'signup' ? 8 : undefined}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
        )}

        {offline && (
          <p className="authmsg authmsg--warn">
            <IconAlert size={16} />
            <span>
              The account service for this build could not be reached, so
              signing in is not possible right now. Everything on this device
              keeps working, and nothing has been lost.
            </span>
          </p>
        )}
        {error && !offline && (
          <p className="authmsg authmsg--bad" role="alert">
            <IconAlert size={16} /><span>{error}</span>
          </p>
        )}
        {notice && (
          <p className="authmsg" role="status">
            <IconMail size={16} /><span>{notice}</span>
          </p>
        )}

        <div className="row row--wrap" style={{ gap: 'var(--s3)' }}>
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? 'Working…' : copy.submit}
          </Button>
          {auth.googleEnabled && mode !== 'reset' && !offline && (
            <Button type="button" onClick={() => auth.signInWithGoogle()} disabled={busy}>
              Continue with Google
            </Button>
          )}
        </div>

        <div className="authalt small">
          {mode === 'signin' && (
            <>
              <button type="button" className="linkish" onClick={() => switchTo('signup')}>
                Create an account
              </button>
              <button type="button" className="linkish" onClick={() => switchTo('reset')}>
                Forgot your password?
              </button>
            </>
          )}
          {mode === 'signup' && (
            <button type="button" className="linkish" onClick={() => switchTo('signin')}>
              I already have an account
            </button>
          )}
          {mode === 'reset' && (
            <button type="button" className="linkish" onClick={() => switchTo('signin')}>
              Back to sign in
            </button>
          )}
        </div>
      </form>
    </Panel>
  )
}
