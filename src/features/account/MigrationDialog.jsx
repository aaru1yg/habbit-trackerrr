/* ============================================================
   MIGRATION — "this device and your account both have data".

   Shown once per account per device, and only when a real choice
   exists. The numbers are counted from the two documents, not
   estimated, and every option states plainly what it keeps and
   what it discards. Nothing is written until the user picks.
   ============================================================ */
import { useState } from 'react'
import { Sheet, Button } from '../../ui/index.jsx'
import { IconMerge, IconCloud, IconCloudOff } from '../../ui/icons.jsx'

const line = (s) => [
  s.habits && `${s.habits} habit${s.habits === 1 ? '' : 's'}`,
  s.work && `${s.work} work item${s.work === 1 ? '' : 's'}`,
  s.goals && `${s.goals} goal${s.goals === 1 ? '' : 's'}`,
  s.checkins && `${s.checkins} check-in${s.checkins === 1 ? '' : 's'}`,
  s.moods && `${s.moods} mood entr${s.moods === 1 ? 'y' : 'ies'}`,
].filter(Boolean).join(' · ') || 'nothing yet'

const OPTIONS = [
  {
    id: 'merge',
    Icon: IconMerge,
    title: 'Combine them',
    body: 'Keep everything from both. Where the same item exists on each side, the version you edited most recently wins. Nothing is thrown away.',
    recommended: true,
  },
  {
    id: 'local',
    Icon: IconCloudOff,
    title: 'Keep this device',
    body: 'Use what is on this device and overwrite your account with it. Anything that exists only in the account is lost.',
  },
  {
    id: 'cloud',
    Icon: IconCloud,
    title: 'Keep the account',
    body: 'Use what is in your account and replace what is on this device. Anything that exists only here is lost.',
  },
]

export default function MigrationDialog({ migration, onResolve }) {
  const [choice, setChoice] = useState('merge')
  const [busy, setBusy] = useState(false)
  if (!migration) return null

  const go = async () => {
    setBusy(true)
    await onResolve(choice)
    setBusy(false)
  }

  return (
    <Sheet
      open
      wide
      title="Combine your data"
      onClose={() => onResolve('cancel')}
      footer={
        <>
          <Button variant="ghost" onClick={() => onResolve('cancel')} disabled={busy}>Decide later</Button>
          <Button variant="primary" onClick={go} disabled={busy} data-autofocus>
            {busy ? 'Working…' : 'Continue'}
          </Button>
        </>
      }
    >
      <div className="stack">
        <p className="small muted">
          This device and your account both hold data, and they are not the same. Choose what
          to do before anything is written.
        </p>

        <div className="grid grid--2">
          <div className="migside">
            <div className="migside__h">On this device</div>
            <div className="small">{line(migration.local)}</div>
          </div>
          <div className="migside">
            <div className="migside__h">In your account</div>
            <div className="small">{line(migration.cloud)}</div>
          </div>
        </div>

        <fieldset className="migopts">
          <legend className="sr-only">How to combine your data</legend>
          {OPTIONS.map((o) => (
            <label key={o.id} className="migopt" data-on={choice === o.id}>
              <input
                type="radio" name="migration" value={o.id}
                checked={choice === o.id}
                onChange={() => setChoice(o.id)}
              />
              <span className="migopt__ico" aria-hidden="true"><o.Icon size={18} /></span>
              <span className="migopt__body">
                <span className="migopt__t">
                  {o.title}
                  {o.recommended && <span className="migopt__rec">Recommended</span>}
                </span>
                <span className="migopt__d">{o.body}</span>
              </span>
            </label>
          ))}
        </fieldset>

        <p className="tiny faint">
          Whichever you choose is remembered for this account on this device, so you are not asked
          again. &ldquo;Decide later&rdquo; leaves you signed in with sync paused and changes nothing.
        </p>
      </div>
    </Sheet>
  )
}
