/* ============================================================
   GOAL FORM — the ONE canonical form for creating and editing a
   goal. Every entry point (Goals header, Goal Detail, contextual
   action, Omni) invokes this same sheet. Phase 6 deliberately does
   not add a second form: milestones are authored here and progress
   continues to derive from the existing goal engine.
   ============================================================ */
import { useState } from 'react'
import { useStore } from '../../store.jsx'
import Sheet from '../ui/Sheet.jsx'
import { Field, describedProps } from '../ui/fields.jsx'
import { GOAL_AREAS } from '../../lib/goals.js'
import { todayStr, isValidDayStr } from '../../lib/dates.js'
import { IconPlus, IconTrash } from '../../lib/icons.jsx'

export function GoalFormSheet({ open, onClose, editing }) {
  const { dispatch } = useStore()
  const [draft, setDraft] = useState(null)

  // reset the draft each time the sheet opens
  const key = `${open}-${editing?.id || 'new'}`
  const [lastKey, setLastKey] = useState('')
  if (key !== lastKey) {
    setLastKey(key)
    setDraft(editing
      ? {
          title: editing.title, why: editing.why || '', area: editing.area || 'mind',
          startDate: editing.startDate || todayStr(), targetDate: editing.targetDate || '',
          notes: editing.notes || '', status: editing.status || 'active',
          milestones: (editing.milestones || []).map((m) => ({ ...m })),
        }
      : {
          title: '', why: '', area: 'mind', startDate: todayStr(), targetDate: '',
          notes: '', status: 'active',
          milestones: [{ id: `draft-${Date.now()}`, name: '', targetDate: '', done: false, doneAt: null, order: 0 }],
        })
  }

  if (!draft) return null
  const set = (k, v) => setDraft((d) => ({ ...d, [k]: v }))

  const save = () => {
    const title = draft.title.trim()
    if (!title) return
    const patch = {
      title,
      why: draft.why.trim(),
      area: draft.area,
      startDate: isValidDayStr(draft.startDate) ? draft.startDate : todayStr(),
      targetDate: isValidDayStr(draft.targetDate) ? draft.targetDate : null,
      notes: draft.notes.trim(),
      status: draft.status,
    }
    patch.milestones = (draft.milestones || []).filter((m) => String(m.name || '').trim())
    if (editing) dispatch({ type: 'UPDATE_GOAL', id: editing.id, patch })
    else dispatch({ type: 'ADD_GOAL', goal: patch })
    onClose()
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={editing ? 'Edit goal' : 'New goal'}
      labelledBy="goal-form-title"
      footer={(
        <>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" onClick={save} disabled={!draft.title.trim()}>
            {editing ? 'Save goal' : 'Create goal'}
          </button>
        </>
      )}
    >
      <div className="stack" style={{ gap: 14 }}>
        <div>
          <label className="field-label" htmlFor="goal-title">What do you want to achieve?</label>
          <input id="goal-title" className="field" value={draft.title} maxLength={120}
            placeholder="Run a half marathon" onChange={(e) => set('title', e.target.value)} />
        </div>

        <div>
          <label className="field-label" htmlFor="goal-why">Why it matters <span style={{ color: 'var(--text-3)', fontWeight: 500 }}>(optional)</span></label>
          <input id="goal-why" className="field" value={draft.why} maxLength={200}
            placeholder="For the version of me who finishes things" onChange={(e) => set('why', e.target.value)} />
        </div>

        <div className="form-row">
          <div>
            <label className="field-label" htmlFor="goal-area">Area</label>
            <select id="goal-area" className="field" value={draft.area} onChange={(e) => set('area', e.target.value)}>
              {GOAL_AREAS.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label" htmlFor="goal-start">Started</label>
            <input id="goal-start" className="field" type="date" value={draft.startDate || ''}
              onChange={(e) => set('startDate', e.target.value)} />
          </div>
        </div>

        <Field
          id="goal-target"
          label="Target date"
          optional
          hint="Without a target date there is no pace line — the goal still tracks progress, it just will not be judged."
        >
          {(p) => (
            <input {...describedProps(p)} className="field" type="date" value={draft.targetDate || ''}
              onChange={(e) => set('targetDate', e.target.value)} />
          )}
        </Field>

        <div>
          <label className="field-label">Milestones <span style={{ color: 'var(--text-3)', fontWeight: 500 }}>(optional)</span></label>
          <p className="tiny muted" style={{ marginBottom: 8 }}>
            Checkpoints between here and the outcome. Progress is measured from these when they exist.
          </p>
          <div className="ms-editor">
            {draft.milestones.map((m, i) => (
              <div key={m.id} className="ms-editor-row">
                <input
                  className="field"
                  value={m.name}
                  maxLength={120}
                  placeholder={i === 0 ? 'Finish a first draft' : 'Next checkpoint'}
                  aria-label={`Milestone ${i + 1} name`}
                  onChange={(e) => setDraft((d) => ({
                    ...d,
                    milestones: d.milestones.map((x) => (x.id === m.id ? { ...x, name: e.target.value } : x)),
                  }))}
                />
                <input
                  className="field"
                  type="date"
                  value={m.targetDate || ''}
                  aria-label={`Milestone ${i + 1} target date`}
                  onChange={(e) => setDraft((d) => ({
                    ...d,
                    milestones: d.milestones.map((x) => (x.id === m.id ? { ...x, targetDate: e.target.value } : x)),
                  }))}
                />
                <button
                  type="button"
                  className="btn ghost icon"
                  aria-label={`Remove milestone ${i + 1}`}
                  onClick={() => setDraft((d) => ({ ...d, milestones: d.milestones.filter((x) => x.id !== m.id) }))}
                >
                  <IconTrash size={15} />
                </button>
              </div>
            ))}
            <button
              type="button"
              className="btn ghost sm"
              onClick={() => setDraft((d) => ({
                ...d,
                milestones: [...d.milestones, {
                  id: `draft-${Date.now()}-${d.milestones.length}`,
                  name: '', targetDate: '', done: false, doneAt: null, order: d.milestones.length,
                }],
              }))}
            >
              <IconPlus size={14} /> Add milestone
            </button>
          </div>
        </div>

        {editing && (
          <div>
            <label className="field-label" htmlFor="goal-status">Status</label>
            <select id="goal-status" className="field" value={draft.status} onChange={(e) => set('status', e.target.value)}>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="completed">Completed</option>
            </select>
          </div>
        )}

        <div>
          <label className="field-label" htmlFor="goal-notes">Notes <span style={{ color: 'var(--text-3)', fontWeight: 500 }}>(optional)</span></label>
          <textarea id="goal-notes" className="field textarea" rows={3} value={draft.notes} maxLength={2000}
            onChange={(e) => set('notes', e.target.value)} />
        </div>
      </div>
    </Sheet>
  )
}

export default GoalFormSheet
