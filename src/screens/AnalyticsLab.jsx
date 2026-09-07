/* Analytics Lab — Phase D.
 *
 * Loaded with React.lazy from InsightsScreen, so this file and
 * advancedAnalytics.js stay out of both the initial bundle and the
 * Insights chunk until the Lab is actually opened.
 *
 * Every panel follows the same contract:
 *   HEADLINE → KEY FINDING → EVIDENCE → DETAIL
 * and every number comes from an existing engine. Where an engine
 * returns `enough: false` the panel says "Not enough data yet."
 */
import { useEffect, useMemo, useState, useCallback } from 'react'
import { useStore } from '../store.jsx'
import SectionCard, { CardHead } from '../components/ui/SectionCard.jsx'
import EmptyState from '../components/ui/EmptyState.jsx'
import Sheet from '../components/ui/Sheet.jsx'
import { navigate } from '../lib/router.jsx'
import { IconSparkle, IconInsights } from '../lib/icons.jsx'
import { dayStr, shortDate, minutesLabel } from '../lib/dates.js'
import { TrendChart, HabitMatrix } from '../components/charts/chartKit.jsx'
import { LineSeries, LoadBars, HBarList, CompareBars, BucketColumns } from '../components/charts/workCharts.jsx'
import {
  TIMELINE_RANGES, TIMELINE_FILTERS, timelineSeries, trajectorySeries,
  workloadLandscape, consistencyMatrix, matrixCellDetail, goalContribution,
  productivityVelocity, deadlinePressureMap, comparisonSeries, explorableInsights,
  storySteps, completionEvents, COMPLETION_LABEL, NOT_ENOUGH,
} from '../lib/advancedAnalytics.js'

const LAB_VIEWS = [
  { id: 'story', label: 'Story', sub: 'Guided tour of your own data' },
  { id: 'timeline', label: 'Timeline', sub: 'Every completion and deadline' },
  { id: 'trajectory', label: 'Trajectory', sub: 'Past, current and projected' },
  { id: 'workload', label: 'Workload', sub: 'Landscape and deadline pressure' },
  { id: 'habits', label: 'Habits', sub: 'Consistency matrix' },
  { id: 'goals', label: 'Goals', sub: 'What contributes to each goal' },
  { id: 'trends', label: 'Trends', sub: 'Velocity and comparison' },
]

