/* ============================================================
   ACCOUNT — sign in, sync status, and the way out.

   The app does not require an account. This page exists to add
   backup and a second device, and it says plainly what changes
   when you do, and what does not change when you do not.
   ============================================================ */
import { useState } from 'react'
import { useStore } from '../../core/store.jsx'
import { Panel, Button, Field, Input, SectionHead, Confirm, useToast, Badge, plural } from '../../ui/index.jsx'
import { IconRefresh, IconSignOut, IconTrash, IconLock, IconCloudOff } from '../../ui/icons.jsx'
import { Link, useRoute } from '../../app/router.jsx'
import { useAuth } from '../../cloud/AuthProvider.jsx'
import { useSync } from '../../cloud/SyncProvider.jsx'
import { summarise } from '../../cloud/merge.js'
import AuthForm from './AuthForm.jsx'
import { SyncSummary } from './SyncState.jsx'

export default function AccountScreen() {
  const auth = useAuth()
  const sync = useSync()

  if (!auth?.configured) return <NoCloudBuild />
  if (auth.loading) {
    return (
      <div className="stack stack--loose">
        <SectionHead eyebrow="Yours" title="Account" />
        <div className="skel" style={{ height: 180, borderRadius: 'var(--r-md)' }} aria-label="Checking your session" />
      </div>
    )
  }
  if (auth.recovery) return <ChoosePassword />
  if (!auth.user) return <SignedOut />
  return <SignedIn auth={auth} sync={sync} />
}

/* ---------------- Not available in this build ---------------- */

function NoCloudBuild() {
  return (
    <div className="stack stack--loose">
      <SectionHead eyebrow="Yours" title="Account" sub="Accounts are not available in this build." />
      <Panel title="Running without a server">
        <div className="stack">
          <p className="small muted">
            This copy of the app was built without cloud credentials, so there is nothing to sign in to.
            Everything works exactly as it does with an account, except that your data stays in this
            browser and is not backed up.
          </p>
          <p className="small muted">
            Use <Link to="settings" className="linkish">Settings</Link> to export a backup file you can
            keep yourself, or import one into another browser.
          </p>
          <p className="tiny faint">
            To enable accounts, set <code>VITE_SUPABASE_URL</code> and{' '}
            <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> at build time. See <code>supabase/SETUP.md</code>.
          </p>
        </div>
      </Panel>
    </div>
  )
}

/* ---------------- Signed out ---------------- */

function SignedOut() {
  const state = useStore()
  const route = useRoute()
  const counts = summarise(state)
  const hasLocal = counts.habits + counts.work + counts.goals > 0

  return (
    <div className="stack stack--loose">
      <SectionHead
        eyebrow="Yours"
        title="Account"
        sub="Sign in to back your data up and use it on more than one device."
      />

      <div className="grid grid--2">
        <AuthForm initialMode={route.params.get('new') ? 'signup' : 'signin'} />

        <Panel title="What signing in changes">
          <ul className="plainlist small">
            <li>
              Your habits, work, goals, check-ins and mood entries are copied to your account
              and kept up to date as you use the app.
            </li>
            <li>
              Opening the app on another device with the same account shows the same data.
            </li>
            <li>
              {hasLocal
                ? `The ${plural(counts.habits, 'habit')}, ${plural(counts.work, 'work item')} and ${plural(counts.goals, 'goal')} already on this device come with you. Nothing here is replaced without asking you first.`
                : 'This device has no data yet, so it will simply pick up whatever is in your account.'}
            </li>
          </ul>
          <p className="small muted" style={{ marginTop: 'var(--s4)' }}>
            Nothing changes if you do not: the app works offline either way, and you can keep using it
            without an account for as long as you like.
          </p>
          <p className="tiny faint" style={{ marginTop: 'var(--s3)' }}>
            Read the <Link to="privacy" className="linkish">privacy policy</Link> for exactly what is
            stored and where.
          </p>
        </Panel>
      </div>
    </div>
  )
}

/* ---------------- Password recovery ---------------- */

function ChoosePassword() {
  const auth = useAuth()
  const toast = useToast()
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(e) {
    e.preventDefault()
    if (busy) return
    setBusy(true); setError('')
    const res = await auth.updatePassword(password)
    setBusy(false)
    if (res.error) { setError(res.error); return }
    toast('Password updated', 'good')
  }

  return (
    <div className="stack stack--loose">
      <SectionHead eyebrow="Yours" title="Choose a new password" />
      <Panel title="New password" sub="You arrived from a reset link, so you can set a new password now.">
        <form className="stack" onSubmit={submit} noValidate>
          <Field label="New password" hint="At least 8 characters.">
            <Input
              type="password" value={password} required minLength={8}
              autoComplete="new-password" data-autofocus
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          {error && <p className="authmsg authmsg--bad" role="alert">{error}</p>}
          <div className="row" style={{ gap: 'var(--s3)' }}>
            <Button type="submit" variant="primary" icon={<IconLock size={16} />} disabled={busy}>
              {busy ? 'Saving…' : 'Save password'}
            </Button>
            <Button type="button" variant="ghost" onClick={auth.endRecovery}>Cancel</Button>
          </div>
        </form>
      </Panel>
    </div>
  )
}

