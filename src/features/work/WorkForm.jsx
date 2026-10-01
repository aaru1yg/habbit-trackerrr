/* ============================================================
   WORK FORM — one form for projects and one-off tasks.
   The only difference is that a project can hold a checklist.
   ============================================================ */
import { useEffect, useState } from 'react'
import { useStore, useActions } from '../../core/store.jsx'
import { now, today, shift } from '../../core/date.js'
import {
  Sheet, Button, Field, Input, Textarea, Select, Segmented, Chip, useToast,
} from '../../ui/index.jsx'

const PRESETS = [
  { label: 'Today',     get: () => `${today()}T18:00` },
  { label: 'Tomorrow',  get: () => `${shift(today(), 1)}T18:00` },
  { label: 'In 3 days', get: () => `${shift(today(), 3)}T18:00` },
  { label: 'Next week', get: () => `${shift(today(), 7)}T18:00` },
  { label: 'In a month',get: () => `${shift(today(), 30)}T18:00` },
]

const blank = (kind) => ({ kind, title: '', notes: '', deadline: '', goalId: '' })

export default function WorkForm({ open, onClose, item, defaultKind = 'task' }) {
  const { goals } = useStore()
  const actions = useActions()
  const toast = useToast()
  const [f, setF] = useState(() => blank(defaultKind))
  const [err, setErr] = useState('')

  useEffect(() => {
    if (!open) return
    setErr('')
    setF(item
      ? { kind: item.kind, title: item.title, notes: item.notes, deadline: item.deadline || '', goalId: item.goalId || '' }
      : blank(defaultKind))
  }, [open, item, defaultKind])

  const set = (patch) => setF((p) => ({ ...p, ...patch }))

  const submit = () => {
    const title = f.title.trim()
    if (!title) { setErr('What is it called?'); return }
    const payload = {
      kind: f.kind,
      title,
      notes: f.notes.trim(),
      deadline: f.deadline || null,
      goalId: f.goalId || null,
    }
    if (item) { actions.updateWork(item.id, payload); toast('Saved') }
    else { actions.addWork(payload); toast(`“${title}” added`, 'good') }
    onClose()
  }

  const openGoals = goals.filter((g) => !g.doneAt)

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={item ? 'Edit' : f.kind === 'project' ? 'New project' : 'New task'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit}>{item ? 'Save' : 'Add'}</Button>
        </>
      }
    >
      <div className="stack">
        {!item && (
          <Field label="Type" hint="A project holds a checklist. A task is a single thing you finish.">
            <Segmented
              label="Work type"
              value={f.kind}
              onChange={(v) => set({ kind: v })}
              options={[{ value: 'task', label: 'Task' }, { value: 'project', label: 'Project' }]}
            />
          </Field>
        )}

        <Field label="Title" error={err}>
          <Input
            data-autofocus
            value={f.title}
            onChange={(e) => set({ title: e.target.value })}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder={f.kind === 'project' ? 'Dissertation' : 'Email the landlord'}
            maxLength={120}
          />
        </Field>

        <Field label="Deadline" hint="Status (on track / at risk / urgent) is computed from this and your real progress.">
          <Input type="datetime-local" value={f.deadline} onChange={(e) => set({ deadline: e.target.value })} />
        </Field>

        <div className="pill-row">
          {PRESETS.map((p) => (
            <Chip key={p.label} onClick={() => set({ deadline: p.get() })}>{p.label}</Chip>
          ))}
          {f.deadline && <Chip onClick={() => set({ deadline: '' })}>Clear</Chip>}
        </div>

        {openGoals.length > 0 && (
          <Field label="Part of a goal" hint="Optional. Linked work feeds that goal’s progress.">
            <Select value={f.goalId} onChange={(e) => set({ goalId: e.target.value })}>
              <option value="">Not linked</option>
              {openGoals.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
            </Select>
          </Field>
        )}

        <Field label="Notes">
          <Textarea value={f.notes} onChange={(e) => set({ notes: e.target.value })} rows={4} placeholder="Optional" maxLength={2000} />
        </Field>
      </div>
    </Sheet>
  )
}

export { now }
