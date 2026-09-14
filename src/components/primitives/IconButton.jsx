import { forwardRef } from 'react'
import Button from './Button.jsx'

/**
 * IconButton — circular icon-only action.
 *
 * Props:
 *   label:    accessible name (required)
 *   icon:     the icon node (required)
 *   size?:    'sm'|'md' (default md)
 *   active?:  aria-pressed (for toggleable actions)
 *   disabled?: boolean
 *   tooltip?: string (applied as title; prefer aria-label for a11y)
 */
const IconButton = forwardRef(function IconButton({
  label,
  icon,
  size = 'md',
  active = false,
  disabled = false,
  tooltip,
  className = '',
  ...rest
}, ref) {
  if (!label && process.env.NODE_ENV !== 'production') {
    console.warn('IconButton: accessible `label` prop is required.')
  }
  return (
    <Button
      ref={ref}
      variant="icon"
      size={size}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active || undefined}
      title={tooltip || label}
      className={className}
      icon={icon}
      {...rest}
    />
  )
})

export default IconButton
