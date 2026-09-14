import { forwardRef } from 'react'

const GAPS = {
  micro: 'p-gap-micro',
  compact: 'p-gap-compact',
  default: 'p-gap-default',
  comfortable: 'p-gap-comfortable',
  section: 'p-gap-section',
}

const ALIGN = {
  start: 'p-row--start',
  center: 'p-row--center',
  end: 'p-row--end',
  between: 'p-row--between',
  baseline: 'p-row--baseline',
  stretch: 'p-row--stretch',
}

/**
 * Row — horizontal flex row.
 * Props:
 *   gap?: spacing level
 *   align?: 'start'|'center'|'end'|'between'|'baseline'|'stretch' (default 'center')
 *   wrap?: boolean
 */
const Row = forwardRef(function Row({
  as: Tag = 'div',
  gap = 'default',
  align = 'center',
  wrap = false,
  className = '',
  style,
  children,
  ...rest
}, ref) {
  return (
    <Tag
      ref={ref}
      className={[
        'p-row',
        GAPS[gap] || '',
        ALIGN[align] || '',
        wrap ? 'p-row--wrap' : '',
        className,
      ].filter(Boolean).join(' ')}
      style={style}
      {...rest}
    >
      {children}
    </Tag>
  )
})

export default Row
