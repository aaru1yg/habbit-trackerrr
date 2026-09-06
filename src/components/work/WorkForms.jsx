/* ============================================================
   WORK FORMS — create/edit a project or an assignment.
   Fast by default (name + deadline + priority), everything else
   behind "More options". No 12-field walls of inputs.
   ============================================================ */
import { useEffect, useMemo, useState } from 'react'
import { useStore } from '../../store.jsx'
import Sheet from '../ui/Sheet.jsx'
import { AssignmentDeadlineField, ProjectDeadlineField } from './DeadlineField.jsx'
import { QuickProgress } from './WorkKit.jsx'
import { PRIORITIES, WORK_CATEGORIES } from '../../lib/work.js'
import { activeHabits } from '../../lib/stats.js'
import { dayStr, todayStr } from '../../lib/dates.js'
import {   IconChevronDown, IconLink } from '../../lib/icons.jsx'

function MoreOptions({ open, onToggle, children, id }) {
  return (
    <div>
      <button type="button" className="btn ghost sm" onClick={onToggle} aria-expanded={open} aria-controls={id} style={{ alignSelf: 'flex-start' }}>
        More options
        <span style={{ display: 'grid', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 200ms' }}>
          <IconChevronDown size={15} />
        </span>
      </button>
      {open && <div id={id} className="stack" style={{ gap: 16, marginTop: 14 }}>{children}</div>}
    </div>
  )
}

function PriorityPicker({ value, onChange }) {
  return (
    <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
      <legend className="field-label">Priority</legend>
      <div className="seg" role="group" aria-label="Priority">
        {PRIORITIES.map((p) => (
          <button key={p.id} type="button" aria-pressed={value === p.id} onClick={() => onChange(p.id)}>{p.label}</button>
        ))}
      </div>
    </fieldset>
  )
}

/* ------------------------------------------------------------
   PROJECT FORM (§55, §57)
   ------------------------------------------------------------ */
export function ProjectForm({ open, onClose, editing }) {
  const { state, dispatch } = useStore()
  const habits = activeHabits(state)
  const [name, setName] = useState('')
  const [startDate, setStartDate] = useState(todayStr())
  const [deadline, setDeadline] = useState(null)
  const [priority, setPriority] = useState('normal')
  const [more, setMore] = useState(false)
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('General')
  const [estimateHrs, setEstimateHrs] = useState('')
  const [milestones, setMilestones] = useState('')
  const [linked, setLinked] = useState([])
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setError('')
    setMore(false)
    if (editing) {
      setName(editing.name || '')
      setStartDate(editing.startDate || todayStr())
      setDeadline(editing.deadline || null)
      setPriority(editing.priority || 'normal')
      setDescription(editing.description || '')
      setCategory(editing.category || 'General')
      setEstimateHrs(editing.estimateMin ? String(Math.round(editing.estimateMin / 6) / 10) : '')
      setMilestones('')
      setLinked(editing.linkedHabitIds || [])
      setNotes(editing.notes || '')
      if (editing.description || editing.notes || (editing.linkedHabitIds || []).length) setMore(true)
    } else {
      setName(''); setStartDate(todayStr()); setDeadline(null); setPriority('normal')
      setDescription(''); setCategory('General'); setEstimateHrs(''); setMilestones('')
      setLinked([]); setNotes('')
    }
  }, [open, editing])

  const save = () => {
    const trimmed = name.trim()
    if (!trimmed) { setError('Give the project a name.'); return }
    if (deadline && dayStr(new Date(`${String(deadline).slice(0, 10)}T12:00:00`)) < startDate) {
      setError('The deadline is before the start date.')
      return
    }
    const estimateMin = estimateHrs ? Math.round(Number(estimateHrs) * 60) : null
    const base = {
      name: trimmed,
      startDate,
      deadline: deadline ? String(deadline).slice(0, 10) : null,
      priority,
      description: description.trim(),
      category,
      estimateMin: Number.isFinite(estimateMin) && estimateMin > 0 ? estimateMin : null,
      linkedHabitIds: linked,
      notes: notes.trim(),
    }
    if (editing) {
      dispatch({ type: 'UPDATE_PROJECT', id: editing.id, patch: base })
      const added = parseMilestones(milestones)
      for (const m of added) dispatch({ type: 'ADD_MILESTONE', projectId: editing.id, name: m })
    } else {
      const ms = parseMilestones(milestones).map((m) => ({
        id: Math.random().toString(36).slice(2, 10), name: m, due: null, tasks: [],
      }))
      dispatch({ type: 'ADD_PROJECT', project: { ...base, milestones: ms } })
    }
    onClose()
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={editing ? 'Edit project' : 'New project'}
      labelledBy="project-form-title"
      footer={
        <>
          <button className="btn ghost" type="button" onClick={onClose}>Cancel</button>
          <button className="btn primary" type="button" onClick={save} disabled={!name.trim()}>
            {editing ? 'Save changes' : 'Create project'}
          </button>
        </>
      }
    >
      <div className="stack" style={{ gap: 18 }}>
        <div>
          <label className="field-label" htmlFor="project-name">Project</label>
          <input id="project-name" className="field" autoFocus value={name} maxLength={90}
            placeholder="e.g. Build portfolio website"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') save() }} />
          {error && <p style={{ color: 'var(--bad)', fontSize: 'var(--fs-sm)', marginTop: 6 }}>{error}</p>}
        </div>

        <div>
          <label className="field-label" htmlFor="project-start">Start date</label>
          <input id="project-start" className="field" type="date" value={startDate} max="2999-12-31"
            onChange={(e) => setStartDate(e.target.value || todayStr())} />
        </div>

        <ProjectDeadlineField value={deadline} onChange={setDeadline} startDate={startDate} />
        <PriorityPicker value={priority} onChange={setPriority} />

        <div>
          <label className="field-label" htmlFor="project-milestones">
            Milestones <span className="muted" style={{ fontWeight: 500 }}>(optional — one per line)</span>
          </label>
          <textarea id="project-milestones" className="field" rows={3} value={milestones}
            placeholder={'Planning\nWireframes\nBuild\nLaunch'}
            onChange={(e) => setMilestones(e.target.value)} />
        </div>

        <MoreOptions open={more} onToggle={() => setMore((m) => !m)} id="project-more">
          <div>
            <label className="field-label" htmlFor="project-desc">Description</label>
            <textarea id="project-desc" className="field" rows={2} maxLength={600} value={description}
              onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div>
            <label className="field-label" htmlFor="project-cat">Category</label>
            <select id="project-cat" className="field" value={category} onChange={(e) => setCategory(e.target.value)}>
              {WORK_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label" htmlFor="project-est">Estimated total time (hours)</label>
            <input id="project-est" className="field" type="number" min="0" step="0.5" inputMode="decimal"
              value={estimateHrs} placeholder="e.g. 12"
              onChange={(e) => setEstimateHrs(e.target.value)} />
          </div>
          {habits.length > 0 && (
            <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
              <legend className="field-label">
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <IconLink size={13} /> Linked habits
                </span>
              </legend>
              <div className="wrap-gap">
                {habits.map((h) => (
                  <button key={h.id} type="button" className="btn sm" aria-pressed={linked.includes(h.id)}
                    style={{ borderRadius: 999, borderColor: linked.includes(h.id) ? 'var(--accent-1)' : undefined, background: linked.includes(h.id) ? 'var(--accent-soft)' : undefined }}
                    onClick={() => setLinked((l) => (l.includes(h.id) ? l.filter((x) => x !== h.id) : [...l, h.id]))}>
                    {h.name}
                  </button>
                ))}
              </div>
              <p className="tiny muted" style={{ marginTop: 8 }}>
                Links let project analytics sit next to habit consistency — they never claim one causes the other.
              </p>
            </fieldset>
          )}
          <div>
            <label className="field-label" htmlFor="project-notes">Notes</label>
            <textarea id="project-notes" className="field" rows={3} maxLength={4000} value={notes}
              onChange={(e) => setNotes(e.target.value)} />
          </div>
        </MoreOptions>

      </div>
    </Sheet>
  )
}

function parseMilestones(text) {
  return String(text || '')
    .split(/\r?\n|,/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 30)
}

/* ------------------------------------------------------------
   ASSIGNMENT FORM (§64, §65, §66)
   ------------------------------------------------------------ */
export function AssignmentForm({ open, onClose, editing, defaultProjectId = null }) {
  const { state, dispatch } = useStore()
  const projects = useMemo(() => (state.projects || []).filter((p) => !p.archived), [state.projects])
  const [name, setName] = useState('')
  const [subject, setSubject] = useState('')
  const [deadline, setDeadline] = useState(null)
  const [priority, setPriority] = useState('normal')
  const [progress, setProgress] = useState(0)
  const [subtasks, setSubtasks] = useState('')
  const [more, setMore] = useState(false)
  const [description, setDescription] = useState('')
  const [assignedDate, setAssignedDate] = useState(todayStr())
  const [estimateHrs, setEstimateHrs] = useState('')
  const [projectId, setProjectId] = useState(null)
  const [notes, setNotes] = useState('')
  const [useSubtasks, setUseSubtasks] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setError('')
    if (editing) {
      setName(editing.name || '')
      setSubject(editing.subject || '')
      setDeadline(editing.deadline || null)
      setPriority(editing.priority || 'normal')
      setProgress(Number(editing.progress) || 0)
      setSubtasks('')
      setDescription(editing.description || '')
      setAssignedDate(editing.assignedDate || todayStr())
      setEstimateHrs(editing.estimateMin ? String(Math.round(editing.estimateMin / 6) / 10) : '')
      setProjectId(editing.projectId || null)
      setNotes(editing.notes || '')
      setUseSubtasks(editing.progressMode === 'subtasks')
      setMore(!!(editing.description || editing.notes || editing.projectId))
    } else {
      setName(''); setSubject(''); setDeadline(null); setPriority('normal'); setProgress(0)
      setSubtasks(''); setDescription(''); setAssignedDate(todayStr()); setEstimateHrs('')
      setProjectId(defaultProjectId); setNotes(''); setUseSubtasks(false); setMore(false)
    }
  }, [open, editing, defaultProjectId])

  const parsedSubs = parseMilestones(subtasks)

  const save = () => {
    const trimmed = name.trim()
    if (!trimmed) { setError('Give the assignment a name.'); return }
    const estimateMin = estimateHrs ? Math.round(Number(estimateHrs) * 60) : null
    const base = {
      name: trimmed,
      subject: subject.trim(),
      deadline,
      priority,
      progress: useSubtasks && parsedSubs.length ? 0 : progress,
      progressMode: useSubtasks && (parsedSubs.length || (editing?.subtasks || []).length) ? 'subtasks' : 'explicit',
      description: description.trim(),
      assignedDate,
      estimateMin: Number.isFinite(estimateMin) && estimateMin > 0 ? estimateMin : null,
      projectId,
      notes: notes.trim(),
    }
    if (editing) {
      dispatch({ type: 'UPDATE_ASSIGNMENT', id: editing.id, patch: base })
      for (const s of parsedSubs) dispatch({ type: 'ADD_SUBTASK', id: editing.id, name: s })
    } else {
      const subs = parsedSubs.map((s, i) => ({ id: Math.random().toString(36).slice(2, 10), name: s, done: false, completedAt: null, order: i }))
      dispatch({ type: 'ADD_ASSIGNMENT', assignment: { ...base, subtasks: subs } })
    }
    onClose()
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={editing ? 'Edit assignment' : 'New assignment'}
      labelledBy="assignment-form-title"
      footer={
        <>
          <button className="btn ghost" type="button" onClick={onClose}>Cancel</button>
          <button className="btn primary" type="button" onClick={save} disabled={!name.trim()}>
            {editing ? 'Save changes' : 'Create assignment'}
          </button>
        </>
      }
    >
      <div className="stack" style={{ gap: 18 }}>
        <div>
          <label className="field-label" htmlFor="assignment-name">Assignment</label>
          <input id="assignment-name" className="field" autoFocus value={name} maxLength={90}
            placeholder="e.g. Submit DS assignment 3"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && name.trim() && deadline) save() }} />
          {error && <p style={{ color: 'var(--bad)', fontSize: 'var(--fs-sm)', marginTop: 6 }}>{error}</p>}
        </div>

        <div>
          <label className="field-label" htmlFor="assignment-subject">
            Subject <span className="muted" style={{ fontWeight: 500 }}>(optional)</span>
          </label>
          <input id="assignment-subject" className="field" value={subject} maxLength={60}
            placeholder="e.g. Data Structures" onChange={(e) => setSubject(e.target.value)} />
        </div>

        <AssignmentDeadlineField value={deadline} onChange={setDeadline} />
        <PriorityPicker value={priority} onChange={setPriority} />

        <QuickProgress
          value={useSubtasks ? undefined : progress}
          onChange={setProgress}
          label="Progress"
        />
        {useSubtasks && (
          <p className="tiny muted" style={{ marginTop: -8 }}>Progress is derived from subtasks while sync is on.</p>
        )}

        <div>
          <label className="field-label" htmlFor="assignment-subtasks">
            Subtasks <span className="muted" style={{ fontWeight: 500 }}>(optional — one per line)</span>
          </label>
          <textarea id="assignment-subtasks" className="field" rows={3} value={subtasks}
            placeholder={'Read the brief\nDraft outline\nFinal pass'}
            onChange={(e) => setSubtasks(e.target.value)} />
          {parsedSubs.length > 0 && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10, minHeight: 44, cursor: 'pointer' }}>
              <input type="checkbox" checked={useSubtasks} onChange={(e) => setUseSubtasks(e.target.checked)}
                style={{ width: 20, height: 20, accentColor: 'var(--accent-1)', flex: 'none' }} />
              <span className="tiny soft">Keep progress in sync with these {parsedSubs.length} subtasks</span>
            </label>
          )}
        </div>

        <MoreOptions open={more} onToggle={() => setMore((m) => !m)} id="assignment-more">
          <div>
            <label className="field-label" htmlFor="assignment-desc">Description</label>
            <textarea id="assignment-desc" className="field" rows={2} maxLength={600} value={description}
              onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div>
            <label className="field-label" htmlFor="assignment-assigned">Assigned on</label>
            <input id="assignment-assigned" className="field" type="date" value={assignedDate}
              onChange={(e) => setAssignedDate(e.target.value || todayStr())} />
          </div>
          <div>
            <label className="field-label" htmlFor="assignment-est">Estimated effort (hours)</label>
            <input id="assignment-est" className="field" type="number" min="0" step="0.5" inputMode="decimal"
              value={estimateHrs} placeholder="e.g. 3" onChange={(e) => setEstimateHrs(e.target.value)} />
          </div>
          {projects.length > 0 && (
            <div>
              <label className="field-label" htmlFor="assignment-project">
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <IconLink size={13} /> Belongs to a project
                </span>
              </label>
              <select id="assignment-project" className="field" value={projectId || ''} onChange={(e) => setProjectId(e.target.value || null)}>
                <option value="">Standalone assignment</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="field-label" htmlFor="assignment-notes">Notes</label>
            <textarea id="assignment-notes" className="field" rows={3} maxLength={4000} value={notes}
              onChange={(e) => setNotes(e.target.value)} />
          </div>
        </MoreOptions>

      </div>
    </Sheet>
  )
}
