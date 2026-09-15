import { forwardRef } from 'react'

const TONES = {
  accent: '',
  success: 'p-progress--success',
  warning: 'p-progress--warning',
  danger: 'p-progress--danger',
}

/**
 * Progress — linear progress.
 * Props:
 *   value:         0..100 (determinate)
 *   indeterminate: boolean (loading bar)
 *   tone:          'accent'|'success'|'warning'|'danger'
 *   thin:          3px rail (Work aggregate rails); default 6px
 *   label:         accessible label
 */
const Progress = forwardRef(function Progress({
  value,
  indeterminate = false,
  tone = 'accent',
  thin = false,
  label,
  className = '',
  style,
  ...rest
}, ref) {
  const pct = indeterminate ? null : Math.max(0, Math.min(100, Number(value) || 0))
  return (
    <div
      ref={ref}
      role="progressbar"
      aria-valuenow={indeterminate ? undefined : pct}
      aria-valuemin={indeterminate ? undefined : 0}
      aria-valuemax={indeterminate ? undefined : 100}
      aria-label={label}
      className={[
        'p-progress',
        TONES[tone] || '',
        thin ? 'p-progress--thin' : '',
        indeterminate ? 'p-progress--indeterminate' : '',
        className,
      ].filter(Boolean).join(' ')}
      style={style}
      {...rest}
    >
      <div className="p-progress__bar" style={indeterminate ? undefined : { width: `${pct}%` }} />
    </div>
  )
})

export default Progress
