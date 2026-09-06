import { useMemo, useRef, useState } from 'react'
import { useStore } from '../store.jsx'
import { useToast } from '../components/ui/Toaster.jsx'
import Sheet from '../components/ui/Sheet.jsx'
import SectionCard, { CardHead } from '../components/ui/SectionCard.jsx'
import AccountCard from '../components/auth/AccountCard.jsx'
import { useAuth } from '../lib/cloud/AuthProvider.jsx'
import { exportPayload, normalizeImport } from '../lib/importExport.js'
import { notificationState } from '../lib/reminders.js'
import { projectStatus, assignmentStatus } from '../lib/work.js'
import { WorkRow, workProgressOf } from '../components/work/WorkCards.jsx'
import { todayStr, daysBetween } from '../lib/dates.js'
import { Link } from '../lib/router.jsx'
import { IconUser, IconPalette, IconBell, IconBellOff, IconDownload, IconUpload, IconTrash, IconClock } from '../lib/icons.jsx'
import { BUILD_ID, BUILD_TIME } from '../lib/buildInfo.js'

const THEMES = [
  { id: 'midnight', label: 'Midnight', hint: 'Deep ink navy · violet to cyan' },
  { id: 'aurora', label: 'Aurora', hint: 'Teal night · mint to teal' },
  { id: 'verdant', label: 'Verdant', hint: 'Cool forest · emerald to teal' },
  { id: 'ember', label: 'Warm', hint: 'Warm dark · amber to rose' },
  { id: 'daylight', label: 'Light', hint: 'Warm daylight · same accents' },
]

