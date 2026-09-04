import { createContext, useCallback, useContext, useState } from 'react'
import { useStore } from '../../store.jsx'
import { useToast } from '../ui/Toaster.jsx'
import HabitForm from './HabitForm.jsx'
import HabitDetailSheet from './HabitDetailSheet.jsx'

/* Shared habit management: add/edit form, detail sheet, archive + delete-with-undo. */
const HabitUIContext = createContext(null)
export const useHabitUI = () => useContext(HabitUIContext)

export default function HabitUIProvider({ children, onFire }) {
  const { state, dispatch } = useStore()
  const toast = useToast()
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [detailId, setDetailId] = useState(null)

  const detailHabit = state.habits.find((h) => h.id === detailId) || null

  const openAdd = useCallback(() => { setEditing(null); setFormOpen(true) }, [])
  const openEdit = useCallback((habit) => { setEditing(habit); setFormOpen(true) }, [])
  const openDetail = useCallback((habit) => setDetailId(habit.id), [])

  const archive = useCallback((habit) => {
    const next = !habit.archived
    dispatch({ type: 'UPDATE_HABIT', id: habit.id, patch: { archived: next } })
    toast.show(next ? `${habit.name} archived` : `${habit.name} restored`, {
      actionLabel: 'Undo',
      onAction: () => dispatch({ type: 'UPDATE_HABIT', id: habit.id, patch: { archived: !next } }),
    })
    setDetailId(null)
  }, [dispatch, toast])

  const remove = useCallback((habit) => {
    const checkins = state.checkins[habit.id] || {}
    dispatch({ type: 'DELETE_HABIT', id: habit.id })
    setDetailId(null)
    toast.show(`Deleted “${habit.name}”`, {
      duration: 6000,
      actionLabel: 'Undo',
      onAction: () => dispatch({ type: 'RESTORE_HABIT', habit, checkins }),
    })
  }, [dispatch, state.checkins, toast])

  return (
    <HabitUIContext.Provider value={{ openAdd, openEdit, openDetail, archive, remove }}>
      {children}
      <HabitForm open={formOpen} onClose={() => setFormOpen(false)} editing={editing} />
      <HabitDetailSheet
        habit={detailHabit}
        open={!!detailHabit}
        onClose={() => setDetailId(null)}
        onEdit={(h) => { setDetailId(null); openEdit(h) }}
        onArchive={archive}
        onDelete={remove}
      />
    </HabitUIContext.Provider>
  )
}
