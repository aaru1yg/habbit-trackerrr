/* ============================================================
   ROUTINES — ordered sequences of habits (Step 4F).
   The routine is the primary object; habits appear as numbered
   steps connected by a vertical rail. Completion reads straight
   from checkins (no second checklist engine). Ticking a step
   dispatches the same TOGGLE_CHECKIN used everywhere else.

   Structure per routine:
     HEAD (kind icon + name + kind/member subtitle + done/total)
     → thin progress rail
     → ordered <ol> of steps (numbered marker with connector,
         habit name, metadata, action button)
     → "Routine complete" strip when fully done
     → footer (last-28-day rate + reorder + edit + archive/delete)
   ============================================================ */
import { useEffect, useMemo, useState } from 'react'
import { useStore } from '../../store.jsx'
import { useToast } from '../ui/Toaster.jsx'
import Sheet from '../ui/Sheet.jsx'
import Button from '../primitives/Button.jsx'
import IconButton from '../primitives/IconButton.jsx'
import { activeHabits, routineStats, routineRate, isDone } from '../../lib/stats.js'
import { ROUTINE_KINDS, categoryOf } from '../../lib/schedule.js'
import { todayStr } from '../../lib/dates.js'
import { interactionFeedback } from '../../lib/motion.js'
import { Link } from '../../lib/router.jsx'
import {
  IconCheck, IconX, IconPencil, IconTrash, IconStack, IconChevronRight,
} from '../../lib/icons.jsx'

const kindById = (id) => ROUTINE_KINDS.find((k) => k.id === id) || ROUTINE_KINDS[4]
const kindLabel = (r) => kindById(r).label

