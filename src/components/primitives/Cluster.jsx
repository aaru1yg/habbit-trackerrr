import { forwardRef } from 'react'

/**
 * Cluster — wrapping inline cluster (chips, tags, toolbar groups).
 * Uses a consistent compact gap; accepts optional `gap` override.
 */
const Cluster = forwardRef(function Cluster({
  as: Tag = 'div',
  gap = 'compact',
  align = 'center',
  className = '',
  style,
  children,
  ...rest
}, ref) {
  return (
    <Tag
      ref={ref}
      className={[
        'p-cluster',
        `p-gap-${gap}`,
        align ? `p-row--${align}` : '',
        className,
      ].filter(Boolean).join(' ')}
      style={{ alignItems: align, ...style }}
      {...rest}
    >
      {children}
    </Tag>
  )
})

export default Cluster
