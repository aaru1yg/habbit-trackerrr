/* ============================================================
   GOALS · DIRECTION (§23 reframed)
   Goals are the long view: why you are doing things.
   Projects are how you execute them, habits are how you repeat.
   This screen never duplicates project CRUD — it links the two
   sides together and shows which habits support which goal.
   ============================================================ */
import { useMemo, useState } from 'react'
import { useStore } from '../store.jsx'
import SectionCard, { CardHead } from '../components/ui/SectionCard.jsx'
import EmptyState from '../components/ui/EmptyState.jsx'
import { Meter, StatStrip, CountdownChip } from '../components/work/WorkKit.jsx'
import { useWorkUI } from '../components/work/WorkUIProvider.jsx'
import { useHabitUI } from '../components/habits/HabitUIProvider.jsx'
import { activeHabits, habitRate, habitStreak } from '../lib/stats.js'
import { projectStatus, projectProgress } from '../lib/work.js'
import { categoryOf } from '../lib/schedule.js'
import { todayStr, subDaysStr, prettyDate } from '../lib/dates.js'
import { Link } from '../lib/router.jsx'
import { IconGoals, IconPlus, IconFlame, IconProjects, IconChevronRight, IconCheck, IconLink } from '../lib/icons.jsx'

export default function GoalsScreen() {
  const { state, dispatch } = useStore()
  const work = useWorkUI()
  const habitUI = useHabitUI()
  const today = todayStr()
  const from = subDaysStr(today, 29)

  const projects = useMemo(() => (state.projects || []).filter((p) => !p.completedAt && !p.archived), [state])
  const reached = useMemo(
    () => (state.projects || []).filter((p) => p.completedAt).sort((a, b) => String(b.completedAt).localeCompare(String(a.completedAt))),
    [state]
  )

  const open = useMemo(() => {
    return projects
      .map((p) => ({ project: p, status: projectStatus(p), progress: projectProgress(p) }))
      .sort((a, b) => {
        const ad = a.project.deadline ? String(a.project.deadline) : '9999'
        const bd = b.project.deadline ? String(b.project.deadline) : '9999'
        return ad.localeCompare(bd) || a.project.name.localeCompare(b.project.name)
      })
  }, [projects])

  const habits = activeHabits(state)
  const linkedIds = useMemo(() => new Set(projects.flatMap((p) => p.linkedHabitIds || [])), [projects])
  const unlinked = habits.filter((h) => !linkedIds.has(h.id))

  const nextDeadline = open.find((o) => o.project.deadline && !o.status.complete)?.project || null

  const cells = [
    { label: 'Open goals', value: open.length, note: open.length === 1 ? 'project' : 'projects' },
    { label: 'Habits linked', value: habits.length - unlinked.length, note: `of ${habits.length}` },
    {
      label: 'Next deadline',
      value: nextDeadline && nextDeadline.status.daysLeft != null ? `${nextDeadline.status.daysLeft}d` : '—',
      note: nextDeadline ? nextDeadline.project.name : 'none set',
      small: true,
    },
    { label: 'Reached', value: reached.length, note: 'all time' },
  ]

  const toggleLink = (project, habitId) => {
    const current = project.linkedHabitIds || []
    const next = current.includes(habitId) ? current.filter((id) => id !== habitId) : [...current, habitId]
    dispatch({ type: 'UPDATE_PROJECT', id: project.id, patch: { linkedHabitIds: next } })
  }

  return (
    <div className="screen" id="goals-screen">
      <header className="screen-head">
        <div>
          <h1 className="screen-title">Goals</h1>
          <p className="screen-sub">The long view. Projects execute it, habits repeat it.</p>
        </div>
        {open.length > 0 && (
          <button className="btn primary" onClick={work.newProject}>
            <IconPlus size={16} /> New goal
          </button>
        )}
      </header>

      <div className="stack">
        {projects.length === 0 && reached.length === 0 ? (
          <SectionCard>
            <EmptyState
              art="art/empty-hero.webp"
              icon={<IconGoals size={40} />}
              title="No goals yet"
              action={(
                <span className="empty-actions">
                  <button className="btn primary" onClick={work.newProject}><IconProjects size={16} /> Create a project</button>
                  <button className="btn" onClick={habitUI.openAdd}><IconFlame size={16} /> Add a habit</button>
                </span>
              )}
            >
              A goal is an outcome — something you finish, not something you repeat. Create one as a project and link the
              habits that carry it.
            </EmptyState>
          </SectionCard>
        ) : (
          <>
            <StatStrip cells={cells} />

            {open.length === 0 && (
              <SectionCard className="pad">
                <p className="empty-note">Every goal is reached or archived. Start a new one when you are ready.</p>
              </SectionCard>
            )}

            {open.map(({ project, status, progress }, i) => (
              <DirectionCard
                key={project.id}
                project={project}
                status={status}
                progress={progress}
                habits={habits}
                from={from}
                today={today}
                state={state}
                delay={i * 0.03}
                onToggleLink={toggleLink}
              />
            ))}

            {unlinked.length > 0 && (
              <SectionCard className="pad">
                <CardHead title="Habits not tied to a goal">
                  <span className="tiny muted tnum">{unlinked.length}</span>
                </CardHead>
                <p className="card-blurb">
                  That is fine — plenty of habits stand alone. Link one from a goal card above when it is carrying something bigger.
                </p>
                <div className="wrap-gap" style={{ gap: 6 }}>
                  {unlinked.map((h) => (
                    <span key={h.id} className="chip" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <span className="dot" style={{ background: `var(${categoryOf(h.category).cssVar})` }} />
                      {h.name}
                      <span className="tiny muted tnum">{habitStreak(state, h)}d</span>
                    </span>
                  ))}
                </div>
              </SectionCard>
            )}

            {reached.length > 0 && (
              <SectionCard className="pad">
                <CardHead title="Reached" />
                <div className="stack" style={{ gap: 8 }}>
                  {reached.map((p) => (
                    <div key={p.id} className="kv-row">
                      <span className="kv-k" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, color: 'var(--good)' }}>
                        <IconCheck size={14} /> {p.name}
                      </span>
                      <span className="kv-v muted">{p.completedAt ? prettyDate(String(p.completedAt).slice(0, 10)) : '—'}</span>
                    </div>
                  ))}
                </div>
              </SectionCard>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function DirectionCard({ project, status, progress, habits, from, today, state, delay = 0, onToggleLink }) {
  const [linkOpen, setLinkOpen] = useState(false)
  const linked = (project.linkedHabitIds || []).map((id) => habits.find((h) => h.id === id)).filter(Boolean)
  const cat = categoryOf(project.category)

  return (
    <SectionCard className="pad" delay={delay}>
      <div className="row-between" style={{ alignItems: 'flex-start', gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div className="wrap-gap" style={{ gap: 6, marginBottom: 7 }}>
            <span className="kind-tag project" aria-hidden="true" />
            <span className="chip">{cat.label}</span>
            {status.hasDeadline
              ? <CountdownChip status={status} />
              : <span className="chip">Open-ended</span>}
          </div>
          <Link to={`projects/${project.id}`} className="goal-name">{project.name}</Link>
          {project.description && <p className="card-blurb" style={{ marginTop: 6 }}>{project.description}</p>}
        </div>
        <div style={{ flex: 'none', textAlign: 'right' }}>
          <div className="meter-pct" style={{ fontSize: '1.5rem', lineHeight: 1 }}>{status.pct}%</div>
          <div className="tiny muted" style={{ marginTop: 4 }}>
            {progress.total > 0 ? `${progress.done}/${progress.total} tasks` : progress.mode === 'manual' ? 'manual' : 'no tasks yet'}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <Meter pct={status.pct} tone={status.tone} pace={status.elapsedPct}
          label={`${project.name}: ${status.pct}% complete${status.elapsedPct != null ? `, pace ${status.elapsedPct}%` : ''}`} />
      </div>

      <div className="row-between" style={{ marginTop: 14 }}>
        <p className="eyebrow" style={{ margin: 0 }}>Habits carrying this goal</p>
        <button className="btn ghost sm" onClick={() => setLinkOpen((o) => !o)} aria-expanded={linkOpen}>
          <IconLink size={14} /> {linkOpen ? 'Done' : linked.length ? 'Edit links' : 'Link habits'}
        </button>
      </div>

      {linkOpen ? (
        habits.length ? (
          <div className="wrap-gap" style={{ gap: 6, marginTop: 10 }}>
            {habits.map((h) => {
              const on = (project.linkedHabitIds || []).includes(h.id)
              return (
                <button
                  key={h.id}
                  type="button"
                  className="chip-btn"
                  aria-pressed={on}
                  onClick={() => onToggleLink(project, h.id)}
                >
                  {on && <IconCheck size={13} />}
                  {h.name}
                </button>
              )
            })}
          </div>
        ) : (
          <p className="empty-note" style={{ marginTop: 10 }}>Add a habit first, then link it here.</p>
        )
      ) : linked.length ? (
        <div className="stack" style={{ gap: 8, marginTop: 10 }}>
          {linked.map((h) => {
            const r = habitRate(state, h, from, today)
            const streak = habitStreak(state, h)
            return (
              <div key={h.id} className="goal-habit">
                <span className="dot" style={{ background: `var(${cat.cssVar})` }} />
                <span className="goal-habit-name ellipsis">{h.name}</span>
                {streak > 1 && (
                  <span className="tiny tnum" style={{ color: 'var(--warn)', fontWeight: 700, display: 'inline-flex', gap: 3, alignItems: 'center' }}>
                    <IconFlame size={12} />{streak}d
                  </span>
                )}
                <span className="tiny muted tnum" style={{ flex: 'none' }}>
                  {r.rate == null ? 'no data' : `${Math.round(r.rate * 100)}% · 30d`}
                </span>
              </div>
            )
          })}
        </div>
      ) : (
        <p className="tiny muted" style={{ marginTop: 8 }}>Nothing linked yet.</p>
      )}

      <div className="row-between" style={{ marginTop: 14 }}>
        <span className="tiny muted">
          {status.hasDeadline ? `Due ${prettyDate(String(project.deadline).slice(0, 10))}` : 'No deadline — this is direction, not a race'}
        </span>
        <Link to={`projects/${project.id}`} className="btn ghost sm">Open project <IconChevronRight size={14} /></Link>
      </div>
    </SectionCard>
  )
}
