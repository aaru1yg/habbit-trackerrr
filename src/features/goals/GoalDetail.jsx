/* ============================================================
   GOAL DETAIL — and the one place where the three systems
   actually meet: link habits and work, see the contribution of
   each, in the same view.
   ============================================================ */
import { useMemo, useState } from 'react'
import { useRoute, Link } from '../../app/router.jsx'
import { useStore, useActions } from '../../core/store.jsx'
import { goalProgress, consistency, workProgress, workStatus, streak } from '../../core/compute.js'
import { fmtRelative, daysUntil, fmtLong } from '../../core/date.js'
import {
  Surface, Panel, Button, Badge, Bar, Ring, Empty, Confirm, IconButton, Num, Chip, Sheet, plural,
} from '../../ui/index.jsx'
import {
  IconBack, IconEdit, IconTrash, IconCheck, IconX, IconHabits, IconWork, IconLink, IconChevron, IconLayers,
} from '../../ui/icons.jsx'
import GoalForm from './GoalForm.jsx'

export default function GoalDetail() {
  const { id, go, back } = useRoute()
  const state = useStore()
  const actions = useActions()
  const [editing, setEditing] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [linking, setLinking] = useState(false)

  const goal = state.goals.find((g) => g.id === id)
  const p = useMemo(() => (goal ? goalProgress(goal, state) : null), [goal, state])

  if (!goal) {
    return (
      <Surface variant="flat" className="d1">
        <Empty title="Goal not found" action={<Button onClick={() => go('goals')}>Back to goals</Button>} />
      </Surface>
    )
  }

  const left = goal.due ? daysUntil(goal.due) : null
  const unlinkedHabits = state.habits.filter((h) => !h.archivedAt && !goal.habitIds.includes(h.id))
  const unlinkedWork = state.work.filter((w) => !w.archivedAt && w.goalId !== goal.id)

  return (
    <div className="stack stack--loose">
      <div className="row">
        <Button variant="ghost" size="sm" icon={<IconBack size={16} />} onClick={() => back('goals')}>Goals</Button>
      </div>

      {/* ---------- Head ---------- */}
      <Surface variant="lit" className="detail__head rise d2" style={{ '--i': 0 }}>
        <Ring value={goal.doneAt ? 100 : p.percent} size={94} stroke={9}>
          <span className="num" style={{ fontSize: 22, fontWeight: 740, fontFamily: 'var(--font-display)' }}>
            {goal.doneAt ? '✓' : <><Num value={p.percent} />%</>}
          </span>
        </Ring>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="detail__title">{goal.title}</div>
          <div className="row row--wrap" style={{ marginTop: 'var(--s2)' }}>
            {goal.doneAt && <Badge tone="good">Reached {fmtRelative(goal.doneAt)}</Badge>}
            {goal.due && (
              <Badge tone={left < 0 ? 'bad' : left < 14 ? 'warn' : 'neutral'}>
                {Math.abs(left) <= 30 ? fmtRelative(goal.due) : fmtLong(goal.due)}
              </Badge>
            )}
            <Badge tone="neutral">{plural(p.linkedHabits.length, 'habit')} · {plural(p.linkedWork.length, 'work item')}</Badge>
          </div>
          {goal.why && <p className="small muted" style={{ marginTop: 'var(--s3)', whiteSpace: 'pre-wrap' }}>{goal.why}</p>}
        </div>
        <div className="row" style={{ gap: 4, flex: 'none' }}>
          <IconButton label="Edit" icon={<IconEdit size={17} />} onClick={() => setEditing(true)} />
          <IconButton label="Delete" icon={<IconTrash size={17} />} onClick={() => setConfirming(true)} />
        </div>
      </Surface>

      {/* ---------- How it's computed ---------- */}
      <Panel
        title="Where this number comes from"
        sub="A goal has no progress of its own — it is the average of what you linked to it"
        className="rise"
        style={{ '--i': 1 }}
      >
        {p.empty ? (
          <Empty
            title="Nothing linked yet"
            body="Link the habits you're relying on and the projects that have to ship. Until then there is honestly nothing to measure."
            action={<Button variant="primary" icon={<IconLink size={16} />} onClick={() => setLinking(true)}>Link something</Button>}
          />
        ) : (
          <div className="stack stack--tight">
            {p.parts.map((part) => (
              <div key={part.kind} className="row" style={{ gap: 'var(--s3)' }}>
                <span className="small" style={{ width: 130 }}>
                  {part.kind === 'habits' ? '30-day consistency' : 'Work completion'}
                </span>
                <Bar value={part.value} className="spacer" />
                <span className="small num strong" style={{ width: 46, textAlign: 'right' }}>{Math.round(part.value)}%</span>
              </div>
            ))}
          </div>
        )}
      </Panel>

      {/* ---------- Mark reached ---------- */}
      <Surface variant="flat" className="rise d1" style={{ '--i': 2, padding: 'var(--s4)' }}>
        <div className="row row--between row--wrap">
          <div>
            <div className="strong">{goal.doneAt ? 'Reached' : 'Mark as reached'}</div>
            <div className="tiny dim">You decide when a goal is met — the percentage is a signal, not a judge.</div>
          </div>
          <Button
            variant={goal.doneAt ? 'ghost' : 'primary'}
            icon={goal.doneAt ? <IconX size={16} /> : <IconCheck size={16} />}
            onClick={() => actions.completeGoal(goal.id)}
          >
            {goal.doneAt ? 'Reopen' : 'Reached it'}
          </Button>
        </div>
      </Surface>

      {/* ---------- Linked habits ---------- */}
      <Panel
        title="Habits"
        sub={p.linkedHabits.length ? 'Their 30-day consistency feeds this goal' : 'None linked'}
        className="rise"
        style={{ '--i': 3 }}
        action={<Button size="sm" icon={<IconLink size={14} />} onClick={() => setLinking(true)}>Link</Button>}
      >
        {p.linkedHabits.length === 0 ? (
          <p className="small dim">No habits linked yet.</p>
        ) : (
          <div className="stack stack--tight">
            {p.linkedHabits.map((h) => {
              const c = consistency(h, state.checkins, 30)
              const st = streak(h, state.checkins)
              return (
                <div key={h.id} className="row" style={{ gap: 'var(--s3)' }}>
                  <span style={{ width: 22, textAlign: 'center' }}>{h.icon}</span>
                  <Link to={`habit/${h.id}`} className="small clamp1" style={{ flex: '0 0 30%', minWidth: 0 }}>{h.name}</Link>
                  <Bar value={c.rate * 100} thin className="spacer" />
                  <span className="tiny num dim" style={{ width: 40, textAlign: 'right' }}>{Math.round(c.rate * 100)}%</span>
                  <span className="tiny num" style={{ width: 40, textAlign: 'right', color: st.current ? '#ff8a4c' : 'var(--t4)' }}>🔥{st.current}</span>
                  <IconButton label={`Unlink ${h.name}`} icon={<IconX size={14} />} onClick={() => actions.linkHabit(goal.id, h.id)} />
                </div>
              )
            })}
          </div>
        )}
      </Panel>

      {/* ---------- Linked work ---------- */}
      <Panel
        title="Work"
        sub={p.linkedWork.length ? 'Completion of these feeds this goal' : 'None linked'}
        className="rise"
        style={{ '--i': 4 }}
        action={<Button size="sm" icon={<IconLink size={14} />} onClick={() => setLinking(true)}>Link</Button>}
      >
        {p.linkedWork.length === 0 ? (
          <p className="small dim">No projects or tasks linked yet.</p>
        ) : (
          <div className="stack stack--tight">
            {p.linkedWork.map((w) => {
              const st = workStatus(w)
              return (
                <Link key={w.id} to={`work/${w.id}`} className="erow">
                  <span className="erow__icon">{w.kind === 'project' ? <IconLayers size={16} /> : <IconWork size={16} />}</span>
                  <div className="erow__main">
                    <span className="erow__title">{w.title}</span>
                    <div className="erow__meta">
                      <Badge tone={st.tone}>{st.label}</Badge>
                      <span className="num">{workProgress(w)}%</span>
                    </div>
                  </div>
                  <IconChevron size={16} />
                </Link>
              )
            })}
          </div>
        )}
      </Panel>

      {/* ---------- Link picker ---------- */}
      <LinkSheet
        open={linking}
        onClose={() => setLinking(false)}
        goal={goal}
        habits={unlinkedHabits}
        work={unlinkedWork}
        onHabit={(hid) => actions.linkHabit(goal.id, hid)}
        onWork={(wid) => actions.linkWork(goal.id, wid)}
      />

      <GoalForm open={editing} onClose={() => setEditing(false)} goal={goal} />
      <Confirm
        open={confirming}
        title={`Delete “${goal.title}”?`}
        body="The goal is removed. Your habits and work are kept — they are just unlinked."
        onConfirm={() => { actions.removeGoal(goal.id); go('goals') }}
        onClose={() => setConfirming(false)}
      />
    </div>
  )
}

