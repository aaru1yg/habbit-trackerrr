/* ============================================================
   WORK — one screen for everything you finish.

   v4 had five routes for this (Work, Projects, Assignments,
   Workload, Deadlines/Timeline) over two entity types that
   behaved almost identically. One entity, one screen, two views:
   the board, and the timeline that answers "what lands when".
   ============================================================ */
import { useMemo, useState } from 'react'
import { useStore } from '../../core/store.jsx'
import {
  workProgress, workStatus, sortByUrgency, dueByDay, 
} from '../../core/compute.js'
import { today, shift, fmtRelative, dayOf, countdown } from '../../core/date.js'
import {
  Surface, Panel, Button, Segmented, Chip, Empty, SectionHead, Badge, Columns, Num,
} from '../../ui/index.jsx'
import { IconPlus, IconWork, IconLayers, IconChevron } from '../../ui/icons.jsx'
import { Link } from '../../app/router.jsx'
import WorkCard from './WorkCard.jsx'
import WorkForm from './WorkForm.jsx'

const VIEWS = [
  { value: 'board', label: 'Board' },
  { value: 'timeline', label: 'Timeline' },
]

const FILTERS = [
  { id: 'open', label: 'Open' },
  { id: 'project', label: 'Projects' },
  { id: 'task', label: 'Tasks' },
  { id: 'risk', label: 'Needs attention' },
  { id: 'done', label: 'Done' },
]

export default function WorkScreen() {
  const { work } = useStore()
  const [view, setView] = useState('board')
  const [filter, setFilter] = useState('open')
  const [adding, setAdding] = useState(false)
  const [kind, setKind] = useState('task')

  const live = work.filter((w) => !w.archivedAt)

  const summary = useMemo(() => {
    const open = live.filter((w) => !w.doneAt)
    const counts = { overdue: 0, urgent: 0, atRisk: 0, onTrack: 0, open: 0 }
    for (const w of open) counts[workStatus(w).id]++
    return { open, counts, done: live.filter((w) => w.doneAt).length }
  }, [live])

  const filtered = useMemo(() => {
    let list = live
    if (filter === 'open') list = list.filter((w) => !w.doneAt)
    if (filter === 'done') list = list.filter((w) => w.doneAt)
    if (filter === 'project') list = list.filter((w) => w.kind === 'project' && !w.doneAt)
    if (filter === 'task') list = list.filter((w) => w.kind === 'task' && !w.doneAt)
    if (filter === 'risk') list = list.filter((w) => !w.doneAt && workStatus(w).rank <= 2)
    return sortByUrgency(list)
  }, [live, filter])

  const start = (k) => { setKind(k); setAdding(true) }

  if (!work.length) {
    return (
      <>
        <Surface variant="flat" className="d1">
          <Empty
            icon={<IconWork size={24} />}
            title="Nothing to finish yet"
            body="Work is anything with an end: a one-off task, or a project with a checklist. Add one and its status is computed from your real progress against its deadline."
            action={
              <div className="row">
                <Button variant="primary" icon={<IconPlus size={16} />} onClick={() => start('task')}>Add a task</Button>
                <Button icon={<IconLayers size={16} />} onClick={() => start('project')}>Add a project</Button>
              </div>
            }
          />
        </Surface>
        <WorkForm open={adding} onClose={() => setAdding(false)} defaultKind={kind} />
      </>
    )
  }

  return (
    <div className="stack stack--loose">
      <SectionHead
        eyebrow="Finish"
        title="Work"
        sub={`${summary.open.length} open · ${summary.done} done`}
        action={
          <div className="row">
            <Segmented options={VIEWS} value={view} onChange={setView} label="Work view" />
            <Button variant="primary" size="sm" icon={<IconPlus size={15} />} onClick={() => start('task')}>New</Button>
          </div>
        }
      />

      <PressureStrip counts={summary.counts} onPick={setFilter} />

      {view === 'board' ? (
        <>
          <div className="pill-row rise" style={{ '--i': 1 }}>
            {FILTERS.map((f) => (
              <Chip key={f.id} on={filter === f.id} onClick={() => setFilter(f.id)}>{f.label}</Chip>
            ))}
          </div>

          {filtered.length === 0 ? (
            <Surface variant="flat" className="d1">
              <Empty title="Nothing here" body="Try a different filter." />
            </Surface>
          ) : (
            <div className="grid grid--2 rise" style={{ '--i': 2 }}>
              {filtered.map((w) => <WorkCard key={w.id} item={w} depth={1} />)}
            </div>
          )}
        </>
      ) : (
        <Timeline work={live} />
      )}

      <WorkForm open={adding} onClose={() => setAdding(false)} defaultKind={kind} />
    </div>
  )
}

