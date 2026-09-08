/* ============================================================
   CALENDAR — the habit history view of the Habits workspace
   (Phase 5 §10-14). Rendered inside HabitsScreen for
   #/habits?view=calendar and the legacy #/calendar.

   Habit × day matrix: what happened. Work deadlines no longer
   crowd the grid — they belong to Work → Deadlines.
   ============================================================ */
import { useMemo, useRef, useState, useEffect } from 'react'
import useNow from '../lib/useNow.js'
import { useStore } from '../store.jsx'
import { useHabitUI } from '../components/habits/HabitUIProvider.jsx'
import Sheet from '../components/ui/Sheet.jsx'
import EmptyState from '../components/ui/EmptyState.jsx'
import { todayStr, monthDays, monthLabel, weekdayInitial, dayNum, isFuture, prettyDate, shortDate, addDaysStr, subDaysStr } from '../lib/dates.js'
import { isScheduled, categoryOf } from '../lib/schedule.js'
import { activeHabits, isDone, checkinOf, habitRate, dayDensity } from '../lib/stats.js'
import { Link } from '../lib/router.jsx'
import { IconChevronLeft, IconChevronRight, IconCheck, IconPlus, IconCalendar } from '../lib/icons.jsx'

const NAME_COL = 116
const CELL = 44

const MODES = [
  { id: 'month', label: 'Month' },
  { id: '90d', label: '90 days' },
  { id: 'year', label: 'Year' },
]

function parseYmParam(p) {
  if (!p || !/^\d{4}-(0[1-9]|1[0-2])$/.test(p)) return null
  const [y, m] = p.split('-').map(Number)
  return { y, m: m - 1 }
}

const localDate = (s) => new Date(`${s}T12:00:00`)

