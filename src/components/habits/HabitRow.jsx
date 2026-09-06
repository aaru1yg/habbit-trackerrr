import { useState } from 'react'
import { Reorder, motion, useMotionValue, useDragControls, animate, useReducedMotion } from 'framer-motion'
import { useStore } from '../../store.jsx'
import { todayStr } from '../../lib/dates.js'
import { scheduleLabel, categoryOf } from '../../lib/schedule.js'
import { habitStreak } from '../../lib/stats.js'
import HabitCheck from './HabitCheck.jsx'
import AnimatedNumber from '../ui/AnimatedNumber.jsx'
import Burst from '../motion/Burst.jsx'
import { interactionFeedback } from '../../lib/motion.js'
import { IconArchive, IconTrash, IconGrip, IconChevronRight, IconFlame } from '../../lib/icons.jsx'

const ACTIONS_W = 132

/**
 * A habit row:
 *  – tap row (not name) or swipe right → toggle complete
 *  – tap name → inline rename
 *  – swipe left → archive / delete actions
 *  – grip handle → drag to reorder
 *  – chevron → detail sheet
 */
export default function HabitRow({ habit, onDetail, onArchive, onDelete, onFire }) {
  const { state, dispatch } = useStore()
  const reduced = useReducedMotion()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(habit.name)
  const dragControls = useDragControls()
  const x = useMotionValue(0)
  const [open, setOpen] = useState(false)
  const [burst, setBurst] = useState(0)

  const today = todayStr()
  const done = state.checkins?.[habit.id]?.[today]?.done === true
  const streak = habitStreak(state, habit)
  const cat = categoryOf(habit.category)

  const toggle = () => {
    // one channel for every interaction response (sound-ready, §25)
    interactionFeedback(done ? 'uncomplete' : 'complete', { habitId: habit.id })
    if (!done) {
      if (onFire) onFire()
      setBurst((b) => b + 1) // tight particle response at the checkbox
    }
    dispatch({ type: 'TOGGLE_CHECKIN', habitId: habit.id, date: today })
  }

  const saveName = () => {
    const name = draft.trim()
    if (name && name !== habit.name) {
      dispatch({ type: 'UPDATE_HABIT', id: habit.id, patch: { name } })
    } else {
      setDraft(habit.name)
    }
    setEditing(false)
  }

  const onDragEnd = (_, info) => {
    const { offset, velocity } = info
    if (offset.x < -56 || velocity.x < -420) {
      setOpen(true)
      animate(x, -ACTIONS_W, { type: 'spring', stiffness: 420, damping: 34 })
    } else if (offset.x > 64 || velocity.x > 420) {
      if (!done) toggle()
      setOpen(false)
      animate(x, 0, { type: 'spring', stiffness: 420, damping: 30 })
    } else {
      animate(x, open ? -ACTIONS_W : 0, { type: 'spring', stiffness: 420, damping: 30 })
    }
  }

  const closeActions = () => {
    setOpen(false)
    animate(x, 0, { type: 'spring', stiffness: 420, damping: 34 })
  }

  const inner = (
    <>
      {/* actions revealed on swipe-left */}
      <div
        className="habit-actions"
        style={{
          position: 'absolute',
          top: 0, bottom: 0, right: 0,
          width: ACTIONS_W,
          display: 'flex',
          gap: 8,
          alignItems: 'stretch',
        }}
        aria-hidden={!open}
      >
        <button className="btn" style={{ flex: 1, borderRadius: 14 }} onClick={() => { closeActions(); onArchive(habit) }}
          aria-label={habit.archived ? `Restore ${habit.name}` : `Archive ${habit.name}`}
          tabIndex={open ? 0 : -1}>
          <IconArchive size={18} />
        </button>
        <button className="btn danger" style={{ flex: 1, borderRadius: 14 }} onClick={() => { closeActions(); onDelete(habit) }}
          aria-label={`Delete ${habit.name}`} tabIndex={open ? 0 : -1}>
          <IconTrash size={18} />
        </button>
      </div>

      <motion.div
        className={`habit-row ${done ? 'done' : ''}`}
        data-category={habit.category || 'mind'}
        style={{ x, position: 'relative' }}
        drag={editing || reduced ? false : 'x'}
        dragDirectionLock
        dragConstraints={{ left: -ACTIONS_W, right: 72 }}
        dragElastic={{ left: 0.12, right: 0.32 }}
        onDragEnd={onDragEnd}
        whileTap={reduced ? undefined : { scale: 0.985 }}
        layout="position"
      >
        <div
          role="button"
          tabIndex={0}
          aria-pressed={done}
          aria-label={`Mark ${habit.name} ${done ? 'not done' : 'complete'}`}
          onClick={() => { if (open) { closeActions(); return } toggle() }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              toggle()
            }
          }}
          style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0, minHeight: 56, borderRadius: 14, padding: '2px 4px 2px 0', margin: '-2px -4px -2px 0' }}
        >
          <span style={{ position: 'relative', display: 'grid', placeItems: 'center', flex: 'none' }}>
            <HabitCheck done={done} label={done ? 'Completed' : 'Not completed'} />
            <Burst fire={burst} count={9} spread={30} size={4} />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            {editing ? (
              <input
                className="field"
                value={draft}
                autoFocus
                aria-label={`Rename ${habit.name}`}
                style={{ padding: '4px 10px', fontSize: '0.95rem' }}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={saveName}
                onKeyDown={(e) => {
                  e.stopPropagation()
                  if (e.key === 'Enter') saveName()
                  if (e.key === 'Escape') { setDraft(habit.name); setEditing(false) }
                }}
              />
            ) : (
              <button
                className="habit-name"
                onClick={(e) => { e.stopPropagation(); setDraft(habit.name); setEditing(true) }}
                aria-label={`Rename ${habit.name}`}
                title="Rename"
              >
                {habit.name}
              </button>
            )}
            <div className="habit-meta">
              <span className="chip" style={{ padding: '1px 8px', minHeight: 20 }}>
                <span className="dot" style={{ background: `var(${cat.cssVar})` }} />
                {cat.label}
              </span>
              <span>{scheduleLabel(habit)}</span>
              {streak > 1 && (
                <span className="habit-streak">
                  <IconFlame size={13} /> <AnimatedNumber value={streak} duration={520} />d
                </span>
              )}
            </div>
          </div>
        </div>

        <button
          className="btn ghost icon"
          aria-label={`Details for ${habit.name}`}
          onClick={() => { if (open) closeActions(); onDetail(habit) }}
        >
          <IconChevronRight size={18} />
        </button>
        {!reduced && (
          <button
            className="drag-handle"
            aria-label={`Reorder ${habit.name}`}
            onPointerDown={(e) => dragControls.start(e)}
            onClick={(e) => e.preventDefault()}
          >
            <IconGrip size={18} />
          </button>
        )}
      </motion.div>
    </>
  )

  if (reduced) {
    return <li style={{ position: 'relative', listStyle: 'none' }}>{inner}</li>
  }

  return (
    <Reorder.Item
      value={habit}
      dragListener={false}
      dragControls={dragControls}
      style={{ position: 'relative', listStyle: 'none', touchAction: 'pan-y' }}
      whileDrag={{ scale: 1.02, zIndex: 5, boxShadow: 'var(--shadow-2)' }}
    >
      {inner}
    </Reorder.Item>
  )
}
