import { useState } from 'react'
import { useStore } from '../../store.jsx'
import Sheet from '../ui/Sheet.jsx'
import { scheduleLabel, categoryOf } from '../../lib/schedule.js'
import { isScheduled } from '../../lib/schedule.js'
import { todayStr, subDaysStr, weekdayInitial, prettyDate } from '../../lib/dates.js'
import { habitStreak, habitBestStreak, habitRate, checkinOf } from '../../lib/stats.js'
import AnimatedNumber from '../ui/AnimatedNumber.jsx'
import { CategoryIcon } from './HabitForm.jsx'
import { IconPencil, IconArchive, IconTrash, IconBell, IconUndo } from '../../lib/icons.jsx'

/* 90-day heatmap for one habit. */
export function Heatmap90({ habit }) {
  const { state } = useStore()
  const today = todayStr()
  const weeks = 13
  const cells = []
  // oldest → newest, column-major (weeks as columns, Sun..Sat rows)
  const start = subDaysStr(today, weeks * 7 - 1 - (6 - new Date(`${today}T12:00:00`).getDay()))
  for (let w = 0; w < weeks; w++) {
    const col = []
    for (let d = 0; d < 7; d++) {
      const date = subDaysStr(start, -(w * 7 + d))
      if (date > today) { col.push({ date, kind: 'future' }); continue }
      const check = checkinOf(state, habit.id, date)
      if (check?.done) col.push({ date, kind: 'done' })
      else if (isScheduled(habit, date) && (!habit.createdAt || date >= habit.createdAt)) col.push({ date, kind: 'missed' })
      else col.push({ date, kind: 'off' })
    }
    cells.push(col)
  }
  return (
    <div
      style={{ display: 'flex', gap: 3 }}
      role="img"
      aria-label="90-day completion history"
    >
      <div style={{ display: 'grid', gridTemplateRows: 'repeat(7, 1fr)', gap: 3, marginRight: 2 }} aria-hidden="true">
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <span key={i} style={{ fontSize: 8, color: 'var(--text-3)', height: 12, lineHeight: '12px' }}>
            {i % 2 === 1 ? weekdayInitial(subDaysStr(today, -((i + 1) % 7))) : ''}
          </span>
        ))}
      </div>
      {cells.map((col, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateRows: 'repeat(7, 12px)', gap: 3 }}>
          {col.map((c) => (
            <span
              key={c.date}
              title={`${prettyDate(c.date)} — ${c.kind === 'done' ? 'completed' : c.kind === 'missed' ? 'missed' : c.kind === 'future' ? 'upcoming' : 'not scheduled'}`}
              className={`hm-cell ${c.kind === 'done' ? 'l4' : c.kind === 'off' ? 'empty' : ''} ${c.kind === 'future' ? 'future' : ''}`}
              style={{ width: 12, height: 12, ...(c.kind === 'missed' ? { background: 'var(--track)' } : {}) }}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

function Stat({ label, value, suffix }) {
  return (
    <div style={{ flex: 1, textAlign: 'center', padding: '10px 6px', borderRadius: 14, background: 'var(--surface-2)' }}>
      <div className="stat-value tnum" style={{ fontSize: '1.25rem' }}>
        <AnimatedNumber value={value} />
        {suffix && <span style={{ fontSize: '0.9rem', color: 'var(--text-2)' }}>{suffix}</span>}
      </div>
      <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-3)', marginTop: 2 }}>{label}</div>
    </div>
  )
}

export default function HabitDetailSheet({ habit, open, onClose, onEdit, onArchive, onDelete }) {
  const { state } = useStore()
  const [confirmDelete, setConfirmDelete] = useState(false)
  if (!habit) return null

  const streak = habitStreak(state, habit)
  const best = habitBestStreak(state, habit)
  const rate30 = habitRate(state, habit, subDaysStr(todayStr(), 29), todayStr())
  const totalDone = Object.values(state.checkins?.[habit.id] || {}).filter((c) => c?.done).length
  const cat = categoryOf(habit.category)
  const noteToday = state.checkins?.[habit.id]?.[todayStr()]?.note

  return (
    <Sheet open={open} onClose={onClose} title={habit.name} labelledBy="habit-detail-title">
      <div className="stack" style={{ gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <CategoryIcon id={habit.category} size={26} />
          <span className="chip">
            <span className="dot" style={{ background: `var(${cat.cssVar})` }} />
            {cat.label}
          </span>
          <span className="chip">{scheduleLabel(habit)}</span>
          {habit.reminder && (
            <span className="chip"><IconBell size={13} /> {habit.reminder}</span>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <Stat label="current streak" value={streak} suffix={streak === 1 ? ' day' : ' days'} />
          <Stat label="best streak" value={best} suffix={best === 1 ? ' day' : ' days'} />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Stat label="30-day rate" value={rate30.rate == null ? 0 : Math.round(rate30.rate * 100)} suffix="%" />
          <Stat label="total check-ins" value={totalDone} />
        </div>

        <div>
          <p className="eyebrow" style={{ marginBottom: 8 }}>Last 90 days</p>
          <div style={{ overflowX: 'auto', paddingBottom: 4 }}>
            <Heatmap90 habit={habit} />
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 8, fontSize: 'var(--fs-xs)', color: 'var(--text-3)' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><i className="hm-cell l4" style={{ width: 10, height: 10 }} /> completed</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><i className="hm-cell" style={{ width: 10, height: 10 }} /> missed</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><i className="hm-cell empty" style={{ width: 10, height: 10, display: 'inline-block' }} /> day off</span>
          </div>
        </div>

        {habit.notes && (
          <div>
            <p className="eyebrow" style={{ marginBottom: 6 }}>Notes</p>
            <p style={{ color: 'var(--text-2)', fontSize: 'var(--fs-sm)', whiteSpace: 'pre-wrap' }}>{habit.notes}</p>
          </div>
        )}
        {noteToday && (
          <div>
            <p className="eyebrow" style={{ marginBottom: 6 }}>Today&rsquo;s note</p>
            <p style={{ color: 'var(--text-2)', fontSize: 'var(--fs-sm)' }}>{noteToday}</p>
          </div>
        )}

        <hr className="divider" />

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn" onClick={() => onEdit(habit)}>
            <IconPencil size={16} /> Edit
          </button>
          <button className="btn" onClick={() => onArchive(habit)}>
            {habit.archived ? <IconUndo size={16} /> : <IconArchive size={16} />}
            {habit.archived ? 'Restore' : 'Archive'}
          </button>
          {confirmDelete ? (
            <button className="btn danger" onClick={() => { setConfirmDelete(false); onDelete(habit) }}>
              <IconTrash size={16} /> Really delete
            </button>
          ) : (
            <button className="btn ghost" style={{ color: 'var(--bad)' }} onClick={() => setConfirmDelete(true)}>
              <IconTrash size={16} /> Delete
            </button>
          )}
        </div>
        {confirmDelete && (
          <p style={{ color: 'var(--text-3)', fontSize: 'var(--fs-xs)' }}>
            Deleting removes this habit and its history. You can undo for a few seconds after.
          </p>
        )}
      </div>
    </Sheet>
  )
}
