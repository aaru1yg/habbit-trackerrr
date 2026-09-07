/* ============================================================
   QUICK CAPTURE — type it, confirm it, done.

   The whole point of this component is that NOTHING is created until
   the user presses Create. Parsing suggests; the preview states what
   will be stored, in plain words, including "Not specified" for
   anything the text did not contain.

   Flow:  input → confirm → done
   Ambiguous input asks. Unresolved input offers Save as note.
   ============================================================ */
import { useEffect, useMemo, useRef, useState } from 'react'
import Sheet from '../ui/Sheet.jsx'
import { useStore, newId } from '../../store.jsx'
import { useToast } from '../ui/Toaster.jsx'
import { navigate } from '../../lib/router.jsx'
import { setIntent, INTENTS } from '../../lib/intents.js'
import { shortDate, minutesLabel, dayStr } from '../../lib/dates.js'
import {
  parseCapture, validateCapture, detectDuplicate, captureToAction,
  CAPTURE_TYPES, CONFIDENCE,
} from '../../lib/quickCapture.js'
import { preferencesOf } from '../../lib/personalization.js'
import { IconCheck, IconAlert, IconLink } from '../../lib/icons.jsx'

const typeLabel = (id) => CAPTURE_TYPES.find((t) => t.id === id)?.label || id

const Row = ({ label, value, tone }) => (
  <div className="cap-row">
    <span className="cap-label">{label}</span>
    <span className="cap-value" data-tone={tone || undefined}>{value}</span>
  </div>
)

/**
 * The capture flow itself, without any chrome.
 *
 * `bare` is how the Command Center uses it: the palette owns the single
 * input (E1/E2 ask for exactly one field) and hands the text down, so the
 * read-out, the ambiguity question and the confirmation preview are the
 * same code in both places rather than two copies that can drift.
 */
