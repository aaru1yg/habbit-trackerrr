import { Button, Status, Stack, Cluster, Text } from '../primitives/index.js'
import NowRing from './NowRing.jsx'
import {
  IconCheck, IconClock, IconAlert, IconFlame, IconTarget, IconCalendar,
  IconArrowUpRight, IconHourglass,
} from '../../lib/icons.jsx'
import { Link } from '../../lib/router.jsx'
import { prettyDate, dueLabel } from '../../lib/dates.js'
import { habitStreak } from '../../lib/stats.js'
import { assignmentProgress, projectProgress } from '../../lib/work.js'

/**
 * Map a NextAction urgency + kind to a ring/eyebrow tone. Entity colors
 * (if present on the item) override the semantic stroke so habits/projects
 * can carry their own accent without hardcoding a palette here.
 */
function resolveTone(urgency) {
  if (urgency === 'OVERDUE' || urgency === 'CRITICAL') return 'danger'
  if (urgency === 'AT RISK') return 'warning'
  return 'accent'
}
function entityColorFor(item) {
  if (!item) return null
  return item.color || item.accent || null
}

/**
 * NextAction (NOW) — dominant area. One action, one hierarchy.
 *
 * Refinement #1 adds a signature circular progress object (NowRing)
 * that supports rather than dominates the action. One subtle inset
 * surface + thin hairline gives the object quiet depth without
 * glass/glow/giant shadows.
 *
 * Modes:
 *   - 'next': next best action — ring + eyebrow + title + why + 2–3 meta + CTAs
 *   - 'done': all today's work complete (ring 100% + check, success tone)
 *   - 'empty': nothing scheduled — no ring, single CTA
 *   - 'overloaded': capacity exceeded — no ring, amber guidance
 */
