/* ============================================================
   PROJECTS — "How much progress am I making?"
   Its own dashboard, its own analytics, its own timeline.
   Never shares the habit analytics surface (§81).
   ============================================================ */
import { useMemo, useState } from 'react'
import { useStore } from '../store.jsx'
import useNow from '../lib/useNow.js'
import { useWorkUI } from '../components/work/WorkUIProvider.jsx'
import { WorkTabs } from '../components/layout/Navigation.jsx'
import { ProjectCard } from '../components/work/WorkCards.jsx'
import { StatStrip, FilterBar, WorkEmpty, FadeIn } from '../components/work/WorkKit.jsx'
import SectionCard, { CardHead } from '../components/ui/SectionCard.jsx'
import { LineSeries, HBarList, BurndownChart, DonutStat, BucketColumns } from '../components/charts/workCharts.jsx'
import {
  projectsSummary, sortWorkRows, matchesWorkFilter, matchesQuery, WORK_FILTERS,
  projectCompletionTrend, weeklyCompletionSpeed, projectComparison, timeDistribution, burndown,
} from '../lib/work.js'
import { activeHabits, habitRate } from '../lib/stats.js'
import { todayStr, subDaysStr } from '../lib/dates.js'
import { IconProjects, IconPlus, IconSearch, IconX } from '../lib/icons.jsx'

const SORTS = [
  { id: 'urgency', label: 'Urgency' },
  { id: 'deadline', label: 'Deadline' },
  { id: 'progress', label: 'Progress' },
  { id: 'priority', label: 'Priority' },
  { id: 'recent', label: 'Recently updated' },
  { id: 'name', label: 'Name' },
]

