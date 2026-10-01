/* ============================================================
   WORK CARD — projects and one-off tasks, one component.

   The v4 split (ProjectGallery / WorkCards / UniversalWorkRow /
   WorkEntity / DeadlineLanes all drawing the same thing four ways)
   collapses into this.
   ============================================================ */
import { Link } from '../../app/router.jsx'
import { workProgress, workStatus } from '../../core/compute.js'
import { countdown, fmtRelative, dayOf } from '../../core/date.js'
import { Surface, Bar, Badge } from '../../ui/index.jsx'
import { IconLayers, IconWork, IconClock } from '../../ui/icons.jsx'

export default function WorkCard({ item, depth = 1 }) {
  const pct = workProgress(item)
  const st = workStatus(item)
  const isProject = item.kind === 'project'
  const doneTasks = item.tasks.filter((t) => t.done).length

  return (
    <Surface as={Link} to={`work/${item.id}`} variant="flat" lift sheen depth={depth} className="wcard">
      <div className="wcard__top">
        <span className="wcard__kind" aria-hidden="true">
          {isProject ? <IconLayers size={17} /> : <IconWork size={17} />}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="wcard__title clamp2">{item.title}</div>
          <div className="tiny dim" style={{ marginTop: 2 }}>
            {isProject
              ? item.tasks.length
                ? `${doneTasks} of ${item.tasks.length} tasks`
                : 'No tasks yet'
              : 'Task'}
          </div>
        </div>
        <span className="wcard__pct num">{pct}%</span>
      </div>

      <Bar value={pct} tone={st.tone === 'accent' ? undefined : st.tone} />

      <div className="wcard__foot">
        <Badge tone={st.tone}>{st.label}</Badge>
        {item.deadline ? (
          <span className="row" style={{ gap: 5 }}>
            <IconClock size={13} />
            <span>{item.doneAt ? fmtRelative(dayOf(item.deadline)) : countdown(item.deadline)}</span>
          </span>
        ) : (
          <span className="faint">No deadline</span>
        )}
      </div>
    </Surface>
  )
}
