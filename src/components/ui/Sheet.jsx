import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { IconX } from '../../lib/icons.jsx'

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'

/**
 * Bottom sheet (mobile) / centered dialog (≥640px).
 * Accessible: role=dialog, focus trap, Escape to close, focus restored.
 */
export default function Sheet({ open, onClose, title, children, labelledBy }) {
  const panelRef = useRef(null)
  const restoreRef = useRef(null)
  const reduced = useReducedMotion()

  useEffect(() => {
    if (!open) return
    restoreRef.current = document.activeElement
    const panel = panelRef.current
    const focusables = () => Array.from(panel?.querySelectorAll(FOCUSABLE) || [])
    // focus first sensible element (after close button)
    const focusList = focusables()
    const target = focusList[1] || focusList[0]
    target?.focus()

    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
        return
      }
      if (e.key !== 'Tab') return
      const list = focusables().filter((el) => el.offsetParent !== null)
      if (!list.length) return
      const first = list[0]
      const last = list[list.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
      restoreRef.current?.focus?.()
    }
  }, [open, onClose])

  const isDesktop = typeof window !== 'undefined' && window.matchMedia('(min-width: 640px)').matches
  const variants = reduced
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : isDesktop
      ? { initial: { opacity: 0, scale: 0.95, y: 12 }, animate: { opacity: 1, scale: 1, y: 0 }, exit: { opacity: 0, scale: 0.96, y: 8 } }
      : { initial: { y: '100%', opacity: 0.6 }, animate: { y: 0, opacity: 1 }, exit: { y: '100%', opacity: 0.4 } }

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduced ? 0 : 0.2 }}
            onClick={onClose}
          />
          <motion.div
            ref={panelRef}
            className="sheet sheet-panel"
            role="dialog"
            aria-modal="true"
            aria-label={title}
            aria-labelledby={labelledBy}
            {...variants}
            transition={{ type: 'spring', damping: 34, stiffness: 380 }}
          >
            <div className="sheet-grab" aria-hidden="true" />
            <div className="sheet-head">
              <h3 id={labelledBy} className="sheet-title">{title}</h3>
              <button className="btn ghost icon" onClick={onClose} aria-label="Close">
                <IconX />
              </button>
            </div>
            <div className="sheet-body">{children}</div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  )
}
