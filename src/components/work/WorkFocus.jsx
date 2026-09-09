import { lazy, Suspense } from 'react'
import { useStore } from '../../store.jsx'
import Sheet from '../ui/Sheet.jsx'
import { LoadingBlock } from '../ui/feedback.jsx'
const FocusMode = lazy(() => import('../today/FocusMode.jsx'))

export default function WorkFocus({ item, onClose }) {
  const { state, dispatch } = useStore()
  return <Sheet open onClose={onClose} title={`Focus · ${item.name}`} labelledBy="work-focus-title"><Suspense fallback={<LoadingBlock label="Loading focus" />}><FocusMode state={state} dispatch={dispatch} selectedItem={item} openTick={1} /></Suspense></Sheet>
}
