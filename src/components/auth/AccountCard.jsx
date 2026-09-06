/* Settings → Account.
 *
 * Reports the true backup state. "Synced" appears only after a real cloud
 * round-trip; with no account or no configured backend it says so plainly. */
import { useState } from 'react'
import SectionCard, { CardHead } from '../ui/SectionCard.jsx'
import Sheet from '../ui/Sheet.jsx'
import { useAuth } from '../../lib/cloud/AuthProvider.jsx'
import { useSync } from '../../lib/cloud/SyncProvider.jsx'
import { SYNC } from '../../lib/cloud/syncEngine.js'
import { IconUser, IconTrash } from '../../lib/icons.jsx'

function relativeTime(iso) {
  if (!iso) return null
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return null
  const secs = Math.round((Date.now() - t) / 1000)
  if (secs < 60) return 'just now'
  if (secs < 3600) return `${Math.floor(secs / 60)} min ago`
  if (secs < 86400) return `${Math.floor(secs / 3600)} h ago`
  return new Date(t).toLocaleString()
}

const BADGE = {
  [SYNC.SYNCED]: { label: 'Synced', cls: 'tag-good' },
  [SYNC.SYNCING]: { label: 'Syncing…', cls: 'tag-info' },
  [SYNC.OFFLINE]: { label: 'Offline', cls: 'tag-warn' },
  [SYNC.ERROR]: { label: 'Sync error', cls: 'tag-bad' },
  [SYNC.LOCAL]: { label: 'Local only', cls: 'tag-warn' },
}

export default function AccountCard() {
  const auth = useAuth()
  const sync = useSync()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [changing, setChanging] = useState(false)
  const [pw, setPw] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  // Cloud not built into this bundle — say so honestly, offer no account UI.
  if (!auth?.configured) {
    return (
      <SectionCard>
        <CardHead icon={<IconUser size={16} />} title="Account" />
        <p className="chip tag-warn" style={{ whiteSpace: 'normal' }}>Local only — this build has no cloud backend configured.</p>
        <p style={{ color: 'var(--text-3)', fontSize: 'var(--fs-xs)', marginTop: 8 }}>
          Your data lives on this device. Use Export in Data &amp; backup to keep a copy.
        </p>
      </SectionCard>
    )
  }

  if (!auth.user) {
    return (
      <SectionCard>
        <CardHead icon={<IconUser size={16} />} title="Account" />
        <p className="chip tag-warn" style={{ whiteSpace: 'normal' }}>Not signed in — your data is on this device only.</p>
      </SectionCard>
    )
  }

  const badge = BADGE[sync?.status] || BADGE[SYNC.LOCAL]
  const last = relativeTime(sync?.lastSyncedAt)

  const changePassword = async () => {
    setMsg(''); setBusy(true)
    const { error } = await auth.updatePassword(pw)
    setBusy(false)
    if (error) return setMsg(error)
    setPw(''); setChanging(false); setMsg('Password updated.')
  }

  const doDelete = async () => {
    setBusy(true)
    const { error } = await auth.deleteAccount()
    setBusy(false)
    if (error) { setMsg(error); setConfirmDelete(false) }
  }

  return (
    <SectionCard>
      <CardHead icon={<IconUser size={16} />} title="Account" />

      <div className="stack" style={{ gap: 12 }}>
        <div>
          <p style={{ fontWeight: 600 }}>{auth.user.email}</p>
          {!auth.emailVerified && (
            <p className="chip tag-warn" style={{ whiteSpace: 'normal', marginTop: 6 }}>
              Email not verified — check your inbox for the confirmation link.
            </p>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span className={`chip ${badge.cls}`}>{badge.label}</span>
          {sync?.status === SYNC.SYNCED && last && (
            <span style={{ color: 'var(--text-3)', fontSize: 'var(--fs-xs)' }}>Last synced: {last}</span>
          )}
          {(sync?.status === SYNC.ERROR || sync?.status === SYNC.OFFLINE) && (
            <button className="btn sm" onClick={sync.syncNow}>Try again</button>
          )}
        </div>

        {sync?.error && (
          <p style={{ color: 'var(--bad)', fontSize: 'var(--fs-xs)' }}>{sync.error}</p>
        )}
        {msg && <p style={{ color: 'var(--text-2)', fontSize: 'var(--fs-xs)' }}>{msg}</p>}

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn sm" onClick={() => setChanging((v) => !v)}>Change password</button>
          <button className="btn sm" onClick={() => auth.signOut()}>Sign out</button>
          <button className="btn sm danger" onClick={() => setConfirmDelete(true)}>
            <IconTrash size={14} /> Delete account
          </button>
        </div>

        {changing && (
          <div className="stack" style={{ gap: 8 }}>
            <label className="field-label" htmlFor="change-pw">New password</label>
            <input id="change-pw" className="field" type="password" value={pw} autoComplete="new-password"
              placeholder="At least 8 characters" onChange={(e) => setPw(e.target.value)} />
            <button className="btn primary sm" disabled={busy || pw.length < 8} onClick={changePassword}>
              Save new password
            </button>
          </div>
        )}
      </div>

      <Sheet
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete your account?"
        labelledBy="delete-account-title"
        footer={
          <>
            <button className="btn ghost" onClick={() => setConfirmDelete(false)}>Cancel</button>
            <button className="btn danger" disabled={busy} onClick={doDelete}>
              {busy ? 'Deleting…' : 'Delete permanently'}
            </button>
          </>
        }
      >
        <div className="stack" style={{ gap: 12 }}>
          <p className="chip tag-bad" style={{ whiteSpace: 'normal' }}>This cannot be undone.</p>
          <p style={{ color: 'var(--text-2)', fontSize: 'var(--fs-sm)' }}>
            Every habit, check-in, project, assignment and mood entry stored in
            your account will be permanently erased, and your login will stop
            working. Export your data first if you want to keep a copy.
          </p>
        </div>
      </Sheet>
    </SectionCard>
  )
}
