/* ============================================================
   ASSIGNMENTS — "Am I going to finish this on time?"
   Deadline-first dashboard with its own analytics: progress
   trend, completion speed, time-vs-work and weekly completion.
   ============================================================ */
import { useMemo, useState } from 'react'
import { useStore } from '../store.jsx'
import useNow from '../lib/useNow.js'
import { useWorkUI } from '../components/work/WorkUIProvider.jsx'
import { WorkTabs } from '../components/layout/Navigation.jsx'
import { AssignmentCard } from '../components/work/WorkCards.jsx'
import { StatStrip, FilterBar, WorkEmpty, FadeIn } from '../components/work/WorkKit.jsx'
import SectionCard, { CardHead } from '../components/ui/SectionCard.jsx'
import { LineSeries, HBarList, DonutStat, BucketColumns, TimeVsWorkBars } from '../components/charts/workCharts.jsx'
import {
  assignmentsSummary, sortWorkRows, matchesWorkFilter, matchesQuery, WORK_FILTERS,
  assignmentCompletionTrend, weeklyCompletionSpeed,
} from '../lib/work.js'
import {   shortDate, dayOf } from '../lib/dates.js'
import { IconAssignment, IconPlus, IconSearch, IconX, IconAlert } from '../lib/icons.jsx'

const SORTS = [
  { id: 'urgency', label: 'Urgency' },
  { id: 'deadline', label: 'Deadline' },
  { id: 'progress', label: 'Progress' },
  { id: 'priority', label: 'Priority' },
  { id: 'recent', label: 'Recently updated' },
  { id: 'name', label: 'Name' },
]

