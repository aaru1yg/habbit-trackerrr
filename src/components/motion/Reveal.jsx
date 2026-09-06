import { useInViewOnce } from '../../lib/motion.js'

/* ============================================================
   REVEAL — the entrance primitive every V3 composition uses.

   IntersectionObserver-driven, fires once, GPU-only transforms.
   Reduced motion collapses it to the static state via CSS, and
   environments without IntersectionObserver reveal immediately,
   so content can never be stranded invisible.

   variant: 'up' | 'depth' | 'left' | 'right' | 'rise'
   delay:   ms, or use `index` inside a staggered group
   ============================================================ */
export default function Reveal({
  as: Tag = 'div',
  variant = 'up',
  delay = 0,
  index,
  className = '',
  style,
  children,
  ...rest
}) {
  const [ref, inView] = useInViewOnce()
  const d = index != null ? undefined : delay

  return (
    <Tag
      ref={ref}
      data-reveal={variant}
      className={`reveal${inView ? ' is-in' : ''} ${className}`.trim()}
      style={{
        ...(d ? { '--mo-delay': `${d}ms` } : null),
        ...(index != null ? { '--mo-i': index } : null),
        ...style,
      }}
      {...rest}
    >
      {children}
    </Tag>
  )
}
