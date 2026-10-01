/* ============================================================
   WORK DETAIL — checklist, pace, and the progress log.
   ============================================================ */
import { useMemo, useState } from 'react'
import { useRoute, Link } from '../../app/router.jsx'
import { useStore, useActions } from '../../core/store.jsx'
import { workProgress, workStatus, pace, minutesLogged } from '../../core/compute.js'
import { lastDays, fmtMoment, fmtRelative, fmtMins, countdown, dayOf } from '../../core/date.js'
import {
  Surface, Panel, Button, Badge, Bar, Ring, Empty, Confirm, IconButton,
  Input, Field, Spark, Num, Stepper, useToast, 
} from '../../ui/index.jsx'
import {
  IconBack, IconEdit, IconTrash, IconArchive, IconPlus, IconCheck, IconX, IconGoals, IconClock,
} from '../../ui/icons.jsx'
import WorkForm from './WorkForm.jsx'

export default function WorkDetail() {
  const { id, go, back } = useRoute()
  const { work, goals } = useStore()
  const actions = useActions()
  const toast = useToast()
  const [editing, setEditing] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [taskInput, setTaskInput] = useState('')
  const [logPct, setLogPct] = useState(0)
  const [logMins, setLogMins] = useState(30)

  const item = work.find((w) => w.id === id)

  const derived = useMemo(() => {
    if (!item) return null
    const days = lastDays(30)
    return {
      pct: workProgress(item),
      st: workStatus(item),
      pc: pace(item),
      mins30: minutesLogged(item, days),
      series: buildSeries(item, days),
      hasTimeLog: item.log.some((e) => e.minutes),
    }
  }, [item])

  if (!item) {
    return (
      <Surface variant="flat" className="d1">
        <Empty title="Not found" body="This item may have been deleted." action={<Button onClick={() => go('work')}>Back to work</Button>} />
      </Surface>
    )
  }

  const goal = goals.find((g) => g.id === item.goalId)
  const isProject = item.kind === 'project'
  const doneTasks = item.tasks.filter((t) => t.done).length

  const addTask = () => {
    const t = taskInput.trim()
    if (!t) return
    actions.addTask(item.id, t)
    setTaskInput('')
  }

  return (
    <div className="stack stack--loose">
      <div className="row">
        <Button variant="ghost" size="sm" icon={<IconBack size={16} />} onClick={() => back('work')}>Work</Button>
      </div>

      {/* ---------- Head ---------- */}
      <Surface variant="lit" className="detail__head rise d2" style={{ '--i': 0 }}>
        <Ring value={derived.pct} size={88} stroke={8} tone={derived.st.tone === 'accent' ? undefined : derived.st.tone}>
          <span className="num" style={{ fontSize: 20, fontWeight: 740, fontFamily: 'var(--font-display)' }}>
            <Num value={derived.pct} />%
          </span>
        </Ring>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="detail__title">{item.title}</div>
          <div className="row row--wrap" style={{ marginTop: 'var(--s2)' }}>
            <Badge tone={derived.st.tone}>{derived.st.label}</Badge>
            <Badge tone="neutral">{isProject ? 'Project' : 'Task'}</Badge>
            {item.deadline && (
              <Badge tone="neutral"><IconClock size={11} /> {fmtMoment(item.deadline)} · {countdown(item.deadline)}</Badge>
            )}
            {goal && <Link to={`goal/${goal.id}`} className="badge badge--accent"><IconGoals size={11} /> {goal.title}</Link>}
            {item.archivedAt && <Badge tone="warn">Archived</Badge>}
          </div>
          {item.notes && <p className="small muted" style={{ marginTop: 'var(--s3)', whiteSpace: 'pre-wrap' }}>{item.notes}</p>}
        </div>

        <div className="row" style={{ gap: 4, flex: 'none' }}>
          <IconButton label="Edit" icon={<IconEdit size={17} />} onClick={() => setEditing(true)} />
          <IconButton label={item.archivedAt ? 'Unarchive' : 'Archive'} icon={<IconArchive size={17} />} onClick={() => actions.archiveWork(item.id)} />
          <IconButton label="Delete" icon={<IconTrash size={17} />} onClick={() => setConfirming(true)} />
        </div>
      </Surface>

      {/* ---------- Complete ---------- */}
      <Surface variant="flat" className="rise d1" style={{ '--i': 1, padding: 'var(--s4)' }}>
        <div className="row row--between row--wrap">
          <div>
            <div className="strong">{item.doneAt ? 'Completed' : 'Mark as finished'}</div>
            <div className="tiny dim">
              {item.doneAt ? `Done ${fmtMoment(item.doneAt)}` : isProject && item.tasks.length ? 'Or tick every task below' : 'When it is genuinely finished'}
            </div>
          </div>
          <Button
            variant={item.doneAt ? 'ghost' : 'primary'}
            icon={item.doneAt ? <IconX size={16} /> : <IconCheck size={16} />}
            onClick={() => { actions.completeWork(item.id); toast(item.doneAt ? 'Reopened' : 'Finished 🚀', item.doneAt ? 'info' : 'good') }}
          >
            {item.doneAt ? 'Reopen' : 'Mark done'}
          </Button>
        </div>
      </Surface>

      {/* ---------- Pace ---------- */}
      {derived.pc && (
        <Panel
          title="Pace"
          sub={paceLine(derived.pc)}
          className="rise"
          style={{ '--i': 2 }}
        >
          <div className="stack stack--tight">
            <div className="row row--between tiny dim"><span>Your progress</span><span className="num">{derived.pc.actual}%</span></div>
            <Bar value={derived.pc.actual} tone={derived.pc.delta < 0 ? 'warn' : 'good'} />
            <div className="row row--between tiny dim" style={{ marginTop: 6 }}><span>An even pace by now</span><span className="num">{derived.pc.expected}%</span></div>
            <Bar value={derived.pc.expected} thin tone="ghost" />
          </div>
        </Panel>
      )}

      {/* ---------- Checklist ---------- */}
      {isProject && (
        <Panel
          title="Checklist"
          sub={item.tasks.length ? `${doneTasks} of ${item.tasks.length} done — this is what drives the percentage` : 'Add tasks and progress becomes automatic'}
          className="rise"
          style={{ '--i': 3 }}
        >
          <div className="checklist">
            {item.tasks.map((t) => (
              <div key={t.id} className="ctask" data-done={t.done}>
                <button
                  type="button"
                  className="ctask__box"
                  role="checkbox"
                  aria-checked={t.done}
                  aria-label={`Toggle ${t.title}`}
                  onClick={() => actions.toggleTask(item.id, t.id)}
                >
                  <IconCheck size={13} />
                </button>
                <span className="ctask__t">{t.title}</span>
                {t.due && <span className="tiny faint">{fmtRelative(t.due)}</span>}
                <IconButton label={`Remove ${t.title}`} icon={<IconX size={14} />} onClick={() => actions.removeTask(item.id, t.id)} />
              </div>
            ))}
          </div>

          <div className="row" style={{ marginTop: 'var(--s3)' }}>
            <Input
              value={taskInput}
              onChange={(e) => setTaskInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addTask()}
              placeholder="Add a task and press Enter"
              maxLength={140}
            />
            <Button icon={<IconPlus size={16} />} onClick={addTask} iconOnly aria-label="Add task" />
          </div>
        </Panel>
      )}

      {/* ---------- Manual progress (tasks win when present) ---------- */}
      {(!isProject || !item.tasks.length) && !item.doneAt && (
        <Panel title="Progress" sub="Set it honestly — nothing here is guessed for you" className="rise" style={{ '--i': 4 }}>
          <div className="row row--wrap" style={{ gap: 'var(--s2)' }}>
            {[0, 10, 25, 50, 75, 90, 100].map((p) => (
              <Button
                key={p}
                size="sm"
                variant={derived.pct === p ? 'primary' : undefined}
                onClick={() => actions.updateWork(item.id, { manual: p })}
              >
                {p}%
              </Button>
            ))}
          </div>
        </Panel>
      )}

      {/* ---------- Log ---------- */}
      <Panel
        title="Log"
        sub={derived.hasTimeLog ? `${fmtMins(derived.mins30)} in the last 30 days` : 'Record time spent or a progress reading'}
        className="rise"
        style={{ '--i': 5 }}
      >
        <div className="row row--wrap" style={{ gap: 'var(--s4)', marginBottom: 'var(--s4)' }}>
          <Field label="Minutes">
            <Stepper value={logMins} onChange={setLogMins} min={0} max={600} step={15} suffix="min" />
          </Field>
          <Field label="Progress">
            <Stepper value={logPct} onChange={setLogPct} min={0} max={100} step={5} suffix="%" />
          </Field>
          <div style={{ alignSelf: 'flex-end' }}>
            <Button
              variant="primary"
              onClick={() => {
                actions.logWork(item.id, { minutes: logMins || null, percent: logPct || null })
                toast('Logged')
              }}
              disabled={!logMins && !logPct}
            >
              Add entry
            </Button>
          </div>
        </div>

        {item.log.length > 0 && derived.series.some((v) => v > 0) && (
          <div style={{ marginBottom: 'var(--s4)' }}>
            <div className="eyebrow" style={{ marginBottom: 6 }}>Minutes · last 30 days</div>
            <Spark points={derived.series} height={70} />
          </div>
        )}

        {item.log.length === 0 ? (
          <p className="small dim">Nothing logged yet. Entries you add here feed the chart above — and nothing else invents data for you.</p>
        ) : (
          <div className="stack stack--tight">
            {[...item.log].reverse().slice(0, 12).map((e, i) => (
              <div key={i} className="row row--between small">
                <span className="dim">{fmtMoment(e.at)}</span>
                <span className="row num" style={{ gap: 'var(--s3)' }}>
                  {e.minutes != null && <span>{fmtMins(e.minutes)}</span>}
                  {e.percent != null && <span className="strong">{e.percent}%</span>}
                </span>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <WorkForm open={editing} onClose={() => setEditing(false)} item={item} />
      <Confirm
        open={confirming}
        title={`Delete “${item.title}”?`}
        body="This removes the item, its checklist and its log. There is no undo."
        onConfirm={() => { actions.removeWork(item.id); go('work') }}
        onClose={() => setConfirming(false)}
      />
    </div>
  )
}

function buildSeries(item, days) {
  const byDay = Object.fromEntries(days.map((d) => [d, 0]))
  for (const e of item.log) {
    const d = dayOf(e.at)
    if (d in byDay && e.minutes) byDay[d] += e.minutes
  }
  return days.map((d) => byDay[d])
}

function paceLine(p) {
  if (p.delta === 0) return 'Exactly on pace.'
  if (p.delta > 0) return `${p.delta} points ahead of an even pace.`
  return `${Math.abs(p.delta)} points behind an even pace.`
}
