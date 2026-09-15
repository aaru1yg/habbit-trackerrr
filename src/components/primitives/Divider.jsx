import { forwardRef } from 'react'

/**
 * Divider — semantic separator.
 * vertical: boolean (renders as a vertical divider intended to sit inside
 * a flex row; height: 100%)
 */
const Divider = forwardRef(function Divider({ vertical = false, className = '', ...rest }, ref) {
  return <hr ref={ref} className={['p-divider', vertical ? 'p-divider--vertical' : '', className].filter(Boolean).join(' ')} aria-orientation={vertical ? 'vertical' : 'horizontal'} {...rest} />
})

export default Divider
