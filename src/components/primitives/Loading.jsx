import { forwardRef } from 'react'

/**
 * Loading — reserved-dimension skeletons + small spinner.
 *
 * Variants:
 *   variant='skeleton' (default) — supports shape: 'text'|'heading'|'circle'|'rect'
 *   variant='spinner' — small inline spinner (size sm|md)
 *
 * Always reserves vertical space so content doesn't shift on load.
 */
const Loading = forwardRef(function Loading({
  variant = 'skeleton',
  shape = 'text',
  size = 'md',
  width,
  height,
  label = 'Loading',
  className = '',
  style,
  ...rest
}, ref) {
  if (variant === 'spinner') {
    return (
      <span
        ref={ref}
        role="status"
        aria-label={label}
        className={['p-spinner', size === 'sm' ? 'p-spinner--sm' : '', className].filter(Boolean).join(' ')}
        style={style}
        {...rest}
      />
    )
  }

  const shapeClass =
    shape === 'circle' ? 'p-skeleton p-skeleton--circle' :
    shape === 'heading' ? 'p-skeleton p-skeleton--text p-skeleton--heading' :
    shape === 'text' ? 'p-skeleton p-skeleton--text' :
    'p-skeleton'

  return (
    <span
      ref={ref}
      role="status"
      aria-label={label}
      aria-busy="true"
      className={[shapeClass, className].filter(Boolean).join(' ')}
      style={{ width, height, ...style }}
      {...rest}
    >
      &nbsp;
    </span>
  )
})

export default Loading
