/* ============================================================
   GOALS — the outcome layer.

   A goal is an outcome with a target date. Milestones break it
   down; habits, projects and assignments do the work. This screen
   never duplicates project CRUD — it links the two together and
   shows what each goal needs from you today.

   Progress, pace and health are all derived. When a goal has
   nothing linked yet it says so rather than showing a hopeful 0%.
   ============================================================ */
import { useMemo, useState } from 'react'
import { useStore } from '../store.jsx'
import { useToast } from '../components/ui/Toaster.jsx'
import Sheet from '../components/ui/Sheet.jsx'
import SectionCard, { CardHead } from '../components/ui/SectionCard.jsx'
import EmptyState from '../components/ui/EmptyState.jsx'
import { Meter, StatStrip, WorkEmpty, FadeIn } from '../components/work/WorkKit.jsx'
import {
  GOAL_AREAS, areaOf, goalSummary, goalHealth, goalProgress,
  nextMilestone, goalTodayActions, openGoals,
} from '../lib/goals.js'
import { habitRate, habitStreak, activeHabits } from '../lib/stats.js'
import { projectProgress } from '../lib/work.js'
import { todayStr, subDaysStr, prettyDate, isValidDayStr } from '../lib/dates.js'
import { Link } from '../lib/router.jsx'
import {
  IconGoals, IconPlus, IconPencil, IconTrash, IconCheck, IconLink, IconFlame,
  IconChevronRight, IconTarget, IconArchive, IconClock,
} from '../lib/icons.jsx'