/* ---------- Single routine block ---------- */
function RoutineBlock({ routine, index, count, onEdit, onMove, date = todayStr() }) {
  const { state, dispatch } = useStore()
  const toast = useToast()
  const stats = routineStats(state, routine, date)
  const inactive = routine.active === false
  const members = useMemo(
    () => (routine.habitIds || [])
      .map((id) => (state.habits || []).find((h) => h.id === id))
      .filter((h) => h && !h.archived),
    [state, routine],
  )
  const scheduledIds = useMemo(() => new Set(stats.habits.map((h) => h.id)), [stats])
  const rate = routineRate(state, routine, (() => { const d = new Date(`${date}T12:00:00`); d.setDate(d.getDate() - 27); return d.toISOString().slice(0, 10) })())
  const complete = stats.total > 0 && stats.done === stats.total
  const pct = stats.total ? Math.round((stats.done / stats.total) * 100) : 0

  // Current step = first scheduled-incomplete, or null if complete/no schedule.
  const currentId = useMemo(() => {
    for (const id of routine.habitIds || []) {
      const h = members.find((x) => x.id === id)
      if (!h) continue
      if (!scheduledIds.has(id)) continue
      if (!isDone(state, h.id, date)) return id
    }
    return null
  }, [state, routine, members, scheduledIds, date])

  const remove = () => {
    dispatch({ type: 'DELETE_ROUTINE', id: routine.id })
    toast.show(`Deleted "${routine.name}"`, {
      duration: 6000,
      actionLabel: 'Undo',
      onAction: () => dispatch({ type: 'RESTORE_ROUTINE', routine }),
    })
  }
  const toggleActive = () => {
    const nextActive = inactive // inactive → activate (true); active → archive (false)
    dispatch({ type: 'UPDATE_ROUTINE', id: routine.id, patch: { active: nextActive } })
    toast.show(inactive ? `${routine.name} activated` : `${routine.name} archived`, {
      actionLabel: 'Undo',
      onAction: () => dispatch({ type: 'UPDATE_ROUTINE', id: routine.id, patch: { active: !nextActive } }),
    })
  }
  const toggleStep = (h) => {
    const done = isDone(state, h.id, date)
    interactionFeedback(done ? 'uncomplete' : 'complete', { habitId: h.id, routineId: routine.id })
    dispatch({ type: 'TOGGLE_CHECKIN', habitId: h.id, date })
  }

  return (
    <article
      className={`rt-block${inactive ? ' is-inactive' : ''}${complete ? ' is-complete' : ''}`}
      aria-label={`Routine ${routine.name}`}
      data-routine={routine.id}
    >
      <header className={`rt-head${complete ? ' is-complete' : ''}`}>
        <span className="rt-mark" aria-hidden="true"><IconStack size={16} /></span>
        <div className="rt-id">
          <h3 className="rt-title">{routine.name}</h3>
          <p className="rt-sub">
            {kindLabel(routine) !== routine.name && <span>{kindLabel(routine)}</span>}
            <span>{members.length} step{members.length === 1 ? '' : 's'}</span>
            {inactive && <span className="status-pill" data-tone="neutral">Archived</span>}
          </p>
        </div>
        <div className="rt-state" aria-live="polite">
          <span className="rt-state__num tnum">{stats.done}<sup>/{stats.total}</sup></span>
          <span className="rt-state__label">{complete ? 'complete' : stats.total ? 'today' : 'rest day'}</span>
        </div>
      </header>

      {stats.total > 0 && (
        <div className="rt-rail" aria-hidden="true">
          <div className="rt-rail__fill" style={{ width: `${pct}%` }} />
        </div>
      )}

      {members.length === 0 ? (
        <div style={{ padding: 18 }}>
          <p className="empty-note">This routine has no steps yet — edit it to add some.</p>
        </div>
      ) : (
        <ol className="rt-steps" aria-label={`${routine.name} steps`}>
          {members.map((h, i) => {
            const scheduled = scheduledIds.has(h.id)
            const done = scheduled && isDone(state, h.id, date)
            const off = !scheduled
            const isCurrent = currentId === h.id
            return (
              <li
                key={h.id}
                className={`rt-step${done ? ' is-done' : ''}${off ? ' is-off' : ''}${isCurrent ? ' is-current' : ''}`}
              >
                <span className="rt-step__num" aria-hidden="true">
                  <span className="rt-num">{String(i + 1).padStart(2, '0')}</span>
                  <span className="rt-ico"><IconCheck size={12} /></span>
                </span>
                <div className="rt-step__body">
                  <span className="rt-step__name">
                    <span className="rt-step__dot" style={{ background: `var(${categoryOf(h.category).cssVar})` }} aria-hidden="true" />
                    <Link to={`habits/${h.id}`}>{h.name}</Link>
                  </span>
                  <p className="rt-step__meta">
                    {done ? 'Complete'
                      : isCurrent ? 'Next up'
                      : off ? 'Not scheduled today'
                      : scheduled ? 'Waiting' : ''}
                  </p>
                </div>
                <span className="rt-step__action">
                  <Button
                    type="button"
                    variant={done ? 'quiet' : (isCurrent ? 'secondary' : 'quiet')}
                    size="sm"
                    className={`rt-step__btn${done ? ' is-done' : ''}${isCurrent ? ' is-current' : ''}${off ? ' is-off' : ''}`}
                    aria-pressed={done}
                    aria-label={scheduled
                      ? `Mark ${h.name} as ${done ? 'not complete' : 'complete'} in ${routine.name}`
                      : `${h.name} is not scheduled today`}
                    disabled={!scheduled || inactive}
                    onClick={() => toggleStep(h)}
                    icon={done ? <IconCheck size={12} aria-hidden="true" /> : null}
                  >
                    {done ? 'Done' : isCurrent ? 'Do it' : off ? '—' : 'Start'}
                  </Button>
                </span>
              </li>
            )
          })}
        </ol>
      )}

      {complete && stats.total > 0 && (
        <div className="rt-complete" role="status">All steps complete</div>
      )}

      <footer className="rt-foot">
        <span className="rt-foot__meta">
          {rate && rate.days > 0
            ? `Fully done ${rate.full} of the last ${rate.days} day${rate.days === 1 ? '' : 's'}`
            : members.length === 0 ? 'Add steps to begin.' : 'No history yet.'}
        </span>
        {onMove && count > 1 && !inactive && (
          <span className="rt-move" role="group" aria-label={`Reorder ${routine.name}`}>
            <IconButton size="sm" onClick={() => onMove(routine, -1)} disabled={index === 0} label={`Move ${routine.name} earlier`} icon={<span aria-hidden="true">↑</span>} />
            <IconButton size="sm" onClick={() => onMove(routine, 1)} disabled={index === count - 1} label={`Move ${routine.name} later`} icon={<span aria-hidden="true">↓</span>} />
          </span>
        )}
        <Button variant="quiet" size="sm" onClick={() => onEdit(routine)} aria-label={`Edit routine ${routine.name}`} icon={<IconPencil size={13} aria-hidden="true" />}>
          Edit
        </Button>
        <Button variant="quiet" size="sm" onClick={toggleActive}>{inactive ? 'Activate' : 'Archive'}</Button>
        <Button variant="danger" size="sm" onClick={remove} aria-label={`Delete routine ${routine.name}`} icon={<IconTrash size={13} aria-hidden="true" />} />
      </footer>
    </article>
  )
}

