import { forwardRef } from 'react'

const VARIANTS = {
  base: '',
  raised: 'p-surface--raised',
  inset: 'p-surface--inset',
  interactive: 'p-surface--interactive',
  selected: 'p-surface--selected',
  focused: 'p-surface--focused',
}

/**
 * Surface — universal semantic container.
 *
 * Props:
 *   variant?: 'base' | 'raised' | 'inset' | 'interactive' | 'selected' | 'focused'
 *   flush?: boolean (remove padding for raised variants)
 *   as?: element type (default 'div')
 *   className?, style?, children, any DOM props
 *
 * Semantic levels map directly to Step 1A surface tokens. No arbitrary
 * colors or shadows.
 */
const Surface = forwardRef(function Surface({
  as: Tag = 'div',
  variant = 'base',
  flush = false,
  className = '',
  children,
  interactive: _ignored, // alias for variant='interactive'
  ...rest
}, ref) {
  const variantClass = VARIANTS[variant] || ''
  return (
    <Tag
      ref={ref}
      className={[
        'p-surface',
        'p-focus',
        variantClass,
        flush ? 'p-surface--flush' : '',
        className,
      ].filter(Boolean).join(' ')}
      {...(variant === 'interactive' && Tag === 'div' ? { role: 'button', tabIndex: 0 } : {})}
      {...rest}
    >
      {children}
    </Tag>
  )
})

export default Surface
