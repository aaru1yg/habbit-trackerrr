/* ============================================================
   SHELL — chrome, 3D stage, and the pointer camera.
   ============================================================ */
import { useEffect, useRef, useState } from 'react'
import { useRoute, Link } from './router.jsx'
import { NAV, DOCK, accentFor, titleFor, parentOf } from './nav.js'
import { useStore } from '../core/store.jsx'
import { IconSearch, IconSpark, IconSettings } from '../ui/icons.jsx'
import CommandPalette from './CommandPalette.jsx'

export default function Shell({ children }) {
  const route = useRoute()
  const { profile } = useStore()
  const [railOpen, setRailOpen] = useState(() => localStorage.getItem('aaru.rail') === 'open')
  const [cmd, setCmd] = useState(false)

  const accent = accentFor(route.name)

  useEffect(() => { localStorage.setItem('aaru.rail', railOpen ? 'open' : 'closed') }, [railOpen])

  /* ⌘K / Ctrl-K anywhere. */
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setCmd((v) => !v) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="shell" data-accent={accent} data-rail={railOpen ? 'open' : 'closed'}>
      <a className="skip" href="#main">Skip to content</a>
      <Backdrop />

      <nav className="rail" aria-label="Main">
        <button
          className="rail__brand"
          onClick={() => setRailOpen((v) => !v)}
          aria-label={railOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          style={{ background: 'none', border: 0, cursor: 'pointer' }}
        >
          <span className="rail__mark"><IconSpark size={19} /></span>
          <span className="rail__word">Habit OS</span>
        </button>

        <div className="rail__nav">
          {NAV.filter((n) => n.id !== 'settings').map((n) => (
            <NavItem key={n.id} item={n} active={parentOf(route.name) === n.id} showLabel={railOpen} />
          ))}
        </div>

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
            <IconSearch size={16} />
            <span>Search or add…</span>
            <kbd className="topbar__kbd">⌘K</kbd>
          </button>
          <Link
            to="settings"
            className="btn btn--ghost btn--icon btn--sm"
            aria-label="Settings"
            style={{ display: 'grid', placeItems: 'center' }}
          >
            <IconSettings size={18} />
          </Link>
        </header>

        <main id="main" className="page">
          <Stage key={route.key}>{children}</Stage>
        </main>
      </div>

      <nav className="dock" aria-label="Main">
        {DOCK.map((n) => (
          <Link
            key={n.id}
            to={n.id}
            className="dock__item"
            aria-current={parentOf(route.name) === n.id ? 'page' : undefined}
            data-accent={n.accent}
          >
            <n.Icon size={21} />
            <span>{n.label}</span>
          </Link>
        ))}
      </nav>

      <CommandPalette open={cmd} onClose={() => setCmd(false)} />
      {profile.motion === 'calm' && <style>{'.route,.rise,.cols__col{animation:none!important}'}</style>}
    </div>
  )
}

function NavItem({ item, active, showLabel }) {
  if (!item) return null
  return (
    <Link to={item.id} className="navitem" aria-current={active ? 'page' : undefined} title={showLabel ? undefined : item.label}>
      <span className="navitem__ico"><item.Icon size={20} /></span>
      <span className="rail__label">{item.label}</span>
    </Link>
  )
}

/* ============================================================
   STAGE — the perspective camera every page lives inside.

   One pointermove listener for the entire app, throttled to the
   frame, writing two custom properties. The browser composites
   the rotation on the GPU; React never re-renders.
   ============================================================ */
function Stage({ children }) {
  const world = useRef(null)

  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    if (window.matchMedia?.('(hover: none)').matches) return

    let raf = null
    let tx = 0
    let ty = 0

    const onMove = (e) => {
      const cx = (e.clientX / window.innerWidth - 0.5) * 2
      const cy = (e.clientY / window.innerHeight - 0.5) * 2
      ty = cx * 1.5   // rotateY follows horizontal
      tx = -cy * 0.9  // rotateX follows vertical, inverted
      if (raf == null) raf = requestAnimationFrame(apply)
    }
    const apply = () => {
      raf = null
      const el = world.current
      if (!el) return
      el.style.setProperty('--tilt-x', `${tx.toFixed(3)}deg`)
      el.style.setProperty('--tilt-y', `${ty.toFixed(3)}deg`)
    }
    const onLeave = () => {
      const el = world.current
      if (!el) return
      el.style.setProperty('--tilt-x', '0deg')
      el.style.setProperty('--tilt-y', '0deg')
    }

    window.addEventListener('pointermove', onMove, { passive: true })
    document.addEventListener('pointerleave', onLeave)
    return () => {
      if (raf != null) cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerleave', onLeave)
    }
  }, [])

  return (
    <div className="stage">
      <div className="stage__world" ref={world}>
        <div className="route">{children}</div>
      </div>
    </div>
  )
}

function Backdrop() {
  return (
    <div className="backdrop" aria-hidden="true">
      <div className="backdrop__orb backdrop__orb--a" />
      <div className="backdrop__orb backdrop__orb--b" />
      <div className="backdrop__orb backdrop__orb--c" />
      <div className="backdrop__grid" />
      <div className="backdrop__grain" />
    </div>
  )
}

export { Stage, Backdrop }
