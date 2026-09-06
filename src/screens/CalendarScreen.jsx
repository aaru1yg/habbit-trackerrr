import { useMemo, useRef, useState, useEffect } from 'react'
import { useStore } from '../store.jsx'
import SectionCard, { CardHead } from '../components/ui/SectionCard.jsx'
import Sheet from '../components/ui/Sheet.jsx'
import EmptyState from '../components/ui/EmptyState.jsx'
import { todayStr, monthDays, monthLabel, weekdayInitial, dayNum, isFuture, prettyDate, shortDate, addDaysStr, subDaysStr } from '../lib/dates.js'
import { isScheduled, categoryOf } from '../lib/schedule.js'
import { activeHabits, isDone, checkinOf, habitRate, dayDensity } from '../lib/stats.js'
import { IconChevronLeft, IconChevronRight, IconCalendar, IconCheck } from '../lib/icons.jsx'
import { calendarMarkers } from '../lib/work.js'
import { WorkRow, workProgressOf } from '../components/work/WorkCards.jsx'
import { Link } from '../lib/router.jsx'

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
  const now = new Date()
  const [mode, setMode] = useState('month')
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() })
  const [anchor90, setAnchor90] = useState(todayStr()) // 90d window ends at this date
  const [year, setYear] = useState(now.getFullYear())
  const [noteFor, setNoteFor] = useState(null)
  const [noteDraft, setNoteDraft] = useState('')
  const longPressRef = useRef(0)
  const today = todayStr()

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

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest('input, textarea, select, [role="dialog"]')) return
      if (noteFor) return
      if (e.key === 'ArrowLeft') prev()
      if (e.key === 'ArrowRight') next()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [noteFor, mode])

  const startLongPress = (habit, date) => {
    longPressRef.current = setTimeout(() => {
      longPressRef.current = 0
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

  // ---- work deadlines in this range (§71) ----
  const markers = useMemo(() => calendarMarkers(state, days.map((d) => d.date)), [state, days])

  const deadlineList = useMemo(() => {
    const out = []
    for (const [day, list] of markers) {
      for (const m of list) {
        if (m.kind === 'project-deadline' || m.kind === 'assignment-deadline') {
          out.push({ day, kind: m.kind === 'project-deadline' ? 'project' : 'assignment', item: m.item, status: m.status })
        }
      }
    }
    out.sort((a, b) => a.day.localeCompare(b.day))
    return out
  }, [markers])

  const markerLabel = (list) => list
    .map((m) => {
      if (m.kind === 'project-deadline') return `${m.item.name} due`
      if (m.kind === 'assignment-deadline') return `${m.item.name} deadline`
      if (m.kind === 'project-start') return `${m.item.name} starts`
      if (m.kind === 'assignment-start') return `${m.item.name} assigned`
      if (m.kind === 'milestone') return `Milestone: ${m.milestone.name}`
      if (m.kind === 'task') return `Task: ${m.task.name}`
      return m.item.name
    })
    .join(', ')

  return (
    <div className="screen" id="calendar-screen">
      <header className="screen-head">
        <div>
          <h1 className="screen-title">Calendar</h1>
          <p className="screen-sub">Tap any past day to log it. Press and hold for a note.</p>
        </div>
      </header>

      <div className="stack">
        <div className="seg seg-wide" role="group" aria-label="Calendar range">
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

        <SectionCard className="pad calendar-matrix-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: 'var(--sp-4) var(--sp-4) var(--sp-3)' }}>
            <CardHead title={title}>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                {!isCurrentView && <button className="btn ghost sm" onClick={goToday}>Today</button>}
                <button className="btn icon" onClick={prev} aria-label="Previous range"><IconChevronLeft size={18} /></button>
                <button className="btn icon" onClick={next} aria-label="Next range"><IconChevronRight size={18} /></button>
              </div>
            </CardHead>
          </div>

          {habits.length === 0 ? (
            <EmptyState art="art/empty-calendar.webp" icon={<IconCalendar size={40} />} title="No habits in this range">
              Add a habit and its calendar will appear here.
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
                    className="cal-head-cell"
                    style={{
                      ...(bandIdx.get(d.date) % 2 === 1 ? { background: 'var(--surface-2)' } : {}),
                      ...(d.date === today ? { color: 'var(--accent-2)', fontWeight: 800 } : {}),
                    }}
                  >
                    <span aria-hidden="true" style={{ fontSize: '0.5625rem', lineHeight: 1 }}>{weekdayInitial(d.date)}</span>
                    <span className="tnum" style={{ fontSize: '0.8125rem', fontWeight: d.date === today ? 800 : 600 }}>{dayNum(d.date)}</span>
                    <span className="sr-only">{prettyDate(d.date)}</span>
                    {(markers.get(d.date) || []).length > 0 && (
                      <span
                        className="cal-marks"
                        title={markerLabel(markers.get(d.date))}
                        aria-label={`Work on ${prettyDate(d.date)}: ${markerLabel(markers.get(d.date))}`}
                      >
                        {(markers.get(d.date) || []).slice(0, 3).map((m, i) => {
                          const deadline = m.kind.endsWith('deadline')
                          const tone = m.kind.startsWith('project') ? 'var(--accent-1)' : 'var(--accent-2)'
                          return (
                            <span
                              key={i}
                              className="cal-mark"
                              data-deadline={deadline ? 'true' : 'false'}
                              style={{ background: deadline ? tone : 'transparent', borderColor: tone }}
                            />
                          )
                        })}
                      </span>
                    )}
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
                      <span className="cal-name-text">{h.name}</span>
                    </div>
                    {days.map((d) => {
                      const scheduled = isScheduled(h, d.date) && (!h.createdAt || d.date >= h.createdAt)
                      const future = isFuture(d.date)
                      const done = isDone(state, h.id, d.date)
                      const note = checkinOf(state, h.id, d.date)?.note
                      const bandOdd = bandIdx.get(d.date) % 2 === 1
                      if (!scheduled) {
                        return (
                          <div key={d.date} className="cal-cell off" style={{ ...(bandOdd ? { background: 'var(--surface-2)' } : {}) }}>
                            <span className="cal-off-dot" aria-hidden="true" />
                          </div>
                        )
                      }
                      return (
                        <button
                          key={d.date}
                          className={`cal-cell ${done ? 'done' : ''} ${d.date === today ? 'today' : ''} ${note ? 'has-note' : ''}`}
                          style={{ ...(bandOdd && !done ? { background: 'var(--surface-2)' } : {}) }}
                          disabled={future}
                          aria-label={`${done ? 'Mark not done' : 'Mark done'}: ${h.name}, ${prettyDate(d.date)}${note ? `, note: ${note}` : ''}`}
                          aria-pressed={done}
                          onClick={() => toggle(h, d.date)}
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
                <span><i /> Scheduled</span>
                <span><i className="off" /> Not scheduled</span>
                <span><i className="today" /> Today</span>
              </div>
            </div>
          )}
        </SectionCard>

        {deadlineList.length > 0 && (
          <SectionCard className="pad">
            <CardHead title="Deadlines in this view">
              <Link to="timeline" className="btn ghost sm">All deadlines</Link>
            </CardHead>
            <div className="tl" data-compact="true">
              {deadlineList.map(({ day, kind, item, status }) => (
                <div key={`${kind}-${item.id}-${day}`} className="di-row">
                  <div className="di-date" aria-hidden="true">
                    <span className="tnum">{dayNum(day)}</span>
                    <span className="tiny">{weekdayInitial(day)}</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <WorkRow kind={kind} item={item} status={status} progressPct={workProgressOf(kind, item)} />
                  </div>
                </div>
              ))}
            </div>
            <p className="tiny muted" style={{ marginTop: 10 }}>
              <span className="sr-only">Calendar legend: </span>
              Dots above the day numbers mark work — filled violet is a project deadline, filled cyan an assignment deadline,
              hollow dots are starts, milestones and task due dates.
            </p>
          </SectionCard>
        )}

        {habits.length > 0 && (
          <SectionCard className="pad">
            <CardHead title="In this view" />
            <div className="stack" style={{ gap: 12 }}>
              {rates.map(({ habit, rate, done, eligible }) => (
                <div key={habit.id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--fs-sm)', marginBottom: 5 }}>
                    <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{habit.name}</span>
                    <span className="tnum" style={{ color: 'var(--text-2)' }}>
                      {rate == null ? '—' : `${Math.round(rate * 100)}%`}
                      <span style={{ color: 'var(--text-3)' }}> ({done}/{eligible})</span>
                    </span>
                  </div>
                  <div style={{ height: 6, borderRadius: 999, background: 'var(--track)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${rate == null ? 0 : Math.round(rate * 100)}%`, borderRadius: 999, background: 'linear-gradient(90deg, var(--accent-1), var(--accent-2))' }} />
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        )}
      </div>

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
