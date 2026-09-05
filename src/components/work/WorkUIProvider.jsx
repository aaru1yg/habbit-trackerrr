/* ============================================================
   WORK UI PROVIDER — one place that owns project/assignment
   creation, editing, deletion (with undo), progress updates and
   completion celebrations, so every screen behaves identically.

   Celebration policy (§27, §77): projects get the full moment at
   100%; assignments get a quiet confirmation. Ticking one task
   never fires confetti.
   ============================================================ */
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { useStore } from '../../store.jsx'
import { useToast } from '../ui/Toaster.jsx'
import Confetti from '../ui/Confetti.jsx'
import { ProjectForm, AssignmentForm } from './WorkForms.jsx'
import { projectProgress, assignmentProgress } from '../../lib/work.js'
import { IconCheck, IconSparkle } from '../../lib/icons.jsx'

const WorkUIContext = createContext(null)
export const useWorkUI = () => useContext(WorkUIContext)

export default function WorkUIProvider({ children }) {
  const { state, dispatch } = useStore()
  const toast = useToast()
  const reduced = useReducedMotion()

  const [projectForm, setProjectForm] = useState({ open: false, editing: null })
  const [assignmentForm, setAssignmentForm] = useState({ open: false, editing: null, projectId: null })
  const [celebration, setCelebration] = useState(null)
  const [fire, setFire] = useState(0)

  /* ---------- open / close forms ---------- */
  const newProject = useCallback(() => setProjectForm({ open: true, editing: null }), [])
  const editProject = useCallback((project) => setProjectForm({ open: true, editing: project }), [])
  const closeProjectForm = useCallback(() => setProjectForm({ open: false, editing: null }), [])

  const newAssignment = useCallback((projectId = null) => setAssignmentForm({ open: true, editing: null, projectId }), [])
  const editAssignment = useCallback((assignment) => setAssignmentForm({ open: true, editing: assignment, projectId: assignment.projectId || null }), [])
  const closeAssignmentForm = useCallback(() => setAssignmentForm({ open: false, editing: null, projectId: null }), [])

  /* ---------- celebration ---------- */
  const celebrateProject = useCallback((project) => {
    if (reduced) {
      toast.show(`“${project.name}” is complete. Well done.`)
      return
    }
    setCelebration(project)
    setFire((f) => f + 1)
  }, [reduced, toast])

  const celebrateAssignment = useCallback((assignment) => {
    toast.show(`“${assignment.name}” is at 100%.`, { actionLabel: 'Open', onAction: () => { window.location.hash = `#/assignments/${assignment.id}` } })
  }, [toast])

  /* ---------- delete with undo ---------- */
  const deleteProject = useCallback((project) => {
    dispatch({ type: 'DELETE_PROJECT', id: project.id })
    toast.show(`Deleted “${project.name}”`, {
      duration: 6000,
      actionLabel: 'Undo',
      onAction: () => dispatch({ type: 'RESTORE_PROJECT', project }),
    })
  }, [dispatch, toast])

  const deleteAssignment = useCallback((assignment) => {
    dispatch({ type: 'DELETE_ASSIGNMENT', id: assignment.id })
    toast.show(`Deleted “${assignment.name}”`, {
      duration: 6000,
      actionLabel: 'Undo',
      onAction: () => dispatch({ type: 'RESTORE_ASSIGNMENT', assignment }),
    })
  }, [dispatch, toast])

  /* ---------- progress ----------
     Celebrations are NOT fired from these handlers. They are derived from
     real state transitions in the effect below, so rapid taps, bulk edits,
     undo and imports all behave identically — and a stale prop can never
     swallow (or double-fire) the moment. */
  const setAssignmentProgress = useCallback((assignment, pct) => {
    dispatch({ type: 'SET_ASSIGNMENT_PROGRESS', id: assignment.id, pct })
  }, [dispatch])

  const toggleSubtask = useCallback((assignment, subtask) => {
    dispatch({ type: 'TOGGLE_SUBTASK', id: assignment.id, subtaskId: subtask.id })
  }, [dispatch])

  const toggleTask = useCallback((project, milestone, task) => {
    dispatch({ type: 'TOGGLE_TASK', projectId: project.id, milestoneId: milestone.id, taskId: task.id })
  }, [dispatch])

  const setProjectPercent = useCallback((project, pct) => {
    dispatch({
      type: 'UPDATE_PROJECT',
      id: project.id,
      patch: { manualPercent: pct, completedAt: pct >= 100 ? (project.completedAt || new Date().toISOString()) : null },
    })
  }, [dispatch])

  /* ---------- completion detection (§27, §77, §84) ---------- */
  const prevPct = useRef({ projects: {}, assignments: {} })
  useEffect(() => {
    const seen = prevPct.current
    const nextProjects = {}
    for (const pr of state.projects || []) {
      const pct = projectProgress(pr).pct
      const before = seen.projects[pr.id]
      nextProjects[pr.id] = pct
      // `before == null` means "first time we saw it" — never celebrate on load
      if (before != null && before < 100 && pct >= 100) celebrateProject(pr)
    }
    const nextAssignments = {}
    for (const a of state.assignments || []) {
      const pct = assignmentProgress(a).pct
      const before = seen.assignments[a.id]
      nextAssignments[a.id] = pct
      if (before != null && before < 100 && pct >= 100) celebrateAssignment(a)
    }
    seen.projects = nextProjects
    seen.assignments = nextAssignments
  }, [state.projects, state.assignments, celebrateProject, celebrateAssignment])

  const value = {
    newProject, editProject, closeProjectForm, projectFormOpen: projectForm.open,
    newAssignment, editAssignment, closeAssignmentForm, assignmentFormOpen: assignmentForm.open,
    deleteProject, deleteAssignment,
    setAssignmentProgress, toggleSubtask, toggleTask, setProjectPercent,
    celebrateProject,
  }

  return (
    <WorkUIContext.Provider value={value}>
      {children}

      <ProjectForm open={projectForm.open} onClose={closeProjectForm} editing={projectForm.editing} />
      <AssignmentForm
        open={assignmentForm.open}
        onClose={closeAssignmentForm}
        editing={assignmentForm.editing}
        defaultProjectId={assignmentForm.projectId}
      />

      <Confetti fire={fire} count={110} origin={{ x: 0.5, y: 0.42 }} />

      {celebration && (
        <motion.div
            className="scrim"
            style={{ zIndex: 88, display: 'grid', placeItems: 'center', padding: 24 }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setCelebration(null)}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Project complete"
              initial={{ scale: 0.92, y: 18 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.96, opacity: 0 }}
              transition={{ type: 'spring', damping: 24, stiffness: 300 }}
              className="card pad-lg"
              style={{ maxWidth: 400, textAlign: 'center', background: 'var(--surface-solid)', pointerEvents: 'auto' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'grid', placeItems: 'center', gap: 14 }}>
                <span style={{
                  width: 68, height: 68, borderRadius: 999, display: 'grid', placeItems: 'center', color: '#fff',
                  background: 'linear-gradient(135deg, var(--accent-1), var(--accent-2))',
                  boxShadow: '0 14px 44px var(--accent-soft)',
                }}>
                  <IconCheck size={32} />
                </span>
                <div>
                  <p className="eyebrow">Project complete</p>
                  <h2 style={{ fontSize: '1.4rem', fontFamily: 'var(--font-display)', marginTop: 4 }}>{celebration.name}</h2>
                </div>
                <p style={{ color: 'var(--text-2)', fontSize: 'var(--fs-sm)', lineHeight: 1.55 }}>
                  Every task is checked and the work is done. That took real effort over real days.
                </p>
                <button className="btn primary" style={{ minWidth: 150 }} onClick={() => setCelebration(null)} autoFocus>
                  <IconSparkle size={16} /> Close it out
                </button>
              </div>
            </motion.div>
        </motion.div>
      )}
    </WorkUIContext.Provider>
  )
}

/** Convenience: the project/assignment an id points at. */
export function useWorkItem(kind, id) {
  const { state } = useStore()
  if (!id) return null
  return kind === 'project'
    ? (state.projects || []).find((p) => p.id === id) || null
    : (state.assignments || []).find((a) => a.id === id) || null
}
