import { lazy, Suspense, useMemo, useState } from 'react'
import { useStore } from '../store.jsx'
import { useRoute, navigate, Link } from '../lib/router.jsx'
import useNow from '../lib/useNow.js'
import { useWorkUI } from '../components/work/WorkUIProvider.jsx'
import WorkEntity from '../components/work/WorkEntity.jsx'
import UniversalWorkRow from '../components/work/UniversalWorkRow.jsx'
import { workWorkspace, workView, workHref, filterWork, FILTERS, WORK_VIEWS } from '../components/work/workViewModel.js'
import { projectStatus } from '../lib/work.js'
import { minutesLabel, prettyDate, dayStr, addDaysStr, weekDays } from '../lib/dates.js'
import { EmptyState } from '../components/primitives/index.js'
import { IconPlus } from '../lib/icons.jsx'
import '../styles/workspace.css'
import '../styles/work-v3.css'
import '../components/work/WorkEntity.css'
const ProjectGallery = lazy(() => import('../components/work/ProjectGallery.jsx'))
const WorkPlanning = lazy(() => import('../components/work/WorkPlanning.jsx'))

const time = value => value == null ? 'Not set' : minutesLabel(Math.abs(Math.round(value)))

/* Step 5B: lightweight segmented tabs; same route/query architecture as legacy WorkTabs. */
function WorkTabsLite({ view }) {
  return <nav className="wo-tabs" aria-label="Work sections">
    {WORK_VIEWS.map(id => <Link key={id} to={`work?view=${id}`} className={`wo-tab${view === id ? ' is-current' : ''}`} aria-current={view === id ? 'page' : undefined}>{id === 'workload' ? 'Workload' : id.charAt(0).toUpperCase() + id.slice(1)}</Link>)}
  </nav>
}

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
      <div><h1 className="screen-title">Work</h1><p className="screen-sub">{view === 'overview' ? 'What deserves your attention right now.' : 'Deliverables, projects, deadlines and capacity.'}</p></div>
      <div className="head-actions"><button className="btn primary" onClick={() => work.newAssignment()}>Create work</button><button className="btn ghost" onClick={work.newProject}>Create project</button></div>
    </header>
    <WorkTabsLite view={view} />
    {!model.rows.length ? <EmptyState
        eyebrow="Work"
        title="Your work starts here."
        action={<button className="btn primary" onClick={() => work.newAssignment()}>Create work</button>}
        secondary={<button className="btn ghost" onClick={work.newProject}>New project</button>}
      >
        No active work. Add a deliverable or create a project to begin.
      </EmptyState> : <>
      {(view !== 'overview' || filteredOverview) && <div className="workspace-filters">
        <div role="group" aria-label="Filter work">{FILTERS.map(([id, label]) => <button key={id} className={`btn ghost sm${filter === id ? ' active' : ''}`} aria-pressed={filter === id} onClick={() => changeFilter(id)}>{label}</button>)}</div>
        {['overview', 'deliverables', 'projects', 'deadlines'].includes(view) && <label className="workspace-search">Search work<input className="field" type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Filter titles, tasks, notes…" aria-label="Search work"/></label>}
        {horizon && <button className="btn ghost sm" onClick={() => navigate(workHref(view, filter))}>Clear horizon: {model.horizons.find(h => h.id === horizon)?.label || horizon}</button>}
      </div>}
      {(view === 'overview' || view === 'workload') && overloaded && <Overload day={overloaded} onPlan={setPlanning} />}
      {view === 'overview' && (filteredOverview
        ? <section><h2>Work items</h2><Rows rows={rows} now={now} /></section>
        : <WorkOverview model={model} work={work} onPlan={setPlanning} />)}
      {view === 'deliverables' && <DeliverablesView rows={rows} now={now} filter={filter} />}
      {view === 'projects' && <ProjectsView model={model} rows={rows} now={now} filter={filter} />}
      {view === 'workload' && <WorkloadView model={model} now={now} options={options} onPlan={setPlanning} />}
      {view === 'deadlines' && <DeadlinesView model={model} rows={filterWork(model.deadlines, options, model)} now={now} filter={filter} />}
    </>}
    {planning && <Suspense fallback={<p role="status">Loading planning…</p>}><WorkPlanning mode={planning} onClose={() => setPlanning(null)} now={now} /></Suspense>}
  </div>
}

/* Step 5B: Work Overview — execution workspace built on WorkEntity.
   Hierarchy: Header → Snapshot → Active Work → Needs Attention → Coming Up (+ Workload tile). */
