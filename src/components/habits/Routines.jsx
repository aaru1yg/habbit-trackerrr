/* ============================================================
   ROUTINES — first-class habit stacks (Phase 5 §8-9).

   A routine references existing habits and reads completion
   straight from the same check-ins (routineStats / TOGGLE_CHECKIN).
   There is no second checklist engine: ticking a step here is the
   same dispatch Today and the calendar use.

   Extracted from the retired LibraryScreen so the Habits
   workspace and Today can share one implementation.
   ============================================================ */
import { useEffect, useState } from 'react'
import { useStore } from '../../store.jsx'
import { useToast } from '../ui/Toaster.jsx'
import Sheet from '../ui/Sheet.jsx'
import { SegControl } from '../ui/controls.jsx'
import { Meter } from '../work/WorkKit.jsx'
import { activeHabits, routineStats, routineRate, isDone } from '../../lib/stats.js'
import { ROUTINE_KINDS, categoryOf } from '../../lib/schedule.js'
import { todayStr, subDaysStr } from '../../lib/dates.js'
import { interactionFeedback } from '../../lib/motion.js'
import { IconCheck, IconX, IconPencil, IconTrash, IconChevronRight, IconStack } from '../../lib/icons.jsx'

const routineKindLabel = (routine) =>
  (ROUTINE_KINDS.find((k) => k.id === routine?.kind) || ROUTINE_KINDS[4]).label

/* ------------------------------------------------------------
   ROUTINE CARD — identity, progress, the grouped ○ rows, actions
   ------------------------------------------------------------ */
function RoutineCard({ routine, index = 0, count = 1, onEdit, onMove, date = todayStr() }) {
  const { state, dispatch } = useStore()
  const toast = useToast()
  const stats = routineStats(state, routine, date)
  const inactive = routine.active === false
  const members = (routine.habitIds || [])
    .map((id) => (state.habits || []).find((h) => h.id === id))
    .filter((h) => h && !h.archived)
  const scheduledIds = new Set(stats.habits.map((h) => h.id))
  const rate = routineRate(state, routine, subDaysStr(date, 27), date)

  const remove = () => {
    dispatch({ type: 'DELETE_ROUTINE', id: routine.id })
    toast.show(`Deleted “${routine.name}”`, {
      duration: 6000,
      actionLabel: 'Undo',
      onAction: () => dispatch({ type: 'RESTORE_ROUTINE', routine }),
    })
  }

  const toggleActive = () => {
    dispatch({ type: 'UPDATE_ROUTINE', id: routine.id, patch: { active: inactive } })
    toast.show(inactive ? `${routine.name} activated` : `${routine.name} archived`, {
      actionLabel: 'Undo',
      onAction: () => dispatch({ type: 'UPDATE_ROUTINE', id: routine.id, patch: { active: !inactive } }),
    })
  }

  const toggleStep = (h, done) => {
    interactionFeedback(done ? 'uncomplete' : 'complete', { habitId: h.id, routineId: routine.id })
    dispatch({ type: 'TOGGLE_CHECKIN', habitId: h.id, date })
  }

  const complete = stats.total > 0 && stats.done === stats.total

  return (
    <article
      className={`routine${inactive ? ' is-inactive' : ''}${complete ? ' is-complete' : ''}`}
      aria-label={`Routine ${routine.name}`}
      data-routine={routine.id}
    >
      <header className="routine-top">
        <span className="routine-mark" aria-hidden="true"><IconStack size={16} /></span>
        <div className="routine-id">
          <h3 className="routine-name">{routine.name}</h3>
          <p className="routine-sub">
            {routineKindLabel(routine) !== routine.name && <span>{routineKindLabel(routine)}</span>}
            <span>{members.length} habit{members.length === 1 ? '' : 's'}</span>
            {inactive && <span className="status-pill" data-tone="neutral">Archived</span>}
          </p>
        </div>
        <div className="routine-score">
          <strong className="tnum">{stats.pct == null ? '—' : `${stats.pct}%`}</strong>
          <span className="tiny muted tnum">{stats.total ? `${stats.done}/${stats.total} today` : 'nothing today'}</span>
        </div>
      </header>

      {stats.total > 0 && (
        <Meter pct={stats.pct ?? 0} tone={complete ? 'good' : undefined} thin label={`${routine.name} ${stats.pct ?? 0}% complete today`} />
      )}

      {members.length === 0 ? (
        <p className="empty-note">This routine has no habits yet — edit it to add some.</p>
      ) : (
        <ol className="routine-habits" aria-label={`${routine.name} habits`}>
          {members.map((h) => {
            const scheduled = scheduledIds.has(h.id)
            const done = scheduled && isDone(state, h.id, date)
            return (
              <li key={h.id} className="routine-habit" data-done={done} data-off={!scheduled}>
                <button
                  type="button"
                  className="routine-tick"
                  aria-pressed={done}
                  aria-label={scheduled ? `Mark ${h.name} ${done ? 'not done' : 'done'} in ${routine.name}` : `${h.name} is not scheduled today`}
                  disabled={!scheduled || inactive}
                  onClick={() => toggleStep(h, done)}
                >
                  <span className="routine-ring" aria-hidden="true">{done && <IconCheck size={12} />}</span>
                  <span className="routine-habit-name">{h.name}</span>
                  <span className="routine-habit-meta">{scheduled ? categoryOf(h.category).label : 'Not scheduled today'}</span>
                </button>
              </li>
            )
          })}
        </ol>
      )}

      <footer className="routine-foot">
        {rate && rate.days > 0 && (
          <span className="tiny muted tnum">Fully done {rate.full} of the last {rate.days} day{rate.days === 1 ? '' : 's'}</span>
        )}
        <span className="routine-spacer" />
        {onMove && count > 1 && (
          <>
            <button type="button" className="btn ghost sm" onClick={() => onMove(routine, -1)} disabled={index === 0} aria-label={`Move ${routine.name} up`}>↑</button>
            <button type="button" className="btn ghost sm" onClick={() => onMove(routine, 1)} disabled={index === count - 1} aria-label={`Move ${routine.name} down`}>↓</button>
          </>
        )}
        <button type="button" className="btn ghost sm" onClick={() => onEdit(routine)} aria-label={`Edit routine ${routine.name}`}><IconPencil size={14} /> Edit</button>
        <button type="button" className="btn ghost sm" onClick={toggleActive}>{inactive ? 'Activate' : 'Archive'}</button>
        <button type="button" className="btn ghost sm danger-text" onClick={remove} aria-label={`Delete routine ${routine.name}`}><IconTrash size={14} /></button>
      </footer>
    </article>
  )
}