export default function AssignmentsScreen({ route = 'assignments' }) {
  const { state } = useStore()
  const work = useWorkUI()
  const now = useNow()
  const [view, setView] = useState('overview')
  const [filter, setFilter] = useState('all')
  const [sort, setSort] = useState('urgency')
  const [query, setQuery] = useState('')

  const summary = useMemo(() => assignmentsSummary(state, now), [state, now])

  const counts = useMemo(() => {
    const c = {}
    for (const f of WORK_FILTERS) c[f.id] = summary.rows.filter((r) => matchesWorkFilter(r.status, f.id, now)).length
    return c
  }, [summary, now])

  const visible = useMemo(() => {
    const rows = summary.rows.filter((r) => matchesWorkFilter(r.status, filter, now) && matchesQuery(r.assignment, query))
    return sortWorkRows(rows, sort)
  }, [summary, filter, sort, query, now])

  const hasAny = summary.total > 0
  const urgent = summary.rows.filter((r) => !r.status.complete && (r.status.id === 'urgent' || r.status.passed))

  return (
    <div className="screen" id="assignments-screen">
      <header className="screen-head">
        <div>
          <h1 className="screen-title">Assignments</h1>
          <p className="screen-sub">Deliverables with a deadline — hours matter here.</p>
        </div>
        <div className="head-actions">
          <button className="btn primary" onClick={() => work.newAssignment()}>
            <IconPlus size={16} /> New assignment
          </button>
        </div>
      </header>

      <div className="stack">
        <WorkTabs route={route} />

        <div className="seg seg-wide" role="group" aria-label="Assignments view">
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
                { label: 'Due today', value: summary.dueToday, tone: summary.dueToday ? 'warn' : undefined, note: `${summary.open.length} open` },
                { label: 'This week', value: summary.dueThisWeek, note: 'next 7 days' },
                { label: 'Due soon', value: summary.dueSoon, tone: summary.dueSoon ? 'warn' : undefined, note: 'within 72h' },
                { label: 'Overdue', value: summary.overdue, tone: summary.overdue ? 'bad' : undefined, note: 'deadline passed' },
                { label: 'Completed', value: summary.completed, tone: summary.completed ? 'good' : undefined, note: 'at 100%' },
              ]}
            />

            {urgent.length > 0 && (
              <SectionCard className="pad" style={{ borderColor: 'color-mix(in srgb, var(--bad) 40%, var(--border))' }}>
                <CardHead title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: 'var(--bad)' }}><IconAlert size={16} /> Needs attention now</span>} />
                <div className="work-list">
                  {sortWorkRows(urgent, 'urgency').slice(0, 3).map(({ assignment }) => (
                    <AssignmentCard key={assignment.id} assignment={assignment} now={now} />
                  ))}
                </div>
              </SectionCard>
            )}

            {hasAny && (
              <div className="sticky-bar">
                <div className="search-field">
                  <IconSearch size={17} />
                  <label className="sr-only" htmlFor="assignment-search">Search assignments</label>
                  <input
                    id="assignment-search"
                    value={query}
                    placeholder="Search assignments, subjects, notes…"
                    onChange={(e) => setQuery(e.target.value)}
                  />
                  {query && <button className="btn ghost icon" style={{ width: 32, height: 32, minHeight: 32 }} aria-label="Clear search" onClick={() => setQuery('')}><IconX size={15} /></button>}
                </div>
                <FilterBar filters={WORK_FILTERS} value={filter} onChange={setFilter} counts={counts} ariaLabel="Filter assignments" />
                <div className="row-between">
                  <span className="tiny muted">{visible.length} shown</span>
                  <label className="sr-only" htmlFor="assignment-sort">Sort assignments</label>
                  <select id="assignment-sort" className="status-select" value={sort} onChange={(e) => setSort(e.target.value)}>
                    {SORTS.map((s) => <option key={s.id} value={s.id}>Sort: {s.label}</option>)}
                  </select>
                </div>
              </div>
            )}

            {!hasAny ? (
              <SectionCard>
                <WorkEmpty
                  art="art/empty-assignments.webp"
                  icon={<IconAssignment size={40} />}
                  title="Nothing due yet"
                  action={<button className="btn primary" onClick={() => work.newAssignment()}><IconPlus size={16} /> Create an assignment</button>}
                >
                  Give it a deadline — two hours or two weeks — and the countdown, pace line and status work themselves out.
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
                {visible.map(({ assignment }, i) => (
                  <FadeIn key={assignment.id} delay={Math.min(i * 0.03, 0.24)}>
                    <AssignmentCard assignment={assignment} now={now} />
                  </FadeIn>
                ))}
              </div>
            )}

            {summary.done.length > 0 && filter === 'all' && (
              <SectionCard className="pad">
                <CardHead title="Recently completed">
                  <button className="btn ghost sm" onClick={() => setFilter('done')}>See all</button>
                </CardHead>
                <div className="deadline-strip">
                  {summary.done.slice(0, 4).map(({ assignment, status }) => (
                    <a className="deadline-item" key={assignment.id} href={`#/assignments/${assignment.id}`}>
                      <span className="di-date">{status.completedAt ? shortDate(dayOf(assignment.completedAt)) : '—'}</span>
                      <span className="di-name">{assignment.name}</span>
                      <span className="tiny muted tnum">100%</span>
                    </a>
                  ))}
                </div>
              </SectionCard>
            )}
          </>
        ) : (
          <AssignmentAnalytics />
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------
   ASSIGNMENT ANALYTICS (§69)
   ------------------------------------------------------------ */
function AssignmentAnalytics() {
  const { state } = useStore()
  const now = useNow()
  const [range, setRange] = useState(30)
  const summary = useMemo(() => assignmentsSummary(state, now), [state, now])
  const items = summary.rows.map((r) => r.assignment)

  const trend = useMemo(() => assignmentCompletionTrend(state, range, now), [state, range, now])
  const speed = useMemo(() => weeklyCompletionSpeed(state, 8, now), [state, now])

  const avg = items.length ? Math.round(items.reduce((n, a) => n + summary.rows.find((r) => r.assignment.id === a.id).status.pct, 0) / items.length) : null

  const subtaskTotals = useMemo(() => {
    let done = 0
    let total = 0
    for (const a of items) for (const s of a.subtasks || []) { total++; if (s.done) done++ }
    return { done, total, remaining: total - done, pct: total ? Math.round((done / total) * 100) : null }
  }, [items])

  // Time elapsed vs work completed, aggregated across dated open assignments
  const pace = useMemo(() => {
    const dated = summary.open.filter((r) => r.status.elapsedPct != null)
    if (!dated.length) return null
    const elapsed = Math.round(dated.reduce((n, r) => n + r.status.elapsedPct, 0) / dated.length)
    const workPct = Math.round(dated.reduce((n, r) => n + r.status.pct, 0) / dated.length)
    return { elapsed, workPct, gap: elapsed - workPct, behind: elapsed - workPct > 15, ahead: workPct - elapsed > 15, count: dated.length }
  }, [summary])

  const perAssignment = useMemo(() => sortWorkRows(summary.open, 'urgency').slice(0, 8), [summary])

  if (!items.length) {
    return (
      <SectionCard>
        <WorkEmpty icon={<IconAssignment size={40} />} title="No assignment analytics yet">
          Create an assignment, set a deadline and move its progress — the countdown, pace line and trend are all derived from that.
        </WorkEmpty>
      </SectionCard>
    )
  }

  return (
    <>
      <div className="split">
        <SectionCard className="pad">
          <CardHead title="Assignment completion" />
          <DonutStat pct={avg} size={116} label="Average progress"
            sub={`${summary.open.length} open · ${summary.completed} completed`} />
          <div className="hr" />
          <HBarList
            rows={perAssignment.map((r) => ({
              label: r.assignment.name,
              value: r.status.pct,
              sub: r.status.hasDeadline ? `${r.status.daysLeft ?? 0}d` : undefined,
              tone: r.status.tone,
            }))}
            emptyText="No open assignments."
          />
        </SectionCard>

        <SectionCard className="pad">
          <CardHead title="Time remaining vs work remaining" />
          {pace ? (
            <>
              <TimeVsWorkBars elapsedPct={pace.elapsed} workPct={pace.workPct} behind={pace.behind} ahead={pace.ahead} />
              <p className="card-blurb">Averaged across {pace.count} dated open assignment{pace.count === 1 ? '' : 's'}.</p>
            </>
          ) : (
            <p className="empty-note">Set a deadline and an assigned date on an assignment to compare the clock with the work.</p>
          )}
        </SectionCard>
      </div>

      <SectionCard className="pad">
        <CardHead title="Daily progress">
          <div className="seg" role="group" aria-label="Trend range">
            {[14, 30, 90].map((d) => (
              <button key={d} type="button" className={`seg-btn${range === d ? ' active' : ''}`} aria-pressed={range === d} onClick={() => setRange(d)}>{d}D</button>
            ))}
          </div>
        </CardHead>
        {trend.enough ? (
          <>
            <LineSeries
              series={[{ id: 'avg', label: 'Average progress', color: 'var(--accent-2)', points: trend.rows.map((r) => ({ date: r.date, value: r.pct })) }]}
              ariaLabel={`Average assignment progress over ${range} days`}
            />
            <p className="card-blurb">Mean progress across assignments with a real progress log.</p>
          </>
        ) : (
          <p className="empty-note">Move an assignment’s progress and this line starts today.</p>
        )}
      </SectionCard>

      <div className="split">
        <SectionCard className="pad">
          <CardHead title="Subtask completion" />
          {subtaskTotals.total ? (
            <>
              <DonutStat pct={subtaskTotals.pct} size={108}
                label={`${subtaskTotals.done} of ${subtaskTotals.total} subtasks`}
                sub={`${subtaskTotals.remaining} remaining`} />
              <div className="hr" />
              <BucketColumns
                rows={[
                  { label: 'Done', value: subtaskTotals.done, color: 'var(--good)' },
                  { label: 'Open', value: subtaskTotals.remaining, color: 'var(--text-3)' },
                ]}
                height={92}
              />
            </>
          ) : (
            <p className="empty-note">Add subtasks to an assignment to track work left.</p>
          )}
        </SectionCard>

        <SectionCard className="pad">
          <CardHead title="Work velocity" />
          {speed.some((s) => s.count) ? (
            <>
              <BucketColumns rows={speed.map((s) => ({ label: s.label, value: s.count, color: 'var(--accent-1)' }))} height={110} />
              <p className="card-blurb">Subtasks and project tasks completed per week, from real timestamps.</p>
            </>
          ) : (
            <p className="empty-note">Complete a subtask and your weekly speed appears here.</p>
          )}
        </SectionCard>
      </div>

      <SectionCard className="pad">
        <CardHead title="Upcoming deadlines" />
        <div className="deadline-strip">
          {sortWorkRows(summary.open, 'deadline').slice(0, 6).map(({ assignment, status }) => (
            <a className="deadline-item" key={assignment.id} href={`#/assignments/${assignment.id}`}>
              <span className="di-date">{status.hasDeadline ? shortDate(dayOf(assignment.deadline)) : '—'}</span>
              <span className="di-name">{assignment.name}</span>
              <span className="tiny tnum" style={{ color: status.tone === 'bad' ? 'var(--bad)' : status.tone === 'warn' ? 'var(--warn)' : 'var(--text-2)' }}>
                {status.pct}% · {status.dueText}
              </span>
            </a>
          ))}
          {summary.open.length === 0 && <p className="empty-note">Nothing open right now.</p>}
        </div>
      </SectionCard>
    </>
  )
}
