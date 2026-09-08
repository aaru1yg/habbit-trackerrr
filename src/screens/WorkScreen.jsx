import { lazy, Suspense, useMemo, useState } from 'react'
import { useStore } from '../store.jsx'
import { useRoute, navigate } from '../lib/router.jsx'
import useNow from '../lib/useNow.js'
import { useWorkUI } from '../components/work/WorkUIProvider.jsx'
import { WorkTabs } from '../components/layout/Navigation.jsx'
import UniversalWorkRow from '../components/work/UniversalWorkRow.jsx'
import { workWorkspace, workView, workHref, filterWork, deadlineGroups, FILTERS } from '../components/work/workViewModel.js'
import { minutesLabel, prettyDate } from '../lib/dates.js'
import '../styles/workspace.css'
const ProjectGallery = lazy(() => import('../components/work/ProjectGallery.jsx'))
const WorkPlanning = lazy(() => import('../components/work/WorkPlanning.jsx'))

const time = value => value == null ? 'Not set' : minutesLabel(Math.abs(Math.round(value)))
function Rows({ rows, now, empty = 'No work matches this view.' }) {
  return rows.length ? <div className="workspace-list">{rows.map(row => <UniversalWorkRow key={row.key} row={row} now={now} />)}</div> : <p className="empty-note">{empty}</p>
}