export function WorkOverview({ model, work, onPlan }) {
  const [filter, setFilter] = useState('active')
  const attention = useMemo(() => {
    const riskOrder = { OVERDUE: 0, CRITICAL: 1, 'AT RISK': 2 }
    return model.active
      .filter(r => riskOrder[r.risk] != null)
      .sort((a, b) => (riskOrder[a.risk] - riskOrder[b.risk]) || b.score - a.score)
      .slice(0, 5)
  }, [model.active])
  const dueSoon = model.horizons[3].items
  const todayRows = model.horizons[0].items.filter(r => !r.status.complete)
  const tomorrowRows = model.horizons[1].items.filter(r => !r.status.complete)
  const laterThisWeek = dueSoon.filter(r => r.day > model.today && r.day !== model.horizons[1].start && !attention.some(a => a.key === r.key))
  const today = model.load[0]
  const hasRisky = attention.some(r => r.risk === 'OVERDUE' || r.risk === 'CRITICAL')
  const snapshot = [
    { label: 'active work', value: model.active.length, href: workHref('overview', 'active') },
    { label: 'due soon', value: dueSoon.length, href: workHref('deadlines', 'soon', '7'), tone: hasRisky ? 'warn' : null },
    attention.length ? { label: 'need attention', value: attention.length, href: workHref('overview', 'risk'), tone: 'bad' } : null,
    today && today.availableMin != null ? { label: `today · ${today.overloaded ? 'over' : 'free'}`, value: time(Math.abs(today.remainingMin)), href: workHref('workload'), tone: today.overloaded ? 'warn' : null } : null,
  ].filter(Boolean)
  const activeRows = filter === 'completed' ? model.rows.filter(r => r.status.complete) : model.active
  const activeShow = activeRows.slice(0, 7)
  return <main className="wo" aria-label="Work overview">
    <div className="wo__head-actions-inline">
      <button className="btn ghost sm" onClick={() => onPlan('plan')}>Plan</button>
      <button className="btn primary sm" onClick={() => work.newAssignment()}><IconPlus size={14}/> New work</button>
    </div>

    <div className="wo__snapshot workspace-summary" role="group" aria-label="Work summary">
      {snapshot.map(s => <a key={s.label} aria-label={s.label.charAt(0).toUpperCase() + s.label.slice(1)} className={['wo__snap', s.tone ? `is-${s.tone}` : ''].join(' ').trim()} href={`#/${s.href}`}>
        <span className="wo__snap-val tnum" aria-hidden="true">{s.value}</span>
        <span className="wo__snap-label">{s.label}</span>
      </a>)}
    </div>

    <section className="wo__active" aria-labelledby="wo-active">
      <div className="wo__section-head">
        <h2 id="wo-active" className="wo__h2">Active work</h2>
        <div className="wo__filters" role="group" aria-label="Work status">
          <button type="button" className={`btn ghost sm${filter === 'active' ? ' active' : ''}`} aria-pressed={filter === 'active'} onClick={() => setFilter('active')}>Active</button>
          <button type="button" className={`btn ghost sm${filter === 'completed' ? ' active' : ''}`} aria-pressed={filter === 'completed'} onClick={() => setFilter('completed')}>Completed</button>
        </div>
      </div>
      {activeRows.length === 0
        ? <p className="wo__empty">{filter === 'completed' ? 'No completed work yet.' : 'Nothing active. Enjoy the clear space.'}</p>
        : <div className="wo__rows">{activeShow.map(row => <WorkEntity
            key={row.key}
            row={row}
            show={{ kind: true, title: true, rel: true, status: true, progress: true, deadline: true, effort: false, risk: true, actions: true }}
            onMore={() => {}}
          />)}
          {activeRows.length > activeShow.length && <a className="wo__view-all" href={`#/${workHref('overview', filter)}`}>View all {filter === 'completed' ? 'completed' : 'active'} work ({activeRows.length})</a>}
        </div>}
    </section>

    <aside className="wo__side">
      <section className="wo__attention" aria-labelledby="wo-attention">
        <div className="wo__section-head">
          <h2 id="wo-attention" className="wo__h2">Needs attention</h2>
          {attention.length > 0 && <a className="wo__more" href={`#/${workHref('overview', 'risk')}`}>All</a>}
        </div>
        {attention.length === 0
          ? <p className="wo__empty wo__empty--quiet">Everything on track.</p>
          : <div className="wo__rows wo__rows--compact">{attention.map(row => <WorkEntity
              key={row.key}
              row={row}
              show={{ kind: false, title: true, rel: true, status: false, progress: false, deadline: true, effort: false, risk: true, actions: false }}
            />)}</div>}
      </section>

      <section className="wo__coming" aria-labelledby="wo-coming">
        <h2 id="wo-coming" className="wo__h2">Coming up</h2>
        <ul className="wo__groups workspace-horizons">
          {todayRows.length > 0 && <li className="wo__group"><a href={`#/${workHref('deadlines','soon','today')}`}><span className="wo__g-label">Today</span><span className="wo__g-count tnum">{todayRows.length}</span></a></li>}
          {tomorrowRows.length > 0 && <li className="wo__group"><a href={`#/${workHref('deadlines','soon','tomorrow')}`}><span className="wo__g-label">Tomorrow</span><span className="wo__g-count tnum">{tomorrowRows.length}</span></a></li>}
          {laterThisWeek.length > 0 && <li className="wo__group"><a href={`#/${workHref('deadlines','soon','7')}`}><span className="wo__g-label">This week</span><span className="wo__g-count tnum">{laterThisWeek.length}</span></a></li>}
          {!todayRows.length && !tomorrowRows.length && !laterThisWeek.length && <li className="wo__empty wo__empty--quiet">Nothing due this week.</li>}
        </ul>
        <a className="wo__more" href={`#/${workHref('deadlines', 'soon', '7')}`}>View deadlines</a>
      </section>

      <section className="wo__cap-block" aria-labelledby="wo-cap">
        <h2 id="wo-cap" className="wo__h2">Workload snapshot</h2>
        {today && today.availableMin != null
          ? <p className="wo__cap tnum">{time(Math.abs(today.remainingMin))} {today.overloaded ? 'over capacity' : 'free'} today · <a href={`#/${workHref('workload')}`}>Workload</a></p>
          : <p className="wo__cap"><a className="workspace-capacity-link" href="#/settings">Set daily capacity in Settings</a> to see remaining room · <a href={`#/${workHref('workload')}`}>Workload</a></p>}
      </section>
    </aside>
  </main>
}

/* Step 5C: Deliverables view — shipping/execution surface.
   Hierarchy: Header → Deliverable Snapshot → Delivery Pulse → list + secondary sidebar.
   The URL-level FILTERS (active/risk/soon/overdue/completed) still drive filtering;
   snapshot pills are convenient shortcuts that navigate via workHref(). */
