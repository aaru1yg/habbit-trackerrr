import { useRef, useState } from 'react'
import { useStore } from '../store.jsx'
import { useToast } from '../components/ui/Toaster.jsx'
import Sheet from '../components/ui/Sheet.jsx'
import SectionCard, { CardHead } from '../components/ui/SectionCard.jsx'
import { exportPayload, normalizeImport } from '../lib/importExport.js'
import { notificationState, notificationsSupported } from '../lib/reminders.js'
import { todayStr, daysBetween } from '../lib/dates.js'
import { Link } from '../lib/router.jsx'
import { IconUser, IconPalette, IconBell, IconBellOff, IconDownload, IconUpload, IconTrash, IconClock } from '../lib/icons.jsx'

const THEMES = [
  { id: 'midnight', label: 'Midnight', hint: 'Deep navy · violet to cyan' },
  { id: 'ember', label: 'Ember', hint: 'Warm dark · rose to amber' },
  { id: 'verdant', label: 'Verdant', hint: 'Cool dark · emerald to teal' },
  { id: 'daylight', label: 'Daylight', hint: 'Light mode · same accents' },
]

export default function SettingsScreen() {
  const { state, dispatch } = useStore()
  const toast = useToast()
  const fileRef = useRef(null)
  const [confirmReset, setConfirmReset] = useState(false)
  const [name, setName] = useState(state.profile.name)

  const theme = state.profile.theme || 'midnight'
  const setTheme = (id) => dispatch({ type: 'SET_PROFILE', patch: { theme: id } })

  const saveName = () => {
    const n = name.trim()
    if (n !== state.profile.name) dispatch({ type: 'SET_PROFILE', patch: { name: n } })
  }

  const habitsWithReminders = (state.habits || []).filter((h) => h.reminder && !h.archived)
  const perm = notificationState()

  const onExport = () => {
    const payload = JSON.stringify(exportPayload(state), null, 2)
    const blob = new Blob([payload], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `aaru-habits-${todayStr()}.json`
    a.click()
    URL.revokeObjectURL(url)
    dispatch({ type: 'SET_PROFILE', patch: { lastBackupExport: todayStr() } })
    toast.show('Backup downloaded.')
  }

  const onImportFile = async (file) => {
    try {
      const text = await file.text()
      const parsed = JSON.parse(text) // malformed JSON → catch below
      const clean = normalizeImport(parsed)
      dispatch({ type: 'IMPORT_DATA', data: clean })
      toast.show(`Imported ${clean.habits.length} habit${clean.habits.length === 1 ? '' : 's'}, ${clean.projects.length} goal${clean.projects.length === 1 ? '' : 's'}.`)
    } catch (err) {
      toast.show(err.message === 'File is not valid JSON data.' ? 'That file isn\u2019t valid JSON.' : `Import failed: ${err.message}`)
    }
  }

  const onReset = () => {
    dispatch({ type: 'RESET_ALL' })
    setConfirmReset(false)
    toast.show('Everything cleared. Fresh start.')
  }

  const lastExport = state.profile.lastBackupExport
  const backupAge = lastExport ? daysBetween(lastExport, todayStr()) : null

  return (
    <div className="screen" id="settings-screen">
      <header className="screen-head">
        <div>
          <h1 className="screen-title">Settings</h1>
          <p className="screen-sub">Everything is stored on this device — no account, no cloud.</p>
        </div>
      </header>

      <div className="stack">
        <SectionCard className="pad">
          <CardHead title="Your name" />
          <div style={{ display: 'flex', gap: 8 }}>
            <span style={{ color: 'var(--text-3)', alignSelf: 'center' }}><IconUser size={18} /></span>
            <input
              className="field"
              value={name}
              maxLength={40}
              placeholder="What should we call you?"
              aria-label="Your name"
              onChange={(e) => setName(e.target.value)}
              onBlur={saveName}
              onKeyDown={(e) => e.key === 'Enter' && saveName()}
            />
          </div>
        </SectionCard>

        <SectionCard className="pad">
          <CardHead title="Theme" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
            {THEMES.map((t) => (
              <button
                key={t.id}
                className="theme-card"
                onClick={() => setTheme(t.id)}
                aria-pressed={theme === t.id}
                style={{
                  display: 'flex', flexDirection: 'column', gap: 8, padding: 12, borderRadius: 16,
                  border: `1.5px solid ${theme === t.id ? 'var(--accent-1)' : 'var(--border)'}`,
                  background: 'var(--surface-2)', textAlign: 'left',
                  boxShadow: theme === t.id ? '0 0 0 3px var(--accent-soft)' : 'none',
                }}
              >
                <ThemeSwatch id={t.id} />
                <span style={{ fontWeight: 700, fontSize: 'var(--fs-sm)' }}>{t.label}</span>
                <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-3)' }}>{t.hint}</span>
              </button>
            ))}
          </div>
        </SectionCard>

        <SectionCard className="pad">
          <CardHead title="Reminders" />
          {habitsWithReminders.length === 0 ? (
            <p style={{ color: 'var(--text-2)', fontSize: 'var(--fs-sm)' }}>
              No reminders set. Add one when creating or editing a habit — permission is only asked then.
            </p>
          ) : (
            <>
              <p style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--fs-sm)', color: perm === 'granted' ? 'var(--good)' : 'var(--warn)', fontWeight: 600, marginBottom: 12 }}>
                {perm === 'granted' ? <IconBell size={15} /> : <IconBellOff size={15} />}
                {perm === 'granted' ? 'Notifications are on.' : perm === 'denied' ? 'Notifications are blocked — reminders will appear in-app only.' : 'Notifications not yet enabled — they\u2019ll be requested when you next edit a reminder.'}
              </p>
              <div className="stack" style={{ gap: 8 }}>
                {habitsWithReminders.map((h) => (
                  <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 12, background: 'var(--surface-2)' }}>
                    <IconClock size={16} />
                    <span style={{ flex: 1, fontSize: 'var(--fs-sm)', fontWeight: 600 }}>{h.name}</span>
                    <span className="tnum" style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-2)' }}>{h.reminder}</span>
                  </div>
                ))}
              </div>
              <p style={{ color: 'var(--text-3)', fontSize: 'var(--fs-xs)', marginTop: 12 }}>
                Reminders arrive while the app is open in this browser.
              </p>
            </>
          )}
        </SectionCard>

        <SectionCard className="pad">
          <CardHead title="Your data" />
          <div className="stack" style={{ gap: 10 }}>
            <p style={{ color: 'var(--text-2)', fontSize: 'var(--fs-sm)' }}>
              {lastExport
                ? `Last backup: ${backupAge === 0 ? 'today' : `${backupAge} day${backupAge === 1 ? '' : 's'} ago`}.`
                : 'You haven\u2019t exported a backup yet.'}
            </p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button className="btn" onClick={onExport}>
                <IconDownload size={16} /> Export backup
              </button>
              <button className="btn" onClick={() => fileRef.current?.click()}>
                <IconUpload size={16} /> Import
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="application/json,.json"
                className="sr-only"
                aria-label="Import backup file"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) onImportFile(f)
                  e.target.value = ''
                }}
              />
              {confirmReset ? (
                <>
                  <button className="btn danger" onClick={onReset}>Yes, erase everything</button>
                  <button className="btn ghost" onClick={() => setConfirmReset(false)}>Cancel</button>
                </>
              ) : (
                <button className="btn ghost" style={{ color: 'var(--bad)' }} onClick={() => setConfirmReset(true)}>
                  <IconTrash size={16} /> Erase all data
                </button>
              )}
            </div>
            <p style={{ color: 'var(--text-3)', fontSize: 'var(--fs-xs)' }}>
              Exports include habits, history, goals, and moods. Imports are validated before anything is replaced.
            </p>
          </div>
        </SectionCard>

        <SectionCard className="pad">
          <CardHead title="About" />
          <p style={{ color: 'var(--text-2)', fontSize: 'var(--fs-sm)', lineHeight: 1.6 }}>
            Aaru Habits — a calm habit tracker. Works offline, installs to your home screen, and never sends your data anywhere.
          </p>
        </SectionCard>
      </div>
    </div>
  )
}

function ThemeSwatch({ id }) {
  const looks = {
    midnight: ['#0b0f1a', '#6d4aff', '#22d3ee'],
    ember: ['#120e14', '#e0476c', '#fb923c'],
    verdant: ['#0c1310', '#0fa971', '#2dd4bf'],
    daylight: ['#f4f5f8', '#5a3df0', '#0891b2'],
  }
  const [bg, a, b] = looks[id]
  return (
    <span aria-hidden="true" style={{ display: 'flex', height: 44, borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)' }}>
      <span style={{ flex: 1, background: bg }} />
      <span style={{ width: 18, background: a }} />
      <span style={{ width: 18, background: b }} />
    </span>
  )
}
