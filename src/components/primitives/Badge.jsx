import { forwardRef } from 'react'

const TONES = {
  neutral: '',
  success: 'p-badge--success',
  warning: 'p-badge--warning',
  danger: 'p-badge--danger',
  info: 'p-badge--info',
  accent: 'p-badge--accent',
}

/**
 * Badge — small status chip.
 * Always renders with a visible shape and label; never relies on color alone
 * (outline fill + text hue both change per tone).
 */
const Badge = forwardRef(function Badge({
  tone = 'neutral',
  children,
  className = '',
  ...rest
}, ref) {
  return (
    <span
      ref={ref}
      className={['p-badge', TONES[tone] || '', className].filter(Boolean).join(' ')}
      {...rest}
    >
      {children}
    </span>
  )
})

export default Badge
