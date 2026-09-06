/* ============================================================
   HABIT LIBRARY — every habit, every routine, the archive.
   Routines are habit stacks (§21, §22): ordered groups that show
   routine-level completion as well as individual progress.
   ============================================================ */
import { useEffect, useMemo, useState } from 'react'
import { useStore } from '../store.jsx'
import { useToast } from '../components/ui/Toaster.jsx'
import { useHabitUI } from '../components/habits/HabitUIProvider.jsx'
import Sheet from '../components/ui/Sheet.jsx'
import SectionCard, { CardHead } from '../components/ui/SectionCard.jsx'
import { Meter, WorkEmpty, FadeIn } from '../components/work/WorkKit.jsx'
import { activeHabits, habitStreak, habitRate, routineStats, activeRoutines } from '../lib/stats.js'
import { consistencyScore, consistencyLabel } from '../lib/analytics.js'
import { CATEGORIES, ROUTINE_KINDS, categoryOf, scheduleLabel, scheduleState, isScheduled, nextScheduledDate } from '../lib/schedule.js'
import { todayStr, subDaysStr, shortDate, addDaysStr } from '../lib/dates.js'
import {
  IconStack, IconPlus, IconPencil, IconArchive, IconTrash, IconChevronRight, IconFlame,
  IconCheck, IconX, IconLayers, IconClock,
} from '../lib/icons.jsx'