/* ---------------- Pressure strip -------------------------- */

function PressureStrip({ counts, onPick }) {
  const cells = [
    { id: 'risk', label: 'Overdue', n: counts.overdue, tone: 'bad' },
    { id: 'risk', label: 'Urgent', n: counts.urgent, tone: 'risk' },
    { id: 'risk', label: 'At risk', n: counts.atRisk, tone: 'warn' },
    { id: 'open', label: 'On track', n: counts.onTrack + counts.open, tone: 'good' },
  ]
  return (
    <div className="grid grid--4 rise" style={{ '--i': 0 }}>
      {cells.map((c, _i) => (
        <Surface
          key={c.label}
          as="button"
          variant="flat"
          lift
          sheen
          depth={1}
          className="tile"
          onClick={() => onPick(c.id)}
          style={{ textAlign: 'left', cursor: 'pointer' }}
        >
          <div className="stat stat--sm">
            <span className="stat__v num" style={{ color: c.n ? toneColor(c.tone) : 'var(--t4)' }}>
              <Num value={c.n} />
            </span>
            <span className="stat__k">{c.label}</span>
          </div>
        </Surface>
      ))}
    </div>
  )
}

const toneColor = (t) => ({ good: '#2fd6a6', warn: '#ffd24c', risk: '#ff8a4c', bad: '#ff5a72' }[t])

/* ============================================================
   TIMELINE — the workload answer. Every deadline, soonest
   first, plus a 14-day bar of what lands when.
   ============================================================ */

function Timeline({ work }) {
  const days = useMemo(() => Array.from({ length: 14 }, (_, i) => shift(today(), i)), [])
  const load = useMemo(() => dueByDay(work, days), [work, days])

  const dated = useMemo(
    () => sortByUrgency(work.filter((w) => !w.doneAt && w.deadline)),
    [work]
  )
  const undated = work.filter((w) => !w.doneAt && !w.deadline)

  const grouped = useMemo(() => {
    const map = new Map()
    for (const w of dated) {
      const d = dayOf(w.deadline)
      if (!map.has(d)) map.set(d, [])
      map.get(d).push(w)
    }
    return [...map.entries()]
  }, [dated])

  return (
    <div className="stack">
      <Panel
        title="Next 14 days"
        sub={load.some((l) => l.items.length) ? 'Each bar is how much is due that day' : 'Nothing is due in the next two weeks'}
        className="rise"
        style={{ '--i': 1 }}
      >
        <Columns
          data={load.map((l) => ({ value: l.items.length, title: `${l.day}: ${l.items.length} due` }))}
          labels={load.map((l, i) => (i % 2 === 0 ? l.day.slice(8) : ''))}
          height={90}
        />
      </Panel>

      {grouped.length === 0 ? (
        <Surface variant="flat" className="d1">
          <Empty title="No deadlines set" body="Work without a deadline still shows on the board — it just has nothing to be late for." />
        </Surface>
      ) : (
        <Panel title="Every deadline" sub="Soonest first" className="rise" style={{ '--i': 2 }}>
          <div className="lane">
            {grouped.map(([d, items]) => (
              <div key={d} className="lane__day">
                <span className="lane__when" data-soon={d <= shift(today(), 2)}>{fmtRelative(d)}</span>
                <div className="stack stack--tight">
                  {items.map((w) => {
                    const st = workStatus(w)
                    return (
                      <Link key={w.id} to={`work/${w.id}`} className="erow">
                        <span className="erow__icon">{w.kind === 'project' ? <IconLayers size={16} /> : <IconWork size={16} />}</span>
                        <div className="erow__main">
                          <span className="erow__title">{w.title}</span>
                          <div className="erow__meta">
                            <Badge tone={st.tone}>{st.label}</Badge>
                            <span className="num">{workProgress(w)}%</span>
                            <span>{countdown(w.deadline)}</span>
                          </div>
                        </div>
                        <IconChevron size={16} />
                      </Link>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {undated.length > 0 && (
        <Panel title="No deadline" sub={`${undated.length} item${undated.length === 1 ? '' : 's'}`} className="rise" style={{ '--i': 3 }}>
          <div className="stack stack--tight">
            {undated.map((w) => (
              <Link key={w.id} to={`work/${w.id}`} className="erow">
                <span className="erow__icon">{w.kind === 'project' ? <IconLayers size={16} /> : <IconWork size={16} />}</span>
                <div className="erow__main">
                  <span className="erow__title">{w.title}</span>
                  <div className="erow__meta"><span className="num">{workProgress(w)}%</span></div>
                </div>
                <IconChevron size={16} />
              </Link>
            ))}
          </div>
        </Panel>
      )}
    </div>
  )
}
