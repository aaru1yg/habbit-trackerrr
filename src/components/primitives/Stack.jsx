import { forwardRef } from 'react'

const GAPS = {
  micro: 'p-gap-micro',
  compact: 'p-gap-compact',
  default: 'p-gap-default',
  comfortable: 'p-gap-comfortable',
  section: 'p-gap-section',
}

/**
 * Stack — vertical flow.
 * Props:
 *   gap?: 'micro'|'compact'|'default'|'comfortable'|'section' (default 'default')
 *   inline?: boolean (inline-flex instead of flex)
 *   align?: CSS align-items value (e.g. 'start'|'center'|'stretch')
 *   as?: tag (default 'div')
 */
const Stack = forwardRef(function Stack({
  as: Tag = 'div',
  gap = 'default',
  inline = false,
  align,
  className = '',
  style,
  children,
  ...rest
}, ref) {
  return (
    <Tag
      ref={ref}
      className={['p-stack', inline ? 'p-stack--inline' : '', GAPS[gap] || '', className].filter(Boolean).join(' ')}
      style={{ ...(align ? { alignItems: align } : null), ...style }}
      {...rest}
    >
      {children}
    </Tag>
  )
})

export default Stack