/* The one picker. Both sides of the link live in the same sheet
   so you can see the whole goal being assembled at once. */
function LinkSheet({ open, onClose, habits, work, onHabit, onWork }) {
  const nothing = habits.length === 0 && work.length === 0
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Link to this goal"
      footer={<Button variant="primary" onClick={onClose}>Done</Button>}
    >
      {nothing ? (
        <Empty title="Everything is already linked" body="Create a new habit or project first, then come back." />
      ) : (
        <div className="stack">
          {habits.length > 0 && (
            <div>
              <div className="eyebrow" style={{ marginBottom: 'var(--s3)' }}><IconHabits size={12} /> Habits</div>
              <div className="pill-row">
                {habits.map((h) => (
                  <Chip key={h.id} onClick={() => onHabit(h.id)}>{h.icon} {h.name}</Chip>
                ))}
              </div>
            </div>
          )}
          {work.length > 0 && (
            <div>
              <div className="eyebrow" style={{ marginBottom: 'var(--s3)' }}><IconWork size={12} /> Work</div>
              <div className="pill-row">
                {work.map((w) => (
                  <Chip key={w.id} onClick={() => onWork(w.id)}>
                    {w.kind === 'project' ? <IconLayers size={13} /> : <IconWork size={13} />} {w.title}
                  </Chip>
                ))}
              </div>
            </div>
          )}
          <p className="tiny faint">
            Linking a work item moves it here from any other goal — a project belongs to one outcome at a time.
          </p>
        </div>
      )}
    </Sheet>
  )
}
