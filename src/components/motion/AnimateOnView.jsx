import { useInViewOnce } from '../../lib/motion.js'

/* ============================================================
   ANIMATE ON VIEW — flips a wrapper into its animated state the
   first time it enters the viewport, then leaves it alone.

   Charts use this to play their story once:
     <AnimateOnView effect="chart-draw">…svg…</AnimateOnView>

   The effect classes live in styles/motion.css and each one has
   a static final state, so reduced-motion users (and browsers
   without IntersectionObserver) see the finished chart.
   ============================================================ */
export default function AnimateOnView({ effect, as: Tag = 'div', className = '', style, children, ...rest }) {
  const [ref, inView] = useInViewOnce({ margin: '-8% 0px', threshold: 0.18 })
  return (
    <Tag ref={ref} className={`${effect}${inView ? ' is-in' : ''} ${className}`.trim()} style={style} {...rest}>
      {children}
    </Tag>
  )
}
