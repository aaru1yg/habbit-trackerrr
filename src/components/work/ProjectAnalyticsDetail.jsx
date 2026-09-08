import { useMemo, useState } from 'react'
import useNow from '../../lib/useNow.js'
import SectionCard, { CardHead } from '../ui/SectionCard.jsx'
import { BurndownChart, LineSeries, BucketColumns, HBarList } from '../charts/workCharts.jsx'
import PaceChart from '../charts/PaceChart.jsx'
import { burndown, progressSeries, entityVelocity, timeVsWork, itemHistory, allTasks, projectPace } from '../../lib/work.js'
import { todayStr, subDaysStr, shortDate } from '../../lib/dates.js'
export default function ProjectAnalyticsDetail({ project, status }) {
  const now = useNow()
  const today = todayStr()
  const [range, setRange] = useState(30)

  const bd = useMemo(() => burndown(project, now), [project, now])
  const series = useMemo(() => {
    const from = subDaysStr(today, range - 1)
    return progressSeries(project, from, today)
  }, [project, range, today])
  const velocity = useMemo(() => entityVelocity(project, Math.min(range, 30), now), [project, range, now])
  const tvw = useMemo(() => timeVsWork(project, 'project', now), [project, now])
  const history = useMemo(() => itemHistory(project, 'project', now), [project, now])

  const taskBuckets = useMemo(() => {
    const b = { done: 0, doing: 0, blocked: 0, todo: 0 }
    for (const t of allTasks(project)) {
      if (t.done) b.done++
      else if (t.status === 'doing') b.doing++
      else if (t.status === 'blocked') b.blocked++
      else b.todo++
    }
    return b
  }, [project])

  const hasLog = (project.progressLog || []).length > 0
  const pace = useMemo(() => projectPace(project, { days: range, now }), [project, range, now])

  return (
    <>
      <SectionCard className="pad">
        <CardHead title="Expected vs actual">
          <span className="pace-legend" aria-hidden="true">
            <i className="pace-legend-actual" /> actual
            <i className="pace-legend-expected" /> expected
          </span>
        </CardHead>
        <PaceChart
          actual={pace.actual}
          expected={pace.expected}
          ariaLabel={`Expected versus actual progress for ${project.name} over the last ${range} days`}
        />
        {!pace.expected && (
          <p className="tiny muted" style={{ marginTop: 6 }}>
            No expected line: this project needs a start date and a deadline to compute one.
          </p>
        )}
      </SectionCard>

      <div className="split">
        <SectionCard className="pad">
          <CardHead title="Progress over time">
            <div className="seg" role="group" aria-label="Range">
              {[14, 30, 90].map((d) => (
                <button key={d} type="button" className={`seg-btn${range === d ? ' active' : ''}`} aria-pressed={range === d} onClick={() => setRange(d)}>{d}D</button>
              ))}
            </div>
          </CardHead>
          {hasLog ? (
            <LineSeries
              series={[{ id: 'pct', label: 'Complete', color: 'var(--accent-2)', points: series.map((r) => ({ date: r.date, value: r.pct })) }]}
              ariaLabel="Project progress over time"
            />
          ) : (
            <p className="empty-note">Progress is logged every time you complete a task or set a percentage.</p>
          )}
        </SectionCard>

        <SectionCard className="pad">
          <CardHead title="Task status" />
          <BucketColumns
            rows={[
              { label: 'Done', value: taskBuckets.done, color: 'var(--good)' },
              { label: 'Doing', value: taskBuckets.doing, color: 'var(--accent-2)' },
              { label: 'Blocked', value: taskBuckets.blocked, color: 'var(--bad)' },
              { label: 'To do', value: taskBuckets.todo, color: 'var(--text-3)' },
            ]}
          />
          <div className="hr" />
          <HBarList
            rows={[
              { label: 'Completed', value: status.pct, tone: 'good' },
              { label: 'Remaining', value: 100 - status.pct, tone: 'neutral' },
            ]}
          />
        </SectionCard>
      </div>

      {bd && (
        <SectionCard className="pad">
          <CardHead title="Deadline burndown" />
          <BurndownChart rows={bd.rows} today={today} />
          <p className="card-blurb">
            Ideal pace assumes even work from {shortDate(bd.start)} to {shortDate(bd.end)}. The solid line is what actually happened.
          </p>
        </SectionCard>
      )}

      {tvw && (
        <SectionCard className="pad">
          <CardHead title="Time versus work" />
          <HBarList
            rows={[
              { label: 'Time elapsed', value: tvw.elapsedPct, tone: tvw.behind ? 'bad' : 'neutral' },
              { label: 'Work completed', value: tvw.workPct, tone: tvw.behind ? 'warn' : 'good' },
            ]}
          />
          <p className="card-blurb">
            {tvw.behind
              ? `Behind schedule: ${tvw.gapPct} points of the clock have gone without matching work. ${tvw.remainingWork}% of the work is still open with ${tvw.daysLeft} days left.`
              : tvw.ahead
                ? `Ahead of schedule by ${Math.abs(tvw.gapPct)} points.`
                : 'On pace — time elapsed and work completed are within 15 points.'}
          </p>
        </SectionCard>
      )}

      <SectionCard className="pad">
        <CardHead title="Velocity" />
        {velocity.some((v) => v.count) ? (
          <>
            <BucketColumns rows={velocity.map((v) => ({ label: v.date.slice(5).replace('-', '/'), value: v.count, color: 'var(--accent-1)' }))} height={110} />
            <p className="card-blurb">Tasks completed per day over the last {Math.min(range, 30)} days.</p>
          </>
        ) : (
          <p className="empty-note">No completed tasks with timestamps in this window yet.</p>
        )}
      </SectionCard>

      {history && (
        <SectionCard className="pad">
          <CardHead title="Completion record" />
          <dl className="kv">
            <dt>Started</dt><dd>{history.start ? shortDate(history.start) : '—'}</dd>
            <dt>Completed</dt><dd>{history.completedDay ? shortDate(history.completedDay) : '—'}</dd>
            <dt>Duration</dt><dd className="tnum">{history.durationDays != null ? `${history.durationDays} days` : '—'}</dd>
            <dt>Estimated</dt><dd className="tnum">{history.estimated || '—'}</dd>
            <dt>Actual</dt><dd className="tnum">{history.actual || '—'}</dd>
            <dt>Tasks</dt><dd className="tnum">{history.tasksTotal ? `${history.tasksDone}/${history.tasksTotal}` : '—'}</dd>
            <dt>Deadline</dt><dd>{history.early == null ? '—' : history.early ? 'Finished early' : 'Finished after the deadline'}</dd>
          </dl>
        </SectionCard>
      )}
    </>
  )
}
