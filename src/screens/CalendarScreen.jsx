/* ============================================================
   CALENDAR — temporal habit activity view.
   Rendered inside HabitsScreen for #/habits?view=calendar and
   standalone for legacy #/calendar and #/calendar/YYYY-MM.

   Representation chosen: one horizontal stripe per habit, one
   column per day. Cells use SMALL MARKS (filled dot / hollow
   ring / small ×), never full saturated fills, so the view
   reads as TIME first and individual habit identity is
   recoverable from the dot color without becoming a rainbow.
   An aggregate density strip at the top shows total completion
   per day. A compact Selected-Day card above the grid shows
   the real state of every habit on the chosen date and lets
   you log from there too. Long-press (or N) opens the note
   sheet — unchanged from legacy behavior.
   ============================================================ */
import { useMemo, useRef, useState, useEffect, useCallback } from 'react'
import useNow from '../lib/useNow.js'
import { useStore } from '../store.jsx'
import { useHabitUI } from '../components/habits/HabitUIProvider.jsx'
import Sheet from '../components/ui/Sheet.jsx'
import Button from '../components/primitives/Button.jsx'
import IconButton from '../components/primitives/IconButton.jsx'
import {
  todayStr, monthDays, monthLabel, weekdayInitial, dayNum, isFuture,
  prettyDate, shortDate, addDaysStr, subDaysStr,
} from '../lib/dates.js'
import { isScheduled, categoryOf } from '../lib/schedule.js'
import { activeHabits, isDone, checkinOf, habitRate, dayDensity } from '../lib/stats.js'
import { Link } from '../lib/router.jsx'
import {
  IconChevronLeft, IconChevronRight, IconCheck, IconPlus, IconCalendar, IconX,
} from '../lib/icons.jsx'

const MODES = [
  { id: 'month', label: 'Month' },
  { id: '90d',   label: '90 days' },
  { id: 'year',  label: 'Year' },
]

function parseYmParam(p) {
  if (!p || !/^\d{4}-(0[1-9]|1[0-2])$/.test(p)) return null
  const [y, m] = p.split('-').map(Number)
  return { y, m: m - 1 }
}

const localDate = (s) => new Date(`${s}T12:00:00`)

/* ---------- Small presentational helpers ---------- */

function HabitDot({ habit, size = 8 }) {
  const cat = categoryOf(habit.category)
  return (
    <span
      className="hc-name__dot"
      style={{
        width: size, height: size,
        background: `var(${cat.cssVar})`,
        color: `var(${cat.cssVar})`,
      }}
      aria-hidden="true"
    />
  )
}

function DayMark({ state, color }) {
  // state in { 'scheduled', 'done', 'missed', 'today', 'unscheduled' }
  // Done/missed carry semantic color (--good/--bad) via CSS — don't pass
  // habit color there, so identity color is reserved for today/scheduled.
  if (state === 'unscheduled') return null
  const semantic = state === 'done' || state === 'missed'
  return <span className={`hc-mark ${state}`} style={!semantic && color ? { color } : undefined} aria-hidden="true" />
}

function StateBadge({ state }) {
  const map = {
    done: 'Completed',
    missed: 'Missed',
    today: 'Scheduled today',
    scheduled: 'Upcoming',
    unscheduled: 'Not scheduled',
  }
  return <span className="hc-day__state" data-state={state} aria-hidden="true">{map[state] || state}</span>
}