/* ---------------- Signed in ---------------- */

function SignedIn({ auth, sync }) {
  const state = useStore()
  const toast = useToast()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [confirmStop, setConfirmStop] = useState(false)
  const counts = summarise(state)

  const stop = async () => {
    const res = await sync.forgetCloud()
    if (res?.error) { toast(res.error, 'bad'); return }
    await auth.signOut()
    toast('Cloud copy removed. Your data is still on this device.')
  }

  const remove = async () => {
    const res = await auth.deleteAccount()
    if (res?.error) { toast(res.error, 'bad'); return }
    toast('Account deleted. Your data is still on this device.')
  }

  return (
    <div className="stack stack--loose">
      <SectionHead eyebrow="Yours" title="Account" sub={auth.email} />

      <Panel title="Sync">
        <div className="stack">
          <SyncSummary status={sync?.status} lastSyncedAt={sync?.lastSyncedAt} error={sync?.error} />
          <p className="small muted">
            {plural(counts.habits, 'habit')} · {plural(counts.work, 'work item')} ·{' '}
            {plural(counts.goals, 'goal')} · {plural(counts.checkins, 'check-in')} ·{' '}
            {plural(counts.moods, 'mood entry', 'mood entries')} in your account.
          </p>
          <div className="row row--wrap" style={{ gap: 'var(--s3)' }}>
            <Button icon={<IconRefresh size={16} />} onClick={() => sync?.syncNow()}>Sync now</Button>
            <Button variant="ghost" icon={<IconSignOut size={16} />} onClick={() => auth.signOut()}>
              Sign out
            </Button>
          </div>
          <p className="tiny faint">
            Signing out leaves this device&rsquo;s copy exactly as it is. It does not erase anything.
          </p>
        </div>
      </Panel>

      <Panel title="Your identity">
        <div className="stack stack--tight small muted">
          <div className="idrow">
            <span>Email</span>
            <span className="dim idrow__v">{auth.email}</span>
          </div>
          <div className="idrow">
            <span>Email confirmed</span>
            <span className="dim">
              {auth.emailVerified
                ? <Badge tone="good">Yes</Badge>
                : <Badge tone="warn">Not yet</Badge>}
            </span>
          </div>
        </div>
        {!auth.emailVerified && (
          <p className="small muted" style={{ marginTop: 'var(--s4)' }}>
            Confirm your address from the email we sent, so you can recover your password later.{' '}
            <button
              type="button" className="linkish"
              onClick={async () => {
                const res = await auth.resendVerification(auth.email)
                toast(res.error || 'Confirmation email sent', res.error ? 'bad' : 'good')
              }}
            >
              Send it again
            </button>
          </p>
        )}
      </Panel>

      <Panel title="Stop syncing">
        <div className="row row--between row--wrap">
          <div>
            <div className="strong small">Remove the cloud copy</div>
            <div className="tiny dim">
              Deletes the copy held in your account and signs you out. Your account stays, and this
              device keeps everything.
            </div>
          </div>
          <Button icon={<IconCloudOff size={16} />} onClick={() => setConfirmStop(true)}>
            Remove cloud copy
          </Button>
        </div>
      </Panel>

      <Panel title="Danger zone">
        <div className="row row--between row--wrap">
          <div>
            <div className="strong small">Delete your account</div>
            <div className="tiny dim">
              Erases your account and everything stored in it, permanently. The copy on this device is
              left alone, so export a backup from Settings if you want one.
            </div>
          </div>
          <Button variant="danger" icon={<IconTrash size={16} />} onClick={() => setConfirmDelete(true)}>
            Delete account
          </Button>
        </div>
      </Panel>

      <Confirm
        open={confirmStop}
        title="Remove the cloud copy?"
        body="Your data stops syncing and the copy in your account is deleted. This device keeps everything, and you can sign in again at any time to start over."
        confirmLabel="Remove it"
        danger={false}
        onConfirm={stop}
        onClose={() => setConfirmStop(false)}
      />
      <Confirm
        open={confirmDelete}
        title="Delete your account?"
        body="Your account and the data stored in it are erased permanently. This cannot be undone. The copy in this browser is not touched."
        confirmLabel="Delete account"
        onConfirm={remove}
        onClose={() => setConfirmDelete(false)}
      />
    </div>
  )
}
