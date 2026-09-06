/* ============================================================
   GOAL ATLAS (V4, spec §12) — the relationships made spatial.

   Each open goal becomes one constellation plane:
   the goal at its centre, its REAL links (milestones, habits,
   projects, assignments) orbiting on a shallow depth arc. Edges
   are only ever drawn between nodes that exist in the document —
   nothing is invented. Keyboard users Tab through every node;
   screen readers get a spoken summary per constellation.

   Pure CSS/SVG — identical in the WebGL-free world.
   ============================================================ */
import { useMemo } from 'react'
import { useStore } from '../../store.jsx'
import { goalProgress, nextMilestone } from '../../lib/goals.js'
import { projectProgress } from '../../lib/work.js'

/* fixed, pleasing clock positions for up to 8 satellites */
const SLOTS = [
  { x: 50, y: 12 }, { x: 80, y: 26 }, { x: 88, y: 55 }, { x: 72, y: 80 },
  { x: 50, y: 90 }, { x: 28, y: 80 }, { x: 12, y: 55 }, { x: 20, y: 26 },
]

function goalSatellites(state, goal) {
  const out = []
  const ms = (goal.milestones || []).slice(0, 3)
  for (const m of ms) {
    out.push({
      kind: 'milestone', label: m.name, done: !!m.done,
      href: `#/goals/${goal.id}`, tone: m.done ? 'var(--good)' : 'var(--accent-2)',
    })
  }
  for (const id of (goal.linkedHabitIds || []).slice(0, 2)) {
    const h = (state.habits || []).find((x) => x.id === id && !x.archived)
    if (h) out.push({ kind: 'habit', label: h.name, href: `#/habits/${h.id}`, tone: 'var(--c3)' })
  }
  for (const id of (goal.linkedProjectIds || []).slice(0, 2)) {
    const p = (state.projects || []).find((x) => x.id === id)
    if (p) {
      const { pct } = projectProgress(p)
      out.push({ kind: 'project', label: `${p.name}${pct != null ? ` ${pct}%` : ''}`, href: `#/projects/${p.id}`, tone: 'var(--c1)' })
    }
  }
  for (const id of (goal.linkedAssignmentIds || []).slice(0, 1)) {
    const a = (state.assignments || []).find((x) => x.id === id)
    if (a) out.push({ kind: 'assignment', label: a.name, href: `#/assignments/${a.id}`, tone: 'var(--c4)' })
  }
  return out.slice(0, SLOTS.length)
}

export function GoalConstellation({ goal }) {
  const { state } = useStore()
  const prog = useMemo(() => goalProgress(state, goal), [state, goal])
  const sats = useMemo(() => goalSatellites(state, goal), [state, goal])
  const nm = nextMilestone(goal)

  return (
    <section className="atlas card pad" aria-label={`Goal atlas for ${goal.title}`}>
      <div className="atlas-frame">
        <img className="atlas-scene" src="art/scene-constellation.webp" alt="" width="840" height="470" loading="lazy" decoding="async" />
        <svg className="atlas-web" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" focusable="false">
          {sats.map((s, i) => (
            <line key={i} x1="50" y1="50" x2={SLOTS[i].x} y2={SLOTS[i].y} vectorEffect="non-scaling-stroke" />
          ))}
        </svg>

        <a
          className="atlas-node atlas-goal"
          href={`#/goals/${goal.id}`}
          aria-label={`Goal: ${goal.title}, ${prog.pct} percent`}
          style={{ left: '50%', top: '50%', '--z': 'var(--sp-z3)' }}
        >
          {goal.title}
          <b className="tnum">{prog.pct}%</b>
        </a>

        {sats.map((s, i) => (
          <a
            key={`${s.kind}-${s.label}-${i}`}
            className="atlas-node"
            href={s.href}
            style={{ left: `${SLOTS[i].x}%`, top: `${SLOTS[i].y}%`, '--z': 'var(--sp-z1)', '--tone': s.tone }}
          >
            <span className="atlas-dot" aria-hidden="true" />
            <span className="atlas-kind">{s.kind}</span>
            {s.label}
          </a>
        ))}

        {sats.length === 0 && (
          <p className="atlas-empty tnum">
            This goal has nothing linked yet — add milestones or connect a habit, project or assignment.
          </p>
        )}
      </div>

      <p className="atlas-foot">
        <span className="tiny muted">{prog.detail}</span>
        {nm && prog.pct < 100 && <span className="chip">Next: {nm.name}</span>}
      </p>
    </section>
  )
}

export default function GoalAtlas({ goals, limit = 4 }) {
  const withLinks = goals.filter((g) => (g.milestones || []).length + (g.linkedHabitIds || []).length + (g.linkedProjectIds || []).length + (g.linkedAssignmentIds || []).length > 0)
  const shown = (withLinks.length ? withLinks : goals).slice(0, limit)
  if (!shown.length) return null
  return (
    <div className="atlas-wrap" role="group" aria-label="Goal atlas — goals and the work that feeds them">
      {shown.map((g) => <GoalConstellation key={g.id} goal={g} />)}
    </div>
  )
}
