/* First-login data reconciliation.
 *
 * Appears only when BOTH this device and the cloud hold data, so a choice is
 * genuinely required. Nothing is ever silently overwritten. */
import Sheet from '../ui/Sheet.jsx'
import { useSync } from '../../lib/cloud/SyncProvider.jsx'

function Column({ heading, s }) {
  const rows = [
    ['Habits', s.habits],
    ['Check-ins', s.checkins],
    ['Projects', s.projects],
    ['Assignments', s.assignments],
    ['Routines', s.routines],
    ['Mood entries', s.moods],
  ].filter(([, n]) => n > 0)

  return (
    <div className="migrate-col">
      <h4 className="migrate-col-head">{heading}</h4>
      {rows.length === 0 ? (
        <p className="migrate-empty">Nothing yet</p>
      ) : (
        <ul className="migrate-list">
          {rows.map(([label, n]) => (
            <li key={label}><strong>{n}</strong> {label.toLowerCase()}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function MigrationDialog() {
  const sync = useSync()
  const m = sync?.migration
  if (!m) return null

  return (
    <Sheet
      open
      onClose={() => sync.resolveMigration('cancel')}
      title="Existing data found"
      labelledBy="migrate-title"
      footer={
        <>
          <button className="btn ghost" onClick={() => sync.resolveMigration('cancel')}>Cancel</button>
          <button className="btn primary" onClick={() => sync.resolveMigration('merge')}>Merge both</button>
        </>
      }
    >
      <div className="stack" style={{ gap: 16 }}>
        <p style={{ color: 'var(--text-2)', fontSize: 'var(--fs-sm)' }}>
          This device and your account both contain data. Choose how to combine
          them — nothing is deleted until you pick.
        </p>

        <div className="migrate-grid">
          <Column heading="On this device" s={m.local} />
          <Column heading="In your account" s={m.cloud} />
        </div>

        <div className="stack" style={{ gap: 8 }}>
          <button className="btn" onClick={() => sync.resolveMigration('local')}>
            Keep my local data
            <span className="migrate-hint">Replaces what’s in the cloud</span>
          </button>
          <button className="btn" onClick={() => sync.resolveMigration('cloud')}>
            Use cloud data
            <span className="migrate-hint">Replaces what’s on this device</span>
          </button>
        </div>
      </div>
    </Sheet>
  )
}