/* One visual language for every finding: headline, finding, evidence, detail. */
function Finding({ headline, finding, evidence = [], children, tone }) {
  return (
    <div className="lab-finding">
      <p className="lab-headline" data-tone={tone || undefined}>{headline}</p>
      {finding ? <p className="lab-detail">{finding}</p> : null}
      {evidence.length ? (
        <dl className="lab-evidence">
          {evidence.map((e, i) => (
            <div className="lab-ev" key={`${e.label}-${i}`}>
              <dt>{e.label}</dt>
              <dd>{e.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {children}
    </div>
  )
}

const NotEnough = ({ text }) => (
  <EmptyState icon={<IconSparkle size={20} />} title="Not enough data yet.">{text || NOT_ENOUGH}</EmptyState>
)

function Pill({ active, children, ...rest }) {
  return <button type="button" className={`chip${active ? ' is-active' : ''}`} aria-pressed={!!active} {...rest}>{children}</button>
}

/* ============================================================
   STORY MODE — five steps, each with its own evidence
   ============================================================ */
function StoryView({ state, now }) {
  const story = useMemo(() => storySteps(state, { now }), [state, now])
  const [step, setStep] = useState(0)
  const s = story.steps[step]

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowRight') setStep((v) => Math.min(story.steps.length - 1, v + 1))
      if (e.key === 'ArrowLeft') setStep((v) => Math.max(0, v - 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [story.steps.length])

  if (!story.enough) return <NotEnough text="Log a few habits or tasks and your story will build itself from them." />

  return (
    <div className="lab-story">
      <SectionCard className="pad">
        <CardHead title="Your data story"><span className="tiny muted">{`${story.supported} of ${story.total} steps supported by real data`}</span></CardHead>
        <p className="card-blurb">
          {story.reason} Generated {shortDate(story.generatedOn)}. Use ← and → to move between steps.
        </p>
        <div className="lab-steps" role="tablist" aria-label="Story steps">
          {story.steps.map((st, i) => (
            <button
              key={st.id} type="button" role="tab" aria-selected={i === step}
              className={`chip${i === step ? ' is-active' : ''}`}
              onClick={() => setStep(i)}
            >
              {i + 1}. {st.question}
            </button>
          ))}
        </div>
      </SectionCard>

      <SectionCard className="pad">
        <CardHead title={s.question}><span className="tiny muted">{s.enough ? null : 'no data'}</span></CardHead>
        <Finding headline={s.headline} finding={s.enough ? s.finding : null} evidence={s.evidence} tone={s.tone}>
          {!s.enough ? <p className="muted small">{NOT_ENOUGH}</p> : null}
        </Finding>
        {s.enough && s.detail?.length ? (
          <div className="lab-story-detail">
            <p className="lab-sec-title">Evidence detail</p>
            <ul className="plain-list">
              {s.detail.slice(0, 8).map((d, i) => (
                <li key={i} className="plain-row">
                  <span className="strong">{d.label || d.name || d.title || d.start || d.date || d.id}</span>
                  <span className="muted">
                    {d.value != null ? String(d.value)
                      : d.count != null ? `${d.count} completions`
                        : d.pct != null ? `${d.pct}%`
                          : d.committedMin != null ? minutesLabel(d.committedMin)
                            : d.status || ''}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </SectionCard>
    </div>
  )
}

/* ============================================================
   TIMELINE
   ============================================================ */
function TimelineView({ state, now }) {
  const [rangeId, setRangeId] = useState('30d')
  const [filter, setFilter] = useState('all')
  const data = useMemo(() => timelineSeries(state, { rangeId, filter, now }), [state, rangeId, filter, now])

  const counts = useMemo(() => Object.entries(data.counts), [data.counts])

  return (
    <div className="lab-timeline">
      <SectionCard className="pad">
        <CardHead title="Productivity timeline"><span className="tiny muted">{`${data.count} events`}</span></CardHead>
        <p className="card-blurb">Habits, tasks, subtasks, milestones, focus sessions and deadlines — one dated stream.</p>
        <div className="chip-row" role="group" aria-label="Time range">
          {TIMELINE_RANGES.map((r) => (
            <Pill key={r.id} active={rangeId === r.id} onClick={() => setRangeId(r.id)}>{r.label}</Pill>
          ))}
        </div>
        <div className="chip-row wrap" role="group" aria-label="Filter by kind">
          {TIMELINE_FILTERS.map((f) => (
            <Pill key={f.id} active={filter === f.id} onClick={() => setFilter(f.id)}>
              {f.label}{f.id !== 'all' && data.counts[f.id] ? ` · ${data.counts[f.id]}` : ''}
            </Pill>
          ))}
        </div>
      </SectionCard>

      {!data.enough ? (
        <SectionCard className="pad"><NotEnough text="Nothing was completed in this window yet." /></SectionCard>
      ) : (
        <>
          <SectionCard className="pad">
            <CardHead title="Mix"></CardHead>
            <p className="lab-detail">What this window is made of.</p>
            <BucketColumns rows={counts.map(([k, v]) => ({ label: TIMELINE_FILTERS.find((f) => f.id === k)?.label || k, value: v }))} unit=" events" />
          </SectionCard>
          <SectionCard className="pad">
            <CardHead title="Events"></CardHead>
            <ol className="plain-list">
              {data.groups.map((g) => (
                <li key={g.day} className="tl-group">
                  <p className="tl-day">{g.weekday} · {shortDate(g.day)}</p>
                  <ul className="plain-list">
                    {g.events.map((e, i) => (
                      <li key={`${g.day}-${i}`} className="plain-row">
                        <span className="strong">{e.title}</span>
                        <span className="muted">{e.body || e.kind}</span>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          </SectionCard>
        </>
      )}
    </div>
  )
}

/* ============================================================
   TRAJECTORY
   ============================================================ */
function TrajectoryView({ state, now }) {
  const entities = useMemo(() => [
    ...((state.goals || []).filter((g) => !g.archived).map((g) => ({ kind: 'goal', id: g.id, name: g.title }))),
    ...((state.projects || []).filter((p) => !p.archived).map((p) => ({ kind: 'project', id: p.id, name: p.name }))),
    ...((state.assignments || []).filter((a) => !a.archived).map((a) => ({ kind: 'assignment', id: a.id, name: a.name }))),
    ...((state.habits || []).filter((h) => !h.archived).map((h) => ({ kind: 'habit', id: h.id, name: h.name }))),
  ], [state])

  const [sel, setSel] = useState(null)
  const [days, setDays] = useState(30)
  const active = sel && entities.find((e) => `${e.kind}:${e.id}` === sel) ? entities.find((e) => `${e.kind}:${e.id}` === sel) : entities[0] || null
  const traj = useMemo(() => (active ? trajectorySeries(state, { kind: active.kind, id: active.id, days, now }) : null), [state, active, days, now])

  if (!entities.length) return <NotEnough text="Create a goal, project, assignment or habit to see a trajectory." />

  const series = traj?.past?.length
    ? [{ id: 'actual', name: 'Actual', points: traj.past.map((r) => ({ date: r.day || r.date, value: r.pct })), tone: 'accent' }]
    : []
  if (traj?.expected?.length) {
    series.push({ id: 'expected', name: 'Expected', points: traj.expected.map((r) => ({ date: r.day || r.date, value: r.pct })), tone: 'muted', dashed: true })
  }

  return (
    <div className="lab-trajectory">
      <SectionCard className="pad">
        <CardHead title="Performance trajectory"><span className="tiny muted">{active ? active.kind : null}</span></CardHead>
        <p className="card-blurb">Past from real progress, current from the live engine, projection from the same deterministic forecast the rest of the app uses.</p>
        <div className="chip-row wrap" role="group" aria-label="Choose what to track">
          {entities.slice(0, 24).map((e) => (
            <Pill key={`${e.kind}:${e.id}`} active={active && active.id === e.id && active.kind === e.kind} onClick={() => setSel(`${e.kind}:${e.id}`)}>{e.name}</Pill>
          ))}
        </div>
        <div className="chip-row" role="group" aria-label="Window">
          {[14, 30, 90].map((d) => <Pill key={d} active={days === d} onClick={() => setDays(d)}>{d}d</Pill>)}
        </div>
      </SectionCard>

      {traj && (
        <SectionCard className="pad">
          <CardHead title={traj.name || 'Trajectory'} />
          <Finding
            headline={traj.enough
              ? `${traj.current == null ? 'No current figure' : `${traj.current}% now`}${traj.projected ? ` · projected to finish ${shortDate(traj.projected)}` : ''}`
              : NOT_ENOUGH}
            finding={traj.reason}
            tone={traj.risk === 'overdue' || traj.risk === 'behind' ? 'bad' : undefined}
            evidence={[
              { label: 'Current', value: traj.current == null ? '—' : `${traj.current}%` },
              { label: 'Projected', value: traj.projected ? shortDate(traj.projected) : 'not projected' },
              ...(traj.velocity != null ? [{ label: 'Velocity', value: `${traj.velocity} ${traj.velocityUnit || ''}` }] : []),
              ...(traj.streak != null ? [{ label: 'Current streak', value: `${traj.streak} days` }] : []),
              ...(traj.deadline ? [{ label: 'Deadline', value: shortDate(traj.deadline) }] : []),
            ]}
          >
            {traj.enough && series.length ? (
              <LineSeries series={series} height={170} unit="%" ariaLabel={`${traj.name} trajectory`} />
            ) : null}
            {traj.projectionState === 'not-applicable' ? (
              <p className="muted small">{traj.projectionReason}</p>
            ) : null}
          </Finding>
        </SectionCard>
      )}
    </div>
  )
}

/* ============================================================
   WORKLOAD LANDSCAPE + DEADLINE PRESSURE
   ============================================================ */
function WorkloadView({ state, now }) {
  const land = useMemo(() => workloadLandscape(state, { days: 14, now }), [state, now])
  const pressure = useMemo(() => deadlinePressureMap(state, { now }), [state, now])
  const [openDay, setOpenDay] = useState(null)

  return (
    <div className="lab-workload">
      <SectionCard className="pad">
        <CardHead title="Workload landscape"><span className="tiny muted">{land.capacityKnown ? `${minutesLabel(land.capacityMin)} capacity` : 'capacity not set'}</span></CardHead>
        <Finding
          headline={land.enough ? (land.peak ? `Heaviest day: ${land.peak.weekday} ${shortDate(land.peak.date)} at ${minutesLabel(land.peak.committedMin)}.` : 'Nothing committed yet.') : NOT_ENOUGH}
          finding={land.reason}
          tone={land.overloadedDays > 0 ? 'warn' : undefined}
          evidence={[
            { label: 'Committed', value: minutesLabel(land.totalMin) },
            { label: 'Mean loaded day', value: land.meanMin == null ? '—' : minutesLabel(land.meanMin) },
            { label: 'Days over capacity', value: land.capacityKnown ? String(land.overloadedDays) : 'unknown' },
          ]}
        >
          {land.enough ? (
            <LoadBars rows={land.rows} today={dayStr(now)} onSelect={(r) => setOpenDay(land.rows.find((x) => x.date === r.date))} />
          ) : null}
        </Finding>
      </SectionCard>

      <SectionCard className="pad">
        <CardHead title="Deadline pressure map"><span className="tiny muted">{`${pressure.total} items`}</span></CardHead>
        <Finding
          headline={pressure.enough
            ? (pressure.overdue ? `${pressure.overdue} already overdue · ${pressure.atRisk} at risk.` : 'Nothing overdue. Pressure is spread across the month.')
            : NOT_ENOUGH}
          finding={pressure.reason}
          tone={pressure.overdue > 0 ? 'bad' : pressure.atRisk > 0 ? 'warn' : undefined}
          evidence={pressure.rows.map((r) => ({ label: r.label, value: r.count ? `${r.count} · ${minutesLabel(r.minutes)}` : '—' }))}
        >
          {pressure.enough ? (
            <ul className="plain-list">
              {pressure.rows.filter((r) => r.count).map((r) => (
                <li key={r.id} className="tl-group">
                  <p className="tl-day">{r.label} · {r.count} item{r.count === 1 ? '' : 's'}</p>
                  <ul className="plain-list">
                    {r.items.slice(0, 4).map((i) => (
                      <li key={`${i.kind}-${i.id}`} className="plain-row">
                        <button type="button" className="linkish" onClick={() => navigate(i.href)}>{i.name}</button>
                        <span className="muted">{i.status} · {i.pct}% · {minutesLabel(i.minutes)} left</span>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          ) : null}
        </Finding>
      </SectionCard>

      <Sheet open={!!openDay} onClose={() => setOpenDay(null)} title={openDay ? `${openDay.weekday} ${shortDate(openDay.date)}` : ''}>
        {openDay && (
          <Finding
            headline={`${minutesLabel(openDay.committedMin)} committed across ${openDay.count} item${openDay.count === 1 ? '' : 's'}.`}
            finding={openDay.overloaded && openDay.capacityMin ? `${minutesLabel(Math.abs(openDay.remainingMin))} over your capacity.` : 'Here is what lands on that day.'}
            tone={openDay.overloaded ? 'warn' : undefined}
            evidence={[
              { label: 'Capacity', value: openDay.capacityMin == null ? 'not set' : minutesLabel(openDay.capacityMin) },
              { label: 'Remaining', value: openDay.remainingMin == null ? 'unknown' : minutesLabel(Math.max(0, openDay.remainingMin)) },
            ]}
          >
            <ul className="plain-list">
              {openDay.items.map((i, k) => (
                <li key={`${i.kind}-${i.id}-${k}`} className="plain-row">
                  <button type="button" className="linkish" onClick={() => navigate(i.href)}>{i.name}</button>
                  <span className="muted">{i.kind} · {i.status}{i.minutes ? ` · ${minutesLabel(i.minutes)}` : ''}</span>
                </li>
              ))}
            </ul>
          </Finding>
        )}
      </Sheet>
    </div>
  )
}

/* ============================================================
   HABIT CONSISTENCY MATRIX with cell drill-down
   ============================================================ */
function HabitsView({ state, now }) {
  const [days, setDays] = useState(28)
  const [cell, setCell] = useState(null)
  const m = useMemo(() => consistencyMatrix(state, { days, now }), [state, days, now])
  const weekLabels = useMemo(() => {
    const out = []
    for (let i = 0; i < m.dates.length; i += 7) out.push({ label: shortDate(m.dates[i]), span: Math.min(7, m.dates.length - i) })
    return out
  }, [m.dates])

  const detail = useMemo(() => (cell ? matrixCellDetail(state, cell.habit, cell.date) : null), [state, cell])
  const onCellTap = useCallback((habit, c) => setCell({ habit, date: c.date }), [])

  if (!m.enough) return <NotEnough text="Add a habit and log a few days to build the matrix." />

  return (
    <div className="lab-habits">
      <SectionCard className="pad">
        <CardHead title="Habit consistency matrix"><span className="tiny muted">{`${m.rows.length} habits · ${days}d`}</span></CardHead>
        <p className="card-blurb">Tap any cell to see exactly what happened that day. Range and weekday roll-up below.</p>
        <div className="chip-row" role="group" aria-label="Range">
          {[14, 28, 60, 90].map((d) => <Pill key={d} active={days === d} onClick={() => setDays(d)}>{d}d</Pill>)}
        </div>
        <HabitMatrix rows={m.rows.map((r) => ({ habit: r.habit, cells: r.cells }))} days={m.dates} weekLabels={weekLabels} onCellTap={onCellTap} />
      </SectionCard>

      <SectionCard className="pad">
        <CardHead title="Weekday pattern"><span className="tiny muted">{m.best ? `best: ${m.best.name}` : null}</span></CardHead>
        <Finding
          headline={m.best && m.worst && m.best.weekday !== m.worst.weekday
            ? `${m.best.name}s run at ${m.best.pct}%, ${m.worst.name}s at ${m.worst.pct}%.`
            : 'Not enough scheduled days per weekday to compare yet.'}
          finding="Percentages need at least three scheduled days on that weekday before they are shown."
          evidence={m.weekday.map((w) => ({ label: w.short, value: w.pct == null ? '—' : `${w.pct}%` }))}
        />
      </SectionCard>

      <SectionCard className="pad">
        <CardHead title="Per habit"></CardHead>
        <HBarList
          rows={m.rows.map((r) => ({ label: r.habit.name, value: r.pct, sub: r.pct == null ? 'not enough' : `${r.done}/${r.scheduled} days` }))}
          unit="%"
          emptyText={NOT_ENOUGH}
        />
      </SectionCard>

      <Sheet open={!!cell} onClose={() => setCell(null)} title={cell ? `${cell.habit.name} · ${shortDate(cell.date)}` : ''}>
        {detail && (
          <Finding
            headline={detail.done ? 'Completed.' : detail.scheduled ? 'Scheduled and not completed.' : 'Not scheduled on this day.'}
            finding={detail.reason}
            tone={detail.done ? 'good' : detail.scheduled ? 'warn' : undefined}
            evidence={[
              { label: 'Date', value: detail.date },
              { label: 'Scheduled', value: detail.scheduled ? 'yes' : 'no' },
              { label: 'Completed', value: detail.done ? 'yes' : 'no' },
              ...(detail.at ? [{ label: 'Logged at', value: String(detail.at).slice(11, 16) }] : []),
              ...(detail.skipped ? [{ label: 'Skipped', value: 'yes' }] : []),
              ...(detail.paused ? [{ label: 'Paused', value: 'yes' }] : []),
              { label: 'Current streak', value: `${detail.streak} days` },
            ]}
          >
            {detail.note ? <p className="lab-detail">Note: {detail.note}</p> : null}
          </Finding>
        )}
      </Sheet>
    </div>
  )
}

/* ============================================================
   GOAL CONTRIBUTION
   ============================================================ */
function GoalsView({ state, now }) {
  const goals = useMemo(() => (state.goals || []).filter((g) => !g.archived), [state])
  const [sel, setSel] = useState(null)
  const goal = goals.find((g) => g.id === sel) || goals[0] || null
  const c = useMemo(() => goalContribution(state, goal, { now }), [state, goal, now])

  if (!goals.length) return <NotEnough text="Create a goal and link projects, assignments or habits to it." />

  return (
    <div className="lab-goals">
      <SectionCard className="pad">
        <CardHead title="Goal contribution"><span className="tiny muted">{goal ? `${c.counts.linked} linked` : null}</span></CardHead>
        <p className="card-blurb">Goal → milestones → projects and assignments → habits, using the same share arithmetic the rest of the app uses.</p>
        <div className="chip-row wrap" role="group" aria-label="Goal">
          {goals.map((g) => <Pill key={g.id} active={goal?.id === g.id} onClick={() => setSel(g.id)}>{g.title}</Pill>)}
        </div>
      </SectionCard>

      {goal && (
        <SectionCard className="pad">
          <CardHead title={goal.title}><span className="tiny muted">{`${c.goal.pct}%`}</span></CardHead>
          <Finding
            headline={c.enough ? c.reason : c.reason}
            finding={c.goal.targetDate ? `Target ${shortDate(c.goal.targetDate)}${c.goal.expected != null ? ` · ${c.goal.expected}% expected by now` : ''}` : 'No target date set.'}
            evidence={[
              { label: 'Milestones', value: String(c.counts.milestones) },
              { label: 'Projects', value: String(c.counts.projects) },
              { label: 'Assignments', value: String(c.counts.assignments) },
              { label: 'Habits', value: String(c.counts.habits) },
            ]}
          >
            <HBarList
              rows={c.shares.map((r) => ({ label: r.name, value: r.share == null ? 0 : r.share, sub: r.share == null ? 'no progress' : `${r.pct}% complete` }))}
              unit="%"
              emptyText="Nothing linked has measurable progress yet."
            />
          </Finding>
        </SectionCard>
      )}

      {goal && c.milestones.length ? (
        <SectionCard className="pad">
          <CardHead title="Milestones"></CardHead>
          <ul className="plain-list">
            {c.milestones.map((m) => (
              <li key={m.id} className="plain-row">
                <span className="strong">{m.name}</span>
                <span className="muted">
                  {m.done ? `done${m.onTime === false ? ' · late' : m.onTime ? ' · on time' : ''}` : m.targetDate ? (m.overdue ? `overdue ${shortDate(m.targetDate)}` : `due ${shortDate(m.targetDate)}`) : 'no date'}
                </span>
              </li>
            ))}
          </ul>
        </SectionCard>
      ) : null}

      {goal && (c.projects.length || c.assignments.length) ? (
        <SectionCard className="pad">
          <CardHead title="Work behind it"></CardHead>
          <ul className="plain-list">
            {[...c.projects, ...c.assignments].map((w) => (
              <li key={`${w.id}`} className="plain-row">
                <span className="strong">{w.name}</span>
                <span className="muted">{w.status} · {w.pct}% · {w.tasksDone ?? w.subtasksDone}/{w.tasks ?? w.subtasks} done</span>
              </li>
            ))}
          </ul>
        </SectionCard>
      ) : null}

      {goal && c.habits.length ? (
        <SectionCard className="pad">
          <CardHead title="Habits feeding it"></CardHead>
          <HBarList
            rows={c.habits.map((h) => ({ label: h.name, value: h.pct, sub: h.pct == null ? 'no data' : `${h.done}/${h.scheduled} days` }))}
            unit="%"
          />
          <p className="muted small">Habits carry no contribution percentage — a habit is cadence, not a share of the goal.</p>
        </SectionCard>
      ) : null}
    </div>
  )
}

/* ============================================================
   VELOCITY + COMPARISON
   ============================================================ */
function TrendsView({ state, now }) {
  const [win, setWin] = useState('week')
  const v = useMemo(() => productivityVelocity(state, { weeks: 8, now }), [state, now])
  const cmpData = useMemo(() => comparisonSeries(state, { window: win, now }), [state, win, now])
  const insights = useMemo(() => explorableInsights(state, { limit: 6, now }), [state, now])
  const [openInsight, setOpenInsight] = useState(null)

  const weekBars = useMemo(() => v.rows.map((r) => ({
    label: r.label,
    pct: v.current && v.current.count ? Math.round((r.count / Math.max(1, ...v.rows.map((x) => x.count))) * 100) : null,
    count: r.count,
  })), [v])

  const kindRows = useMemo(() => Object.entries(v.byKind)
    .map(([k, n]) => ({ label: COMPLETION_LABEL[k] || k, value: n }))
    .sort((a, b) => b.value - a.value), [v.byKind])
  const maxKind = Math.max(1, ...kindRows.map((r) => r.value))

  return (
    <div className="lab-trends">
      <SectionCard className="pad">
        <CardHead title="Productivity velocity"><span className="tiny muted">{v.enough ? v.trend : 'insufficient'}</span></CardHead>
        <Finding
          headline={v.enough ? `${v.current.count} this week vs ${v.previous.count} last week — ${v.trend.toLowerCase()}.` : NOT_ENOUGH}
          finding={v.reason}
          tone={v.trend === 'DECELERATING' ? 'warn' : v.trend === 'ACCELERATING' ? 'good' : undefined}
          evidence={[
            { label: 'This week', value: v.current ? String(v.current.count) : '—' },
            { label: 'Last week', value: v.previous ? String(v.previous.count) : '—' },
            { label: 'Baseline', value: v.baseline == null ? 'needs 2+ weeks' : `${v.baseline}/week` },
            { label: 'Acceleration', value: v.acceleration == null ? '—' : `${v.acceleration > 0 ? '+' : ''}${v.acceleration}` },
          ]}
        >
          {v.rows.length ? <TrendChart data={weekBars.map((r) => ({ date: r.label, pct: r.pct }))} /> : null}
          {kindRows.length ? (
            <>
              <p className="lab-sec-title">What got completed</p>
              <HBarList rows={kindRows} max={maxKind} unit="" emptyText={NOT_ENOUGH} />
            </>
          ) : null}
        </Finding>
      </SectionCard>

      <SectionCard className="pad">
        <CardHead title="Comparison mode"><span className="tiny muted">{`${cmpData.shown.length}/${cmpData.metrics.length} available`}</span></CardHead>
        <p className="card-blurb">Both windows must hold real data before a comparison is shown.</p>
        <div className="chip-row" role="group" aria-label="Comparison window">
          <Pill active={win === 'week'} onClick={() => setWin('week')}>Week</Pill>
          <Pill active={win === 'month'} onClick={() => setWin('month')}>Month</Pill>
        </div>
        {!cmpData.enough ? <NotEnough text={NOT_ENOUGH} /> : (
          <Finding headline={`${cmpData.shown.length} of ${cmpData.metrics.length} comparisons have real data on both sides.`} finding={cmpData.reason}>
            {cmpData.metrics.map((m) => (
              <div key={m.label} className="lab-cmp">
                <p className="lab-cmp-head">
                  <span className="strong">{m.label}</span>
                  <span className={`lab-cmp-delta${m.direction ? ` is-${m.direction}` : ''}`}>
                    {m.enough ? `${m.delta > 0 ? '+' : ''}${m.delta}${m.unit === '%' ? '%' : ` ${m.unit}`}` : NOT_ENOUGH}
                  </span>
                </p>
                {m.enough ? (
                  <CompareBars
                    a={{ label: 'Previous', value: m.previous, color: 'var(--text-3)' }}
                    b={{ label: 'Current', value: m.current, color: 'var(--accent-2)' }}
                    unit={m.unit === '%' ? '%' : ''}
                  />
                ) : null}
              </div>
            ))}
          </Finding>
        )}
      </SectionCard>

      <SectionCard className="pad">
        <CardHead title="Why the numbers moved"><span className="tiny muted">{`${insights.length} explorable`}</span></CardHead>
        <p className="card-blurb">Observation → evidence → the data behind it. Tap any insight to drill down.</p>
        {insights.length ? (
          <ul className="insight-list">
            {insights.map((i) => (
              <li key={i.id} className="insight-item">
                <div className="insight-body">
                  <h3 className="insight-title">{i.title}</h3>
                  <p className="insight-text">{i.text}</p>
                  <button type="button" className="btn tiny" onClick={() => setOpenInsight(i)}>See the data behind this</button>
                </div>
                {i.metric ? <span className="insight-metric">{i.metric}</span> : null}
              </li>
            ))}
          </ul>
        ) : <NotEnough />}
      </SectionCard>

      <Sheet open={!!openInsight} onClose={() => setOpenInsight(null)} title={openInsight?.title || ''}>
        {openInsight?.drilldown && (
          <Finding
            headline={openInsight.drilldown.observation || openInsight.text}
            finding={openInsight.drilldown.reason}
            evidence={openInsight.drilldown.evidence || []}
          >
            {openInsight.drilldown.detail?.length ? (
              <>
                <p className="lab-sec-title">Evidence detail</p>
                <ul className="plain-list">
                  {openInsight.drilldown.detail.slice(0, 10).map((d, k) => (
                    <li key={k} className="plain-row">
                      <span className="strong">{d.date || d.label || d.name || d.start || k}</span>
                      <span className="muted">
                        {d.pct != null ? `${d.pct}%`
                          : d.committedMin != null ? minutesLabel(d.committedMin)
                            : d.count != null ? String(d.count)
                              : d.value != null ? String(d.value) : d.status || ''}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
            {openInsight.drilldown.items?.length ? (
              <>
                <p className="lab-sec-title">What created it</p>
                <ul className="plain-list">
                  {openInsight.drilldown.items.slice(0, 10).map((it, k) => (
                    <li key={k} className="plain-row">
                      {it.href
                        ? <button type="button" className="linkish" onClick={() => navigate(it.href)}>{it.name}</button>
                        : <span className="strong">{it.name || it.label || String(it)}</span>}
                      <span className="muted">{it.kind || ''}</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </Finding>
        )}
      </Sheet>
    </div>
  )
}

/* ============================================================
   SHELL
   ============================================================ */
export default function AnalyticsLab() {
  const { state } = useStore()
  const [view, setView] = useState('story')
  const now = useMemo(() => new Date(), [])
  const today = dayStr(now)

  /* Defensive net: InsightsScreen already gates on habit history, so this
     is the backstop rather than a second onboarding screen. */
  const empty = useMemo(() => (
    (state.habits || []).length === 0
    && (state.projects || []).length === 0
    && (state.assignments || []).length === 0
    && (state.goals || []).length === 0
    && completionEvents(state).length === 0
  ), [state])

  if (empty) {
    return (
      <EmptyState
        icon={<IconInsights size={28} />}
        title="Nothing to analyse yet."
        action={(
          <div className="btn-row">
            <button type="button" className="btn primary" onClick={() => navigate('/habits')}>Add a habit</button>
            <button type="button" className="btn" onClick={() => navigate('/work')}>Add a project</button>
          </div>
        )}
      >
        Once you have a few habits, projects or check-ins, this lab builds every chart from
        your own logged data — no samples, no estimates.
      </EmptyState>
    )
  }

  const active = LAB_VIEWS.find((v) => v.id === view) || LAB_VIEWS[0]

  return (
    <div className="lab">
      <div className="lab-tabs" role="tablist" aria-label="Analytics lab views">
        {LAB_VIEWS.map((v) => (
          <button
            key={v.id} type="button" role="tab" aria-selected={v.id === view}
            className={`chip lab-tab${v.id === view ? ' is-active' : ''}`}
            onClick={() => setView(v.id)}
          >
            {v.label}
          </button>
        ))}
      </div>
      <p className="lab-sub">{active.sub} · as of {shortDate(today)}</p>

      {view === 'story' && <StoryView state={state} now={now} />}
      {view === 'timeline' && <TimelineView state={state} now={now} />}
      {view === 'trajectory' && <TrajectoryView state={state} now={now} />}
      {view === 'workload' && <WorkloadView state={state} now={now} />}
      {view === 'habits' && <HabitsView state={state} now={now} />}
      {view === 'goals' && <GoalsView state={state} now={now} />}
      {view === 'trends' && <TrendsView state={state} now={now} />}
    </div>
  )
}
