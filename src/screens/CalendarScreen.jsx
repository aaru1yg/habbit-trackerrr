import { useMemo, useRef, useState, useEffect } from 'react'
import { useStore } from '../store.jsx'
import SectionCard, { CardHead } from '../components/ui/SectionCard.jsx'
import Sheet from '../components/ui/Sheet.jsx'
import EmptyState from '../components/ui/EmptyState.jsx'
import { todayStr, monthDays, monthWeekBands, monthLabel, weekdayInitial, dayNum, isFuture, prettyDate } from '../lib/dates.js'
import { isScheduled, categoryOf } from '../lib/schedule.js'
import { activeHabits, isDone, checkinOf, habitRate } from '../lib/stats.js'
import { IconChevronLeft, IconChevronRight, IconCalendar, IconCheck } from '../lib/icons.jsx'

const NAME_COL = 116
const CELL = 44

function parseYmParam(p) {
  if (!p || !/^\d{4}-(0[1-9]|1[0-2])$/.test(p)) return null
  const [y, m] = p.split('-').map(Number)
  return { y, m: m - 1 }
}

export default function CalendarScreen({ ymParam }) {
  const { state, dispatch } = useStore()
  const now = new Date()
  const initial = parseYmParam(ymParam) || { y: now.getFullYear(), m: now.getMonth() }
  const [ym, setYm] = useState(initial)

  // navigating from the year overview (e.g. #/calendar/2026-03) while mounted
  useEffect(() => {
    const parsed = parseYmParam(ymParam)
    if (parsed) setYm(parsed)
  }, [ymParam])
  const [noteFor, setNoteFor] = useState(null) // { habit, date }
  const [noteDraft, setNoteDraft] = useState('')
  const longPressRef = useRef(0)
  const today = todayStr()

  const days = useMemo(() => monthDays(ym.y, ym.m), [ym])
  const bands = useMemo(() => monthWeekBands(days), [days])
  const monthStart = days[0].date
  const monthEnd = days[days.length - 1].date

  const habits = activeHabits(state).filter((h) => days.some((d) => isScheduled(h, d.date)))

  const isCurrentMonth = ym.y === now.getFullYear() && ym.m === now.getMonth()
  const prev = () => setYm(({ y, m }) => (m === 0 ? { y: y - 1, m: 11 } : { y, m: m - 1 }))
  const next = () => setYm(({ y, m }) => (m === 11 ? { y: y + 1, m: 0 } : { y, m: m + 1 }))
  const goToday = () => setYm({ y: now.getFullYear(), m: now.getMonth() })

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest('input, textarea, select, [role="dialog"]')) return
      if (noteFor) return
      if (e.key === 'ArrowLeft') prev()
      if (e.key === 'ArrowRight') next()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [noteFor])

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

  const rates = useMemo(
    () => habits.map((h) => ({ habit: h, ...habitRate(state, h, monthStart, monthEnd > today ? today : monthEnd) })),
    [state, habits, monthStart, monthEnd, today]
  )

  return (
    <div className="screen" id="calendar-screen">
      <header className="screen-head">
        <div>
          <h1 className="screen-title">Calendar</h1>
          <p className="screen-sub">Tap any past day to log it. Press and hold for a note.</p>
        </div>
      </header>

      <div className="stack">
        <SectionCard className="pad" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: 'var(--sp-4) var(--sp-4) var(--sp-3)' }}>
            <CardHead title={monthLabel(ym.y, ym.m)}>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                {!isCurrentMonth && <button className="btn ghost sm" onClick={goToday}>Today</button>}
                <button className="btn icon" onClick={prev} aria-label="Previous month"><IconChevronLeft size={18} /></button>
                <button className="btn icon" onClick={next} aria-label="Next month"><IconChevronRight size={18} /></button>
              </div>
            </CardHead>
          </div>

          {habits.length === 0 ? (
            <EmptyState icon={<IconCalendar size={40} />} title="No habits this month">
              Add a habit and its calendar will appear here.
            </EmptyState>
          ) : (
            <div className="cal-wrap" data-testid="cal-scroll">
              <div
                className="cal-grid"
                style={{ gridTemplateColumns: `${NAME_COL}px repeat(${days.length}, ${CELL}px)`, minWidth: NAME_COL + days.length * CELL }}
              >
                {/* band label row */}
                <div className="cal-corner">Habit</div>
                {bands.map((b) => (
                  <div
                    key={b.index}
                    className="cal-band-label"
                    style={{ gridColumn: `span ${b.days.length}`, ...(b.index % 2 === 1 ? { background: 'var(--surface-2)' } : {}) }}
                  >
                    {b.label}
                  </div>
                ))}
                {/* day header row */}
                <div className="cal-corner">Day</div>
                {days.map((d) => (
                  <div
                    key={d.date}
                    className="cal-head-cell"
                    style={{
                      ...(Math.floor((d.day - 1) / 7) % 2 === 1 ? { background: 'var(--surface-2)' } : {}),
                      ...(d.date === today ? { color: 'var(--accent-2)', fontWeight: 800 } : {}),
                    }}
                  >
                    <span aria-hidden="true" style={{ fontSize: '0.5625rem', lineHeight: 1 }}>{weekdayInitial(d.date)}</span>
                    <span className="tnum" style={{ fontSize: '0.8125rem', fontWeight: d.date === today ? 800 : 600 }}>{dayNum(d.date)}</span>
                    <span className="sr-only">{prettyDate(d.date)}</span>
                  </div>
                ))}
                {/* habit rows */}
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
                      const bandOdd = Math.floor((d.day - 1) / 7) % 2 === 1
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
            </div>
          )}
        </SectionCard>

        {/* month consistency per habit */}
        {habits.length > 0 && (
          <SectionCard className="pad">
            <CardHead title="This month" />
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

      {/* Note dialog (long press) */}
      <Sheet open={!!noteFor} onClose={() => setNoteFor(null)} title={noteFor ? `Note — ${noteFor.habit.name}` : 'Note'} labelledBy="note-title">
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
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn ghost" onClick={() => setNoteFor(null)}>Cancel</button>
              <button className="btn primary" onClick={saveNote}>Save note</button>
            </div>
          </div>
        )}
      </Sheet>
    </div>
  )
}