/* ------------------------------------------------------------
   ROUTINE FORM — name, type, members, order (existing reducer)
   ------------------------------------------------------------ */
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
      setName('')
      setKind('morning')
      setPicked([])
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
      const next = [...list]
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
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
          <button className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn primary" onClick={save} disabled={!name.trim() || !picked.length}>
            {editing ? 'Save routine' : 'Create routine'}
          </button>
        </>
      }
    >
      <div className="stack" style={{ gap: 18 }}>
        <div>
          <label className="field-label" htmlFor="routine-name">Routine name</label>
          <input id="routine-name" className="field" autoFocus value={name} maxLength={60}
            placeholder="e.g. Morning reset" onChange={(e) => setName(e.target.value)} />
          {error && <p style={{ color: 'var(--bad)', fontSize: 'var(--fs-sm)', marginTop: 6 }}>{error}</p>}
        </div>

        <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
          <legend className="field-label">Type</legend>
          <SegControl label="Routine type" value={kind} onChange={setKind} options={ROUTINE_KINDS} />
        </fieldset>

        <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
          <legend className="field-label">Habits in this routine</legend>
          {habits.length === 0 ? (
            <p className="empty-note">Add habits first — then you can stack them.</p>
          ) : (
            <>
              <div className="wrap-gap">
                {habits.map((h) => (
                  <button key={h.id} type="button" className="btn sm" aria-pressed={picked.includes(h.id)}
                    style={{ borderRadius: 999, borderColor: picked.includes(h.id) ? 'var(--accent-1)' : undefined, background: picked.includes(h.id) ? 'var(--accent-soft)' : undefined }}
                    onClick={() => setPicked((p) => (p.includes(h.id) ? p.filter((x) => x !== h.id) : [...p, h.id]))}>
                    {picked.includes(h.id) && <IconCheck size={13} />}
                    {h.name}
                  </button>
                ))}
              </div>
              {picked.length > 0 && (
                <div className="stack" style={{ gap: 4, marginTop: 14 }}>
                  <p className="eyebrow">Order</p>
                  {picked.map((id, i) => {
                    const h = habits.find((x) => x.id === id)
                    if (!h) return null
                    return (
                      <div key={id} className="routine-order-row">
                        <span className="tiny muted tnum" style={{ width: 18 }}>{i + 1}</span>
                        <span style={{ flex: 1, minWidth: 0 }} className="ellipsis">{h.name}</span>
                        <button className="btn ghost sm" aria-label={`Move ${h.name} earlier`} disabled={i === 0} onClick={() => move(id, -1)}>↑</button>
                        <button className="btn ghost sm" aria-label={`Move ${h.name} later`} disabled={i === picked.length - 1} onClick={() => move(id, 1)}>↓</button>
                        <button className="btn ghost icon" aria-label={`Remove ${h.name} from routine`}
                          onClick={() => setPicked((p) => p.filter((x) => x !== id))}>
                          <IconX size={14} />
                        </button>
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

/* ------------------------------------------------------------
   ROUTINES VIEW — the Habits › Routines tab
   ------------------------------------------------------------ */
export default function RoutinesView({ onNew, onEdit }) {
  const { state, dispatch } = useStore()
  const all = [...(state.routines || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
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
      <section className="habits-empty card" aria-label="No routines">
        <h2 className="empty-title">No routines yet</h2>
        <p className="empty-sub">
          {habits.length
            ? 'Stack a few habits into a morning reset, a workout block or a wind-down. A routine shows total progress, not just individual ticks.'
            : 'Add a couple of habits first, then stack them into a routine.'}
        </p>
        <div className="empty-actions">
          <button type="button" className="btn primary" onClick={onNew} disabled={!habits.length}>Build a routine</button>
        </div>
      </section>
    )
  }

  return (
    <div className="routine-list">
      {live.map((r, i) => (
        <RoutineCard key={r.id} routine={r} index={i} count={live.length} onEdit={onEdit} onMove={move} />
      ))}
      {archived.length > 0 && (
        <details className="routine-archive">
          <summary>
            <span>Archived routines ({archived.length})</span>
            <IconChevronRight size={15} aria-hidden="true" />
          </summary>
          <div className="routine-list">
            {archived.map((r) => <RoutineCard key={r.id} routine={r} onEdit={onEdit} />)}
          </div>
        </details>
      )}
    </div>
  )
}