export default function CalendarScreen({ ymParam }) {
  const { state, dispatch } = useStore()
  const habitUI = useHabitUI()
  const now = useNow()
  const [mode, setMode] = useState('month')
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() })
  const [anchor90, setAnchor90] = useState(todayStr())
  const [year, setYear] = useState(now.getFullYear())
  const [selected, setSelected] = useState(todayStr())
  const [noteFor, setNoteFor] = useState(null)
  const [noteDraft, setNoteDraft] = useState('')
  const longPressRef = useRef(0)
  const heldRef = useRef(false)
  const today = todayStr()

  /* Swallow one trailing click after a touch long-press (legacy-safe). */
  useEffect(() => {
    const swallow = (e) => {
      if (!heldRef.current) return
      heldRef.current = false
      e.stopPropagation()
      e.preventDefault()
    }
    const disarm = () => { heldRef.current = false }
    document.addEventListener('click', swallow, true)
    document.addEventListener('pointerdown', disarm, true)
    return () => {
      document.removeEventListener('click', swallow, true)
      document.removeEventListener('pointerdown', disarm, true)
    }
  }, [])

  // Legacy deep-link #/calendar/YYYY-MM → month view, that month.
  useEffect(() => {
    const parsed = parseYmParam(ymParam)
    if (parsed) {
      setYm(parsed)
      setMode('month')
      setSelected(`${parsed.y}-${String(parsed.m + 1).padStart(2, '0')}-01`)
    }
  }, [ymParam])

  const days = useMemo(() => {
    if (mode === 'month') return monthDays(ym.y, ym.m)
    if (mode === '90d') {
      const end = anchor90
      const start = subDaysStr(end, 89)
      const out = []
      let c = start
      while (c <= end) {
        out.push({ day: localDate(c).getDate(), date: c, weekday: localDate(c).getDay() })
        c = addDaysStr(c, 1)
      }
      return out
    }
    const start = `${year}-01-01`
    const end = `${year}-12-31`
    const out = []
    let c = start
    while (c <= end) {
      out.push({ day: localDate(c).getDate(), date: c, weekday: localDate(c).getDay() })
      c = addDaysStr(c, 1)
    }
    return out
  }, [mode, ym, anchor90, year])

  const monthBands = useMemo(() => {
    const out = []
    let current = null
    for (const day of days) {
      const key = day.date.slice(0, 7)
      if (!current || current.key !== key) {
        current = { key, label: monthLabel(day.date.slice(0, 4), Number(day.date.slice(5, 7)) - 1), days: [] }
        out.push(current)
      }
      current.days.push(day)
    }
    return out
  }, [days])

  const density = useMemo(() => dayDensity(state, days.map((d) => d.date)), [state, days])
  const densityByDate = useMemo(() => {
    const m = new Map()
    for (const d of density) m.set(d.date, d)
    return m
  }, [density])

  const habits = useMemo(
    () => activeHabits(state).filter((h) => days.some((d) => isScheduled(h, d.date) && (!h.createdAt || d.date >= h.createdAt))),
    [state, days],
  )

  const rangeStart = days[0]?.date
  const rangeEnd = days[days.length - 1]?.date

  const title = useMemo(() => {
    if (mode === 'month') return monthLabel(ym.y, ym.m)
    if (mode === '90d') return `${shortDate(rangeStart)} – ${shortDate(rangeEnd)}`
    return `${year}`
  }, [mode, ym, rangeStart, rangeEnd, year])

  const isCurrentView = useMemo(() => {
    if (mode === 'month') return ym.y === now.getFullYear() && ym.m === now.getMonth()
    if (mode === '90d') return anchor90 === today
    return year === now.getFullYear()
  }, [mode, ym, anchor90, year, today, now])

  const prev = useCallback(() => {
    if (mode === 'month') setYm(({ y, m }) => (m === 0 ? { y: y - 1, m: 11 } : { y, m: m - 1 }))
    else if (mode === '90d') setAnchor90((a) => subDaysStr(a, 30))
    else setYear((y) => y - 1)
  }, [mode])
  const next = useCallback(() => {
    if (mode === 'month') setYm(({ y, m }) => (m === 11 ? { y: y + 1, m: 0 } : { y, m: m + 1 }))
    else if (mode === '90d') setAnchor90((a) => addDaysStr(a, 30))
    else setYear((y) => y + 1)
  }, [mode])
  const goToday = useCallback(() => {
    setYm({ y: now.getFullYear(), m: now.getMonth() })
    setAnchor90(today)
    setYear(now.getFullYear())
    setSelected(today)
  }, [now, today])

  const navRef = useRef({ prev, next })
  navRef.current = { prev, next }
  useEffect(() => {
    const onKey = (e) => {
      const t = e.target
      if (t && typeof t.closest === 'function' && t.closest('input, textarea, select, [role="dialog"]')) return
      if (noteFor) return
      if (e.key === 'ArrowLeft')  navRef.current.prev()
      if (e.key === 'ArrowRight') navRef.current.next()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [noteFor])

  /* Long-press → note sheet */
  const startLongPress = (habit, date) => {
    longPressRef.current = setTimeout(() => {
      longPressRef.current = 0
      heldRef.current = true
      openNote(habit, date)
    }, 480)
  }
  const cancelLongPress = () => {
    if (longPressRef.current) { clearTimeout(longPressRef.current); longPressRef.current = 0 }
  }

  const toggle = (habit, date) => {
    if (isFuture(date)) return
    if (!isScheduled(habit, date) || (habit.createdAt && date < habit.createdAt)) return
    dispatch({ type: 'TOGGLE_CHECKIN', habitId: habit.id, date })
  }

  const openNote = (habit, date) => {
    setNoteFor({ habit, date })
    setNoteDraft(checkinOf(state, habit.id, date)?.note || '')
  }
  const saveNote = () => {
    if (noteFor) {
      dispatch({ type: 'SET_CHECKIN_NOTE', habitId: noteFor.habit.id, date: noteFor.date, note: noteDraft.trim() })
    }
    setNoteFor(null)
  }

  /* Per-habit completion rate in the view (capped at today) */
  const rates = useMemo(() => {
    const endCap = rangeEnd > today ? today : rangeEnd
    return habits.map((h) => ({ habit: h, ...habitRate(state, h, rangeStart, endCap) }))
  }, [state, habits, rangeStart, rangeEnd, today])

  /* Derive cell state for a (habit, date) pair. */
  const cellState = (h, d) => {
    const scheduled = isScheduled(h, d.date) && (!h.createdAt || d.date >= h.createdAt)
    if (!scheduled) return 'unscheduled'
    const done = isDone(state, h.id, d.date)
    if (done) return 'done'
    if (isFuture(d.date)) return 'scheduled'
    if (d.date === today) return 'today'
    return 'missed'
  }

  const selectedDate = selected
  const selectedPretty = useMemo(() => {
    if (!selectedDate) return ''
    const d = localDate(selectedDate)
    return d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined })
  }, [selectedDate, now])
  const selectedIsFuture = isFuture(selectedDate)
  const selectedHabits = useMemo(() => {
    return activeHabits(state).map((h) => {
      const scheduled = isScheduled(h, selectedDate) && (!h.createdAt || selectedDate >= h.createdAt)
      const done = isDone(state, h.id, selectedDate)
      const note = checkinOf(state, h.id, selectedDate)?.note
      let s = 'unscheduled'
      if (scheduled) {
        if (done) s = 'done'
        else if (selectedIsFuture) s = 'scheduled'
        else if (selectedDate === today) s = 'today'
        else s = 'missed'
      }
      return { habit: h, state: s, note }
    })
  }, [state, selectedDate, selectedIsFuture, today])
  const scheduledOnSelected = selectedHabits.filter((x) => x.state !== 'unscheduled')

  const habitColor = (h) => `var(${categoryOf(h.category).cssVar})`

  // Step 4G-1: canonical completion wording across Habit domain.
  const cellAriaLabel = (h, d) => {
    const s = cellState(h, d)
    const note = checkinOf(state, h.id, d.date)?.note
    const pretty = prettyDate(d.date)
    let suffix = ''
    if (note) suffix = `, note: ${note}`
    if (s === 'unscheduled') return `${h.name}, not scheduled on ${pretty}${suffix}`
    if (s === 'scheduled') return `${h.name}, upcoming on ${pretty}${suffix}`
    return `Mark ${h.name} as ${s === 'done' ? 'not complete' : 'complete'}, ${pretty}${suffix}`
  }

  const hasHabits = activeHabits(state).length > 0

  return (
    <div className="hc" id="calendar-screen">
      {/* 1. RANGE + NAV */}
      <div className="hc-controls" role="group" aria-label="Calendar controls">
        <div className="hc-range" role="group" aria-label="Calendar range">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              aria-pressed={mode === m.id}
              onClick={() => setMode(m.id)}
            >{m.label}</button>
          ))}
        </div>
        <div className="hc-nav">
          <IconButton onClick={prev} label="Previous range" icon={<IconChevronLeft size={16} />} className="hc-nav-btn" />
          <h2 className="hc-title" aria-live="polite">{title}</h2>
          <IconButton onClick={next} label="Next range" icon={<IconChevronRight size={16} />} className="hc-nav-btn" />
          {!isCurrentView && (
            <Button variant="quiet" size="sm" className="hc-today" onClick={goToday}>Today</Button>
          )}
        </div>
      </div>

      {/* 2. SELECTED DAY */}
      <section className="hc-day" aria-labelledby="hc-day-title">
        <div className="hc-day__head">
          <h3 className="hc-day__title" id="hc-day-title">{selectedPretty || 'Pick a day'}</h3>
          <span className="hc-day__meta tnum">
            {scheduledOnSelected.length === 0
              ? 'Nothing scheduled'
              : `${scheduledOnSelected.filter((x) => x.state === 'done').length}/${scheduledOnSelected.length} done`}
          </span>
        </div>
        {scheduledOnSelected.length === 0 ? (
          <p className="hc-day__empty">No habits scheduled on this day.
            {selectedDate < today ? ' You can add new habits — past days before a habit existed stay blank.' : ''}
          </p>
        ) : (
          <ul className="hc-day__list" aria-label={`Habits on ${selectedPretty}`}>
            {scheduledOnSelected.map(({ habit: h, state: s, note }) => {
              const done = s === 'done'
              return (
                <li key={h.id} className="hc-day__row">
                  <HabitDot habit={h} />
                  <span className="hc-day__name">
                    <Link to={`habits/${h.id}`} style={{ color: 'inherit', textDecoration: 'none' }}>{h.name}</Link>
                  </span>
                  <StateBadge state={s} />
                  {!selectedIsFuture ? (
                    <button
                      type="button"
                      className="hc-day__btn"
                      aria-pressed={done}
                      aria-label={`${done ? 'Undo' : 'Log'} ${h.name} for ${selectedPretty} (selected day)`}
                      onClick={() => toggle(h, selectedDate)}
                    >
                      {done ? <IconCheck size={12} aria-hidden="true" /> : s === 'missed' ? <IconX size={12} aria-hidden="true" /> : null}
                      <span style={{ marginLeft: 4 }}>{done ? 'Done' : s === 'missed' ? 'Log' : s === 'today' ? 'Do it' : 'Done'}</span>
                    </button>
                  ) : (
                    <button type="button" className="hc-day__btn" disabled>Upcoming</button>
                  )}
                  {note && <div className="hc-day__note">{note}</div>}
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {/* 3. THE CALENDAR VISUALIZATION */}
      {!hasHabits ? (
        <div className="hc-empty">
          <EmptyStateFallback habitUI={habitUI} />
        </div>
      ) : habits.length === 0 ? (
        <div className="hc-empty">
          <p style={{ color: 'var(--text-2)', margin: 0 }}>
            Nothing was scheduled in this range. Try another range or check your habits' schedules.
          </p>
        </div>
      ) : (
        <section className="hc-wrap" aria-label={`Habit calendar, ${title}`}>
          <div className="hc-scroll">
            <div
              className="hc-grid"
              data-mode={mode}
              role="grid"
              aria-label={`${title} — habit activity`}
              style={{ gridTemplateColumns: `var(--hc-name) repeat(${days.length}, var(--hc-cell))` }}
            >
              {/* Header row 1: month band */}
              <div className="hc-corner hc-top" aria-hidden="true">Habit</div>
              {monthBands.map((b) => (
                <div
                  key={b.key}
                  className="hc-month"
                  role="columnheader"
                  style={{ gridColumn: `span ${b.days.length} / auto` }}
                >
                  {b.label}
                </div>
              ))}

              {/* Header row 2: weekday initials (month mode only; kept thin in 90d/year) */}
              <div className="hc-corner" aria-hidden="true">
                {mode === 'month' ? 'Wk' : ''}
              </div>
              {days.map((d) => (
                <div key={`wkd-${d.date}`} className="hc-wkday" aria-hidden="true">
                  {weekdayInitial(d.date)}
                </div>
              ))}

              {/* Header row 3: day numbers (click to select) */}
              <div className="hc-corner" aria-hidden="true">Day</div>
              {days.map((d) => {
                const wd = localDate(d.date).getDay()
                const weekend = wd === 0 || wd === 6
                return (
                  <button
                    type="button"
                    key={`dn-${d.date}`}
                    className={[
                      'hc-daynum',
                      d.date === today ? 'is-today' : '',
                      weekend ? 'is-weekend' : '',
                      d.date === selected ? 'is-selected' : '',
                    ].filter(Boolean).join(' ')}
                    onClick={() => setSelected(d.date)}
                    aria-label={`${prettyDate(d.date)}${d.date === today ? ' (today)' : ''}`}
                    aria-pressed={d.date === selected}
                  >
                    {mode === 'year' ? '' : dayNum(d.date)}
                  </button>
                )
              })}

              {/* Aggregate density strip (percent of scheduled habits done that day) */}
              <div className="hc-corner hc-top" aria-hidden="true">Done</div>
              {days.map((d) => {
                const den = densityByDate.get(d.date)
                const pct = den?.pct
                return (
                  <button
                    type="button"
                    key={`ag-${d.date}`}
                    className={['hc-aggr', d.date === selected ? 'is-selected' : ''].filter(Boolean).join(' ')}
                    onClick={() => setSelected(d.date)}
                    aria-label={pct == null
                      ? `${prettyDate(d.date)}: nothing scheduled`
                      : `${prettyDate(d.date)}: ${Math.round(pct)}% of scheduled habits done`}
                  >
                    {pct != null && <span className="hc-aggr__bar" data-pct={Math.round(pct)} style={{ width: `${Math.max(6, pct)}%` }} />}
                  </button>
                )
              })}

              {/* Habit rows */}
              {habits.map((h) => (
                <div key={h.id} style={{ display: 'contents' }}>
                  <div className="hc-name" role="rowheader">
                    <HabitDot habit={h} />
                    <Link to={`habits/${h.id}`} className="hc-name__link">{h.name}</Link>
                  </div>
                  {days.map((d) => {
                    const s = cellState(h, d)
                    const chk = checkinOf(state, h.id, d.date)
                    const hasNote = !!(chk?.note)
                    const isSel = d.date === selected
                    const isTod = d.date === today
                    if (s === 'unscheduled') {
                      return (
                        <div
                          key={`${h.id}-${d.date}`}
                          className={['hc-cell', 'is-unscheduled', isSel ? 'is-selected' : '', isTod ? 'is-today' : ''].filter(Boolean).join(' ')}
                          aria-hidden="true"
                        />
                      )
                    }
                    return (
                      <button
                        key={`${h.id}-${d.date}`}
                        type="button"
                        className={[
                          'hc-cell',
                          `is-${s}`,
                          isSel ? 'is-selected' : '',
                          isTod ? 'is-today' : '',
                          hasNote ? 'has-note' : '',
                        ].filter(Boolean).join(' ')}
                        data-state={s}
                        style={{ color: habitColor(h) }}
                        disabled={isFuture(d.date)}
                        aria-label={cellAriaLabel(h, d)}
                        aria-pressed={s === 'done' ? 'true' : 'false'}
                        onClick={() => { setSelected(d.date); toggle(h, d.date) }}
                        onKeyDown={(e) => {
                          if (e.key === 'n' || e.key === 'N') { e.preventDefault(); openNote(h, d.date) }
                          if (e.key === 'Enter' || e.key === ' ') {
                            // Enter/space on a future/scheduled cell just selects it.
                            if (isFuture(d.date)) { e.preventDefault(); setSelected(d.date) }
                          }
                        }}
                        onPointerDown={() => startLongPress(h, d.date)}
                        onPointerUp={cancelLongPress}
                        onPointerLeave={cancelLongPress}
                        onPointerMove={cancelLongPress}
                        onContextMenu={(e) => e.preventDefault()}
                      >
                        <DayMark state={s} color={habitColor(h)} />
                      </button>
                    )
                  })}
                </div>
              ))}
            </div>

            {/* Legend */}
            <div className="hc-legend" aria-label="Calendar legend">
              <span className="hc-legend__item"><span className="hc-legend__mark done"><i /></span> Completed</span>
              <span className="hc-legend__item"><span className="hc-legend__mark missed"><i /></span> Missed</span>
              <span className="hc-legend__item"><span className="hc-legend__mark scheduled"><i /></span> Scheduled</span>
              <span className="hc-legend__item"><span className="hc-legend__mark" style={{ width: 3, height: 3, borderRadius: 99, background: 'var(--accent-2,var(--accent))' }} /> Note</span>
              <span className="hc-legend__hint">Tap a cell to log · Hold (or press N) for a note</span>
            </div>
          </div>
        </section>
      )}

      {/* 4. PER-HABIT RATES */}
      {habits.length > 0 && (
        <section className="hc-summary" aria-labelledby="hc-summary-title">
          <h2 id="hc-summary-title">In this view</h2>
          <ul className="hc-rates">
            {rates.map(({ habit: h, rate, done, eligible }) => (
              <li key={h.id} className="hc-rate">
                <div className="hc-rate__line">
                  <Link to={`habits/${h.id}`} className="hc-rate__name">
                    <HabitDot habit={h} size={6} />
                    {h.name}
                  </Link>
                  <span className="hc-rate__val tnum">
                    {rate == null ? '—' : `${Math.round(rate * 100)}%`}
                    <span> {done == null ? '' : `(${done}/${eligible})`}</span>
                  </span>
                </div>
                <div className="hc-rate__track" aria-hidden="true">
                  <div className="hc-rate__fill" style={{ width: `${rate == null ? 0 : Math.round(rate * 100)}%`, background: `var(${categoryOf(h.category).cssVar})` }} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Note sheet */}
      <Sheet
        open={!!noteFor}
        onClose={() => setNoteFor(null)}
        title={noteFor ? `Note — ${noteFor.habit.name}` : 'Note'}
        labelledBy="note-title"
        footer={noteFor ? (
          <>
            <Button variant="quiet" onClick={() => setNoteFor(null)}>Cancel</Button>
            <Button variant="primary" onClick={saveNote}>Save note</Button>
          </>
        ) : null}
      >
        {noteFor && (
          <div className="stack">
            <p style={{ color: 'var(--text-2)', fontSize: 'var(--fs-sm)', margin: 0 }}>{prettyDate(noteFor.date)}</p>
            <textarea
              className="field"
              autoFocus
              rows={4}
              maxLength={500}
              value={noteDraft}
              placeholder="How did it go? Anything worth remembering?"
              onChange={(e) => setNoteDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) saveNote() }}
            />
          </div>
        )}
      </Sheet>
    </div>
  )
}

/* Simple inline empty state so we don't depend on a UI-system EmptyState
   that couples to a different surface language. */
function EmptyStateFallback({ habitUI }) {
  return (
    <div style={{ textAlign: 'center', padding: '24px 12px', display: 'grid', gap: 12, justifyItems: 'center' }}>
      <div style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--surface-2)', display: 'grid', placeItems: 'center', color: 'var(--text-2)' }}>
        <IconCalendar size={20} />
      </div>
      <p style={{ margin: 0, color: 'var(--text)', fontWeight: 600 }}>No habits yet</p>
      <p style={{ margin: 0, color: 'var(--text-2)', maxWidth: '40ch' }}>
        Create a habit and its calendar will fill in as you check in each day.
      </p>
      <Button variant="primary" icon={<IconPlus size={14} />} onClick={habitUI.openAdd}>Create habit</Button>
    </div>
  )
}
