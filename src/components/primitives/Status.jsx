import { forwardRef } from 'react'

const TONES = {
  neutral: 'p-status--neutral',
  success: 'p-status--success',
  warning: 'p-status--warning',
  danger: 'p-status--danger',
  info: 'p-status--info',
}

/**
 * Status — inline status label with a leading dot (so the message is not
 * color-only). Renders as neutral if no tone is provided.
 */
const Status = forwardRef(function Status({
  tone = 'neutral',
  children,
  className = '',
  ...rest
}, ref) {
  return (
    <span ref={ref} className={['p-status', TONES[tone] || '', className].filter(Boolean).join(' ')} {...rest}>
      <span className="p-status__dot" aria-hidden="true" />
      <span>{children}</span>
    </span>
  )
})

export default Status
