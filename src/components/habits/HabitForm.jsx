import { useEffect, useState } from 'react'
import { useStore } from '../../store.jsx'
import Sheet from '../ui/Sheet.jsx'
import { CATEGORIES, WEEKDAY_OPTIONS, categoryOf } from '../../lib/schedule.js'
import { requestNotificationPermission, notificationState, notificationsSupported } from '../../lib/reminders.js'
import { IconBell, IconBellOff } from '../../lib/icons.jsx'

/* Add / edit habit — name, category, schedule, reminder, notes. */
export default function HabitForm({ open, onClose, editing }) {
  const { state, dispatch } = useStore()
  const [name, setName] = useState('')
  const [category, setCategory] = useState('fitness')
  const [schedType, setSchedType] = useState('daily')
  const [days, setDays] = useState([1, 2, 3, 4, 5])
  const [reminder, setReminder] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [permNote, setPermNote] = useState(null)

  useEffect(() => {
    if (!open) return
    setError('')
    setPermNote(null)
    if (editing) {
      setName(editing.name)
      setCategory(editing.category || 'mind')
      setSchedType(editing.schedule?.type || 'daily')
      setDays(editing.schedule?.days || [1, 2, 3, 4, 5])
      setReminder(editing.reminder || '')
      setNotes(editing.notes || '')
    } else {
      setName('')
      setCategory('fitness')
      setSchedType('daily')
      setDays([1, 2, 3, 4, 5])
      setReminder('')
      setNotes('')
    }
  }, [open, editing])

  const toggleDay = (d) => {
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()))
  }

  const save = async () => {
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Give your habit a name.')
      return
    }
    const schedule = schedType === 'weekdays' && days.length
      ? { type: 'weekdays', days }
      : { type: 'daily' }

    let reminderVal = reminder || null
    if (editing) {
      dispatch({ type: 'UPDATE_HABIT', id: editing.id, patch: { name: trimmed, category, schedule, reminder: reminderVal, notes: notes.trim() } })
    } else {
      dispatch({ type: 'ADD_HABIT', habit: { name: trimmed, category, schedule, reminder: reminderVal, notes: notes.trim() } })
    }

    // Ask for notification permission ONLY because the user just set a reminder.
    if (reminderVal && notificationsSupported() && notificationState() === 'default') {
      const res = await requestNotificationPermission()
      if (res !== 'granted') {
        setPermNote('denied')
        return // keep the sheet open so the user sees the note
      }
    }
    onClose()
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={editing ? 'Edit habit' : 'New habit'}
      labelledBy="habit-form-title"
      footer={
        <>
          <button className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn primary" onClick={save}>{editing ? 'Save changes' : 'Add habit'}</button>
        </>
      }
    >
      <div className="stack" style={{ gap: 18 }}>
        <div>
          <label className="field-label" htmlFor="habit-name">Name</label>
          <input
            id="habit-name"
            className="field"
            value={name}
            maxLength={80}
            placeholder="e.g. Read 10 pages"
            autoFocus={!editing}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && save()}
          />
          {error && <p style={{ color: 'var(--bad)', fontSize: 'var(--fs-sm)', marginTop: 6 }}>{error}</p>}
        </div>

        <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
          <legend className="field-label">Category</legend>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategory(c.id)}
                aria-pressed={category === c.id}
                className="mood-btn"
                style={{ minHeight: 56, flexDirection: 'row', gap: 8, borderColor: category === c.id ? `var(${c.cssVar})` : undefined }}
              >
                <CategoryIcon id={c.id} active={category === c.id} />
                {c.label}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
          <legend className="field-label">Schedule</legend>
          <div className="seg" role="group" aria-label="Schedule type">
            <button type="button" aria-pressed={schedType === 'daily'} onClick={() => setSchedType('daily')}>Every day</button>
            <button type="button" aria-pressed={schedType === 'weekdays'} onClick={() => setSchedType('weekdays')}>Specific days</button>
          </div>
          {schedType === 'weekdays' && (
            <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
              {WEEKDAY_OPTIONS.map((d) => (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => toggleDay(d.value)}
                  aria-pressed={days.includes(d.value)}
                  className="btn sm"
                  style={{
                    minWidth: 44,
                    borderRadius: 999,
                    borderColor: days.includes(d.value) ? 'var(--accent-1)' : undefined,
                    background: days.includes(d.value) ? 'var(--accent-soft)' : undefined,
                    color: days.includes(d.value) ? 'var(--text)' : 'var(--text-2)',
                  }}
                >
                  {d.label}
                </button>
              ))}
              {!days.length && <p style={{ color: 'var(--warn)', fontSize: 'var(--fs-xs)', width: '100%' }}>Pick at least one day, or switch to every day.</p>}
            </div>
          )}
        </fieldset>

        <div>
          <label className="field-label" htmlFor="habit-reminder">Reminder <span style={{ color: 'var(--text-3)', fontWeight: 500 }}>(optional)</span></label>
          <input
            id="habit-reminder"
            type="time"
            className="field"
            value={reminder}
            onChange={(e) => setReminder(e.target.value)}
          />
          <p style={{ color: 'var(--text-3)', fontSize: 'var(--fs-xs)', marginTop: 6, display: 'flex', gap: 6, alignItems: 'flex-start' }}>
            {notificationState() === 'denied' ? <IconBellOff size={14} /> : <IconBell size={14} />}
            <span>
              {notificationState() === 'denied'
                ? 'Notifications are blocked in your browser settings, so reminders will only appear inside the app.'
                : notificationState() === 'granted'
                  ? 'You\u2019ll get a notification at this time while the app is open.'
                  : 'Setting a time will ask once for notification permission. Reminders arrive while the app is open.'}
            </span>
          </p>
        </div>

        {permNote === 'denied' && (
          <p className="chip tag-warn" style={{ whiteSpace: 'normal' }} role="status">
            Notification permission was declined — your reminder is saved and will appear as an in-app notice instead.
          </p>
        )}

        <div>
          <label className="field-label" htmlFor="habit-notes">Notes <span style={{ color: 'var(--text-3)', fontWeight: 500 }}>(optional)</span></label>
          <textarea
            id="habit-notes"
            className="field"
            value={notes}
            maxLength={2000}
            placeholder="Why this habit matters, cues, anything…"
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

      </div>
    </Sheet>
  )
}

/* Category art (generated) with graceful SVG-dot fallback. */
export function CategoryIcon({ id, active = false, size = 22 }) {
  const cat = categoryOf(id)
  const [failed, setFailed] = useState(false)
  if (failed) {
    return <span aria-hidden="true" style={{ width: size, height: size, borderRadius: 8, background: `var(${cat.cssVar})`, opacity: active ? 1 : 0.55, flex: 'none' }} />
  }
  return (
    <img
      src={`art/cat-${id}.webp`}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      style={{ width: size, height: size, borderRadius: 7, objectFit: 'cover', flex: 'none', opacity: active ? 1 : 0.72 }}
    />
  )
}
