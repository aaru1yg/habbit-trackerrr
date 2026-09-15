/* Step 5A: DEV-ONLY Work Foundation Showcase.
   Demonstrates the canonical WorkEntity presentation across all four
   Work entity types using realistic, deterministic fixtures built from
   the existing factories. NOT reachable in production builds; routed at
   #/__work-foundation like the primitives showcase. */
import { useMemo } from 'react'
import { Surface, Stack, Text, Row, Cluster, Divider, Badge, Progress } from '../primitives/index.js'
import WorkEntity from './WorkEntity.jsx'
import { workWorkspace } from './workViewModel.js'
import { baseProject, baseAssignment } from '../../store.jsx'
import { todayStr, addDaysStr, subDaysStr } from '../../lib/dates.js'

/* Deterministic fixtures: one healthy project, one at-risk project, an
   on-track assignment, an overdue assignment, tasks in varied states,
   and a future milestone + a reached milestone. All shapes are real
   (same as store/reducers produce), no invented fields. */
function buildFixtureState(now) {
  const today = todayStr(now)
  const past = subDaysStr.bind(null, today)
  const future = addDaysStr.bind(null, today)

  const p1 = baseProject({
    id: 'p-web',
    name: 'Website redesign',
    description: 'Public marketing site v2',
    category: 'Design',
    priority: 'high',
    startDate: past(14),
    deadline: future(10),
    manualPercent: 35,
  })
  p1.milestones = [
    {
      id: 'm-wire', name: 'Wireframes signed off', due: past(2), order: 0,
      tasks: [
        { id: 't1', name: 'Audit current pages', done: true, status: 'done', priority: 'normal', estimateMin: 60, notes: '', order: 0 },
        { id: 't2', name: 'Draft IA',            done: true, status: 'done', priority: 'normal', estimateMin: 90, notes: '', order: 1 },
      ],
    },
    {
      id: 'm-visual', name: 'Visual design', due: future(6), order: 1,
      tasks: [
        { id: 't3', name: 'Homepage comp', done: false, status: 'doing', priority: 'high', estimateMin: 120, due: future(2), notes: '', order: 0 },
        { id: 't4', name: 'Pricing grid',  done: false, status: 'todo',  priority: 'normal', estimateMin: 60, due: future(5), notes: '', order: 1 },
        { id: 't5', name: 'Mobile layouts', done: false, status: 'blocked', priority: 'normal', estimateMin: 180, due: future(6), notes: '', order: 2 },
      ],
    },
    {
      id: 'm-launch', name: 'Launch', due: future(10), order: 2,
      tasks: [], // no tasks → anchor-based
    },
  ]

  const p2 = baseProject({
    id: 'p-thesis',
    name: 'Thesis chapter 3',
    priority: 'normal',
    startDate: past(30),
    deadline: past(2),
    manualPercent: 60,
  })
  p2.milestones = [
    { id: 'm-draft', name: 'First draft', due: past(10), order: 0, tasks: [
      { id: 't6', name: 'Outline', done: true, status: 'done', priority: 'normal', estimateMin: 45, notes: '', order: 0 },
      { id: 't7', name: 'Write draft', done: false, status: 'doing', priority: 'high', estimateMin: 480, due: past(2), notes: '', order: 1 },
    ]},
  ]

  const a1 = baseAssignment({
    id: 'a-tps',
    name: 'TPS report cover sheet',
    subject: 'Q3 compliance',
    priority: 'normal',
    assignedDate: past(4),
    deadline: today,
    progress: 30,
    estimateMin: 45,
    projectId: null,
  })

  const a2 = baseAssignment({
    id: 'a-contract',
    name: 'Review vendor contract',
    priority: 'high',
    assignedDate: past(8),
    deadline: past(1),
    progress: 20,
    estimateMin: 30,
    projectId: 'p-web',
  })

  const a3 = baseAssignment({
    id: 'a-reading',
    name: 'Read "Shape Up" chapter 4',
    priority: 'low',
    assignedDate: past(1),
    deadline: future(5),
    progress: 0,
    estimateMin: 40,
  })

  return {
    version: 4,
    profile: { name: 'Aaru', onboarded: true, theme: 'midnight', dailyCapacityMin: 360 },
    projects: [p1, p2],
    assignments: [a1, a2, a3],
    habits: [], routines: [], goals: [], checkins: {}, notes: [],
    achievements: [], signals: [], focusLog: [], preferences: { weekStartsOn: 1 },
    milestones: [], tasks: [],
  }
}