export function DeliverablesView({ rows, now, filter }) {
  const deliverables = useMemo(() => rows.filter(r => r.kind === 'assignment'), [rows])
  const all = deliverables
  const active = all.filter(r => !r.status.complete)
  const completed = all.filter(r => r.status.complete)
  const overdue = all.filter(r => r.risk === 'OVERDUE' && !r.status.complete)
  const dueSoon = all.filter(r => (r.risk === 'DUE SOON' || r.risk === 'CRITICAL') && !r.status.complete)
  const visible = useMemo(() => {
    if (filter === 'overdue') return overdue
    if (filter === 'soon') return dueSoon
    if (filter === 'risk') return all.filter(r => r.atRisk && !r.status.complete)
    if (filter === 'completed') return completed
    if (filter === 'all') return all
    return active
  }, [filter, all, active, overdue, dueSoon, completed])
  const focus = useMemo(() => {
    // The single most urgent deliverable (OVERDUE first, then CRITICAL, then nearest deadline).
    return [...active].sort((a,b) => (a.day||'9999').localeCompare(b.day||'9999'))[0] || null
  }, [active])
  const // build a 14-day due distribution for the delivery pulse
    pulse = useMemo(() => {
      const today = model_today(now)
      const bins = []
      for (let i = -1; i <= 12; i++) {
        const d = addDaysStr(today, i)
        const c = active.filter(r => r.day === d).length
        bins.push({ day: d, label: i === 0 ? 'Today' : i === 1 ? 'Tm' : i === -1 ? 'Yst' : String(new Date(d).getDate()), count: c, overdue: i < 0, today: i === 0 })
      }
      return bins
    }, [active, now])
  const maxCount = Math.max(1, ...pulse.map(b => b.count))
  return <section className="dlv" aria-labelledby="deliverables-heading">
    <header className="dlv__head">
      <div>
        <p className="dlv__eyebrow">Shipping surface</p>
        <h2 id="deliverables-heading" className="dlv__title">Deliverables</h2>
        <p className="dlv__sub">What needs to ship, when it's due, and what's at risk.</p>
      </div>
    </header>

    <div className="dlv__snap" aria-label="Deliverables snapshot">
      {[
        { id: 'active', label: 'Active', value: active.length, tone: null },
        { id: 'soon', label: 'Due soon', value: dueSoon.length, tone: dueSoon.some(r=>r.risk==='CRITICAL') ? 'bad' : 'warn' },
        { id: 'overdue', label: 'Overdue', value: overdue.length, tone: overdue.length ? 'bad' : null },
        { id: 'completed', label: 'Completed', value: completed.length, tone: 'good' },
      ].map(s => <a key={s.id} href={`#/${workHref('deliverables', s.id)}`}
        className={['dlv__pill', filter===s.id?'is-active':'', s.tone?`is-${s.tone}`:''].join(' ').trim()}>
          <span className="dlv__pill-val tnum">{s.value}</span>
          <span className="dlv__pill-label">{s.label}</span>
      </a>)}
    </div>

    <section className="dlv__pulse" aria-label="Due date distribution, next 14 days">
      <p className="dlv__pulse-cap"><span className="tiny muted">Next 14 days</span></p>
      <div className="dlv__pulse-bars" role="list">
        {pulse.map(b => <div key={b.day} className="dlv__pulse-col" role="listitem" aria-label={`${b.label}: ${b.count}`}>
          <div className="dlv__pulse-track"><div className={['dlv__pulse-fill', b.overdue?'is-bad':b.today?'is-accent':''].join(' ').trim()} style={{height:`${Math.max(4, Math.round(b.count/maxCount*100))}%`}}/></div>
          <span className={['dlv__pulse-label', b.today?'is-today':b.overdue?'is-bad':''].join(' ').trim()}>{b.label}</span>
        </div>)}
      </div>
    </section>

    <div className="dlv__grid">
      <section className="dlv__list" aria-labelledby="dlv-list-heading">
        <div className="dlv__section-head">
          <h2 id="dlv-list-heading" className="dlv__h2">{filter === 'completed' ? 'Shipped' : filter === 'overdue' ? 'Overdue' : filter === 'soon' ? 'Due soon' : filter === 'risk' ? 'At risk' : filter === 'all' ? 'All deliverables' : 'Active deliverables'}</h2>
          <span className="tiny muted tnum">{visible.length} {visible.length === 1 ? 'item' : 'items'}</span>
        </div>
        {visible.length === 0
          ? <p className="dlv__empty">{filter === 'completed' ? 'Nothing shipped yet.' : filter === 'overdue' ? 'Nothing overdue.' : filter === 'soon' ? 'Nothing due right away.' : 'No active deliverables.'}</p>
          : <Rows rows={visible} now={now} empty="" />}
      </section>

      <aside className="dlv__side">
        {focus && <section className="dlv__focus" aria-labelledby="dlv-focus-heading">
          <p className="dlv__eyebrow">Shipping focus</p>
          <h2 id="dlv-focus-heading" className="dlv__h2 dlv__h2--focus">{focus.item.name}</h2>
          {focus.parent && <p className="dlv__focus-rel tiny muted">{focus.parent.name}{focus.milestone ? ` · ${focus.milestone.name}` : ''}</p>}
          <p className="dlv__focus-meta">
            <span data-tone={focus.risk==='OVERDUE'||focus.risk==='CRITICAL'?'bad':focus.risk==='AT RISK'||focus.risk==='DUE SOON'?'warn':null}>{focus.status.dueText || 'No deadline'}</span>
            {focus.status.pct != null && <span className="tnum">{focus.status.pct}%</span>}
          </p>
          <a className="btn sm" href={`#/${focus.href}`}>Open</a>
        </section>}
        {overdue.length > 0 && filter !== 'overdue' && <section className="dlv__attention" aria-labelledby="dlv-attention-heading">
          <h2 id="dlv-attention-heading" className="dlv__h2">Needs attention</h2>
          <div className="dlv__rows dlv__rows--compact">
            {overdue.slice(0,3).map(row => <WorkEntity
              key={row.key} row={row}
              show={{ kind: false, title: true, rel: true, status: false, progress: false, deadline: true, effort: false, risk: true, actions: false }}
            />)}
          </div>
          {overdue.length > 3 && <a className="btn ghost sm dlv__view-all" href={`#/${workHref('deliverables', 'overdue')}`}>View all {overdue.length} overdue →</a>}
        </section>}
      </aside>
    </div>
  </section>
}

function model_today(now) { return dayStr(now) }

