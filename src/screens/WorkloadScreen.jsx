/* ============================================================
   WORKLOAD — "How much work is coming?" (§73)
   Looks ahead so overloaded days are visible before they hurt.
   ============================================================ */
import { useMemo, useState } from 'react'
import { useStore } from '../store.jsx'
import { WorkTabs } from '../components/layout/Navigation.jsx'
import { StatStrip, WorkEmpty, Meter, StatusPill, KindTag, FadeIn } from '../components/work/WorkKit.jsx'
import { WorkRow } from '../components/work/WorkCards.jsx'
import SectionCard, { CardHead } from '../components/ui/SectionCard.jsx'
import { LoadBars, LoadColumns } from '../components/charts/workCharts.jsx'
import DeadlineLanes from '../components/work/DeadlineLanes.jsx'
import {
  workloadSummary, workloadSeries, projectsSummary, assignmentsSummary, priorityWork, sortWorkRows,
  deadlineLanes,
} from '../lib/work.js'
import { todayStr, addDaysStr, weekDays, shortDate, weekdayShort, minutesLabel, prettyDate } from '../lib/dates.js'
import { IconWorkload, IconPlus, IconAlert } from '../lib/icons.jsx'
import { useWorkUI } from '../components/work/WorkUIProvider.jsx'

export default function WorkloadScreen({ route = 'workload' }) {
  const { state } = useStore()
  const work = useWorkUI()
  const now = new Date()
  const today = todayStr()
  const [days, setDays] = useState(14)
  const [selected, setSelected] = useState(today)

  const summary = useMemo(() => workloadSummary(state, now), [state, now])
  const series = useMemo(() => workloadSeries(state, { from: today, days, now }), [state, today, days, now])
  const projects = useMemo(() => projectsSummary(state, now), [state, now])
  const assignments = useMemo(() => assignmentsSummary(state, now), [state, now])
  const priority = useMemo(() => priorityWork(state, now, 6), [state, now])
  const lanes = useMemo(() => deadlineLanes(state, { from: today, days: 14, now }), [state, today, now])

  const week = useMemo(() => weekDays(today), [today])
  const weekLoad = useMemo(() => workloadSeries(state, { from: week[0], days: 7, now }), [state, week, now])

  const selectedRow = series.rows.find((r) => r.date === selected) || series.rows[0]
  const overdue = [
    ...assignments.open.filter((r) => r.status.passed).map((r) => ({ kind: 'assignment', item: r.assignment, status: r.status })),
    ...projects.open.filter((r) => r.status.passed).map((r) => ({ kind: 'project', item: r.project, status: r.status })),
  ]

  const nothingAtAll = projects.total === 0 && assignments.total === 0

  if (nothingAtAll) {
    return (
      <div className="screen" id="workload-screen">
        <header className="screen-head">
          <div>
            <h1 className="screen-title">Workload</h1>
            <p className="screen-sub">Everything landing on every day.</p>
          </div>
        </header>
        <div className="stack">
          <WorkTabs route={route} />
          <SectionCard>
            <WorkEmpty
              icon={<IconWorkload size={40} />}
              title="No work scheduled"
              action={
                <>
                  <button className="btn primary" onClick={work.newAssignment}><IconPlus size={16} /> New assignment</button>
                  <button className="btn" onClick={work.newProject}><IconPlus size={16} /> New project</button>
                </>
              }
            >
              Add a project or an assignment with a deadline and this becomes a map of what is coming.
            </WorkEmpty>
          </SectionCard>
        </div>
      </div>
    )
  }

  return (
    <div className="screen" id="workload-screen">
      <header className="screen-head">
        <div>
          <h1 className="screen-title">Workload</h1>
          <p className="screen-sub">Deadlines, tasks and estimates across projects and assignments.</p>
        </div>
      </header>

      <div className="stack">
        <WorkTabs route={route} />

        <StatStrip
          className="cols-6"
          cells={[
            { label: 'Due today', value: summary.dueToday, tone: summary.dueToday ? 'warn' : undefined, note: prettyDate(today) },
            { label: 'Next 7 days', value: summary.dueThisWeek, note: `${weekLoad.rows.reduce((n, r) => n + r.count, 0)} items` },
            { label: 'Active projects', value: summary.activeProjects, note: `${projects.completed} completed` },
            { label: 'Open assignments', value: summary.activeAssignments, note: `${assignments.dueSoon} due soon` },
            { label: 'Overdue', value: summary.overdue, tone: summary.overdue ? 'bad' : undefined, note: summary.overdue ? 'needs attention' : 'nothing overdue' },
            { label: 'Estimated left', value: summary.estimatedLabel || '—', small: true, note: `${summary.openTasks} open tasks` },
          ]}
        />

        {overdue.length > 0 && (
          <SectionCard className="pad" style={{ borderColor: 'color-mix(in srgb, var(--bad) 40%, var(--border))' }}>
            <CardHead title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: 'var(--bad)' }}><IconAlert size={16} /> Overdue</span>} />
            <div className="deadline-strip">
              {overdue.map((o) => (
                <WorkRow key={`${o.kind}-${o.item.id}`} kind={o.kind} item={o.item} status={o.status}
                  progressPct={o.status.pct} />
              ))}
            </div>
          </SectionCard>
        )}

        <SectionCard className="pad">
          <CardHead title="The next 14 days, lane by lane">
            <a className="btn ghost sm" href="#/timeline">All deadlines</a>
          </CardHead>
          <DeadlineLanes model={lanes} />
          <p className="card-blurb">
            Each lane runs from a real start to a real deadline; the fill inside is completed work. Lanes are ordered by what lands first.
          </p>
        </SectionCard>

        <SectionCard className="pad">
          <CardHead title="Load by day">
            <div className="seg" role="group" aria-label="Workload window">
              {[7, 14, 30].map((d) => (
                <button key={d} type="button" className={`seg-btn${days === d ? ' active' : ''}`} aria-pressed={days === d} onClick={() => setDays(d)}>{d}D</button>
              ))}
            </div>
          </CardHead>
          <LoadBars rows={series.rows} today={today} onSelect={(r) => setSelected(r.date)} />
          <p className="card-blurb">
            Tap a day to see what lands on it{series.peak >= 4 ? `. Your heaviest day so far is ${series.rows.find((r) => r.count === series.peak)?.label} with ${series.peak} items.` : '.'}
          </p>
        </SectionCard>

        <div className="split">
          <SectionCard className="pad">
            <CardHead title={selectedRow?.date === today ? 'Today' : prettyDate(selectedRow.date)}>
              <span className="tiny muted tnum">{selectedRow?.count || 0} items</span>
            </CardHead>
            {!selectedRow?.count ? (
              <p className="empty-note">Nothing due on this day. That is room, not emptiness.</p>
            ) : (
              <div className="deadline-strip">
                {selectedRow.assignments.map(({ item, status }) => (
                  <WorkRow key={`a-${item.id}`} kind="assignment" item={item} status={status} progressPct={status.pct} />
                ))}
                {selectedRow.projects.map(({ item, status }) => (
                  <WorkRow key={`p-${item.id}`} kind="project" item={item} status={status} progressPct={status.pct} />
                ))}
                {selectedRow.tasks.map(({ item, task }) => (
                  <a className="tl-item" key={`t-${task.id}`} href={`#/projects/${item.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                    <span className="kind-tag project" aria-hidden="true" style={{ flex: 'none' }} />
                    <span className="tl-main">
                      <span className="tl-name">{task.name}</span>
                      <span className="tl-meta">
                        <span className="tiny muted">Task in {item.name}</span>
                        {Number(task.estimateMin) > 0 && <span className="tiny muted tnum">~{minutesLabel(task.estimateMin)}</span>}
                      </span>
                    </span>
                  </a>
                ))}
                {selectedRow.milestones.map(({ item, milestone }) => (
                  <a className="tl-item" key={`m-${milestone.id}`} href={`#/projects/${item.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                    <span className="kind-tag project" aria-hidden="true" style={{ flex: 'none' }} />
                    <span className="tl-main">
                      <span className="tl-name">{milestone.name}</span>
                      <span className="tl-meta"><span className="tiny muted">Milestone in {item.name}</span></span>
                    </span>
                  </a>
                ))}
              </div>
            )}
            {selectedRow?.minutes > 0 && (
              <p className="card-blurb">Estimated effort on this day: {minutesLabel(selectedRow.minutes)}.</p>
            )}
          </SectionCard>

          <SectionCard className="pad">
            <CardHead title="This week" />
            <LoadColumns rows={weekLoad.rows} today={today} />
            <div className="hr" />
            <p className="tiny muted" style={{ lineHeight: 1.6 }}>
              {weekLoad.total === 0
                ? 'Nothing due this week.'
                : `${weekLoad.total} item${weekLoad.total === 1 ? '' : 's'} due between ${shortDate(week[0])} and ${shortDate(week[6])}${weekLoad.minutes ? ` · ~${minutesLabel(weekLoad.minutes)} estimated` : ''}.`}
            </p>
          </SectionCard>
        </div>

        <SectionCard className="pad">
          <CardHead title="Next up">
            <a className="btn ghost sm" href="#/timeline">All deadlines</a>
          </CardHead>
          {priority.all.length === 0 ? (
            <p className="empty-note">No dated work open right now.</p>
          ) : (
            <div className="deadline-strip">
              {priority.all.map((o) => (
                <FadeIn key={`${o.kind}-${o.item.id}`}>
                  <WorkRow kind={o.kind} item={o.item} status={o.status} progressPct={o.status.pct} />
                </FadeIn>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  )
}
