import { forwardRef } from 'react'

/**
 * EmptyState — purpose + explanation + primary/secondary action.
 *
 * Props:
 *   icon?:     React node (rendered inside a soft circle; optional)
 *   title:     short heading
 *   children:  explanation paragraph(s)
 *   action?:   React node (a Button, typically primary)
 *   secondary?: React node (secondary action, e.g. link or quiet button)
 */
const EmptyState = forwardRef(function EmptyState({
  icon,
  eyebrow,
  title,
  titleProps,
  children,
  action,
  secondary,
  className = '',
  ...rest
}, ref) {
  return (
    <div ref={ref} className={['p-empty', className].filter(Boolean).join(' ')} {...rest}>
      {icon ? <div className="p-empty__icon" aria-hidden="true">{icon}</div> : null}
      {eyebrow ? <p className="p-empty__eyebrow">{eyebrow}</p> : null}
      {title ? <h2 className="p-empty__title" {...(titleProps || {})}>{title}</h2> : null}
      {children ? <p className="p-empty__desc">{children}</p> : null}
      {(action || secondary) ? (
        <div className="p-empty__actions">
          {action}
          {secondary}
        </div>
      ) : null}
    </div>
  )
})

export default EmptyState