function Section({ eyebrow, title, children, description }) {
  return (
    <section style={{ display: 'grid', gap: 12 }}>
      <Stack gap="micro">
        <Text level="micro">{eyebrow}</Text>
        <Text level="h2">{title}</Text>
        {description && <Text level="body" tone="muted">{description}</Text>}
      </Stack>
      {children}
    </section>
  )
}

export default function WorkFoundationShowcase() {
  const now = useMemo(() => new Date(), [])
  const state = useMemo(() => buildFixtureState(now), [now])
  const model = workWorkspace(state, now)
  const rowsByKind = model.rows.reduce((acc, r) => {
    (acc[r.kind] = acc[r.kind] || []).push(r)
    return acc
  }, {})

  return (
    <div className="p-showcase" style={{ display: 'grid', gap: 32 }}>
      <Surface variant="raised" flush>
        <Stack gap="comfortable" style={{ padding: 'var(--sp-5)' }}>
          <Stack gap="micro">
            <Text level="micro">Step 5A</Text>
            <Text level="display">Work foundation</Text>
            <Text level="body" tone="muted">
              One shared Work entity row, four entity types, quiet identity,
              dominant title, subtle 3px progress rail, one clear risk signal.
              Primitives-only; no new visual system; Work workspace is not being
              redesigned in this step.
            </Text>
          </Stack>
          <Cluster gap="sm">
            <Badge tone="neutral">Project</Badge>
            <Badge tone="neutral">Assignment</Badge>
            <Badge tone="neutral">Task</Badge>
            <Badge tone="neutral">Milestone</Badge>
            <Badge tone="info">3px rail</Badge>
            <Badge tone="success">no rings</Badge>
          </Cluster>
          <Row gap="sm" align="center">
            <Text level="caption" tone="muted">6px default Progress (Today/Habits)</Text>
            <div style={{ width: 160 }}><Progress value={42} label="6px demo" /></div>
          </Row>
          <Row gap="sm" align="center">
            <Text level="caption" tone="muted">3px thin Progress (Work aggregate rails)</Text>
            <div style={{ width: 160 }}><Progress thin value={42} tone="warning" label="3px demo" /></div>
          </Row>
        </Stack>
      </Surface>

      <Section eyebrow="Projects" title="Project rows" description="Titles dominant; quiet icon in lead; aggregate 3px progress from tasks/manual percent; deadline status drives tone.">
        <Surface variant="raised" flush>
          <div style={{ padding: '0 16px' }}>
            {(rowsByKind.project || []).map((r) => (
              <WorkEntity key={r.key} row={r} />
            ))}
          </div>
        </Surface>
      </Section>

      <Section eyebrow="Assignments" title="Assignment rows" description="Explicit progress (or subtask-derived); urgency surfaces CRITICAL (≤24h) and OVERDUE as single concise signal.">
        <Surface variant="raised" flush>
          <div style={{ padding: '0 16px' }}>
            {(rowsByKind.assignment || []).map((r) => (
              <WorkEntity key={r.key} row={r} show={{ effort: true }} />
            ))}
          </div>
        </Surface>
      </Section>

      <Section eyebrow="Project tasks" title="Task rows" description="Binary done state; task status (todo/doing/blocked/done) surfaces via the semantic Status pill; relationship to parent project + milestone shown.">
        <Surface variant="raised" flush>
          <div style={{ padding: '0 16px' }}>
            {(rowsByKind['project-task'] || []).slice(0, 6).map((r) => (
              <WorkEntity key={r.key} row={r} />
            ))}
          </div>
        </Surface>
      </Section>

      <Section eyebrow="Milestones" title="Milestone rows" description="Derived reached/partial state; due date is primary signal; no complete/⋮ actions (milestones don't have their own reducer completion in the existing model — they are reached when their tasks are done).">
        <Surface variant="raised" flush>
          <div style={{ padding: '0 16px' }}>
            {(rowsByKind.milestone || []).map((r) => (
              <WorkEntity key={r.key} row={r} />
            ))}
          </div>
        </Surface>
      </Section>

      <Section eyebrow="Contexts" title="Row in contained Surface (for detail/pickers)" description="Same .we composition inside a surface container with hairline separators.">
        <div style={{background:"var(--surface)",border:"1px solid var(--line)",borderRadius:"var(--r-md)",padding:"0 16px"}}>
          {(rowsByKind.assignment || []).slice(0, 2).map((r) => (
            <WorkEntity key={r.key} row={r} />
          ))}
        </div>
      </Section>

      <Divider />
      <Stack gap="micro">
        <Text level="caption" tone="muted">
          This showcase is dev-only (import.meta.env.DEV) and is not shipped to
          production. It exercises the WorkEntity contract against real
          workWorkspace() rows — no fake domain logic.
        </Text>
      </Stack>
    </div>
  )
}
