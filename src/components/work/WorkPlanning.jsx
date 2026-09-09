import { useMemo } from 'react'
import { useStore } from '../../store.jsx'
import { recoveryPlan } from '../../lib/planning.js'
import { hrefFor } from '../../lib/completion.js'
import PlanningPanel from '../today/PlanningPanel.jsx'
import Sheet from '../ui/Sheet.jsx'

export default function WorkPlanning({ mode, onClose, now }) {
  const { state } = useStore()
  const recovery = useMemo(() => mode === 'recover' ? recoveryPlan(state, { now }) : null, [state, now, mode])
  return <Sheet open onClose={onClose} title={mode === 'recover' ? 'Recover capacity' : 'Plan work'} labelledBy="work-plan-title">
    {mode === 'plan' ? <PlanningPanel state={state} now={now} openTick={1} /> : <div className="stack"><p>{recovery.explanation}</p>{[['Keep', recovery.keep], ['Move / defer', [...recovery.move, ...recovery.defer]]].map(([label, items]) => <section key={label}><h3>{label}</h3>{items.length ? items.map(({ item }) => <a className="btn ghost" key={`${item.kind}:${item.id}`} href={`#/${hrefFor(item.kind, item)}`} onClick={onClose}>{item.name || item.label}</a>) : <p className="tiny muted">Nothing suggested.</p>}</section>)}<p>{recovery.validation.reason}</p><p className="tiny muted">Suggestions only. Open an item to review and change its deadline; nothing moves automatically.</p></div>}
  </Sheet>
}
