import { forwardRef } from 'react'

const VARIANTS = {
  primary: 'p-btn--primary',
  secondary: 'p-btn--secondary',
  quiet: 'p-btn--quiet',
  danger: 'p-btn--danger',
  icon: 'p-btn--icon',
}

const SIZES = {
  sm: 'p-btn--sm',
  md: '',
}

/**
 * Button — canonical button primitive.
 *
 * Props:
 *   variant?: 'primary'|'secondary'|'quiet'|'danger'|'icon' (default secondary)
 *   size?:    'sm'|'md' (default md)
 *   block?:   boolean (full width)
 *   loading?: boolean
 *   disabled?: boolean
 *   icon?:    ReactNode (leading / only icon)
 *   trailing?: ReactNode
 *   as?:      'button'|'a'|React component (default 'button')
 *   type?:    'button'|'submit'|'reset' (default 'button')
 *
 * Accessibility: when rendering an icon-only button (variant="icon", or an
 * icon without children text), callers MUST supply an aria-label (or
 * aria-labelledby) so screen readers announce the action. We warn in dev
 * rather than throw to avoid breaking existing screens.
 */
const Button = forwardRef(function Button({
  as: Tag = 'button',
  variant = 'secondary',
  size = 'md',
  block = false,
  loading = false,
  disabled = false,
  icon,
  trailing,
  children,
  className = '',
  type = Tag === 'button' ? 'button' : undefined,
  ...rest
}, ref) {
  const isDisabled = disabled || loading
  const isIconOnly = variant === 'icon' || (!!icon && !children)
  if (process.env.NODE_ENV !== 'production' && isIconOnly) {
    // An href alone does not give an anchor an accessible name. Require an
    // explicit aria-label/aria-labelledby/title, or visible children text
    // (which isIconOnly already excludes).
    const hasName = rest['aria-label'] || rest['aria-labelledby'] || rest.title
    if (!hasName) {
      console.warn('Button: icon-only buttons must have an accessible name (aria-label, aria-labelledby, or title).')
    }
  }
  const classes = [
    'p-btn',
    'p-focus',
    VARIANTS[variant] || '',
    SIZES[size] || '',
    block ? 'p-btn--block' : '',
    isIconOnly ? 'p-btn--icon' : '',
    className,
  ].filter(Boolean).join(' ')

  return (
    <Tag
      ref={ref}
      type={type}
      className={classes}
      disabled={Tag === 'button' ? isDisabled : undefined}
      aria-disabled={isDisabled || undefined}
      aria-busy={loading || undefined}
      data-loading={loading ? 'true' : undefined}
      {...rest}
    >
      {loading ? <span className="p-btn__spinner" aria-hidden="true" /> : icon ? <span data-p-icon aria-hidden="true">{icon}</span> : null}
      {children && !isIconOnly ? <span className="p-btn__label">{children}</span> : null}
      {!isIconOnly && trailing ? <span data-p-icon aria-hidden="true">{trailing}</span> : null}
    </Tag>
  )
})

export default Button