export default function WorkScreen({ route = 'work' }) {
  const { state } = useStore()
  const { query } = useRoute()
  const now = useNow()
  const work = useWorkUI()
  const view = workView(route, query)
  const params = new URLSearchParams(query)
  const filter = FILTERS.some(([id]) => id === params.get('filter')) ? params.get('filter') : 'active'
  const horizon = params.get('horizon') || ''
  const filteredOverview = view === 'overview' && params.has('filter')
  const [search, setSearch] = useState('')
  const [planning, setPlanning] = useState(null)
  const model = useMemo(() => workWorkspace(state, now), [state, now])
  const options = { filter, horizon, query: search }
  const rows = filterWork([...model.active, ...model.rows.filter(r => r.status.complete)], options, model)
  const overloaded = model.load.filter(day => day.overloaded).sort((a, b) => a.remainingMin - b.remainingMin)[0]
  const changeFilter = value => navigate(workHref(view, value))
  return <div className="screen workspace" id="work-screen">
    <header className="screen-head workspace-head">
      <div><h1 className="screen-title">Work</h1><p className="screen-sub">What needs attention. Where the work lives.</p></div>
      <div className="head-actions"><button className="btn primary" onClick={() => work.newAssignment()}>Create work</button><button className="btn ghost" onClick={work.newProject}>Create project</button></div>
    </header>
    <WorkTabs route={route} view={view} />
    {!model.rows.length ? <section className="card pad workspace-empty"><h2>Your work starts here.</h2><p>No active work. Add a deliverable or create a project to begin.</p><button className="btn primary" onClick={() => work.newAssignment()}>Create work</button></section> : <>
      {(view !== 'overview' || filteredOverview) && <div className="workspace-filters">
        <div role="group" aria-label="Filter work">{FILTERS.map(([id, label]) => <button key={id} className={`btn ghost sm${filter === id ? ' active' : ''}`} aria-pressed={filter === id} onClick={() => changeFilter(id)}>{label}</button>)}</div>
        {['overview', 'deliverables', 'projects', 'deadlines'].includes(view) && <label className="workspace-search">Search work<input className="field" type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Filter titles, tasks, notes…" /></label>}
        {horizon && <button className="btn ghost sm" onClick={() => navigate(workHref(view, filter))}>Clear horizon: {model.horizons.find(h => h.id === horizon)?.label || horizon}</button>}
      </div>}
      {(view === 'overview' || view === 'workload') && overloaded && <Overload day={overloaded} onPlan={setPlanning} />}
      {view === 'overview' && (filteredOverview ? <section><h2>Work items</h2><Rows rows={rows} now={now} /></section> : <WorkOverview model={model} now={now} onPlan={setPlanning} />)}
      {view === 'deliverables' && <DeliverablesView rows={rows} now={now} />}
      {view === 'projects' && <ProjectsView rows={rows} now={now} />}
      {view === 'workload' && <WorkloadView model={model} now={now} options={options} onPlan={setPlanning} />}
      {view === 'deadlines' && <DeadlinesView model={model} rows={filterWork(model.deadlines, options, model)} now={now} />}
    </>}
    {planning && <Suspense fallback={<p role="status">Loading planning…</p>}><WorkPlanning mode={planning} onClose={() => setPlanning(null)} now={now} /></Suspense>}
  </div>
}

export function WorkOverview({ model, now, onPlan }) {
  const [filter, setFilter] = useState('active')
  const activeRows = filterWork(filter === 'active' ? model.active : model.rows, { filter }, model)
  const visible = activeRows.slice(0, 2)
  const recent = [...model.active].sort((a, b) => String(b.item.updatedAt || b.item.createdAt || '').localeCompare(String(a.item.updatedAt || a.item.createdAt || ''))).slice(0, 3)
  return <div className="workspace-overview">
    <div className="workspace-summary" aria-label="Work summary">
      <a href={`#/${workHref('overview', 'risk')}`}><span>At risk</span><strong>{model.atRisk.length}</strong><small>Needs attention</small></a>
      <a href={`#/${workHref('deadlines', 'soon', '7')}`}><span>Due soon</span><strong>{model.horizons[3].count}</strong><small>Next 7 days</small></a>
      <a href={`#/${workHref('overview', 'active')}`}><span>Active work</span><strong>{model.active.length}</strong><small>Across your workspace</small></a>
    </div>
    <section className="workspace-active"><div className="workspace-section-head"><h2>Active work</h2><div role="group" aria-label="Work status"><button className="btn ghost sm" aria-pressed={filter === 'active'} onClick={() => setFilter('active')}>Active</button><button className="btn ghost sm" aria-pressed={filter === 'completed'} onClick={() => setFilter('completed')}>Completed</button></div></div>
      {model.next && filter === 'active' && <p className="tiny muted workspace-next">Suggested next: <a href={`#/${model.next.item.kind === 'project' ? 'projects' : 'assignments'}/${model.next.item.id}`}>{model.next.item.name}</a></p>}
      <Rows rows={visible} now={now} empty={filter === 'completed' ? 'No completed work yet.' : 'No active work. Your commitments are clear.'} />
      {activeRows.length > 2 && <a className="btn ghost" href={`#/${workHref('overview', filter)}`}>View all work</a>}
    </section>
    <section className="workspace-attention"><div className="workspace-section-head"><h2>Needs attention</h2><a href={`#/${workHref('overview', 'risk')}`}>View all attention</a></div><Rows rows={[...model.atRisk, ...model.horizons[3].items.filter(r => !r.atRisk)].slice(0, 2)} now={now} empty="No work is currently at risk." /></section>
    <section className="workspace-horizon card pad"><h2>Due soon</h2><p className="tiny muted">Calendar-day horizons · 3 and 7 days include today.</p><div className="workspace-horizons">{model.horizons.map(h => <a href={`#/${workHref('deadlines', 'soon', h.id)}`} key={h.id}><strong>{h.label}</strong><span>{h.count} items · {time(h.effort)} estimated</span>{h.unknown > 0 && <small>{h.unknown} without estimates</small>}<small>{h.highest ? `${h.highest.risk}: ${h.highest.item.name}` : 'Nothing due'}</small></a>)}</div></section>
    <section className="workspace-capacity card pad"><div className="workspace-section-head"><h2>Workload snapshot</h2><a href={`#/${workHref('workload')}`}>Workload</a></div><p className="tiny muted">Today · deadline commitments</p><Capacity day={model.load[0]} /><button className="btn ghost sm" onClick={() => onPlan('plan')}>Plan</button></section>
    <section className="workspace-recent"><h2>Recent / upcoming</h2><Rows rows={recent} now={now} /></section>
  </div>
}

export function DeliverablesView({ rows, now }) {
  return <section aria-labelledby="deliverables-heading"><h2 id="deliverables-heading">Deliverables</h2><p className="screen-sub">Standalone deadline work and assignments linked to projects.</p><Rows rows={rows.filter(r => r.kind === 'assignment')} now={now} /></section>
}

export function ProjectsView({ rows, now }) {
  const [layout, setLayout] = useState('list')
  const [showItems, setShowItems] = useState(false)
  const projects = rows.filter(r => r.kind === 'project')
  return <section aria-labelledby="projects-heading"><div className="workspace-section-head"><h2 id="projects-heading">Projects</h2><div role="group" aria-label="Project presentation">{['list', 'gallery'].map(mode => <button key={mode} className="btn ghost sm" aria-pressed={layout === mode} onClick={() => setLayout(mode)}>{mode === 'list' ? 'List' : 'Gallery / spatial'}</button>)}</div></div>
    {layout === 'gallery' ? <Suspense fallback={<p role="status">Loading gallery…</p>}><ProjectGallery rows={projects.map(r => ({ project: r.item, status: r.status }))} now={now} /></Suspense> : <Rows rows={projects} now={now} />}
    <details className="workspace-project-items" open={showItems || !projects.length} onToggle={e => setShowItems(e.currentTarget.open)}><summary>Project tasks and milestones</summary>{(showItems || !projects.length) && <Rows rows={rows.filter(r => ['project-task', 'milestone'].includes(r.kind))} now={now} />}</details>
  </section>
}

function Capacity({ day }) {
  return <dl className="workspace-capacity-values"><div><dt>Available</dt><dd>{time(day.availableMin)}</dd></div><div><dt>Committed</dt><dd>{time(day.committedMin)}</dd></div><div><dt>{day.overloaded ? 'Over capacity' : 'Remaining'}</dt><dd>{time(day.remainingMin)}</dd></div></dl>
}
function Overload({ day, onPlan }) {
  const types = Object.entries(day.items.reduce((acc, item) => ({ ...acc, [item.kind]: (acc[item.kind] || 0) + 1 }), {}))
  return <section className="workspace-overload" aria-labelledby="overload-heading"><div><h2 id="overload-heading">Over capacity by {time(day.remainingMin)}</h2><p>{prettyDate(day.date)} · {types.map(([kind, count]) => `${count} ${kind === 'goal/project milestone' ? 'milestone' : kind}${count === 1 ? '' : 's'}`).join(' · ')}</p><p className="tiny">Top contributors: {[...day.items].sort((a, b) => (b.estimateMin || 0) - (a.estimateMin || 0)).slice(0, 3).map(item => item.name).join(', ')}</p></div><div className="head-actions"><button className="btn" onClick={() => onPlan('plan')}>Plan</button><button className="btn ghost" onClick={() => onPlan('recover')}>Recover</button></div></section>
}

export function WorkloadView({ model, now, options, onPlan }) {
  const [selected, setSelected] = useState(model.today)
  const day = model.load.find(d => d.date === selected) || model.load[0]
  const contributors = new Set(day.items.map(item => `${item.kind === 'project task' ? 'project-task' : item.kind === 'goal/project milestone' ? 'milestone' : item.kind}:${item.id}`))
  return <section aria-labelledby="workload-heading"><div className="workspace-section-head"><h2 id="workload-heading">Workload</h2><button className="btn ghost" onClick={() => onPlan('plan')}>Plan</button></div><p>Can your capacity cover your commitments?</p><p className="tiny muted">{prettyDate(day.date)} · existing deadline-based estimates, not a scheduled time budget. Unestimated work is not counted as effort.</p><Capacity day={day} />{day.availableMin == null && <p><a href="#/settings">Set daily capacity in Settings</a> to see remaining room.</p>}
    <h3>Day-by-day load</h3><div className="workspace-days" role="group" aria-label="Workload day">{model.load.map(d => <button key={d.date} className="btn ghost" aria-pressed={day.date === d.date} onClick={() => setSelected(d.date)}><strong>{d.label}</strong><span>{time(d.committedMin)} committed</span><small>{d.availableMin == null ? 'Capacity not set' : `${time(d.remainingMin)} ${d.overloaded ? 'over capacity' : 'remaining'}`}</small></button>)}</div>
    <h3>Contributors</h3><Rows rows={filterWork(model.rows.filter(r => contributors.has(r.key)), options, model)} now={now} empty="No matching work lands on this day." />
  </section>
}

export function DeadlinesView({ model, rows, now }) {
  const groups = deadlineGroups(rows, model.today)
  return <section aria-labelledby="deadlines-heading"><h2 id="deadlines-heading">Deadlines</h2><p className="screen-sub">Chronological work, with original project and deliverable links.</p>{groups.length ? groups.map(group => <section className="workspace-deadline-group" key={group.label}><h3>{group.label}</h3><Rows rows={group.rows} now={now} /></section>) : <p className="empty-note">No deadlines in this view.</p>}</section>
}
