import { useEffect, useMemo, useState } from 'react'
import { useStore } from '../../store.jsx'
import { CardHead } from '../ui/SectionCard.jsx'
import { buildDayPlan, buildWeekPlan } from '../../lib/planning.js'
import { preferencesOf } from '../../lib/personalization.js'
const time = (v) => new Date(v).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

export default function PlanningPanel({ state, now = new Date(), openTick = 0 }) {
  const { dispatch } = useStore()
  const [open, setOpen] = useState(false); const [week, setWeek] = useState(false); const [accepted, setAccepted] = useState(false); const [revision, setRevision] = useState(0)
  const prefs = preferencesOf(state)
  const plan = useMemo(() => { void revision; return open ? (week ? buildWeekPlan(state, { now }) : buildDayPlan(state, { now })) : null }, [state, now, open, week, revision])

  // A quick action can open this panel from anywhere on Today.
  useEffect(() => { if (openTick > 0) { setWeek(false); setOpen(true) } }, [openTick])

  const build = () => {
    setWeek(false); setOpen(true); setAccepted(false)
    // Real behaviour: the user asked for a plan. Recorded so "Plan my day"
    // can earn its place in the quick actions instead of being pinned there.
    dispatch({ type: 'RECORD_SIGNAL', signal: 'plan-build' })
  }

  return <section className="card pad planning-panel"><CardHead title="Plan my day"><button className="btn primary sm" onClick={build}>Build my day</button></CardHead>{!open && <p className="card-blurb">{prefs.dailyCapacityMin == null ? 'A suggested schedule using your priorities, deadlines and estimates. Set a daily capacity in Settings → How you work to have the plan checked against it.' : 'A suggested schedule using your priorities, deadlines, estimates and capacity. Nothing moves without your approval.'}</p>}{open && !week && <><div className="planning-fit"><strong>{plan.fit}</strong><span>{plan.capacityMin == null ? 'Planning is limited because available capacity isn’t configured. Set one in Settings → How you work.' : `${plan.requiredMin} min required · ${plan.usableCapacityMin} min usable capacity`}</span></div><ol className="plan-blocks">{plan.blocks.map((b) => <li key={b.id} className={!b.fits ? 'plan-over' : ''}><span>{time(b.start)}–{time(b.end)}</span><strong>{b.item.label || b.item.name}</strong><small>{b.durationMin} min · {b.reason}</small></li>)}</ol><div className="planning-actions"><button className="btn primary sm" onClick={() => setAccepted(true)}>{accepted ? 'Plan accepted' : 'Accept plan'}</button><button className="btn ghost sm" onClick={() => setRevision((v) => v + 1)}>Regenerate</button><button className="btn ghost sm" onClick={() => setOpen(false)}>Dismiss</button><button className="btn ghost sm" onClick={() => setWeek(true)}>Plan my week</button></div></>}{open && week && <><div className="planning-fit"><strong>{plan.fit}</strong><span>{plan.explanation}</span></div><div className="week-plan-grid">{plan.rows.map((r) => <div key={r.date}><strong>{new Date(`${r.date}T12:00:00`).toLocaleDateString([], { weekday: 'short' })}</strong>{r.blocks.map((b) => <span key={b.item.id}>{b.item.label || b.item.name}<small>{b.durationMin}m</small></span>)}</div>)}</div><button className="btn ghost sm" onClick={() => setWeek(false)}>Back to day</button></>}</section>
}
