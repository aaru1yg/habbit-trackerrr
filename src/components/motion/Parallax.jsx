import { useEffect, useRef } from 'react'
import { prefersReducedMotion, onReducedMotionChange, getCapability } from '../../lib/capability.js'

/* ============================================================
   PARALLAX — scroll-linked travel at a chosen depth.

   A rAF-throttled scroll listener writes one custom property
   (--px, 0..1); CSS maps it to a translate. Nothing but transform
   changes, so no layout thrash. Reduced motion and low-tier
   devices pin the layer at rest.

   travel: 1 (near, subtle) | 2 (mid) | 3 (far, cinematic)
   ============================================================ */
export default function Parallax({ travel = 1, className = '', style, children, as: Tag = 'div', ...rest }) {
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
    if (!el || typeof window === 'undefined') return undefined

    let raf = 0
    let reduced = prefersReducedMotion()
    const lowTier = getCapability().tier === 'low'

    const compute = () => {
      raf = 0
      if (reduced || lowTier) {
        el.style.setProperty('--px', '0.5')
        return
      }
      const rect = el.getBoundingClientRect()
      const vh = window.innerHeight || 1
      const total = rect.height + vh
      const p = Math.max(0, Math.min(1, (vh - rect.top) / total))
      el.style.setProperty('--px', p.toFixed(4))
    }
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(compute) }

    const offReduced = onReducedMotionChange((v) => { reduced = v; onScroll() })
    compute()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      offReduced()
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <Tag ref={ref} className={`parallax ${className}`.trim()} data-travel={travel} style={style} {...rest}>
      {children}
    </Tag>
  )
}