export default function LibraryScreen() {
  const { state, dispatch } = useStore()
  const habitUI = useHabitUI()
  const toast = useToast()
  const today = todayStr()
  const [tab, setTab] = useState('habits')
  const [routineForm, setRoutineForm] = useState({ open: false, editing: null })

  const habits = activeHabits(state)
  const archived = (state.habits || []).filter((h) => h.archived)
  const routines = activeRoutines(state)
  const allRoutines = (state.routines || [])

  return (
    <div className="screen" id="library-screen">
      <header className="screen-head">
        <div>
          <h1 className="screen-title">Library</h1>
          <p className="screen-sub">{habits.length} active habit{habits.length === 1 ? '' : 's'} · {routines.length} routine{routines.length === 1 ? '' : 's'}</p>
        </div>
        <div className="head-actions">
          {tab === 'routines'
            ? <button className="btn primary" onClick={() => setRoutineForm({ open: true, editing: null })}><IconPlus size={16} /> New routine</button>
            : <button className="btn primary" onClick={habitUI.openAdd}><IconPlus size={16} /> New habit</button>}
        </div>
      </header>

      <div className="stack">
        <div className="seg seg-wide" role="tablist" aria-label="Library sections">
          {[
            { id: 'habits', label: `Habits (${habits.length})` },
            { id: 'routines', label: `Routines (${routines.length})` },
            { id: 'archive', label: `Archive (${archived.length})` },
          ].map((t) => (
            <button key={t.id} type="button" role="tab" aria-selected={tab === t.id}
              className={`seg-btn${tab === t.id ? ' active' : ''}`} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'habits' && (
          habits.length === 0 ? (
            <SectionCard>
              <WorkEmpty icon={<IconLayers size={40} />} title="No habits yet"
                action={<button className="btn primary" onClick={habitUI.openAdd}><IconPlus size={16} /> Add your first habit</button>}>
                Small and specific beats big and vague. You can add a habit in about five seconds.
              </WorkEmpty>
            </SectionCard>
          ) : (
            <div className="work-list">
              {habits.map((h, i) => <HabitCard key={h.id} habit={h} index={i} />)}
            </div>
          )
        )}

        {tab === 'routines' && (
          <>
            {routines.length === 0 ? (
              <SectionCard>
                <WorkEmpty icon={<IconStack size={40} />} title="No routines yet"
                  action={<button className="btn primary" onClick={() => setRoutineForm({ open: true, editing: null })} disabled={!habits.length}><IconPlus size={16} /> Build a routine</button>}>
                  {habits.length
                    ? 'Stack habits into a morning reset, a workout block or a wind-down. A routine shows total progress, not just individual ticks.'
                    : 'Add a couple of habits first, then stack them into a routine.'}
                </WorkEmpty>
              </SectionCard>
            ) : (
              <div className="work-list">
                {routines.map((r, i) => (
                  <RoutineCard key={r.id} routine={r} index={i}
                    onEdit={() => setRoutineForm({ open: true, editing: r })}
                    onToggle={() => dispatch({ type: 'UPDATE_ROUTINE', id: r.id, patch: { active: !r.active } })} />
                ))}
                {allRoutines.filter((r) => r.active === false).map((r) => (
                  <RoutineCard key={r.id} routine={r} inactive
                    onEdit={() => setRoutineForm({ open: true, editing: r })}
                    onToggle={() => dispatch({ type: 'UPDATE_ROUTINE', id: r.id, patch: { active: true } })} />
                ))}
              </div>
            )}
          </>
        )}

        {tab === 'archive' && (
          archived.length === 0 ? (
            <SectionCard>
              <WorkEmpty icon={<IconArchive size={40} />} title="Nothing archived">
                Archiving hides a habit from Today and analytics without deleting its history.
              </WorkEmpty>
            </SectionCard>
          ) : (
            <div className="work-list">
              {archived.map((h, i) => (
                <FadeIn key={h.id} delay={Math.min(i * 0.03, 0.2)}>
                  <article className="work-card is-done" data-tone="neutral">
                    <div className="work-top">
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p className="work-title">{h.name}</p>
                        <p className="work-sub">
                          <span>{categoryOf(h.category).label}</span>
                          <span>{scheduleLabel(h)}</span>
                        </p>
                      </div>
                      <button className="btn sm" onClick={() => habitUI.archive(h)}><IconArchive size={15} /> Restore</button>
                    </div>
                  </article>
                </FadeIn>
              ))}
            </div>
          )
        )}
      </div>

      <RoutineForm
        open={routineForm.open}
        editing={routineForm.editing}
        onClose={() => setRoutineForm({ open: false, editing: null })}
      />
    </div>
  )
}

/* ------------------------------------------------------------
   HABIT CARD (library density: consistency + schedule controls)
   ------------------------------------------------------------ */
function HabitCard({ habit, index }) {
  const { state, dispatch } = useStore()
  const habitUI = useHabitUI()
  const toast = useToast()
  const today = todayStr()
  const streak = habitStreak(state, habit)
  const rate = habitRate(state, habit, subDaysStr(today, 29), today)
  const consistency = consistencyScore(state, habit, 90)
  const cat = categoryOf(habit.category)
  const sched = scheduleState(habit, today)
  const next = nextScheduledDate(habit, today)
  const paused = sched.id === 'paused'

  const togglePause = () => {
    if (paused) {
      dispatch({ type: 'PAUSE_HABIT', id: habit.id, from: null })
      toast.show(`${habit.name} resumed`)
    } else {
      const until = addDaysStr(today, 7)
      dispatch({ type: 'PAUSE_HABIT', id: habit.id, from: today, until })
      toast.show(`${habit.name} paused until ${shortDate(until)}`, {
        actionLabel: 'Undo',
        onAction: () => dispatch({ type: 'PAUSE_HABIT', id: habit.id, from: null }),
      })
    }
  }

  const skipToday = () => {
    dispatch({ type: 'SKIP_DAY', id: habit.id, date: today })
    toast.show(`Skipped ${habit.name} today — not counted as a miss`, {
      actionLabel: 'Undo',
      onAction: () => dispatch({ type: 'SKIP_DAY', id: habit.id, date: today }),
    })
  }

  return (
    <FadeIn delay={Math.min(index * 0.03, 0.24)}>
      <article className="work-card" data-tone="neutral" aria-label={`Habit ${habit.name}`}>
        <div className="work-top">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="wrap-gap" style={{ gap: 6, marginBottom: 6 }}>
              <span className="chip" style={{ minHeight: 22 }}>
                <span className="dot" style={{ background: `var(${cat.cssVar})` }} />
                {cat.label}
              </span>
              {paused && <span className="status-pill" data-tone="neutral">Paused</span>}
              {streak > 1 && (
                <span className="chip" style={{ minHeight: 22, color: 'var(--warn)' }}>
                  <IconFlame size={12} /> {streak}d
                </span>
              )}
            </div>
            <button className="work-title" style={{ background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', fontFamily: 'var(--font-display)', width: '100%' }}
              onClick={() => habitUI.openDetail(habit)} aria-label={`Open ${habit.name}`}>
              {habit.name}
            </button>
            <p className="work-sub">
              <span>{sched.label}</span>
              {!isScheduled(habit, today) && next && <span>Next: {shortDate(next)}</span>}
              {habit.reminder && <span><IconClock size={11} /> {habit.reminder}</span>}
            </p>
          </div>
          <div style={{ flex: 'none', textAlign: 'right' }}>
            <div className="meter-pct" style={{ fontSize: '1.25rem', lineHeight: 1 }}>
              {rate.rate == null ? '—' : `${Math.round(rate.rate * 100)}%`}
            </div>
            <div className="tiny muted" style={{ marginTop: 4 }}>30d</div>
          </div>
        </div>

        <div className="work-body">
          <Meter pct={consistency.score ?? 0} tone={consistency.score == null ? 'neutral' : consistency.score >= 70 ? 'good' : consistency.score >= 45 ? 'warn' : 'bad'}
            label={`Consistency ${consistency.score ?? 0} out of 100`} />
          <p className="tiny muted" style={{ marginTop: 8 }}>
            {consistency.enough
              ? <>Consistency <b className="tnum">{consistency.score}</b>/100 · {consistencyLabel(consistency.score)} · best run {consistency.bestRun}d in 90 days</>
              : 'Not enough history for a consistency score yet.'}
          </p>
        </div>

        <div className="work-foot">
          <button className="btn ghost sm" onClick={() => habitUI.openEdit(habit)}><IconPencil size={14} /> Edit</button>
          <button className="btn ghost sm" onClick={togglePause}>{paused ? 'Resume' : 'Pause'}</button>
          {isScheduled(habit, today) && !paused && (
            <button className="btn ghost sm" onClick={skipToday}>Skip today</button>
          )}
          <span style={{ flex: 1 }} />
          <button className="btn ghost sm" onClick={() => habitUI.archive(habit)} aria-label={`Archive ${habit.name}`}><IconArchive size={15} /></button>
          <button className="btn ghost sm" style={{ color: 'var(--bad)' }} onClick={() => habitUI.remove(habit)} aria-label={`Delete ${habit.name}`}><IconTrash size={15} /></button>
          <button className="btn ghost icon" onClick={() => habitUI.openDetail(habit)} aria-label={`Details for ${habit.name}`}><IconChevronRight size={18} /></button>
        </div>
      </article>
    </FadeIn>
  )
}

/* ------------------------------------------------------------
   ROUTINE CARD — the stack, with routine-level completion
   ------------------------------------------------------------ */
function RoutineCard({ routine, onEdit, onToggle, inactive = false }) {
  const { state, dispatch } = useStore()
  const toast = useToast()
  const today = todayStr()
  const stats = routineStats(state, routine, today)
  const kind = ROUTINE_KINDS.find((k) => k.id === routine.kind) || ROUTINE_KINDS[4]

  const remove = () => {
    dispatch({ type: 'DELETE_ROUTINE', id: routine.id })
    toast.show(`Deleted “${routine.name}”`, {
      duration: 6000,
      actionLabel: 'Undo',
      onAction: () => dispatch({ type: 'RESTORE_ROUTINE', routine }),
    })
  }

  return (
    <FadeIn>
      <article className={`routine-card${inactive ? ' is-done' : ''}`} style={inactive ? { opacity: 0.7 } : undefined} aria-label={`Routine ${routine.name}`}>
        <div className="routine-head">
          <div style={{ flex: 1, minWidth: 0 }}>
            <p className="eyebrow">{kind.label}</p>
            <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'var(--fs-h2)', marginTop: 2 }} className="ellipsis">{routine.name}</p>
          </div>
          <div style={{ textAlign: 'right', flex: 'none' }}>
            <p className="meter-pct" style={{ fontSize: '1.25rem', lineHeight: 1 }}>{stats.pct == null ? '—' : `${stats.pct}%`}</p>
            <p className="tiny muted tnum">{stats.done}/{stats.total} today</p>
          </div>
        </div>

        <div style={{ padding: 'var(--sp-3) var(--sp-4)' }}>
          <Meter pct={stats.pct ?? 0} tone={stats.pct === 100 ? 'good' : undefined} label={`Routine ${stats.pct ?? 0}% complete today`} />
        </div>

        {stats.habits.length === 0 ? (
          <p className="tiny muted" style={{ padding: '0 var(--sp-4) var(--sp-4)' }}>
            No habits scheduled in this routine today.
          </p>
        ) : (
          <div className="routine-stack" style={{ paddingBottom: 'var(--sp-3)' }}>
            {stats.habits.map((h) => {
              const done = state.checkins?.[h.id]?.[today]?.done === true
              return (
                <div className="routine-step" key={h.id} data-done={done}>
                  <button
                    className="check-box"
                    data-done={done}
                    aria-pressed={done}
                    aria-label={`Mark ${h.name} ${done ? 'not done' : 'done'}`}
                    onClick={() => dispatch({ type: 'TOGGLE_CHECKIN', habitId: h.id, date: today })}
                  >
                    {done && <IconCheck size={13} />}
                  </button>
                  <span style={{ flex: 1, minWidth: 0 }} className="ellipsis">{h.name}</span>
                  <span className="tiny muted tnum">{categoryOf(h.category).label}</span>
                </div>
              )
            })}
          </div>
        )}

        <div className="work-foot" style={{ padding: '0 var(--sp-4) var(--sp-4)', marginTop: 0 }}>
          <button className="btn ghost sm" onClick={onEdit}><IconPencil size={14} /> Edit</button>
          <button className="btn ghost sm" onClick={onToggle}>{routine.active === false ? 'Activate' : 'Deactivate'}</button>
          <span style={{ flex: 1 }} />
          <button className="btn ghost sm" style={{ color: 'var(--bad)' }} onClick={remove} aria-label={`Delete routine ${routine.name}`}>
            <IconTrash size={14} />
          </button>
        </div>
      </article>
    </FadeIn>
  )
}

/* ------------------------------------------------------------
   ROUTINE FORM
   ------------------------------------------------------------ */
function RoutineForm({ open, onClose, editing }) {
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
          <div className="filter-bar" role="group" aria-label="Routine type">
            {ROUTINE_KINDS.map((k) => (
              <button key={k.id} type="button" aria-pressed={kind === k.id} onClick={() => setKind(k.id)}>{k.label}</button>
            ))}
          </div>
        </fieldset>

        <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
          <legend className="field-label">Habits in this stack</legend>
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
                      <div key={id} className="task-row" style={{ minHeight: 44 }}>
                        <span className="tiny muted tnum" style={{ width: 18 }}>{i + 1}</span>
                        <span style={{ flex: 1, minWidth: 0 }} className="ellipsis">{h.name}</span>
                        <button className="btn ghost sm" style={{ minHeight: 36 }} aria-label={`Move ${h.name} earlier`} disabled={i === 0} onClick={() => move(id, -1)}>↑</button>
                        <button className="btn ghost sm" style={{ minHeight: 36 }} aria-label={`Move ${h.name} later`} disabled={i === picked.length - 1} onClick={() => move(id, 1)}>↓</button>
                        <button className="btn ghost icon" style={{ width: 36, height: 36, minHeight: 36 }} aria-label={`Remove ${h.name} from routine`}
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
