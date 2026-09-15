import { forwardRef } from 'react'

/**
 * PageContainer — single reusable outer layout for every screen.
 * Controls max width, horizontal gutter, vertical rhythm.
 *
 * Width families (Step 4G-3):
 *   size="narrow"     720px — focused/editorial (Today, Routines)
 *   size="detail"     880px — single-entity detail (Habit Detail)
 *   size="workspace"  980px — tabular/list-heavy workspace (Habits Active, Week)
 *   size="wide"      1240px — wide data grids (Calendar)
 *
 * Default (no size) inherits the app-wide content width (1200px).
 * On mobile it reserves bottom space for the fixed nav + safe area.
 */
const SIZES = {
  narrow: 'app-page--narrow',
  detail: 'app-page--detail',
  workspace: 'app-page--workspace',
  wide: 'app-page--wide',
}

const PageContainer = forwardRef(function PageContainer({
  as: Tag = 'div',
  className = '',
  padded = true,
  size,
  children,
  ...rest
}, ref) {
  const sizeClass = size && SIZES[size] ? SIZES[size] : ''
  return (
    <Tag
      ref={ref}
      className={['app-page', padded ? 'app-page--padded' : '', sizeClass, className].filter(Boolean).join(' ')}
      {...rest}
    >
      {children}
    </Tag>
  )
})

export default PageContainer