export default function CalendarScreen({ ymParam }) {
  const { state, dispatch } = useStore()
  const habitUI = useHabitUI()
  const now = useNow()
  const [mode, setMode] = useState('month')
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() })
  const [anchor90, setAnchor90] = useState(todayStr()) // 90d window ends at this date
  const [year, setYear] = useState(now.getFullYear())
  const [noteFor, setNoteFor] = useState(null)
  const [noteDraft, setNoteDraft] = useState('')
  const longPressRef = useRef(0)
  const heldRef = useRef(false)
  const today = todayStr()

  /* A touch long-press opens the note sheet at 480 ms, but lifting the finger
     can still emit a click — which lands on the sheet's scrim and closes it
     again. Swallow that one trailing click (capture phase, so it reaches
     neither the scrim nor the cell). The arm is cleared by the next
     pointerdown too: when a platform fires no click after a long press, the
     user's next real tap must not be eaten. */
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

  // navigating from the year overview (e.g. #/calendar/2026-03) → month mode at that month
  useEffect(() => {
    const parsed = parseYmParam(ymParam)
    if (parsed) {
      setYm(parsed)
      setMode('month')
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
    // year
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
  const density = useMemo(() => dayDensity(state, days.map((d) => d.date)), [state, days])

  const bands = useMemo(() => {
    const out = []
    for (let i = 0; i < days.length; i += 7) {
      out.push({ index: i / 7, label: `Week ${i / 7 + 1}`, days: days.slice(i, i + 7) })
    }
    return out
  }, [days])

  const bandIdx = useMemo(() => {
    const m = new Map()
    for (const b of bands) for (const d of b.days) m.set(d.date, b.index)
    return m
  }, [bands])

  // A second header layer makes long views legible: months are the outer
  // grouping, weeks are the inner rhythm. The matrix remains one scrollable
  // surface so the sticky habit labels never lose their context.
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

  const rangeStart = days[0]?.date
  const rangeEnd = days[days.length - 1]?.date

  const habits = activeHabits(state).filter((h) => days.some((d) => isScheduled(h, d.date)))

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

  const prev = () => {
    if (mode === 'month') setYm(({ y, m }) => (m === 0 ? { y: y - 1, m: 11 } : { y, m: m - 1 }))
    else if (mode === '90d') setAnchor90((a) => subDaysStr(a, 30))
    else setYear((y) => y - 1)
  }
  const next = () => {
    if (mode === 'month') setYm(({ y, m }) => (m === 11 ? { y: y + 1, m: 0 } : { y, m: m + 1 }))
    else if (mode === '90d') setAnchor90((a) => addDaysStr(a, 30))
    else setYear((y) => y + 1)
  }
  const goToday = () => {
    setYm({ y: now.getFullYear(), m: now.getMonth() })
    setAnchor90(today)
    setYear(now.getFullYear())
  }

  const navRef = useRef({ prev, next })
  navRef.current = { prev, next }
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest('input, textarea, select, [role="dialog"]')) return
      if (noteFor) return
      if (e.key === 'ArrowLeft') navRef.current.prev()
      if (e.key === 'ArrowRight') navRef.current.next()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [noteFor, mode])

  const startLongPress = (habit, date) => {
    longPressRef.current = setTimeout(() => {
      longPressRef.current = 0
      heldRef.current = true
      setNoteFor({ habit, date })
      setNoteDraft(checkinOf(state, habit.id, date)?.note || '')
    }, 480)
  }
  const cancelLongPress = () => {
    if (longPressRef.current) {
      clearTimeout(longPressRef.current)
      longPressRef.current = 0
    }
  }

  const toggle = (habit, date) => {
    if (isFuture(date) || !isScheduled(habit, date)) return
    dispatch({ type: 'TOGGLE_CHECKIN', habitId: habit.id, date })
  }

  const saveNote = () => {
    if (noteFor) {
      dispatch({ type: 'SET_CHECKIN_NOTE', habitId: noteFor.habit.id, date: noteFor.date, note: noteDraft.trim() })
    }
    setNoteFor(null)
  }

  const rates = useMemo(() => {
    const endCap = rangeEnd > today ? today : rangeEnd
    return habits.map((h) => ({ habit: h, ...habitRate(state, h, rangeStart, endCap) }))
  }, [state, habits, rangeStart, rangeEnd, today])

  const openNote = (habit, date) => {
    setNoteFor({ habit, date })
    setNoteDraft(checkinOf(state, habit.id, date)?.note || '')
  }

  const missedInView = useMemo(() => {
    let n = 0
    for (const h of habits) {
      for (const d of days) {
        if (d.date >= today) break
        if (isScheduled(h, d.date) && (!h.createdAt || d.date >= h.createdAt) && !isDone(state, h.id, d.date)) n++
      }
    }
    return n
  }, [state, habits, days, today])

  return (
    <div className="habits-view cal-view" id="calendar-screen">
      <div className="cal-controls">
        <div className="seg seg-wide cal-range" role="group" aria-label="Calendar range">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              className={`seg-btn${mode === m.id ? ' active' : ''}`}
              aria-pressed={mode === m.id}
              onClick={() => setMode(m.id)}
            >
              {m.label}
            </button>
          ))}
        </div>
        <div className="cal-nav">
          <button className="btn icon" onClick={prev} aria-label="Previous range"><IconChevronLeft size={18} /></button>
          <h2 className="card-title cal-title" aria-live="polite">{title}</h2>
          <button className="btn icon" onClick={next} aria-label="Next range"><IconChevronRight size={18} /></button>
          {!isCurrentView && <button className="btn ghost sm cal-today-btn" onClick={goToday}>Today</button>}
        </div>
      </div>

      <section className="card calendar-matrix-card" aria-label={`Habit calendar, ${title}`}>
        {habits.length === 0 ? (
          <EmptyState
            art="art/empty-calendar.webp"
            icon={<IconCalendar size={40} />}
            title="No habits in this range"
            action={activeHabits(state).length === 0 && (
              <div className="empty-actions">
                <button type="button" className="btn primary" onClick={habitUI.openAdd}><IconPlus size={16} /> Create habit</button>
              </div>
            )}
          >
            {activeHabits(state).length === 0
              ? "You don't have any habits yet. Create one and its calendar will appear here."
              : 'Nothing was scheduled in this range. Move to a later range or check the schedule of your habits.'}
          </EmptyState>
        ) : (
          <div className="cal-wrap" data-testid="cal-scroll">
            <div
              className="cal-grid"
              key={title}
              style={{ gridTemplateColumns: `${NAME_COL}px repeat(${days.length}, var(--cal-cell, ${CELL}px))`, minWidth: 'max-content' }}
            >
              <div className="cal-corner">Habit</div>
              {monthBands.map((b) => (
                <div
                  key={b.key}
                  className="cal-month-label"
                  style={{ gridColumn: `span ${b.days.length}` }}
                >
                  {b.label}
                </div>
              ))}
              <div className="cal-corner">Week</div>
              {bands.map((b) => (
                <div
                  key={b.index}
                  className="cal-band-label"
                  style={{ gridColumn: `span ${b.days.length}`, ...(b.index % 2 === 1 ? { background: 'var(--surface-2)' } : {}) }}
                >
                  {b.label}
                </div>
              ))}
              <div className="cal-corner">Day</div>
              {days.map((d) => (
                <div
                  key={d.date}
                  className={`cal-head-cell${d.date === today ? ' is-today' : ''}`}
                  style={{
                    ...(bandIdx.get(d.date) % 2 === 1 ? { background: 'var(--surface-2)' } : {}),
                    ...(d.date === today ? { color: 'var(--accent-2)', fontWeight: 800 } : {}),
                  }}
                >
                  <span aria-hidden="true" style={{ fontSize: '0.5625rem', lineHeight: 1 }}>{weekdayInitial(d.date)}</span>
                  <span className="tnum" aria-hidden="true" style={{ fontSize: '0.8125rem', fontWeight: d.date === today ? 800 : 600 }}>{dayNum(d.date)}</span>
                  <span className="sr-only">{prettyDate(d.date)}</span>
                </div>
              ))}
              <div className="cal-corner cal-dens-corner">Done</div>
              {density.map((d, i) => (
                <div
                  key={d.date}
                  className={`cal-dens${d.pct == null ? ' is-null' : ''}${d.date === today ? ' is-today' : ''}`}
                  style={{ '--i': i, ...(bandIdx.get(d.date) % 2 === 1 && d.pct == null ? { background: 'var(--surface-2)' } : {}) }}
                  role="img"
                  aria-label={`${prettyDate(d.date)}: ${d.pct == null ? 'nothing scheduled' : `${d.pct} percent of scheduled checks done`}`}
                >
                  {d.pct != null && <i className="cal-dens-fill" style={{ '--v': d.pct / 100 }} />}
                </div>
              ))}
              {habits.map((h) => (
                <div key={h.id} style={{ display: 'contents' }}>
                  <div className="cal-name">
                    <span className="dot" style={{ width: 7, height: 7, borderRadius: 99, background: `var(${categoryOf(h.category).cssVar})`, flex: 'none' }} />
                    <Link to={`habits/${h.id}`} className="cal-name-text" aria-label={`Open ${h.name}`}>{h.name}</Link>
                  </div>
                  {days.map((d) => {
                    const scheduled = isScheduled(h, d.date) && (!h.createdAt || d.date >= h.createdAt)
                    const future = isFuture(d.date)
                    const done = isDone(state, h.id, d.date)
                    const note = checkinOf(state, h.id, d.date)?.note
                    const bandOdd = bandIdx.get(d.date) % 2 === 1
                    if (!scheduled) {
                      return (
                        <div key={d.date} className="cal-cell off" title={`${h.name}: not scheduled on ${prettyDate(d.date)}`} style={{ ...(bandOdd ? { background: 'var(--surface-2)' } : {}) }}>
                          <span className="cal-off-dot" aria-hidden="true" />
                        </div>
                      )
                    }
                    const missed = !done && !future && d.date !== today
                    return (
                      <button
                        key={d.date}
                        type="button"
                        className={`cal-cell ${done ? 'done' : ''} ${d.date === today ? 'today' : ''} ${note ? 'has-note' : ''} ${missed ? 'missed' : ''}`}
                        data-state={done ? 'completed' : future ? 'upcoming' : missed ? 'missed' : 'today'}
                        style={{ ...(bandOdd && !done ? { background: 'var(--surface-2)' } : {}) }}
                        disabled={future}
                        title={missed ? `Missed — tap to log ${h.name} for ${prettyDate(d.date)}` : undefined}
                        aria-label={`${done ? 'Mark not done' : 'Mark done'}: ${h.name}, ${prettyDate(d.date)}${note ? `, note: ${note}` : ''}`}
                        aria-pressed={done}
                        onClick={() => toggle(h, d.date)}
                        onKeyDown={(e) => { if (e.key === 'n' || e.key === 'N') { e.preventDefault(); openNote(h, d.date) } }}
                        onPointerDown={() => startLongPress(h, d.date)}
                        onPointerUp={cancelLongPress}
                        onPointerLeave={cancelLongPress}
                        onPointerMove={cancelLongPress}
                        onContextMenu={(e) => e.preventDefault()}
                      >
                        <span className="cal-check">
                          {done && <IconCheck size={16} />}
                        </span>
                      </button>
                    )
                  })}
                </div>
              ))}
            </div>
            <div className="cal-legend" aria-label="Calendar legend">
              <span><i className="done" /> Completed</span>
              <span><i className="missed" /> Missed</span>
              <span><i /> Scheduled</span>
              <span><i className="off" /> Not scheduled</span>
              <span><i className="today" /> Today</span>
              <span className="cal-legend-hint">Hold a cell (or press N) for a note</span>
            </div>
          </div>
        )}
      </section>

      {habits.length > 0 && (
        <section className="card pad cal-summary" aria-labelledby="cal-summary-title">
          <div className="card-head">
            <h2 id="cal-summary-title" className="card-title">In this view</h2>
            <span className="tiny muted tnum">
              {missedInView === 0 ? 'No missed days' : `${missedInView} missed day${missedInView === 1 ? '' : 's'} you can still log`}
            </span>
          </div>
          <ul className="cal-rates" aria-label="Completion by habit in this range">
            {rates.map(({ habit, rate, done, eligible }) => (
              <li key={habit.id} className="cal-rate">
                <div className="cal-rate-line">
                  <Link to={`habits/${habit.id}`} className="cal-rate-name">{habit.name}</Link>
                  <span className="tnum cal-rate-val">
                    {rate == null ? '—' : `${Math.round(rate * 100)}%`}
                    <span className="muted"> ({done}/{eligible})</span>
                  </span>
                </div>
                <div className="cal-rate-track" aria-hidden="true">
                  <div className="cal-rate-fill" style={{ width: `${rate == null ? 0 : Math.round(rate * 100)}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Sheet
        open={!!noteFor}
        onClose={() => setNoteFor(null)}
        title={noteFor ? `Note — ${noteFor.habit.name}` : 'Note'}
        labelledBy="note-title"
        footer={noteFor ? (
          <>
            <button className="btn ghost" onClick={() => setNoteFor(null)}>Cancel</button>
            <button className="btn primary" onClick={saveNote}>Save note</button>
          </>
        ) : null}
      >
        {noteFor && (
          <div className="stack">
            <p style={{ color: 'var(--text-2)', fontSize: 'var(--fs-sm)' }}>{prettyDate(noteFor.date)}</p>
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
