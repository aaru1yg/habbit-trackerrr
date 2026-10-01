/* ============================================================
   GOALS — the layer that ties habits and work together.

   A goal has no progress of its own. It is the average of the
   things linked to it, so it can never be "80% done" while every
   habit under it is being skipped.
   ============================================================ */
import { useMemo, useState } from 'react'
import { Link } from '../../app/router.jsx'
import { useStore } from '../../core/store.jsx'
import { goalProgress } from '../../core/compute.js'
import { fmtRelative, daysUntil } from '../../core/date.js'
import {
  Surface, Button, Badge, Empty, SectionHead, Ring, plural,
} from '../../ui/index.jsx'
import { IconPlus, IconGoals, IconHabits, IconWork, IconCheck } from '../../ui/icons.jsx'
import GoalForm from './GoalForm.jsx'

export default function GoalsScreen() {
  const state = useStore()
  const [adding, setAdding] = useState(false)

  const { goals } = state
  const rows = useMemo(
    () => goals.map((g) => ({ goal: g, p: goalProgress(g, state) })),
    [goals, state]
  )
  const open = rows.filter((r) => !r.goal.doneAt)
  const done = rows.filter((r) => r.goal.doneAt)

  if (!goals.length) {
    return (
      <>
        <Surface variant="flat" className="d1">
          <Empty
            icon={<IconGoals size={24} />}
            title="No goals yet"
            body="A goal is the outcome your habits and projects are for. Link a few of each and this screen shows whether they are actually moving it."
            action={<Button variant="primary" icon={<IconPlus size={16} />} onClick={() => setAdding(true)}>Set a goal</Button>}
          />
        </Surface>
        <GoalForm open={adding} onClose={() => setAdding(false)} />
      </>
    )
  }

  return (
    <div className="stack stack--loose">
      <SectionHead
        eyebrow="Aim"
        title="Goals"
        sub={`${open.length} in progress${done.length ? ` · ${done.length} reached` : ''}`}
        action={<Button variant="primary" size="sm" icon={<IconPlus size={15} />} onClick={() => setAdding(true)}>New</Button>}
      />

      <div className="grid grid--2 rise" style={{ '--i': 0 }}>
        {open.map(({ goal, p }) => <GoalCard key={goal.id} goal={goal} p={p} />)}
      </div>

      {done.length > 0 && (
        <section className="rise" style={{ '--i': 1 }}>
          <SectionHead title="Reached" />
          <div className="grid grid--2">
            {done.map(({ goal, p }) => <GoalCard key={goal.id} goal={goal} p={p} />)}
          </div>
        </section>
      )}

      <GoalForm open={adding} onClose={() => setAdding(false)} />
    </div>
  )
}

function GoalCard({ goal, p }) {
  const left = goal.due ? daysUntil(goal.due) : null
  return (
    <Surface as={Link} to={`goal/${goal.id}`} variant="flat" lift sheen depth={1} className="wcard">
      <div className="wcard__top">
        <Ring value={goal.doneAt ? 100 : p.percent} size={60} stroke={6}>
          <span className="num tiny strong row" style={{ justifyContent: 'center' }}>{goal.doneAt ? <IconCheck size={16} /> : `${p.percent}%`}</span>
        </Ring>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="wcard__title clamp2">{goal.title}</div>
          {goal.why && <div className="tiny dim clamp2" style={{ marginTop: 3 }}>{goal.why}</div>}
        </div>
      </div>

      {p.empty ? (
        <p className="tiny faint">Nothing linked yet. Add habits or work to give this a real number.</p>
      ) : (
        <div className="pill-row">
          {p.parts.map((part) => (
            <span key={part.kind} className="badge badge--neutral">
              {part.kind === 'habits' ? <IconHabits size={11} /> : <IconWork size={11} />}
              {part.kind === 'habits' ? plural(part.count, 'habit') : plural(part.count, 'work item')} · {Math.round(part.value)}%
            </span>
          ))}
        </div>
      )}

      <div className="wcard__foot">
        {goal.doneAt
          ? <Badge tone="good">Reached</Badge>
          : left == null
            ? <span className="faint">No target date</span>
            : <Badge tone={left < 0 ? 'bad' : left < 14 ? 'warn' : 'neutral'}>{left < 0 ? '' : 'Due '}{fmtRelative(goal.due)}</Badge>}
      </div>
    </Surface>
  )
}