export default function SettingsScreen() {
  const { state, dispatch } = useStore()
  const auth = useAuth()
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

  // ---- deadline alerts (work layer) ----
  const workReminders = state.profile.workReminders !== false
  const hours = [12, 24, 48, 72].includes(Number(state.profile.workReminderHours)) ? Number(state.profile.workReminderHours) : 24
  const setWork = (patch) => dispatch({ type: 'SET_PROFILE', patch })

  const upcoming = useMemo(() => {
    const now = new Date()
    const out = []
    for (const pr of state.projects || []) {
      if (pr.completedAt || pr.archived || !pr.deadline) continue
      const st = projectStatus(pr, now)
      if (!st.complete && st.hasDeadline && st.hoursLeft != null && st.hoursLeft <= hours) out.push({ kind: 'project', item: pr, status: st })
    }
    for (const a of state.assignments || []) {
      if (a.completedAt || a.archived || !a.deadline) continue
      const st = assignmentStatus(a, now)
      if (!st.complete && st.hasDeadline && st.hoursLeft != null && st.hoursLeft <= hours) out.push({ kind: 'assignment', item: a, status: st })
    }
    return out.sort((x, y) => (x.status.hoursLeft ?? 0) - (y.status.hoursLeft ?? 0))
  }, [state, hours])

  const counts = useMemo(() => {
    const checkins = Object.values(state.checkins || {}).reduce((n, days) => n + Object.values(days || {}).filter((c) => c?.done).length, 0)
    return {
      habits: (state.habits || []).filter((h) => !h.archived).length,
      archived: (state.habits || []).filter((h) => h.archived).length,
      routines: (state.routines || []).filter((r) => !r.archived).length,
      projects: (state.projects || []).filter((p2) => !p2.archived).length,
      assignments: (state.assignments || []).filter((a) => !a.archived).length,
      checkins,
      moods: Object.keys(state.moods || {}).length,
    }
  }, [state])

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
      const bits = [
        `${clean.habits.length} habit${clean.habits.length === 1 ? '' : 's'}`,
        `${clean.projects.length} project${clean.projects.length === 1 ? '' : 's'}`,
        `${clean.assignments.length} assignment${clean.assignments.length === 1 ? '' : 's'}`,
      ]
      if (clean.routines?.length) bits.push(`${clean.routines.length} routine${clean.routines.length === 1 ? '' : 's'}`)
      toast.show(`Imported ${bits.join(', ')}.`)
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
          <p className="screen-sub">
            {auth?.configured && auth?.user
              ? 'Synced to your account and backed up in the cloud.'
              : 'Everything is stored on this device — no account, no cloud.'}
          </p>
        </div>
      </header>

      <div className="stack">
        <AccountCard />

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
                  display: 'flex', flexDirection: 'column', gap: 8, padding: 12, borderRadius: 'var(--r-md)',
                  border: `1.5px solid ${theme === t.id ? 'var(--accent-1)' : 'var(--border)'}`,
                  background: 'var(--surface-2)', textAlign: 'left',
                  boxShadow: theme === t.id ? '0 0 0 3px var(--accent-soft)' : 'none',
                  minHeight: 'var(--touch)',
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
          <CardHead title="Deadline alerts" />
          <div className="row-between" style={{ gap: 14, alignItems: 'flex-start' }}>
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: 'var(--fs-sm)', fontWeight: 700 }}>Alert me about upcoming deadlines</p>
              <p className="tiny muted" style={{ marginTop: 4, lineHeight: 1.55 }}>
                Open projects and assignments that carry a real deadline. Each one alerts once a day while the app is open.
              </p>
            </div>
            <button
              type="button"
              className="switch"
              role="switch"
              aria-checked={workReminders}
              aria-label="Deadline alerts"
              onClick={() => setWork({ workReminders: !workReminders })}
            >
              <span className="switch-knob" />
            </button>
          </div>

          {workReminders && (
            <div style={{ marginTop: 16 }}>
              <label className="field-label" htmlFor="work-hours">Alert window</label>
              <select
                id="work-hours"
                className="status-select"
                value={hours}
                onChange={(e) => setWork({ workReminderHours: Number(e.target.value) })}
              >
                <option value={12}>12 hours before</option>
                <option value={24}>24 hours before</option>
                <option value={48}>2 days before</option>
                <option value={72}>3 days before</option>
              </select>
              <p className="tiny muted" style={{ marginTop: 10, lineHeight: 1.55 }}>
                {perm === 'granted'
                  ? 'Alerts arrive as notifications while the app is open in this browser.'
                  : 'Notifications aren\u2019t enabled, so alerts appear as in-app toasts while the app is open.'}
                {' '}Overdue work is always included.
              </p>
            </div>
          )}

          {workReminders && upcoming.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <p className="eyebrow">Inside the window right now</p>
              <div className="tl" style={{ marginTop: 8 }}>
                {upcoming.slice(0, 4).map(({ kind, item, status }) => (
                  <WorkRow key={`${kind}-${item.id}`} kind={kind} item={item} status={status} progressPct={workProgressOf(kind, item)} />
                ))}
              </div>
            </div>
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
            <div className="kv" style={{ marginTop: 4 }}>
              <div className="kv-row"><span className="kv-k">Habits</span><span className="kv-v tnum">{counts.habits}{counts.archived ? ` (+${counts.archived} archived)` : ''}</span></div>
              <div className="kv-row"><span className="kv-k">Projects</span><span className="kv-v tnum">{counts.projects}</span></div>
              <div className="kv-row"><span className="kv-k">Assignments</span><span className="kv-v tnum">{counts.assignments}</span></div>
              <div className="kv-row"><span className="kv-k">Routines</span><span className="kv-v tnum">{counts.routines}</span></div>
              <div className="kv-row"><span className="kv-k">Check-ins</span><span className="kv-v tnum">{counts.checkins}</span></div>
              <div className="kv-row"><span className="kv-k">Mind entries</span><span className="kv-v tnum">{counts.moods}</span></div>
            </div>
            <p style={{ color: 'var(--text-3)', fontSize: 'var(--fs-xs)', lineHeight: 1.6 }}>
              Exports include habits, check-in history, projects, assignments, routines, mind entries and settings.
              Imports are validated and normalised before anything is replaced.
            </p>
          </div>
        </SectionCard>

        <SectionCard className="pad">
          <CardHead title="About" />
          <p style={{ color: 'var(--text-2)', fontSize: 'var(--fs-sm)', lineHeight: 1.6 }}>
            Aaru Habits — a calm habit tracker. Works offline, installs to your home screen, and never sends your data anywhere.
          </p>
          <p data-build-id={BUILD_ID} style={{ color: 'var(--text-3)', fontSize: 'var(--fs-xs)', marginTop: 8 }}>
            Build {BUILD_ID}{BUILD_TIME !== 'dev' ? ` · ${BUILD_TIME.slice(0, 10)}` : ''}
          </p>
        </SectionCard>
      </div>
    </div>
  )
}

function ThemeSwatch({ id }) {
  const looks = {
    midnight: ['#0b0f1a', '#7048f5', '#22d3ee'],
    aurora: ['#08161d', '#14b8a6', '#6ee7b7'],
    verdant: ['#0a1410', '#10b981', '#5eead4'],
    ember: ['#14100e', '#f59e0b', '#fb7185'],
    daylight: ['#f4f3ef', '#5b3df0', '#0e7490'],
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
