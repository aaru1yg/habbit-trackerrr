/* ============================================================
   OVERLAYS — Tooltip / Popover (V5).

   Small, dependency-free companions to Sheet (which owns dialogs).
   Tooltip: hover/focus label. Popover: Esc/outside-close panel with
   focus return. Both respect reduced motion (CSS) and the z scale.
   ============================================================ */
import { useCallback, useEffect, useId, useRef, useState } from 'react'

export function Tooltip({ label, children, position = 'top' }) {
  const [open, setOpen] = useState(false)
  const id = useId().replace(/:/g, '')
  return (
    <span
      className="vtip-anchor"
      onPointerEnter={() => setOpen(true)}
      onPointerLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false) }}
    >
      <span aria-describedby={open ? `vtip-${id}` : undefined}>{children}</span>
      {open && (
        <span id={`vtip-${id}`} role="tooltip" className="vtip" data-pos={position}>
          {label}
        </span>
      )}
    </span>
  )
}

export function Popover({ label, trigger, children, align = 'end', onOpenChange }) {
  const [open, setOpen] = useState(false)
  const anchorRef = useRef(null)
  const panelRef = useRef(null)
  const id = useId().replace(/:/g, '')

  const set = useCallback((v) => {
    setOpen(v)
    onOpenChange?.(v)
  }, [onOpenChange])

  useEffect(() => {
    if (!open) return undefined
    const onDoc = (e) => {
      if (anchorRef.current?.contains(e.target)) return
      set(false)
    }
    const onKey = (e) => {
      if (e.key === 'Escape') {
        set(false)
        anchorRef.current?.querySelector('button')?.focus()
      }
    }
    document.addEventListener('pointerdown', onDoc)
    document.addEventListener('keydown', onKey)
    panelRef.current?.querySelector('button, a[href], input')?.focus()
    return () => {
      document.removeEventListener('pointerdown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, set])

  return (
    <span className="vpop-anchor" ref={anchorRef}>
      <span onClick={() => set(!open)} aria-expanded={open} aria-haspopup="dialog">
        {trigger}
      </span>
      {open && (
        <span
          id={`vpop-${id}`}
          ref={panelRef}
          role="dialog"
          aria-label={label}
          className="vpop"
          data-align={align}
        >
          {children}
        </span>
      )}
    </span>
  )
}