/* Step 5D: Projects view — execution workspace. Reuses .dlv* presentation
   primitives from Deliverables to stay within the 55 kB CSS budget, so
   Projects reads as the same pillar as Overview + Deliverables. */
export function ProjectsView({ model, rows, now, filter }) {
  const [layout, setLayout] = useState('list')
  const allProjects = useMemo(() => model.rows.filter(r => r.kind === 'project'), [model])
  const active = allProjects.filter(r => !r.status.complete)
  const atRisk = allProjects.filter(r => r.atRisk)
  const dueSoon = allProjects.filter(r => ['CRITICAL','DUE SOON','OVERDUE'].includes(r.risk) && !r.status.complete)
  const completed = allProjects.filter(r => r.status.complete)
  const projects = useMemo(() => rows.filter(r => r.kind === 'project'), [rows])
  const focus = useMemo(() => {
    const order = { OVERDUE:0, CRITICAL:1, 'AT RISK':2, 'DUE SOON':3 }
    return [...active].sort((a,b) => (order[a.risk]??4)-(order[b.risk]??4) || b.score-a.score)[0] || null
  }, [active])
  const health = useMemo(() => {
    const bins = [
      { id:'risk',  label:'At risk',     tone:'warn', f: r => r.atRisk && !r.status.complete },
      { id:'late',  label:'Late stage',  tone:null,   f: r => { const p=r.status.pct??0; return p>=75 && p<100 && !r.atRisk && !r.status.complete } },
      { id:'mid',   label:'In progress', tone:null,   f: r => { const p=r.status.pct??0; return p>=25 && p<75 && !r.atRisk && !r.status.complete } },
      { id:'early', label:'Early',       tone:null,   f: r => { const p=r.status.pct??0; return p>0 && p<25 && !r.atRisk && !r.status.complete } },
      { id:'not',   label:'Not started', tone:null,   f: r => (r.status.pct??0)===0 && !r.atRisk && !r.status.complete },
      { id:'done',  label:'Completed',   tone:'good', f: r => r.status.complete },
    ].map(b => ({ ...b, count: allProjects.filter(b.f).length }))
    return bins
  }, [allProjects])
  const toneC = { warn:'var(--warn)', bad:'var(--bad)', good:'var(--good)' }
  const listTitle = filter==='completed'?'Completed projects':filter==='overdue'?'Overdue':filter==='risk'?'At risk':filter==='soon'?'Due soon':filter==='all'?'All projects':'Active projects'
  return <section className="dlv" aria-labelledby="projects-heading">
    <header className="dlv__head">
      <div>
        <p className="dlv__eyebrow">Work</p>
        <h2 id="projects-heading" className="dlv__title">Projects</h2>
        <p className="dlv__sub">Your active projects, where they stand, and what needs a decision next.</p>
      </div>
      <div className="wo__head-actions-inline" role="group" aria-label="Project presentation">
        {['list','gallery'].map(mode => <button key={mode} type="button" className="btn ghost sm" aria-pressed={layout===mode} onClick={()=>setLayout(mode)}>{mode==='list'?'List':'Gallery / spatial'}</button>)}
      </div>
    </header>

    <div className="dlv__snap" aria-label="Project snapshot">
      {[
        { id:'active',    label:'Active',    value:active.length,    tone:null },
        { id:'soon',      label:'Due soon',  value:dueSoon.filter(r=>r.risk!=='OVERDUE').length, tone:dueSoon.some(r=>r.risk==='CRITICAL')?'bad':'warn' },
        { id:'risk',      label:'At risk',   value:atRisk.length,    tone:atRisk.length?'bad':null },
        { id:'completed', label:'Completed', value:completed.length, tone:'good' },
      ].map(s => <a key={s.id} href={`#/${workHref('projects', s.id)}`}
        className={['dlv__pill', filter===s.id?'is-active':'', s.tone?`is-${s.tone}`:''].join(' ').trim()}>
          <span className="dlv__pill-val tnum">{s.value}</span>
          <span className="dlv__pill-label">{s.label}</span>
      </a>)}
    </div>

    <section className="dlv__pulse" aria-label="Project health distribution">
      <p className="dlv__pulse-cap"><span className="tiny muted">Progress & health</span><span className="tiny tnum muted">{allProjects.length} projects</span></p>
      <div role="img" aria-label="Project health distribution" style={{display:'flex',height:'10px',width:'100%',background:'var(--surface-2)',borderRadius:'6px',overflow:'hidden',gap:2}}>
        {health.map(b => b.count>0 ? <div key={b.id} title={`${b.label}: ${b.count}`} aria-label={`${b.label}: ${b.count}`}
          style={{flex:`${b.count} 1 0`, background: b.tone?toneC[b.tone]:'var(--accent-1)', borderRadius:'2px', minWidth:4}}/> : null)}
      </div>
      <div style={{display:'flex',gap:'var(--sp-3)',flexWrap:'wrap',marginTop:'6px'}}>
        {health.filter(b=>b.count>0).map(b => <span key={b.id} className="tiny" style={{color:b.tone?toneC[b.tone]:'var(--text-3)'}}>
          <span style={{display:'inline-block',width:8,height:8,borderRadius:2,background:b.tone?toneC[b.tone]:'var(--accent-1)',marginRight:4,verticalAlign:'middle'}}/>{b.label} <span className="tnum">{b.count}</span>
        </span>)}
      </div>
    </section>

    <div className="dlv__grid">
      <section className="dlv__list" aria-labelledby="prj-list-heading">
        <div className="dlv__section-head">
          <h2 id="prj-list-heading" className="dlv__h2">{listTitle}</h2>
          <span className="tiny muted tnum">{projects.length} {projects.length===1?'project':'projects'}</span>
        </div>
        {projects.length === 0
          ? <p className="dlv__empty">{filter==='completed'?'No completed projects yet.':filter==='overdue'?'No overdue projects.':filter==='risk'?'Nothing at risk.':filter==='soon'?'Nothing due immediately.':'No projects match this view.'}</p>
          : layout === 'gallery'
            ? <Suspense fallback={<p role="status">Loading gallery…</p>}><ProjectGallery rows={projects.map(r => ({ project: r.item, status: projectStatus(r.item, now) }))} now={now} /></Suspense>
            : <Rows rows={projects} now={now} empty="" />}
      </section>

      {layout === 'list' && <aside className="dlv__side">
        {focus && <section className="dlv__focus" aria-labelledby="prj-focus-heading">
          <p className="dlv__eyebrow">Project focus</p>
          <h2 id="prj-focus-heading" className="dlv__h2 dlv__h2--focus">{focus.item.name}</h2>
          {focus.item.category && <p className="dlv__focus-rel tiny muted">{focus.item.category}</p>}
          <p className="dlv__focus-meta">
            <span data-tone={focus.risk==='OVERDUE'||focus.risk==='CRITICAL'?'bad':focus.risk==='AT RISK'||focus.risk==='DUE SOON'?'warn':null}>{focus.status.dueText || 'No deadline'}</span>
            {focus.status.pct != null && <span className="tnum">{focus.status.pct}%</span>}
          </p>
          <a className="btn sm" href={`#/${focus.href}`}>Open</a>
        </section>}
        {atRisk.length > 0 && filter !== 'risk' && <section className="dlv__attention" aria-labelledby="prj-attention-heading">
          <h2 id="prj-attention-heading" className="dlv__h2">Needs attention</h2>
          <div className="dlv__rows dlv__rows--compact">
            {atRisk.slice(0,3).map(row => <WorkEntity key={row.key} row={row}
              show={{kind:true,title:true,rel:false,status:false,progress:false,deadline:true,effort:false,risk:true,actions:false}} />)}
          </div>
          {atRisk.length > 3 && <a className="dlv__view-all" href={`#/${workHref('projects', 'risk')}`}>View all {atRisk.length} at risk →</a>}
        </section>}
      </aside>}

      {layout === 'list' && <details className="workspace-project-items" open={!projects.length}>
        <summary>Project tasks and milestones</summary>
        <Rows rows={rows.filter(r => ['project-task','milestone'].includes(r.kind))} now={now} />
      </details>}
    </div>
  </section>
}

