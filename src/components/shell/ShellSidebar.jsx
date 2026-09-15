import { Link } from '../../lib/router.jsx'
import { PRIMARY, SECONDARY_SHELL, isActive } from './nav.js'
import { IconSearch, IconSparkle } from '../../lib/icons.jsx'
import BrandMark from './BrandMark.jsx'

/**
 * ShellSidebar — desktop primary navigation.
 * Quiet, compact, typographic, precise. No glow. No giant pills.
 * Active state uses surface-selected + accent + a small leading bar
 * so it never relies on color alone.
 */
export default function ShellSidebar({ route, name, onSearch, onOmni }) {
  return (
    <aside className="app-sidebar" aria-label="Primary">
      <div className="app-sidebar__brand">
        <Link to="today" className="app-brand" aria-label="Habit OS home">
          <BrandMark size={28} />
          <span className="app-brand__name">Habit OS</span>
        </Link>
      </div>

      <nav className="app-nav" aria-label="Primary navigation">
        <ul className="app-nav__list" role="list">
          {PRIMARY.map((item) => {
            const active = isActive(route, item)
            return (
              <li key={item.id}>
                <Link
                  to={item.to}
                  className={['app-nav__item', active ? 'is-active' : ''].filter(Boolean).join(' ')}
                  aria-current={active ? 'page' : undefined}
                >
                  <span className="app-nav__icon" aria-hidden="true"><item.Icon size={18} /></span>
                  <span className="app-nav__label">{item.label}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      <div className="app-sidebar__divider" role="separator" aria-hidden="true" />

      <nav className="app-nav app-nav--secondary" aria-label="Secondary">
        <ul className="app-nav__list" role="list">
          {SECONDARY_SHELL.map((item) => {
            const active = isActive(route, item)
            return (
              <li key={item.id}>
                <Link
                  to={item.to}
                  className={['app-nav__item app-nav__item--secondary', active ? 'is-active' : ''].filter(Boolean).join(' ')}
                  aria-current={active ? 'page' : undefined}
                >
                  <span className="app-nav__icon" aria-hidden="true"><item.Icon size={18} /></span>
                  <span className="app-nav__label">{item.label}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      <div className="app-sidebar__foot">
        <button type="button" className="app-omni-trigger" onClick={onOmni} aria-label="Open Omni (search, create, commands)">
          <span className="app-omni-trigger__icon" aria-hidden="true"><IconSparkle size={16} /></span>
          <span className="app-omni-trigger__label">Omni</span>
          <kbd className="app-omni-trigger__kbd" aria-hidden="true">⌘K</kbd>
        </button>
        <button type="button" className="app-search" onClick={onSearch} aria-label="Search">
          <IconSearch size={16} />
          <span>Search</span>
          <kbd aria-hidden="true">/</kbd>
        </button>
        {name ? (
          <p className="app-sidebar__meta">{name}</p>
        ) : (
          <p className="app-sidebar__meta">Data stays on this device</p>
        )}
      </div>
    </aside>
  )
}
