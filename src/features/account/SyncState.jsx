/* ============================================================
   SYNC STATE — one vocabulary for "is my data safe?"

   Every surface that reports sync (top bar, account page,
   settings) reads its words from here, so they can never
   disagree with each other or with the engine.
   ============================================================ */
import { SYNC } from '../../cloud/syncEngine.js'
import { IconCloud, IconCloudOff, IconCloudUp, IconAlert, IconCheck } from '../../ui/icons.jsx'
import { Link } from '../../app/router.jsx'

export const SYNC_COPY = {
  [SYNC.LOCAL]: {
    label: 'This device only',
    tone: 'neutral',
    Icon: IconCloudOff,
    detail: 'Your data is saved in this browser and is not backed up anywhere else.',
  },
  [SYNC.SYNCING]: {
    label: 'Saving',
    tone: 'neutral',
    Icon: IconCloudUp,
    detail: 'Sending your latest changes.',
  },
  [SYNC.SYNCED]: {
    label: 'Synced',
    tone: 'good',
    Icon: IconCloud,
    detail: 'Your data is backed up to your account.',
  },
  [SYNC.OFFLINE]: {
    label: 'Offline',
    tone: 'warn',
    Icon: IconCloudOff,
    detail: 'You are offline. Changes are saved here and will sync when you reconnect.',
  },
  [SYNC.ERROR]: {
    label: 'Not synced',
    tone: 'bad',
    Icon: IconAlert,
    detail: 'The last attempt to save to your account did not succeed.',
  },
}

export const syncCopy = (status) => SYNC_COPY[status] || SYNC_COPY[SYNC.LOCAL]

/** Compact top-bar indicator. Only rendered when sync can actually happen. */
export function SyncBadge({ status, error }) {
  const { label, tone, Icon } = syncCopy(status)
  return (
    <Link
      to="account"
      className="syncbadge"
      data-tone={tone}
      title={error || label}
      aria-label={`Sync status: ${label}. Open account.`}
    >
      <Icon size={15} />
      <span className="syncbadge__t">{label}</span>
    </Link>
  )
}

/** The same truth, spelled out, for the account page. */
export function SyncSummary({ status, lastSyncedAt, error }) {
  const { label, tone, Icon, detail } = syncCopy(status)
  return (
    <div className="syncstate" data-tone={tone}>
      <span className="syncstate__ico" aria-hidden="true">
        {status === 'synced' ? <IconCheck size={16} /> : <Icon size={16} />}
      </span>
      <div className="stack stack--tight">
        <div className="strong">{label}</div>
        <p className="small muted">{error || detail}</p>
        {status === 'synced' && lastSyncedAt && (
          <p className="tiny faint">
            Last confirmed by the server at {new Date(lastSyncedAt).toLocaleString()}
          </p>
        )}
      </div>
    </div>
  )
}