export default function ProjectsScreen({ route = 'projects' }) {
  const { state } = useStore()
  const work = useWorkUI()
  const now = useNow()
  const [view, setView] = useState('overview')
  const [filter, setFilter] = useState('all')
  const [sort, setSort] = useState('urgency')
  const [query, setQuery] = useState('')

  const summary = useMemo(() => projectsSummary(state, now), [state, now])

  const counts = useMemo(() => {
    const c = {}
    for (const f of WORK_FILTERS) {
      c[f.id] = summary.rows.filter((r) => matchesWorkFilter(r.status, f.id, now)).length
    }
    return c
  }, [summary, now])

  const visible = useMemo(() => {
    const rows = summary.rows.filter((r) => matchesWorkFilter(r.status, filter, now) && matchesQuery(r.project, query))
    return sortWorkRows(rows, sort)
  }, [summary, filter, sort, query, now])

  const hasAny = summary.total > 0

  return (
    <div className="screen" id="projects-screen">
      <header className="screen-head">
        <div>
          <h1 className="screen-title">Projects</h1>
          <p className="screen-sub">Outcomes with milestones, tasks and a deadline.</p>
        </div>
        <div className="head-actions">
          <button className="btn primary" onClick={work.newProject}>
            <IconPlus size={16} /> New project
          </button>
        </div>
      </header>

      <div className="stack">
        <WorkTabs route={route} />

        <div className="seg seg-wide" role="group" aria-label="Projects view">
          <button type="button" className={`seg-btn${view === 'overview' ? ' active' : ''}`} aria-pressed={view === 'overview'} onClick={() => setView('overview')}>
            Overview
          </button>
          <button type="button" className={`seg-btn${view === 'analytics' ? ' active' : ''}`} aria-pressed={view === 'analytics'} onClick={() => setView('analytics')}>
            Analytics
          </button>
        </div>

        {view === 'overview' ? (
          <>
            <StatStrip
              className="cols-5"
              cells={[
                { label: 'Active', value: summary.active, note: `${summary.total} total` },
                { label: 'At risk', value: summary.atRisk, tone: summary.atRisk ? 'warn' : undefined, note: 'behind pace' },
                { label: 'Overdue', value: summary.overdue, tone: summary.overdue ? 'bad' : undefined, note: 'deadline passed' },
                { label: 'Due this week', value: summary.dueThisWeek, note: summary.dueToday ? `${summary.dueToday} today` : 'next 7 days' },
                { label: 'Completed', value: summary.completed, tone: summary.completed ? 'good' : undefined, note: 'all tasks done' },
              ]}
            />

            {hasAny && (
              <div className="sticky-bar">
                <div className="search-field">
                  <IconSearch size={17} />
                  <label className="sr-only" htmlFor="project-search">Search projects</label>
                  <input
                    id="project-search"
                    value={query}
                    placeholder="Search projects, tasks, notes…"
                    onChange={(e) => setQuery(e.target.value)}
                  />
                  {query && <button className="btn ghost icon" aria-label="Clear search" onClick={() => setQuery('')}><IconX size={15} /></button>}
                </div>
                <FilterBar filters={WORK_FILTERS} value={filter} onChange={setFilter} counts={counts} ariaLabel="Filter projects" />
                <div className="row-between">
                  <span className="tiny muted">{visible.length} shown</span>
                  <label className="sr-only" htmlFor="project-sort">Sort projects</label>
                  <select id="project-sort" className="status-select" value={sort} onChange={(e) => setSort(e.target.value)}>
                    {SORTS.map((s) => <option key={s.id} value={s.id}>Sort: {s.label}</option>)}
                  </select>
                </div>
              </div>
            )}

            {!hasAny ? (
              <SectionCard>
                <WorkEmpty
                  art="art/empty-projects.webp"
                  icon={<IconProjects size={40} />}
                  title="No projects yet"
                  action={<button className="btn primary" onClick={work.newProject}><IconPlus size={16} /> Create your first project</button>}
                >
                  A project is something you finish — with milestones, tasks and a deadline. Habits are what you repeat.
                </WorkEmpty>
              </SectionCard>
            ) : visible.length === 0 ? (
              <SectionCard>
                <WorkEmpty icon={<IconSearch size={34} />} title="Nothing matches those filters">
                  Try a different filter or clear the search.
                </WorkEmpty>
              </SectionCard>
            ) : (
              <div className="work-list">
                {visible.map(({ project }, i) => (
                  <FadeIn key={project.id} delay={Math.min(i * 0.03, 0.24)}>
                    <ProjectCard project={project} now={now} />
                  </FadeIn>
                ))}
              </div>
            )}
          </>
        ) : (
          <ProjectAnalytics />
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------
   PROJECT ANALYTICS (§60) — completion, tasks, velocity, daily
   progress, burndown, time distribution, comparison.
   ------------------------------------------------------------ */
function ProjectAnalytics() {
  const { state } = useStore()
  const now = useNow()
  const today = todayStr()
  const [range, setRange] = useState(30)
  const summary = useMemo(() => projectsSummary(state, now), [state, now])
  const projects = summary.rows.map((r) => r.project)

  const trend = useMemo(() => projectCompletionTrend(state, range, now), [state, range, now])
  const velocity = useMemo(() => weeklyCompletionSpeed(state, 8, now), [state, now])
  const comparison = useMemo(() => projectComparison(state, now), [state, now])
  const time = useMemo(() => timeDistribution(state), [state])

  const taskTotals = useMemo(() => {
    let done = 0
    let total = 0
    let blocked = 0
    let doing = 0
    for (const p of projects) {
      for (const m of p.milestones || []) {
        for (const t of m.tasks || []) {
          total++
          if (t.done) done++
          else if (t.status === 'blocked') blocked++
          else if (t.status === 'doing') doing++
        }
      }
    }
    return { done, total, remaining: total - done, blocked, doing, pct: total ? Math.round((done / total) * 100) : null }
  }, [projects])

  const avgCompletion = projects.length
    ? Math.round(projects.reduce((n, p) => n + (summary.rows.find((r) => r.project.id === p.id)?.status.pct || 0), 0) / projects.length)
    : null

  // deadline health: how many projects sit above / on / below the pace line
  const health = useMemo(() => {
    const rows = summary.rows.filter((r) => r.status.hasDeadline && !r.status.complete)
    const ahead = rows.filter((r) => (r.status.behind ?? 0) < -5).length
    const onPace = rows.filter((r) => Math.abs(r.status.behind ?? 0) <= 5).length
    const behind = rows.filter((r) => (r.status.behind ?? 0) > 5).length
    return { rows, ahead, onPace, behind, total: rows.length }
  }, [summary])

  // burndown of the most urgent dated project
  const focus = useMemo(() => {
    const dated = summary.open.filter((r) => r.status.hasDeadline && r.project.startDate)
    if (!dated.length) return null
    const sorted = sortWorkRows(dated, 'urgency')
    const row = sorted[0]
    return { project: row.project, status: row.status, data: burndown(row.project, now) }
  }, [summary, now])

  // linked-habit consistency vs project progress (correlation, never causation)
  const linked = useMemo(() => {
    const habits = activeHabits(state)
    const from = subDaysStr(today, 29)
    const out = []
    for (const p of projects) {
      for (const hid of p.linkedHabitIds || []) {
        const habit = habits.find((h) => h.id === hid)
        if (!habit) continue
        const r = habitRate(state, habit, from, today)
        if (r.rate == null) continue
        out.push({ project: p, habit, rate: Math.round(r.rate * 100), pct: summary.rows.find((x) => x.project.id === p.id)?.status.pct ?? 0 })
      }
    }
    return out
  }, [state, projects, summary, today])

  if (!projects.length) {
    return (
      <SectionCard>
        <WorkEmpty icon={<IconProjects size={40} />} title="No project analytics yet">
          Create a project with a start date and deadline, then log progress — velocity and burndown charts build themselves from real timestamps.
        </WorkEmpty>
      </SectionCard>
    )
  }

  return (
    <>
      {/* A · completion + B · tasks */}
      <div className="split">
        <SectionCard className="pad">
          <CardHead title="Project completion" />
          <DonutStat
            pct={avgCompletion}
            label="Average across open projects"
            sub={`${projects.length} project${projects.length === 1 ? '' : 's'} · ${summary.completed} completed`}
            size={116}
          />
          <div className="hr" />
          <HBarList
            rows={comparison.rows.slice(0, 8).map((r) => ({
              label: r.project.name,
              value: r.pct,
              sub: r.daysLeft != null ? `${r.daysLeft}d` : undefined,
              tone: r.status.tone,
            }))}
            emptyText="No projects to compare yet."
          />
        </SectionCard>

        <SectionCard className="pad">
          <CardHead title="Task completion" />
          {taskTotals.total === 0 ? (
            <p className="empty-note">Add tasks to a project and this fills in.</p>
          ) : (
            <>
              <DonutStat pct={taskTotals.pct} label={`${taskTotals.done} of ${taskTotals.total} tasks done`}
                sub={`${taskTotals.remaining} remaining${taskTotals.doing ? ` · ${taskTotals.doing} in progress` : ''}${taskTotals.blocked ? ` · ${taskTotals.blocked} blocked` : ''}`} size={116} />
              <div className="hr" />
              <BucketColumns
                rows={[
                  { label: 'Done', value: taskTotals.done, color: 'var(--good)' },
                  { label: 'In progress', value: taskTotals.doing, color: 'var(--accent-2)' },
                  { label: 'Blocked', value: taskTotals.blocked, color: 'var(--bad)' },
                  { label: 'To do', value: Math.max(0, taskTotals.remaining - taskTotals.doing - taskTotals.blocked), color: 'var(--text-3)' },
                ]}
              />
            </>
          )}
        </SectionCard>
      </div>

      {/* D · daily progress trend */}
      <SectionCard className="pad">
        <CardHead title="Daily project progress">
          <div className="seg" role="group" aria-label="Trend range">
            {[14, 30, 90].map((d) => (
              <button key={d} type="button" className={`seg-btn${range === d ? ' active' : ''}`} aria-pressed={range === d} onClick={() => setRange(d)}>
                {d}D
              </button>
            ))}
          </div>
        </CardHead>
        {trend.enough ? (
          <>
            <LineSeries
              series={[{ id: 'avg', label: 'Average completion', color: 'var(--accent-2)', points: trend.rows.map((r) => ({ date: r.date, value: r.pct })) }]}
              ariaLabel={`Average project completion over ${range} days`}
            />
            <p className="card-blurb">Mean completion across every project with a progress log. Points come from real updates only.</p>
          </>
        ) : (
          <p className="empty-note">No progress has been logged yet — update a project’s tasks or percentage and this line appears.</p>
        )}
      </SectionCard>

      <div className="split">
        {/* C · velocity */}
        <SectionCard className="pad">
          <CardHead title="Velocity" />
          {velocity.some((v) => v.count > 0) ? (
            <>
              <BucketColumns
                rows={velocity.map((v) => ({ label: v.label, value: v.count, color: 'var(--accent-1)' }))}
                height={120}
              />
              <p className="card-blurb">Tasks completed per week, from real completion timestamps.</p>
            </>
          ) : (
            <p className="empty-note">Complete a few tasks and your weekly speed shows up here.</p>
          )}
        </SectionCard>

        {/* deadline health */}
        <SectionCard className="pad">
          <CardHead title="Deadline health" />
          {health.total === 0 ? (
            <p className="empty-note">No dated, open projects yet.</p>
          ) : (
            <>
              <HBarList
                rows={[
                  { label: 'Ahead', value: (health.ahead / health.total) * 100, sub: `${health.ahead}`, tone: 'good' },
                  { label: 'On pace', value: (health.onPace / health.total) * 100, sub: `${health.onPace}`, tone: 'neutral' },
                  { label: 'Behind', value: (health.behind / health.total) * 100, sub: `${health.behind}`, tone: 'bad' },
                ]}
              />
              <p className="card-blurb">
                Compared against the pace line: the share of the deadline window that has elapsed versus the share of work completed.
              </p>
            </>
          )}
        </SectionCard>
      </div>

      {/* E · burndown of the most urgent dated project */}
      {focus?.data && (
        <SectionCard className="pad">
          <CardHead title="Deadline burndown">
            <a className="btn ghost sm" href={`#/projects/${focus.project.id}`}>{focus.project.name}</a>
          </CardHead>
          <BurndownChart rows={focus.data.rows} today={today} />
          <p className="card-blurb">
            {focus.data.todayGap != null && focus.data.todayGap < 0
              ? `${Math.abs(Math.round(focus.data.todayGap))} points more work remaining than the ideal pace line expects today.`
              : focus.data.todayGap != null
                ? `${Math.round(focus.data.todayGap)} points ahead of the ideal pace line today.`
                : 'No logged progress yet for this project.'}
          </p>
        </SectionCard>
      )}

      {/* F · time distribution */}
      <SectionCard className="pad">
        <CardHead title="Time distribution" />
        {time.enough ? (
          <>
            <HBarList
              rows={time.rows.slice(0, 8).map((r) => ({ label: r.label, value: (r.minutes / time.total) * 100, sub: r.text }))}
            />
            <p className="card-blurb">Share of estimated task time by category — {time.text || `${Math.round(time.total / 6) / 10} hours`} tracked in total.</p>
          </>
        ) : (
          <p className="empty-note">Add an estimated time to tasks and this breaks down where the hours go.</p>
        )}
      </SectionCard>

      {/* G · comparison table + linked habits */}
      <SectionCard className="pad">
        <CardHead title="Project comparison" />
        {comparison.enough ? (
          <div className="perf" aria-label="Project comparison">
            <div className="perf-row perf-head">
              <span className="perf-cell perf-name">Project</span>
              <span className="perf-cell tnum">Done</span>
              <span className="perf-cell tnum">Left</span>
              <span className="perf-cell tnum">Speed</span>
            </div>
            {comparison.rows.map((r) => (
              <div className="perf-row" key={r.project.id}>
                <span className="perf-cell perf-name">
                  <span className="perf-bar" style={{ width: `${r.pct}%` }} aria-hidden="true" />
                  <a className="perf-name-text" href={`#/projects/${r.project.id}`} style={{ color: 'inherit', textDecoration: 'none' }}>{r.project.name}</a>
                </span>
                <span className="perf-cell tnum">{r.pct}%</span>
                <span className="perf-cell tnum">
                  {r.overdue ? <span style={{ color: 'var(--bad)' }}>overdue</span> : r.daysLeft != null ? `${r.daysLeft}d` : '—'}
                </span>
                <span className="perf-cell tnum">{r.speed != null ? `${r.speed > 0 ? '+' : ''}${r.speed}%/d` : '—'}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="empty-note">Add a second project to compare completion, remaining time and speed.</p>
        )}
      </SectionCard>

      {linked.length > 0 && (
        <SectionCard className="pad">
          <CardHead title="Projects and habits" />
          <p className="card-blurb">
            Project progress next to the 30-day consistency of the habits linked to it. These patterns often appear together — this is not a claim that one causes the other.
          </p>
          <HBarList
            rows={linked.slice(0, 10).flatMap((l) => ([
              { label: `${l.project.name} · project`, value: l.pct, tone: 'neutral' },
              { label: `${l.habit.name} · habit`, value: l.rate, tone: 'good' },
            ]))}
          />
        </SectionCard>
      )}
    </>
  )
}
