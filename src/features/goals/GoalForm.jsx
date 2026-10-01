/* ============================================================
   GOAL FORM — title, why, target date. Linking happens on the
   detail screen, where you can see what you are linking to.
   ============================================================ */
import { useEffect, useState } from 'react'
import { useActions } from '../../core/store.jsx'
import { today, shift } from '../../core/date.js'
import { Sheet, Button, Field, Input, Textarea, Chip, useToast } from '../../ui/index.jsx'

const PRESETS = [
  { label: 'In a month', days: 30 },
  { label: 'In 3 months', days: 90 },
  { label: 'In 6 months', days: 182 },
  { label: 'In a year', days: 365 },
]

export default function GoalForm({ open, onClose, goal }) {
  const actions = useActions()
  const toast = useToast()
  const [f, setF] = useState({ title: '', why: '', due: '' })
  const [err, setErr] = useState('')

  useEffect(() => {
    if (!open) return
    setErr('')
    setF(goal ? { title: goal.title, why: goal.why, due: goal.due || '' } : { title: '', why: '', due: '' })
  }, [open, goal])

  const submit = () => {
    const title = f.title.trim()
    if (!title) { setErr('Name the outcome, not the activity.'); return }
    const payload = { title, why: f.why.trim(), due: f.due || null }
    if (goal) { actions.updateGoal(goal.id, payload); toast('Saved') }
    else { actions.addGoal(payload); toast(`“${title}” set`, 'good') }
    onClose()
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={goal ? 'Edit goal' : 'New goal'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit}>{goal ? 'Save' : 'Set goal'}</Button>
        </>
      }
    >
      <div className="stack">
        <Field label="The outcome" error={err} hint="“Run a half marathon”, not “run more”.">
          <Input
            data-autofocus
            value={f.title}
            onChange={(e) => setF({ ...f, title: e.target.value })}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder="Run a half marathon"
            maxLength={100}
          />
        </Field>

        <Field label="Why it matters" hint="Read this on the days you don't feel like it.">
          <Textarea value={f.why} onChange={(e) => setF({ ...f, why: e.target.value })} rows={3} maxLength={400} placeholder="Optional" />
        </Field>

        <Field label="Target date">
          <Input type="date" value={f.due} onChange={(e) => setF({ ...f, due: e.target.value })} min={today()} />
        </Field>
        <div className="pill-row">
          {PRESETS.map((p) => (
            <Chip key={p.label} onClick={() => setF({ ...f, due: shift(today(), p.days) })}>{p.label}</Chip>
          ))}
          {f.due && <Chip onClick={() => setF({ ...f, due: '' })}>Clear</Chip>}
        </div>
      </div>
    </Sheet>
  )
}
