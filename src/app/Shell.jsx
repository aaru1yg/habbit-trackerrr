/* ============================================================
   SHELL — the persistent chrome: rail, top bar, mobile dock.

   There is no pointer-tracked camera and no animated backdrop.
   The frame stays still so the content is the only thing moving.
   ============================================================ */
import { useEffect, useState } from 'react'
import { useRoute, Link } from './router.jsx'
import { NAV, DOCK, titleFor, parentOf } from './nav.js'
import { useStore } from '../core/store.jsx'
import { IconSearch, IconSettings, Wordmark } from '../ui/icons.jsx'
import CommandPalette from './CommandPalette.jsx'

export default function Shell({ children }) {
  const route = useRoute()
  const { profile } = useStore()
  const [railOpen, setRailOpen] = useState(() => localStorage.getItem('aaru.rail') === 'open')
  const [cmd, setCmd] = useState(false)

  useEffect(() => { localStorage.setItem('aaru.rail', railOpen ? 'open' : 'closed') }, [railOpen])

  /* Cmd-K / Ctrl-K anywhere. */
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setCmd((v) => !v) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="shell" data-rail={railOpen ? 'open' : 'closed'}>
      <a className="skip" href="#main">Skip to content</a>

      <nav className="rail" aria-label="Sections">
        <button
          className="rail__brand"
          onClick={() => setRailOpen((v) => !v)}
          aria-label={railOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          aria-expanded={railOpen}
        >
          <Wordmark size={24} />
          <span className="rail__word">Habit OS</span>
        </button>

        <ul className="rail__nav">
          {NAV.filter((n) => n.id !== 'settings').map((n) => (
            <li key={n.id}>
              <NavItem item={n} active={parentOf(route.name) === n.id} showLabel={railOpen} />
            </li>
          ))}
        </ul>

        <div className="rail__foot">
          <NavItem
            item={NAV.find((n) => n.id === 'settings')}
            active={route.name === 'settings'}
            showLabel={railOpen}
          />
        </div>
      </nav>

      <div className="shell__main">
        <header className="topbar">
          <span className="topbar__title">
            {titleFor(route.name)}
            {route.id && <span className="topbar__crumb"> / detail</span>}
          </span>
          <span className="spacer" />
          <button className="topbar__search" onClick={() => setCmd(true)} aria-label="Search and commands">
            <IconSearch size={15} />
            <span>Search or add</span>
            <kbd className="topbar__kbd">⌘K</kbd>
          </button>
          <Link
            to="settings"
            className="btn btn--ghost btn--icon btn--sm"
            aria-label="Settings"
            style={{ display: 'grid', placeItems: 'center' }}
          >
            <IconSettings size={17} />
          </Link>
        </header>

        <main id="main" className="page">
          <div className="route" key={route.key}>{children}</div>
        </main>

        <SiteFooter />
      </div>

      <nav className="dock" aria-label="Sections">
        {DOCK.map((n) => (
          <Link
            key={n.id}
            to={n.id}
            className="dock__item"
            aria-current={parentOf(route.name) === n.id ? 'page' : undefined}
          >
            <n.Icon size={20} />
            <span>{n.label}</span>
          </Link>
        ))}
      </nav>

      <CommandPalette open={cmd} onClose={() => setCmd(false)} />
      {profile.motion === 'calm' && <style>{'.route{animation:none!important}'}</style>}
    </div>
  )
}

function NavItem({ item, active, showLabel }) {
  if (!item) return null
  return (
    <Link
      to={item.id}
      className="navitem"
      aria-current={active ? 'page' : undefined}
      title={showLabel ? undefined : item.label}
    >
      <span className="navitem__ico"><item.Icon size={19} /></span>
      <span className="rail__label">{item.label}</span>
    </Link>
  )
}

function SiteFooter() {
  return (
    <footer className="foot">
      <span className="foot__legal">
        Habit OS. Your data stays in this browser.
      </span>
      <nav className="foot__links" aria-label="Legal">
        <Link to="privacy">Privacy</Link>
        <Link to="terms">Terms</Link>
      </nav>
    </footer>
  )
}