/* ---------- Routine form (existing model preserved) ---------- */
export function RoutineForm({ open, onClose, editing }) {
  const { state, dispatch } = useStore()
  const habits = activeHabits(state)
  const [name, setName] = useState('')
  const [kind, setKind] = useState('morning')
  const [picked, setPicked] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setError('')
    if (editing) {
      setName(editing.name || '')
      setKind(editing.kind || 'custom')
      setPicked(editing.habitIds || [])
    } else {
      setName(''); setKind('morning'); setPicked([])
    }
  }, [open, editing])

  const save = () => {
    const trimmed = name.trim()
    if (!trimmed) { setError('Give the routine a name.'); return }
    if (!picked.length) { setError('Pick at least one habit to stack.'); return }
    if (editing) dispatch({ type: 'UPDATE_ROUTINE', id: editing.id, patch: { name: trimmed, kind, habitIds: picked } })
    else dispatch({ type: 'ADD_ROUTINE', routine: { name: trimmed, kind, habitIds: picked } })
    onClose()
  }
  const move = (id, dir) => {
    setPicked((list) => {
      const i = list.indexOf(id)
      const j = i + dir
      if (i < 0 || j < 0 || j >= list.length) return list
      const next = [...list];[next[i], next[j]] = [next[j], next[i]]; return next
    })
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={editing ? 'Edit routine' : 'New routine'}
      labelledBy="routine-form-title"
      footer={
        <>
          <Button variant="quiet" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save} disabled={!name.trim() || !picked.length}>
            {editing ? 'Save routine' : 'Create routine'}
          </Button>
        </>
      }
    >
      <div className="stack" style={{ gap: 18 }}>
        <div>
          <label className="field-label" htmlFor="rt-name">Routine name</label>
          <input id="rt-name" className="field" autoFocus value={name} maxLength={60}
            placeholder="e.g. Morning reset" onChange={(e) => setName(e.target.value)} />
          {error && <p style={{ color: 'var(--bad)', fontSize: 'var(--fs-sm)', marginTop: 6 }}>{error}</p>}
        </div>
        <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
          <legend className="field-label">Type</legend>
          <div className="filter-bar" role="group" aria-label="Routine type">
            {ROUTINE_KINDS.map((k) => (
              <button key={k.id} type="button" aria-pressed={kind === k.id} onClick={() => setKind(k.id)}>{k.label}</button>
            ))}
          </div>
        </fieldset>
        <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
          <legend className="field-label">Steps in this routine</legend>
          {habits.length === 0 ? (
            <p className="empty-note">Add habits first — then you can stack them.</p>
          ) : (
            <>
              <div className="wrap-gap">
                {habits.map((h) => (
                  <Button key={h.id} type="button" variant="secondary" size="sm" aria-pressed={picked.includes(h.id)}
                    className="rt-form-pick"
                    style={{ borderRadius: 99, borderColor: picked.includes(h.id) ? 'var(--accent)' : undefined, background: picked.includes(h.id) ? 'color-mix(in srgb,var(--accent) 10%,transparent)' : undefined }}
                    onClick={() => setPicked((p) => (p.includes(h.id) ? p.filter((x) => x !== h.id) : [...p, h.id]))}
                    icon={picked.includes(h.id) ? <IconCheck size={13} aria-hidden="true" /> : null}>
                    {h.name}
                  </Button>
                ))}
              </div>
              {picked.length > 0 && (
                <div className="stack" style={{ gap: 4, marginTop: 14 }}>
                  <p className="eyebrow">Order</p>
                  {picked.map((id, i) => {
                    const h = habits.find((x) => x.id === id)
                    if (!h) return null
                    return (
                      <div key={id} className="rt-form-row">
                        <span className="tiny muted tnum" style={{ width: 22 }}>{String(i + 1).padStart(2, '0')}</span>
                        <span style={{ flex: 1, minWidth: 0 }} className="ellipsis">{h.name}</span>
                        <IconButton size="sm" label={`Move ${h.name} earlier`} disabled={i === 0} onClick={() => move(id, -1)} icon={<span aria-hidden="true">↑</span>} />
                        <IconButton size="sm" label={`Move ${h.name} later`} disabled={i === picked.length - 1} onClick={() => move(id, 1)} icon={<span aria-hidden="true">↓</span>} />
                        <IconButton size="sm" label={`Remove ${h.name} from routine`} onClick={() => setPicked((p) => p.filter((x) => x !== id))} icon={<IconX size={14} aria-hidden="true" />} />
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </fieldset>
      </div>
    </Sheet>
  )
}

/* ---------- Routines view (Habits › Routines) ---------- */
export default function RoutinesView({ onNew, onEdit }) {
  const { state, dispatch } = useStore()
  const all = useMemo(
    () => [...(state.routines || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [state.routines],
  )
  const live = all.filter((r) => r.active !== false)
  const archived = all.filter((r) => r.active === false)
  const habits = activeHabits(state)

  const move = (routine, dir) => {
    const ids = live.map((r) => r.id)
    const i = ids.indexOf(routine.id)
    const j = i + dir
    if (i < 0 || j < 0 || j >= ids.length) return
    ;[ids[i], ids[j]] = [ids[j], ids[i]]
    dispatch({ type: 'REORDER_ROUTINES', order: [...ids, ...archived.map((r) => r.id)] })
  }

  if (all.length === 0) {
    return (
      <section className="rt-empty" aria-label="No routines">
        <div style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--surface-2)', display: 'grid', placeItems: 'center', color: 'var(--text-2)' }}>
          <IconStack size={20} />
        </div>
        <strong>No routines yet</strong>
        <p>
          {habits.length
            ? 'Stack a few habits into a morning reset, workout block or wind-down. Steps stay in order and progress is shared with Today.'
            : 'Add a couple of habits first, then stack them into a routine.'}
        </p>
        <Button type="button" variant="primary" onClick={onNew} disabled={!habits.length}>
          Create routine
        </Button>
      </section>
    )
  }

  return (
    <div className="rt" id="routines-screen">
      {live.map((r, i) => (
        <RoutineBlock key={r.id} routine={r} index={i} count={live.length} onEdit={onEdit} onMove={move} />
      ))}
      {archived.length > 0 && (
        <details className="rt-archive">
          <summary>
            <span>Archived routines ({archived.length})</span>
            <IconChevronRight size={14} aria-hidden="true" />
          </summary>
          <div style={{ display: 'grid', gap: 12, marginTop: 10 }}>
            {archived.map((r) => <RoutineBlock key={r.id} routine={r} onEdit={onEdit} />)}
          </div>
        </details>
      )}
    </div>
  )
}