function Overload({ day, onPlan }) {
  const types = Object.entries(day.items.reduce((acc, item) => ({ ...acc, [item.kind]: (acc[item.kind] || 0) + 1 }), {}))
  return <section className="workspace-overload" aria-labelledby="overload-heading"><div><h2 id="overload-heading">Over capacity by {time(day.remainingMin)}</h2><p>{prettyDate(day.date)} · {types.map(([kind, count]) => `${count} ${kind === 'goal/project milestone' ? 'milestone' : kind}${count === 1 ? '' : 's'}`).join(' · ')}</p><p className="tiny">Top contributors: {[...day.items].sort((a, b) => (b.estimateMin || 0) - (a.estimateMin || 0)).slice(0, 3).map(item => item.name).join(', ')}</p></div><div className="head-actions"><button className="btn" onClick={() => onPlan('plan')}>Plan</button><button className="btn ghost" onClick={() => onPlan('recover')}>Recover</button></div></section>
}

export function WorkloadView({ model, now, options, onPlan }) {
  const load = model.load || []
  const hasCapacity = load.some(d => d.availableMin != null)
  const totalAvail = load.reduce((n,d)=>n+(d.availableMin||0),0)
  const totalCommitted = load.reduce((n,d)=>n+(d.committedMin||0),0)
  const totalOverload = load.reduce((n,d)=>n+(d.overloaded?Math.abs(d.remainingMin):0),0)
  const totalFree = Math.max(0, totalAvail-totalCommitted)
  const overloadedDays = load.filter(d=>d.overloaded)
  const freeDays = load.filter(d=>!d.overloaded && d.availableMin!=null && d.committedMin < d.availableMin)
  const peakDay = [...load].filter(d=>d.availableMin!=null).sort((a,b)=>b.committedMin-a.committedMin)[0] || load[0]
  const maxMin = Math.max(1, ...load.map(d=>Math.max(d.availableMin||0, d.committedMin||0)))
  const over = totalAvail > 0 && totalCommitted > totalAvail
  const today = model.today
  // Inline capacity-vs-committed stacked bar chart (zero new CSS)
  const barH = 180, barW = 680, padL = 40, padR = 12, padT = 14, padB = 30
  const n = load.length
  const slot = n>0 ? (barW-padL-padR)/n : 0
  const bw = Math.max(8, Math.min(28, slot*0.55))
  const yOf = v => padT + (1 - Math.min(1,Math.max(0,v/maxMin))) * (barH-padT-padB)
  return <section className="dlv" aria-labelledby="workload-heading">
    <header className="dlv__head">
      <div>
        <p className="dlv__eyebrow">Work</p>
        <h2 id="workload-heading" className="dlv__title">Workload</h2>
        <p className="dlv__sub">Can your capacity cover your commitments over the next week? Deadline-based estimates — unestimated work is not counted as effort.</p>
      </div>
      <div className="wo__head-actions-inline">
        <button className="btn ghost sm" onClick={() => onPlan('plan')}>Plan</button>
      </div>
    </header>

    <div className="dlv__snap" aria-label="Capacity summary">
      {[
        { id:'cap',    label:'Capacity',  value:hasCapacity?time(totalAvail):'Not set', tone:null, href:workHref('workload') },
        { id:'plan',   label:'Planned',   value:time(totalCommitted),                    tone:null, href:workHref('workload') },
        { id:'over',   label: over?'Over capacity':'Free', value: over?time(totalOverload):time(totalFree), tone: over?'bad':'good', href:workHref('workload') },
        { id:'peak',   label:'Peak',      value: peakDay?`${peakDay.label}`:'—',          tone: peakDay?.overloaded?'bad':null, href:workHref('workload') },
      ].map(s => <a key={s.id} href={`#/${s.href}`}
        className={['dlv__pill', s.tone?`is-${s.tone}`:''].join(' ').trim()}>
          <span className="dlv__pill-val tnum">{s.value}</span>
          <span className="dlv__pill-label">{s.label}</span>
      </a>)}
    </div>

    {!hasCapacity && <p className="dlv__focus" style={{padding:'var(--sp-4)'}}>
      <a className="workspace-capacity-link" href="#/settings">Set daily capacity in Settings</a> to see how your plan fits.
    </p>}

    <section className="dlv__pulse" aria-label="Capacity vs committed workload, next 7 days">
      <p className="dlv__pulse-cap">
        <span className="tiny muted">Next {n} days</span>
        <span className="tiny" style={{display:'inline-flex',gap:'var(--sp-3)',flexWrap:'wrap'}}>
          <span style={{color:'var(--text-3)'}}><i style={{display:'inline-block',width:10,height:3,background:'var(--accent-1)',borderRadius:2,verticalAlign:'middle',marginRight:4}}/>Capacity</span>
          <span style={{color:'var(--text-3)'}}><i style={{display:'inline-block',width:10,height:10,background:'var(--accent-2)',borderRadius:2,verticalAlign:'middle',marginRight:4}}/>Planned</span>
          <span style={{color:'var(--bad)'}}><i style={{display:'inline-block',width:10,height:10,background:'var(--bad)',borderRadius:2,verticalAlign:'middle',marginRight:4}}/>Over</span>
        </span>
      </p>
      <div style={{width:'100%',overflowX:'auto'}}>
      <svg viewBox={`0 0 ${barW} ${barH+30}`} width="100%" preserveAspectRatio="none" role="img" style={{display:'block',minWidth:320,maxWidth:'100%',height:'auto'}}
        aria-label={`Workload next ${n} days. ${load.map(d=>`${d.label}: ${time(d.committedMin)} committed of ${d.availableMin==null?'unset capacity':time(d.availableMin)}${d.overloaded?', over by '+time(Math.abs(d.remainingMin)):''}`).join('. ')}`}>
        {/* capacity reference line */}
        {hasCapacity && <line x1={padL} y1={yOf(totalAvail/n)} x2={barW-padR} y2={yOf(totalAvail/n)} stroke="var(--accent-1)" strokeWidth="1.2" strokeDasharray="4 3" opacity="0.7"/>}
        {/* gridlines */}
        {[0, 0.5, 1].map((t,i) => {
          const v = Math.round(maxMin*t)
          return <g key={i}>
            <line x1={padL} y1={yOf(v)} x2={barW-padR} y2={yOf(v)} stroke="var(--line)" strokeWidth="1"/>
            <text x={padL-6} y={yOf(v)+3} fontSize="10" fill="var(--text-3)" textAnchor="end" style={{fontVariantNumeric:'tabular-nums'}}>{v<=0?'0':`${Math.round(v/60*10)/10}h`}</text>
          </g>
        })}
        {/* bars */}
        {load.map((d,i) => {
          const x = padL + slot*i + (slot-bw)/2
          const capY = hasCapacity ? yOf(d.availableMin) : barH-padB
          const comH = Math.max(2,(barH-padB)-yOf(d.committedMin))
          const comY = (barH-padB)-comH
          const overAmt = d.overloaded ? (d.committedMin-(d.availableMin||0)) : 0
          const overH = overAmt>0 ? Math.max(2, (yOf(d.availableMin||0)-yOf(d.committedMin))) : 0
          const isToday = d.date===today
          return <g key={d.date}>
            {isToday && <rect x={padL+slot*i} y={padT-2} width={slot} height={barH-padT-padB+4} fill="var(--accent-1)" opacity="0.06" rx="4"/>}
            {/* capacity tick mark */}
            {hasCapacity && <line x1={x-2} x2={x+bw+2} y1={capY} y2={capY} stroke="var(--accent-1)" strokeWidth="2"/>}
            {/* committed bar */}
            <rect x={x} y={comY+overH} width={bw} height={comH} fill="var(--accent-2)" opacity={d.overloaded?0.45:0.9} rx="3"/>
            {/* over portion */}
            {overAmt>0 && <rect x={x} y={comY} width={bw} height={overH} fill="var(--bad)" rx="3"/>}
            <text x={x+bw/2} y={barH-padB+14} textAnchor="middle" fontSize="10" fill={isToday?'var(--accent-1)':'var(--text-3)'} fontWeight={isToday?700:500}>{d.label.slice(0,3)}</text>
            <text x={x+bw/2} y={barH-padB+26} textAnchor="middle" fontSize="9" fill="var(--text-3)" style={{fontVariantNumeric:'tabular-nums'}}>{Math.round((d.committedMin||0)/60*10)/10}h</text>
          </g>
        })}
      </svg>
      </div>
    </section>

    <div className="dlv__grid">
      <section className="dlv__list" aria-labelledby="wl-tight-heading">
        <div className="dlv__section-head">
          <h2 id="wl-tight-heading" className="dlv__h2">{over?'Where capacity is tight':'Capacity outlook'}</h2>
          {hasCapacity && <span className="tiny muted tnum">{overloadedDays.length} over · {freeDays.length} free</span>}
        </div>
        {!hasCapacity
          ? <p className="dlv__empty">Set a daily capacity in Settings to see where load fits.</p>
          : over
            ? <div className="wo__groups">
                {overloadedDays.length===0 && <p className="tiny muted">You're on top of the week — no days over capacity.</p>}
                {overloadedDays.map(d => <div key={d.date} className="wo__group" style={{display:'block',padding:'10px 0',borderBottom:'1px solid var(--line)'}}>
                  <div style={{display:'flex',alignItems:'baseline',justifyContent:'space-between',gap:12}}>
                    <div><strong className="wo__g-label">{d.label}</strong> <span className="tiny muted">{prettyDate(d.date)}</span></div>
                    <span className="tnum" style={{color:'var(--bad)'}}>{time(Math.abs(d.remainingMin))} over</span>
                  </div>
                  <p className="tiny muted" style={{margin:'4px 0 0'}}>
                    {time(d.committedMin)} committed · {time(d.availableMin)} capacity ·{' '}
                    {d.items.slice(0,3).map(it=>it.label||it.name).join(', ')}{d.items.length>3?` +${d.items.length-3} more`:''}
                  </p>
                </div>)}
              </div>
            : <div className="wo__groups">
                <p className="tiny muted" style={{padding:'var(--sp-3)',border:'1px dashed var(--line)',borderRadius:'var(--r-md)',textAlign:'center',margin:0}}>
                  You have <strong className="tnum" style={{color:'var(--good)'}}>{time(totalFree)}</strong> free across the next {n} days.
                </p>
                {freeDays.slice(0,3).map(d => <div key={d.date} style={{display:'flex',alignItems:'baseline',justifyContent:'space-between',gap:12,padding:'10px 0',borderBottom:'1px solid var(--line)'}}>
                  <div><strong>{d.label}</strong> <span className="tiny muted">{prettyDate(d.date)}</span></div>
                  <span className="tnum" style={{color:'var(--good)'}}>{time(d.remainingMin)} free</span>
                </div>)}
              </div>}
        <h3 className="dlv__h2" style={{marginTop:'var(--sp-5)'}}>Contributors on peak day ({peakDay?.label})</h3>
        {peakDay && <Rows rows={filterWork(model.rows.filter(r => {
          const keys = new Set(peakDay.items.map(i => `${i.kind==='project task'?'project-task':i.kind==='goal/project milestone'?'milestone':i.kind}:${i.id}`))
          return keys.has(r.key)
        }), options, model)} now={now} empty="No matching work lands on this day." />}
      </section>

      <aside className="dlv__side">
        <section className="dlv__focus" aria-labelledby="wl-outlook-heading">
          <p className="dlv__eyebrow">Capacity outlook</p>
          <h2 id="wl-outlook-heading" className="dlv__h2 dlv__h2--focus">
            {!hasCapacity?'Capacity not set'
              : over?<span style={{color:'var(--bad)'}}>Over by {time(totalOverload)}</span>
              : <span style={{color:'var(--good)'}}>{time(totalFree)} free</span>}
          </h2>
          <p className="dlv__focus-rel tiny muted">
            {!hasCapacity?'Set daily capacity in Settings to compare commitments against a real budget.'
              : over?`${Math.round(totalCommitted/Math.max(1,totalAvail)*100)}% of your week is committed.`
              : `${Math.round(totalCommitted/Math.max(1,totalAvail)*100)}% of your week is committed.`}
          </p>
          <div className="dlv__focus-meta">
            <span>Peak: {peakDay?.label} · {peakDay?time(peakDay.committedMin):'—'}</span>
            <span className="tnum">{overloadedDays.length} overloaded day{overloadedDays.length===1?'':'s'}</span>
          </div>
          <div style={{display:'flex',gap:'var(--sp-2)',flexWrap:'wrap'}}>
            <button className="btn sm" onClick={()=>onPlan('plan')}>Plan</button>
            {over && <button className="btn ghost sm" onClick={()=>onPlan('recover')}>Recover</button>}
          </div>
        </section>
      </aside>
    </div>
  </section>
}

export function DeadlinesView({ model, rows, now, filter }) {
  const source = rows // already filtered by filterWork (filter/query/horizon) for list; snapshot/pulse/next-up use model.deadlines for honest aggregates
  const allDeadlines = model.deadlines
  const today = model.today
  // Groups are computed from the FILTERED rows so horizon/filter are respected
  const overdue = source.filter(r => r.day < today && !r.status.complete)
  const todayRows = source.filter(r => r.day === today && !r.status.complete)
  const tomorrow_ = source.filter(r => r.day === addDaysStr(today,1) && !r.status.complete)
  const weekEnd = weekDays(today)[6]
  const thisWeek = source.filter(r => r.day > addDaysStr(today,1) && r.day <= weekEnd && !r.status.complete)
  const later = source.filter(r => r.day > weekEnd && !r.status.complete)
  const completed = source.filter(r => r.status.complete)
  // Aggregates (snapshot/pulse/next-up) over full deadline universe
  const allOverdue = allDeadlines.filter(r => r.day < today && !r.status.complete)
  const allToday = allDeadlines.filter(r => r.day === today && !r.status.complete)
  const allTomorrow = allDeadlines.filter(r => r.day === addDaysStr(today,1) && !r.status.complete)
  const allThisWeek = allDeadlines.filter(r => r.day > addDaysStr(today,1) && r.day <= weekEnd && !r.status.complete)
  const allCompleted = allDeadlines.filter(r => r.status.complete)
  const density = useMemo(() => {
    const bins = []
    for (let i = 0; i < 14; i++) {
      const d = addDaysStr(today, i)
      const c = allDeadlines.filter(r => r.day === d && !r.status.complete).length
      bins.push({ day: d, label: i === 0 ? 'Today' : i === 1 ? 'Tm' : String(new Date(d).getDate()), count: c, today: i === 0 })
    }
    return bins
  }, [allDeadlines, today])
  const maxCount = Math.max(1, ...density.map(b=>b.count))
  const groups = [
    { id:'overdue',   label:'Overdue',    tone:'bad',  rows: overdue,        accent:'var(--bad)' },
    { id:'today',     label:'Today',      tone:'bad',  rows: todayRows,      accent:'var(--accent-1)' },
    { id:'tomorrow',  label:'Tomorrow',   tone:'warn', rows: tomorrow_,      accent:null },
    { id:'thisweek',  label:'This week',  tone:null,   rows: thisWeek,       accent:null },
    { id:'later',     label:'Later',      tone:null,   rows: later,          accent:null },
  ].filter(g => g.rows.length)
  const completedGroup = completed.length ? [{ id:'completed', label:'Completed', tone:'good', rows: completed, accent:'var(--good)' }] : []
  const visibleGroups = [...groups, ...completedGroup]
  // Up next = first non-empty upcoming (Today > Tomorrow > This week > Later); else overdue
  const upNext = allToday[0] || allTomorrow[0] || allThisWeek[0] || later[0] || allOverdue[0] || null
  return <section className="dlv" aria-labelledby="deadlines-heading">
    <header className="dlv__head">
      <div>
        <p className="dlv__eyebrow">Work</p>
        <h2 id="deadlines-heading" className="dlv__title">Deadlines</h2>
        <p className="dlv__sub">What's due, how soon, and what to act on first — chronological, with risk and progress.</p>
      </div>
    </header>

    <div className="dlv__snap" aria-label="Deadline snapshot">
      {[
        { id:'overdue',   label:'Overdue',    value: allOverdue.length,   tone: allOverdue.length?'bad':null },
        { id:'today',     label:'Today',      value: allToday.length,     tone: allToday.length?'bad':null },
        { id:'soon',      label:'Next 7 days',value: allTomorrow.length+allThisWeek.length, tone: (allTomorrow.length+allThisWeek.length) ? 'warn' : null },
        { id:'completed', label:'Completed',  value: allCompleted.length, tone: 'good' },
      ].map(s => <a key={s.id} href={`#/${workHref('deadlines', s.id)}`}
        className={['dlv__pill', filter===s.id?'is-active':'', s.tone?`is-${s.tone}`:''].join(' ').trim()}>
          <span className="dlv__pill-val tnum">{s.value}</span>
          <span className="dlv__pill-label">{s.label}</span>
      </a>)}
    </div>

    <section className="dlv__pulse" aria-label="Deadline density, next 14 days">
      <p className="dlv__pulse-cap"><span className="tiny muted">Next 14 days</span><span className="tiny tnum muted">{allOverdue.length+allToday.length+allTomorrow.length+allThisWeek.length+later.length} upcoming</span></p>
      <div className="dlv__pulse-bars" role="list">
        {density.map(b => <div key={b.day} className="dlv__pulse-col" role="listitem" aria-label={`${b.label}: ${b.count}`}>
          <div className="dlv__pulse-track"><div className={['dlv__pulse-fill', b.today?'is-accent':''].join(' ').trim()} style={{height:`${Math.max(4, Math.round(b.count/maxCount*100))}%`}}/></div>
          <span className={['dlv__pulse-label', b.today?'is-today':''].join(' ').trim()}>{b.label}</span>
        </div>)}
      </div>
      {allOverdue.length > 0 && filter !== 'overdue' && <p className="tiny" style={{color:'var(--bad)',marginTop:'6px'}}><span style={{display:'inline-block',width:8,height:8,borderRadius:2,background:'var(--bad)',marginRight:4,verticalAlign:'middle'}}/>{allOverdue.length} overdue {allOverdue.length===1?'item':'items'}</p>}
    </section>

    <div className="dlv__grid">
      <section className="dlv__list" aria-labelledby="dl-list-heading">
        <div className="dlv__section-head">
          <h2 id="dl-list-heading" className="dlv__h2">Timeline</h2>
          <span className="tiny muted tnum">{rows.length} {rows.length===1?'deadline':'deadlines'}</span>
        </div>
        {visibleGroups.length === 0
          ? <p className="dlv__empty">{filter==='completed'?'No completed deadlines yet.':'No deadlines in this view.'}</p>
          : <div className="dlv__rows">
              {visibleGroups.map(g => <section key={g.id} className="dl-group" aria-labelledby={`dlg-${g.id}`} style={{paddingBottom:'var(--sp-4)',borderLeft:`2px solid ${g.accent||'var(--line)'}`,paddingLeft:'var(--sp-4)',marginLeft:4,marginBottom:'var(--sp-3)'}}>
                <div className="dlv__section-head" style={{marginBottom:'var(--sp-2)'}}>
                  <h3 id={`dlg-${g.id}`} className="dlv__h2" style={g.tone?{color:g.tone==='bad'?'var(--bad)':g.tone==='warn'?'var(--warn)':g.tone==='good'?'var(--good)':'var(--text-2)'}:null}>{g.label}</h3>
                  <span className="tiny muted tnum">{g.rows.length}</span>
                </div>
                <Rows rows={g.rows} now={now} empty="" />
              </section>)}
            </div>}
      </section>

      <aside className="dlv__side">
        {upNext && <section className="dlv__focus" aria-labelledby="dl-next-heading">
          <p className="dlv__eyebrow">Next up</p>
          <h2 id="dl-next-heading" className="dlv__h2 dlv__h2--focus">{upNext.item.name}</h2>
          <p className="dlv__focus-rel tiny muted">{({project:'Project',assignment:'Assignment','project-task':'Task',milestone:'Milestone'})[upNext.kind] || upNext.kind}{upNext.parent ? ` · ${upNext.parent.name}` : ''}</p>
          <p className="dlv__focus-meta">
            <span data-tone={upNext.risk==='OVERDUE'||upNext.risk==='CRITICAL'?'bad':upNext.risk==='AT RISK'||upNext.risk==='DUE SOON'?'warn':null}>{upNext.status.dueText || 'No deadline'}</span>
            {upNext.status.pct != null && <span className="tnum">{upNext.status.pct}%</span>}
          </p>
          <a className="btn sm" href={`#/${upNext.href}`}>Open</a>
        </section>}
        {allOverdue.length > 0 && filter !== 'overdue' && <section className="dlv__attention" aria-labelledby="dl-attention-heading">
          <h2 id="dl-attention-heading" className="dlv__h2">Overdue</h2>
          <div className="dlv__rows dlv__rows--compact">
            {allOverdue.slice(0,3).map(row => <WorkEntity key={row.key} row={row}
              show={{kind:false,title:true,rel:true,status:false,progress:false,deadline:true,effort:false,risk:true,actions:false}} />)}
          </div>
          {allOverdue.length > 3 && <a className="dlv__view-all" href={`#/${workHref('deadlines','overdue')}`}>View all {allOverdue.length} overdue →</a>}
        </section>}
      </aside>
    </div>
  </section>
}
