import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { useStore } from '../store.jsx'
import { useToast } from '../components/ui/Toaster.jsx'
import Sheet from '../components/ui/Sheet.jsx'
import SectionCard, { CardHead } from '../components/ui/SectionCard.jsx'
import EmptyState from '../components/ui/EmptyState.jsx'
import Confetti from '../components/ui/Confetti.jsx'
import AnimatedNumber from '../components/ui/AnimatedNumber.jsx'
import { projectProgress } from '../lib/stats.js'
import { IconGoals, IconPlus, IconCheck, IconTrash, IconX, IconChevronDown, IconSparkle } from '../lib/icons.jsx'

export default function GoalsScreen() {
  const { state, dispatch } = useStore()
  const toast = useToast()
  const [addOpen, setAddOpen] = useState(false)
  const [celebrate, setCelebrate] = useState(null)
  const [fire, setFire] = useState(0)
  const reduced = useReducedMotion()
  const prevProgress = useRef({})

  const projects = state.projects || []
  const active = projects.filter((p) => !p.completedAt)
  const completed = projects.filter((p) => p.completedAt)

  // Detect 0→100% transitions for the celebration moment.
  useEffect(() => {
    for (const p of projects) {
      const pct = projectProgress(p)
      const before = prevProgress.current[p.id]
      prevProgress.current[p.id] = pct
      if (before != null && before < 100 && pct >= 100) {
        if (reduced) {
          toast.show(`“${p.name}” is complete. Well done.`)
        } else {
          setCelebrate(p)
          setFire((f) => f + 1)
        }
      }
    }
  }, [projects, reduced, toast])

  const removeProject = (p) => {
    dispatch({ type: 'DELETE_PROJECT', id: p.id })
    toast.show(`Deleted “${p.name}”`, {
      duration: 6000,
      actionLabel: 'Undo',
      onAction: () => dispatch({ type: 'RESTORE_PROJECT', project: p }),
    })
  }

  return (
    <div className="screen" id="goals-screen">
      <header className="screen-head">
        <div>
          <h1 className="screen-title">Goals</h1>
          <p className="screen-sub">Break big things into milestones and tasks.</p>
        </div>
        <button className="btn primary" onClick={() => setAddOpen(true)}>
          <IconPlus size={16} /> New goal
        </button>
      </header>

      {projects.length === 0 ? (
        <SectionCard>
          <EmptyState
            art="art/empty-hero.webp"
            icon={<IconGoals size={40} />}
            title="No goals yet"
          >
            Habits are about repetition. Goals are about finishing — add something you want done, not repeated.
          </EmptyState>
        </SectionCard>
      ) : (
        <div className="stack">
          {active.map((p) => (
            <ProjectCard key={p.id} project={p} onRemove={removeProject} />
          ))}
          {completed.length > 0 && (
            <>
              <p className="eyebrow" style={{ marginTop: 8 }}>Completed</p>
              {completed.map((p) => (
                <ProjectCard key={p.id} project={p} onRemove={removeProject} collapsedByDefault />
              ))}
            </>
          )}
        </div>
      )}

      <NewGoalSheet open={addOpen} onClose={() => setAddOpen(false)} />

      {/* celebration overlay */}
      <Confetti fire={fire} origin={{ x: 0.5, y: 0.55 }} />
      <AnimatePresence>
        {celebrate && (
          <motion.div
            className="scrim"
            style={{ zIndex: 88, display: 'grid', placeItems: 'center', padding: 24 }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setCelebrate(null)}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Goal complete"
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: 'spring', damping: 22, stiffness: 300 }}
              className="card pad-lg"
              style={{ maxWidth: 380, textAlign: 'center', background: 'var(--surface-solid)', pointerEvents: 'auto' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'grid', placeItems: 'center', gap: 12 }}>
                <span style={{ width: 64, height: 64, borderRadius: 999, background: 'linear-gradient(135deg, var(--accent-1), var(--accent-2))', display: 'grid', placeItems: 'center', color: '#fff', boxShadow: '0 12px 40px var(--accent-soft)' }}>
                  <IconCheck size={30} />
                </span>
                <h2 style={{ fontSize: '1.4rem', fontFamily: 'var(--font-display)' }}>Goal complete</h2>
                <p style={{ color: 'var(--text-2)', fontSize: 'var(--fs-sm)' }}>
                  “{celebrate.name}” is finished — every task checked. That took real work.
                </p>
                <button className="btn primary" style={{ minWidth: 140 }} onClick={() => setCelebrate(null)} autoFocus>
                  <IconSparkle size={16} /> Nice
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function ProjectCard({ project, onRemove, collapsedByDefault = false }) {
  const { dispatch } = useStore()
  const [open, setOpen] = useState(!collapsedByDefault)
  const [newTask, setNewTask] = useState({})
  const [newMilestone, setNewMilestone] = useState('')
  const [addMsOpen, setAddMsOpen] = useState(false)
  const pct = projectProgress(project)
  const isLegacy = project.legacyPercent != null && !project.milestones.length

  return (
    <SectionCard className="pad">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          className="btn ghost icon"
          aria-expanded={open}
          aria-label={`${open ? 'Collapse' : 'Expand'} ${project.name}`}
          onClick={() => setOpen((o) => !o)}
        >
          <motion.span animate={{ rotate: open ? 0 : -90 }} style={{ display: 'grid' }}>
            <IconChevronDown size={18} />
          </motion.span>
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'var(--fs-h2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {project.name}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
            <div style={{ flex: 1, height: 6, borderRadius: 999, background: 'var(--track)', overflow: 'hidden' }}>
              <motion.div
                initial={false}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                style={{ height: '100%', borderRadius: 999, background: 'linear-gradient(90deg, var(--accent-1), var(--accent-2))' }}
              />
            </div>
            <span className="tnum" style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: pct === 100 ? 'var(--good)' : 'var(--text-2)' }}>
              <AnimatedNumber value={pct} />%
            </span>
          </div>
        </div>
        <button className="btn ghost icon" style={{ color: 'var(--bad)' }} aria-label={`Delete ${project.name}`} onClick={() => onRemove(project)}>
          <IconTrash size={17} />
        </button>
      </div>

      {open && (
        <div className="stack" style={{ gap: 14, marginTop: 16 }}>
          {isLegacy && (
            <p className="chip tag-warn" style={{ whiteSpace: 'normal' }}>
              Carried over from an earlier version at {pct}%. Add milestones below to keep building on it.
            </p>
          )}
          {project.milestones.length === 0 && !isLegacy && (
            <p style={{ color: 'var(--text-3)', fontSize: 'var(--fs-sm)' }}>No milestones yet — break this goal into 2–4 chunks.</p>
          )}
          {project.milestones.map((m) => {
            const doneCount = m.tasks.filter((t) => t.done).length
            const allDone = m.tasks.length > 0 && doneCount === m.tasks.length
            return (
              <div key={m.id} style={{ borderRadius: 14, border: '1px solid var(--border)', background: 'var(--surface-2)', padding: '10px 12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span
                    aria-hidden="true"
                    style={{
                      width: 20, height: 20, borderRadius: 7, flex: 'none', display: 'grid', placeItems: 'center',
                      background: allDone ? 'var(--good)' : 'var(--track)', color: '#07130c',
                    }}
                  >
                    {allDone && <IconCheck size={12} />}
                  </span>
                  <span style={{ flex: 1, fontWeight: 700, fontSize: 'var(--fs-sm)', textDecoration: allDone ? 'line-through' : 'none', color: allDone ? 'var(--text-2)' : 'var(--text)' }}>{m.name}</span>
                  <span className="tnum" style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-3)' }}>{doneCount}/{m.tasks.length}</span>
                  <button
                    className="btn ghost icon"
                    style={{ width: 32, height: 32, minHeight: 32 }}
                    aria-label={`Delete milestone ${m.name}`}
                    onClick={() => dispatch({ type: 'DELETE_MILESTONE', projectId: project.id, milestoneId: m.id })}
                  >
                    <IconX size={14} />
                  </button>
                </div>
                <div className="stack" style={{ gap: 4, marginTop: 8, paddingLeft: 28 }}>
                  {m.tasks.map((t) => (
                    <label key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 40, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={t.done}
                        onChange={() => dispatch({ type: 'TOGGLE_TASK', projectId: project.id, milestoneId: m.id, taskId: t.id })}
                        style={{ width: 20, height: 20, accentColor: 'var(--accent-1)', flex: 'none' }}
                      />
                      <span style={{ fontSize: 'var(--fs-sm)', textDecoration: t.done ? 'line-through' : 'none', color: t.done ? 'var(--text-3)' : 'var(--text-2)' }}>
                        {t.name}
                      </span>
                    </label>
                  ))}
                  <form
                    style={{ display: 'flex', gap: 8, marginTop: 4 }}
                    onSubmit={(e) => {
                      e.preventDefault()
                      const name = (newTask[m.id] || '').trim()
                      if (!name) return
                      dispatch({ type: 'ADD_TASK', projectId: project.id, milestoneId: m.id, name })
                      setNewTask((s) => ({ ...s, [m.id]: '' }))
                    }}
                  >
                    <input
                      className="field"
                      style={{ minHeight: 38 }}
                      placeholder="Add a task…"
                      aria-label={`Add task to ${m.name}`}
                      value={newTask[m.id] || ''}
                      onChange={(e) => setNewTask((s) => ({ ...s, [m.id]: e.target.value }))}
                    />
                    <button className="btn icon" type="submit" aria-label={`Add task to ${m.name}`}><IconPlus size={16} /></button>
                  </form>
                </div>
              </div>
            )
          })}

          {addMsOpen ? (
            <form
              style={{ display: 'flex', gap: 8 }}
              onSubmit={(e) => {
                e.preventDefault()
                const name = newMilestone.trim()
                if (!name) return
                dispatch({ type: 'ADD_MILESTONE', projectId: project.id, name })
                setNewMilestone('')
                setAddMsOpen(false)
              }}
            >
              <input
                className="field"
                autoFocus
                placeholder="New milestone name…"
                aria-label="New milestone name"
                value={newMilestone}
                onChange={(e) => setNewMilestone(e.target.value)}
                onKeyDown={(e) => e.key === 'Escape' && setAddMsOpen(false)}
              />
              <button className="btn" type="submit">Add</button>
              <button className="btn ghost" type="button" onClick={() => setAddMsOpen(false)}>Cancel</button>
            </form>
          ) : (
            <button className="btn ghost" style={{ alignSelf: 'flex-start' }} onClick={() => setAddMsOpen(true)}>
              <IconPlus size={15} /> Add milestone
            </button>
          )}
        </div>
      )}
    </SectionCard>
  )
}

function NewGoalSheet({ open, onClose }) {
  const { dispatch } = useStore()
  const [name, setName] = useState('')
  const [milestone, setMilestone] = useState('')

  useEffect(() => {
    if (open) { setName(''); setMilestone('') }
  }, [open])

  const create = () => {
    const n = name.trim()
    if (!n) return
    dispatch({
      type: 'ADD_PROJECT',
      project: { name: n, milestones: milestone.trim() ? [{ id: Math.random().toString(36).slice(2), name: milestone.trim(), tasks: [] }] : [] },
    })
    onClose()
  }

  return (
    <Sheet open={open} onClose={onClose} title="New goal" labelledBy="goal-title">
      <div className="stack" style={{ gap: 16 }}>
        <div>
          <label className="field-label" htmlFor="goal-name">Goal</label>
          <input id="goal-name" className="field" autoFocus value={name} maxLength={80}
            placeholder="e.g. Launch portfolio site"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && create()} />
        </div>
        <div>
          <label className="field-label" htmlFor="goal-milestone">First milestone <span style={{ color: 'var(--text-3)', fontWeight: 500 }}>(optional)</span></label>
          <input id="goal-milestone" className="field" value={milestone} maxLength={80}
            placeholder="e.g. Pick 3 projects to show"
            onChange={(e) => setMilestone(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && create()} />
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn primary" onClick={create} disabled={!name.trim()}>Create goal</button>
        </div>
      </div>
    </Sheet>
  )
}
