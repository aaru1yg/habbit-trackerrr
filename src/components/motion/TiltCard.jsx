import { useCallback, useRef } from 'react'
import { getCapability, prefersReducedMotion } from '../../lib/capability.js'

/* ============================================================
   TILT CARD — CSS 3D depth that answers the pointer (spec §20).

   The card rotates a few degrees toward the cursor and a soft
   specular sheen follows it. Touch devices, reduced-motion users
   and low-tier hardware get a plain card: depth must never cost
   comprehension or comfort.

   Writes only custom properties; CSS owns the easing.
   ============================================================ */
export default function TiltCard({
  as: Tag = 'div',
  max = 5,
  sheen = true,
  className = '',
  style,
  children,
  onPointerEnter,
  onPointerLeave,
  ...rest
}) {
  const ref = useRef(null)
  const raf = useRef(0)
  const enabled = () => {
    const cap = getCapability()
    return !cap.touch && cap.tier !== 'low' && !prefersReducedMotion()
  }

  const onMove = useCallback((e) => {
    const el = ref.current
    if (!el || !enabled()) return
    if (raf.current) return
    raf.current = requestAnimationFrame(() => {
      raf.current = 0
      const rect = el.getBoundingClientRect()
      if (!rect.width || !rect.height) return
      const px = (e.clientX - rect.left) / rect.width
      const py = (e.clientY - rect.top) / rect.height
      const cap = getCapability()
      const m = Math.min(max, cap.tier === 'high' ? max : max * 0.6)
      el.style.setProperty('--tilt-y', `${((px - 0.5) * 2 * m).toFixed(2)}deg`)
      el.style.setProperty('--tilt-x', `${((0.5 - py) * 2 * m).toFixed(2)}deg`)
      el.style.setProperty('--sheen-x', `${(px * 100).toFixed(1)}%`)
      el.style.setProperty('--sheen-y', `${(py * 100).toFixed(1)}%`)
    })
  }, [max])

  const enter = useCallback((e) => {
    const el = ref.current
    if (!el || !enabled()) return
    el.dataset.tilting = 'true'
    onPointerEnter?.(e)
  }, [onPointerEnter])

  const leave = useCallback((e) => {
    const el = ref.current
    if (!el) return
    el.dataset.tilting = 'false'
    el.style.setProperty('--tilt-x', '0deg')
    el.style.setProperty('--tilt-y', '0deg')
    onPointerLeave?.(e)
  }, [onPointerLeave])

  return (
    <Tag
      ref={ref}
      className={`tilt ${className}`.trim()}
      style={style}
      onPointerMove={onMove}
      onPointerEnter={enter}
      onPointerLeave={leave}
      {...rest}
    >
      {children}
      {sheen && <span className="tilt-sheen" aria-hidden="true" />}
    </Tag>
  )
}
