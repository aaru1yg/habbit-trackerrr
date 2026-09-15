import { Link } from '../../lib/router.jsx'
import { PRIMARY, isActive } from './nav.js'
import { IconSparkle, IconMore } from '../../lib/icons.jsx'

/**
 * ShellMobileNav — fixed bottom bar for mobile.
 * 4 primary pillars + Omni capture button in the center + More entry
 * for secondary destinations. All targets ≥44px. Safe-area aware.
 * Active state uses a filled surface-selected pill + accent icon +
 * label weight — never color alone.
 */
export default function ShellMobileNav({ route, onCapture, onMore }) {
  const half = Math.ceil(PRIMARY.length / 2)
  const left = PRIMARY.slice(0, half)
  const right = PRIMARY.slice(half)

  return (
    <nav className="app-mobile-nav" aria-label="Primary">
      <ul className="app-mobile-nav__list" role="list">
        {left.map((item) => {
          const active = isActive(route, item)
          return (
            <li key={item.id}>
              <Link
                to={item.to}
                className={['app-mobile-nav__item', active ? 'is-active' : ''].filter(Boolean).join(' ')}
                aria-current={active ? 'page' : undefined}
              >
                <span className="app-mobile-nav__icon" aria-hidden="true"><item.Icon size={22} /></span>
                <span className="app-mobile-nav__label">{item.label}</span>
              </Link>
            </li>
          )
        })}

        <li className="app-mobile-nav__capture">
          <button
            type="button"
            className="app-mobile-nav__omni"
            onClick={onCapture}
            aria-label="Open Omni — search, create, commands"
          >
            <IconSparkle size={22} />
          </button>
        </li>

        {right.map((item) => {
          const active = isActive(route, item)
          return (
            <li key={item.id}>
              <Link
                to={item.to}
                className={['app-mobile-nav__item', active ? 'is-active' : ''].filter(Boolean).join(' ')}
                aria-current={active ? 'page' : undefined}
              >
                <span className="app-mobile-nav__icon" aria-hidden="true"><item.Icon size={22} /></span>
                <span className="app-mobile-nav__label">{item.label}</span>
              </Link>
            </li>
          )
        })}

        <li>
          <button
            type="button"
            className="app-mobile-nav__item app-mobile-nav__more"
            onClick={onMore}
            aria-label="More sections and settings"
          >
            <span className="app-mobile-nav__icon" aria-hidden="true"><IconMore size={22} /></span>
            <span className="app-mobile-nav__label">More</span>
          </button>
        </li>
      </ul>
    </nav>
  )
}
