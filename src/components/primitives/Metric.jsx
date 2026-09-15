import { forwardRef } from 'react'

/**
 * Metric — value + label + optional context slot.
 * Not a card. Just numbers.
 *
 * Props:
 *   value:   React node (number, formatted string)
 *   label:   short label (shown as caps caption)
 *   context?: React node (small secondary line, e.g. delta)
 */
const Metric = forwardRef(function Metric({ value, label, context, className = '', ...rest }, ref) {
  return (
    <div ref={ref} className={['p-metric', className].filter(Boolean).join(' ')} {...rest}>
      <p className="p-metric__value">{value}</p>
      {label ? <p className="p-metric__label">{label}</p> : null}
      {context ? <p className="p-metric__context">{context}</p> : null}
    </div>
  )
})

export default Metric
