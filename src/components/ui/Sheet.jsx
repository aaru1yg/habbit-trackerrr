import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { IconX } from '../../lib/icons.jsx'

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'

/* Authoritative "a sheet is open" flag — set on open, cleared on close,
   even while the exit animation is still running. Global shortcuts read it. */
let openSheets = 0
function markSheet(open) {
  openSheets = Math.max(0, openSheets + (open ? 1 : -1))
  if (typeof document !== 'undefined') {
    if (openSheets > 0) document.documentElement.setAttribute('data-sheet-open', 'true')
    else document.documentElement.removeAttribute('data-sheet-open')
  }
}
export const isSheetOpen = () => openSheets > 0

/* Track the true visible viewport height (visualViewport shrinks when the
   on-screen keyboard opens; innerHeight often does not). Published as a CSS
   variable so the panel can size itself against reality rather than 100vh. */
function useViewportSync(active) {
  useEffect(() => {
    if (!active || typeof window === 'undefined') return
    const vv = window.visualViewport
    const root = document.documentElement
    const apply = () => {
      const h = vv?.height ?? window.innerHeight
      root.style.setProperty('--sheet-vh', `${Math.round(h)}px`)
      // How far the keyboard/browser UI intrudes from the bottom of the layout
      // viewport — the panel adds this as bottom offset so it stays above it.
      const inset = vv ? Math.max(0, window.innerHeight - vv.height - vv.offsetTop) : 0
      root.style.setProperty('--sheet-kb', `${Math.round(inset)}px`)
    }
    apply()
    vv?.addEventListener('resize', apply)
    vv?.addEventListener('scroll', apply)
    window.addEventListener('resize', apply)
    window.addEventListener('orientationchange', apply)
    return () => {
      vv?.removeEventListener('resize', apply)
      vv?.removeEventListener('scroll', apply)
      window.removeEventListener('resize', apply)
      window.removeEventListener('orientationchange', apply)
      root.style.removeProperty('--sheet-vh')
      root.style.removeProperty('--sheet-kb')
    }
  }, [active])
}

/**
 * Bottom sheet (mobile) / centered dialog (≥640px).
 *
 * Layout contract: header and `footer` are fixed rails, only `children` (the
 * .sheet-body) scrolls. The panel is capped to the *visible* viewport, so the
 * footer — and therefore the primary action — can never be pushed off-screen.
 *
 * Accessible: role=dialog, focus trap, Escape to close, focus restored.
 */
export default function Sheet({ open, onClose, title, children, labelledBy, footer }) {
  const panelRef = useRef(null)
  const bodyRef = useRef(null)
  const restoreRef = useRef(null)
  const reduced = useReducedMotion()

  useViewportSync(open)

  /* Keep the focused field visible when the keyboard opens over it. */
  useEffect(() => {
    if (!open) return
    const body = bodyRef.current
    if (!body) return
    const onFocusIn = (e) => {
      const el = e.target
      if (!(el instanceof HTMLElement) || !body.contains(el)) return
      // Wait for the keyboard animation / viewport resize to settle.
      setTimeout(() => {
        try {
          el.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
        } catch {
          el.scrollIntoView(false)
        }
      }, 250)
    }
    body.addEventListener('focusin', onFocusIn)
    return () => body.removeEventListener('focusin', onFocusIn)
  }, [open])

  useEffect(() => {
    if (!open) return
    markSheet(true)
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
      markSheet(false)
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
            <div className="sheet-body" ref={bodyRef}>{children}</div>
            {footer && <div className="sheet-footer">{footer}</div>}
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  )
}