export default function NextAction({
  mode = 'next',
  entry,
  stats,
  workload,
  onComplete,
  onFocus,
  onStart,
  today,
  state,
}) {
  const variantClass = mode === 'done'
    ? 'today-now today-now--done'
    : mode === 'empty'
      ? 'today-now today-now--empty'
      : mode === 'overloaded'
        ? 'today-now today-now--overloaded'
        : 'today-now'

  if (mode === 'empty') {
    return (
      <section className={variantClass} aria-labelledby="now-heading">
        <span className="today-now__eyebrow">
          <Status tone="neutral">Now</Status>
        </span>
        <h2 id="now-heading" className="today-now__title">Nothing needs your attention yet.</h2>
        <p className="today-now__why">
          Build a plan for today to set your first action, or start with one habit to begin tracking.
        </p>
        <div className="today-now__actions">
          <Button variant="primary" onClick={onStart}>Plan my day</Button>
          <Button variant="quiet" onClick={onFocus} aria-label="Start a focus session">Focus</Button>
        </div>
      </section>
    )
  }

  if (mode === 'done') {
    return (
      <section className={variantClass} aria-labelledby="now-heading">
        <div className="today-now__surface">
          <div className="today-now__object">
            <NowRing
              pct={100}
              complete
              tone="success"
              size={84}
              stroke={4}
              label={`${stats.done}/${stats.total} complete today`}
            />
            <div className="today-now__body">
              <span className="today-now__eyebrow">
                <Status tone="success">All done</Status>
              </span>
              <h2 id="now-heading" className="today-now__title">
                Everything planned for today is complete.
              </h2>
              <p className="today-now__why">
                {stats.done}/{stats.total} finished
                {stats.total ? ` — ${stats.pct}% of today's habits logged.` : '.'} Keep the rest of the day open.
              </p>
              <div className="today-done-summary">
                <Stack gap="micro">
                  <Cluster gap="compact">
                    <span className="today-now__tag today-now__tag--success">Day complete</span>
                    <Text level="caption">{prettyDate(today)}</Text>
                  </Cluster>
                </Stack>
              </div>
            </div>
          </div>
        </div>
        <div className="today-now__actions">
          <Button variant="secondary" onClick={onFocus}>Start a focus session</Button>
          <Button variant="quiet" as={Link} to="insights">Review your week <IconArrowUpRight size={14} /></Button>
        </div>
      </section>
    )
  }

  if (mode === 'overloaded' && workload?.overloaded) {
    return (
      <section className={variantClass} aria-labelledby="now-heading">
        <span className="today-now__eyebrow">
          <Status tone="warning">Overloaded</Status>
        </span>
        <h2 id="now-heading" className="today-now__title">Today looks tighter than your capacity.</h2>
        <p className="today-now__why">{workload.reason}</p>
        <div className="today-now__actions">
          <Button variant="primary" onClick={onStart}>Plan my day</Button>
          <Button variant="quiet" onClick={onFocus}>Focus on one thing</Button>
        </div>
      </section>
    )
  }

  // --- Normal next-best-action mode ---
  const { kind, item, reason, urgency, estimatedMin, deadline } = entry
  const name = item.label || item.name
  const href = hrefFor(kind, item)
  const progress = kindProgress(kind, item)
  const streak = kind === 'habit' ? habitStreak(state, item) : 0

  const tone = resolveTone(urgency)
  const entityColor = entityColorFor(item)
  const typeLabel = KIND_LABEL[kind] || kind
  const canComplete = COMPLETABLE.has(kind)

  // Curate meta to the 2–3 most decision-useful facts.
  const metaFacts = []
  if (estimatedMin != null && estimatedMin > 0) {
    metaFacts.push({ icon: <IconClock size={14} />, text: `~${Math.round(estimatedMin)} min` })
  }
  if (deadline) {
    metaFacts.push({ icon: <IconCalendar size={14} />, text: dueLabel(deadline) })
  }
  if (progress != null && progress > 0 && progress < 100) {
    metaFacts.push({ icon: <IconHourglass size={14} />, text: `${progress}% done` })
  }
  if (urgency === 'OVERDUE') {
    metaFacts.push({ icon: <IconAlert size={14} />, text: 'Overdue', danger: true })
  }

  const ringAriaLabel = progress != null
    ? `${name} — ${Math.round(progress)}% complete`
    : name

  return (
    <section className={variantClass} aria-labelledby="now-heading">
      <div className="today-now__surface" data-tone={tone}>
        <div className="today-now__object">
          <NowRing
            pct={progress}
            tone={tone}
            color={entityColor}
            size={84}
            stroke={4}
            label={ringAriaLabel}
          />
          <div className="today-now__body">
            <span className="today-now__eyebrow">
              <Status tone={tone === 'danger' ? 'danger' : tone === 'warning' ? 'warning' : 'neutral'}>Now</Status>
              <span className="today-now__type">{typeLabel}</span>
              {streak >= 3
                ? <span className="today-now__streak"><IconFlame size={12} /> {streak}d</span>
                : null}
            </span>

            <h2 id="now-heading" className="today-now__title">{name}</h2>

            <p className="today-now__why">{reason}</p>

            {metaFacts.length > 0 && (
              <div className="today-now__meta">
                {metaFacts.map((f, i) => (
                  <span
                    key={i}
                    className={'today-now__meta-item' + (f.danger ? ' today-now__meta-item--danger' : '')}
                  >
                    {f.icon}{f.text}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="today-now__actions">
        {canComplete ? (
          <Button
            variant="primary"
            icon={<IconCheck size={16} />}
            onClick={() => onComplete?.(entry)}
            aria-label={`Complete ${name}`}
          >
            {kind === 'habit' ? 'Complete' : 'Mark complete'}
          </Button>
        ) : (
          <Button
            variant="primary"
            icon={<IconTarget size={16} />}
            onClick={onFocus}
            aria-label={`Start focus on ${name}`}
          >
            Start focus
          </Button>
        )}
        <Button variant="secondary" as={Link} to={href}>
          View <IconArrowUpRight size={14} />
        </Button>
      </div>
    </section>
  )
}

const COMPLETABLE = new Set(['habit', 'assignment', 'project-task', 'goal-milestone'])

const KIND_LABEL = {
  habit: 'Habit',
  assignment: 'Assignment',
  project: 'Project',
  'project-task': 'Task',
  'goal-milestone': 'Milestone',
}

function kindProgress(kind, item) {
  if (kind === 'assignment') return assignmentProgress(item).pct
  if (kind === 'project') return projectProgress(item).pct
  if (kind === 'project-task') return item.done ? 100 : 0
  if (kind === 'goal-milestone') return item.done ? 100 : 0
  return null
}

function hrefFor(kind, item) {
  switch (kind) {
    case 'habit': return `habits/${item.id}`
    case 'assignment': return `assignments/${item.id}`
    case 'project': return `projects/${item.id}`
    case 'project-task': return `projects/${item.projectId}`
    case 'goal-milestone': return 'goals'
    default: return 'today'
  }
}
