import { forwardRef } from 'react'
import { IconCheck, IconAlert, IconX, IconInsights } from '../../lib/icons.jsx'

const TONES = {
  info:    'p-callout--info',
  success: 'p-callout--success',
  warning: 'p-callout--warning',
  danger:  'p-callout--danger',
}

const ICONS = {
  info:    <IconInsights size={18} />,
  success: <IconCheck size={18} />,
  warning: <IconAlert size={18} />,
  danger:  <IconX size={18} />,
}

/**
 * Callout — inline semantic feedback.
 * role='status' (polite live region) for non-critical; pass role='alert'
 * via props for urgent messages.
 */
const Callout = forwardRef(function Callout({
  tone = 'info',
  icon,
  title,
  children,
  role = 'status',
  className = '',
  ...rest
}, ref) {
  return (
    <div
      ref={ref}
      role={role}
      className={['p-callout', TONES[tone] || '', className].filter(Boolean).join(' ')}
      {...rest}
    >
      <div className="p-callout__icon" aria-hidden="true">{icon ?? ICONS[tone]}</div>
      <div className="p-callout__body">
        {title ? <p className="p-callout__title">{title}</p> : null}
        {children ? <p className="p-callout__text">{children}</p> : null}
      </div>
    </div>
  )
})

export default Callout