export function CaptureBody({ text, setText, preset = null, bare = false, onClose, resetKey = null }) {
  const { state, dispatch } = useStore()
  const toast = useToast()
  const prefs = preferencesOf(state)
  const inputRef = useRef(null)

  const [phase, setPhase] = useState(bare ? 'input' : 'input')
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(null)
  const [errors, setErrors] = useState([])
  const [created, setCreated] = useState(null)
  const [linkChoice, setLinkChoice] = useState({ projectId: null, goalId: null, asked: false })

  /* Reset fully between captures — a stale draft would be a silent wrong
     answer. In bare mode the palette owns the text, so we do not clear it. */
  useEffect(() => {
    setPhase('input')
    setEditing(false)
    setDraft(null)
    setErrors([])
    setCreated(null)
    setLinkChoice({ projectId: null, goalId: null, asked: false })
  }, [resetKey])

  const parsed = useMemo(() => parseCapture(text, state, { now: new Date(), weekStartsOn: prefs.weekStartsOn }), [text, state, prefs.weekStartsOn])
  const duplicate = useMemo(() => (draft ? detectDuplicate(state, draft) : { possible: [], reason: null }), [state, draft])

  /** Move from typing to the confirmation preview. */
  const review = (typeOverride = null) => {
    const type = typeOverride || parsed.type || (preset?.type ?? null)
    if (!type) { setPhase('input'); return }
    const next = {
      type,
      title: parsed.title,
      deadline: parsed.date.date,
      estimateMin: parsed.duration.minutes,
      priority: 'normal',
      /* E8: a suggested link is never applied here. It starts unset and is
         only written when the user presses the suggestion. */
      projectId: linkChoice.projectId || null,
      milestoneId: null,
      goalId: linkChoice.goalId || null,
      note: '',
    }
    setDraft(next)
    setErrors([])
    setEditing(false)
    setPhase('confirm')
  }

  const patch = (p) => setDraft((d) => ({ ...d, ...p }))

  /** Needs a project or a goal that the text did not name. */
  const needsParent = draft?.type === 'project-task' && !draft?.projectId
  const needsGoal = draft?.type === 'goal-milestone' && !draft?.goalId
  const openProjects = (state.projects || []).filter((p) => !p.archived)
  const openGoals = (state.goals || []).filter((g) => !g.archived)

  const create = () => {
    if (!draft) return
    const v = validateCapture(draft)
    if (!v.ok) { setErrors(v.errors); setEditing(true); return }

    const id = newId()
    const existingNote = draft.type === 'note' ? (state.moods?.[dayStr(new Date())]?.note || null) : null
    const action = captureToAction(draft, { id, existingNote })
    if (!action) { setErrors([{ field: 'type', message: 'That type cannot be saved yet.' }]); return }

    dispatch(action)
    /* E9 — a real use of quick capture, recorded through the existing
       signal system. The type-specific signal (habit-add, work-add) is
       already appended by the reducer itself. */
    dispatch({ type: 'RECORD_SIGNAL', signal: 'capture', target: action.created.kind })

    setCreated(action.created)
    setPhase('done')
    toast.show(`Added “${action.created.name}”.`)
  }

  const saveAsNote = () => {
    if (!parsed.title) return
    const action = captureToAction({ type: 'note', title: parsed.title }, { id: null, existingNote: null })
    dispatch(action)
    dispatch({ type: 'RECORD_SIGNAL', signal: 'capture', target: 'note' })
    setCreated(action.created)
    setPhase('done')
    toast.show('Saved as a note.')
  }

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (phase === 'input') {
        if (parsed.confidence === CONFIDENCE.CONFIDENT) review()
        else if (parsed.confidence === CONFIDENCE.AMBIGUOUS && parsed.candidates.length) review(parsed.candidates[0])
      } else if (phase === 'confirm') create()
    }
  }

  const finish = () => { setPhase('input'); setText(''); onClose() }

  /* ---------- render ---------- */

  const unresolved = parsed.confidence === CONFIDENCE.UNRESOLVED
  const ambiguous = parsed.confidence === CONFIDENCE.AMBIGUOUS

  return (
      <div className="stack quick-capture" style={{ gap: 14 }}>

        {/* ---------------- INPUT ---------------- */}
        {phase === 'input' && (
          <>
            {!bare && (
              <div className="capture-field">
                <label htmlFor="capture-input" className="eyebrow">What do you need to do?</label>
                <input
                  id="capture-input"
                  ref={inputRef}
                  autoFocus
                  value={text}
                  placeholder="Finish DSA Chapter 4 by Friday"
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={onKeyDown}
                  aria-describedby="capture-hint"
                  autoComplete="off"
                />
                <p id="capture-hint" className="tiny muted">
                  Type it the way you would say it. Dates, durations and types are read from your
                  words — anything you do not write stays unset.
                </p>
              </div>
            )}

            {/* Live read-out: says only what deterministic parsing found. */}
            {text.trim() && (
              <div className="capture-live" aria-live="polite">
                <Row label="Title" value={parsed.title || '—'} />
                <Row
                  label="Type"
                  value={parsed.type
                    ? `${parsed.defaulted ? 'Suggested' : 'Detected'}: ${typeLabel(parsed.type)}`
                    : ambiguous ? 'Could be more than one thing' : 'Not recognised'}
                  tone={parsed.type ? undefined : 'warn'}
                />
                <Row label="Deadline" value={parsed.date.date ? `${parsed.date.label} · ${shortDate(parsed.date.date)}` : 'Not specified'} />
                <Row label="Estimated time" value={parsed.duration.minutes ? minutesLabel(parsed.duration.minutes) : 'Not specified'} />
                {parsed.reason ? <p className="capture-reason">{parsed.reason}</p> : null}
              </div>
            )}

            {/* E25 — could not classify */}
            {text.trim() && unresolved && (
              <div className="capture-ask" role="status">
                <p className="capture-ask-title"><IconAlert size={15} /> Couldn’t confidently classify this.</p>
                <p className="tiny muted">Nothing has been saved. Tell me what it is, or keep it as a note.</p>
                <div className="cap-choices" role="group" aria-label="How should I save this?">
                  {CAPTURE_TYPES.map((t) => (
                    <button key={t.id} type="button" className="chip" onClick={() => review(t.id)}>{t.label}</button>
                  ))}
                </div>
                <div className="btn-row">
                  <button type="button" className="btn" onClick={saveAsNote}>Save as note</button>
                  <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
                </div>
              </div>
            )}

            {/* E5 — ambiguous */}
            {text.trim() && ambiguous && !unresolved && (
              <div className="capture-ask" role="status">
                <p className="capture-ask-title">How should I save this?</p>
                <p className="tiny muted">{parsed.reason} I would rather ask than guess.</p>
                <div className="cap-choices" role="group" aria-label="How should I save this?">
                  {parsed.candidates.map((id) => (
                    <button key={id} type="button" className="chip" onClick={() => review(id)}>{typeLabel(id)}</button>
                  ))}
                </div>
                <div className="btn-row">
                  <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
                </div>
              </div>
            )}

            {text.trim() && parsed.confidence === CONFIDENCE.CONFIDENT && (
              <div className="btn-row">
                <button type="button" className="btn primary" onClick={() => review()}>Review</button>
                <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
              </div>
            )}
          </>
        )}

        {/* ---------------- CONFIRM ---------------- */}
        {phase === 'confirm' && draft && (
          <>
            <p className="tiny muted">You entered</p>
            <p className="capture-raw">“{text.trim()}”</p>
            <p className="eyebrow">Detected</p>

            <div className="capture-preview">
              <Row label="Type" value={typeLabel(draft.type)} />
              <Row label="Title" value={draft.title || '—'} tone={draft.title ? undefined : 'bad'} />
              <Row label="Deadline" value={draft.deadline ? shortDate(draft.deadline) : 'Not specified'} />
              <Row label="Estimated time" value={draft.estimateMin ? minutesLabel(draft.estimateMin) : 'Not specified'} />
              {draft.projectId ? <Row label="Project" value={(state.projects || []).find((p) => p.id === draft.projectId)?.name || '—'} /> : null}
              {draft.goalId ? <Row label="Goal" value={(state.goals || []).find((g) => g.id === draft.goalId)?.title || '—'} /> : null}
            </div>

            {/* E24 — warn, never block */}
            {duplicate.reason && (
              <p className="capture-warn" role="status"><IconAlert size={14} /> {duplicate.reason}</p>
            )}

            {/* E8 — a link is only made when the user confirms it */}
            {(parsed.links.projects.length > 0 || parsed.links.goals.length > 0) && !linkChoice.asked && (
              <div className="capture-ask">
                <p className="capture-ask-title"><IconLink size={14} /> Link it to something you already have?</p>
                <div className="cap-choices" role="group" aria-label="Link suggestion">
                  {parsed.links.projects.map((p) => (
                    <button key={p.id} type="button" className="chip"
                      onClick={() => { patch({ projectId: p.id }); setLinkChoice((c) => ({ ...c, projectId: p.id, asked: true })) }}>
                      Project: {p.name}
                    </button>
                  ))}
                  {parsed.links.goals.map((g) => (
                    <button key={g.id} type="button" className="chip"
                      onClick={() => { patch({ goalId: g.id }); setLinkChoice((c) => ({ ...c, goalId: g.id, asked: true })) }}>
                      Goal: {g.name}
                    </button>
                  ))}
                  <button type="button" className="chip" onClick={() => setLinkChoice((c) => ({ ...c, asked: true }))}>No link</button>
                </div>
              </div>
            )}

            {/* A parent the text did not name must be chosen, not assumed. */}
            {needsParent && (
              <div className="capture-ask">
                <p className="capture-ask-title">Which project does this task belong to?</p>
                {openProjects.length ? (
                  <div className="cap-choices" role="group" aria-label="Project">
                    {openProjects.map((p) => (
                      <button key={p.id} type="button" className="chip" onClick={() => patch({ projectId: p.id })}>{p.name}</button>
                    ))}
                  </div>
                ) : <p className="tiny muted">You have no open projects yet. Save it as an assignment instead, or create the project first.</p>}
              </div>
            )}
            {needsGoal && (
              <div className="capture-ask">
                <p className="capture-ask-title">Which goal is this a milestone of?</p>
                {openGoals.length ? (
                  <div className="cap-choices" role="group" aria-label="Goal">
                    {openGoals.map((g) => (
                      <button key={g.id} type="button" className="chip" onClick={() => patch({ goalId: g.id })}>{g.title}</button>
                    ))}
                  </div>
                ) : <p className="tiny muted">You have no open goals yet. Create the goal first.</p>}
              </div>
            )}

            {editing && (
              <div className="capture-edit">
                <label className="cap-field">
                  <span className="cap-label">Title</span>
                  <input value={draft.title} onChange={(e) => patch({ title: e.target.value })} />
                </label>
                <label className="cap-field">
                  <span className="cap-label">Deadline</span>
                  <input type="date" value={draft.deadline || ''} onChange={(e) => patch({ deadline: e.target.value || null })} />
                </label>
                <label className="cap-field">
                  <span className="cap-label">Estimate (minutes)</span>
                  <input
                    type="number" min="1" max="1440" inputMode="numeric"
                    value={draft.estimateMin ?? ''}
                    onChange={(e) => patch({ estimateMin: e.target.value === '' ? null : Number(e.target.value) })}
                  />
                </label>
                <label className="cap-field">
                  <span className="cap-label">Type</span>
                  <select value={draft.type} onChange={(e) => patch({ type: e.target.value })}>
                    {CAPTURE_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                  </select>
                </label>
              </div>
            )}

            {errors.length > 0 && (
              <div className="capture-errors" role="alert">
                {errors.map((e) => <p key={e.field}>{e.message}</p>)}
              </div>
            )}

            <div className="btn-row capture-actions">
              <button type="button" className="btn primary" onClick={create} disabled={needsParent || needsGoal}>
                <IconCheck size={15} /> Create
              </button>
              <button type="button" className="btn" onClick={() => setEditing((v) => !v)}>
                {editing ? 'Done editing' : 'Edit'}
              </button>
              <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
            </div>
            <p className="tiny muted">Nothing is saved until you press Create.</p>
          </>
        )}

        {/* ---------------- DONE ---------------- */}
        {phase === 'done' && created && (
          <>
            <p className="capture-done"><IconCheck size={18} /> Added.</p>
            <p className="capture-raw">“{created.name}” is now in your {created.kind.replace('-', ' ')} list.</p>
            <p className="tiny muted">
              Your priority engine ranks it against everything else you have open — nothing here
              overrides that.
            </p>
            <div className="btn-row">
              <button type="button" className="btn primary"
                onClick={() => { setIntent(INTENTS.PLAN_DAY); navigate('today'); finish() }}>
                Open Plan my day
              </button>
              {created.kind !== 'note' && created.kind !== 'habit' && (
                <button type="button" className="btn"
                  onClick={() => { setIntent(INTENTS.START_FOCUS); navigate('today'); finish() }}>
                  Start focusing on it
                </button>
              )}
              <button type="button" className="btn ghost" onClick={finish}>Done</button>
            </div>
            <button type="button" className="btn ghost sm" onClick={() => { setPhase('input'); setText(''); setCreated(null) }}>
              Capture something else
            </button>
          </>
        )}
      </div>
  )
}

/** Standalone sheet: used by the FAB and the Today quick action. */
export default function QuickCapture({ open, onClose, preset = null }) {
  const [text, setText] = useState('')
  useEffect(() => { if (open) setText(preset?.text || '') }, [open, preset])
  return (
    <Sheet open={open} onClose={onClose} title="Quick capture" labelledBy="capture-title">
      {open && <CaptureBody text={text} setText={setText} preset={preset} onClose={onClose} resetKey={open ? 'open' : 'closed'} />}
    </Sheet>
  )
}