export default function GoalsScreen() {
  const { state, dispatch } = useStore()
  const toast = useToast()
  const today = todayStr()
  const from = subDaysStr(today, 29)
  const [filter, setFilter] = useState('open')
  const [form, setForm] = useState({ open: false, editing: null })
  const [linksFor, setLinksFor] = useState(null)

  const summary = useMemo(() => goalSummary(state, { now: new Date() }), [state])
  const reached = useMemo(
    () => (state.goals || []).filter((g) => !g.archived && (g.status === 'completed' || goalProgress(state, g).pct >= 100)),
    [state],
  )
  const goals = (state.goals || []).filter((g) => !g.archived)
  const shown = filter === 'open'
    ? openGoals(state)
    : filter === 'reached'
      ? reached
      : goals

  const ordered = useMemo(
    () => [...shown].sort((a, b) => {
      const ad = isValidDayStr(a.targetDate) ? a.targetDate : '9999-99-99'
      const bd = isValidDayStr(b.targetDate) ? b.targetDate : '9999-99-99'
      return ad.localeCompare(bd) || a.title.localeCompare(b.title)
    }),
    [shown],
  )

  const nextMilestoneRow = useMemo(() => {
    for (const g of openGoals(state)) {
      const m = nextMilestone(g)
      if (m) return { goal: g, milestone: m }
    }
    return null
  }, [state])

  const remove = (goal) => {
    dispatch({ type: 'DELETE_GOAL', id: goal.id })
    toast.show(`Deleted “${goal.title}”`, {
      duration: 6000,
      actionLabel: 'Undo',
      onAction: () => dispatch({ type: 'RESTORE_GOAL', goal }),
    })
  }

  const archive = (goal) => {
    dispatch({ type: 'UPDATE_GOAL', id: goal.id, patch: { archived: true, status: 'archived' } })
    toast.show(`Archived “${goal.title}”`, {
      duration: 6000,
      actionLabel: 'Undo',
      onAction: () => dispatch({ type: 'UPDATE_GOAL', id: goal.id, patch: { archived: false, status: 'active' } }),
    })
  }

  const cells = [
    { label: 'Open goals', value: summary.open, note: summary.open === 1 ? 'in progress' : 'in progress' },
    {
      label: 'Average progress',
      value: summary.avg == null ? '—' : summary.avg,
      note: summary.avg == null ? 'no open goals' : 'percent',
    },
    {
      label: 'Next milestone',
      value: nextMilestoneRow
        ? (isValidDayStr(nextMilestoneRow.milestone.targetDate)
          ? `${Math.max(0, Math.round((new Date(`${nextMilestoneRow.milestone.targetDate}T00:00`) - new Date(`${today}T00:00`)) / 86400000))}d`
          : '—')
        : '—',
      note: nextMilestoneRow ? nextMilestoneRow.milestone.name : 'none set',
      small: true,
    },
    { label: 'Reached', value: summary.completed, note: 'all time', tone: summary.completed ? 'good' : undefined },
  ]

  return (
    <div className="screen" id="goals-screen">
      <header className="screen-head">
        <div>
          <h1 className="screen-title">Goals</h1>
          <p className="screen-sub">
            The outcome layer. Milestones break a goal down; habits, projects and assignments do the work.
          </p>
        </div>
        <div className="head-actions">
          <button className="btn primary" onClick={() => setForm({ open: true, editing: null })}>
            <IconPlus size={16} /> New goal
          </button>
        </div>
      </header>

      <div className="stack">
        <StatStrip cells={cells} />

        <div className="seg seg-wide" role="tablist" aria-label="Goal filters">
          {[
            { id: 'open', label: `Open (${openGoals(state).length})` },
            { id: 'reached', label: `Reached (${reached.length})` },
            { id: 'all', label: `All (${goals.length})` },
          ].map((t) => (
            <button key={t.id} type="button" role="tab" aria-selected={filter === t.id}
              className={`seg-btn${filter === t.id ? ' active' : ''}`} onClick={() => setFilter(t.id)}>
              {t.label}
            </button>
          ))}
        </div>

        {ordered.length === 0 ? (
          <SectionCard>
            {filter === 'open' && goals.length === 0 ? (
              <EmptyState
                art="art/empty-goals.webp"
                icon={<IconTarget size={40} />}
                title="No goals yet"
                action={<button className="btn primary" onClick={() => setForm({ open: true, editing: null })}><IconPlus size={16} /> Set your first goal</button>}
              >
                A goal is the outcome you are actually after. Add one, break it into milestones, then link the habits and projects that move it.
              </EmptyState>
            ) : (
              <WorkEmpty icon={<IconGoals size={40} />} title="Nothing here">
                {filter === 'reached'
                  ? 'Reached goals land here once their milestones are complete.'
                  : 'Add a goal to see it in this view.'}
              </WorkEmpty>
            )}
          </SectionCard>
        ) : (
          <div className="goal-list">
            {ordered.map((goal, i) => (
              <GoalCard
                key={goal.id}
                goal={goal}
                index={i}
                today={today}
                from={from}
                onEdit={(g) => setForm({ open: true, editing: g })}
                onArchive={archive}
                onDelete={remove}
                onLinks={(g) => setLinksFor((cur) => (cur === g.id ? null : g.id))}
                linksOpen={linksFor === goal.id}
              />
            ))}
          </div>
        )}

        {/* How the layers connect — a short explanation, not a tutorial */}
        <SectionCard className="pad" delay={0.06}>
          <CardHead title="How the layers connect" />
          <div className="layer-chain">
            {[
              { label: 'Goal', note: 'the outcome and why it matters' },
              { label: 'Milestones', note: 'the checkpoints along the way' },
              { label: 'Projects · Assignments', note: 'the work with a deadline' },
              { label: 'Habits', note: 'what you repeat, daily or weekly' },
            ].map((l, i) => (
              <div key={l.label} className="layer-step">
                <span className="layer-index tnum" aria-hidden="true">{i + 1}</span>
                <div>
                  <p className="layer-label">{l.label}</p>
                  <p className="layer-note">{l.note}</p>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      <GoalFormSheet
        open={form.open}
        onClose={() => setForm({ open: false, editing: null })}
        editing={form.editing}
      />
    </div>
  )
}

/* ------------------------------------------------------------
   GOAL CARD
   ------------------------------------------------------------ */
function GoalCard({ goal, index, today, from, onEdit, onArchive, onDelete, onLinks, linksOpen }) {
  const { state, dispatch } = useStore()
  const health = goalHealth(state, goal, { now: new Date() })
  const { prog, pace, daysLeft } = health
  const area = areaOf(goal.area)
  const ms = goal.milestones || []
  const next = nextMilestone(goal)
  const actions = goalTodayActions(state, goal, { date: today })
  const pending = actions.filter((a) => !a.done)

  const linkedHabits = (goal.linkedHabitIds || [])
    .map((id) => (state.habits || []).find((h) => h.id === id))
    .filter(Boolean)
  const linkedProjects = (goal.linkedProjectIds || [])
    .map((id) => (state.projects || []).find((p) => p.id === id))
    .filter(Boolean)
  const allHabits = activeHabits(state)

  const toggleHabit = (habitId) => {
    const on = (goal.linkedHabitIds || []).includes(habitId)
    dispatch({
      type: 'UPDATE_GOAL',
      id: goal.id,
      patch: {
        linkedHabitIds: on
          ? goal.linkedHabitIds.filter((x) => x !== habitId)
          : [...(goal.linkedHabitIds || []), habitId],
      },
    })
  }
  const toggleProject = (projectId) => {
    const on = (goal.linkedProjectIds || []).includes(projectId)
    dispatch({
      type: 'UPDATE_GOAL',
      id: goal.id,
      patch: {
        linkedProjectIds: on
          ? goal.linkedProjectIds.filter((x) => x !== projectId)
          : [...(goal.linkedProjectIds || []), projectId],
      },
    })
  }
  const openProjects = (state.projects || []).filter((p) => !p.archived && !p.completedAt)

  return (
    <FadeIn delay={Math.min(index * 0.04, 0.24)}>
      <article className="goal-card" data-tone={health.tone} aria-label={`Goal ${goal.title}`}>
        <div className="goal-head">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="wrap-gap" style={{ gap: 6, marginBottom: 6 }}>
              <span className="chip">
                <span className="dot" style={{ background: `var(${area.cssVar})` }} />
                {area.label}
              </span>
              <span className="status-pill" data-tone={health.tone}>{health.label}</span>
              {daysLeft != null && (
                <span className="chip" style={{ minHeight: 22 }}>
                  <IconClock size={11} />
                  {daysLeft < 0 ? `${Math.abs(daysLeft)}d past target` : daysLeft === 0 ? 'Target is today' : `${daysLeft}d left`}
                </span>
              )}
            </div>
            <h2 className="goal-title">
              <Link to={`goals/${goal.id}`} className="goal-title-link" aria-label={`Open ${goal.title}`}>
                {goal.title}
              </Link>
            </h2>
            {goal.why && <p className="goal-why">{goal.why}</p>}
          </div>
          <div style={{ flex: 'none', textAlign: 'right' }}>
            <div className="meter-pct" style={{ fontSize: '1.65rem', lineHeight: 1 }}>{prog.pct}%</div>
            <div className="tiny muted" style={{ marginTop: 4 }}>{prog.source === 'none' ? 'nothing linked' : prog.source}</div>
          </div>
        </div>

        <div className="goal-progress">
          <Meter
            pct={prog.pct}
            tone={health.tone}
            pace={pace ? pace.expected : null}
            thick
            label={`${goal.title}: ${prog.pct}% complete${pace ? `, pace line at ${pace.expected}%` : ''}`}
          />
          <p className="goal-note">
            {health.note}
            {pace && prog.source !== 'none' && (
              <> Target {prettyDate(pace.end)}.</>
            )}
          </p>
        </div>

        {/* Milestones */}
        <div className="goal-milestones">
          <div className="row-between">
            <p className="eyebrow" style={{ margin: 0 }}>
              Milestones {ms.length > 0 && <span className="tnum">({prog.done}/{prog.total})</span>}
            </p>
            <button className="btn ghost sm" onClick={() => onLinks(goal)} aria-expanded={linksOpen}>
              <IconLink size={14} /> {linksOpen ? 'Done' : 'Link work'}
            </button>
          </div>

          {ms.length === 0 ? (
            <p className="tiny muted" style={{ marginTop: 8 }}>
              No milestones yet — open the goal to add them, or link habits and projects below.
            </p>
          ) : (
            <ul className="ms-list">
              {ms.map((m) => (
                <li key={m.id}>
                  <button
                    type="button"
                    className={`ms-row${m.done ? ' is-done' : ''}`}
                    aria-pressed={m.done}
                    onClick={() => dispatch({ type: 'TOGGLE_GOAL_MILESTONE', id: goal.id, milestoneId: m.id })}
                  >
                    <span className="ms-box" aria-hidden="true">{m.done ? <IconCheck size={13} /> : null}</span>
                    <span className="ms-name">{m.name}</span>
                    {isValidDayStr(m.targetDate) && (
                      <span className="ms-date tnum">{prettyDate(m.targetDate)}</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {linksOpen && (
            <div className="goal-links">
              <p className="field-label" style={{ marginTop: 12 }}>Habits</p>
              {allHabits.length === 0 ? (
                <p className="tiny muted">Add a habit first, then link it here.</p>
              ) : (
                <div className="wrap-gap" style={{ gap: 6 }}>
                  {allHabits.map((h) => {
                    const on = (goal.linkedHabitIds || []).includes(h.id)
                    return (
                      <button key={h.id} type="button" className="chip-btn" aria-pressed={on} onClick={() => toggleHabit(h.id)}>
                        {on && <IconCheck size={13} />}
                        {h.name}
                      </button>
                    )
                  })}
                </div>
              )}

              <p className="field-label" style={{ marginTop: 12 }}>Projects</p>
              {openProjects.length === 0 ? (
                <p className="tiny muted">No open projects yet.</p>
              ) : (
                <div className="wrap-gap" style={{ gap: 6 }}>
                  {openProjects.map((p) => {
                    const on = (goal.linkedProjectIds || []).includes(p.id)
                    return (
                      <button key={p.id} type="button" className="chip-btn" aria-pressed={on} onClick={() => toggleProject(p.id)}>
                        {on && <IconCheck size={13} />}
                        {p.name}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Linked work, always visible when it exists */}
        {(linkedHabits.length > 0 || linkedProjects.length > 0) && !linksOpen && (
          <div className="goal-linked">
            {linkedHabits.map((h) => {
              const r = habitRate(state, h, from, today)
              const streak = habitStreak(state, h)
              return (
                <Link key={h.id} to={`habits/${h.id}`} className="goal-habit">
                  <span className="dot" style={{ background: `var(${area.cssVar})` }} />
                  <span className="goal-habit-name ellipsis">{h.name}</span>
                  {streak > 1 && (
                    <span className="tiny tnum" style={{ color: 'var(--warn)', fontWeight: 700, display: 'inline-flex', gap: 3, alignItems: 'center' }}>
                      <IconFlame size={12} />{streak}d
                    </span>
                  )}
                  <span className="tiny muted tnum" style={{ flex: 'none' }}>
                    {r.rate == null ? 'no data' : `${Math.round(r.rate * 100)}% 30d`}
                  </span>
                </Link>
              )
            })}
            {linkedProjects.map((p) => (
              <Link key={p.id} to={`projects/${p.id}`} className="goal-habit">
                <span className="dot" style={{ background: 'var(--accent-1)' }} />
                <span className="goal-habit-name ellipsis">{p.name}</span>
                <span className="tiny muted tnum" style={{ flex: 'none' }}>{projectProgress(p).pct}%</span>
              </Link>
            ))}
          </div>
        )}

        {/* What this goal needs today */}
        {actions.length > 0 && (
          <p className="goal-today">
            {pending.length === 0
              ? <>Everything linked to this goal is done today.</>
              : <>Today: {pending.slice(0, 3).map((a) => a.name).join(', ')}{pending.length > 3 ? ` +${pending.length - 3} more` : ''}</>}
          </p>
        )}

        <div className="goal-foot">
          <button className="btn ghost sm" onClick={() => onEdit(goal)}><IconPencil size={14} /> Edit</button>
          {next && (
            <span className="tiny muted" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <IconChevronRight size={13} /> Next: {next.name}
            </span>
          )}
          <span style={{ flex: 1 }} />
          <button className="btn ghost sm" onClick={() => onArchive(goal)} aria-label={`Archive ${goal.title}`}><IconArchive size={15} /></button>
          <button className="btn ghost sm" style={{ color: 'var(--bad)' }} onClick={() => onDelete(goal)} aria-label={`Delete ${goal.title}`}><IconTrash size={15} /></button>
        </div>
      </article>
    </FadeIn>
  )
}

/* ------------------------------------------------------------
   GOAL FORM
   ------------------------------------------------------------ */
function GoalFormSheet({ open, onClose, editing }) {
  const { dispatch } = useStore()
  const [draft, setDraft] = useState(null)

  // reset the draft each time the sheet opens
  const key = `${open}-${editing?.id || 'new'}`
  const [lastKey, setLastKey] = useState('')
  if (key !== lastKey) {
    setLastKey(key)
    setDraft(editing
      ? {
          title: editing.title, why: editing.why || '', area: editing.area || 'mind',
          startDate: editing.startDate || todayStr(), targetDate: editing.targetDate || '',
          notes: editing.notes || '', status: editing.status || 'active',
          milestones: (editing.milestones || []).map((m) => ({ ...m })),
        }
      : {
          title: '', why: '', area: 'mind', startDate: todayStr(), targetDate: '',
          notes: '', status: 'active',
          milestones: [{ id: `draft-${Date.now()}`, name: '', targetDate: '', done: false, doneAt: null, order: 0 }],
        })
  }

  if (!draft) return null
  const set = (k, v) => setDraft((d) => ({ ...d, [k]: v }))

  const save = () => {
    const title = draft.title.trim()
    if (!title) return
    const patch = {
      title,
      why: draft.why.trim(),
      area: draft.area,
      startDate: isValidDayStr(draft.startDate) ? draft.startDate : todayStr(),
      targetDate: isValidDayStr(draft.targetDate) ? draft.targetDate : null,
      notes: draft.notes.trim(),
      status: draft.status,
    }
    patch.milestones = (draft.milestones || []).filter((m) => String(m.name || '').trim())
    if (editing) dispatch({ type: 'UPDATE_GOAL', id: editing.id, patch })
    else dispatch({ type: 'ADD_GOAL', goal: patch })
    onClose()
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={editing ? 'Edit goal' : 'New goal'}
      labelledBy="goal-form-title"
      footer={(
        <>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" onClick={save} disabled={!draft.title.trim()}>
            {editing ? 'Save goal' : 'Create goal'}
          </button>
        </>
      )}
    >
      <div className="stack" style={{ gap: 14 }}>
        <div>
          <label className="field-label" htmlFor="goal-title">What do you want to achieve?</label>
          <input id="goal-title" className="field" value={draft.title} maxLength={120}
            placeholder="Run a half marathon" onChange={(e) => set('title', e.target.value)} />
        </div>

        <div>
          <label className="field-label" htmlFor="goal-why">Why it matters <span style={{ color: 'var(--text-3)', fontWeight: 500 }}>(optional)</span></label>
          <input id="goal-why" className="field" value={draft.why} maxLength={200}
            placeholder="For the version of me who finishes things" onChange={(e) => set('why', e.target.value)} />
        </div>

        <div className="form-row">
          <div>
            <label className="field-label" htmlFor="goal-area">Area</label>
            <select id="goal-area" className="field" value={draft.area} onChange={(e) => set('area', e.target.value)}>
              {GOAL_AREAS.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label" htmlFor="goal-start">Started</label>
            <input id="goal-start" className="field" type="date" value={draft.startDate || ''}
              onChange={(e) => set('startDate', e.target.value)} />
          </div>
        </div>

        <div>
          <label className="field-label" htmlFor="goal-target">Target date <span style={{ color: 'var(--text-3)', fontWeight: 500 }}>(optional)</span></label>
          <input id="goal-target" className="field" type="date" value={draft.targetDate || ''}
            onChange={(e) => set('targetDate', e.target.value)} />
          <p className="tiny muted" style={{ marginTop: 6 }}>
            Without a target date there is no pace line — the goal still tracks progress, it just will not be judged.
          </p>
        </div>

        <div>
          <label className="field-label">Milestones <span style={{ color: 'var(--text-3)', fontWeight: 500 }}>(optional)</span></label>
          <p className="tiny muted" style={{ marginBottom: 8 }}>
            Checkpoints between here and the outcome. Progress is measured from these when they exist.
          </p>
          <div className="ms-editor">
            {draft.milestones.map((m, i) => (
              <div key={m.id} className="ms-editor-row">
                <input
                  className="field"
                  value={m.name}
                  maxLength={120}
                  placeholder={i === 0 ? 'Finish a first draft' : 'Next checkpoint'}
                  aria-label={`Milestone ${i + 1} name`}
                  onChange={(e) => setDraft((d) => ({
                    ...d,
                    milestones: d.milestones.map((x) => (x.id === m.id ? { ...x, name: e.target.value } : x)),
                  }))}
                />
                <input
                  className="field"
                  type="date"
                  value={m.targetDate || ''}
                  aria-label={`Milestone ${i + 1} target date`}
                  onChange={(e) => setDraft((d) => ({
                    ...d,
                    milestones: d.milestones.map((x) => (x.id === m.id ? { ...x, targetDate: e.target.value } : x)),
                  }))}
                />
                <button
                  type="button"
                  className="btn ghost icon"
                  aria-label={`Remove milestone ${i + 1}`}
                  onClick={() => setDraft((d) => ({ ...d, milestones: d.milestones.filter((x) => x.id !== m.id) }))}
                >
                  <IconTrash size={15} />
                </button>
              </div>
            ))}
            <button
              type="button"
              className="btn ghost sm"
              onClick={() => setDraft((d) => ({
                ...d,
                milestones: [...d.milestones, {
                  id: `draft-${Date.now()}-${d.milestones.length}`,
                  name: '', targetDate: '', done: false, doneAt: null, order: d.milestones.length,
                }],
              }))}
            >
              <IconPlus size={14} /> Add milestone
            </button>
          </div>
        </div>

        {editing && (
          <div>
            <label className="field-label" htmlFor="goal-status">Status</label>
            <select id="goal-status" className="field" value={draft.status} onChange={(e) => set('status', e.target.value)}>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="completed">Completed</option>
            </select>
          </div>
        )}

        <div>
          <label className="field-label" htmlFor="goal-notes">Notes <span style={{ color: 'var(--text-3)', fontWeight: 500 }}>(optional)</span></label>
          <textarea id="goal-notes" className="field textarea" rows={3} value={draft.notes} maxLength={2000}
            onChange={(e) => set('notes', e.target.value)} />
        </div>
      </div>
    </Sheet>
  )
}
