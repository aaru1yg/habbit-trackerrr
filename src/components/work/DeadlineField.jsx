/* ============================================================
   DEADLINE FIELD — the one control that decides how urgent work
   feels. Assignments support hours; projects work in days.
   Presets make a deadline two taps away (§65, §57).
   ============================================================ */
import { useEffect, useState } from 'react'
import { DEADLINE_PRESETS, dayStr, addDaysTo, isoLocal, toLocalDate, dayOf, prettyDateTime, shortDate, countdownLabel } from '../../lib/dates.js'

const PROJECT_DURATIONS = [2, 3, 5, 7, 14, 30, 60]

/** Assignment deadline: hour presets + a datetime-local escape hatch. */
export function AssignmentDeadlineField({ value, onChange, label = 'Deadline', autoFocusPreset = '2d' }) {
  const [custom, setCustom] = useState(false)
  const hasCustom = !!value && !DEADLINE_PRESETS.some((p) => p.id === activePreset(value))
  useEffect(() => { if (hasCustom) setCustom(true) }, [hasCustom])

  const dtValue = value ? toLocalDateTimeLocal(value) : ''

  return (
    <div>
      <div className="row-between" style={{ marginBottom: 8 }}>
        <span className="field-label" style={{ margin: 0 }}>{label}</span>
        {value && <span className="tiny muted tnum">{countdownLabel(value)} · {prettyDateTime(value)}</span>}
      </div>
      <div className="filter-bar" role="group" aria-label="Deadline presets">
        {DEADLINE_PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            aria-pressed={!custom && activePreset(value) === p.id}
            onClick={() => { setCustom(false); onChange(presetToValue(p.hours)) }}
          >
            {p.label}
          </button>
        ))}
        <button type="button" aria-pressed={custom} onClick={() => setCustom((c) => !c)}>Custom</button>
        {value && <button type="button" onClick={() => { setCustom(false); onChange(null) }}>Clear</button>}
      </div>
      {(custom || hasCustom) && (
        <div style={{ marginTop: 10 }}>
          <label className="sr-only" htmlFor="deadline-custom">Custom deadline (date and time)</label>
          <input
            id="deadline-custom"
            className="field"
            type="datetime-local"
            value={dtValue}
            onChange={(e) => onChange(e.target.value ? e.target.value.slice(0, 16) : null)}
          />
        </div>
      )}
    </div>
  )
}

/** Project deadline: duration presets from the start date + explicit date. */
export function ProjectDeadlineField({ value, onChange, startDate, label = 'Deadline' }) {
  const start = startDate || dayStr(new Date())
  const [custom, setCustom] = useState(false)
  const duration = value ? Math.round((toLocalDate(value, { endOfDay: true }) - toLocalDate(start, { endOfDay: true })) / 86400000) : null
  const knownDuration = duration != null && PROJECT_DURATIONS.includes(duration)

  useEffect(() => { if (value && !knownDuration) setCustom(true) }, [value, knownDuration])

  return (
    <div>
      <div className="row-between" style={{ marginBottom: 8 }}>
        <span className="field-label" style={{ margin: 0 }}>{label}</span>
        {value && (
          <span className="tiny muted tnum">
            {shortDate(dayOf(value))}{duration != null && duration > 0 ? ` · ${duration} day${duration === 1 ? '' : 's'}` : ''}
          </span>
        )}
      </div>
      <div className="filter-bar" role="group" aria-label="Project duration presets">
        {PROJECT_DURATIONS.map((d) => (
          <button
            key={d}
            type="button"
            aria-pressed={!custom && duration === d}
            onClick={() => { setCustom(false); onChange(addDaysTo(start, d)) }}
          >
            {d} days
          </button>
        ))}
        <button type="button" aria-pressed={custom} onClick={() => setCustom((c) => !c)}>Custom</button>
        {value && <button type="button" onClick={() => { setCustom(false); onChange(null) }}>No deadline</button>}
      </div>
      {(custom || (value && !knownDuration)) && (
        <div style={{ marginTop: 10 }}>
          <label className="sr-only" htmlFor="project-deadline-custom">Custom deadline date</label>
          <input
            id="project-deadline-custom"
            className="field"
            type="date"
            min={start}
            value={value ? dayOf(value) : ''}
            onChange={(e) => onChange(e.target.value || null)}
          />
        </div>
      )}
    </div>
  )
}

/* ---------------- helpers ---------------- */

function presetToValue(hours) {
  return isoLocal(new Date(Date.now() + hours * 3600000))
}

/** Which preset (if any) produced this deadline? Matches within 60 minutes. */
function activePreset(value) {
  if (!value) return null
  const target = toLocalDate(value, { endOfDay: true })
  if (!target) return null
  const hours = (target.getTime() - Date.now()) / 3600000
  const hit = DEADLINE_PRESETS.find((p) => Math.abs(p.hours - hours) <= 1)
  return hit?.id || null
}

function toLocalDateTimeLocal(value) {
  const d = toLocalDate(value, { endOfDay: true })
  if (!d) return ''
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

export { presetToValue, toLocalDateTimeLocal }
