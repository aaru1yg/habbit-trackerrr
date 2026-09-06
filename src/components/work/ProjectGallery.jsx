/* ============================================================
   PROJECT GALLERY (V4, spec §9/§10) — projects as floating planes.

   Same rows, same status engine, same handlers as the list view —
   only the presentation is spatial: a large art surface with a
   deterministic gradient environment per category, real progress,
   deadline pressure and health. Depth is CSS (DepthCard); WebGL is
   not involved here, so this renders identically on every device.
   ============================================================ */
import { useWorkUI } from './WorkUIProvider.jsx'
import { Meter, StatusPill, KindTag } from './WorkKit.jsx'
import { DepthCard } from '../spatial/Depth.jsx'
import { projectPhase, phaseTone, PROJECT_PHASES, projectProgress, milestoneTrack } from '../../lib/work.js'
import { shortDate, dayOf } from '../../lib/dates.js'
import {
  IconPencil, IconTrash, IconChevronRight, IconLink,
  IconGoals, IconProjects, IconSparkle, IconStack, IconLink as IconResearch,
  IconFlag, IconClock, IconAssignment,
} from '../../lib/icons.jsx'

/* Honest visual language per category: theme colour + icon glyph. The
   gradient environment IS the "generated artwork" for a cover-less
   project — derived from real metadata, never a stock photo. */
const CAT_STYLE = {
  General: { c: 'var(--c8)', g: IconFlag },
  Study: { c: 'var(--c6)', g: IconGoals },
  Work: { c: 'var(--c1)', g: IconAssignment },
  Design: { c: 'var(--c5)', g: IconSparkle },
  Development: { c: 'var(--c2)', g: IconStack },
  Research: { c: 'var(--c3)', g: IconResearch },
  Testing: { c: 'var(--c7)', g: IconProjects },
  Personal: { c: 'var(--c4)', g: IconClock },
}

/* A deterministic hue shift from the project name — every project reads
   as its own cover without shipping one image per user. */
function nameShift(name = '') {
  let h = 0
  for (let i = 0; i < name.length; i += 1) h = (h * 31 + name.charCodeAt(i)) % 360
  return h
}

export function ProjectGalleryCard({ row, now, index = 0 }) {
  const { project, status } = row
  const work = useWorkUI()
  const st = CAT_STYLE[project.category] || CAT_STYLE.General
  const Glyph = st.g
  const shift = nameShift(project.name)
  const phase = projectPhase(project, now)
  const phaseLabel = PROJECT_PHASES.find((p) => p.id === phase)?.label || ''
  const daysLeft = status.hasDeadline && !status.complete && status.daysLeft != null
    ? `${Math.max(0, status.daysLeft)}d`
    : null
  const linked = (project.linkedHabitIds || []).length
  const progress = projectProgress(project)
  const nextMilestone = milestoneTrack(project).find((m) => !m.reached) || null

  return (
    <DepthCard
      as="li"
      className="project-card gal-item"
      depth={(index % 4) + 1}
      max={5}
      aria-label={`Project ${project.name}`}
      data-tone={status.tone}
    >
      <div className="gal-card">
        <div className="gal-art" style={{ '--cat-c': st.c, '--shift': `${shift}deg` }}>
          <span className="gal-glyph" aria-hidden="true"><Glyph size={22} /></span>
          <span className="gal-initial" aria-hidden="true">{(project.name || '?').trim().charAt(0).toUpperCase()}</span>
          {phaseLabel && <span className="gal-phase" data-tone={phaseTone(phase)}>{phaseLabel}</span>}
        </div>

        <div className="gal-body">
          <div className="gal-title-row">
            <a className="gal-title" href={`#/projects/${project.id}`}>{project.name}</a>
            <span className="gal-pct tnum">{status.pct}%</span>
          </div>

          <Meter
            pct={status.pct}
            tone={status.tone}
            pace={status.elapsedPct}
            label={`${status.pct}% complete${status.elapsedPct != null ? `, pace marker at ${status.elapsedPct}%` : ''}`}
          />

          <div className="gal-meta">
            <KindTag kind="project">Project</KindTag>
            <StatusPill status={status} />
            {project.category && project.category !== 'General' && <span>{project.category}</span>}
            <span>
              {progress.total > 0
                ? `${progress.done} / ${progress.total} tasks`
                : progress.mode === 'manual' || progress.mode === 'legacy'
                  ? 'Manual progress'
                  : 'No tasks yet'}
            </span>
            {nextMilestone && <span>Next: {nextMilestone.name}</span>}
            {status.hasDeadline && (
              <span className="tnum">
                Due {shortDate(dayOf(status.deadline))}{daysLeft ? ` · ${daysLeft} left` : ''}
              </span>
            )}
            {linked > 0 && (
              <span><IconLink size={11} /> {linked} habit{linked === 1 ? '' : 's'}</span>
            )}
          </div>

          <div className="gal-actions">
            <button className="btn ghost icon" aria-label={`Edit ${project.name}`} onClick={() => work.editProject(project)}>
              <IconPencil size={16} />
            </button>
            <button className="btn ghost icon" style={{ color: 'var(--bad)' }} aria-label={`Delete ${project.name}`} onClick={() => work.deleteProject(project)}>
              <IconTrash size={16} />
            </button>
            <span style={{ flex: 1 }} />
            <a className="btn ghost sm" href={`#/projects/${project.id}`} aria-label={`Open ${project.name}`}>
              Open <IconChevronRight size={14} />
            </a>
          </div>
        </div>
      </div>
    </DepthCard>
  )
}

export default function ProjectGallery({ rows, now }) {
  return (
    <ul className="gal-grid" aria-label="Projects gallery">
      {rows.map((row, i) => (
        <ProjectGalleryCard key={row.project.id} row={row} now={now} index={i} />
      ))}
    </ul>
  )
}
