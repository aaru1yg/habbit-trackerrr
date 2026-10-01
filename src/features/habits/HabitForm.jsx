/* ============================================================
   HABIT FORM — create and edit, one component.
   ============================================================ */
import { useEffect, useState } from 'react'
import { useActions } from '../../core/store.jsx'
import { CATEGORIES } from '../../core/schema.js'
import {
  Sheet, Button, Field, Input, Textarea, Segmented, Chip, Stepper, useToast,
} from '../../ui/index.jsx'

const ICONS = ['✦', '💪', '🏃', '📖', '🧘', '💧', '🛏', '🥗', '🧠', '✍️', '🎸', '📵', '☀️', '🧹', '💬', '💻']
const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

const blank = () => ({
  name: '', icon: '✦', category: 'mind',
  targetType: 'done', goal: 8, unit: 'times',
  cadenceType: 'daily', days: [1, 2, 3, 4, 5], perWeek: 3,
  cue: '', notes: '',
})

export default function HabitForm({ open, onClose, habit }) {
  const actions = useActions()
  const toast = useToast()
  const [f, setF] = useState(blank)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (!open) return
    setErr('')
    setF(habit
      ? {
          name: habit.name, icon: habit.icon, category: habit.category,
          targetType: habit.target.type, goal: habit.target.goal, unit: habit.target.unit || 'times',
          cadenceType: habit.cadence.type,
          days: habit.cadence.days || [1, 2, 3, 4, 5],
          perWeek: habit.cadence.perWeek || 3,
          cue: habit.cue, notes: habit.notes,
        }
      : blank())
  }, [open, habit])

  const set = (patch) => setF((prev) => ({ ...prev, ...patch }))

  const submit = () => {
    const name = f.name.trim()
    if (!name) { setErr('Give it a name you will recognise at 6am.'); return }

    const payload = {
      name,
      icon: f.icon,
      category: f.category,
      target: { type: f.targetType, goal: f.targetType === 'done' ? 1 : f.goal, unit: f.unit },
      cadence:
        f.cadenceType === 'days' ? { type: 'days', days: f.days }
        : f.cadenceType === 'weekly' ? { type: 'weekly', perWeek: f.perWeek }
        : { type: 'daily' },
      cue: f.cue.trim(),
      notes: f.notes.trim(),
    }

    if (habit) { actions.updateHabit(habit.id, payload); toast('Habit updated') }
    else { actions.addHabit(payload); toast(`“${name}” added`, 'good') }
    onClose()
  }

  const toggleDay = (i) =>
    set({ days: f.days.includes(i) ? f.days.filter((x) => x !== i) : [...f.days, i].sort() })

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={habit ? 'Edit habit' : 'New habit'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit}>{habit ? 'Save' : 'Add habit'}</Button>
        </>
      }
    >
      <div className="stack">
        <Field label="Name" error={err}>
          <Input
            data-autofocus
            value={f.name}
            onChange={(e) => set({ name: e.target.value })}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder="Read 20 pages"
            maxLength={80}
          />
        </Field>

        <Field label="Icon">
          <div className="pill-row">
            {ICONS.map((i) => (
              <Chip key={i} on={f.icon === i} onClick={() => set({ icon: i })} aria-label={`Icon ${i}`}>
                <span style={{ fontSize: 15 }}>{i}</span>
              </Chip>
            ))}
          </div>
        </Field>

        <Field label="Area" hint="Used to group your consistency in Insights.">
          <div className="pill-row">
            {CATEGORIES.map((c) => (
              <Chip key={c.id} on={f.category === c.id} onClick={() => set({ category: c.id })}>
                {c.icon} {c.label}
              </Chip>
            ))}
          </div>
        </Field>

        <hr className="hr hr--fade" />

        <Field label="What counts as done?">
          <Segmented
            label="Target type"
            value={f.targetType}
            onChange={(v) => set({ targetType: v, unit: v === 'minutes' ? 'min' : 'times', goal: v === 'minutes' ? 30 : 8 })}
            options={[
              { value: 'done', label: 'Just do it' },
              { value: 'count', label: 'A count' },
              { value: 'minutes', label: 'Minutes' },
            ]}
          />
        </Field>

        {f.targetType !== 'done' && (
          <div className="row" style={{ gap: 'var(--s4)' }}>
            <Field label="Daily target">
              <Stepper
                value={f.goal}
                onChange={(v) => set({ goal: v })}
                min={1}
                max={f.targetType === 'minutes' ? 600 : 100}
                step={f.targetType === 'minutes' ? 5 : 1}
                suffix={f.targetType === 'minutes' ? 'min' : ''}
              />
            </Field>
            {f.targetType === 'count' && (
              <Field label="Unit">
                <Input value={f.unit} onChange={(e) => set({ unit: e.target.value })} placeholder="glasses" maxLength={16} />
              </Field>
            )}
          </div>
        )}

        <hr className="hr hr--fade" />

        <Field label="How often?">
          <Segmented
            label="Cadence"
            value={f.cadenceType}
            onChange={(v) => set({ cadenceType: v })}
            options={[
              { value: 'daily', label: 'Every day' },
              { value: 'days', label: 'Certain days' },
              { value: 'weekly', label: 'N× a week' },
            ]}
          />
        </Field>

        {f.cadenceType === 'days' && (
          <div className="pill-row">
            {DOW.map((d, i) => (
              <Chip key={i} on={f.days.includes(i)} onClick={() => toggleDay(i)} aria-label={`Toggle day ${i}`}>
                {d}
              </Chip>
            ))}
          </div>
        )}

        {f.cadenceType === 'weekly' && (
          <Field label="Times per week" hint="Streaks for this habit are counted in weeks, not days.">
            <Stepper value={f.perWeek} onChange={(v) => set({ perWeek: v })} min={1} max={7} />
          </Field>
        )}

        <Field label="Cue" hint="When and where. The strongest predictor of actually doing it.">
          <Input value={f.cue} onChange={(e) => set({ cue: e.target.value })} placeholder="After morning coffee, at the desk" maxLength={90} />
        </Field>

        <Field label="Notes">
          <Textarea value={f.notes} onChange={(e) => set({ notes: e.target.value })} placeholder="Optional" rows={3} maxLength={600} />
        </Field>
      </div>
    </Sheet>
  )
}
