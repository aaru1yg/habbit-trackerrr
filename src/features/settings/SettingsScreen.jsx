/* ============================================================
   SETTINGS — you, the look, and your data. Nothing else.
   ============================================================ */
import { useRef, useState } from 'react'
import { useStore, useActions } from '../../core/store.jsx'
import { exportState, importState, STORAGE_KEY, LEGACY_KEYS } from '../../core/schema.js'
import { now, today, fmtMoment } from '../../core/date.js'
import { lifetime } from '../../core/compute.js'
import {
  Panel, Button, Field, Input, Segmented, SwitchRow, Confirm, SectionHead, useToast, Badge,
} from '../../ui/index.jsx'
import { IconDownload, IconUpload, IconTrash } from '../../ui/icons.jsx'
import { Link } from '../../app/router.jsx'

export default function SettingsScreen() {
  const state = useStore()
  const actions = useActions()
  const toast = useToast()
  const fileRef = useRef(null)
  const [resetting, setResetting] = useState(false)
  const [importErr, setImportErr] = useState('')

  const stats = lifetime(state)
  const hasLegacy = LEGACY_KEYS.some((k) => localStorage.getItem(k))

  const doExport = () => {
    const blob = new Blob([exportState(state)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `habit-os-${today()}.json`
    a.click()
    URL.revokeObjectURL(url)
    actions.setProfile({ lastExport: now() })
    toast('Backup downloaded', 'good')
  }

  const doImport = async (file) => {
    setImportErr('')
    try {
      const next = importState(await file.text())
      actions.hydrate(next)
      toast('Backup restored', 'good')
    } catch (e) {
      setImportErr(e.message)
      toast(e.message, 'bad')
    }
  }

  return (
    <div className="stack stack--loose">
      <SectionHead eyebrow="Yours" title="Settings" sub="This app has no account and no server. Everything lives in this browser." />

      <Panel title="You" className="rise" style={{ '--i': 0 }}>
        <Field label="Name" hint="Used in the greeting on Today. Leave it blank if you’d rather not.">
          <Input
            style={{ maxWidth: '22rem' }}
            defaultValue={state.profile.name}
            placeholder="Your name"
            maxLength={40}
            onBlur={(e) => actions.setProfile({ name: e.target.value.trim() })}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          />
        </Field>
      </Panel>

      <Panel title="Appearance" className="rise" style={{ '--i': 1 }}>
        <div className="stack">
          <Field label="Theme">
            <Segmented
              label="Theme"
              value={state.profile.theme}
              onChange={(v) => actions.setProfile({ theme: v })}
              options={[
                { value: 'light', label: 'Light' },
                { value: 'dark', label: 'Dark' },
              ]}
            />
          </Field>

          <SwitchRow
            label="Interface transitions"
            hint="Short fades when a screen changes. Turn off for a completely still interface. Your system’s reduce-motion setting overrides this either way."
            checked={state.profile.motion === 'full'}
            onChange={(on) => actions.setProfile({ motion: on ? 'full' : 'calm' })}
          />
        </div>
      </Panel>

      <Panel
        title="Your data"
        sub={state.profile.lastExport ? `Last backup ${fmtMoment(state.profile.lastExport)}` : 'You have never exported a backup'}
        className="rise"
        style={{ '--i': 2 }}
      >
        <div className="stack">
          <p className="small muted">
            {stats.totalCheckins} check-ins · {state.habits.length} habits · {state.work.length} work items ·{' '}
            {state.goals.length} goals · {Object.keys(state.moods).length} mood entries.
          </p>

          <div className="row row--wrap">
            <Button icon={<IconDownload size={16} />} onClick={doExport}>Export JSON</Button>
            <Button icon={<IconUpload size={16} />} onClick={() => fileRef.current?.click()}>Import backup</Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="sr-only"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) doImport(f); e.target.value = '' }}
            />
          </div>
          {importErr && <p className="small" style={{ color: 'var(--danger)' }}>{importErr}</p>}

          <p className="tiny faint">
            Importing replaces everything currently in the app. Export first if you are not sure.
          </p>

          {hasLegacy && (
            <p className="tiny faint">
              <Badge tone="neutral">Legacy data found</Badge>{' '}
              Your previous version’s data was migrated into this one and the old copy was left untouched,
              so nothing was lost in the upgrade.
            </p>
          )}
        </div>
      </Panel>

      <Panel title="Danger zone" className="rise" style={{ '--i': 3 }}>
        <div className="row row--between row--wrap">
          <div>
            <div className="strong small">Erase everything</div>
            <div className="tiny dim">Every habit, check-in, project, goal and mood entry. There is no undo.</div>
          </div>
          <Button variant="danger" icon={<IconTrash size={16} />} onClick={() => setResetting(true)}>Reset app</Button>
        </div>
      </Panel>

      <Panel title="About" className="rise" style={{ '--i': 4 }}>
        <div className="stack stack--tight small muted">
          <div className="row row--between"><span>Build</span><span className="num dim">{__BUILD_ID__}</span></div>
          <div className="row row--between"><span>Data format</span><span className="num dim">v{state.version}</span></div>
          <div className="row row--between"><span>Storage key</span><span className="num dim">{STORAGE_KEY}</span></div>
          <div className="row row--between"><span>Storage</span><span className="dim">This browser only</span></div>
        </div>
        <p className="tiny faint" style={{ marginTop: 'var(--s4)' }}>
          No analytics, no telemetry, no network requests for your data. The only way anything leaves this
          device is the export button above.
        </p>
        <div className="row" style={{ gap: 'var(--s2)', marginTop: 'var(--s4)' }}>
          <Link to="privacy" className="btn btn--sm">Privacy</Link>
          <Link to="terms" className="btn btn--sm">Terms</Link>
        </div>
      </Panel>

      <Confirm
        open={resetting}
        title="Erase everything?"
        body="This wipes all of your data from this browser immediately. If you might want it back, cancel and export a backup first."
        confirmLabel="Erase it all"
        onConfirm={() => { actions.reset(); toast('Everything erased') }}
        onClose={() => setResetting(false)}
      />
    </div>
  )
}
