/* ============================================================
   UNIVERSAL ITEM ACTIONS — Phase F (#22).

   One consistent action set per entity, driven entirely by
   itemActions() so no surface invents its own state logic. Destructive
   actions are confirmed here and come back with the undo the reducer
   already supports.

   Lazy-loaded: itemActions lives in commandActions.js, which is
   otherwise reachable only from the Command Center. Importing it from
   an eager screen would pull the whole registry into the initial
   bundle, and there is ~3 kB of headroom.
   ============================================================ */
import { useMemo, useState } from 'react'
import Sheet from './Sheet.jsx'
import { useStore } from '../../store.jsx'
import { useToast } from './Toaster.jsx'
import { itemActions, resolveItem } from '../../lib/commandActions.js'
import { navigate } from '../../lib/router.jsx'
import { IconChevronRight } from '../../lib/icons.jsx'

export default function ItemActionsSheet({ open, onClose, kind, id }) {
  const { state, dispatch } = useStore()
  const toast = useToast()
  const [confirming, setConfirming] = useState(null)

  const resolved = useMemo(() => (kind && id ? resolveItem(state, kind, id) : null), [state, kind, id])
  const actions = useMemo(() => (resolved ? itemActions(resolved.kind, resolved.entity) : []), [resolved])

  const perform = (action) => {
    if (action.destructive && confirming !== action.id) { setConfirming(action.id); return }
    setConfirming(null)
    onClose()

    if (action.href) return navigate(action.href)
    if (action.dispatch) {
      dispatch(action.dispatch)
      if (action.undo) {
        toast.show(`${action.label.toLowerCase()} “${resolved.entity.name || resolved.entity.title}”`, {
          duration: 6000,
          actionLabel: 'Undo',
          onAction: () => dispatch(action.undo),
        })
      }
      return
    }
    // form / focus / link / reschedule all belong to a screen that owns
    // that flow; the honest move is to take the user there.
    if (action.focus || action.link || action.reschedule || action.form) return navigate(hrefOf(resolved))
    return null
  }

  const hrefOf = (r) => {
    if (!r) return 'today'
    if (r.kind === 'assignment') return `assignments/${r.entity.id}`
    if (r.kind === 'project') return `projects/${r.entity.id}`
    if (r.kind === 'goal') return `goals/${r.entity.id}`
    if (r.kind === 'habit') return 'library'
    return 'today'
  }

  const name = resolved?.entity?.name || resolved?.entity?.title || 'This item'

  return (
    <Sheet open={open} onClose={() => { setConfirming(null); onClose() }} title={name} labelledBy="item-actions-title">
      {!resolved ? (
        <p className="empty-note">That item is no longer here.</p>
      ) : (
        <div className="stack" style={{ gap: 10 }}>
          <p className="tiny muted">{resolved.kind.replace('-', ' ')}</p>
          <div className="item-actions" role="group" aria-label={`Actions for ${name}`}>
            {actions.map((a) => (
              <button
                key={a.id}
                type="button"
                className={`btn item-action${a.destructive ? ' danger' : ''}`}
                disabled={a.disabled}
                aria-describedby={confirming === a.id ? `${a.id}-confirm` : undefined}
                onClick={() => perform(a)}
              >
                <span>{confirming === a.id ? `Confirm ${a.label.toLowerCase()}` : a.label}</span>
                <IconChevronRight size={15} />
              </button>
            ))}
          </div>
          {confirming && (
            <p id={`${confirming}-confirm`} className="capture-warn" role="alert">
              This cannot be undone from here{actions.find((a) => a.id === confirming)?.undo ? ' — but an Undo will be offered right after.' : '.'}
            </p>
          )}
        </div>
      )}
    </Sheet>
  )
}
